import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getResendClient, getRemindersFromEmail } from "@/lib/resend";

const CRON_SECRET = process.env.CRON_SECRET;
const TIMEZONE = "Europe/Zagreb";
const EMAIL_ERROR_MAX_LENGTH = 500;
const BATCH_LIMIT = 200;

/**
 * Returns tomorrow's date window in UTC as ISO strings, based on Europe/Zagreb calendar.
 * Uses Intl for current date parts in Zagreb, adds one day, then builds
 * start = YYYY-MM-DDT00:00:00.000Z and end = YYYY-MM-DDT23:59:59.999Z
 * so that starts_at within this range falls on "tomorrow" in Zagreb.
 */
function getTomorrowWindowInZagreb(): { startIso: string; endIso: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10);
  const d = parseInt(get("day"), 10);

  // Add one calendar day in UTC (noon to avoid DST edge cases)
  const temp = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  temp.setUTCDate(temp.getUTCDate() + 1);
  const ty = temp.getUTCFullYear();
  const tm = String(temp.getUTCMonth() + 1).padStart(2, "0");
  const td = String(temp.getUTCDate()).padStart(2, "0");

  const startIso = `${ty}-${tm}-${td}T00:00:00.000Z`;
  const endIso = `${ty}-${tm}-${td}T23:59:59.999Z`;
  return { startIso, endIso };
}

type AppointmentRow = {
  id: string;
  owner_id: string;
  starts_at: string;
  email: string | null;
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    console.warn("[cron/send-reminders] Unauthorized: missing or invalid Authorization header");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7).trim();

  if (!CRON_SECRET || token !== CRON_SECRET) {
    console.warn("[cron/send-reminders] Unauthorized: invalid CRON_SECRET");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { startIso, endIso } = getTomorrowWindowInZagreb();
  console.log("[cron/send-reminders] Start", { batchLimit: BATCH_LIMIT, window: { startIso, endIso } });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, owner_id, starts_at, email")
    .gte("starts_at", startIso)
    .lte("starts_at", endIso)
    .not("email", "is", null)
    .is("email_sent_at", null)
    .neq("status", "canceled")
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error) {
    console.error("[cron/send-reminders] Query failed:", error.message);
    return NextResponse.json(
      { error: "query_failed", message: error.message },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as AppointmentRow[];
  const withEmail = rows.filter((r) => r.email != null && r.email.trim() !== "");
  const found = withEmail.length;

  const resend = getResendClient();
  const from = getRemindersFromEmail();
  const subject = "Podsjetnik za termin sutra";
  const html = "<p>Ovo je podsjetnik za vaš termin sutra.</p>";

  let sent = 0;
  let failed = 0;

  for (const appointment of withEmail) {
    const to = appointment.email!.trim();
    let sendError: string | null = null;

    try {
      const result = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });
      if (result.error) {
        sendError =
          typeof result.error.message === "string"
            ? result.error.message
            : JSON.stringify(result.error);
      }
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err);
    }

    if (sendError) {
      failed += 1;
      console.warn("[cron/send-reminders] Send failed", {
        appointmentId: appointment.id,
        error: sendError,
      });
      const truncated =
        sendError.length > EMAIL_ERROR_MAX_LENGTH
          ? sendError.slice(0, EMAIL_ERROR_MAX_LENGTH)
          : sendError;
      await supabase
        .from("appointments")
        .update({ email_error: truncated })
        .eq("id", appointment.id)
        .eq("owner_id", appointment.owner_id);
      continue;
    }

    sent += 1;
    console.log("[cron/send-reminders] Sent", {
      appointmentId: appointment.id,
      email: to,
    });
    await supabase
      .from("appointments")
      .update({ email_sent_at: new Date().toISOString(), email_error: null })
      .eq("id", appointment.id)
      .eq("owner_id", appointment.owner_id);
  }

  console.log("[cron/send-reminders] Summary", { found, sent, failed });

  return NextResponse.json(
    {
      ok: true,
      window: { startIso, endIso },
      found,
      batchLimit: BATCH_LIMIT,
      sent,
      failed,
    },
    { status: 200 }
  );
}
