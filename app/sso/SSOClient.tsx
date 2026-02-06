"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function SSOClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!token?.trim()) return;

    setStatus("loading");
    fetch("/api/sso/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          setStatus("success");
          router.replace("/dashboard");
          return;
        }
        setStatus("error");
        setErrorMessage(
          typeof data?.error === "string" ? data.error : "Prijava nije uspjela."
        );
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Prijava nije uspjela.");
      });
  }, [token, router]);

  if (!token?.trim()) {
    return (
      <div className="max-w-lg w-full space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">SSO</h1>
        <p className="text-gray-600 leading-relaxed">Nedostaje SSO token.</p>
        <div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Povratak
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="max-w-lg w-full space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">SSO</h1>
        <p className="text-gray-600 leading-relaxed">{errorMessage}</p>
        <div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Povratak
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg w-full space-y-6 text-center">
      <h1 className="text-2xl font-semibold text-gray-900">SSO</h1>
      <p className="text-gray-600 leading-relaxed">Prijava u tijeku…</p>
    </div>
  );
}
