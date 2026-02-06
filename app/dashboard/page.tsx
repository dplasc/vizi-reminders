import Link from "next/link";
import { mockAppointments } from "@/lib/mockAppointments";

function getLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DashboardPage() {
  const now = new Date();
  const todayKey = getLocalDateKey(now.toISOString());
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = getLocalDateKey(tomorrowDate.toISOString());

  const countToday = mockAppointments.filter(
    (a) => a.status === "booked" && getLocalDateKey(a.startAt) === todayKey
  ).length;
  const countTomorrow = mockAppointments.filter(
    (a) => a.status === "booked" && getLocalDateKey(a.startAt) === tomorrowKey
  ).length;

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <header>
          <h1 className="text-2xl font-semibold text-gray-900">
            Nadzorna ploča
          </h1>
          <p className="mt-1 text-gray-600 text-sm">
            Upišite termine i VIZI će poslati podsjetnik e-mailom dan prije
            termina.
          </p>
        </header>

        {/* Primary action */}
        <div>
          <Link
            href="/dashboard/termini/novi"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            + Novi termin
          </Link>
        </div>

        {/* Stats row */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Danas</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {countToday}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Sutra</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {countTomorrow}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Podsjetnici se šalju u 18:00
            </p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <p className="text-sm font-medium text-gray-500">Poslano danas</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">0</p>
            <p className="mt-1 text-xs text-gray-500">Demo</p>
          </div>
        </section>

        {/* Empty state */}
        <section className="bg-white rounded-lg border border-gray-200 p-8 text-center shadow-sm">
          <h2 className="text-lg font-medium text-gray-900">
            Još nemate termina
          </h2>
          <p className="mt-2 text-sm text-gray-600 max-w-sm mx-auto">
            Dodajte prvi termin kako bi sustav mogao slati podsjetnike.
          </p>
          <p className="mt-4">
            <Link
              href="/sso"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 underline focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded"
            >
              SSO ulaz
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
