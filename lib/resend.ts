import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const REMINDERS_FROM_EMAIL = process.env.REMINDERS_FROM_EMAIL;

/**
 * Server-only. Returns Resend client. Throws if RESEND_API_KEY is missing.
 */
export function getResendClient(): Resend {
  if (!RESEND_API_KEY?.trim()) {
    throw new Error("[resend] Missing RESEND_API_KEY");
  }
  return new Resend(RESEND_API_KEY);
}

/**
 * Server-only. Returns the sender email for reminder emails. Throws if REMINDERS_FROM_EMAIL is missing.
 */
export function getRemindersFromEmail(): string {
  if (!REMINDERS_FROM_EMAIL?.trim()) {
    throw new Error("[resend] Missing REMINDERS_FROM_EMAIL");
  }
  return REMINDERS_FROM_EMAIL.trim();
}
