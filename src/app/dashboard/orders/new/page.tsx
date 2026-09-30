"use client";

import { ResponsiveOrderWrapper } from "@/components/orders/ResponsiveOrderWrapper";
import { SmartBackButton } from "@/components/ui/SmartBackButton";

export default function NewOrderDirectPage() {
  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <SmartBackButton 
              fallbackHref="/dashboard" 
              fallbackLabel="Zurück" 
            />
          </div>
        </div>
      </div>
      <ResponsiveOrderWrapper />
    </div>
  );
}
