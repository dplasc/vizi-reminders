import Link from "next/link";

export default function NoviTerminPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <header>
          <h1 className="text-2xl font-semibold text-gray-900">Novi termin</h1>
          <p className="mt-1 text-gray-600 text-sm">
            Unesite podatke o terminu. Podsjetnik će se poslati e-mailom dan
            prije.
          </p>
        </header>

        {/* Form (UI only) */}
        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-5">
          <div>
            <label
              htmlFor="ime-klijenta"
              className="block text-sm font-medium text-gray-700"
            >
              Ime klijenta
            </label>
            <input
              id="ime-klijenta"
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="email-klijenta"
              className="block text-sm font-medium text-gray-700"
            >
              E-mail klijenta
            </label>
            <input
              id="email-klijenta"
              type="email"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:text-sm"
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Ako e-mail nije unesen, podsjetnik se neće poslati.
            </p>
          </div>

          <div>
            <label
              htmlFor="datum-termina"
              className="block text-sm font-medium text-gray-700"
            >
              Datum termina
            </label>
            <input
              id="datum-termina"
              type="date"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="vrijeme-termina"
              className="block text-sm font-medium text-gray-700"
            >
              Vrijeme termina
            </label>
            <input
              id="vrijeme-termina"
              type="time"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg opacity-60 cursor-not-allowed"
              aria-disabled="true"
            >
              Spremi termin
            </button>
            <Link
              href="/dashboard/termini"
              className="inline-flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-900 underline focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded sm:ml-2"
            >
              Natrag na termine
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
