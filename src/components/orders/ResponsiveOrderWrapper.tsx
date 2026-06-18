"use client";

import React, { useState, useEffect } from 'react';
import { OrderEditor } from './OrderEditor';
import { MobileInspectionWizard } from './MobileInspectionWizard';

export function ResponsiveOrderWrapper({ orderId }: { orderId?: string }) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // Tablet/Mobile breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Während der Hydration / beim ersten Laden nichts rendern, um Flackern zu vermeiden
  if (isMobile === null) return null;

  if (isMobile) {
    return <MobileInspectionWizard orderId={orderId} />;
  }

  return <OrderEditor orderId={orderId} />;
}
