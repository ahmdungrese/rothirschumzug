"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCol } from '@/lib/demoMode';
import { OrderEditor } from './OrderEditor';
import { InvoiceEditor } from './InvoiceEditor';
import { MobileInspectionWizard } from './MobileInspectionWizard';

export function ResponsiveOrderWrapper({ orderId }: { orderId?: string }) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [isInvoice, setIsInvoice] = useState<boolean | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const checkInvoiceType = async () => {
      if (searchParams?.get('type') === 'invoice') {
        setIsInvoice(true);
        return;
      }
      if (orderId && orderId !== 'new') {
        try {
          const snap = await getDoc(doc(db, getCol('orders'), orderId));
          if (snap.exists() && snap.data().type === 'invoice') {
            setIsInvoice(true);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
      setIsInvoice(false);
    };
    checkInvoiceType();
  }, [orderId, searchParams]);

  if (isMobile === null || isInvoice === null) return null;

  const actualOrderId = orderId === 'new' ? undefined : orderId;
  const sourceOrderId = searchParams?.get('sourceOrder') || undefined;

  if (isInvoice) {
    return <InvoiceEditor orderId={actualOrderId} sourceOrderId={sourceOrderId} />;
  }

  if (isMobile) {
    return <MobileInspectionWizard orderId={actualOrderId} />;
  }

  return <OrderEditor orderId={actualOrderId} />;
}

