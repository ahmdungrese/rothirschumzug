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
  CheckIcon,
  BuildingOfficeIcon,
  HomeIcon,
  ArrowPathIcon,
  EyeIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { evaluateOrderLogistics } from '@/lib/orderValidation';
import { toggleTaskCompletion } from '@/lib/taskStateController';
import { TaskScheduleModal } from '@/components/logistics/TaskScheduleModal';
import { SignatureModal } from '@/components/orders/SignatureModal';
import { ProtocolModal } from '@/components/customers/ProtocolModal';
import { MessageSenderModal } from '@/components/customers/MessageSenderModal';
import { PdfModal } from '@/components/ui/PdfModal';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface OrderDetailsDrawerProps {
  order: any;
  customer?: any;
  initialPhase?: number;
  onClose: () => void;
  onRefresh?: () => void;
}

export function OrderDetailsDrawer({ order: initialOrder, customer, initialPhase, onClose, onRefresh }: OrderDetailsDrawerProps) {
  const router = useRouter();
  const [order, setOrder] = useState<any>(initialOrder);

  // Sync when initialOrder prop changes
  useEffect(() => {
    if (initialOrder) {
      setOrder(initialOrder);
    }
  }, [initialOrder]);

  // Real-time Firestore listener so any date/status change in TaskScheduleModal or SignatureModal updates immediately
  useEffect(() => {
    if (!initialOrder?.id) return;
    const unsub = onSnapshot(doc(db, 'orders', initialOrder.id), (snap) => {
      if (snap.exists()) {
        setOrder({ id: snap.id, ...snap.data() });
      }
    }, (err) => console.error('OrderDetailsDrawer live sync error:', err));
    return () => unsub();
  }, [initialOrder?.id]);

  // Determine initial phase from status
  const getInitialPhase = (st: string, ord: any) => {
    if (st === 'completed' || st?.startsWith('invoice_') || st === 'archived') return 4;
    if (st === 'confirmed' || ord?.isManuallySigned || ord?.contractSigned || ord?.signatureOrder || ord?.orderMeta?.signedContractScan) return 3;
    if (st === 'quote' || st === 'verhandlung' || Boolean(ord?.orderMeta?.viewingDate || ord?.viewingDate)) return 2;
    return 1;
  };

  const currentOrderPhase = getInitialPhase(order?.status || 'draft', order);
  const [activePhaseTab, setActivePhaseTab] = useState<number>(initialPhase || currentOrderPhase);

  useEffect(() => {
    if (initialPhase) {
      setActivePhaseTab(initialPhase);
    }
  }, [initialPhase]);

  // Modals state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [currentTodoForSchedule, setCurrentTodoForSchedule] = useState<any>(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [protocolModalOpen, setProtocolModalOpen] = useState(false);
  const [messageModalOpen, setMessageModalOpen] = useState(false);
  const [defaultTemplateName, setDefaultTemplateName] = useState<string>('');
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [internalCustomer, setInternalCustomer] = useState<any>(customer || null);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfModalType, setPdfModalType] = useState<'order' | 'invoice' | 'protocol'>('order');
  const [earlyInvoiceWarningOpen, setEarlyInvoiceWarningOpen] = useState(false);
  const [scanPreviewOpen, setScanPreviewOpen] = useState(false);
  const [isUploadingScan, setIsUploadingScan] = useState(false);
  const scanInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (customer) {
      setInternalCustomer(customer);
      return;
    }
    if (order?.customerId && order.customerId !== 'undefined') {
      getDoc(doc(db, 'customers', order.customerId)).then((snap) => {
        if (snap.exists()) {
          setInternalCustomer({ id: snap.id, ...snap.data() });
        }
      }).catch(console.error);
    }
  }, [order?.customerId, customer]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!order) return null;

  const evaluation = evaluateOrderLogistics(order, internalCustomer);
  const custName = internalCustomer 
    ? `${internalCustomer.firstName || ''} ${internalCustomer.lastName || ''}`.trim() || internalCustomer.company || 'Kunde ohne Name'
    : order.customerName || order.clientName || `${order.billingAddress?.firstName || ''} ${order.billingAddress?.lastName || ''}`.trim() || 'Kunde ohne Name';

  const orderNum = order.orderNumber || order.orderIdShort || (order.id ? `#${order.id.slice(-5).toUpperCase()}` : '#RH-AUFTRAG');
  const custPhone = internalCustomer?.phone || order.billingAddress?.phone || order.phone || order.customerPhone || '';
  const custEmail = internalCustomer?.email || order.billingAddress?.email || order.email || order.customerEmail || '';

  const customerBillingAddr = [
    internalCustomer?.street || order.billingAddress?.street,
    internalCustomer?.houseNr || order.billingAddress?.houseNr,
    internalCustomer?.zip || order.billingAddress?.zip,
    internalCustomer?.city || order.billingAddress?.city
  ].filter(Boolean).join(' ');

  const rawAddressA = [
    order.logistics?.a_street || order.logistics?.from?.street || order.logistics?.auszug?.street,
    order.logistics?.a_houseNr || order.logistics?.from?.houseNumber || order.logistics?.auszug?.houseNr,
    order.logistics?.a_zip || order.logistics?.from?.postalCode || order.logistics?.auszug?.zip,
    order.logistics?.a_city || order.logistics?.from?.city || order.logistics?.auszug?.city
  ].filter(Boolean).join(' ');

  const addressA = rawAddressA || customerBillingAddr || '';
  const floorA = order.logistics?.a_floor || order.logistics?.from?.floor || '';

  const addressB = [
    order.logistics?.b_street || order.logistics?.to?.street || order.logistics?.einzug?.street,
    order.logistics?.b_houseNr || order.logistics?.to?.houseNumber || order.logistics?.einzug?.houseNr,
    order.logistics?.b_zip || order.logistics?.to?.postalCode || order.logistics?.einzug?.zip,
    order.logistics?.b_city || order.logistics?.to?.city || order.logistics?.einzug?.city
  ].filter(Boolean).join(' ');
  const floorB = order.logistics?.b_floor || order.logistics?.to?.floor || '';

  const targetCustomerId = (internalCustomer?.id || customer?.id || order?.customerId || '').trim();
  const customerProfileUrl = (targetCustomerId && targetCustomerId !== 'undefined')
    ? `/dashboard/customers/${targetCustomerId}`
    : `/dashboard/customers?search=${encodeURIComponent(custName)}`;
  const editOrderUrl = (targetCustomerId && targetCustomerId !== 'undefined')
    ? `/dashboard/customers/${targetCustomerId}/edit-order/${order.id}`
    : `/dashboard/orders/new?orderId=${order.id}`;
  const editInvoiceUrl = (targetCustomerId && targetCustomerId !== 'undefined')
    ? `/dashboard/customers/${targetCustomerId}/edit-invoice/${order.id}`
    : `/dashboard/orders/new?orderId=${order.id}&type=invoice`;

  // Smart Invoice Readiness Check
  const isContractSigned = Boolean(
    order.signatureOrder ||
    order.signature ||
    order.isManuallySigned ||
    order.contractSigned ||
    order.status === 'confirmed' ||
    order.status === 'completed' ||
    order.orderMeta?.signedContractScan
  );
  const hasProtocol = Boolean(
    (order.protocols && order.protocols.length > 0) ||
    order.ticketStates?.protocol ||
    order.checklistDone?.protocol ||
    order.status === 'completed'
  );
  const isReadyForInvoice = Boolean(order.invoiceNumber) || (isContractSigned && (hasProtocol || evaluation.isComplete || order.status === 'completed'));

  const handleInvoiceClick = () => {
    if (isReadyForInvoice) {
      onClose();
      router.push(editInvoiceUrl);
    } else {
      setEarlyInvoiceWarningOpen(true);
    }
  };

  // Direct Upload of Signed Contract Photo / Scan in Phase 2
  const handleDirectScanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order?.id) return;
    setIsUploadingScan(true);

    const saveScanToFirestore = async (dataUrl: string) => {
      try {
        const todayStr = new Date().toLocaleDateString('de-DE');
        const updatePayload: any = {
          'orderMeta.signedContractScan': dataUrl,
          'orderMeta.signedContractScanName': file.name,
          'orderMeta.signedContractScanDate': todayStr,
          'orderMeta.signatureMethod': 'scan_upload',
          signatureOrder: dataUrl,
          signatureOrderDateString: todayStr,
          signatureOrderPlace: order?.logistics?.a_city || 'Per Foto/Scan',
          contractSigned: true,
          isManuallySigned: true,
          signedAt: serverTimestamp(),
          'ticketStates.signature': true,
          'checklistDone.signature': true,
        };
        if (order.status !== 'completed' && !order.status?.startsWith('invoice_')) {
          updatePayload.status = 'confirmed';
        }
        await updateDoc(doc(db, 'orders', order.id), updatePayload);
        toast.success('Unterschriebenes Angebot (Foto/Scan) hochgeladen & Auftrag bestätigt!');
        if (onRefresh) onRefresh();
      } catch (err) {
        console.error('Fehler beim Hochladen des Vertrags-Scans:', err);
        toast.error('Fehler beim Speichern des Fotos/Scans');
      } finally {
        setIsUploadingScan(false);
      }
    };

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.78);
          saveScanToFirestore(compressed);
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        saveScanToFirestore(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const formatScheduleDate = (dateRaw?: string, timeRaw?: string) => {
    if (!dateRaw || dateRaw === 'requested') return '';
    if (dateRaw === 'erledigt_fotos') return 'Durch Fotos / Inventarliste erledigt ✓';
    const cleanDatePart = dateRaw.split('T')[0];
    const embeddedTime = dateRaw.includes('T') ? dateRaw.split('T')[1]?.slice(0, 5) : '';
    let formattedDate = cleanDatePart;
    try {
      const [y, m, d] = cleanDatePart.split('-');
      if (y && m && d) formattedDate = `${d}.${m}.${y}`;
    } catch {}
    const displayTime = timeRaw || embeddedTime;
    return displayTime ? `${formattedDate} (${displayTime}${displayTime.includes('Uhr') || displayTime === 'Ganztägig' ? '' : ' Uhr'})` : formattedDate;
  };

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
              <Link
                href={customerProfileUrl}
                onClick={onClose}
                className="group inline-flex items-center gap-2 text-xl font-bold font-headline text-slate-900 dark:text-white hover:text-primary dark:hover:text-primary transition-colors"
                title="Kundenakte öffnen"
              >
                <span>{custName}</span>
                <span className="w-7 h-7 rounded-lg bg-slate-200/80 dark:bg-slate-800 group-hover:bg-primary group-hover:text-white text-slate-600 dark:text-slate-300 inline-flex items-center justify-center transition-all shadow-2xs">
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                </span>
              </Link>
            </div>

            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
              title="Schließen (Esc)"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Quick Contact (Icon-Only) & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-700/60">
            {custPhone && (
              <>
                <a 
                  href={`tel:${custPhone}`}
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors"
                  title={`Anrufen: ${custPhone}`}
                >
                  <PhoneIcon className="w-4 h-4 text-emerald-600" />
                </a>

                <button 
                  type="button"
                  onClick={() => handleDirectWhatsApp()}
                  className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center transition-colors cursor-pointer"
                  title={`WhatsApp Chat öffnen (${custPhone})`}
                >
                  <ChatBubbleLeftRightIcon className="w-4 h-4 text-emerald-600" />
                </button>
              </>
            )}

            {custEmail && (
              <a 
                href={`mailto:${custEmail}`}
                className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors"
                title={`E-Mail schreiben: ${custEmail}`}
              >
                <EnvelopeIcon className="w-4 h-4 text-blue-500" />
              </a>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {/* PDF Vorschau Button next to Editor */}
              <button
                type="button"
                onClick={() => {
                  setPdfModalType('order');
                  setPdfModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Angebot / Auftrag als PDF anzeigen & herunterladen"
              >
                <DocumentTextIcon className="w-4 h-4 text-primary" />
                <span>PDF</span>
              </button>

              {/* Single Offer Editor Button in Cockpit Header */}
              <Link
                href={editOrderUrl}
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="Angebot, Umzugsliste & Kalkulation im Editor bearbeiten"
              >
                <PencilSquareIcon className="w-4 h-4" />
                <span>Angebot bearbeiten</span>
              </Link>
            </div>
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
            { phase: 1, label: '1. Anfrage', sub: 'Stammdaten & Lead' },
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
                  Phase 1: Neue Anfrage & Stammdaten-Prüfung
                </h3>
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  Alle Daten sind live mit dem Kunden- & Angebotsformular verknüpft. Prüfe die Adressen und vereinbare bei Bedarf direkt den Besichtigungstermin.
                </p>
              </div>

              {/* Data Verification Checklist */}
              <div className="panel p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-headline">
                    Stammdaten-Prüfung (Live aus Kundenformular)
                  </h4>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 gap-3">
                    <span className="text-slate-600 dark:text-slate-400 shrink-0">Telefonnummer</span>
                    {custPhone ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-right">
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" /> {custPhone}
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Fehlt
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 gap-3">
                    <span className="text-slate-600 dark:text-slate-400 shrink-0">E-Mail-Adresse</span>
                    {custEmail ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 truncate max-w-[240px]" title={custEmail}>
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{custEmail}</span>
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Fehlt
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 gap-3">
                    <span className="text-slate-600 dark:text-slate-400 shrink-0">Auszugsadresse (A)</span>
                    {addressA ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-right">
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{addressA}{floorA ? ` (${floorA})` : ''}</span>
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Nicht angegeben
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 gap-3">
                    <span className="text-slate-600 dark:text-slate-400 shrink-0">Einzugsadresse (B)</span>
                    {addressB ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-right">
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{addressB}{floorB ? ` (${floorB})` : ''}</span>
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Nicht angegeben
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 gap-3">
                    <span className="text-slate-600 dark:text-slate-400 shrink-0">Wunsch-Umzugstermin</span>
                    {order.orderMeta?.movingDateFrom || order.movingDate ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" /> {evaluation.movingDateDisplay}
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Offen
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 gap-3">
                    <span className="text-slate-600 dark:text-slate-400 shrink-0">Besichtigungstermin</span>
                    <div className="flex items-center gap-2">
                      {order.orderMeta?.viewingDate ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatScheduleDate(order.orderMeta?.viewingDate, order.orderMeta?.viewingTime)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Noch nicht geplant</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenSchedule({ id: 'viewing_requested', name: 'Besichtigung' })}
                        className="px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-white font-bold text-[11px] transition-colors"
                      >
                        Planen
                      </button>
                    </div>
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

              {/* Digital Signature & Signed Photo Upload Card */}
              {(() => {
                const isSigned = Boolean(
                  order.signatureOrder ||
                  order.signature ||
                  order.isManuallySigned ||
                  order.contractSigned ||
                  order.status === 'confirmed' ||
                  order.orderMeta?.signedContractScan
                );
                const hasUploadedScan = Boolean(order.orderMeta?.signedContractScan);
                return (
                  <div className={`panel p-4 border-2 transition-all space-y-3 ${
                    isSigned
                      ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30'
                      : 'border-primary/30'
                  }`}>
                    {/* Hidden File Input for Direct Photo/Scan Upload */}
                    <input
                      ref={scanInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleDirectScanUpload}
                      className="hidden"
                    />

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <DocumentCheckIcon className={`w-5 h-5 ${isSigned ? 'text-emerald-600' : 'text-primary'}`} />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white font-headline">
                          Vertragsbestätigung & Unterschrift
                        </h4>
                      </div>
                      {isSigned ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white flex items-center gap-1">
                          <CheckCircleIcon className="w-3.5 h-3.5" /> Bestätigt & Signiert ✓
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          Ausstehend
                        </span>
                      )}
                    </div>

                    {isSigned ? (
                      <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                            {hasUploadedScan
                              ? `Unterschriebenes Foto / Scan hinterlegt (${order.orderMeta?.signedContractScanDate || 'Bestätigt'})`
                              : order.signatureOrderPlace
                                ? `${order.signatureOrderPlace}, ${order.signatureOrderDateString}`
                                : 'Vertrag bestätigt (Phase 3 freigeschaltet)'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {hasUploadedScan
                              ? `Datei: ${order.orderMeta?.signedContractScanName || 'Unterschriebenes_Angebot.jpg'}`
                              : order.signatureOrder
                                ? 'Digitale Unterschrift im PDF eingebettet'
                                : 'Manuell bestätigt (WhatsApp / E-Mail)'}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(hasUploadedScan || order.signatureOrder) && (
                            <button
                              type="button"
                              onClick={() => setScanPreviewOpen(true)}
                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <EyeIcon className="w-3.5 h-3.5" />
                              <span>Nachweis ansehen</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => scanInputRef.current?.click()}
                            disabled={isUploadingScan}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-emerald-500/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">add_a_photo</span>
                            <span>{hasUploadedScan ? 'Foto ändern' : 'Foto/Scan anhängen'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSignatureModalOpen(true)}
                            className="px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          >
                            Signatur-Pad
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Wähle, wie der Kunde das Angebot bestätigt hat: Direkt auf dem Display unterschreiben, ein vom Kunden unterschriebenes Foto/Dokument hochladen oder manuell bestätigen.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setSignatureModalOpen(true)}
                            className="py-2.5 px-3 bg-gradient-to-r from-amber-600 to-amber-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow hover:brightness-110 transition-all font-headline cursor-pointer"
                          >
                            <PencilSquareIcon className="w-4 h-4 shrink-0" />
                            <span>Digital signieren</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => scanInputRef.current?.click()}
                            disabled={isUploadingScan}
                            className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                            title="Foto oder Scan des vom Kunden unterschriebenen Angebots hochladen"
                          >
                            <span className="material-symbols-outlined text-base">add_a_photo</span>
                            <span>{isUploadingScan ? 'Lädt...' : 'Foto / Scan hochladen'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTask('signature', 'Vertragsbestätigung')}
                            disabled={isUpdatingTask}
                            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <CheckIcon className="w-4 h-4 shrink-0" />
                            <span>Manuell bestätigen</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

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

                {order.orderMeta?.viewingDate && order.orderMeta?.viewingDate !== 'requested' ? (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                          <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                          <span>{order.orderMeta?.viewingType || 'Geplanter Besichtigungstermin'}</span>
                        </p>
                        <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 mt-0.5">
                          {formatScheduleDate(order.orderMeta?.viewingDate, order.orderMeta?.viewingTime)}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-emerald-600 text-xl">calendar_today</span>
                    </div>

                    {addressA && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between gap-2">
                        <span className="truncate flex items-center gap-1">
                          <MapPinIcon className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                          <span className="truncate">{addressA}</span>
                        </span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressA)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-emerald-200/70 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 font-bold hover:brightness-110 flex items-center gap-1 shrink-0"
                          title="In Google Maps öffnen"
                        >
                          <MapPinIcon className="w-3.5 h-3.5" />
                          <span>Navigation</span>
                        </a>
                      </div>
                    )}

                    <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center gap-2">
                      <Link
                        href={`${editOrderUrl}${editOrderUrl.includes('?') ? '&' : '?'}step=4`}
                        className="flex-1 py-2 px-3 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-110 shadow-xs"
                      >
                        <span className="material-symbols-outlined text-sm">chair</span>
                        <span>Besichtigung starten (Umzugsliste)</span>
                      </Link>
                      {custPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            const timeText = order.orderMeta?.viewingTime ? ` (${order.orderMeta.viewingTime})` : '';
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
                    <Link
                      href={`${editOrderUrl}${editOrderUrl.includes('?') ? '&' : '?'}step=4`}
                      className="w-full py-2 px-3 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">chair</span>
                      <span>Direkt zu Umzugsliste & Möbeln</span>
                    </Link>
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
                  {(() => {
                    const isKartonsDone = evaluation.checklist.find(c => c.id === 'kartons')?.done || false;
                    return (
                      <div className={`p-3.5 rounded-xl border-2 transition-all flex flex-col gap-2.5 ${
                        isKartonsDone
                          ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isKartonsDone}
                              onChange={() => handleToggleTask('kartons_liefern', 'Umzugskartons')}
                              disabled={isUpdatingTask}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <span className={`text-xs font-bold block ${isKartonsDone ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                                Umzugskartons liefern {isKartonsDone && '✓'}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {matSummary.total > 0 ? (
                                  <span className="flex items-center gap-1 flex-wrap">
                                    <CubeIcon className="w-3.5 h-3.5 text-orange-600 inline shrink-0" />
                                    <span>{matSummary.total} Kartons ({matSummary.standard > 0 ? `${matSummary.standard}x Standard` : ''}{matSummary.buecher > 0 ? `, ${matSummary.buecher}x Bücher` : ''}{matSummary.kleider > 0 ? `, ${matSummary.kleider}x Kleider` : ''})</span>
                                  </span>
                                ) : (
                                  'Materialbedarf offen'
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
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
                            Lieferung: {formatScheduleDate(order.orderMeta?.kartonDeliveryDate || order.logistics?.boxDeliveryDate, order.orderMeta?.kartonDeliveryTime || order.logistics?.boxDeliveryTime) || 'Noch nicht terminiert'}
                          </span>
                          {(order.orderMeta?.kartonDeliveryDate || order.logistics?.boxDeliveryDate) && (
                            <button
                              onClick={() => {
                                const date = formatScheduleDate(order.orderMeta?.kartonDeliveryDate || order.logistics?.boxDeliveryDate, order.orderMeta?.kartonDeliveryTime || order.logistics?.boxDeliveryTime);
                                handleDirectWhatsApp(`Guten Tag, Ihre Umzugskartons werden am ${date} geliefert.`);
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
                    );
                  })()}

                  {/* Task: Halteverbot (HVZ) */}
                  {(() => {
                    const isHvzDone = evaluation.checklist.find(c => c.id === 'hvz')?.done || false;
                    const resolvedHvzMethod = order.orderMeta?.hvzMethod || order.logistics?.hvzMethod || 'selbst';
                    const resolvedHvzLoc = order.orderMeta?.hvzLocation || order.logistics?.hvzLocation || 
                      (order.logistics?.a_parking && order.logistics?.b_parking ? 'both' : order.logistics?.b_parking ? 'b' : 'a');
                    return (
                      <div className={`p-3.5 rounded-xl border-2 transition-all flex flex-col gap-2.5 ${
                        isHvzDone
                          ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isHvzDone}
                              onChange={() => handleToggleTask('halteverbot', 'Halteverbotszone')}
                              disabled={isUpdatingTask}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <span className={`text-xs font-bold block ${isHvzDone ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                                Halteverbotszone (HVZ) {isHvzDone && '✓'}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                  {resolvedHvzMethod === 'extern' ? (
                                    <>
                                      <BuildingOfficeIcon className="w-3 h-3 text-slate-500" />
                                      <span>Externe Firma</span>
                                    </>
                                  ) : (
                                    <>
                                      <TruckIcon className="w-3 h-3 text-primary" />
                                      <span>Selbst aufstellen</span>
                                    </>
                                  )}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                                  {resolvedHvzLoc === 'b' ? (
                                    <>
                                      <HomeIcon className="w-3 h-3" />
                                      <span>Einzugsort (B)</span>
                                    </>
                                  ) : resolvedHvzLoc === 'both' ? (
                                    <>
                                      <ArrowPathIcon className="w-3 h-3" />
                                      <span>Beide Orte (A & B)</span>
                                    </>
                                  ) : (
                                    <>
                                      <BuildingOfficeIcon className="w-3 h-3" />
                                      <span>Auszugsort (A)</span>
                                    </>
                                  )}
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
                          <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate flex items-center gap-1">
                            <MapPinIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">{resolvedHvzLoc === 'b' ? (addressB || 'Einzugsadresse') : (addressA || 'Auszugsadresse')}</span>
                          </span>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(resolvedHvzLoc === 'b' ? addressB : addressA)}`}
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
                            Aufbau: {formatScheduleDate(order.orderMeta?.halteverbotDate || order.logistics?.hvzDate, order.orderMeta?.halteverbotTime || order.logistics?.hvzTime) || 'Noch nicht terminiert'}
                          </span>
                          {(order.orderMeta?.halteverbotDate || order.logistics?.hvzDate) && (
                            <button
                              onClick={() => {
                                const date = formatScheduleDate(order.orderMeta?.halteverbotDate || order.logistics?.hvzDate, order.orderMeta?.halteverbotTime || order.logistics?.hvzTime);
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
                    );
                  })()}

                  {/* Task: Möbellift */}
                  {(() => {
                    const isLiftDone = evaluation.checklist.find(c => c.id === 'lift')?.done || false;
                    const resolvedLiftLoc = order.orderMeta?.moebelliftLocation || order.logistics?.moebelliftLocation || (order.logistics?.b_furnitureLift && !order.logistics?.a_furnitureLift ? 'b' : 'a');
                    return (
                      <div className={`p-3.5 rounded-xl border-2 transition-all flex flex-col gap-2.5 ${
                        isLiftDone
                          ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isLiftDone}
                              onChange={() => handleToggleTask('moebellift_buchen', 'Möbellift')}
                              disabled={isUpdatingTask}
                              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            />
                            <div>
                              <span className={`text-xs font-bold block ${isLiftDone ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                                Möbellift disponieren {isLiftDone && '✓'}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                {resolvedLiftLoc === 'b' ? (
                                  <>
                                    <HomeIcon className="w-3 h-3" />
                                    <span>Einzugsort (B)</span>
                                  </>
                                ) : (
                                  <>
                                    <BuildingOfficeIcon className="w-3 h-3" />
                                    <span>Auszugsort (A)</span>
                                  </>
                                )}
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
                                Geplant: <strong className="text-slate-900 dark:text-white">{formatScheduleDate(order.orderMeta.moebelliftDate)}</strong>
                                {order.orderMeta?.moebelliftTime && ` • ${order.orderMeta.moebelliftTime} - ${order.orderMeta.moebelliftEndTime || ''} Uhr (${order.orderMeta.moebelliftDuration || '3'} Std.)`}
                              </>
                            ) : (
                              'Bedarfsprüfung ausstehend'
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
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
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-500 flex flex-col items-center text-center gap-2 shadow-sm transition-all group relative cursor-pointer"
                >
                  <DocumentCheckIcon className="w-8 h-8 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Abnahmeprotokoll</span>
                    {order.protocols && order.protocols.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                        {order.protocols.length}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {order.protocols && order.protocols.length > 0 
                      ? `${order.protocols.length} Protokoll(e) hinterlegt - Klicken zum Verwalten` 
                      : 'Schäden erfassen & digital unterschreiben'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleInvoiceClick}
                  className={`p-4 rounded-2xl flex flex-col items-center text-center gap-2 shadow-sm transition-all group font-headline cursor-pointer ${
                    isReadyForInvoice
                      ? 'bg-[#D91E2A] text-white hover:bg-[#b51822] shadow-md'
                      : 'bg-slate-200 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">
                    receipt_long
                  </span>
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <span>{order.invoiceNumber ? `Rechnung (${order.invoiceNumber}) bearbeiten` : 'Rechnung erstellen'}</span>
                    {!isReadyForInvoice && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Vorzeitig
                      </span>
                    )}
                  </span>
                  <span className={`text-[10px] ${isReadyForInvoice ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isReadyForInvoice
                      ? '1-Klick Abrechnung mit allen Leistungen'
                      : 'Auftrag noch offen – Klicken für vorzeitige Erstellung'}
                  </span>
                </button>
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

      {signatureModalOpen && (
        <SignatureModal
          order={order}
          onClose={() => setSignatureModalOpen(false)}
          onSigned={async () => {
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
          customer={internalCustomer}
          defaultTemplateName={defaultTemplateName}
          onClose={() => setMessageModalOpen(false)}
        />
      )}

      {pdfModalOpen && (
        <PdfModal
          order={order}
          customer={internalCustomer || order.billingAddress || { firstName: custName, lastName: '' }}
          type={pdfModalType}
          onClose={() => setPdfModalOpen(false)}
        />
      )}

      {/* Smart Warning Modal when clicking gray "Rechnung erstellen" before contract/move is finished */}
      {earlyInvoiceWarningOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold font-headline text-slate-900 dark:text-white">
                  Rechnung vorzeitig erstellen?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  Möchten Sie wirklich eine Rechnung erstellen, obwohl der Vertrag bzw. die vorherigen Aufgaben noch nicht vollständig abgeschlossen sind?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1.5 text-xs">
              <p className="font-bold text-amber-900 dark:text-amber-300">Noch offene Punkte:</p>
              {!isContractSigned && (
                <p className="text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                  <span>•</span>
                  <span>Vertragsbestätigung / Kundenunterschrift fehlt noch (Phase 2)</span>
                </p>
              )}
              {!evaluation.isComplete && (
                <p className="text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                  <span>•</span>
                  <span>Operative Logistik-Aufgaben noch nicht alle erledigt (Phase 3)</span>
                </p>
              )}
              {!hasProtocol && (
                <p className="text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                  <span>•</span>
                  <span>Übergabe- / Abnahmeprotokoll wurde noch nicht hinterlegt (Phase 4)</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEarlyInvoiceWarningOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  setEarlyInvoiceWarningOpen(false);
                  onClose();
                  router.push(editInvoiceUrl);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#D91E2A] hover:bg-[#b51822] text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                Trotzdem Rechnung erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal to view uploaded signed contract photo/scan or digital signature */}
      {scanPreviewOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold font-headline text-slate-900 dark:text-white">
                  Unterschriebener Vertragsnachweis ({orderNum})
                </h3>
                <p className="text-[11px] text-slate-500">
                  {order.orderMeta?.signedContractScanName || 'Gespeicherte Kundenunterschrift / Scan'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScanPreviewOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[65vh] overflow-auto flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
              {(order.orderMeta?.signedContractScan || order.signatureOrder) ? (
                <img
                  src={order.orderMeta?.signedContractScan || order.signatureOrder}
                  alt="Unterschriebener Nachweis"
                  className="max-h-[58vh] object-contain rounded-xl bg-white shadow-sm"
                />
              ) : (
                <p className="text-xs text-slate-500">Kein Bild vorhanden.</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setScanPreviewOpen(false);
                  scanInputRef.current?.click();
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Neues Foto / Scan hochladen
              </button>
              <button
                type="button"
                onClick={() => setScanPreviewOpen(false)}
                className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
