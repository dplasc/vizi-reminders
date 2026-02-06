import { Suspense } from "react";
import { SSOClient } from "./SSOClient";

export default function SSOEntryPage() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <Suspense
        fallback={
          <div className="max-w-lg w-full space-y-6 text-center">
            <h1 className="text-2xl font-semibold text-gray-900">SSO</h1>
            <p className="text-gray-600 leading-relaxed">Prijava u tijeku…</p>
          </div>
        }
      >
        <SSOClient />
      </Suspense>
    </main>
  );
}
