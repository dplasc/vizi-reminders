import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTomorrowWindowInZagreb, runSendReminders } from "../_lib/remindersRunner";

const CRON_SECRET = process.env.CRON_SECRET;
const BATCH_LIMIT = 200;
const ADVISORY_LOCK_KEY = 912345;

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
    return NextResponse.json({ error: "lock_error", message: lockError.message }, { status: 500 });
  }
  if (lockAcquired !== true) {
    console.log("[cron/send-reminders] Run skipped: lock not acquired");
    return NextResponse.json({ ok: true, skipped: true, reason: "lock_not_acquired" }, { status: 200 });
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
