"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { OrderEditor } from './OrderEditor';
import { InvoiceEditor } from './InvoiceEditor';
import { MobileInspectionWizard } from './MobileInspectionWizard';
import { OrderErrorBoundary } from './OrderErrorBoundary';

function ResponsiveOrderWrapperInner({ orderId }: { orderId?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  // Synchronously detect if this is an edit-order or edit-invoice route so we don't block rendering
  const isEditOrderRoute = Boolean(pathname?.includes('/edit-order/') || pathname?.includes('/new-order'));
  const isEditInvoiceRoute = Boolean(pathname?.includes('/edit-invoice/') || searchParams?.get('type') === 'invoice');

  const [isInvoice, setIsInvoice] = useState<boolean | null>(() => {
    if (isEditInvoiceRoute) return true;
    if (isEditOrderRoute) return false;
    return null;
  });

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isEditInvoiceRoute) {
      setIsInvoice(true);
      return;
    }
    if (isEditOrderRoute) {
      setIsInvoice(false);
      return;
    }

    const checkInvoiceType = async () => {
      if (orderId && orderId !== 'new' && orderId !== 'undefined') {
        try {
          const invSnap = await getDoc(doc(db, 'invoices', orderId));
          if (invSnap.exists()) {
            setIsInvoice(true);
            return;
          }
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
  }, [orderId, isEditInvoiceRoute, isEditOrderRoute]);

  if (isInvoice === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

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

export function ResponsiveOrderWrapper({ orderId }: { orderId?: string }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      }
    >
      <ResponsiveOrderWrapperInner orderId={orderId} />
    </Suspense>
  );
}


