import { OrderEditor } from "@/components/orders/OrderEditor";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string, orderId: string }> }) {
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
          <h1 className="text-2xl font-bold tracking-tight text-white">Angebot bearbeiten</h1>
          <p className="text-text-muted mt-1">Passen Sie hier die Leistungen und Logistik an.</p>
        </div>
      </div>
      <OrderEditor orderId={resolvedParams.orderId} />
    </div>
  );
}
