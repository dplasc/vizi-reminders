import { formatInTimeZone } from "date-fns-tz";

const ZAGREB = "Europe/Zagreb";

/**
 * DB stores UTC; email displays Europe/Zagreb to match UI.
 * Formats a timestamptz (string or Date) in Zagreb local time.
 */
function toDate(value: string | Date): Date {
  return typeof value === "string" ? new Date(value) : value;
}

/** Full date and time: "dd.MM.yyyy u HH:mm" (Croatian style). */
export function formatDateTimeZagreb(value: string | Date): string {
  return formatInTimeZone(toDate(value), ZAGREB, "dd.MM.yyyy 'u' HH:mm");
}

/** Time only: "HH:mm". */
export function formatTimeOnlyZagreb(value: string | Date): string {
  return formatInTimeZone(toDate(value), ZAGREB, "HH:mm");
}

/** Date only: "dd.MM.yyyy." (for email body when date and time are shown separately). */
export function formatDateOnlyZagreb(value: string | Date): string {
  return formatInTimeZone(toDate(value), ZAGREB, "dd.MM.yyyy.");
}
