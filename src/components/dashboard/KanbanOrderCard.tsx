"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { evaluateOrderLogistics } from '@/lib/orderValidation';
import { toggleTaskCompletion } from '@/lib/taskStateController';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

interface KanbanOrderCardProps {
  order: any;
  customer?: any;
  columnId: 'neu' | 'verhandlung' | 'bestaetigt' | 'abgeschlossen';
  onRefresh?: () => void;
}

export function KanbanOrderCard({ order, customer, columnId, onRefresh }: KanbanOrderCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  const evaluation = evaluateOrderLogistics(order, customer);
  const custName = customer 
    ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.company || 'Kunde ohne Name'
    : order.customerName || order.clientName || 'Kunde ohne Name';

  const orderNum = order.orderNumber || order.orderIdShort || (order.id ? `#${order.id.slice(-5).toUpperCase()}` : '#RH-AUFTRAG');

  // Toggle checklist item status in Firebase
  const toggleCheckItem = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.id === 'address') {
      if (!item.done) {
        toast('Adressen müssen im Angebot eingetragen werden.', {
          icon: 'ℹ️'
        });
      } else {
        toast.success('Adressen vollständig erfasst.');
      }
      return;
    }

    if (isUpdating) return;
    setIsUpdating(true);

    try {
      const result = await toggleTaskCompletion(order, item.id);
      if (item.id === 'signature') {
        toast.success(result.newState ? 'Auftrag bestätigt' : 'Auftrag zurück auf "In Verhandlung" gesetzt');
      } else {
        toast.success(result.newState ? `${item.label} erledigt` : `${item.label} offen`);
      }
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setIsUpdating(false);
    }
  };

  // Quick source badge color mapping matching mockups
  const getSourceBadgeStyle = (src: string) => {
    const s = (src || '').toLowerCase();
    if (s.includes('google')) return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
    if (s.includes('empfehlung') || s.includes('stammkunde')) return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
    if (s.includes('insta') || s.includes('social')) return 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800';
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  };

  // Helper for relative time
  const getTimeAgo = () => {
    const ts = order.updatedAt?.toDate?.() || order.createdAt?.toDate?.();
    if (!ts) return 'vor kurzem';
    const diffHours = Math.floor((Date.now() - ts.getTime()) / (1000 * 60 * 60));
    if (diffHours < 1) return 'gerade eben';
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    const diffDays = Math.floor(diffHours / 24);
    return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
  };

  // COLUMN 1: NEU
  if (columnId === 'neu') {
    return (
      <div 
        className="bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all group"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <Link
            href={order.customerId ? `/dashboard/customers/${order.customerId}` : `/dashboard/orders`}
            className="font-bold text-sm text-slate-900 dark:text-white font-headline group-hover:text-[#D91E2A] transition-colors"
          >
            {custName}
          </Link>
          <span className="text-[10px] font-bold text-[#D91E2A] dark:text-red-400 font-headline">
            {orderNum}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 mb-4">
          <span className="material-symbols-outlined text-xs">near_me</span>
          <span>{evaluation.routeDisplay}</span>
        </div>
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${getSourceBadgeStyle(evaluation.leadSource)}`}>
            {evaluation.leadSource}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {getTimeAgo()}
            </span>
            {order.customerId && (
              <Link
                href={`/dashboard/customers/${order.customerId}/edit-order/${order.id}`}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#D91E2A] text-white hover:bg-[#b51822] transition-all flex items-center gap-1 shadow-sm"
                title="Angebot bearbeiten"
              >
                <span className="material-symbols-outlined text-xs">edit_document</span>
                <span>Angebot bearbeiten</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // COLUMN 2: IN VERHANDLUNG (with Besichtigungstermin / Videobesichtigung card)
  if (columnId === 'verhandlung') {
    const viewingDate = order.orderMeta?.viewingDate || order.viewingDate;
    const isVideo = (order.orderMeta?.viewingType || '').toLowerCase().includes('video');

    return (
      <div 
        className="bg-white dark:bg-slate-800/90 p-5 rounded-2xl border-l-4 border-l-amber-500 shadow-sm border-y border-r border-slate-200/80 dark:border-slate-700/60 hover:shadow-md transition-all group"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <Link
            href={order.customerId ? `/dashboard/customers/${order.customerId}` : `/dashboard/orders`}
            className="font-bold text-sm text-slate-900 dark:text-white font-headline group-hover:text-amber-600 transition-colors"
          >
            {custName}
          </Link>
          <span className="text-[10px] font-bold text-[#D91E2A] dark:text-red-400 font-headline">
            {orderNum}
          </span>
        </div>

        {viewingDate && viewingDate !== 'erledigt_fotos' ? (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 space-y-1.5 mb-3 border border-amber-200/70 dark:border-amber-900/40">
            <p className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider font-headline">
              {isVideo ? 'Videobesichtigung' : 'Besichtigungstermin'}
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 font-semibold">
              <span className="material-symbols-outlined text-sm text-amber-600 dark:text-amber-400">
                {isVideo ? 'videocam' : 'calendar_today'}
              </span>
              <span>{viewingDate.split('T')[0] || viewingDate}</span>
            </div>
            {viewingDate.includes('T') && (
              <div className="flex items-center gap-2 text-xs text-slate-800 dark:text-slate-200 font-semibold">
                <span className="material-symbols-outlined text-sm text-amber-600 dark:text-amber-400">schedule</span>
                <span>{viewingDate.split('T')[1]?.slice(0, 5)} Uhr</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 mb-3">
            <span className="material-symbols-outlined text-xs">near_me</span>
            <span>{evaluation.routeDisplay}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <span>{evaluation.movingDateDisplay}</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-amber-700 dark:text-amber-400">In Verhandlung</span>
            {order.customerId && (
              <Link
                href={`/dashboard/customers/${order.customerId}/edit-order/${order.id}`}
                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#D91E2A] text-white hover:bg-[#b51822] transition-all flex items-center gap-1 shadow-sm"
                title="Angebot bearbeiten"
              >
                <span className="material-symbols-outlined text-xs">edit_document</span>
                <span>Bearbeiten</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // COLUMN 3: BESTÄTIGT (with Ambient Border & Inline Logistik-Checklist)
  if (columnId === 'bestaetigt') {
    const isComplete = evaluation.isComplete;

    return (
      <div 
        className={`bg-white dark:bg-slate-800/90 p-5 rounded-2xl border-l-4 shadow-sm border-y border-r border-slate-200/80 dark:border-slate-700/60 transition-all ${
          isComplete ? 'border-l-emerald-500' : 'border-l-amber-500'
        }`}
      >
        <div className="flex justify-between items-start mb-2">
          <Link 
            href={order.customerId ? `/dashboard/customers/${order.customerId}` : `/dashboard/orders`}
            className="font-bold text-sm text-slate-900 dark:text-white font-headline hover:text-[#D91E2A] transition-colors"
          >
            {custName}
          </Link>
          <span className="text-[10px] font-bold text-[#D91E2A] dark:text-red-400 font-headline">
            {orderNum}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 mb-3">
          <span className="material-symbols-outlined text-xs">near_me</span>
          <span>{evaluation.routeDisplay}</span>
        </div>

        {/* Ambient Logistik Status Pill */}
        {!isComplete ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200/80 dark:bg-amber-950/40 dark:border-amber-900/40 mb-3">
            <span className="material-symbols-outlined text-[12px] text-amber-600 dark:text-amber-400">warning</span>
            <span className="text-[9px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-tight">
              Logistik unvollständig
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 dark:bg-emerald-950/40 dark:border-emerald-900/40 mb-3">
            <span className="material-symbols-outlined text-[12px] text-emerald-600 dark:text-emerald-400">check_circle</span>
            <span className="text-[9px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-tight">
              Logistik bereit
            </span>
          </div>
        )}

        {/* Mockup Logistik-Checklist */}
        <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
          <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 font-headline ${
            isComplete ? 'text-emerald-800 dark:text-emerald-400' : 'text-amber-800 dark:text-amber-400'
          }`}>
            Logistik-Checklist
          </p>

          {evaluation.checklist.map((item) => (
            <label 
              key={item.id} 
              className="flex items-center gap-2.5 cursor-pointer group select-none"
              onClick={(e) => toggleCheckItem(item, e)}
            >
              <input 
                type="checkbox" 
                checked={item.done}
                readOnly
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-[#D91E2A] focus:ring-[#D91E2A] cursor-pointer"
              />
              <span className={`text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                item.done 
                  ? 'line-through text-slate-400 dark:text-slate-500' 
                  : 'text-slate-700 dark:text-slate-200 group-hover:text-[#D91E2A]'
              }`}>
                <span>{item.label}</span>
                {item.isAutomated && (
                  <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 uppercase">
                    Auto
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>

        {order.customerId && (
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-medium">{evaluation.movingDateDisplay}</span>
            <Link
              href={`/dashboard/customers/${order.customerId}/edit-order/${order.id}`}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#D91E2A]/10 hover:bg-[#D91E2A] text-[#D91E2A] hover:text-white transition-all flex items-center gap-1"
              title="Angebot bearbeiten"
            >
              <span className="material-symbols-outlined text-xs">edit_document</span>
              <span>Angebot bearbeiten</span>
            </Link>
          </div>
        )}
      </div>
    );
  }

  // COLUMN 4: ABGESCHLOSSEN (with Completed Pill & Prominent Red Button)
  return (
    <div className="bg-white dark:bg-slate-800/90 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-sm opacity-90 hover:opacity-100 transition-all">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-bold text-sm text-slate-900 dark:text-white font-headline">
          {custName}
        </h4>
        <span className="material-symbols-outlined text-emerald-500 text-lg">check_circle</span>
      </div>

      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/40 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 font-headline">
          Erfolgreich durchgeführt
        </span>
      </div>

      {order.customerId && (
        <div className="flex items-center gap-2">
          <Link 
            href={`/dashboard/customers/${order.customerId}/edit-invoice/${order.id}`}
            className="flex-1 py-2.5 bg-[#D91E2A] text-white text-xs font-bold rounded-full hover:brightness-110 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#D91E2A]/15 text-center font-headline"
          >
            <span className="material-symbols-outlined text-sm">receipt_long</span>
            <span>Rechnung erstellen</span>
          </Link>
          <Link
            href={`/dashboard/customers/${order.customerId}/edit-order/${order.id}`}
            className="p-2.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-[#D91E2A] hover:text-white text-slate-600 dark:text-slate-300 transition-all"
            title="Angebot bearbeiten"
          >
            <span className="material-symbols-outlined text-base">edit_document</span>
          </Link>
        </div>
      )}
    </div>
  );
}
