import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 md:p-8 pb-0">
        <Button asChild variant="outline" size="sm" className="-ml-2">
          <Link href="https://vizi.hr/app">← Natrag na Vizi</Link>
        </Button>
      </div>
      {children}
    </div>
  );
}
