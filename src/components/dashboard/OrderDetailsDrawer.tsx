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
import { hasFixedService } from '@/lib/serviceKeys';
import { getActiveInvoiceNumber, isInvoiceCancelled, getLatestCancelledInvoiceNumber } from '@/lib/financeHelpers';
import { toggleTaskCompletion, isTaskCompleted } from '@/lib/taskStateController';
import { TaskScheduleModal } from '@/components/logistics/TaskScheduleModal';
import { SignatureModal } from '@/components/orders/SignatureModal';
import { ProtocolModal } from '@/components/customers/ProtocolModal';
import { MessageSenderModal } from '@/components/customers/MessageSenderModal';
import { PdfModal } from '@/components/ui/PdfModal';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';
import { modalManager } from '@/lib/modalManager';

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

  // Close drawer gracefully on mobile back button / swipe gesture
  useModalBackHandler(Boolean(initialOrder), onClose, 'order-drawer');

  // Sync when switching to a different order ID (keep live onSnapshot as single source of truth for current order)
  useEffect(() => {
    if (initialOrder?.id && initialOrder.id !== order?.id) {
      setOrder(initialOrder);
    }
  }, [initialOrder?.id]);

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
    if ((st === 'completed' || st === 'invoice_open' || st === 'invoice_paid' || st === 'archived') && !isInvoiceCancelled(ord)) return 4;
    if (st === 'confirmed' || ord?.isManuallySigned || ord?.contractSigned || ord?.signatureOrder || ord?.orderMeta?.signedContractScan || getLatestCancelledInvoiceNumber(ord)) return 3;
    if (st === 'quote' || st === 'verhandlung' || Boolean(ord?.orderMeta?.viewingDate || ord?.viewingDate)) return 2;
    return 1;
  };

  const isOrderPricedAndServiced = (ord: any): boolean => {
    if (!ord) return false;
    if (ord.isFlatRate && Number(ord.flatRateNet) > 0) return true;
    if (Array.isArray(ord.services) && ord.services.length > 0) {
      const hasAnyPrice = ord.services.some((s: any) => (Number(s.quantity) || 0) * (Number(s.unitPrice) || 0) > 0);
      if (hasAnyPrice) return true;
      if (ord.services.some((s: any) => s.name?.trim())) return true;
    }
    if (ord.totals && (Number(ord.totals.gross) > 0 || Number(ord.totals.net) > 0)) {
      return true;
    }
    return false;
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
  const [editingDispoInline, setEditingDispoInline] = useState(false);
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
  const isMoveDateInFuture = (() => {
    const rawMoveDate = order.orderMeta?.movingDateFrom || order.movingDate || order.logistics?.movingDate;
    if (!rawMoveDate) return false;
    const d = new Date(rawMoveDate);
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    return d.getTime() > today.getTime();
  })();
  const activeInvNum = getActiveInvoiceNumber(order);
  const latestCancelledInvNum = getLatestCancelledInvoiceNumber(order);
  const isReadyForInvoice = Boolean(activeInvNum || latestCancelledInvNum) || (isContractSigned && !isMoveDateInFuture && (hasProtocol || order.status === 'completed'));

  const handleNavigate = (url: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    modalManager.prepareNavigation();
    router.replace(url);
    onClose();
  };

  const handleInvoiceClick = () => {
    if (activeInvNum) {
      setPdfModalType('invoice');
      setPdfModalOpen(true);
      return;
    }

    if (isReadyForInvoice) {
      handleNavigate(editInvoiceUrl);
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

  // Handle task toggling via state controller with immediate optimistic local update
  const handleToggleTask = async (taskId: string, label: string) => {
    if (isUpdatingTask) return;
    setIsUpdatingTask(true);
    try {
      const res = await toggleTaskCompletion(order, taskId);
      const nextDone = res.newState;
      setOrder((prev: any) => {
        if (!prev) return prev;
        const nextTicketStates = { ...(prev.ticketStates || {}) };
        const nextChecklistDone = { ...(prev.checklistDone || {}) };
        const nextLogistics = { ...(prev.logistics || {}) };
        if (taskId === 'moebellift_buchen' || taskId === 'moebellift') {
          nextTicketStates.moebellift_buchen = nextDone;
          nextChecklistDone.moebellift = nextDone;
          nextChecklistDone.moebellift_buchen = nextDone;
          nextLogistics.liftReserved = nextDone;
          nextLogistics.liftStatus = nextDone ? 'confirmed' : 'pending';
        } else if (taskId === 'halteverbot' || taskId === 'hvz') {
          nextTicketStates.halteverbot = nextDone;
          nextChecklistDone.hvz = nextDone;
          nextChecklistDone.halteverbot = nextDone;
          nextLogistics.hvzConfirmed = nextDone;
          nextLogistics.hvzStatus = nextDone ? 'confirmed' : 'pending';
        } else if (taskId === 'kartons_liefern' || taskId === 'kartons') {
          nextTicketStates.kartons_liefern = nextDone;
          nextChecklistDone.kartons = nextDone;
          nextChecklistDone.kartons_liefern = nextDone;
          nextLogistics.boxesDelivered = nextDone;
        } else if (taskId === 'team' || taskId === 'team_assigned') {
          nextTicketStates.team = nextDone;
          nextChecklistDone.team = nextDone;
          (nextChecklistDone as any).team_assigned = nextDone;
        } else {
          nextTicketStates[taskId] = nextDone;
          nextChecklistDone[taskId] = nextDone;
        }
        return {
          ...prev,
          ticketStates: nextTicketStates,
          checklistDone: nextChecklistDone,
          logistics: nextLogistics,
          teamAssigned: taskId === 'team' ? nextDone : prev.teamAssigned,
        };
      });
      toast.success(nextDone ? `${label} als erledigt markiert ✓` : `${label} wiedereröffnet`);
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
      toast.error('Fehler beim Aktualisieren der Aufgabe');
    } finally {
      setIsUpdatingTask(false);
    }
  };

  // Direct inline disposition update for team and vehicles
  const handleUpdateInlineDispo = async (field: 'helpers' | 'koffer35t' | 'lkw7t', val: number) => {
    if (!order?.id) return;
    try {
      const prevDispo = order.disposition || {};
      const nextDispo = {
        ...prevDispo,
        [field]: val,
        movingDateStr: prevDispo.movingDateStr || order.orderMeta?.movingDateFrom || order.movingDate || '',
        movingTimeStr: prevDispo.movingTimeStr || order.orderMeta?.movingTimeFrom || '08:00'
      };
      const hasAny = (Number(nextDispo.helpers) || 0) > 0 || (Number(nextDispo.koffer35t) || 0) > 0 || (Number(nextDispo.lkw7t) || 0) > 0;

      const updates: any = {
        disposition: nextDispo,
        'checklistDone.team': hasAny,
        teamAssigned: hasAny,
        'ticketStates.team': hasAny,
      };

      await updateDoc(doc(db, 'orders', order.id), updates);
      setOrder((prev: any) => ({
        ...prev,
        disposition: nextDispo,
        checklistDone: { ...(prev?.checklistDone || {}), team: hasAny },
        teamAssigned: hasAny,
        ticketStates: { ...(prev?.ticketStates || {}), team: hasAny },
      }));
      toast.success('Ressourcen aktualisiert ✓');
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error('Fehler beim Aktualisieren der Disposition:', e);
      toast.error('Fehler beim Aktualisieren der Disposition');
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
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      {/* Click outside backdrop to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Container */}
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 z-10 animate-in slide-in-from-right duration-300">
        
        {/* Top Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          {/* Mobile Handle Bar */}
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-3 sm:hidden" />
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
                onClick={(e) => handleNavigate(customerProfileUrl, e)}
                className="group inline-flex items-center gap-2 text-xl font-bold font-headline text-slate-900 dark:text-white hover:text-primary dark:hover:text-primary transition-colors cursor-pointer select-none active:opacity-75 p-1 -m-1 rounded-lg"
                title="Kundenakte öffnen"
              >
                <span className="hover:underline underline-offset-4 decoration-primary">{custName}</span>
                <span className="w-7 h-7 rounded-lg bg-slate-200/80 dark:bg-slate-800 group-hover:bg-primary group-hover:text-white text-slate-600 dark:text-slate-300 inline-flex items-center justify-center transition-all shadow-2xs shrink-0">
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

          {/* Quick Contact & Action Buttons: Compact Single Row */}
          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-700/60 overflow-x-auto scrollbar-none">
            {custPhone && (
              <>
                <a 
                  href={`tel:${custPhone}`}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center transition-colors shrink-0"
                  title={`Anrufen: ${custPhone}`}
                >
                  <PhoneIcon className="w-3.5 h-3.5 text-emerald-600" />
                </a>

                <button 
                  type="button"
                  onClick={() => handleDirectWhatsApp()}
                  className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  title={`WhatsApp Chat öffnen (${custPhone})`}
                >
                  <ChatBubbleLeftRightIcon className="w-3.5 h-3.5 text-emerald-600" />
                </button>
              </>
            )}

            {custEmail && (
              <a 
                href={`mailto:${custEmail}`}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-colors shrink-0"
                title={`E-Mail schreiben: ${custEmail}`}
              >
                <EnvelopeIcon className="w-3.5 h-3.5 text-blue-500" />
              </a>
            )}

            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {/* PDF Vorschau Button next to Editor */}
              {(() => {
                const hasContent = isOrderPricedAndServiced(order);
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasContent) {
                        toast('Hinweis: Dieses Angebot enthält noch keine Leistungen oder Preise (0,00 €).', {
                          icon: '⚠️',
                          duration: 4000
                        });
                      }
                      setPdfModalType('order');
                      setPdfModalOpen(true);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0 ${
                      !hasContent
                        ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-300/70 dark:border-slate-700/60 hover:border-amber-500/50'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                    }`}
                    title={!hasContent ? "Angebot enthält noch keine Leistungen oder Preise (0,00 €)" : "Angebot / Auftrag als PDF anzeigen & herunterladen"}
                  >
                    <DocumentTextIcon className={`w-3.5 h-3.5 ${!hasContent ? 'text-slate-400' : 'text-primary'}`} />
                    <span>PDF</span>
                    {!hasContent && (
                      <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 py-0.2 rounded font-normal border border-amber-500/30">
                        0 €
                      </span>
                    )}
                  </button>
                );
              })()}

              {/* Single Offer Editor Button in Cockpit Header */}
              <Link
                href={editOrderUrl}
                onClick={(e) => handleNavigate(editOrderUrl, e)}
                className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer select-none active:scale-95 shrink-0"
                title="Angebot, Umzugsliste & Kalkulation im Editor bearbeiten"
              >
                <PencilSquareIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Angebot </span><span>Bearbeiten</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Main Scrollable Viewport with Natural Sticky Header */}
        <div className="flex-1 overflow-y-auto min-h-0 relative">

          {/* 1. Route, Moving Date & Metric Pills (Scrolls away naturally to maximize screen) */}
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold mb-0.5">
                  <MapPinIcon className="w-3 h-3 text-primary" />
                  <span>Route</span>
                </div>
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {evaluation.routeDisplay}
                </p>
              </div>
              {(addressA || addressB) && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressA || addressB)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                  title="Navigation in Google Maps starten"
                >
                  <MapPinIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Navi</span>
                </a>
              )}
            </div>

            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold mb-0.5">
                <CalendarDaysIcon className="w-3 h-3 text-primary" />
                <span>Umzugstermin</span>
              </div>
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {evaluation.movingDateDisplay}
              </p>
            </div>

            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1 flex items-center justify-between sm:block">
              <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-bold mb-0.5">
                <CurrencyEuroIcon className="w-3 h-3 text-emerald-500" />
                <span>Summe</span>
              </div>
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {order.totals?.gross ? `${order.totals.gross.toFixed(2)} €` : '0,00 €'}
              </p>
            </div>
          </div>

          {/* 2. Phase Navigation Stepper Tabs (Sticky at top when scrolling!) */}
          <div className="sticky top-0 z-20 flex items-center border-b border-slate-200 dark:border-slate-800 px-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md overflow-x-auto scrollbar-none shadow-xs">
            {[
              { phase: 1, label: '1. Anfrage', sub: 'Stammdaten & Lead' },
              { phase: 2, label: '2. Verhandlung', sub: 'Besichtigung & Sign' },
              { phase: 3, label: '3. Bestätigt', sub: 'Logistik & Termine' },
              { phase: 4, label: '4. Abschluss', sub: 'Protokoll & Rechnung' },
            ].map(tab => {
              const isActive = activePhaseTab === tab.phase;
              const isCurrent = currentOrderPhase === tab.phase;
              const hasContact = Boolean(custPhone?.trim() || custEmail?.trim());
              const isPastPhase = tab.phase < currentOrderPhase;
              const isPhase1Incomplete = tab.phase === 1 && !hasContact;
              const isCompletedPhase = isPastPhase && !isPhase1Incomplete;
              const showWarning = isPastPhase && isPhase1Incomplete;

              return (
                <button
                  key={tab.phase}
                  onClick={() => setActivePhaseTab(tab.phase)}
                  className={`text-xs font-bold font-headline whitespace-nowrap border-b-2 transition-all flex flex-col items-center relative py-2 px-3 sm:py-2.5 sm:px-4 cursor-pointer ${
                    isActive 
                      ? 'border-primary text-primary' 
                      : showWarning
                        ? 'border-transparent text-amber-600 dark:text-amber-400 hover:text-amber-700'
                        : isCompletedPhase
                          ? 'border-transparent text-emerald-600 dark:text-emerald-400 hover:text-emerald-700'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{tab.label}</span>
                    {showWarning && (
                      <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Phase unvollständig: Telefon oder E-Mail fehlt" />
                    )}
                    {isCompletedPhase && (
                      <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" title="Phase abgeschlossen" />
                    )}
                    {isCurrent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Aktuelle Phase des Auftrags" />
                    )}
                  </div>
                  <span className="text-[10px] font-normal opacity-75">{tab.sub}</span>
                </button>
              );
            })}
          </div>

          {/* 3. Phase Specific Content Area */}
          <div className="p-4 sm:p-5 space-y-6">

          {/* ========================================================================= */}
          {/* PHASE 1: NEU / LEAD-QUALIFIZIERUNG */}
          {/* ========================================================================= */}
          {activePhaseTab === 1 && (
            <div className="space-y-6">
              {/* Context-aware alert only when critical contact data is completely missing */}
              {(!custPhone && !custEmail) && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-700 dark:text-amber-400">
                  <span className="material-symbols-outlined text-lg shrink-0">priority_high</span>
                  <span>
                    <strong>Unvollständige Kontaktdaten:</strong> Weder Telefonnummer noch E-Mail-Adresse für {custName} hinterlegt. Bitte mindestens eine Kontaktmöglichkeit erfassen.
                  </span>
                </div>
              )}

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
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-right truncate">
                          <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{addressA}{floorA ? ` (${floorA})` : ''}</span>
                        </span>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressA)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                          title="Navigation mit Google Maps starten"
                        >
                          <MapPinIcon className="w-3 h-3" />
                          <span>Navi</span>
                        </a>
                      </div>
                    ) : (
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Nicht angegeben
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 gap-3">
                    <span className="text-slate-600 dark:text-slate-400 shrink-0">Einzugsadresse (B)</span>
                    {addressB ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-right truncate">
                          <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{addressB}{floorB ? ` (${floorB})` : ''}</span>
                        </span>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressB)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors"
                          title="Navigation mit Google Maps starten"
                        >
                          <MapPinIcon className="w-3 h-3" />
                          <span>Navi</span>
                        </a>
                      </div>
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
                    onClick={() => handleOpenMessage('t1')}
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
                    onClick={() => handleOpenMessage('t2')}
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
              {/* Digital Signature & Signed Photo Upload - Compact Executive Row */}
              {(() => {
                const isSigned = Boolean(
                  currentOrderPhase >= 3 ||
                  order.signatureOrder ||
                  order.signature ||
                  order.isManuallySigned ||
                  order.contractSigned ||
                  order.status === 'confirmed' ||
                  order.orderMeta?.signedContractScan
                );
                const hasUploadedScan = Boolean(order.orderMeta?.signedContractScan);
                const isDraftWithoutOffer = !isSigned && (order.status === 'draft' || !Array.isArray(order.services) || order.services.length === 0);

                // Hidden File Input for Direct Photo/Scan Upload
                const hiddenFileInput = (
                  <input
                    ref={scanInputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleDirectScanUpload}
                    className="hidden"
                  />
                );

                if (isDraftWithoutOffer) {
                  return (
                    <div className="panel p-3 border border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                      {hiddenFileInput}
                      <div className="flex items-center gap-2 min-w-0">
                        <DocumentCheckIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                            Vertragsbestätigung
                          </span>
                          <span className="text-[11px] text-amber-700 dark:text-amber-400 block truncate">
                            Noch im Entwurf – bitte zuerst Angebot erstellen.
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`${editOrderUrl}${editOrderUrl.includes('?') ? '&' : '?'}step=3`}
                        className="py-1.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-xs shrink-0"
                      >
                        Angebot bearbeiten
                      </Link>
                    </div>
                  );
                }

                if (isSigned) {
                  return (
                    <div className="panel p-3 border-2 border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/30 rounded-xl flex items-center justify-between gap-2 flex-wrap">
                      {hiddenFileInput}
                      <div className="flex items-center gap-2 min-w-0">
                        <DocumentCheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 block truncate">
                            Vertrag bestätigt ✓
                          </span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block truncate">
                            {hasUploadedScan
                              ? `Scan: ${order.orderMeta?.signedContractScanName || 'Angebot.jpg'}`
                              : order.signatureOrder
                                ? 'Digital signiert'
                                : 'Manuell bestätigt'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {(hasUploadedScan || order.signatureOrder) && (
                          <button
                            type="button"
                            onClick={() => setScanPreviewOpen(true)}
                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1 cursor-pointer"
                            title="Unterschrift oder Scan ansehen"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                            <span>Nachweis</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => scanInputRef.current?.click()}
                          disabled={isUploadingScan}
                          className="px-2 py-1 text-xs font-bold rounded-lg border border-emerald-500/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Foto oder Scan anhängen / ändern"
                        >
                          <span className="material-symbols-outlined text-sm">add_a_photo</span>
                          <span>{hasUploadedScan ? 'Ändern' : 'Scan'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSignatureModalOpen(true)}
                          className="px-2 py-1 text-xs font-bold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Signatur-Pad öffnen"
                        >
                          Pad
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="panel p-3 border border-primary/30 rounded-xl flex items-center justify-between gap-2 flex-wrap">
                    {hiddenFileInput}
                    <div className="flex items-center gap-2">
                      <DocumentCheckIcon className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          Vertragsbestätigung
                        </span>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold block">
                          Ausstehend
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSignatureModalOpen(true)}
                        className="py-1.5 px-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:brightness-110 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer font-headline"
                        title="Digital auf dem Touch-Display signieren"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                        <span>Signieren</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => scanInputRef.current?.click()}
                        disabled={isUploadingScan}
                        className="py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                        title="Foto oder Scan des vom Kunden unterschriebenen Angebots hochladen"
                      >
                        <span className="material-symbols-outlined text-sm">add_a_photo</span>
                        <span>{isUploadingScan ? '...' : 'Foto/Scan'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleTask('signature', 'Vertragsbestätigung')}
                        disabled={isUpdatingTask}
                        className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                        title="Manuell bestätigen (z.B. per WhatsApp oder E-Mail)"
                      >
                        <CheckIcon className="w-3.5 h-3.5" />
                        <span>Manuell</span>
                      </button>
                    </div>
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

                    <div className="pt-2 border-t border-[#6E8F64]/25 flex items-center gap-2">
                      <Link
                        href={`${editOrderUrl}${editOrderUrl.includes('?') ? '&' : '?'}step=4`}
                        className="flex-1 py-2 px-3 rounded-xl bg-[#6E8F64] hover:bg-[#5C7A53] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">chair</span>
                        <span>Inventar erfassen (m³)</span>
                      </Link>
                      {custPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            const timeText = order.orderMeta?.viewingTime ? ` (${order.orderMeta.viewingTime})` : '';
                            handleDirectWhatsApp(`Hallo ${custName}, ich bin pünktlich auf dem Weg zu Ihnen für unseren Besichtigungstermin${timeText}. Bis gleich!`);
                          }}
                          className="px-3 py-2 rounded-xl bg-[#6E8F64]/15 text-[#435E3A] dark:text-[#B5D1AC] hover:bg-[#6E8F64] hover:text-white border border-[#6E8F64]/35 text-xs font-bold flex items-center gap-1 transition-colors"
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
                      className="w-full py-2 px-3 rounded-xl bg-[#6E8F64] hover:bg-[#5C7A53] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                    >
                      <span className="material-symbols-outlined text-sm">chair</span>
                      <span>Inventar erfassen (m³)</span>
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
                    onClick={() => handleOpenMessage('t3')}
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
                    onClick={() => handleOpenMessage('t4')}
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
                    onClick={() => handleOpenMessage('t5')}
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
                    onClick={() => handleOpenMessage('t6')}
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
          {activePhaseTab === 3 && (() => {
            const isKartonsDone = isTaskCompleted(order, 'kartons');
            const isHvzDone = isTaskCompleted(order, 'hvz');
            const isLiftDone = isTaskCompleted(order, 'moebellift');

            const hasExplicitKartonService = hasFixedService(order.services, 'kartons');
            const needsKartons = Boolean(
              hasExplicitKartonService ||
              matSummary.total > 0 ||
              order.logistics?.boxDeliveryDate ||
              order.orderMeta?.kartonDeliveryDate ||
              isKartonsDone
            );
            const hasHVZService = hasFixedService(order.services, 'hvz');
            const needsHvz = Boolean(
              order.logistics?.a_parking ||
              order.logistics?.b_parking ||
              order.logistics?.needHVZ ||
              hasHVZService ||
              order.services?.halteverbot ||
              order.logistics?.hvzDate ||
              order.orderMeta?.halteverbotDate ||
              isHvzDone
            );
            const hasLiftService = hasFixedService(order.services, 'moebellift');
            const needsLift = Boolean(
              order.logistics?.a_furnitureLift ||
              order.logistics?.b_furnitureLift ||
              order.logistics?.needLift ||
              hasLiftService ||
              order.services?.moebellift ||
              order.orderMeta?.moebelliftDate ||
              order.logistics?.moebelliftDate ||
              isLiftDone
            );

            const isTeamDone = isTaskCompleted(order, 'team');

            const showKartons = needsKartons;
            const showHvz = needsHvz;
            const showLift = needsLift;

            const isPhase3Ready =
              (!showKartons || isKartonsDone) &&
              (!showHvz || isHvzDone) &&
              (!showLift || isLiftDone) &&
              isTeamDone;

            return (
            <div className="space-y-6">
              {/* Context-aware alert only when booked logistics tasks are actually open */}
              {!isPhase3Ready && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <span className="material-symbols-outlined text-base shrink-0">priority_high</span>
                  <span>
                    <strong>Offene Logistik:</strong> Bitte Team/LKW-Disposition sowie Termine für gebuchte Zusatzleistungen bestätigen.
                  </span>
                </div>
              )}

              {/* Task Cards */}
              <div className="panel p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-headline">
                    Logistik- &amp; Dispositions-Aufgaben
                  </h4>
                </div>

                <div className="space-y-3">
                  {!showKartons && !showHvz && !showLift && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-0.5">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Keine Zusatz-Aufgaben im Angebot enthalten
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Keine Kartonlieferung, HVZ oder Möbellift gebucht. Für diesen Umzug ist lediglich die Fahrzeug- &amp; Team-Einteilung erforderlich.
                      </p>
                    </div>
                  )}
                    {/* Task: Kartons */}
                    {showKartons && (
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
                                  'Kartonlieferung gebucht'
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
                    )}

                    {/* Task: Halteverbot (HVZ) */}
                    {showHvz && (() => {
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
                    {showLift && (() => {
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
                                'Termin noch nicht festgelegt'
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Task: Fahrzeug- & Team-Disposition */}
                    {(() => {
                      const dispo = order.disposition || {};
                      const helperCount = dispo.helpers !== undefined ? Number(dispo.helpers) : 0;
                      const kofferCount = dispo.koffer35t !== undefined ? Number(dispo.koffer35t) : 0;
                      const lkwCount = dispo.lkw7t !== undefined ? Number(dispo.lkw7t) : 0;
                      const hasAssignedStaff = Array.isArray(order.assignedEmployees) && order.assignedEmployees.length > 0;
                      const hasResourceData = helperCount > 0 || kofferCount > 0 || lkwCount > 0 || hasAssignedStaff;

                      return (
                        <div className={`p-3.5 rounded-xl border-2 transition-all flex flex-col gap-2.5 ${
                          isTeamDone
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/40 border-emerald-500 shadow-xs'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={isTeamDone}
                                onChange={() => handleToggleTask('team', 'Fahrzeug & Team')}
                                disabled={isUpdatingTask}
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              />
                              <div>
                                <span className={`text-xs font-bold block ${isTeamDone ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-900 dark:text-white'}`}>
                                  Fahrzeug &amp; Team disponieren {isTeamDone && '✓'}
                                </span>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {hasResourceData ? (
                                    <>
                                      {helperCount > 0 && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                                          <UserIcon className="w-3 h-3" />
                                          <span>{helperCount} Helfer</span>
                                        </span>
                                      )}
                                      {kofferCount > 0 && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                          <TruckIcon className="w-3 h-3 text-primary" />
                                          <span>{kofferCount}x 3,5t LKW</span>
                                        </span>
                                      )}
                                      {lkwCount > 0 && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1">
                                          <TruckIcon className="w-3 h-3 text-amber-500" />
                                          <span>{lkwCount}x 7,5t LKW</span>
                                        </span>
                                      )}
                                      {hasAssignedStaff && (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                          <span>{order.assignedEmployees.length} Mitarbeiter</span>
                                        </span>
                                      )}
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-slate-400">
                                      Noch kein Fahrzeug oder Personal festgelegt
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setEditingDispoInline(prev => !prev)}
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <PencilSquareIcon className="w-3.5 h-3.5" />
                              <span>{editingDispoInline ? 'Schließen' : 'Einteilen'}</span>
                            </button>
                          </div>

                          {/* Inline Resource Editor */}
                          {editingDispoInline && (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-3">
                              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                Personal &amp; Fahrzeuge für diesen Umzug festlegen:
                              </p>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col gap-1 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <label className="text-[10px] font-medium text-slate-500">Helfer / Träger</label>
                                  <div className="flex items-center justify-between">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateInlineDispo('helpers', Math.max(0, helperCount - 1))}
                                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center cursor-pointer"
                                    >-</button>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">{helperCount}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateInlineDispo('helpers', helperCount + 1)}
                                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center cursor-pointer"
                                    >+</button>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <label className="text-[10px] font-medium text-slate-500">3,5t LKW</label>
                                  <div className="flex items-center justify-between">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateInlineDispo('koffer35t', Math.max(0, kofferCount - 1))}
                                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center cursor-pointer"
                                    >-</button>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">{kofferCount}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateInlineDispo('koffer35t', kofferCount + 1)}
                                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center cursor-pointer"
                                    >+</button>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                  <label className="text-[10px] font-medium text-slate-500">7,5t LKW</label>
                                  <div className="flex items-center justify-between">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateInlineDispo('lkw7t', Math.max(0, lkwCount - 1))}
                                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center cursor-pointer"
                                    >-</button>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">{lkwCount}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateInlineDispo('lkw7t', lkwCount + 1)}
                                      className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-700 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center cursor-pointer"
                                    >+</button>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
                                <span className="text-[10px] text-slate-400">
                                  Wird direkt gespeichert &amp; als disponiert markiert
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditingDispoInline(false)}
                                  className="px-2.5 py-1 rounded-lg bg-[#6E8F64] text-white text-[10px] font-bold hover:bg-[#5C7A53] transition-colors cursor-pointer"
                                >
                                  Fertig ✓
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-700">
                            <span>
                              {order.orderMeta?.movingDateFrom ? (
                                <>
                                  Umzugstermin: <strong className="text-slate-900 dark:text-white">{formatScheduleDate(order.orderMeta.movingDateFrom)}</strong>
                                  {order.orderMeta?.movingTimeFrom && ` • ab ${order.orderMeta.movingTimeFrom} Uhr`}
                                </>
                              ) : (
                                'Kein Umzugstermin im Angebot angegeben'
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                {/* Direct jump to Offer Editor Step 3 (Leistungen) to add unbooked services into the Angebot */}
                {(!showKartons || !showHvz || !showLift) && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
                      Im Angebot ergänzen (Schritt 3):
                    </span>
                    {!showKartons && (
                      <Link
                        href={`${editOrderUrl}${editOrderUrl.includes('?') ? '&' : '?'}step=3&unlock=true&q=Karton`}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-slate-600 dark:text-slate-300 text-[11px] font-bold transition-colors flex items-center gap-1"
                        title="Öffnet das Angebot direkt bei '3. Leistungen', um Kartons inkl. Anzahl & Preis hinzuzufügen"
                      >
                        <span>+ Kartons liefern</span>
                      </Link>
                    )}
                    {!showHvz && (
                      <Link
                        href={`${editOrderUrl}${editOrderUrl.includes('?') ? '&' : '?'}step=3&unlock=true&q=Halteverbot`}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-slate-600 dark:text-slate-300 text-[11px] font-bold transition-colors flex items-center gap-1"
                        title="Öffnet das Angebot direkt bei '3. Leistungen', um eine Halteverbotszone hinzuzufügen"
                      >
                        <span>+ Halteverbotszone</span>
                      </Link>
                    )}
                    {!showLift && (
                      <Link
                        href={`${editOrderUrl}${editOrderUrl.includes('?') ? '&' : '?'}step=3&unlock=true&q=Möbellift`}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary/10 hover:text-primary text-slate-600 dark:text-slate-300 text-[11px] font-bold transition-colors flex items-center gap-1"
                        title="Öffnet das Angebot direkt bei '3. Leistungen', um einen Möbellift hinzuzufügen"
                      >
                        <span>+ Möbellift</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Vorlagen Quick Actions for Phase 3 */}
              <div className="panel p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-headline">
                  Passende Vorlagen (Bestätigung & Ablauf)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleOpenMessage('t7')}
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
                    onClick={() => handleOpenMessage('t8')}
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
            );
          })()}

          {/* ========================================================================= */}
          {/* PHASE 4: ABGESCHLOSSEN / PROTOKOLL & RECHNUNG */}
          {/* ========================================================================= */}
          {activePhaseTab === 4 && (
            <div className="space-y-6">
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
                    activeInvNum
                      ? 'bg-[#6E8F64] hover:bg-[#5C7A53] text-white shadow-md'
                      : isReadyForInvoice
                        ? 'bg-[#D91E2A] text-white hover:bg-[#b51822] shadow-md'
                        : 'bg-slate-200 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500'
                  }`}
                >
                  <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform">
                    {activeInvNum ? 'visibility' : 'receipt_long'}
                  </span>
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <span>
                      {activeInvNum
                        ? `Rechnung (${activeInvNum}) ansehen`
                        : latestCancelledInvNum
                          ? `Korrekturrechnung erstellen (Storno: ${latestCancelledInvNum})`
                          : 'Rechnung erstellen'}
                    </span>
                    {!isReadyForInvoice && !activeInvNum && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300">
                        Vorzeitig
                      </span>
                    )}
                  </span>
                  <span className={`text-[10px] ${activeInvNum || isReadyForInvoice ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                    {activeInvNum
                      ? 'Offizielle PDF-Rechnung anzeigen & drucken'
                      : latestCancelledInvNum
                        ? 'Neue korrigierte Rechnung ausstellen'
                        : isReadyForInvoice
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
                    onClick={() => handleOpenMessage('t9')}
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
                    onClick={() => handleOpenMessage('t10')}
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
                  {isMoveDateInFuture
                    ? 'Umzugstermin liegt noch in der Zukunft!'
                    : 'Auftrag vorzeitig abschließen & abrechnen?'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {isMoveDateInFuture
                    ? `Achtung: Der Umzugstermin (${evaluation.movingDateDisplay}) hat noch nicht stattgefunden. Wenn Sie jetzt die Rechnung erstellen, wird dieser Auftrag abgeschlossen. Möchten Sie den Auftrag für diesen Kunden trotzdem jetzt abschließen?`
                    : 'Der Umzug bzw. die vorherigen Aufgaben sind noch nicht vollständig als erledigt markiert. Möchten Sie den Auftrag trotzdem jetzt abschließen und abrechnen?'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1.5 text-xs">
              <p className="font-bold text-amber-900 dark:text-amber-300">Wichtige Hinweise:</p>
              {isMoveDateInFuture && (
                <p className="text-red-700 dark:text-red-400 font-bold flex items-center gap-1.5">
                  <span>•</span>
                  <span>Der geplante Umzugstermin ({evaluation.movingDateDisplay}) hat noch nicht stattgefunden!</span>
                </p>
              )}
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
                  handleNavigate(editInvoiceUrl);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#D91E2A] hover:bg-[#b51822] text-white text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                Trotzdem abschließen & zur Rechnung
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
