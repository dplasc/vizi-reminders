export type Appointment = {
  id: string;
  startAt: string; // ISO string
  clientName: string;
  clientEmail?: string | null;
  status: "booked" | "cancelled";
  reminderPlanned: boolean; // derived for UI (true when booked and has email)
  email_sent_at?: string | null;
  email_sent_2h_at?: string | null;
  email_error?: string | null;
};

function toISODate(d: Date, hours: number, minutes: number): string {
  const copy = new Date(d);
  copy.setHours(hours, minutes, 0, 0);
  return copy.toISOString();
}

function buildMockAppointments(refDate: Date): Appointment[] {
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d2 = new Date(today);
  d2.setDate(d2.getDate() + 2);
  const d3 = new Date(today);
  d3.setDate(d3.getDate() + 3);
  const d4 = new Date(today);
  d4.setDate(d4.getDate() + 4);
  const d5 = new Date(today);
  d5.setDate(d5.getDate() + 5);

  const mk = (
    id: string,
    startAt: string,
    clientName: string,
    clientEmail: string | null,
    status: "booked" | "cancelled"
  ): Appointment => ({
    id,
    startAt,
    clientName,
    clientEmail: clientEmail ?? null,
    status,
    reminderPlanned: status === "booked" && !!clientEmail,
  });

  return [
    mk("1", toISODate(today, 9, 0), "Ana Horvat", "ana.horvat@email.hr", "booked"),
    mk("2", toISODate(today, 14, 30), "Marko Kovač", null, "booked"),
    mk("3", toISODate(tomorrow, 10, 0), "Petra Novak", "petra.novak@gmail.com", "booked"),
    mk("4", toISODate(tomorrow, 16, 0), "Ivan Babić", null, "booked"),
    mk("5", toISODate(d2, 11, 0), "Marija Jurić", "marija.juric@email.hr", "booked"),
    mk("6", toISODate(d3, 9, 30), "Tomislav Petrić", null, "cancelled"),
    mk("7", toISODate(d4, 13, 0), "Ljiljana Pavić", "ljiljana.pavic@email.hr", "booked"),
    mk("8", toISODate(d5, 15, 30), "Stjepan Matić", "stjepan.matic@gmail.com", "booked"),
  ];
}

export const mockAppointments: Appointment[] = buildMockAppointments(new Date());
