import Link from "next/link";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const SESSION_COOKIE_NAME = "vizi_reminders_session";

function getLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type DashboardRow = {
  id: string;
  owner_id: string;
  starts_at: string;
  status: string;
  email_sent_at?: string | null;
  email_sent_2h_at?: string | null;
};

async function getDashboardMetrics(ownerId: string | null): Promise<{
  countToday: number;
  countTomorrow: number;
  sentToday: number;
  hasAnyAppointments: boolean;
}> {
  if (!ownerId?.trim()) {
    return { countToday: 0, countTomorrow: 0, sentToday: 0, hasAnyAppointments: false };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, owner_id, starts_at, status, email_sent_at, email_sent_2h_at")
    .eq("owner_id", ownerId)
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("[dashboard] Failed to fetch appointments:", error.message);
    return { countToday: 0, countTomorrow: 0, sentToday: 0, hasAnyAppointments: false };
  }

  const rows = (data ?? []) as DashboardRow[];
  const now = new Date();
  const todayKey = getLocalDateKey(now.toISOString());
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowKey = getLocalDateKey(tomorrowDate.toISOString());

  let countToday = 0;
  let countTomorrow = 0;
  let sentToday = 0;

  for (const r of rows) {
    if (r.status === "canceled") continue;
    const startKey = getLocalDateKey(r.starts_at);
    if (startKey === todayKey) countToday += 1;
    if (startKey === tomorrowKey) countTomorrow += 1;
    const sentAt = r.email_sent_at ?? r.email_sent_2h_at;
    if (sentAt && getLocalDateKey(sentAt) === todayKey) sentToday += 1;
  }

  return {
    countToday,
    countTomorrow,
    sentToday,
    hasAnyAppointments: rows.length > 0,
  };
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  const ownerId = session?.value ?? null;

  const { countToday, countTomorrow, sentToday, hasAnyAppointments } =
    await getDashboardMetrics(ownerId);

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
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {sentToday}
            </p>
          </div>
        </section>

        {/* Empty state: only when user has no appointments */}
        {!hasAnyAppointments && (
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
        )}
        {hasAnyAppointments && (
          <section className="bg-white rounded-lg border border-gray-200 p-8 text-center shadow-sm">
            <Link
              href="/dashboard/termini"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 underline focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded"
            >
              Pregled svih termina
            </Link>
          </section>
        )}
      </div>
    </main>
  );
}
