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
    net = order.flatRateNet || 0;
  } else if (order.services && Array.isArray(order.services)) {
    net = order.services.reduce((acc: number, curr: any) => acc + (curr.quantity * (curr.unitPrice || 0)), 0);
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

/**
 * Calculates the remaining open amount.
 * Returns 0 if the order/invoice is canceled.
 */
export function calculateOpenAmount(order: any): number {
  if (!order) return 0;
  if (order.status === 'canceled' || order.status === 'invoice_cancelled') return 0;

  const { gross } = calculateOrderTotals(order);
  const paid = calculateTotalPaid(order);
  
  return Math.max(0, gross - paid);
}
