import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vizi Reminders",
  description: "Reminder module for VIZI.hr",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
