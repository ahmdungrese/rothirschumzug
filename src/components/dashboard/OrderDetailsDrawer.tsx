"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  XMarkIcon, 
  PhoneIcon, 
  ChatBubbleLeftRightIcon, 
  EnvelopeIcon, 
  CalendarDaysIcon, 
  MapPinIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  PencilSquareIcon, 
  DocumentCheckIcon, 
  DocumentTextIcon, 
  TruckIcon, 
  ClockIcon, 
  ArrowTopRightOnSquareIcon,
  CubeIcon,
  CurrencyEuroIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { evaluateOrderLogistics } from '@/lib/orderValidation';
import { toggleTaskCompletion } from '@/lib/taskStateController';
import { TaskScheduleModal } from '@/components/logistics/TaskScheduleModal';
import { BaumarktShoppingModal } from '@/components/logistics/BaumarktShoppingModal';
import { SignatureModal } from '@/components/orders/SignatureModal';
import { ProtocolModal } from '@/components/customers/ProtocolModal';
import { MessageSenderModal } from '@/components/customers/MessageSenderModal';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface OrderDetailsDrawerProps {
  order: any;
  customer?: any;
  onClose: () => void;
  onRefresh?: () => void;
}

export function OrderDetailsDrawer({ order, customer, onClose, onRefresh }: OrderDetailsDrawerProps) {
  // Determine initial phase from status
  const getInitialPhase = (st: string) => {
    if (st === 'completed' || st?.startsWith('invoice_') || st === 'archived') return 4;
    if (st === 'confirmed') return 3;
    if (st === 'quote' || st === 'verhandlung' || Boolean(order?.orderMeta?.viewingDate || order?.viewingDate)) return 2;
    return 1;
  };

  const currentOrderPhase = getInitialPhase(order?.status || 'draft');
  const [activePhaseTab, setActivePhaseTab] = useState<number>(currentOrderPhase);

  // Modals state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [shoppingModalOpen, setShoppingModalOpen] = useState(false);
  const [currentTodoForSchedule, setCurrentTodoForSchedule] = useState<any>(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [protocolModalOpen, setProtocolModalOpen] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [defaultTemplateName, setDefaultTemplateName] = useState<string>('');
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!order) return null;

  const evaluation = evaluateOrderLogistics(order, customer);
  const custName = customer 
    ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.company || 'Kunde ohne Name'
    : order.customerName || order.clientName || 'Kunde ohne Name';

  const orderNum = order.orderNumber || order.orderIdShort || (order.id ? `#${order.id.slice(-5).toUpperCase()}` : '#RH-AUFTRAG');
  const custPhone = customer?.phone || order.phone || order.customerPhone || '';
  const custEmail = customer?.email || order.email || order.customerEmail || '';

  const addressA = [
    order.logistics?.a_street || order.logistics?.from?.street,
    order.logistics?.a_houseNr || order.logistics?.from?.houseNumber,
    order.logistics?.a_zip || order.logistics?.from?.postalCode,
    order.logistics?.a_city || order.logistics?.from?.city
  ].filter(Boolean).join(' ');

  const addressB = [
    order.logistics?.b_street || order.logistics?.to?.street,
    order.logistics?.b_houseNr || order.logistics?.to?.houseNumber,
    order.logistics?.b_zip || order.logistics?.to?.postalCode,
    order.logistics?.b_city || order.logistics?.to?.city
  ].filter(Boolean).join(' ');

  // Compute materials summary (boxes count)
  const matSummary = (() => {
    let standard = 0;
    let buecher = 0;
    let kleider = 0;
    const add = (name: string, qty: number) => {
      const n = (name || '').toLowerCase();
      if (n.includes('bücher') || n.includes('buecher')) buecher += qty;
      else if (n.includes('kleider')) kleider += qty;
      else if (n.includes('karton') || n.includes('box')) standard += qty;
    };
    if (Array.isArray(order.services)) {
      order.services.forEach((s: any) => add(s.name, s.quantity || 1));
    }
    if (Array.isArray(order.inventory)) {
      order.inventory.forEach((i: any) => add(i.name, i.quantity || 1));
    }
    if (Array.isArray(order.materials)) {
      order.materials.forEach((m: any) => add(m.name || 'Packmittel', m.quantity || 1));
    }
    return { standard, buecher, kleider, total: standard + buecher + kleider };
  })();

  // Handle task toggling via state controller
  const handleToggleTask = async (taskId: string, label: string) => {
    if (isUpdatingTask) return;
    setIsUpdatingTask(true);
    try {
      const res = await toggleTaskCompletion(order, taskId);
      toast.success(res.newState ? `${label} als erledigt markiert` : `${label} wiedereröffnet`);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
      toast.error('Fehler beim Aktualisieren der Aufgabe');
    } finally {
      setIsUpdatingTask(false);
    }
  };

  // Open scheduler for specific task
  const handleOpenSchedule = (todoObj: any) => {
    setCurrentTodoForSchedule(todoObj);
    setScheduleModalOpen(true);
  };

  // Quick message sender trigger
  const handleOpenMessage = (templateKeyword: string) => {
    setDefaultTemplateName(templateKeyword);
    setMessageModalOpen(true);
  };

  // Direct WhatsApp click
  const handleDirectWhatsApp = (text?: string) => {
    if (!custPhone) {
      toast.error('Keine Telefonnummer beim Kunden hinterlegt!');
      return;
    }
    const cleanPhone = custPhone.replace(/[^0-9]/g, '');
    const intlPhone = cleanPhone.startsWith('0') ? '49' + cleanPhone.substring(1) : cleanPhone;
    const url = text 
      ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/${intlPhone}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      {/* Click outside backdrop to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Container */}
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 z-10 animate-in slide-in-from-right duration-300">
        
        {/* Top Header Bar */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold font-headline text-primary">
                  {orderNum}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  order.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                  order.status === 'completed' ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300' :
                  order.status === 'quote' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                  'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                }`}>
                  {order.status === 'confirmed' ? 'Bestätigt' :
                   order.status === 'completed' ? 'Abgeschlossen' :
                   order.status === 'quote' ? 'In Verhandlung' : 'Neu / Entwurf'}
                </span>
              </div>
              <h2 className="text-xl font-bold font-headline text-slate-900 dark:text-white">
                {custName}
              </h2>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
              title="Schließen (Esc)"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Quick Contact & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-700/60">
            {custPhone && (
              <>
                <a 
                  href={`tel:${custPhone}`}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Anrufen"
                >
                  <PhoneIcon className="w-4 h-4 text-emerald-600" />
                  <span>{custPhone}</span>
                </a>

                <button 
                  onClick={() => handleDirectWhatsApp()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="WhatsApp Chat öffnen"
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp</span>
                </button>
              </>
            )}

            {custEmail && (
              <a 
                href={`mailto:${custEmail}`}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="E-Mail schreiben"
              >
                <EnvelopeIcon className="w-4 h-4 text-blue-500" />
                <span className="truncate max-w-[150px]">{custEmail}</span>
              </a>
            )}

            {order.customerId && (
              <Link
                href={`/dashboard/customers/${order.customerId}/edit-order/${order.id}`}
                className="ml-auto px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Angebot im Editor öffnen"
              >
                <PencilSquareIcon className="w-4 h-4" />
                <span>Editor</span>
              </Link>
            )}
          </div>
        </div>

        {/* Route, Moving Date & Metric Pills */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
              <MapPinIcon className="w-3.5 h-3.5" />
              <span>Route</span>
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {evaluation.routeDisplay}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
              <CalendarDaysIcon className="w-3.5 h-3.5" />
              <span>Umzugstermin</span>
            </div>
            <p className="text-xs font-bold text-slate-900 dark:text-white">
              {evaluation.movingDateDisplay}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1 flex items-center justify-between sm:block">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
              <CurrencyEuroIcon className="w-3.5 h-3.5" />
              <span>Summe</span>
            </div>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {order.totals?.gross ? `${order.totals.gross.toFixed(2)} €` : '0,00 €'}
            </p>
          </div>
        </div>

        {/* Phase Navigation Stepper Tabs */}
        <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-4 bg-slate-100/50 dark:bg-slate-900/50 overflow-x-auto scrollbar-none">
          {[
            { phase: 1, label: '1. Anfrage', sub: 'Lead prüfen' },
            { phase: 2, label: '2. Verhandlung', sub: 'Besichtigung & Sign' },
            { phase: 3, label: '3. Bestätigt', sub: 'Logistik & Termine' },
            { phase: 4, label: '4. Abschluss', sub: 'Protokoll & Rechnung' },
          ].map(tab => {
            const isActive = activePhaseTab === tab.phase;
            const isCurrent = currentOrderPhase === tab.phase;
            return (
              <button
                key={tab.phase}
                onClick={() => setActivePhaseTab(tab.phase)}
                className={`py-3 px-4 text-xs font-bold font-headline whitespace-nowrap border-b-2 transition-all flex flex-col items-center relative ${
                  isActive 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span>{tab.label}</span>
                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Aktuelle Phase des Auftrags" />
                  )}
                </div>
                <span className="text-[10px] font-normal opacity-75">{tab.sub}</span>
              </button>
            );
          })}
        </div>

        {/* Phase Specific Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* ========================================================================= */}
          {/* PHASE 1: NEU / LEAD-QUALIFIZIERUNG */}
          {/* ========================================================================= */}
          {activePhaseTab === 1 && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40">
                <h3 className="text-sm font-bold text-blue-900 dark:text-blue-300 font-headline mb-1">
                  Phase 1: Neue Anfrage (Lead)
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Prüfe hier die Kontaktdaten und Details der Anfrage. Kontaktiere den Kunden mit einer der passenden Erstkontakt-Vorlagen.
                </p>
              </div>

              {/* Data Verification Checklist */}
              <div className="panel p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-headline">
                  Stammdaten-Prüfung
                </h4>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400">Telefonnummer</span>
                    {custPhone ? (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckIcon className="w-3.5 h-3.5" /> {custPhone}
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Fehlt
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400">E-Mail-Adresse</span>
                    {custEmail ? (
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckIcon className="w-3.5 h-3.5" /> {custEmail}
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Fehlt
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400">Auszugsadresse (A)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {order.logistics?.from?.city || 'Nicht angegeben'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-600 dark:text-slate-400">Einzugsadresse (B)</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {order.logistics?.to?.city || 'Nicht angegeben'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vorlagen Quick Actions for Phase 1 */}
              <div className="panel p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-headline">
                  Passende Vorlagen für Erstkontakt
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleOpenMessage('Erstkontakt (Bilder')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary">
                        Bilder erhalten (t1)
                      </span>
                      <ChatBubbleLeftRightIcon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Dank für Bilder, Zusage eines Festpreisangebots.
                    </p>
                  </button>

                  <button
                    onClick={() => handleOpenMessage('Erstkontakt (Keine Bilder')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary">
                        Keine Bilder (t2)
                      </span>
                      <ChatBubbleLeftRightIcon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Bitte um Bilder/Möbelliste oder Telefonat.
                    </p>
                  </button>
                </div>
              </div>

              {/* Action to create offer */}
              {order.customerId && (
                <Link
                  href={`/dashboard/customers/${order.customerId}/edit-order/${order.id}`}
                  className="w-full py-3 bg-primary text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-md hover:bg-primary/90 transition-all font-headline"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                  <span>Angebot im Editor erstellen / bearbeiten</span>
                </Link>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* PHASE 2: IN VERHANDLUNG / BESICHTIGUNG & SIGNATUR */}
          {/* ========================================================================= */}
          {activePhaseTab === 2 && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 font-headline mb-1">
                  Phase 2: In Verhandlung & Besichtigung
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Verwalte Besichtigungstermine, versende das Angebot oder lass den Kunden direkt digital unterschreiben!
                </p>
              </div>

              {/* Digital Signature Card */}
              <div className="panel p-4 border-2 border-primary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DocumentCheckIcon className="w-5 h-5 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-headline">
                      Digitale Unterschrift
                    </h4>
                  </div>
                  {order.signatureOrder ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircleIcon className="w-3.5 h-3.5" /> Unterschrieben
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      Ausstehend
                    </span>
                  )}
                </div>

                {order.signatureOrder ? (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {order.signatureOrderPlace ? `${order.signatureOrderPlace}, ${order.signatureOrderDateString}` : 'Unterschrieben'}
                      </p>
                      <p className="text-[10px] text-slate-500">Unterschrift im PDF eingebettet</p>
                    </div>
                    <button
                      onClick={() => setSignatureModalOpen(true)}
                      className="px-3 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Neu signieren
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                      Lass den Kunden hier direkt auf deinem Display (Tablet/Handy/PC) unterschreiben. Der Auftrag wird sofort bestätigt und das PDF signiert!
                    </p>
                    <button
                      onClick={() => setSignatureModalOpen(true)}
                      className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow hover:brightness-110 transition-all font-headline"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                      <span>Auftrag jetzt digital unterschreiben</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Besichtigungstermin Card */}
              <div className="panel p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-headline">
                    Besichtigungstermin
                  </h4>
                  <button
                    onClick={() => handleOpenSchedule({ id: 'viewing_requested', name: 'Besichtigung' })}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <CalendarDaysIcon className="w-3.5 h-3.5" />
                    <span>Termin planen / ändern</span>
                  </button>
                </div>

                {order.orderMeta?.viewingDate && order.orderMeta?.viewingDate !== 'erledigt_fotos' ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                          {order.orderMeta?.viewingType || 'Vor-Ort Besichtigung'}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {order.orderMeta?.viewingDate.split('T')[0]} {order.orderMeta?.viewingTime ? `um ${order.orderMeta?.viewingTime} Uhr` : ''}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-amber-600 text-xl">calendar_today</span>
                    </div>

                    {addressA && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between gap-2">
                        <span className="truncate">📍 {addressA}</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressA)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-amber-200/70 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold hover:brightness-110 flex items-center gap-1 shrink-0"
                          title="In Google Maps öffnen"
                        >
                          <MapPinIcon className="w-3.5 h-3.5" />
                          <span>Navigation</span>
                        </a>
                      </div>
                    )}

                    <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center gap-2">
                      {order.customerId && (
                        <Link
                          href={`/dashboard/customers/${order.customerId}/edit-order/${order.id}?step=4`}
                          className="flex-1 py-2 px-3 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-110 shadow-xs"
                        >
                          <span className="material-symbols-outlined text-sm">chair</span>
                          <span>Besichtigung starten (Umzugsliste)</span>
                        </Link>
                      )}
                      {custPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            const timeText = order.orderMeta?.viewingTime ? ` um ${order.orderMeta.viewingTime} Uhr` : '';
                            handleDirectWhatsApp(`Hallo ${custName}, ich bin pünktlich auf dem Weg zu Ihnen für unseren Besichtigungstermin${timeText}. Bis gleich!`);
                          }}
                          className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-emerald-700 transition-colors"
                          title="Ich bin unterwegs senden"
                        >
                          <ChatBubbleLeftRightIcon className="w-4 h-4" />
                          <span>Unterwegs</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 italic">
                      Noch kein Besichtigungstermin vereinbart.
                    </p>
                    {order.customerId && (
                      <Link
                        href={`/dashboard/customers/${order.customerId}/edit-order/${order.id}?step=4`}
                        className="w-full py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">chair</span>
                        <span>Direkt zu Umzugsliste & Möbeln</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Vorlagen Quick Actions for Phase 2 */}
              <div className="panel p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-headline">
                  Passende Vorlagen (Verhandlung & Angebot)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleOpenMessage('Angebot schicken')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary">
                        Angebot schicken (t3)
                      </span>
                      <EnvelopeIcon className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Festpreisangebot mit Schutzdecken und PDF-Anhang.
                    </p>
                  </button>

                  <button
                    onClick={() => handleOpenMessage('Nachfrage')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary">
                        Nachfassen (t4)
                      </span>
                      <ChatBubbleLeftRightIcon className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Freundliches Nachfragen zur Terminreservierung.
                    </p>
                  </button>

                  <button
                    onClick={() => handleOpenMessage('Aktualisiertes')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary">
                        Aktualisiertes Angebot (t5)
                      </span>
                      <EnvelopeIcon className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Überarbeitetes Angebot nach Anpassungen.
                    </p>
                  </button>

                  <button
                    onClick={() => handleOpenMessage('Absage')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-red-400 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-red-500">
                        Absage (t6)
                      </span>
                      <XMarkIcon className="w-4 h-4 text-red-500" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Höfliche Verabschiedung bei Kundenabsage.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PHASE 3: BESTÄTIGT / LOGISTIK-CHECKLISTE & VORBEREITUNG */}
          {/* ========================================================================= */}
          {activePhaseTab === 3 && (
            <div className="space-y-6">
              {/* Readiness Banner */}
              <div className={`p-4 rounded-2xl border ${
                evaluation.isComplete
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                  : 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-lg">
                    {evaluation.isComplete ? 'verified' : 'warning'}
                  </span>
                  <h3 className="text-sm font-bold font-headline">
                    {evaluation.isComplete ? 'Logistik vollständig bereit!' : 'Logistik-Vorbereitung unvollständig'}
                  </h3>
                </div>
                <p className="text-xs opacity-90">
                  {evaluation.isComplete 
                    ? 'Alle Termine und Vorbereitungen für den Umzugstag sind abgeschlossen.'
                    : 'Bitte plane die Termine für Kartons, Halteverbotszone und weise das Team zu.'}
                </p>
              </div>

              {/* Task Cards */}
              <div className="panel p-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-headline">
                  Operative Logistik-Aufgaben
                </h4>

                <div className="space-y-3">
                  {/* Task: Kartons */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={evaluation.checklist.find(c => c.id === 'kartons')?.done || false}
                          onChange={() => handleToggleTask('kartons_liefern', 'Umzugskartons')}
                          disabled={isUpdatingTask}
                          className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Umzugskartons liefern
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {matSummary.total > 0 ? (
                              <span>
                                📦 {matSummary.total} Kartons ({matSummary.standard > 0 ? `${matSummary.standard}x Standard` : ''}{matSummary.buecher > 0 ? `, ${matSummary.buecher}x Bücher` : ''}{matSummary.kleider > 0 ? `, ${matSummary.kleider}x Kleider` : ''})
                              </span>
                            ) : (
                              'Materialbedarf offen'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShoppingModalOpen(true)}
                          className="px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 text-xs font-bold hover:bg-orange-500 hover:text-white transition-all flex items-center gap-1"
                          title="Baumarkt Einkaufszettel öffnen"
                        >
                          <span className="material-symbols-outlined text-sm">shopping_cart</span>
                          <span>Baumarkt</span>
                        </button>
                        <button
                          onClick={() => handleOpenSchedule({ id: 'kartons_liefern', kanbanCategory: 'kartons', name: 'Kartons' })}
                          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                        >
                          <CalendarDaysIcon className="w-3.5 h-3.5" />
                          <span>Termin</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <span>
                        Lieferung: {order.orderMeta?.kartonDeliveryDate || order.logistics?.boxDeliveryDate || 'Noch nicht terminiert'}
                        {order.orderMeta?.kartonDeliveryTime ? ` (${order.orderMeta.kartonDeliveryTime} Uhr)` : ''}
                      </span>
                      {(order.orderMeta?.kartonDeliveryDate || order.logistics?.boxDeliveryDate) && (
                        <button
                          onClick={() => {
                            const date = order.orderMeta?.kartonDeliveryDate || order.logistics?.boxDeliveryDate;
                            const time = order.orderMeta?.kartonDeliveryTime || '';
                            handleDirectWhatsApp(`Guten Tag, Ihre Umzugskartons werden am ${date} ${time ? 'im Zeitfenster ' + time : ''} geliefert.`);
                          }}
                          className="text-emerald-600 hover:underline flex items-center gap-1 font-bold"
                          title="WhatsApp Nachricht senden"
                        >
                          <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Task: Halteverbot (HVZ) */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={evaluation.checklist.find(c => c.id === 'hvz')?.done || false}
                          onChange={() => handleToggleTask('halteverbot', 'Halteverbotszone')}
                          disabled={isUpdatingTask}
                          className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Halteverbotszone (HVZ)
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {order.orderMeta?.hvzMethod === 'extern' ? '🏢 Externe Firma' : '🚗 Selbst aufstellen'}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-primary/10 text-primary">
                              {order.orderMeta?.hvzLocation === 'b' ? '🏠 Einzugsort (B)' : 
                               order.orderMeta?.hvzLocation === 'both' ? '🔄 Beide Orte (A & B)' : '🏢 Auszugsort (A)'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenSchedule({ id: 'halteverbot', kanbanCategory: 'halteverbot', name: 'Halteverbot' })}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <CalendarDaysIcon className="w-3.5 h-3.5" />
                        <span>Termin planen</span>
                      </button>
                    </div>

                    {/* Address & Navigation */}
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                        📍 {order.orderMeta?.hvzLocation === 'b' ? (addressB || 'Einzugsadresse') : (addressA || 'Auszugsadresse')}
                      </span>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.orderMeta?.hvzLocation === 'b' ? addressB : addressA)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-primary hover:text-white text-slate-700 dark:text-slate-300 text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                        title="In Google Maps öffnen"
                      >
                        <MapPinIcon className="w-3 h-3" />
                        <span>Maps</span>
                      </a>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <span>
                        Aufbau: {order.orderMeta?.halteverbotDate || order.logistics?.hvzDate || 'Noch nicht terminiert'}
                      </span>
                      {(order.orderMeta?.halteverbotDate || order.logistics?.hvzDate) && (
                        <button
                          onClick={() => {
                            const date = order.orderMeta?.halteverbotDate || order.logistics?.hvzDate;
                            handleDirectWhatsApp(`Guten Tag, die Halteverbotszone für Ihren Umzug wird am ${date} vorschriftsmäßig aufgestellt.`);
                          }}
                          className="text-emerald-600 hover:underline flex items-center gap-1 font-bold"
                          title="WhatsApp Nachricht senden"
                        >
                          <ChatBubbleLeftRightIcon className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Task: Möbellift */}
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={evaluation.checklist.find(c => c.id === 'lift')?.done || false}
                          onChange={() => handleToggleTask('moebellift_buchen', 'Möbellift')}
                          disabled={isUpdatingTask}
                          className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Möbellift disponieren
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {order.orderMeta?.moebelliftLocation === 'b' ? '🏠 Einzugsort (B)' : '🏢 Auszugsort (A)'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenSchedule({ id: 'moebellift_buchen', kanbanCategory: 'moebellift', name: 'Möbellift' })}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                      >
                        <CalendarDaysIcon className="w-3.5 h-3.5" />
                        <span>Termin planen</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <span>
                        {order.orderMeta?.moebelliftDate ? (
                          <>
                            Geplant: <strong className="text-slate-900 dark:text-white">{order.orderMeta.moebelliftDate}</strong>
                            {order.orderMeta?.moebelliftTime && ` • ${order.orderMeta.moebelliftTime} - ${order.orderMeta.moebelliftEndTime || ''} Uhr (${order.orderMeta.moebelliftDuration || '3'} Std.)`}
                          </>
                        ) : (
                          'Bedarfsprüfung ausstehend'
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Vorlagen Quick Actions for Phase 3 */}
              <div className="panel p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-headline">
                  Passende Vorlagen (Bestätigung & Ablauf)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleOpenMessage('Bestätigung')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">
                        Auftragsbestätigung (t7)
                      </span>
                      <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Bestätigung des Termins nach Zusage.
                    </p>
                  </button>

                  <button
                    onClick={() => handleOpenMessage('Zeit des Umzugs')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-600">
                        Ankunftszeit Team (t8)
                      </span>
                      <ClockIcon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Ankunftszeitfenster am Umzugsmorgen.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PHASE 4: ABGESCHLOSSEN / PROTOKOLL & RECHNUNG */}
          {/* ========================================================================= */}
          {activePhaseTab === 4 && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40">
                <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300 font-headline mb-1">
                  Phase 4: Durchführung & Abschluss
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Umzug erfolgreich durchgeführt! Unterzeichne das Abnahmeprotokoll, erstelle die Rechnung und bitte um eine Kundenbewertung.
                </p>
              </div>

              {/* Action Buttons: Protocol & Invoice */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setProtocolModalOpen(true)}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 flex flex-col items-center text-center gap-2 shadow-sm transition-all group"
                >
                  <DocumentCheckIcon className="w-8 h-8 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    Abnahmeprotokoll öffnen
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Schäden erfassen & digital unterschreiben
                  </span>
                </button>

                {order.customerId && (
                  <Link
                    href={`/dashboard/customers/${order.customerId}/edit-invoice/${order.id}`}
                    className="p-4 rounded-2xl bg-[#D91E2A] text-white flex flex-col items-center text-center gap-2 shadow-md hover:bg-[#b51822] transition-all group font-headline"
                  >
                    <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">
                      receipt_long
                    </span>
                    <span className="text-xs font-bold">
                      Rechnung erstellen
                    </span>
                    <span className="text-[10px] text-white/80">
                      1-Klick Abrechnung mit allen Leistungen
                    </span>
                  </Link>
                )}
              </div>

              {/* Vorlagen Quick Actions for Phase 4 */}
              <div className="panel p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-headline">
                  Passende Vorlagen (Rechnung & Bewertung)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleOpenMessage('Rechnung schicken')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary">
                        Rechnung schicken (t9)
                      </span>
                      <EnvelopeIcon className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Rechnung mit Bitte um Google / Check24 Bewertung.
                    </p>
                  </button>

                  <button
                    onClick={() => handleOpenMessage('Bewertung')}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary text-left transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-primary">
                        Dank für Bewertung (t10)
                      </span>
                      <ChatBubbleLeftRightIcon className="w-4 h-4 text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">
                      Herzliches Dankeschön bei positiver Bewertung.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Embedded Modals */}
      {scheduleModalOpen && currentTodoForSchedule && (
        <TaskScheduleModal
          isOpen={scheduleModalOpen}
          onClose={() => setScheduleModalOpen(false)}
          todo={currentTodoForSchedule}
          parentOrder={order}
          onSaved={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {shoppingModalOpen && (
        <BaumarktShoppingModal
          isOpen={shoppingModalOpen}
          onClose={() => setShoppingModalOpen(false)}
          order={order}
        />
      )}

      {signatureModalOpen && (
        <SignatureModal
          order={order}
          onClose={() => setSignatureModalOpen(false)}
          onSigned={async () => {
            // Update order status to confirmed if it was quote or draft
            try {
              if (order.status !== 'confirmed') {
                await updateDoc(doc(db, 'orders', order.id), {
                  status: 'confirmed'
                });
              }
              toast.success('Auftrag erfolgreich unterschrieben und bestätigt!');
              if (onRefresh) onRefresh();
            } catch (e) {
              console.error(e);
            }
            setSignatureModalOpen(false);
          }}
        />
      )}

      {protocolModalOpen && (
        <ProtocolModal
          order={order}
          onClose={() => {
            setProtocolModalOpen(false);
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {messageModalOpen && (
        <MessageSenderModal
          order={order}
          customer={customer}
          defaultTemplateName={defaultTemplateName}
          onClose={() => setMessageModalOpen(false)}
        />
      )}
    </div>
  );
}
