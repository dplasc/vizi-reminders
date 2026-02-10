import { fromZonedTime } from "date-fns-tz";

const TZ = "Europe/Zagreb";

/**
 * UI is Europe/Zagreb; DB stores UTC timestamptz.
 * Converts wall-clock date + time in Zagreb to a UTC ISO string for starts_at.
 */
export function zagrebLocalToUtcIso(
  dateYYYYMMDD: string,
  timeHHmm: string
): string {
  const wallTime = `${dateYYYYMMDD} ${timeHHmm}:00`;
  const date = fromZonedTime(wallTime, TZ);
  return date.toISOString();
}
