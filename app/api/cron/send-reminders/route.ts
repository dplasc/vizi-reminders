import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const CRON_SECRET = process.env.CRON_SECRET;

const TIMEZONE = "Europe/Zagreb";

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

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, starts_at, email")
    .gte("starts_at", startIso)
    .lte("starts_at", endIso)
    .not("email", "is", null)
    .is("email_sent_at", null)
    .neq("status", "canceled");

  if (error) {
    console.error("[cron/send-reminders] Query failed:", error.message);
    return NextResponse.json(
      { error: "query_failed", message: error.message },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as Array<{ id: string; starts_at: string; email: string | null }>;
  const withEmail = rows.filter((r) => r.email != null && r.email.trim() !== "");
  const count = withEmail.length;
  const sample = withEmail.slice(0, 10).map((r) => ({
    id: r.id,
    starts_at: r.starts_at,
    email: r.email ?? "",
  }));

  console.log("[cron/send-reminders] Cron executed successfully", {
    window: { startIso, endIso },
    count,
  });

  return NextResponse.json(
    {
      ok: true,
      window: { startIso, endIso },
      count,
      sample,
    },
    { status: 200 }
  );
}
