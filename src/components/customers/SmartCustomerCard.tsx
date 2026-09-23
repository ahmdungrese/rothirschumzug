"use client";

import React from 'react';
import Link from 'next/link';
import { 
  UserCircleIcon, 
  BuildingOfficeIcon, 
  DocumentTextIcon, 
  CalendarIcon, 
  ArrowRightIcon, 
  PlusIcon, 
  EnvelopeIcon, 
  PhoneIcon,
  FolderOpenIcon,
  PencilSquareIcon,
  DocumentCheckIcon,
  BanknotesIcon,
  TruckIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import { getSourceBadgeStyle } from './SmartCustomerTable';

export function SmartCustomerCard({ customer, latestOrder }: { customer: any, latestOrder: any }) {
  // Phase & Status calculation
  let phaseNumber = 0;
  let statusText = "Kein Auftrag";
  let statusBadge = "bg-slate-500/10 text-slate-400 border-slate-500/20";
  
  // Dynamic Phase-aware Action Button
  let dynBtnText = "+ Angebot erstellen";
  let dynBtnIcon = <PlusIcon className="w-4 h-4" />;
  let dynBtnHref = `/dashboard/customers/${customer.id}/new-order`;
  let dynBtnStyle = "bg-primary hover:bg-[#b51822] text-white";

  if (latestOrder) {
    const st = latestOrder.status;
    const hasInv = Boolean(latestOrder.invoiceNumber || st?.startsWith('invoice_'));

    if (hasInv || st === 'completed' || st === 'invoice_paid' || st === 'invoice_open' || st === 'invoice_overdue') {
      phaseNumber = 4;
      if (st === 'invoice_overdue') {
        statusText = "4. Mahnung / Überfällig";
        statusBadge = "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse font-bold";
        dynBtnText = "Zahlung prüfen";
        dynBtnIcon = <BanknotesIcon className="w-4 h-4" />;
        dynBtnHref = `/dashboard/customers/${customer.id}`;
        dynBtnStyle = "bg-red-600 hover:bg-red-700 text-white";
      } else if (st === 'invoice_paid') {
        statusText = "4. Bezahlt & Erledigt";
        statusBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        dynBtnText = "Rechnung ansehen";
        dynBtnIcon = <DocumentCheckIcon className="w-4 h-4" />;
        dynBtnHref = `/dashboard/customers/${customer.id}?action=view-pdf&orderId=${latestOrder.id}`;
        dynBtnStyle = "bg-slate-800 dark:bg-slate-700 hover:bg-slate-600 text-white";
      } else if (st === 'invoice_open') {
        statusText = "4. Rechnung offen";
        statusBadge = "bg-orange-500/10 text-orange-400 border-orange-500/20";
        dynBtnText = "Zahlung erfassen";
        dynBtnIcon = <BanknotesIcon className="w-4 h-4" />;
        dynBtnHref = `/dashboard/customers/${customer.id}`;
        dynBtnStyle = "bg-orange-600 hover:bg-orange-700 text-white";
      } else {
        // completed without invoice
        statusText = "4. Umzug fertig (Rechnung fehlt)";
        statusBadge = "bg-purple-500/10 text-purple-400 border-purple-500/20";
        dynBtnText = "Rechnung schreiben";
        dynBtnIcon = <DocumentCheckIcon className="w-4 h-4" />;
        dynBtnHref = `/dashboard/customers/${customer.id}/edit-invoice/${latestOrder.id}`;
        dynBtnStyle = "bg-purple-600 hover:bg-purple-700 text-white";
      }
    } else if (st === 'confirmed' || latestOrder.signature || latestOrder.orderMeta?.customerSignature) {
      phaseNumber = 3;
      statusText = "3. Auftrag bestätigt";
      statusBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      dynBtnText = "Logistik & Cockpit";
      dynBtnIcon = <TruckIcon className="w-4 h-4" />;
      dynBtnHref = `/dashboard/customers/${customer.id}`;
      dynBtnStyle = "bg-emerald-600 hover:bg-emerald-700 text-white";
    } else if (st === 'quote' || st === 'clarification') {
      phaseNumber = 2;
      statusText = st === 'clarification' ? "2. In Klärung" : "2. Angebot versendet";
      statusBadge = "bg-blue-500/10 text-blue-400 border-blue-500/20";
      dynBtnText = "Angebot bearbeiten";
      dynBtnIcon = <DocumentTextIcon className="w-4 h-4" />;
      dynBtnHref = `/dashboard/customers/${customer.id}/edit-order/${latestOrder.id}`;
      dynBtnStyle = "bg-blue-600 hover:bg-blue-700 text-white";
    } else {
      phaseNumber = 1;
      statusText = "1. Entwurf offen";
      statusBadge = "bg-amber-500/10 text-amber-400 border-amber-500/20";
      dynBtnText = "Entwurf bearbeiten";
      dynBtnIcon = <PencilSquareIcon className="w-4 h-4" />;
      dynBtnHref = `/dashboard/customers/${customer.id}/edit-order/${latestOrder.id}`;
      dynBtnStyle = "bg-amber-500 hover:bg-amber-600 text-white";
    }
  }

  // Display Name
  const displayName = customer.type === 'firma' 
    ? (customer.lastName || customer.company || "Unbekannte Firma") 
    : `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || "Unbekannter Kunde";

  const cleanPhone = (customer.phone || latestOrder?.phone || '').replace(/[^0-9]/g, '');
  const intlPhone = cleanPhone.startsWith('0') ? '49' + cleanPhone.substring(1) : cleanPhone;

  return (
    <div className="bg-white dark:bg-slate-900/90 p-5 rounded-2xl sm:rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4">
      
      {/* Top Section: Direct Link to Customer Profile */}
      <Link 
        href={`/dashboard/customers/${customer.id}`} 
        className="block group space-y-3 cursor-pointer"
        title="Kundenakte öffnen"
      >
        {/* Header: Icon, Source & Phase Badge */}
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2">
            {customer.type === 'firma' ? (
              <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0">
                <BuildingOfficeIcon className="w-5 h-5" />
              </div>
            ) : (
              <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-xl text-slate-500 dark:text-slate-400 group-hover:text-primary transition-colors shrink-0">
                <UserCircleIcon className="w-5 h-5" />
              </div>
            )}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                #{customer.id?.slice(-5).toUpperCase() || 'KD'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {customer.source && (
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getSourceBadgeStyle(customer.source)}`}>
                {customer.source}
              </span>
            )}
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge}`}>
              {statusText}
            </span>
          </div>
        </div>

        {/* Name and Company details */}
        <div>
          <h3 className="text-base sm:text-lg font-bold font-headline text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1">
            {displayName}
          </h3>
          {customer.type === 'firma' && customer.firstName && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Ansprechpartner: {customer.firstName}
            </p>
          )}
        </div>

        {/* Move Route & Date Snippet */}
        {latestOrder?.logistics?.a_city && (
          <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center gap-2 text-xs font-bold text-primary">
              <span className="truncate">{latestOrder.logistics.a_city}</span>
              <ArrowRightIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{latestOrder.logistics.b_city || 'Ziel'}</span>
            </div>
            {(() => {
              const movingDateRaw = latestOrder?.orderMeta?.movingDateFrom || latestOrder?.movingDate || latestOrder?.logistics?.movingDate;
              if (!movingDateRaw) return null;
              try {
                return (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    <CalendarIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Umzug: {new Date(movingDateRaw).toLocaleDateString('de-DE')}</span>
                  </div>
                );
              } catch {
                return null;
              }
            })()}
          </div>
        )}
      </Link>

      {/* Contact & Phone Row */}
      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
        {customer.phone && (
          <div className="flex items-center justify-between gap-2">
            <a 
              href={`tel:${customer.phone}`} 
              className="flex items-center gap-1.5 hover:text-primary transition-colors truncate"
              title="Kunden anrufen"
            >
              <PhoneIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate font-semibold">{customer.phone}</span>
            </a>

            {intlPhone && (
              <a
                href={`https://wa.me/${intlPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 px-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold transition-all flex items-center gap-1 shrink-0"
                title="In WhatsApp chatten"
              >
                <ChatBubbleLeftRightIcon className="w-3 h-3" />
                <span>WhatsApp</span>
              </a>
            )}
          </div>
        )}

        {customer.email && (
          <a 
            href={`mailto:${customer.email}`} 
            className="flex items-center gap-1.5 hover:text-primary transition-colors truncate block"
            title="E-Mail senden"
          >
            <EnvelopeIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">{customer.email}</span>
          </a>
        )}
      </div>

      {/* Action Buttons: 1. Akte öffnen + 2. Phase Action */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {/* Button 1: Kundenakte Öffnen */}
          <Link
            href={`/dashboard/customers/${customer.id}`}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all shadow-xs cursor-pointer"
            title="Kundenakte & Details öffnen"
          >
            <FolderOpenIcon className="w-4 h-4 text-primary" />
            <span>Kundenakte</span>
          </Link>

          {/* Button 2: Dynamische Phase-Aktion */}
          <Link
            href={dynBtnHref}
            className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${dynBtnStyle}`}
            title={dynBtnText}
          >
            {dynBtnIcon}
            <span className="truncate">{dynBtnText}</span>
          </Link>
        </div>

        {/* Quick Tools: PDF & Protokoll */}
        {latestOrder && (
          <div className="flex items-center gap-2">
            <Link 
              href={`/dashboard/customers/${customer.id}?action=view-pdf&orderId=${latestOrder.id}`} 
              className="flex-1 py-1.5 px-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors border border-slate-200/60 dark:border-slate-700/60"
              title="PDF anzeigen"
            >
              <DocumentTextIcon className="w-3.5 h-3.5" />
              <span>PDF Vorschau</span>
            </Link>
            <Link 
              href={`/dashboard/customers/${customer.id}?action=view-protocol&orderId=${latestOrder.id}`} 
              className="flex-1 py-1.5 px-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors border border-slate-200/60 dark:border-slate-700/60"
              title="Übergabeprotokoll"
            >
              <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />
              <span>Protokoll</span>
            </Link>
          </div>
        )}
      </div>

    </div>
  );
}
