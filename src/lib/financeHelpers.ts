export interface FinancialTotals {
  net: number;
  tax: number;
  gross: number;
}

/**
 * Calculates the exact totals (net, tax, gross) for any order or invoice.
 * Centralizes the fallback logic: totals -> calcInput -> services/flatRate.
 */
export function calculateOrderTotals(order: any): FinancialTotals {
  if (!order) return { net: 0, tax: 0, gross: 0 };

  // 1. If totals are explicitly saved and valid (primarily for newer orders)
  if (order.totals && order.totals.gross > 0) {
    return {
      net: order.totals.net || 0,
      tax: order.totals.tax || 0,
      gross: order.totals.gross || 0
    };
  }

  // 2. If calcInput was used (legacy fallback)
  if (order.calcInput && order.calcInput.gross > 0) {
    return {
      net: order.calcInput.net || 0,
      tax: order.calcInput.tax || 0,
      gross: order.calcInput.gross || 0
    };
  }

  // 3. Manual calculation based on FlatRate vs Services
  let net = 0;
  if (order.isFlatRate) {
    const separateItemsNet = (order.services && Array.isArray(order.services))
      ? order.services.reduce((acc: number, curr: any) => {
          if (curr.showPriceInFlatRate && !curr.isIncluded) {
            return acc + ((curr.quantity || 0) * (curr.unitPrice || 0));
          }
          return acc;
        }, 0)
      : 0;
    net = (order.flatRateNet || 0) + separateItemsNet;
  } else if (order.services && Array.isArray(order.services)) {
    net = order.services.reduce((acc: number, curr: any) => {
      if (curr.isIncluded) return acc;
      return acc + ((curr.quantity || 0) * (curr.unitPrice || 0));
    }, 0);
  }

  const tax = net * 0.19;
  const gross = net + tax;

  return {
    net: Math.round(net * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    gross: Math.round(gross * 100) / 100
  };
}

/**
 * Summarizes all payments made on an order/invoice.
 */
export function calculateTotalPaid(order: any): number {
  if (!order || !order.payments || !Array.isArray(order.payments)) return 0;
  return order.payments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
}

export function isInvoiceCancelled(inv: any): boolean {
  if (!inv) return false;
  return Boolean(
    inv.isStorno ||
    inv.isCanceled ||
    inv.invoiceCancelled ||
    inv.status === 'invoice_cancelled' ||
    inv.status === 'canceled'
  );
}

/**
 * Finds the latest active (non-cancelled, non-storno) invoice linked to an order.
 */
export function findActiveLinkedInvoice(order: any, invoices: any[] = []): any | null {
  if (!order || !Array.isArray(invoices) || invoices.length === 0) return null;
  const candidates = invoices.filter((inv: any) => {
    if (!inv || isInvoiceCancelled(inv)) return false;
    const matchesOrderId = Boolean(
      order.id && (inv.sourceOrderId === order.id || inv.orderId === order.id || inv.id === order.id)
    );
    const activeNum = order.activeInvoiceNumber || (!order.invoiceCancelled ? order.invoiceNumber : null);
    const matchesInvNum = Boolean(activeNum && inv.invoiceNumber === activeNum);
    const matchesCorrectionFor = Boolean(
      inv.isKorrektur &&
      inv.correctionFor &&
      (inv.correctionFor === order.invoiceNumber ||
        inv.correctionFor === order.lastCancelledInvoiceNumber ||
        inv.correctionFor === order.cancelledInvoiceNumber ||
        (Array.isArray(order.invoiceHistory) &&
          order.invoiceHistory.some(
            (h: any) => h?.invoiceNumber === inv.correctionFor || h?.oldInvoiceNumber === inv.correctionFor
          )))
    );
    return matchesOrderId || matchesInvNum || matchesCorrectionFor;
  });
  if (candidates.length === 0) return null;
  candidates.sort((a: any, b: any) => {
    const aHasNum = a.invoiceNumber ? 1 : 0;
    const bHasNum = b.invoiceNumber ? 1 : 0;
    if (bHasNum !== aHasNum) return bHasNum - aHasNum;
    const timeA = a.createdAt?.toMillis?.() || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = b.createdAt?.toMillis?.() || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return timeB - timeA;
  });
  return candidates[0];
}

/**
 * Returns the active (non-cancelled) invoice number for an order, or null if none / cancelled.
 */
export function getActiveInvoiceNumber(order: any, invoicesOrLinked?: any[] | any): string | null {
  if (!order) return null;

  const activeLinked = Array.isArray(invoicesOrLinked)
    ? findActiveLinkedInvoice(order, invoicesOrLinked)
    : (invoicesOrLinked && !isInvoiceCancelled(invoicesOrLinked) ? invoicesOrLinked : null);

  if (activeLinked?.invoiceNumber) {
    return activeLinked.invoiceNumber;
  }

  if (
    order.activeInvoiceNumber &&
    !order.invoiceCancelled &&
    order.status !== 'invoice_cancelled' &&
    order.status !== 'canceled'
  ) {
    return order.activeInvoiceNumber;
  }

  if (order.invoiceCancelled || order.status === 'invoice_cancelled' || order.status === 'canceled') {
    return null;
  }

  const candidateNum = order.activeInvoiceNumber || order.invoiceNumber || null;
  if (!candidateNum) return null;

  if (
    Array.isArray(order.invoiceHistory) &&
    order.invoiceHistory.some(
      (h: any) =>
        (h?.invoiceNumber === candidateNum || h?.oldInvoiceNumber === candidateNum) &&
        (h?.status === 'invoice_cancelled' || h?.stornoNumber)
    )
  ) {
    return null;
  }

  if (Array.isArray(invoicesOrLinked)) {
    const matchingCancelled = invoicesOrLinked.find(
      (inv: any) => inv?.invoiceNumber === candidateNum && !inv?.isStorno && isInvoiceCancelled(inv)
    );
    if (matchingCancelled) return null;
  }

  return candidateNum;
}

/**
 * Returns the most recent cancelled invoice number for an order (for Korrekturrechnung reference).
 */
export function getLatestCancelledInvoiceNumber(order: any, invoices: any[] = []): string | null {
  if (!order) return null;
  if (order.lastCancelledInvoiceNumber) return order.lastCancelledInvoiceNumber;
  if (order.cancelledInvoiceNumber) return order.cancelledInvoiceNumber;
  if (Array.isArray(order.invoiceHistory) && order.invoiceHistory.length > 0) {
    const last = order.invoiceHistory[order.invoiceHistory.length - 1];
    if (last?.invoiceNumber || last?.oldInvoiceNumber) {
      return last.invoiceNumber || last.oldInvoiceNumber;
    }
  }
  if (Array.isArray(invoices) && invoices.length > 0) {
    const cancelledForOrder = invoices.filter(
      (inv: any) =>
        !inv?.isStorno &&
        isInvoiceCancelled(inv) &&
        ((order.id && (inv.sourceOrderId === order.id || inv.orderId === order.id)) ||
          (order.invoiceNumber && inv.invoiceNumber === order.invoiceNumber))
    );
    if (cancelledForOrder.length > 0) {
      return cancelledForOrder[0].invoiceNumber || null;
    }
  }
  if (order.invoiceCancelled && order.invoiceNumber) {
    return order.invoiceNumber;
  }
  return null;
}

/**
 * Calculates the remaining open amount.
 * Returns 0 if the order/invoice is canceled.
 */
export function calculateOpenAmount(order: any): number {
  if (!order) return 0;
  if (isInvoiceCancelled(order)) return 0;

  const { gross } = calculateOrderTotals(order);
  const paid = calculateTotalPaid(order);

  if (order.status === 'invoice_paid' || (gross > 0 && paid >= gross - 0.01)) return 0;
  
  return Math.max(0, Math.round((gross - paid) * 100) / 100);
}
