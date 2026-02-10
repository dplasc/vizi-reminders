import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { zagrebLocalToUtcIso } from "@/lib/datetime/zagrebLocalToUtcIso";

const SESSION_COOKIE_NAME = "vizi_reminders_session";

type UpdateBody = {
  title?: string;
  email?: string;
  date?: string;
  time?: string;
};

function validateUpdate(body: UpdateBody): { ok: true } | { ok: false; error: string } {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return { ok: false, error: "Ime klijenta je obavezno." };
  }
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const time = typeof body.time === "string" ? body.time.trim() : "";
  if (!date || !time) {
    return { ok: false, error: "Datum i vrijeme termina su obavezni." };
  }
  const combined = `${date}T${time}`;
  const parsed = new Date(combined);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: "Neispravan datum ili vrijeme." };
  }
  return { ok: true };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: appointmentId } = await params;
  const session = request.cookies.get(SESSION_COOKIE_NAME);
  const userId = session?.value;

  if (!userId?.trim()) {
    return NextResponse.json(
      { error: "Niste prijavljeni." },
      { status: 401 }
    );
  }

  if (!appointmentId?.trim()) {
    return NextResponse.json(
      { error: "Termin nije pronađen." },
      { status: 404 }
    );
  }

  let body: UpdateBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Neispravan zahtjev." },
      { status: 400 }
    );
  }

  const validation = validateUpdate(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const title = (body.title as string).trim();
  const emailRaw = typeof body.email === "string" ? body.email.trim() : "";
  const email = emailRaw || null;
  const date = (body.date as string).trim();
  const time = (body.time as string).trim();
  // UI is Europe/Zagreb; DB stores UTC timestamptz.
  const startsAt = zagrebLocalToUtcIso(date, time);
  const status = email ? "ready" : "no_email";

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .update({ title, email, starts_at: startsAt, status })
    .eq("id", appointmentId)
    .eq("owner_id", userId)
    .select("id");

  if (error) {
    console.error("[api/appointments/[id]] Update failed:", error.message);
    return NextResponse.json(
      { error: "Spremanje promjena nije uspjelo. Pokušajte ponovno." },
      { status: 500 }
    );
  }

  if (!data?.length) {
    return NextResponse.json(
      { error: "Termin nije pronađen ili nemate dozvolu za uređivanje." },
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: appointmentId } = await params;
  const session = _request.cookies.get(SESSION_COOKIE_NAME);
  const userId = session?.value;

  if (!userId?.trim()) {
    return NextResponse.json(
      { error: "Niste prijavljeni." },
      { status: 401 }
    );
  }

  if (!appointmentId?.trim()) {
    return NextResponse.json(
      { error: "Termin nije pronađen." },
      { status: 404 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("owner_id", userId)
    .select("id");

  if (error) {
    console.error("[api/appointments/[id]] Delete failed:", error.message);
    return NextResponse.json(
      { error: "Brisanje termina nije uspjelo. Pokušajte ponovno." },
      { status: 500 }
    );
  }

  if (!data?.length) {
    return NextResponse.json(
      { error: "Termin nije pronađen ili nemate dozvolu za brisanje." },
      { status: 404 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
