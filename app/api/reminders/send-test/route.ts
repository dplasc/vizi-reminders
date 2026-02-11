import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getResendClient, getRemindersFromEmail } from "@/lib/resend";
import { formatDateOnlyZagreb, formatTimeOnlyZagreb } from "@/lib/formatZagreb";

const SESSION_COOKIE_NAME = "vizi_reminders_session";
const EMAIL_ERROR_MAX_LENGTH = 500;

type AppointmentRow = {
  id: string;
  owner_id: string;
  title: string;
  email: string | null;
  starts_at: string;
  status: string;
  email_sent_at: string | null;
  email_error: string | null;
};

const SENDER_FALLBACK = "Vizi Podsjetnici";

// DB stores UTC; email displays Europe/Zagreb to match UI.
function buildReminderHtml(params: {
  senderName: string;
  title: string;
  dateStr: string;
  timeStr: string;
}): string {
  const { senderName, title, dateStr, timeStr } = params;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; line-height: 1.5; color: #333;">
  <p>Poštovani/na,</p>
  <p>Od: ${escapeHtml(senderName)}</p>
  <p>Podsjetnik: imate termin ${dateStr} u ${timeStr}.</p>
  <p>Naziv: <strong>${escapeHtml(title)}</strong></p>
  <p style="margin-top: 2em; font-size: 0.9em; color: #666;">
    Ovu poruku ste dobili jer ste unijeli termin u Vizi Podsjetnike.
  </p>
</body>
</html>
  `.trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE_NAME);
  const userId = session?.value;

  if (!userId?.trim()) {
    return NextResponse.json(
      { error: "Niste prijavljeni." },
      { status: 401 }
    );
  }

  let body: { appointmentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Neispravan zahtjev." },
      { status: 400 }
    );
  }

  const appointmentId =
    typeof body?.appointmentId === "string" ? body.appointmentId.trim() : "";
  if (!appointmentId) {
    return NextResponse.json(
      { error: "Nedostaje identifikator termina." },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, owner_id, title, email, starts_at, status, email_sent_at, email_error")
    .eq("id", appointmentId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[reminders/send-test] Fetch failed:", error.message);
    return NextResponse.json(
      { error: "Učitavanje termina nije uspjelo." },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Termin nije pronađen ili nemate dozvolu." },
      { status: 404 }
    );
  }

  const row = data as AppointmentRow;

  const email = row.email?.trim() ?? "";
  if (row.status !== "ready") {
    return NextResponse.json(
      {
        error:
          "Podsjetnik se može poslati samo za termine sa statusom „spremno” i unesenim e-mailom.",
      },
      { status: 400 }
    );
  }
  if (!email) {
    return NextResponse.json(
      { error: "Za ovaj termin nije unesen e-mail. Unesite e-mail u uređivanju termina." },
      { status: 400 }
    );
  }
  if (row.email_sent_at != null) {
    return NextResponse.json(
      { error: "Podsjetnik za ovaj termin je već poslan." },
      { status: 400 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  const displayName = (profile as { display_name?: string | null } | null)?.display_name;
  const senderName = displayName?.trim() ? displayName.trim() : SENDER_FALLBACK;

  const dateStr = formatDateOnlyZagreb(row.starts_at);
  const timeStr = formatTimeOnlyZagreb(row.starts_at);
  const subject = `Podsjetnik — ${senderName}`;
  const html = buildReminderHtml({
    senderName,
    title: row.title ?? "",
    dateStr,
    timeStr,
  });

  let sendError: string | null = null;
  try {
    const resend = getResendClient();
    const from = getRemindersFromEmail();
    const result = await resend.emails.send({
      from,
      to: email,
      subject,
      html,
    });

    if (result.error) {
      sendError = typeof result.error.message === "string"
        ? result.error.message
        : JSON.stringify(result.error);
    }
  } catch (err) {
    sendError = err instanceof Error ? err.message : String(err);
  }

  if (sendError) {
    const truncated =
      sendError.length > EMAIL_ERROR_MAX_LENGTH
        ? sendError.slice(0, EMAIL_ERROR_MAX_LENGTH)
        : sendError;
    await supabase
      .from("appointments")
      .update({ email_error: truncated })
      .eq("id", appointmentId)
      .eq("owner_id", userId);
    console.error("[reminders/send-test] Send failed:", sendError);
    return NextResponse.json(
      { error: "Slanje e-maila nije uspjelo. Pokušajte ponovno." },
      { status: 500 }
    );
  }

  await supabase
    .from("appointments")
    .update({ email_sent_at: new Date().toISOString(), email_error: null })
    .eq("id", appointmentId)
    .eq("owner_id", userId);

  return NextResponse.json({
    success: true,
    message: "Podsjetnik je uspješno poslan na navedenu e-mail adresu.",
  });
}
