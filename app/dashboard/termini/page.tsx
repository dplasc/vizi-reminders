import { cookies } from "next/headers";
import Link from "next/link";
import { type Appointment } from "@/lib/mockAppointments";
import { zagrebDateKey } from "@/lib/formatZagreb";
import { ZagrebTime } from "@/components/ZagrebTime";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteAppointmentButton } from "@/components/DeleteAppointmentButton";

const SESSION_COOKIE_NAME = "vizi_reminders_session";

type DbAppointmentRow = {
  id: string;
  owner_id: string;
  title: string;
  email?: string | null;
  starts_at: string;
  status: "ready" | "no_email" | "canceled";
  email_sent_at?: string | null;
  email_sent_2h_at?: string | null;
  email_error?: string | null;
};

function mapDbRowToAppointment(row: DbAppointmentRow): Appointment {
  const status = row.status === "canceled" ? "cancelled" : "booked";
  const reminderPlanned = row.status === "ready";
  return {
    id: row.id,
    startAt: row.starts_at,
    clientName: row.title,
    clientEmail: row.email ?? null,
    status,
    reminderPlanned,
    email_sent_at: row.email_sent_at ?? null,
    email_sent_2h_at: row.email_sent_2h_at ?? null,
    email_error: row.email_error ?? null,
  };
}

/**
 * Fetches appointments for the given owner only.
 * Uses service-role client; owner_id filter is mandatory for tenant isolation.
 */
async function fetchAppointmentsForUser(ownerId: string): Promise<Appointment[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, owner_id, title, email, starts_at, status, email_sent_at, email_sent_2h_at, email_error")
    .eq("owner_id", ownerId)
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("[termini] Supabase query failed:", error.message);
    throw error;
  }

  return (data ?? []).map((row) => mapDbRowToAppointment(row as DbAppointmentRow));
}

function getSectionTitle(
  dateKey: string,
  todayKey: string,
  tomorrowKey: string
): string {
  if (dateKey === todayKey) return "Danas";
  if (dateKey === tomorrowKey) return "Sutra";
  const [y, m, day] = dateKey.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  const weekday = d.toLocaleDateString("hr-HR", { weekday: "long" });
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const datePart = d.toLocaleDateString("hr-HR", {
    day: "numeric",
    month: "numeric",
  });
  return `${capitalized}, ${datePart}`;
}

type ReminderStatus = "sent" | "error" | "pending";

function getReminderStatus(a: Appointment): ReminderStatus {
  if (a.email_sent_at != null) return "sent";
  if (a.email_error != null) return "error";
  return "pending";
}

const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  sent: "Poslan",
  error: "Greška",
  pending: "Na čekanju",
};

type Reminder2hStatus = "sent" | "error" | "pending";

function getReminder2hStatus(a: Appointment): Reminder2hStatus {
  if (a.email_sent_2h_at != null) return "sent";
  if (a.email_error != null) return "error";
  return "pending";
}

const REMINDER_2H_STATUS_LABELS: Record<Reminder2hStatus, string> = {
  sent: "2h Poslan",
  error: "2h Greška",
  pending: "2h Na čekanju",
};

export default async function TerminiPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  const ownerId = session?.value?.trim() ?? null;

  let appointments: Appointment[];

  if (!ownerId) {
    appointments = [];
  } else {
    try {
      appointments = await fetchAppointmentsForUser(ownerId);
    } catch (err) {
      console.error("[termini] Failed to fetch appointments:", err);
      appointments = [];
    }
  }

  const now = new Date();
  const todayKey = zagrebDateKey(now.toISOString());
  const tomorrowKey = zagrebDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());

  const byDate = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const key = zagrebDateKey(a.startAt);
    const list = byDate.get(key) ?? [];
    list.push(a);
    byDate.set(key, list);
  }
  Array.from(byDate.values()).forEach((list) => {
    list.sort(
      (a: Appointment, b: Appointment) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
  });

  const sortedKeys = Array.from(byDate.keys()).sort((a, b) => {
    if (a === todayKey) return -1;
    if (b === todayKey) return 1;
    if (a === tomorrowKey) return -1;
    if (b === tomorrowKey) return 1;
    return a.localeCompare(b);
  });

  const todayAppointments = byDate.get(todayKey) ?? [];

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header + primary action */}
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Termini</h1>
            <p className="mt-1 text-gray-600 text-sm">
              Pregled svih nadolazećih termina.
            </p>
          </div>
          <Link
            href="/dashboard/termini/novi"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 shrink-0"
          >
            + Novi termin
          </Link>
        </header>

        {/* Reminders header block */}
        <Card className="border-gray-200 bg-white">
          <CardContent className="flex flex-col gap-1.5 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">
                🔔 Automatski email podsjetnici su aktivni (1 dan + 2 sata prije termina)
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                Ne moraš ručno podsjećati klijente.
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 bg-gray-100 text-gray-700 border-gray-200">
              PRO 500
            </Badge>
          </CardContent>
        </Card>

        {/* Grouped list */}
        <section className="space-y-6">
          {sortedKeys.map((dateKey) => {
            const listAppointments = byDate.get(dateKey) ?? [];
            const title = getSectionTitle(dateKey, todayKey, tomorrowKey);
            return (
              <div key={dateKey}>
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  {title}
                </h2>
                <ul className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-200">
                  {listAppointments.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:flex-nowrap"
                    >
                      <span className="text-sm font-medium text-gray-900 tabular-nums w-12 shrink-0">
                        <ZagrebTime iso={a.startAt} />
                      </span>
                      <span className="text-sm text-gray-900 flex-1 min-w-0">
                        {a.clientName}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            getReminderStatus(a) === "error"
                              ? "destructive"
                              : "secondary"
                          }
                          className={
                            getReminderStatus(a) === "sent"
                              ? "bg-green-50 text-green-700 border-0 hover:bg-green-50 hover:text-green-700"
                              : undefined
                          }
                        >
                          {REMINDER_STATUS_LABELS[getReminderStatus(a)]}
                        </Badge>
                        <Badge
                          variant={
                            getReminder2hStatus(a) === "error"
                              ? "destructive"
                              : "secondary"
                          }
                          className={
                            getReminder2hStatus(a) === "sent"
                              ? "bg-green-50 text-green-700 border-0 hover:bg-green-50 hover:text-green-700 text-xs"
                              : "text-xs"
                          }
                        >
                          {REMINDER_2H_STATUS_LABELS[getReminder2hStatus(a)]}
                        </Badge>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/dashboard/termini/${a.id}/uredi`}
                          className="text-sm font-medium text-gray-600 hover:text-gray-900 underline"
                        >
                          Uredi
                        </Link>
                        <DeleteAppointmentButton appointmentId={a.id} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        {/* Danas u rasporedu */}
        <section aria-labelledby="danas-u-rasporedu-heading">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle id="danas-u-rasporedu-heading" className="text-base">
                Danas u rasporedu
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {todayAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nema termina za danas.
                </p>
              ) : (
                <ul className="divide-y divide-gray-200 rounded-md border border-gray-200 overflow-hidden">
                  {todayAppointments.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 bg-white sm:flex-nowrap"
                    >
                      <span className="text-sm font-medium text-gray-900 tabular-nums w-12 shrink-0">
                        <ZagrebTime iso={a.startAt} />
                      </span>
                      <span className="text-sm text-gray-900 flex-1 min-w-0">
                        {a.clientName}
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            getReminderStatus(a) === "error"
                              ? "destructive"
                              : "secondary"
                          }
                          className={
                            getReminderStatus(a) === "sent"
                              ? "bg-green-50 text-green-700 border-0 hover:bg-green-50 hover:text-green-700"
                              : undefined
                          }
                        >
                          {REMINDER_STATUS_LABELS[getReminderStatus(a)]}
                        </Badge>
                        <Badge
                          variant={
                            getReminder2hStatus(a) === "error"
                              ? "destructive"
                              : "secondary"
                          }
                          className={
                            getReminder2hStatus(a) === "sent"
                              ? "bg-green-50 text-green-700 border-0 hover:bg-green-50 hover:text-green-700 text-xs"
                              : "text-xs"
                          }
                        >
                          {REMINDER_2H_STATUS_LABELS[getReminder2hStatus(a)]}
                        </Badge>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Link
                          href={`/dashboard/termini/${a.id}/uredi`}
                          className="text-sm font-medium text-gray-600 hover:text-gray-900 underline"
                        >
                          Uredi
                        </Link>
                        <DeleteAppointmentButton appointmentId={a.id} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
