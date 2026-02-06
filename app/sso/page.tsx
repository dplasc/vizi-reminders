import Link from "next/link";

export default function SSOEntryPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">SSO Entry</h1>
        <p className="text-gray-600 leading-relaxed">
          This page will validate a one-time token coming from VIZI.hr and
          establish a session for the reminders module.
        </p>
        <p className="text-sm text-gray-500 italic">
          MVP: placeholder only (no token validation yet).
        </p>
        <div>
          <Link
            href="https://www.vizi.hr/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Back to VIZI dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
