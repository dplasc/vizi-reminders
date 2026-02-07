import Link from "next/link";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { NoviTerminForm, type TerminFormInitialValues } from "@/components/NoviTerminForm";

const SESSION_COOKIE_NAME = "vizi_reminders_session";

type DbRow = {
  id: string;
  owner_id: string;
  title: string;
  email: string | null;
  starts_at: string;
};

function startsAtToDateAndTime(startsAt: string): { date: string; time: string } {
  const d = new Date(startsAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const date = `${y}-${m}-${day}`;
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const time = `${h}:${min}`;
  return { date, time };
}

export default async function UrediTerminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: appointmentId } = await params;
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME);
  const userId = session?.value;

  if (!userId?.trim()) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <p className="text-gray-600">
            Niste prijavljeni. Termin se može uređivati samo kada ste prijavljeni.
          </p>
          <Link
            href="/dashboard/termini"
            className="inline-flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-900 underline"
          >
            Natrag na termine
          </Link>
        </div>
      </main>
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, owner_id, title, email, starts_at")
    .eq("id", appointmentId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (error || !data) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 md:p-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <p className="text-gray-600">
            Termin nije pronađen ili nemate dozvolu za njegovo uređivanje.
          </p>
          <Link
            href="/dashboard/termini"
            className="inline-flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-900 underline"
          >
            Natrag na termine
          </Link>
        </div>
      </main>
    );
  }

  const row = data as DbRow;
  const { date, time } = startsAtToDateAndTime(row.starts_at);
  const initialValues: TerminFormInitialValues = {
    title: row.title,
    email: row.email ?? "",
    date,
    time,
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900">Uredi termin</h1>
          <p className="mt-1 text-gray-600 text-sm">
            Promijenite podatke termina. Podsjetnik će se poslati e-mailom dan prije.
          </p>
        </header>

        <NoviTerminForm appointmentId={row.id} initialValues={initialValues} />
      </div>
    </main>
  );
}
