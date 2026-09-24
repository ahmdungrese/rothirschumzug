"use client";

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OrderEditor } from './OrderEditor';
import { InvoiceEditor } from './InvoiceEditor';
import { MobileInspectionWizard } from './MobileInspectionWizard';
import { OrderErrorBoundary } from './OrderErrorBoundary';

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
      if (typeof window !== 'undefined' && window.location.pathname.includes('/edit-invoice/')) {
        setIsInvoice(true);
        return;
      }
      if (searchParams?.get('type') === 'invoice') {
        setIsInvoice(true);
        return;
      }
      if (orderId && orderId !== 'new') {
        try {
          // First check invoices collection
          const invSnap = await getDoc(doc(db, 'invoices', orderId));
          if (invSnap.exists()) {
            setIsInvoice(true);
            return;
          }
          // Fallback to orders collection (for legacy free invoices or storno docs)
          const snap = await getDoc(doc(db, 'orders', orderId));
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

  const isEditInvoiceRoute = typeof window !== 'undefined' && window.location.pathname.includes('/edit-invoice/');
  const rawOrderId = orderId || searchParams?.get('orderId') || undefined;
  const actualOrderId = (!rawOrderId || rawOrderId === 'new' || rawOrderId === 'undefined') ? undefined : rawOrderId;
  const sourceOrderId = searchParams?.get('sourceOrder') || (isEditInvoiceRoute ? actualOrderId : undefined);

  let content = null;
  if (isInvoice) {
    content = <InvoiceEditor orderId={isEditInvoiceRoute ? undefined : actualOrderId} sourceOrderId={sourceOrderId} />;
  } else if (isMobile) {
    content = <MobileInspectionWizard orderId={actualOrderId} />;
  } else {
    content = <OrderEditor orderId={actualOrderId} />;
  }

  return (
    <OrderErrorBoundary fallbackTitle={isInvoice ? "Hinweis zum Rechnungs-Editor" : "Hinweis zum Angebots-Editor"}>
      {content}
    </OrderErrorBoundary>
  );
}

