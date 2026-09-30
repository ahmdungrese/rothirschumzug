"use client";

import { ResponsiveOrderWrapper } from "@/components/orders/ResponsiveOrderWrapper";
import { useParams } from "next/navigation";
import { SmartBackButton } from "@/components/ui/SmartBackButton";

export default function EditInvoicePage() {
  const params = useParams();
  const customerId = (params?.id as string) || "";
  const orderId = (params?.orderId as string) || "";
  const fallback = customerId && customerId !== "undefined" ? `/dashboard/customers/${customerId}` : "/dashboard/customers";

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <SmartBackButton 
              fallbackHref={fallback} 
              fallbackLabel="Zurück" 
            />
          </div>
        </div>
      </div>
      <ResponsiveOrderWrapper orderId={orderId} />
    </div>
  );
}
