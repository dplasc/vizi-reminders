import { getResendClient, getRemindersFromEmail } from "@/lib/resend";

const TIMEZONE = "Europe/Zagreb";
const EMAIL_ERROR_MAX_LENGTH = 500;
const BATCH_LIMIT = 200;
const SENDER_FALLBACK = "Vizi Podsjetnici";

/**
 * Returns tomorrow's date window in UTC as ISO strings, based on Europe/Zagreb calendar.
 * Uses Intl for current date parts in Zagreb, adds one day, then builds
 * start = YYYY-MM-DDT00:00:00.000Z and end = YYYY-MM-DDT23:59:59.999Z
 * so that starts_at within this range falls on "tomorrow" in Zagreb.
 */
export function getTomorrowWindowInZagreb(): { startIso: string; endIso: string } {
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
export function get2hWindow(): { startIso: string; endIso: string } {
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

type OwnerDisplay = { senderName: string; fullName: string };

/** Fetch sender name and full name for owner_ids; returns map id -> { senderName, fullName }. */
async function getDisplayNamesByOwnerIds(
  supabase: { from: (table: string) => any },
  ownerIds: string[]
): Promise<Map<string, OwnerDisplay>> {
  const map = new Map<string, OwnerDisplay>();
  const unique = ownerIds.filter((id, idx, arr) => arr.indexOf(id) === idx);
  for (const id of unique) map.set(id, { senderName: SENDER_FALLBACK, fullName: SENDER_FALLBACK });
  if (unique.length === 0) return map;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, username")
      .in("id", unique);
    for (const row of data ?? []) {
      const r = row as { id: string; full_name?: string | null; username?: string | null };
      const u = (r.username ?? "").trim();
      const f = (r.full_name ?? "").trim();
      let senderName = SENDER_FALLBACK;
      if (u && f) senderName = `${u} (${f})`;
      else if (u) senderName = u;
      else if (f) senderName = f;
      const fullName = f || senderName;
      map.set(r.id, { senderName, fullName });
    }
  } catch (e) {
    console.warn("[cron/send-reminders] Profiles query failed, using fallback:", e instanceof Error ? e.message : String(e));
  }
  return map;
}

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

function buildReminderSubject(_appointment: AppointmentRow, senderName: string): string {
  return `${senderName} — Podsjetnik (sutra)`;
}

function buildReminderHtml(appointment: AppointmentRow, fullName: string): string {
  const parts: string[] = [
    "<p><strong>Podsjetnik na vaš termin</strong></p>",
    `<p>Kod: ${escapeHtml(fullName)}</p>`,
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
  parts.push('<p><small>Ovu poruku ste dobili jer je termin unesen u Vizi Podsjetnike.</small></p>');
  return parts.join("\n");
}

function buildReminder2hSubject(senderName: string): string {
  return `${senderName} — Podsjetnik: termin uskoro (2h)`;
}

function buildReminder2hHtml(appointment: AppointmentRow, fullName: string): string {
  const parts: string[] = [
    "<p><strong>Podsjetnik na vaš termin</strong></p>",
    `<p>Kod: ${escapeHtml(fullName)}</p>`,
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
  parts.push('<p><small>Ovu poruku ste dobili jer je termin unesen u Vizi Podsjetnike.</small></p>');
  return parts.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function runSendReminders(
  supabase: {
    from: (table: string) => any;
  },
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

  const displayNamesTomorrow = await getDisplayNamesByOwnerIds(
    supabase,
    withEmail.map((r) => r.owner_id)
  );

  const resend = getResendClient();
  const from = getRemindersFromEmail();

  let sentTomorrow = 0;
  let failed = 0;

  for (const appointment of withEmail) {
    const to = appointment.email!.trim();
    const display = displayNamesTomorrow.get(appointment.owner_id) ?? { senderName: SENDER_FALLBACK, fullName: SENDER_FALLBACK };
    const subject = buildReminderSubject(appointment, display.senderName);
    const html = buildReminderHtml(appointment, display.fullName);
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

  const displayNames2h = await getDisplayNamesByOwnerIds(
    supabase,
    withEmail2h.map((r) => r.owner_id)
  );

  let sent2h = 0;
  let failed2h = 0;

  for (const appointment of withEmail2h) {
    const to = appointment.email!.trim();
    const display = displayNames2h.get(appointment.owner_id) ?? { senderName: SENDER_FALLBACK, fullName: SENDER_FALLBACK };
    const subject = buildReminder2hSubject(display.senderName);
    const html = buildReminder2hHtml(appointment, display.fullName);
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
