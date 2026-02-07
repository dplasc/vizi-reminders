import { NextRequest, NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET;

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

  console.log("[cron/send-reminders] Cron executed successfully");
  return NextResponse.json({ ok: true }, { status: 200 });
}
