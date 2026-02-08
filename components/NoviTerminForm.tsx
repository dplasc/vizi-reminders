"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Calendar, Clock } from "lucide-react";

export type TerminFormInitialValues = {
  title: string;
  email: string;
  date: string;
  time: string;
};

type NoviTerminFormProps = {
  /** When set, form submits via PATCH to this id and shows "Spremi promjene" */
  appointmentId?: string;
  /** Pre-fill inputs (edit mode) */
  initialValues?: TerminFormInitialValues;
};

const inputClassName =
  "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 sm:text-sm";

/** Right-aligned icon button for date/time inputs; focuses input and opens native picker when available. */
function PickerTrigger({
  icon: Icon,
  inputRef,
  "aria-label": ariaLabel,
}: {
  icon: React.ComponentType<{ className?: string }>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      className="absolute right-0 top-1 flex h-8 w-10 items-center justify-center rounded-r-md border-l border-gray-300 bg-gray-50 px-2.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:ring-inset"
      onClick={() => {
        inputRef.current?.focus();
        (inputRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.();
      }}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function NoviTerminForm({ appointmentId, initialValues }: NoviTerminFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isEdit = !!appointmentId;
  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = (fd.get("title") as string)?.trim() ?? "";
    const email = (fd.get("email") as string)?.trim() ?? "";
    const date = (fd.get("date") as string)?.trim() ?? "";
    const time = (fd.get("time") as string)?.trim() ?? "";

    setSubmitting(true);
    try {
      const url = isEdit
        ? `/api/appointments/${encodeURIComponent(appointmentId!)}`
        : "/api/appointments";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, email, date, time }),
      });

      if (isEdit) {
        if (res.status === 204) {
          window.location.href = "/dashboard/termini";
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 && typeof data.error === "string") {
          setError(data.error);
          return;
        }
        if (res.status === 401) {
          setError(typeof data.error === "string" ? data.error : "Niste prijavljeni.");
          return;
        }
        if (res.status === 404) {
          setError(
            typeof data.error === "string" ? data.error : "Termin nije pronađen ili nemate dozvolu za uređivanje."
          );
          return;
        }
        setError(
          typeof data.error === "string" ? data.error : "Spremanje promjena nije uspjelo. Pokušajte ponovno."
        );
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }
      if (res.status === 400 && typeof data.error === "string") {
        setError(data.error);
        return;
      }
      if (res.status === 401) {
        setError(typeof data.error === "string" ? data.error : "Niste prijavljeni.");
        return;
      }
      setError(
        typeof data.error === "string" ? data.error : "Spremanje termina nije uspjelo. Pokušajte ponovno."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = isEdit
    ? (submitting ? "Spremanje…" : "Spremi promjene")
    : (submitting ? "Spremanje…" : "Spremi termin");

  return (
    <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm space-y-5">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2" role="alert">
            {error}
          </p>
        )}
        <div>
          <label
            htmlFor="ime-klijenta"
            className="block text-sm font-medium text-gray-700"
          >
            Ime klijenta
          </label>
          <input
            id="ime-klijenta"
            name="title"
            type="text"
            required
            defaultValue={initialValues?.title}
            className={inputClassName}
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
            name="email"
            type="email"
            defaultValue={initialValues?.email}
            className={inputClassName}
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
          <div className="relative">
            <input
              id="datum-termina"
              ref={dateInputRef}
              name="date"
              type="date"
              required
              defaultValue={initialValues?.date}
              className={`${inputClassName} pr-10`}
            />
            <PickerTrigger
              icon={Calendar}
              inputRef={dateInputRef}
              aria-label="Odaberi datum"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="vrijeme-termina"
            className="block text-sm font-medium text-gray-700"
          >
            Vrijeme termina
          </label>
          <div className="relative">
            <input
              id="vrijeme-termina"
              ref={timeInputRef}
              name="time"
              type="time"
              required
              defaultValue={initialValues?.time}
              className={`${inputClassName} pr-10`}
            />
            <PickerTrigger
              icon={Clock}
              inputRef={timeInputRef}
              aria-label="Odaberi vrijeme"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>
          <Link
            href="/dashboard/termini"
            className="inline-flex items-center justify-center text-sm font-medium text-gray-600 hover:text-gray-900 underline focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded sm:ml-2"
          >
            Natrag na termine
          </Link>
        </div>
      </form>
    </section>
  );
}
