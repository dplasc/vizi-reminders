import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runSendReminders, getTomorrowWindowInZagreb } from "../send-reminders/route";

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { startIso, endIso } = getTomorrowWindowInZagreb();

  const result = await runSendReminders(supabase, startIso, endIso);

  return NextResponse.json({
    ok: true,
    now: new Date().toISOString(),
    ...result,
  });
}
