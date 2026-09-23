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
    if (diffDays === 0) return { label: 'Heute', color: 'bg-red-500 text-white' };
    if (diffDays === 1) return { label: 'Morgen', color: 'bg-orange-500 text-white' };
    if (diffDays > 1 && diffDays <= 7) return { label: `in ${diffDays} Tg.`, color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' };
    if (diffDays < 0) return { label: `vor ${Math.abs(diffDays)} Tg.`, color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' };
    return null;
  };

  const urgency = getMoveUrgency();

  // Ambient border & status based on column and logistics completion
  let borderLeftColor = 'border-l-blue-500';
  let statusDotColor = 'bg-blue-500';
  let statusText = 'Neu';

  if (columnId === 'neu') {
    borderLeftColor = 'border-l-primary';
    statusDotColor = 'bg-primary';
    statusText = evaluation.leadSource || 'Neu';
  } else if (columnId === 'verhandlung') {
    borderLeftColor = 'border-l-amber-500';
    statusDotColor = 'bg-amber-500';
    const hasViewing = Boolean(order.orderMeta?.viewingDate && order.orderMeta.viewingDate !== 'erledigt_fotos');
    statusText = hasViewing ? 'Besichtigung' : 'In Verhandlung';
  } else if (columnId === 'bestaetigt') {
    if (evaluation.isComplete) {
      borderLeftColor = 'border-l-emerald-500';
      statusDotColor = 'bg-emerald-500';
      statusText = 'Bereit';
    } else {
      borderLeftColor = 'border-l-amber-500';
      statusDotColor = 'bg-amber-500 animate-pulse';
      statusText = 'Aufgaben offen';
    }
  } else if (columnId === 'abgeschlossen') {
    const hasInvoice = Boolean(order.invoiceNumber || (order.status && order.status.startsWith('invoice_')));
    borderLeftColor = 'border-l-slate-400';
    statusDotColor = hasInvoice ? 'bg-emerald-500' : 'bg-amber-500';
    statusText = hasInvoice ? 'Abgerechnet' : 'Rechnung offen';
  }

  return (
    <div 
      onClick={() => onSelect && onSelect(order)}
      className={`bg-white dark:bg-slate-800/95 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 border-l-4 ${borderLeftColor} shadow-xs hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer select-none group flex flex-col justify-between`}
    >
      {/* 1. Header: Customer Name & Order Number */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-bold text-sm text-slate-900 dark:text-white font-headline group-hover:text-primary transition-colors truncate">
          {custName}
        </h4>
        <span className="text-[10px] font-bold text-primary dark:text-red-400 font-headline shrink-0">
          {orderNum}
        </span>
      </div>

      {/* 2. Route: From ➔ To */}
      <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mb-3 truncate">
        <span className="material-symbols-outlined text-xs text-slate-400 shrink-0">near_me</span>
        <span className="truncate">{evaluation.routeDisplay}</span>
      </div>

      {/* 3. Footer: Moving Date & Ambient Status Pill */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs">
        {/* Moving date with optional urgency badge */}
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-xs text-slate-400">calendar_today</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
            {evaluation.movingDateDisplay}
          </span>
          {urgency && (
            <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${urgency.color}`}>
              {urgency.label}
            </span>
          )}
        </div>

        {/* Ambient Status Indicator */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${statusDotColor} shrink-0`} />
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
            {statusText}
          </span>
        </div>
      </div>
    </div>
  );
}
