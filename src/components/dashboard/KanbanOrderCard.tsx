"use client";

import React from 'react';
import { evaluateOrderLogistics } from '@/lib/orderValidation';

interface KanbanOrderCardProps {
  order: any;
  customer?: any;
  columnId: 'neu' | 'verhandlung' | 'bestaetigt' | 'abgeschlossen';
  onSelect?: (order: any) => void;
  onRefresh?: () => void;
}

export function KanbanOrderCard({ order, customer, columnId, onSelect }: KanbanOrderCardProps) {
  const evaluation = evaluateOrderLogistics(order, customer);
  const custName = customer 
    ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.company || 'Kunde ohne Name'
    : order.customerName || order.clientName || 'Kunde ohne Name';

  const orderNum = order.orderNumber || order.orderIdShort || (order.id ? `#${order.id.slice(-5).toUpperCase()}` : '#RH-AUFTRAG');

  // Calculate days until moving date for urgency badge
  const getMoveUrgency = () => {
    const rawDate = order.orderMeta?.movingDateFrom || order.movingDate;
    if (!rawDate) return null;
    const moveDate = new Date(rawDate);
    if (isNaN(moveDate.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    moveDate.setHours(0, 0, 0, 0);

    const diffDays = Math.round((moveDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return { label: 'Heute', color: 'bg-[#6E8F64] text-white' };
    if (diffDays === 1) return { label: 'Morgen', color: 'bg-orange-500 text-white' };
    if (diffDays > 1 && diffDays <= 7) return { label: `in ${diffDays} Tg.`, color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
    if (diffDays < 0) return { label: `vor ${Math.abs(diffDays)} Tg.`, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
    return null;
  };

  const urgency = getMoveUrgency();

  // Check data completeness for Phase 1 & Phase 2
  const hasPhone = Boolean(customer?.phone || order.customerPhone || order.billingAddress?.phone);
  const hasFromAddr = Boolean(order.logistics?.a_street || order.logistics?.a_city || order.logistics?.from?.street || order.logistics?.from?.city);
  const hasToAddr = Boolean(order.logistics?.b_street || order.logistics?.b_city || order.logistics?.to?.street || order.logistics?.to?.city);
  const hasMoveDate = Boolean(order.orderMeta?.movingDateFrom || order.movingDate || order.logistics?.movingDate);
  const hasPricedServices = Boolean(
    (order.isFlatRate && Number(order.flatRateNet) > 0) ||
    (Array.isArray(order.services) && order.services.length > 0 && order.services.some((s: any) => (Number(s.quantity) || 0) * (Number(s.unitPrice) || 0) > 0)) ||
    Number(order.totals?.gross) > 0
  );

  // Ambient border & status based on column and phase completion
  let borderLeftColor = 'border-l-amber-500';
  let statusDotColor = 'bg-amber-500';
  let statusText = 'Neu';

  if (columnId === 'neu') {
    const isPhase1Complete = hasPhone && hasFromAddr && hasToAddr && hasMoveDate;
    if (isPhase1Complete) {
      borderLeftColor = 'border-l-[#6E8F64]';
      statusDotColor = 'bg-[#6E8F64]';
      statusText = evaluation.leadSource || 'Daten vollständig';
    } else {
      borderLeftColor = 'border-l-amber-500';
      statusDotColor = 'bg-amber-500';
      statusText = 'Angaben fehlen';
    }
  } else if (columnId === 'verhandlung') {
    const isPhase2Ready = hasFromAddr && hasToAddr && hasMoveDate && hasPricedServices;
    const hasViewing = Boolean(order.orderMeta?.viewingDate && order.orderMeta.viewingDate !== 'erledigt_fotos');
    if (isPhase2Ready) {
      borderLeftColor = 'border-l-[#6E8F64]';
      statusDotColor = 'bg-[#6E8F64]';
      statusText = hasViewing ? 'Besichtigung geplant' : 'Angebot bereit';
    } else {
      borderLeftColor = 'border-l-amber-500';
      statusDotColor = 'bg-amber-500';
      statusText = !hasPricedServices ? '0 € / Offen' : 'Angaben fehlen';
    }
  } else if (columnId === 'bestaetigt') {
    if (evaluation.isComplete) {
      borderLeftColor = 'border-l-[#6E8F64]';
      statusDotColor = 'bg-[#6E8F64]';
      statusText = 'Bereit';
    } else {
      borderLeftColor = 'border-l-amber-500';
      statusDotColor = 'bg-amber-500 animate-pulse';
      statusText = 'Aufgaben offen';
    }
  } else if (columnId === 'abgeschlossen') {
    const hasInvoice = Boolean(order.invoiceNumber || (order.status && order.status.startsWith('invoice_')));
    if (hasInvoice) {
      borderLeftColor = 'border-l-[#6E8F64]';
      statusDotColor = 'bg-[#6E8F64]';
      statusText = order.status === 'invoice_paid' ? 'Bezahlt ✓' : 'Abgerechnet';
    } else {
      borderLeftColor = 'border-l-amber-500';
      statusDotColor = 'bg-amber-500';
      statusText = 'Rechnung offen';
    }
  }

  return (
    <div 
      onClick={() => onSelect && onSelect(order)}
      className={`bg-white dark:bg-slate-800/95 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 border-l-4 ${borderLeftColor} shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer select-none group flex flex-col justify-between w-full max-w-full overflow-hidden`}
    >
      {/* 1. Header: Customer Name & Order Number */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-bold text-sm text-slate-900 dark:text-white font-headline group-hover:text-[#6E8F64] transition-colors line-clamp-1 xl:line-clamp-2 leading-snug" title={custName}>
          {custName}
        </h4>
        <span className="text-[10px] font-bold text-[#6E8F64] dark:text-[#A8C69F] font-headline shrink-0 ml-1">
          {orderNum}
        </span>
      </div>

      {/* 2. Route: From ➔ To */}
      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mb-3 truncate">
        <span className="material-symbols-outlined text-xs text-slate-400 shrink-0">near_me</span>
        <span className="truncate">{evaluation.routeDisplay}</span>
      </div>

      {/* 3. Footer: Moving Date & Ambient Status Pill */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
        {/* Moving date with optional urgency badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="material-symbols-outlined text-[13px] text-slate-400 shrink-0">calendar_today</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] whitespace-nowrap">
            {evaluation.movingDateDisplay}
          </span>
          {urgency && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap shrink-0 ${urgency.color}`}>
              {urgency.label}
            </span>
          )}
        </div>

        {/* Ambient Status Indicator */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${statusDotColor} shrink-0`} />
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight whitespace-nowrap">
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
}
