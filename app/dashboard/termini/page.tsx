import Link from "next/link";
import { mockAppointments, type Appointment } from "@/lib/mockAppointments";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function getLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

function getSectionTitle(dateKey: string, todayKey: string, tomorrowKey: string): string {
  if (dateKey === todayKey) return "Danas";
  if (dateKey === tomorrowKey) return "Sutra";
  const [y, m, day] = dateKey.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  const weekday = d.toLocaleDateString("hr-HR", { weekday: "long" });
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const datePart = d.toLocaleDateString("hr-HR", { day: "numeric", month: "numeric" });
  return `${capitalized}, ${datePart}`;
}

function getBadgeLabel(a: Appointment): string {
  if (a.status === "cancelled") return "Otkazano";
  if (a.reminderPlanned) return "Podsjetnik: spremno";
  return "Nema e-maila";
}

export default function TerminiPage() {
  const now = new Date();
  const todayKey = getLocalDateKey(now.toISOString());
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = getLocalDateKey(tomorrowDate.toISOString());

  const byDate = new Map<string, Appointment[]>();
  for (const a of mockAppointments) {
    const key = getLocalDateKey(a.startAt);
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

        {/* Grouped list */}
        <section className="space-y-6">
          {sortedKeys.map((dateKey) => {
            const appointments = byDate.get(dateKey) ?? [];
            const title = getSectionTitle(dateKey, todayKey, tomorrowKey);
            return (
              <div key={dateKey}>
                <h2 className="text-sm font-medium text-gray-500 mb-2">
                  {title}
                </h2>
                <ul className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-200">
                  {appointments.map((a) => (
                    <li
                      key={a.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:flex-nowrap"
                    >
                      <span className="text-sm font-medium text-gray-900 tabular-nums w-12 shrink-0">
                        {formatTime(a.startAt)}
                      </span>
                      <span className="text-sm text-gray-900 flex-1 min-w-0">
                        {a.clientName}
                      </span>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium shrink-0 ${
                          a.status === "cancelled"
                            ? "bg-gray-100 text-gray-600"
                            : a.reminderPlanned
                              ? "bg-green-50 text-green-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {getBadgeLabel(a)}
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
                        {formatTime(a.startAt)}
                      </span>
                      <span className="text-sm text-gray-900 flex-1 min-w-0">
                        {a.clientName}
                      </span>
                      <Badge
                        variant="secondary"
                        className={
                          a.status === "cancelled"
                            ? "bg-gray-100 text-gray-600 border-0"
                            : a.reminderPlanned
                              ? "bg-green-50 text-green-700 border-0"
                              : "bg-amber-50 text-amber-700 border-0"
                        }
                      >
                        {getBadgeLabel(a)}
                      </Badge>
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
