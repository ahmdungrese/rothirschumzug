"use client";

import { ResponsiveOrderWrapper } from "@/components/orders/ResponsiveOrderWrapper";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function EditOrderPage() {
  const params = useParams();
  const customerId = (params?.id as string) || "";
  const orderId = (params?.orderId as string) || "";

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href={customerId && customerId !== "undefined" ? `/dashboard/customers/${customerId}` : "/dashboard/customers"}
              className="text-text-muted hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium"
            >
              <ArrowLeftIcon className="w-4 h-4" /> Zurück zur Kundenakte
            </Link>
          </div>
        </div>
      </div>
      <ResponsiveOrderWrapper orderId={orderId} />
    </div>
  );
}

