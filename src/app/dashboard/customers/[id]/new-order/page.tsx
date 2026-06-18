import { ResponsiveOrderWrapper } from "@/components/orders/ResponsiveOrderWrapper";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default async function NewOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href={`/dashboard/customers/${resolvedParams.id}`} className="text-text-muted hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium">
              <ArrowLeftIcon className="w-4 h-4" /> Zurück zur Kundenakte
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">Angebot / Auftrag erstellen</h1>
          <p className="text-text-muted mt-1">Legen Sie hier die Logistik-Parameter und Leistungen fest.</p>
        </div>
      </div>
      <ResponsiveOrderWrapper />
    </div>
  );
}
