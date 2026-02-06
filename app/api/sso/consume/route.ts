import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "vizi_reminders_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getEnv(name: string): string | undefined {
  return process.env[name];
}

export async function POST(request: NextRequest) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Neispravan zahtjev." },
      { status: 400 }
    );
  }

  const token = body?.token;
  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json(
      { ok: false, error: "Nedostaje SSO token." },
      { status: 400 }
    );
  }

  const baseUrl = getEnv("VIZI_CORE_BASE_URL");
  const sharedSecret = getEnv("VIZI_SSO_SHARED_SECRET");

  if (!baseUrl || !sharedSecret) {
    console.error("[SSO consume] Missing VIZI_CORE_BASE_URL or VIZI_SSO_SHARED_SECRET");
    return NextResponse.json(
      { ok: false, error: "Prijava nije uspjela." },
      { status: 500 }
    );
  }

  const verifyUrl = `${baseUrl.replace(/\/$/, "")}/api/sso/verify`;
  let verifyRes: Response;
  try {
    verifyRes = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sharedSecret}`,
        "x-vizi-sso-secret": sharedSecret,
      },
      body: JSON.stringify({ token }),
    });
  } catch (err) {
    console.error("[SSO consume] Verify request failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json(
      { ok: false, error: "Prijava nije uspjela." },
      { status: 502 }
    );
  }

  const responseText = await verifyRes.text();

  if (!verifyRes.ok) {
    console.error("sso-consume-failed", { status: verifyRes.status, text: responseText });
    let errorMessage = "Neispravan ili istekao token.";
    try {
      const parsed = JSON.parse(responseText) as { error?: string };
      if (typeof parsed?.error === "string" && parsed.error) {
        errorMessage = parsed.error;
      }
    } catch {
      /* use default */
    }
    return NextResponse.json({ ok: false, error: errorMessage }, { status: 401 });
  }

  let data: { ok?: boolean; userId?: string; error?: string };
  try {
    data = JSON.parse(responseText);
  } catch {
    console.error("sso-consume-failed", { status: verifyRes.status, text: responseText });
    return NextResponse.json(
      { ok: false, error: "Prijava nije uspjela." },
      { status: 502 }
    );
  }

  if (!data?.ok || !data?.userId || typeof data.userId !== "string") {
    const message = typeof data?.error === "string" ? data.error : "Neispravan ili istekao token.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 401 }
    );
  }

  const dashboardUrl = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(dashboardUrl, 302);
  response.cookies.set(SESSION_COOKIE_NAME, data.userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return response;
}
