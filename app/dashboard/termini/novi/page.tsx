import { NoviTerminForm } from "@/components/NoviTerminForm";

export default function NoviTerminPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-gray-900">Novi termin</h1>
          <p className="mt-1 text-gray-600 text-sm">
            Unesite podatke o terminu. Podsjetnik će se poslati e-mailom dan
            prije.
          </p>
        </header>

        <NoviTerminForm />
      </div>
    </main>
  );
}
