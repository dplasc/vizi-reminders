import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getResendClient, getRemindersFromEmail } from "@/lib/resend";

const CRON_SECRET = process.env.CRON_SECRET;
const TIMEZONE = "Europe/Zagreb";
const EMAIL_ERROR_MAX_LENGTH = 500;
const BATCH_LIMIT = 200;
const ADVISORY_LOCK_KEY = 912345;

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

/** Window for 2h reminder: appointments starting in (now+1h45m) to (now+2h15m). */
function get2hWindow(): { startIso: string; endIso: string } {
  const now = Date.now();
  const startMs = now + (1 * 60 + 45) * 60 * 1000;
  const endMs = now + (2 * 60 + 15) * 60 * 1000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

type AppointmentRow = {
  id: string;
  owner_id: string;
  starts_at: string;
  email: string | null;
  title?: string | null;
};

function formatStartsAtInZagreb(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("hr-HR", {
    timeZone: TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTimeInZagreb(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("hr-HR", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildReminderSubject(appointment: AppointmentRow): string {
  const timeStr = formatTimeInZagreb(appointment.starts_at);
  return `Podsjetnik za termin sutra u ${timeStr}`;
}

function buildReminderHtml(appointment: AppointmentRow): string {
  const parts: string[] = [
    "<p><strong>Vizi Podsjetnici</strong></p>",
    "<p>Podsjetnik: imate termin sutra.</p>",
    "<hr>",
  ];
  if (appointment.title != null && appointment.title.trim() !== "") {
    parts.push(`<p><strong>Termin:</strong> ${escapeHtml(appointment.title.trim())}</p>`);
  }
  parts.push(
    `<p><strong>Datum i vrijeme:</strong> ${escapeHtml(formatStartsAtInZagreb(appointment.starts_at))}</p>`
  );
  parts.push("<hr>");
  parts.push('<p><small>Ovaj e-mail poslan je automatski. Ne odgovarajte na njega.</small></p>');
  return parts.join("\n");
}

function buildReminder2hSubject(): string {
  return "Podsjetnik: termin uskoro (u 2 sata)";
}

function buildReminder2hHtml(appointment: AppointmentRow): string {
  const parts: string[] = [
    "<p><strong>Vizi Podsjetnici</strong></p>",
    "<p>Podsjetnik: vaš termin počinje za oko 2 sata.</p>",
    "<hr>",
  ];
  if (appointment.title != null && appointment.title.trim() !== "") {
    parts.push(`<p><strong>Termin:</strong> ${escapeHtml(appointment.title.trim())}</p>`);
  }
  parts.push(
    `<p><strong>Datum i vrijeme:</strong> ${escapeHtml(formatStartsAtInZagreb(appointment.starts_at))}</p>`
  );
  parts.push("<hr>");
  parts.push('<p><small>Ovaj e-mail poslan je automatski. Ne odgovarajte na njega.</small></p>');
  return parts.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

  const { data: lockAcquired, error: lockError } = await supabase.rpc("try_advisory_lock", {
    p_key: ADVISORY_LOCK_KEY,
  });
  if (lockError) {
    console.error("[cron/send-reminders] Advisory lock RPC failed:", lockError.message);
    return NextResponse.json(
      { error: "lock_error", message: lockError.message },
      { status: 500 }
    );
  }
  if (lockAcquired !== true) {
    console.log("[cron/send-reminders] Run skipped: lock not acquired");
    return NextResponse.json(
      { ok: true, skipped: true, reason: "lock_not_acquired" },
      { status: 200 }
    );
  }

  try {
    const result = await runSendReminders(supabase, startIso, endIso);
    return NextResponse.json(result.body, { status: result.status });
  } finally {
    const { error: unlockError } = await supabase.rpc("advisory_unlock", {
      p_key: ADVISORY_LOCK_KEY,
    });
    if (unlockError) {
      console.warn("[cron/send-reminders] Advisory unlock failed:", unlockError.message);
    }
  }
}

async function runSendReminders(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  startIso: string,
  endIso: string
) {
  const { data, error } = await supabase
    .from("appointments")
    .select("id, owner_id, starts_at, email, title")
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
    return {
      body: { error: "query_failed", message: error.message },
      status: 500 as const,
    };
  }

  const rows = (data ?? []) as AppointmentRow[];
  const withEmail = rows.filter((r) => r.email != null && r.email.trim() !== "");
  const found = withEmail.length;

  const resend = getResendClient();
  const from = getRemindersFromEmail();

  let sentTomorrow = 0;
  let failed = 0;

  for (const appointment of withEmail) {
    const to = appointment.email!.trim();
    const subject = buildReminderSubject(appointment);
    const html = buildReminderHtml(appointment);
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

    sentTomorrow += 1;
    console.log("[cron/send-reminders] Sent tomorrow", {
      appointmentId: appointment.id,
      email: to,
    });
    await supabase
      .from("appointments")
      .update({ email_sent_at: new Date().toISOString(), email_error: null })
      .eq("id", appointment.id)
      .eq("owner_id", appointment.owner_id);
  }

  const { startIso: start2h, endIso: end2h } = get2hWindow();
  const { data: data2h, error: error2h } = await supabase
    .from("appointments")
    .select("id, owner_id, starts_at, email, title")
    .gte("starts_at", start2h)
    .lte("starts_at", end2h)
    .not("email", "is", null)
    .is("email_sent_2h_at", null)
    .neq("status", "canceled")
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(BATCH_LIMIT);

  if (error2h) {
    console.error("[cron/send-reminders] 2h query failed:", error2h.message);
    return {
      body: {
        ok: true,
        window: { startIso, endIso },
        found,
        batchLimit: BATCH_LIMIT,
        sentTomorrow,
        failed,
        found2h: 0,
        sent2h: 0,
        failed2h: 0,
      },
      status: 200 as const,
    };
  }

  const rows2h = (data2h ?? []) as AppointmentRow[];
  const withEmail2h = rows2h.filter((r) => r.email != null && r.email.trim() !== "");
  const found2h = withEmail2h.length;
  let sent2h = 0;
  let failed2h = 0;

  for (const appointment of withEmail2h) {
    const to = appointment.email!.trim();
    const subject = buildReminder2hSubject();
    const html = buildReminder2hHtml(appointment);
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
      failed2h += 1;
      console.warn("[cron/send-reminders] 2h send failed", {
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

    sent2h += 1;
    console.log("[cron/send-reminders] Sent 2h", {
      appointmentId: appointment.id,
      email: to,
    });
    await supabase
      .from("appointments")
      .update({ email_sent_2h_at: new Date().toISOString(), email_error: null })
      .eq("id", appointment.id)
      .eq("owner_id", appointment.owner_id);
  }

  console.log("[cron/send-reminders] Summary", {
    found,
    sentTomorrow,
    failed,
    found2h,
    sent2h,
    failed2h,
  });

  return {
    body: {
      ok: true,
      window: { startIso, endIso },
      found,
      batchLimit: BATCH_LIMIT,
      sentTomorrow,
      failed,
      found2h,
      sent2h,
      failed2h,
    },
    status: 200 as const,
  };
}
