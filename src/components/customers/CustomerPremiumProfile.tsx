"use client";

import React, { useState, useEffect, useMemo } from 'react';
import {
  calculateOrderTotals,
  calculateTotalPaid,
  calculateOpenAmount,
  isInvoiceCancelled,
  findActiveLinkedInvoice,
  getActiveInvoiceNumber,
  getLatestCancelledInvoiceNumber,
} from '@/lib/financeHelpers';
import { evaluateOrderLogistics } from '@/lib/orderValidation';
import { hasFixedService } from '@/lib/serviceKeys';
import { toggleTaskCompletion, updateTaskSchedule, isTaskCompleted, autoCompletePreMoveTasks } from '@/lib/taskStateController';
import { ensureOrderNumber } from '@/lib/orderStateMachine';
import { updateDoc, doc, getDoc, collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { calculateRoute, RouteCalculationResult } from '@/lib/routeCalculator';
import { getSourceBadgeStyle } from './SmartCustomerTable';
import { exportOrderMoveToCalendar, exportOrderViewingToCalendar } from '@/lib/calendarExport';
import { 
  DocumentTextIcon, 
  DocumentCheckIcon, 
  DocumentArrowDownIcon,
  MapPinIcon, 
  TruckIcon, 
  ClockIcon, 
  CalendarDaysIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  ChatBubbleLeftRightIcon, 
  PhoneIcon, 
  EnvelopeIcon, 
  BuildingOfficeIcon, 
  HomeIcon, 
  ArrowPathIcon, 
  CubeIcon, 
  CurrencyEuroIcon, 
  PencilSquareIcon, 
  ArrowRightIcon, 
  CheckIcon, 
  XMarkIcon,
  InformationCircleIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  EyeIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
  ArrowTopRightOnSquareIcon,
  AdjustmentsHorizontalIcon,
  EllipsisHorizontalIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { StornoModal } from '@/components/finances/StornoModal';
import { OrderDetailsDrawer } from '@/components/dashboard/OrderDetailsDrawer';
import { TaskScheduleModal } from '@/components/logistics/TaskScheduleModal';
import { MessageSenderModal } from '@/components/customers/MessageSenderModal';
import { generateTickets } from '@/lib/ticketEngine';
import { MASTER_COMMUNICATION_TEMPLATES } from '@/lib/communicationDefaults';

const formatProtocolDate = (val: any) => {
  if (!val) return 'Gerade eben';
  if (typeof val?.toMillis === 'function') {
    return new Date(val.toMillis()).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    return String(val);
  } catch {
    return String(val);
  }
};

interface CustomerPremiumProfileProps {
  customer: any;
  orders: any[];
  invoices?: any[];
  onEditCustomer: () => void;
  onOpenMessageModal: (order: any) => void;
  onOpenPaymentModal: (order: any) => void;
  onOpenProtocolModal: (order: any) => void;
  onOpenDispoModal: (order: any) => void;
  onOpenSignatureModal?: (order: any) => void;
  onOpenClaimModal?: (order?: any) => void;
  onViewPdf: (order: any, type: string) => void;
  onRefresh?: () => void;
}

export function CustomerPremiumProfile({
  customer,
  orders,
  invoices = [],
  onEditCustomer,
  onOpenMessageModal,
  onOpenPaymentModal,
  onOpenProtocolModal,
  onOpenDispoModal,
  onOpenSignatureModal,
  onOpenClaimModal,
  onViewPdf,
  onRefresh,
}: CustomerPremiumProfileProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlOrderId = searchParams?.get('orderId');
  const { profile } = useAuth();

  // Settings & WhatsApp Templates State
  const [settings, setSettings] = useState<any>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedWaTemplateId, setSelectedWaTemplateId] = useState<string>('t3');
  const [waActiveCategory, setWaActiveCategory] = useState<string>('Alle');
  const [waCustomText, setWaCustomText] = useState<string>('');
  const [waSearchQuery, setWaSearchQuery] = useState<string>('');
  const [waMobileTab, setWaMobileTab] = useState<'templates' | 'preview'>('templates');
  const [emailModalOrder, setEmailModalOrder] = useState<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'system', 'settings'));
        if (snap.exists()) {
          setSettings(snap.data());
        }
      } catch (err) {
        console.error('Settings load error in profile:', err);
      }
    };
    loadSettings();
  }, []);

  const allWaTemplates = useMemo(() => {
    const fromSettings = settings?.communicationTemplates || [];
    const map = new Map<string, any>();

    // 1. Load all 17 master standard templates
    MASTER_COMMUNICATION_TEMPLATES.forEach((t) => {
      map.set(t.id, { ...t });
    });

    // 2. Merge with any customized or newly created templates from Firestore settings
    if (Array.isArray(fromSettings)) {
      fromSettings.forEach((t: any) => {
        if (t && t.id) {
          const existing = map.get(t.id) || {};
          map.set(t.id, {
            ...existing,
            ...t,
            category: t.category || existing.category || 'Allgemein',
            name: t.name || existing.name || 'Vorlage',
            body: t.body || existing.body || ''
          });
        } else if (t && t.name) {
          const customId = `custom_${t.name.replace(/\s+/g, '_').toLowerCase()}`;
          map.set(customId, {
            id: customId,
            name: t.name,
            category: t.category || 'Benutzerdefiniert',
            body: t.body || ''
          });
        }
      });
    }

    return Array.from(map.values());
  }, [settings]);

  const waCategories = useMemo(() => {
    const cats = new Set<string>();
    allWaTemplates.forEach((t: any) => {
      if (t.category) cats.add(t.category);
    });
    return ['Alle', ...Array.from(cats)];
  }, [allWaTemplates]);

  const filteredWaTemplates = useMemo(() => {
    return allWaTemplates.filter((t: any) => {
      const matchesCat = waActiveCategory === 'Alle' || t.category === waActiveCategory;
      const matchesSearch = !waSearchQuery.trim() || 
        t.name?.toLowerCase().includes(waSearchQuery.toLowerCase()) || 
        t.body?.toLowerCase().includes(waSearchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [allWaTemplates, waActiveCategory, waSearchQuery]);

  // Active / Selected order
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(urlOrderId || null);
  const activeOrder = (selectedOrderId ? orders.find(o => o.id === selectedOrderId) : null) 
    || orders.find(o => o.status !== 'archived') 
    || orders[0] 
    || null;

  const activeProtocols = activeOrder?.protocols || [];
  const hasActiveProtocols = activeProtocols.length > 0;

  // Role permissions
  const isTeamLead = profile?.role === 'teamlead' || profile?.canViewPrices === false;

  // Available Teamleiters for moving assignment
  const [teamLeads, setTeamLeads] = useState<Array<{ uid: string; displayName: string; role: string; email?: string }>>([]);
  const [isAssigningTeamLead, setIsAssigningTeamLead] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snap) => {
      const leads = snap.docs
        .map(d => ({ uid: d.id, ...d.data() } as any))
        .filter(u => u.role === 'teamlead' || u.role === 'admin')
        .map(u => ({
          uid: u.uid || u.id,
          displayName: u.displayName || u.name || u.email || 'Teamleiter',
          role: u.role,
          email: u.email
        }));
      setTeamLeads(leads);
    }, (err) => {
      console.warn('Could not load team leads:', err);
    });
    return () => unsub();
  }, []);

  const handleAssignTeamLead = async (leadUid: string) => {
    if (!activeOrder?.id) return;
    setIsAssigningTeamLead(true);
    try {
      const selectedLead = teamLeads.find(l => l.uid === leadUid);
      const leadName = selectedLead ? selectedLead.displayName : '';
      const prevDispo = activeOrder.disposition || {};
      const nextDispo = {
        ...prevDispo,
        assignedTeamLeadUid: leadUid || null,
        assignedTeamLeadName: leadName || null,
      };

      await updateDoc(doc(db, 'orders', activeOrder.id), {
        disposition: nextDispo,
        'disposition.assignedTeamLeadUid': leadUid || null,
        'disposition.assignedTeamLeadName': leadName || null,
        assignedTeamLeadUid: leadUid || null,
        assignedTeamLeadName: leadName || null,
      });

      toast.success(leadUid ? `Teamleiter „${leadName}“ erfolgreich zugewiesen` : 'Teamleiter-Zuweisung aufgehoben');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Fehler bei Teamleiter-Zuweisung:', err);
      toast.error('Fehler beim Zuweisen des Teamleiters');
    } finally {
      setIsAssigningTeamLead(false);
    }
  };

  // Invoice detection for active order (from parent order or linked invoice document)
  const linkedInvoice = findActiveLinkedInvoice(activeOrder, invoices);
  const latestCancelledInvoiceNum = getLatestCancelledInvoiceNumber(activeOrder, invoices);
  const activeInvoiceNumber = getActiveInvoiceNumber(activeOrder, linkedInvoice);

  // Check if all linked invoices for activeOrder in `invoices` are cancelled (e.g. if a previous Storno partially succeeded)
  const allLinkedInvoicesForActiveOrder = (invoices || []).filter((inv: any) =>
    !inv.isStorno && (
      inv.sourceOrderId === activeOrder?.id ||
      inv.orderId === activeOrder?.id ||
      inv.id === activeOrder?.id ||
      (activeOrder?.invoiceNumber && inv.invoiceNumber === activeOrder.invoiceNumber) ||
      (activeOrder?.activeInvoiceNumber && inv.invoiceNumber === activeOrder.activeInvoiceNumber) ||
      (inv.isKorrektur && inv.correctionFor && (
        inv.correctionFor === activeOrder?.invoiceNumber ||
        inv.correctionFor === activeOrder?.lastCancelledInvoiceNumber ||
        inv.correctionFor === activeOrder?.cancelledInvoiceNumber
      ))
    )
  );
  const isAllLinkedCancelled =
    allLinkedInvoicesForActiveOrder.length > 0 &&
    allLinkedInvoicesForActiveOrder.every((inv: any) => isInvoiceCancelled(inv));

  const hasInvoice = Boolean(
    linkedInvoice ||
    activeInvoiceNumber || (
      !isAllLinkedCancelled &&
      !isInvoiceCancelled(activeOrder) && (
        activeOrder?.status === 'invoice_open' ||
        activeOrder?.status === 'invoice_paid'
      )
    )
  );

  const invoiceNumberDisplay = hasInvoice ? (linkedInvoice?.invoiceNumber || activeInvoiceNumber || null) : null;

  // Pre-invoice open tasks check modal state
  const [preInvoiceOpenTasks, setPreInvoiceOpenTasks] = useState<{ order: any; tasks: any[] } | null>(null);
  const [isAutoClosingTasks, setIsAutoClosingTasks] = useState(false);

  // Unconfirmed invoice warning modal state
  const [unconfirmedInvoiceOrder, setUnconfirmedInvoiceOrder] = useState<any>(null);

  // No invoice warning for payment modal state
  const [noInvoiceForPaymentOrder, setNoInvoiceForPaymentOrder] = useState<any>(null);

  // Storno modal state
  const [stornoInvoice, setStornoInvoice] = useState<any>(null);

  // Empty offer warning modal state (when 0 services or 0€)
  const [emptyOfferWarningModal, setEmptyOfferWarningModal] = useState<any | null>(null);

  const isOrderPricedAndServiced = (ord: any): boolean => {
    if (!ord) return false;
    // Flat rate with amount > 0
    if (ord.isFlatRate && Number(ord.flatRateNet) > 0) return true;
    // Services with quantity & price or non-empty names
    if (Array.isArray(ord.services) && ord.services.length > 0) {
      const hasAnyPrice = ord.services.some((s: any) => (Number(s.quantity) || 0) * (Number(s.unitPrice) || 0) > 0);
      if (hasAnyPrice) return true;
      if (ord.services.some((s: any) => s.name?.trim())) return true;
    }
    // Totals gross > 0
    if (ord.totals && (Number(ord.totals.gross) > 0 || Number(ord.totals.net) > 0)) {
      return true;
    }
    return false;
  };

  const handleOrderPdfClick = (ord: any) => {
    if (!ord) return;
    if (!isOrderPricedAndServiced(ord)) {
      setEmptyOfferWarningModal(ord);
      return;
    }
    onViewPdf(ord, 'order');
  };

  // WhatsApp quick messenger modal / popover state
  const [showWhatsAppQuickMenu, setShowWhatsAppQuickMenu] = useState(false);

  // Automated checklist guidance modal
  const [isUpdatingChecklist, setIsUpdatingChecklist] = useState(false);
  const [checklistGuidanceItem, setChecklistGuidanceItem] = useState<any>(null);

  // Dashboard-Style Drawer State for full 4-phase examination
  const [drawerOrder, setDrawerOrder] = useState<any | null>(null);
  const [drawerInitialPhase, setDrawerInitialPhase] = useState<number | undefined>(undefined);
  const [scheduleModalTodo, setScheduleModalTodo] = useState<any | null>(null);

  // Smart Phase-Aware Actions Dropdown State
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const actionsDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target as Node)) {
        setActionsDropdownOpen(false);
      }
    };
    if (actionsDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionsDropdownOpen]);

  // Keep drawerOrder synced with live orders array from Firestore
  useEffect(() => {
    if (drawerOrder?.id) {
      const updated = orders.find((o: any) => o.id === drawerOrder.id);
      if (updated) setDrawerOrder(updated);
    }
  }, [orders]);

  // Self-heal: ensure confirmed or quote orders automatically receive an authoritative AN-XXX orderNumber
  useEffect(() => {
    if (activeOrder?.id && (activeOrder.status === 'confirmed' || activeOrder.status === 'quote') && !activeOrder.orderNumber) {
      ensureOrderNumber(activeOrder.id).then(() => {
        if (onRefresh) onRefresh();
      }).catch(console.error);
    }
  }, [activeOrder?.id, activeOrder?.status, activeOrder?.orderNumber, onRefresh]);

  // Self-heal:
  // 1) Forward heal: if an active non-cancelled invoice (`linkedInvoice`) exists in `invoices`, ensure `activeOrder` reflects it
  //    (and if a Korrekturrechnung accidentally got the same number as correctionFor, bump its number).
  // 2) Backward heal: ONLY for legacy interrupted Stornos where `activeOrder.invoiceCancelled === undefined` and no active invoice exists.
  useEffect(() => {
    if (!activeOrder?.id) return;

    if (linkedInvoice && linkedInvoice.invoiceNumber) {
      let effectiveInvNum = linkedInvoice.invoiceNumber;
      const corrTarget = linkedInvoice.correctionFor || latestCancelledInvoiceNum;
      if (linkedInvoice.isKorrektur && corrTarget && effectiveInvNum === corrTarget) {
        const numMatch = String(corrTarget).match(/(\d+)/);
        const nextNum = numMatch ? parseInt(numMatch[1], 10) + 1 : 1772;
        effectiveInvNum = `R-${nextNum}`;
        updateDoc(doc(db, 'invoices', linkedInvoice.id), {
          invoiceNumber: effectiveInvNum,
          invoiceCancelled: false,
          isCanceled: false,
        }).catch(console.error);
      }

      if (
        activeOrder.invoiceCancelled ||
        activeOrder.activeInvoiceNumber !== effectiveInvNum ||
        (activeOrder.status !== 'invoice_open' && activeOrder.status !== 'invoice_paid')
      ) {
        const orderRef = doc(db, 'orders', activeOrder.id);
        const syncPayload: Record<string, any> = {
          activeInvoiceNumber: effectiveInvNum,
          invoiceCancelled: false,
          isCanceled: false,
          status: linkedInvoice.status === 'invoice_paid' ? 'invoice_paid' : 'invoice_open',
          'ticketStates.invoice': true,
          'checklistDone.invoice': true,
          isKorrektur: Boolean(linkedInvoice.isKorrektur),
          correctionFor: linkedInvoice.correctionFor || null,
          totals: linkedInvoice.totals || activeOrder.totals,
          calcInput: linkedInvoice.calcInput || activeOrder.calcInput,
        };
        updateDoc(orderRef, { ...syncPayload, invoiceNumber: effectiveInvNum })
          .catch(() => updateDoc(orderRef, syncPayload))
          .then(() => {
            if (onRefresh) onRefresh();
          })
          .catch(console.error);
      }
      return;
    }

    if (
      isAllLinkedCancelled &&
      !linkedInvoice &&
      activeOrder.invoiceCancelled === undefined &&
      !activeOrder.activeInvoiceNumber &&
      !activeOrder.isKorrektur
    ) {
      const cancelledInv = allLinkedInvoicesForActiveOrder[0];
      const cancelledNum = cancelledInv?.invoiceNumber || activeOrder.invoiceNumber;
      const stornoNum = cancelledInv?.stornoDocumentNumber || (cancelledNum ? `ST-${String(cancelledNum).replace(/^(RE-|R-)/i, '')}` : null);
      const existingHistory = Array.isArray(activeOrder.invoiceHistory) ? activeOrder.invoiceHistory : [];
      const alreadyInHistory = existingHistory.some((h: any) => h.invoiceNumber === cancelledNum);
      const updatedHistory = alreadyInHistory
        ? existingHistory
        : [
            ...existingHistory,
            {
              invoiceNumber: cancelledNum,
              stornoNumber: stornoNum,
              cancelledAt: cancelledInv?.cancelledAt || new Date().toISOString(),
              cancelReason: cancelledInv?.cancelReason || 'Storniert',
            }
          ];

      const orderRef = doc(db, 'orders', activeOrder.id);
      updateDoc(orderRef, {
        status: 'confirmed',
        invoiceNumber: null,
        activeInvoiceNumber: null,
        invoiceCancelled: true,
        stornoNumber: stornoNum,
        lastCancelledInvoiceNumber: cancelledNum,
        'ticketStates.invoice': false,
        'checklistDone.invoice': false,
        invoiceHistory: updatedHistory,
      }).catch(() => {
        return updateDoc(orderRef, {
          status: 'confirmed',
          activeInvoiceNumber: null,
          invoiceCancelled: true,
          stornoNumber: stornoNum,
          lastCancelledInvoiceNumber: cancelledNum,
          'ticketStates.invoice': false,
          'checklistDone.invoice': false,
          invoiceHistory: updatedHistory,
        });
      }).then(() => {
        if (onRefresh) onRefresh();
      }).catch(console.error);
    }
  }, [
    activeOrder?.id,
    isAllLinkedCancelled,
    linkedInvoice?.id,
    linkedInvoice?.invoiceNumber,
    activeOrder?.status,
    activeOrder?.invoiceCancelled,
    activeOrder?.activeInvoiceNumber,
  ]);

  const formatCustomerDate = (dateRaw?: string, timeRaw?: string) => {
    if (!dateRaw || dateRaw === 'requested') return '';
    if (dateRaw === 'erledigt_fotos') return 'Durch Fotos erledigt ✓';
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

  // Logistics & Route extraction
  const orderLogistics = activeOrder?.logistics || {};
  const aStreet = orderLogistics.a_street || orderLogistics.from?.street || orderLogistics.auszug?.street || '';
  const aHouseNr = orderLogistics.a_houseNr || orderLogistics.from?.houseNr || orderLogistics.auszug?.houseNr || '';
  const aZip = orderLogistics.a_zip || orderLogistics.from?.zip || orderLogistics.auszug?.zip || '';
  const aCity = orderLogistics.a_city || orderLogistics.from?.city || orderLogistics.auszug?.city || '';
  const aFloor = orderLogistics.a_floor || orderLogistics.from?.floor || '';
  const aElevator = orderLogistics.a_elevator ?? orderLogistics.from?.hasElevator;
  const aAddressFull = `${aStreet} ${aHouseNr}, ${aZip} ${aCity}`.trim().replace(/^,\s*|,\s*$/g, '');
  const hasA = Boolean(aStreet || aCity);

  const bStreet = orderLogistics.b_street || orderLogistics.to?.street || orderLogistics.einzug?.street || '';
  const bHouseNr = orderLogistics.b_houseNr || orderLogistics.to?.houseNr || orderLogistics.einzug?.houseNr || '';
  const bZip = orderLogistics.b_zip || orderLogistics.to?.zip || orderLogistics.einzug?.zip || '';
  const bCity = orderLogistics.b_city || orderLogistics.to?.city || orderLogistics.einzug?.city || '';
  const bFloor = orderLogistics.b_floor || orderLogistics.to?.floor || '';
  const bElevator = orderLogistics.b_elevator ?? orderLogistics.to?.hasElevator;
  const bAddressFull = `${bStreet} ${bHouseNr}, ${bZip} ${bCity}`.trim().replace(/^,\s*|,\s*$/g, '');
  const hasB = Boolean(bStreet || bCity);

  const bothAddressesPresent = hasA && hasB;
  
  // Google Maps URL with multi-waypoint roundtrip or direct route
  const googleMapsRouteUrl = bothAddressesPresent 
    ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent("Grillostr. 70, 44799 Bochum")}&destination=${encodeURIComponent("Grillostr. 70, 44799 Bochum")}&waypoints=${encodeURIComponent(aAddressFull)}|${encodeURIComponent(bAddressFull)}` 
    : hasA 
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(aAddressFull)}`
      : null;

  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState<RouteCalculationResult | any>(
    activeOrder?.routeInfo || activeOrder?.logistics?.routeInfo || null
  );

  const handleCalculateRoute = async () => {
    if (!hasA || !hasB) {
      toast.error('Bitte zuerst Beladestelle und Entladestelle im Angebot eintragen.');
      return;
    }

    setIsCalculatingRoute(true);
    try {
      const res = await calculateRoute(aAddressFull, bAddressFull, { includeRoundTrip: true });
      if (res) {
        setRouteInfo(res);
        if (activeOrder?.id) {
          const orderRef = doc(db, 'orders', activeOrder.id);
          await updateDoc(orderRef, {
            'routeInfo': res,
            'logistics.routeInfo': res,
            'logistics.distanceKm': res.distanceKm
          });
        }
        toast.success(`Route berechnet: ${res.distanceKm} km Direkt (ca. ${res.durationMinutes} Min)`);
      } else {
        toast.error('Route konnte nicht automatisch berechnet werden. Bitte Adressen prüfen.');
      }
    } catch (err) {
      toast.error('Fehler bei der Routenberechnung.');
    } finally {
      setIsCalculatingRoute(false);
    }
  };

  // Customer Name Formatting
  const fullName = customer 
    ? `${customer.salutation ? customer.salutation + ' ' : ''}${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.company || 'Kunde ohne Name'
    : 'Kunde';

  // Logistics & Finance Evaluation
  const orderTotals = activeOrder ? calculateOrderTotals(activeOrder) : { net: 0, tax: 0, gross: 0 };
  const invoiceTotals = linkedInvoice ? calculateOrderTotals(linkedInvoice) : null;
  // Authoritative financial totals: If an invoice exists with amounts, it takes absolute precedence over a draft offer!
  const totals = (invoiceTotals && invoiceTotals.gross > 0) ? invoiceTotals : orderTotals;
  
  // Combine payments from activeOrder and linkedInvoice to prevent any out-of-sync gaps
  const combinedPayments = (activeOrder?.payments && activeOrder.payments.length > 0)
    ? activeOrder.payments
    : (linkedInvoice?.payments || []);

  const totalPaid = calculateTotalPaid({ payments: combinedPayments });
  const openAmount = Math.max(0, totals.gross - totalPaid);
  const isInvoiceFullyPaid = Boolean(
    hasInvoice && (
      (totals.gross > 0 && openAmount <= 0) || 
      activeOrder?.status === 'invoice_paid' || 
      linkedInvoice?.status === 'invoice_paid'
    )
  );

  const logisticsEval = activeOrder ? evaluateOrderLogistics(activeOrder, customer) : null;
  const paidPercentage = totals.gross > 0 ? Math.min(100, Math.round((totalPaid / totals.gross) * 100)) : 0;

  // Checklist Items
  const checklist = logisticsEval?.checklist || [];
  const completedCount = checklist.filter(c => c.done).length;

  // 4-Phase System Calculation
  const getCurrentPhase = (ord: any): { phase: number; label: string; themeColor: string } => {
    if (!ord) return { phase: 1, label: 'Entwurf', themeColor: 'blue' };
    const st = ord.status;
    
    // If an active invoice exists or status is completed / invoice_open / invoice_paid (and not cancelled), it is Phase 4!
    if (hasInvoice || st === 'completed' || st === 'archived') {
      return { 
        phase: 4, 
        label: isInvoiceFullyPaid ? 'Abgeschlossen & Bezahlt' : 'Rechnung gestellt', 
        themeColor: 'slate' 
      };
    }

    const isSigned = isTaskCompleted(ord, 'signature');
    if (st === 'confirmed' || isSigned || latestCancelledInvoiceNum) {
      return {
        phase: 3,
        label: latestCancelledInvoiceNum ? `Korrektur nach Storno (${latestCancelledInvoiceNum})` : 'Auftrag bestätigt',
        themeColor: 'emerald'
      };
    }
    
    if (st === 'quote' || st === 'clarification') return { phase: 2, label: 'Angebot versendet', themeColor: 'amber' };
    return { phase: 1, label: 'Entwurf', themeColor: 'blue' };
  };

  const currentPhaseInfo = getCurrentPhase(activeOrder);

  // Moving Date Countdown calculation
  const getMoveCountdown = () => {
    const rawDate = activeOrder?.orderMeta?.movingDateFrom || activeOrder?.movingDate || activeOrder?.logistics?.movingDate;
    if (!rawDate) return null;
    const moveDateObj = new Date(rawDate);
    if (isNaN(moveDateObj.getTime())) return null;
    
    const today = new Date();
    
    // Calendar-based UTC arithmetic immune to Daylight Saving Time (DST) 1-hour shifts
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const utcMove = Date.UTC(moveDateObj.getFullYear(), moveDateObj.getMonth(), moveDateObj.getDate());
    const diffDays = Math.round((utcMove - utcToday) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { text: 'Heute!', color: 'bg-emerald-500 text-white' };
    if (diffDays === 1) return { text: 'Morgen', color: 'bg-amber-500 text-white' };
    if (diffDays > 1) return { text: `In ${diffDays} Tagen`, color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' };
    return { text: `Vor ${Math.abs(diffDays)} Tagen`, color: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300' };
  };

  const moveCountdown = getMoveCountdown();

  // Invoice creation interception guard
  const handleRequestInvoice = (orderToInvoice: any) => {
    if (!orderToInvoice) return;

    // Check if an ACTIVE (non-cancelled) invoice ALREADY exists for this order!
    const existingInv = findActiveLinkedInvoice(orderToInvoice, invoices);
    const activeInvNum = getActiveInvoiceNumber(orderToInvoice, existingInv);

    // If an active draft invoice exists without an official number yet, open it in InvoiceEditor to finalize
    if (existingInv && !activeInvNum && existingInv.status === 'draft') {
      router.push(`/dashboard/customers/${customer.id}/edit-invoice/${existingInv.id || orderToInvoice.id}`);
      return;
    }

    if (existingInv || activeInvNum) {
      toast(`Rechnung ${existingInv?.invoiceNumber || activeInvNum || ''} existiert bereits.`);
      onViewPdf(existingInv || orderToInvoice, 'invoice');
      return;
    }

    const orderLinkedInvs = (invoices || []).filter((inv: any) =>
      !inv.isStorno && (
        inv.sourceOrderId === orderToInvoice.id ||
        inv.orderId === orderToInvoice.id ||
        inv.id === orderToInvoice.id ||
        (orderToInvoice.invoiceNumber && inv.invoiceNumber === orderToInvoice.invoiceNumber) ||
        (orderToInvoice.activeInvoiceNumber && inv.invoiceNumber === orderToInvoice.activeInvoiceNumber)
      )
    );
    const allOrderInvsCancelled =
      orderLinkedInvs.length > 0 &&
      orderLinkedInvs.every((inv: any) => isInvoiceCancelled(inv));

    // If a previous invoice for this order was cancelled (Storno), allow immediate Korrekturrechnung creation
    const hasPreviousCancelledInv = Boolean(getLatestCancelledInvoiceNumber(orderToInvoice, invoices) || allOrderInvsCancelled);
    if (hasPreviousCancelledInv) {
      router.push(`/dashboard/customers/${customer.id}/edit-invoice/${orderToInvoice.id}`);
      return;
    }

    // Pre-flight check for open logistics tasks (viewing, kartons, HVZ, moebellift)
    try {
      const tickets = generateTickets(orderToInvoice, customer);
      const openLogisticsTasks = tickets.filter(t => !t.done && ['viewing_requested', 'kartons_liefern', 'halteverbot', 'moebellift_buchen'].includes(t.id));
      if (openLogisticsTasks.length > 0) {
        setPreInvoiceOpenTasks({ order: orderToInvoice, tasks: openLogisticsTasks });
        return;
      }
    } catch (err) {
      console.error('Error generating pre-flight tickets:', err);
    }

    const isContractSigned = 
      orderToInvoice.status === 'confirmed' || 
      orderToInvoice.status === 'completed' || 
      orderToInvoice.status?.startsWith('invoice_') ||
      Boolean(
        orderToInvoice.signatureOrder ||
        orderToInvoice.signature ||
        orderToInvoice.orderMeta?.signedContractScan ||
        orderToInvoice.isManuallySigned ||
        orderToInvoice.contractSigned ||
        orderToInvoice.signedAt ||
        orderToInvoice.customerSignature ||
        orderToInvoice.isContractLocked
      );

    const hasProtocolOrDone = Boolean(
      orderToInvoice.status === 'completed' ||
      orderToInvoice.status?.startsWith('invoice_') ||
      (orderToInvoice.protocols && orderToInvoice.protocols.length > 0) ||
      orderToInvoice.ticketStates?.protocol ||
      orderToInvoice.checklistDone?.protocol
    );

    const moveDateStr = orderToInvoice.orderMeta?.movingDateFrom || orderToInvoice.movingDate || orderToInvoice.logistics?.movingDate || orderToInvoice.date;
    const isMoveInFuture = (() => {
      if (!moveDateStr) return false;
      const moveD = new Date(String(moveDateStr).split('T')[0] + 'T00:00:00');
      if (isNaN(moveD.getTime())) return false;
      const todayD = new Date();
      todayD.setHours(0, 0, 0, 0);
      return moveD.getTime() > todayD.getTime();
    })();

    if (isMoveInFuture || !isContractSigned || !hasProtocolOrDone) {
      // Intercept with warning modal when move date is in the future or order is not yet completed
      setUnconfirmedInvoiceOrder(orderToInvoice);
      return;
    }

    // Proceed directly if contract is signed, move date has arrived, and protocol is completed
    router.push(`/dashboard/customers/${customer.id}/edit-invoice/${orderToInvoice.id}`);
  };

  const handleAutoCloseTasksAndInvoice = async () => {
    if (!preInvoiceOpenTasks) return;
    const { order, tasks } = preInvoiceOpenTasks;
    setIsAutoClosingTasks(true);
    try {
      for (const t of tasks) {
        await toggleTaskCompletion(order.id, t.id, true);
      }
      toast.success(`${tasks.length} offene Aufgaben automatisch als erledigt markiert.`);
      setPreInvoiceOpenTasks(null);
      if (onRefresh) onRefresh();
      router.push(`/dashboard/customers/${customer.id}/edit-invoice/${order.id}`);
    } catch (err) {
      console.error('Error auto-completing tasks:', err);
      toast.error('Fehler beim Aktualisieren der Aufgaben.');
    } finally {
      setIsAutoClosingTasks(false);
    }
  };

  const handleProceedWithoutClosingTasks = () => {
    if (!preInvoiceOpenTasks) return;
    const { order } = preInvoiceOpenTasks;
    setPreInvoiceOpenTasks(null);
    router.push(`/dashboard/customers/${customer.id}/edit-invoice/${order.id}`);
  };

  // Payment interception guard: Invoices must exist before recording payments
  const handleRequestPayment = (orderToPay: any) => {
    if (!orderToPay && !linkedInvoice) {
      toast.error('Kein Auftrag oder Rechnung ausgewählt.');
      return;
    }

    const orderActiveInv = findActiveLinkedInvoice(orderToPay, invoices);
    const orderActiveInvNum = getActiveInvoiceNumber(orderToPay, orderActiveInv);
    const orderHasInvoice = Boolean(
      orderActiveInv ||
      orderActiveInvNum || (
        !isAllLinkedCancelled &&
        !isInvoiceCancelled(orderToPay) && (
          orderToPay?.status === 'invoice_open' ||
          orderToPay?.status === 'invoice_paid'
        )
      )
    );

    if (!orderHasInvoice) {
      setNoInvoiceForPaymentOrder(orderToPay);
      return;
    }

    // Pass the merged document so PaymentManager gets the authoritative totals & invoice number
    const targetDoc = orderActiveInv
      ? {
          ...(orderToPay || orderActiveInv),
          totals,
          invoiceNumber: orderActiveInv.invoiceNumber || orderActiveInvNum,
          payments: combinedPayments
        }
      : orderToPay;

    onOpenPaymentModal(targetDoc);
  };

  // Checklist Item Click Handler
  const handleChecklistClick = (item: any) => {
    if (item.id === 'address') {
      if (!item.done) {
        setChecklistGuidanceItem(item);
      } else {
        toast.success('Adressen sind vollständig im Formular erfasst.');
      }
      return;
    }

    if (item.id === 'signature' || item.id === 'angebot_confirmed') {
      if (!item.done && onOpenSignatureModal) {
        onOpenSignatureModal(activeOrder);
        return;
      }
    }

    if (item.id === 'protocol') {
      if (onOpenProtocolModal) {
        onOpenProtocolModal(activeOrder);
        return;
      }
    }

    if (item.id === 'invoice') {
      handleRequestInvoice(activeOrder);
      return;
    }

    if (item.id === 'payment') {
      handleRequestPayment(activeOrder);
      return;
    }

    toggleManualItem(item.id, item.done);
  };

  // Toggle manual checklist items
  const toggleManualItem = async (itemId: string, currentVal: boolean) => {
    if (!activeOrder || isUpdatingChecklist) return;

    if (itemId === 'viewing_date' && !currentVal) {
      const dateStr = window.prompt('Wann soll der Besichtigungstermin stattfinden? (z.B. 2026-10-15 14:00)', '');
      if (dateStr) {
        setIsUpdatingChecklist(true);
        try {
          await updateTaskSchedule(activeOrder.id, 'viewing_date', dateStr);
          toast.success('Besichtigungstermin im Kalender eingetragen!');
          if (onRefresh) onRefresh();
        } catch (error) {
          toast.error('Fehler beim Speichern');
        } finally {
          setIsUpdatingChecklist(false);
        }
      }
      return;
    }

    setIsUpdatingChecklist(true);
    try {
      const result = await toggleTaskCompletion(activeOrder, itemId);
      let message = result.newState ? 'Als erledigt markiert' : 'Als offen markiert';
      if (itemId === 'signature' || itemId === 'angebot_confirmed') {
        message = result.newState ? 'Auftrag bestätigt (Status: Bestätigt)' : 'Auftrag zurück auf "In Verhandlung" gesetzt';
      } else if (itemId === 'hvz') {
        message = result.newState ? 'Halteverbot (HVZ) als erledigt markiert' : 'Halteverbot (HVZ) als ausstehend markiert';
      } else if (itemId === 'kartons') {
        message = result.newState ? 'Kartons als geliefert markiert' : 'Kartons als ausstehend markiert';
      } else if (itemId === 'moebellift') {
        message = result.newState ? 'Möbellift als reserviert markiert' : 'Möbellift als ausstehend markiert';
      } else if (itemId === 'team') {
        message = result.newState ? 'Umzugsteam als disponiert markiert' : 'Umzugsteam als offen markiert';
      } else if (itemId === 'protocol') {
        message = result.newState ? 'Übergabeprotokoll als erledigt markiert' : 'Übergabeprotokoll als offen markiert';
      } else if (itemId === 'invoice') {
        message = result.newState ? 'Rechnung als ausgestellt markiert' : 'Rechnung als offen markiert';
      } else if (itemId === 'payment') {
        message = result.newState ? 'Zahlung als erhalten markiert' : 'Zahlung als offen markiert';
      }

      toast.success(message);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error updating checklist:', error);
      toast.error('Fehler beim Aktualisieren');
    } finally {
      setIsUpdatingChecklist(false);
    }
  };

  // Dynamic next step recommendation logic
  const getNextStep = (): {
    title: string;
    desc: string;
    btnText: string;
    badge: string;
    action: () => void;
    secondaryBtnText?: string;
    onSecondaryAction?: () => void;
  } => {
    if (!activeOrder) {
      return {
        title: 'Erstes Angebot erstellen',
        desc: 'Für diesen Kunden wurde noch kein Umzugsangebot angelegt.',
        btnText: 'Angebot jetzt anlegen',
        badge: 'Schritt 1: Initialisierung',
        action: () => router.push(`/dashboard/customers/${customer.id}/new-order`)
      };
    }

    // Phase 1: Draft
    if (activeOrder.status === 'draft') {
      return {
        title: 'Angebot fertigstellen & versenden',
        desc: 'Dieser Auftrag ist als "Entwurf" gespeichert. Schließen Sie die Kalkulation ab und übermitteln Sie das Angebot an den Kunden.',
        btnText: 'Entwurf öffnen & abschließen',
        badge: 'Phase 1: Datenerfassung',
        action: () => router.push(`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`)
      };
    }

    // Phase 2: Quote (waiting for signature / contract)
    if (!logisticsEval?.angebotStatus.isSigned && activeOrder.status !== 'confirmed' && !hasInvoice) {
      return {
        title: 'Vertragsbestätigung einholen',
        desc: 'Das Angebot liegt beim Kunden. Bestätigung digital auf dem Tablet erfassen oder per Unterschrift hinterlegen.',
        btnText: 'Jetzt digital signieren',
        badge: 'Phase 2: Vertragsabschluss',
        action: () => onOpenSignatureModal ? onOpenSignatureModal(activeOrder) : router.push(`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`)
      };
    }

    // Phase 3: Confirmed (before invoice is issued, or after previous invoice was cancelled via Storno)
    if ((activeOrder.status === 'confirmed' || latestCancelledInvoiceNum) && !hasInvoice) {
      if (latestCancelledInvoiceNum) {
        return {
          title: `Korrekturrechnung jetzt erstellen (nach Storno von ${latestCancelledInvoiceNum})`,
          desc: `Die ursprüngliche Rechnung (${latestCancelledInvoiceNum}) wurde GoBD-konform storniert. Sie können den Auftrag nun prüfen und sofort eine korrigierte Rechnung ausstellen.`,
          btnText: 'Korrekturrechnung jetzt erstellen',
          secondaryBtnText: 'Angebot anpassen',
          onSecondaryAction: () => router.push(`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`),
          badge: 'Phase 4: Korrektur nach Storno',
          action: () => handleRequestInvoice(activeOrder)
        };
      }

      const openPhase3Items = (logisticsEval?.checklist || []).filter(
        (item: any) => !item.done && ['kartons', 'hvz', 'moebellift', 'team'].includes(item.id)
      );
      if (openPhase3Items.length > 0) {
        const missingNames = openPhase3Items.map(i => (i.label || '').split('(')[0].replace('✓', '').trim()).join(' • ');
        return {
          title: 'Logistik & Disposition vorbereiten',
          desc: `Der Auftrag ist bestätigt. Noch offen für 100%: ${missingNames}.`,
          btnText: 'Phase 3 im Cockpit öffnen',
          secondaryBtnText: 'Laufzettel drucken',
          onSecondaryAction: () => onViewPdf(activeOrder, 'employee'),
          badge: `Phase 3: ${openPhase3Items.length} Aufgabe${openPhase3Items.length > 1 ? 'n' : ''} offen`,
          action: () => setDrawerOrder(activeOrder)
        };
      }

      const hasProtocol = Boolean(
        (activeOrder.protocols && activeOrder.protocols.length > 0) ||
        activeOrder.signatureProtocol ||
        activeOrder.ticketStates?.protocol ||
        activeOrder.checklistDone?.protocol
      );
      if (!hasProtocol) {
        return {
          title: 'Umzug durchführen & Abnahmeprotokoll erfassen',
          desc: 'Alle Vorbereitungen sind abgeschlossen. Lassen Sie am Umzugstag das digitale Übergabeprotokoll unterschreiben oder erstellen Sie direkt die Schlussrechnung.',
          btnText: 'Abnahmeprotokoll erfassen',
          secondaryBtnText: 'Schlussrechnung erstellen',
          onSecondaryAction: () => handleRequestInvoice(activeOrder),
          badge: 'Phase 3 ➔ 4: Durchführung & Abnahme',
          action: () => onOpenProtocolModal(activeOrder)
        };
      }

      return {
        title: 'Schlussrechnung jetzt erstellen',
        desc: 'Der Vertrag ist bestätigt und das Abnahmeprotokoll liegt vor. Erstellen Sie nun direkt die offizielle Schlussrechnung.',
        btnText: 'Schlussrechnung jetzt erstellen',
        secondaryBtnText: 'Laufzettel drucken',
        onSecondaryAction: () => onViewPdf(activeOrder, 'employee'),
        badge: 'Phase 4: Abrechnung bereit',
        action: () => handleRequestInvoice(activeOrder)
      };
    }

    // Phase 4: Invoice & Payment (Invoice ALREADY EXISTS or move completed)
    if (hasInvoice) {
      // Case A: Draft invoice without official invoice number
      if (!invoiceNumberDisplay && linkedInvoice?.status === 'draft') {
        return {
          title: 'Rechnungsentwurf finalisieren & ausstellen',
          desc: 'Es existiert bereits ein Rechnungsentwurf für diesen Auftrag. Bitte prüfen Sie die Beträge und stellen Sie die Rechnung offiziell aus.',
          btnText: 'Rechnungsentwurf öffnen',
          secondaryBtnText: 'Laufzettel drucken',
          onSecondaryAction: () => onViewPdf(activeOrder, 'employee'),
          badge: 'Phase 4: Abrechnung in Prüfung',
          action: () => router.push(`/dashboard/customers/${customer.id}/edit-invoice/${linkedInvoice.id || activeOrder.id}`)
        };
      }

      // Case B: Finalized invoice, waiting for payment
      if (!isInvoiceFullyPaid) {
        return {
          title: 'Zahlungseingang überwachen & erfassen',
          desc: `Die Rechnung ${invoiceNumberDisplay ? `(${invoiceNumberDisplay})` : ''} wurde erfolgreich ausgestellt. Offener Betrag: €${openAmount.toLocaleString('de-DE')}. Verbuchen Sie die Zahlung, sobald das Geld eingegangen ist.`,
          btnText: 'Zahlungseingang erfassen',
          secondaryBtnText: 'Rechnung ansehen',
          onSecondaryAction: () => onViewPdf(linkedInvoice || activeOrder, 'invoice'),
          badge: 'Phase 4: Zahlung ausstehend',
          action: () => handleRequestPayment(activeOrder)
        };
      }

      // Case C: Fully settled & paid
      return {
        title: 'Auftrag vollständig abgeschlossen & bezahlt',
        desc: `Die Rechnung ${invoiceNumberDisplay ? `(${invoiceNumberDisplay})` : ''} ist vollständig bezahlt (€${totals.gross.toLocaleString('de-DE')}). Sämtliche Phasen dieses Umzugs wurden erfolgreich beendet.`,
        btnText: 'Rechnung ansehen (PDF)',
        secondaryBtnText: 'Laufzettel drucken',
        onSecondaryAction: () => onViewPdf(activeOrder, 'employee'),
        badge: 'Phase 4: Vollständig erledigt',
        action: () => onViewPdf(linkedInvoice || activeOrder, 'invoice')
      };
    }

    return {
      title: 'Schlussrechnung erstellen & abschließen',
      desc: 'Der Umzug ist abgeschlossen. Erstellen Sie nun die offizielle Rechnung für den Kunden.',
      btnText: 'Rechnung jetzt erstellen',
      badge: 'Phase 4: Abrechnung',
      action: () => handleRequestInvoice(activeOrder)
    };
  };

  const nextStep = getNextStep();

  // Clean phone and WhatsApp sender
  const cleanPhone = (customer?.phone || '').replace(/[^0-9]/g, '');

  const formatTemplateText = (templateBody: string) => {
    let text = templateBody || '';
    const lastName = (customer?.lastName || '').trim();
    const firstName = (customer?.firstName || '').trim();
    const cName = customer?.type === 'firma' 
      ? lastName 
      : `${firstName} ${lastName}`.trim() || lastName || 'Kunde';

    const salutationRaw = (customer?.salutation || activeOrder?.orderMeta?.salutation || '').toLowerCase();
    let formalAnrede = 'Sehr geehrte Damen und Herren';
    if (customer?.type !== 'firma' && lastName) {
      if (salutationRaw.includes('herr')) {
        formalAnrede = `Sehr geehrter Herr ${lastName}`;
      } else if (salutationRaw.includes('frau')) {
        formalAnrede = `Sehr geehrte Frau ${lastName}`;
      } else {
        formalAnrede = `Guten Tag ${cName}`;
      }
    }

    // Salutation & Names
    text = text.replace(/\{\{Kunde_Anrede\}\}/g, formalAnrede);
    text = text.replace(/\[Anrede\]/g, formalAnrede);
    text = text.replace(/\{\{Kunde_Name\}\}/g, cName);
    text = text.replace(/\[Name\]/g, cName);
    text = text.replace(/\{\{Kunde_Nachname\}\}/g, lastName || cName);
    text = text.replace(/\[Nachname\]/g, lastName || cName);

    // Moving Date
    const rawMoveDate = activeOrder?.orderMeta?.movingDateFrom || activeOrder?.movingDate || activeOrder?.logistics?.movingDate;
    let moveDate = 'vereinbartem Datum';
    if (rawMoveDate) {
      try {
        moveDate = new Date(rawMoveDate).toLocaleDateString('de-DE');
      } catch {
        moveDate = String(rawMoveDate);
      }
    }
    text = text.replace(/\{\{Umzugsdatum\}\}/g, moveDate);
    text = text.replace(/\[Datum\]/g, moveDate);

    // Offer / Order Total Price
    const totalGross = activeOrder?.totals?.gross 
      ? `${Number(activeOrder.totals.gross).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
      : (activeOrder?.price ? `${Number(activeOrder.price).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : 'wie vereinbart');
    text = text.replace(/\{\{Angebot_Summe\}\}/g, totalGross);
    text = text.replace(/\[Summe\]/g, totalGross);

    // Order & Invoice Numbers
    const orderNum = activeOrder?.orderNumber || activeOrder?.id || '';
    text = text.replace(/\{\{Auftragsnummer\}\}/g, orderNum);
    text = text.replace(/\[Auftrag\]/g, orderNum);

    const invNum = activeInvoiceNumber || linkedInvoice?.invoiceNumber || activeOrder?.invoiceNumber || 'liegt bei';
    text = text.replace(/\{\{Rechnungsnummer\}\}/g, invNum);
    text = text.replace(/\[Rechnung\]/g, invNum);

    // Employee / Sachbearbeiter
    const employee = profile?.displayName && !profile.displayName.includes('@')
      ? profile.displayName
      : 'Tarek Lababidi';
    text = text.replace(/\{\{Sachbearbeiter\}\}/g, employee);
    text = text.replace(/\[Mitarbeiter\]/g, employee);

    return text;
  };

  const handleSendWhatsApp = (bodyToSend: string) => {
    if (!cleanPhone) {
      toast.error('Keine gültige Telefonnummer für diesen Kunden hinterlegt.');
      return;
    }
    const finalMsg = formatTemplateText(bodyToSend);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalMsg)}`;
    window.open(waUrl, '_blank');
    setShowWhatsAppModal(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-in fade-in duration-300">
      
      {/* Top Header Card with Integrated 4-Phase Pipeline */}
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 font-headline">
                <span className={`w-2 h-2 rounded-full ${currentPhaseInfo.phase === 3 ? 'bg-emerald-500 animate-pulse' : currentPhaseInfo.phase === 4 ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
                {activeOrder ? (currentPhaseInfo.phase >= 3 ? 'Bestätigter Auftrag' : 'Angebot in Bearbeitung') : 'Kundenprofil'}
              </span>
              <span className="text-xs font-semibold text-slate-400">
                Kunden-ID: #{customer?.id?.slice(-5).toUpperCase() || 'KD'}
              </span>
              {customer?.source && (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getSourceBadgeStyle(customer.source)}`}>
                  {customer.source}
                </span>
              )}
              {activeOrder && (
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {activeOrder.orderNumber || `Auftrag #${activeOrder.id.slice(-5).toUpperCase()}`}
                </span>
              )}
              {moveCountdown && (
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full ${moveCountdown.color}`}>
                  Umzug: {moveCountdown.text}
                </span>
              )}
              {orders.length > 1 && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  {orders.length} Angebote/Aufträge
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white font-headline tracking-tight">
              {fullName}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onEditCustomer}
              className="px-3 py-1.5 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer shadow-2xs"
            >
              <PencilSquareIcon className="w-3.5 h-3.5" />
              <span>Kundendaten</span>
            </button>

            {activeOrder && (
              <Link
                href={`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`}
                className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-[#6E8F64] hover:bg-[#5C7A53] text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <DocumentTextIcon className="w-3.5 h-3.5" />
                <span>Angebot bearbeiten</span>
              </Link>
            )}

            <Link
              href={`/dashboard/customers/${customer.id}/new-order`}
              className="py-1.5 px-3.5 rounded-xl font-bold text-xs bg-[#6E8F64]/15 hover:bg-[#6E8F64] text-[#435E3A] dark:text-[#B5D1AC] hover:text-white border border-[#6E8F64]/35 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <span>+ Neues Angebot</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Top Priority 3-Card Executive Dashboard (Kontaktdaten, Termine & Umfang, Finanzen) */}
      <div className={`grid grid-cols-1 ${activeOrder ? 'md:grid-cols-2 lg:grid-cols-3' : 'max-w-md'} gap-4 items-stretch`}>
        
        {/* 1. Kontaktdaten Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                Kontaktdaten
              </span>
              <button
                type="button"
                onClick={onEditCustomer}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                title="Kundendaten bearbeiten"
              >
                <PencilSquareIcon className="w-3.5 h-3.5" />
                <span>Bearbeiten</span>
              </button>
            </div>

            <div className="space-y-2 text-xs">
              {/* Phone */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <PhoneIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block leading-none mb-0.5">Telefon</span>
                    <a href={`tel:${customer?.phone}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-primary truncate block">
                      {customer?.phone || 'Keine Nummer hinterlegt'}
                    </a>
                  </div>
                </div>
                {customer?.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-primary hover:text-white transition-colors text-slate-700 dark:text-slate-200 shrink-0"
                    title="Anrufen"
                  >
                    <PhoneIcon className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#6E8F64]/10 text-[#6E8F64] dark:text-[#93B489] flex items-center justify-center shrink-0">
                    <EnvelopeIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block leading-none mb-0.5">E-Mail</span>
                    <a href={`mailto:${customer?.email}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-primary truncate block max-w-[140px] sm:max-w-[180px]">
                      {customer?.email || 'Keine E-Mail hinterlegt'}
                    </a>
                  </div>
                </div>
                {customer?.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-primary hover:text-white transition-colors text-slate-700 dark:text-slate-200 shrink-0"
                    title="E-Mail schreiben"
                  >
                    <EnvelopeIcon className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Main Address */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <HomeIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block leading-none mb-0.5">Kundenadresse</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                      {customer?.street ? `${customer.street}, ${customer.zip || ''} ${customer.city || ''}` : 'Keine Stamm-Adresse hinterlegt'}
                    </span>
                  </div>
                </div>
                {customer?.street && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([customer.street, customer.houseNr, customer.zip, customer.city].filter(Boolean).join(' '))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-primary hover:text-white transition-colors text-slate-700 dark:text-slate-200 shrink-0"
                    title="In Google Maps öffnen"
                  >
                    <MapPinIcon className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Move Schedule & Scope Card (Synchronized with Cockpit & Offer Form) */}
        {activeOrder && (() => {
          const hasInventoryItems = Boolean(
            (Array.isArray(activeOrder.inventory) && activeOrder.inventory.length > 0) ||
            (Array.isArray(orderLogistics.items) && orderLogistics.items.length > 0)
          );
          const rawVol = Number(orderLogistics.estimatedVolume || activeOrder?.estimatedCbm || 0);
          const isLegacyPhantomVol = !hasInventoryItems && activeOrder?.logistics?.truckChoice !== 'custom' && (rawVol === 18 || rawVol === 30);
          const displayVol = isLegacyPhantomVol ? 0 : rawVol;

          const hasHVZService = hasFixedService(activeOrder.services, 'hvz');
          const showHvzRow = Boolean(
            activeOrder.logistics?.a_parking ||
            activeOrder.logistics?.b_parking ||
            activeOrder.logistics?.needHVZ ||
            hasHVZService ||
            activeOrder.services?.halteverbot ||
            activeOrder.logistics?.hvzDate ||
            activeOrder.orderMeta?.halteverbotDate ||
            isTaskCompleted(activeOrder, 'hvz')
          );

          const hasKartonService = hasFixedService(activeOrder.services, 'kartons');
          const hasKartonDate = Boolean(activeOrder.orderMeta?.kartonDeliveryDate || activeOrder.logistics?.boxDeliveryDate);
          const showKartonRow = Boolean(
            hasKartonService ||
            hasKartonDate ||
            (Array.isArray(activeOrder.logistics?.materials) && activeOrder.logistics.materials.some((m: any) => (Number(m.quantity) || Number(m.count) || 0) > 0)) ||
            Number(activeOrder.orderMeta?.boxesCount || activeOrder.logistics?.boxesCount || 0) > 0
          );

          const hasLiftService = hasFixedService(activeOrder.services, 'moebellift');
          const showLiftRow = Boolean(
            activeOrder.logistics?.a_furnitureLift ||
            activeOrder.logistics?.b_furnitureLift ||
            activeOrder.logistics?.needLift ||
            hasLiftService ||
            activeOrder.orderMeta?.moebelliftDate ||
            activeOrder.logistics?.moebelliftDate ||
            isTaskCompleted(activeOrder, 'moebellift')
          );

          return (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                Termine & Umfang (Live-Sync)
              </span>
              <CalendarDaysIcon className="w-5 h-5 text-[#6E8F64]" />
            </div>

            <div className="flex items-baseline justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Haupt-Umzugstermin
                </span>
                <div className="text-xl font-bold text-slate-900 dark:text-white font-headline">
                  {logisticsEval?.movingDateDisplay || 'Kein Termin eingetragen'}
                </div>
              </div>
              {displayVol > 0 && (
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                  {displayVol} m³
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
              {/* 1. Besichtigungstermin */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Besichtigung:</span>
                <button
                  type="button"
                  onClick={() => setScheduleModalTodo({ id: 'viewing_requested', name: 'Besichtigung' })}
                  className="font-bold text-right hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                  title="Klicken zum Planen oder Ändern des Besichtigungstermins"
                >
                  {activeOrder.orderMeta?.viewingDate && activeOrder.orderMeta?.viewingDate !== 'requested' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatCustomerDate(activeOrder.orderMeta.viewingDate, activeOrder.orderMeta.viewingTime)}</span>
                      {currentPhaseInfo.phase >= 3 && (
                        <span className="text-[10px] text-slate-400 font-normal ml-0.5">(Erledigt)</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-primary underline">+ Termin planen</span>
                  )}
                </button>
              </div>

              {/* 2. Halteverbotszone (HVZ) - nur wenn gebucht oder geplant */}
              {showHvzRow && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                    <span>Halteverbot (HVZ):</span>
                    {(activeOrder.orderMeta?.hvzMethod || activeOrder.logistics?.hvzMethod) && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                        {(activeOrder.orderMeta?.hvzMethod || activeOrder.logistics?.hvzMethod) === 'extern' ? 'Extern' : 'Selbst'}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setScheduleModalTodo({ id: 'halteverbot', kanbanCategory: 'halteverbot', name: 'Halteverbot' })}
                    className="font-bold text-right hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                    title="Klicken zum Planen oder Ändern der Halteverbotszone"
                  >
                    {(activeOrder.orderMeta?.halteverbotDate || activeOrder.logistics?.hvzDate || activeOrder.orderMeta?.halteverbotDateA || activeOrder.orderMeta?.halteverbotDateB) ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 flex-wrap justify-end">
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {(activeOrder.orderMeta?.hvzLocation || activeOrder.logistics?.hvzLocation) === 'both' && (activeOrder.orderMeta?.halteverbotDateA || activeOrder.orderMeta?.halteverbotDateB)
                            ? `A: ${formatCustomerDate(activeOrder.orderMeta?.halteverbotDateA || activeOrder.orderMeta?.halteverbotDate, activeOrder.orderMeta?.halteverbotTimeA || activeOrder.orderMeta?.halteverbotTime)} | B: ${formatCustomerDate(activeOrder.orderMeta?.halteverbotDateB || activeOrder.orderMeta?.halteverbotDate, activeOrder.orderMeta?.halteverbotTimeB || activeOrder.orderMeta?.halteverbotTime)}`
                            : formatCustomerDate(activeOrder.orderMeta?.halteverbotDate || activeOrder.logistics?.hvzDate || activeOrder.orderMeta?.halteverbotDateA || activeOrder.orderMeta?.halteverbotDateB, activeOrder.orderMeta?.halteverbotTime || activeOrder.logistics?.hvzTime || activeOrder.orderMeta?.halteverbotTimeA || activeOrder.orderMeta?.halteverbotTimeB)
                          }
                        </span>
                        <PencilSquareIcon className="w-3.5 h-3.5 text-slate-400 hover:text-primary shrink-0 ml-0.5 inline" title="Termin anpassen" />
                      </span>
                    ) : (
                      <span className="text-primary underline">+ Termin planen</span>
                    )}
                  </button>
                </div>
              )}

              {/* 3. Kartonlieferung - nur wenn gebucht oder geplant */}
              {showKartonRow && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Kartonlieferung:</span>
                  <button
                    type="button"
                    onClick={() => setScheduleModalTodo({ id: 'kartons_liefern', kanbanCategory: 'kartons', name: 'Kartons' })}
                    className="font-bold text-right hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                    title="Klicken zum Planen oder Ändern der Kartonlieferung"
                  >
                    {activeOrder.orderMeta?.kartonDeliveryDate || activeOrder.logistics?.boxDeliveryDate ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 flex-wrap justify-end">
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>{formatCustomerDate(activeOrder.orderMeta?.kartonDeliveryDate || activeOrder.logistics?.boxDeliveryDate, activeOrder.orderMeta?.kartonDeliveryTime || activeOrder.logistics?.boxDeliveryTime)}</span>
                        <PencilSquareIcon className="w-3.5 h-3.5 text-slate-400 hover:text-primary shrink-0 ml-0.5 inline" title="Termin anpassen" />
                      </span>
                    ) : (
                      <span className="text-primary underline">+ Termin planen</span>
                    )}
                  </button>
                </div>
              )}

              {/* 4. Möbellift - nur wenn gebucht oder geplant */}
              {showLiftRow && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Möbellift:</span>
                  <button
                    type="button"
                    onClick={() => setScheduleModalTodo({ id: 'moebellift_buchen', kanbanCategory: 'moebellift', name: 'Möbellift' })}
                    className="font-bold text-right hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                    title="Klicken zum Planen oder Ändern des Möbellifts"
                  >
                    {(activeOrder.orderMeta?.moebelliftDate || activeOrder.logistics?.moebelliftDate || activeOrder.orderMeta?.moebelliftDateA || activeOrder.orderMeta?.moebelliftDateB) ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 flex-wrap justify-end">
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {(activeOrder.orderMeta?.moebelliftLocation || activeOrder.logistics?.moebelliftLocation) === 'both' && (activeOrder.orderMeta?.moebelliftDateA || activeOrder.orderMeta?.moebelliftDateB)
                            ? `A: ${formatCustomerDate(activeOrder.orderMeta?.moebelliftDateA || activeOrder.orderMeta?.moebelliftDate, activeOrder.orderMeta?.moebelliftTimeA || activeOrder.orderMeta?.moebelliftTime)} | B: ${formatCustomerDate(activeOrder.orderMeta?.moebelliftDateB || activeOrder.orderMeta?.moebelliftDate, activeOrder.orderMeta?.moebelliftTimeB || activeOrder.orderMeta?.moebelliftTime)}`
                            : formatCustomerDate(activeOrder.orderMeta?.moebelliftDate || activeOrder.logistics?.moebelliftDate || activeOrder.orderMeta?.moebelliftDateA || activeOrder.orderMeta?.moebelliftDateB, activeOrder.orderMeta?.moebelliftTime || activeOrder.orderMeta?.moebelliftTimeA || activeOrder.orderMeta?.moebelliftTimeB)
                          }
                        </span>
                        <PencilSquareIcon className="w-3.5 h-3.5 text-slate-400 hover:text-primary shrink-0 ml-0.5 inline" title="Termin anpassen" />
                      </span>
                    ) : (
                      <span className="text-primary underline">+ Termin planen</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
          );
        })()}

        {/* 3. For Disponent: Finanzen & Zahlung / For Teamleiter: Umzugsteam & Fuhrpark (Zero Prices) */}
        {activeOrder && (
          !isTeamLead ? (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                  Finanzen &amp; Zahlung
                </span>
                <CurrencyEuroIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-headline">
                  €{totals.gross.toLocaleString('de-DE')}
                </span>
                <span className="text-xs font-semibold text-slate-400">Brutto</span>
              </div>

              {/* Payment Progress Bar */}
              <div className="space-y-1.5 pt-1">
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${paidPercentage}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[11px] font-medium text-slate-500">
                  <span>Bezahlt: €{totalPaid.toLocaleString('de-DE')} ({paidPercentage}%)</span>
                  <span className={!hasInvoice ? 'text-slate-400 font-semibold' : openAmount > 0 ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-600 font-bold'}>
                    {!hasInvoice 
                      ? latestCancelledInvoiceNum ? `Storniert (${latestCancelledInvoiceNum}) – Korrektur offen` : 'Rechnung noch offen' 
                      : openAmount > 0 
                        ? `Offen: €${openAmount.toLocaleString('de-DE')}` 
                        : 'Ausgeglichen'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                  Umzugsteam &amp; Fuhrpark
                </span>
                <TruckIcon className="w-5 h-5 text-[#6E8F64]" />
              </div>
              
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white font-headline">
                  {activeOrder.disposition?.helpers || 0} Helfer • {(Number(activeOrder.disposition?.koffer35t) || 0) + (Number(activeOrder.disposition?.lkw7t) || 0)} LKW
                </span>
              </div>

              <div className="pt-1 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span>Volumen:</span>
                  <strong className="text-slate-700 dark:text-slate-300">ca. {activeOrder.estimatedCbm || activeOrder.orderMeta?.estimatedCbm || '–'} m³</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Teamleiter:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    {activeOrder.disposition?.assignedTeamLeadName || activeOrder.assignedTeamLeadName || 'Kein Teamleiter'}
                  </strong>
                </div>
              </div>
            </div>
          )
        )}

      </div>

      {/* Consolidated Schnellaktionen & Dokumente Hub (Smart Phase-Aware) */}
      {activeOrder && (() => {
        const isSigned = Boolean(
          logisticsEval?.angebotStatus?.isSigned || 
          activeOrder?.contractSigned || 
          activeOrder?.isManuallySigned || 
          activeOrder?.signatureOrder
        );
        const isMoveDone = Boolean(
          activeOrder?.status === 'completed' || 
          activeOrder?.status === 'invoice_open' || 
          activeOrder?.status === 'invoice_paid'
        );

        // Individual Action Renderers
        const renderWhatsAppBtn = (inMenu = false) => (
          <button
            key="wa"
            type="button"
            onClick={() => {
              const defaultT = allWaTemplates.find((t: any) => t.id === 't3') || allWaTemplates[0];
              if (defaultT) {
                setSelectedWaTemplateId(defaultT.id);
                setWaCustomText(formatTemplateText(defaultT.body));
              }
              setShowWhatsAppModal(true);
              if (inMenu) setActionsDropdownOpen(false);
            }}
            className={inMenu 
              ? "w-full text-left px-3.5 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer" 
              : "px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            }
            title="WhatsApp Chat mit hinterlegter Vorlage starten"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>WhatsApp</span>
          </button>
        );

        const renderAngebotPdfBtn = (inMenu = false) => {
          const hasContent = isOrderPricedAndServiced(activeOrder);
          return (
            <button
              key="angebot_pdf"
              type="button"
              onClick={() => {
                handleOrderPdfClick(activeOrder);
                if (inMenu) setActionsDropdownOpen(false);
              }}
              className={inMenu 
                ? "w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center justify-between gap-2.5 transition-colors cursor-pointer" 
                : `px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                  !hasContent
                    ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-300/70 dark:border-slate-700/60 hover:border-amber-500/50'
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-primary/50'
                }`
              }
              title={!hasContent ? "Angebot enthält noch keine Leistungen oder Preise (0,00 €)" : "Angebot als PDF anzeigen oder drucken"}
            >
              <div className="flex items-center gap-2">
                <DocumentTextIcon className={`w-4 h-4 shrink-0 ${!hasContent ? 'text-slate-400' : 'text-primary'}`} />
                <span>Angebot PDF</span>
              </div>
              {!hasContent && (
                <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded font-normal border border-amber-500/30">
                  0 €
                </span>
              )}
            </button>
          );
        };

        const renderSignierenBtn = (inMenu = false) => {
          if (!onOpenSignatureModal) return null;
          return (
            <button
              key="signieren"
              type="button"
              onClick={() => {
                onOpenSignatureModal(activeOrder);
                if (inMenu) setActionsDropdownOpen(false);
              }}
              className={inMenu 
                ? "w-full text-left px-3.5 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer" 
                : "px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-500/30 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              }
              title="Vertrag digital signieren"
            >
              <CheckCircleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Digital signieren</span>
            </button>
          );
        };

        const renderLaufzettelBtn = (inMenu = false) => (
          <button
            key="laufzettel"
            type="button"
            onClick={() => {
              onViewPdf(activeOrder, 'employee');
              if (inMenu) setActionsDropdownOpen(false);
            }}
            className={inMenu 
              ? "w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer" 
              : "px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 shadow-xs hover:border-amber-500/50 cursor-pointer"
            }
            title="Mitarbeiter-Laufzettel ausdrucken"
          >
            <TruckIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Laufzettel</span>
          </button>
        );

        const renderProtokollBtn = (inMenu = false) => {
          if (hasActiveProtocols) {
            if (inMenu) {
              return (
                <button
                  key="protokoll"
                  type="button"
                  onClick={() => {
                    onViewPdf(activeOrder, 'protocol');
                    setActionsDropdownOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-[#3B5233] dark:text-[#B5D1AC] hover:bg-[#6E8F64]/10 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <ClipboardDocumentCheckIcon className="w-4 h-4 text-[#6E8F64] dark:text-[#93B489] shrink-0" />
                  <span>Protokoll ({activeProtocols.length}) anzeigen</span>
                </button>
              );
            }
            return (
              <div key="protokoll" className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onViewPdf(activeOrder, 'protocol')}
                  className="px-3.5 py-1.5 rounded-xl bg-[#6E8F64]/10 hover:bg-[#6E8F64]/20 text-[#3B5233] dark:text-[#B5D1AC] text-xs font-bold border border-[#6E8F64]/30 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Übergabeprotokoll als PDF ansehen / drucken"
                >
                  <ClipboardDocumentCheckIcon className="w-4 h-4 text-[#6E8F64] dark:text-[#93B489]" />
                  <span>Protokoll ({activeProtocols.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenProtocolModal(activeOrder)}
                  className="p-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  title="Weiteres Protokoll erfassen"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            );
          }
          return (
            <button
              key="protokoll"
              type="button"
              onClick={() => {
                onOpenProtocolModal(activeOrder);
                if (inMenu) setActionsDropdownOpen(false);
              }}
              className={inMenu 
                ? "w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer" 
                : "px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 shadow-xs hover:border-[#6E8F64]/60 cursor-pointer"
              }
              title="Übergabeprotokoll öffnen / erfassen"
            >
              <ClipboardDocumentCheckIcon className="w-4 h-4 text-[#6E8F64] dark:text-[#93B489] shrink-0" />
              <span>+ Protokoll erfassen</span>
            </button>
          );
        };

        const renderRechnungBtn = (inMenu = false) => {
          if (hasInvoice) {
            if (inMenu) {
              return (
                <button
                  key="rechnung"
                  type="button"
                  onClick={() => {
                    onViewPdf(linkedInvoice || activeOrder, 'invoice');
                    setActionsDropdownOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <DocumentCheckIcon className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>{(linkedInvoice?.isKorrektur || activeOrder?.isKorrektur) ? 'Korrekturrechnung' : 'Rechnung'} {invoiceNumberDisplay ? `(${invoiceNumberDisplay})` : 'PDF'}</span>
                </button>
              );
            }
            return (
              <div key="rechnung" className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onViewPdf(linkedInvoice || activeOrder, 'invoice')}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Rechnung als PDF ansehen"
                >
                  <DocumentCheckIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>{(linkedInvoice?.isKorrektur || activeOrder?.isKorrektur) ? 'Korrekturrechnung' : 'Rechnung'} {invoiceNumberDisplay ? `(${invoiceNumberDisplay})` : 'PDF'}</span>
                </button>
                {!activeOrder?.isStorno && activeOrder?.status !== 'invoice_cancelled' && activeOrder?.status !== 'canceled' && (
                  <button
                    type="button"
                    onClick={() => setStornoInvoice(linkedInvoice || activeOrder)}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-200 dark:border-amber-800 transition-all cursor-pointer"
                    title="Rechnung stornieren (GoBD Storno-Beleg)"
                  >
                    Storno
                  </button>
                )}
              </div>
            );
          }
          return (
            <button
              key="rechnung"
              type="button"
              onClick={() => {
                handleRequestInvoice(activeOrder);
                if (inMenu) setActionsDropdownOpen(false);
              }}
              className={inMenu 
                ? "w-full text-left px-3.5 py-2.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/30 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer" 
                : `px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  latestCancelledInvoiceNum
                    ? 'bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-dashed border-slate-300 dark:border-slate-700'
                }`
              }
              title={latestCancelledInvoiceNum ? `Rechnung ${latestCancelledInvoiceNum} wurde storniert. Klicken, um eine Korrekturrechnung zu erstellen.` : "Noch keine Rechnung ausgestellt. Klicken zum Erstellen."}
            >
              <DocumentCheckIcon className={`w-4 h-4 shrink-0 ${latestCancelledInvoiceNum ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`} />
              <span>{latestCancelledInvoiceNum ? '+ Korrekturrechnung erstellen' : '+ Rechnung erstellen'}</span>
            </button>
          );
        };

        const renderZahlungBtn = (inMenu = false) => (
          <button
            key="zahlung"
            type="button"
            onClick={() => {
              handleRequestPayment(activeOrder);
              if (inMenu) setActionsDropdownOpen(false);
            }}
            className={inMenu 
              ? "w-full text-left px-3.5 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl flex items-center justify-between gap-2.5 transition-colors cursor-pointer" 
              : `px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                hasInvoice
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 text-slate-500 border-slate-300 dark:border-slate-700 opacity-80'
              }`
            }
            title={hasInvoice ? "Zahlung auf Rechnung erfassen" : "Keine Rechnung vorhanden (Klicken zum Erstellen)"}
          >
            <div className="flex items-center gap-2">
              <CurrencyEuroIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Zahlung erfassen</span>
            </div>
            {!hasInvoice && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-normal">
                fehlt
              </span>
            )}
          </button>
        );

        const renderStornoBtn = () => {
          if (!hasInvoice || activeOrder?.isStorno || activeOrder?.status === 'invoice_cancelled' || activeOrder?.status === 'canceled') return null;
          return (
            <button
              key="storno"
              type="button"
              onClick={() => {
                setStornoInvoice(linkedInvoice || activeOrder);
                setActionsDropdownOpen(false);
              }}
              className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
              title="Rechnung stornieren (GoBD Storno-Beleg)"
            >
              <span className="material-symbols-outlined text-base text-amber-600 dark:text-amber-400 shrink-0">cancel</span>
              <span>Rechnung stornieren (GoBD Storno)</span>
            </button>
          );
        };

        const renderReklamationBtn = (inMenu = false) => {
          if (!onOpenClaimModal) return null;
          return (
            <button
              key="reklamation"
              type="button"
              onClick={() => {
                onOpenClaimModal(activeOrder);
                if (inMenu) setActionsDropdownOpen(false);
              }}
              className={inMenu 
                ? "w-full text-left px-3.5 py-2.5 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                : "px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 text-xs font-bold border border-red-500/30 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              }
              title="Schaden / Reklamation erfassen"
            >
              <ExclamationTriangleIcon className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
              <span>Schaden / Reklamation melden</span>
            </button>
          );
        };

        const renderKalenderBtn = (inMenu = false) => {
          const hasMovingDate = Boolean(activeOrder.orderMeta?.movingDateFrom || activeOrder.movingDate || activeOrder.disposition?.movingDate);
          const hasViewingDate = Boolean(activeOrder.orderMeta?.viewingDate);
          if (!hasMovingDate && !hasViewingDate) return null;

          return (
            <button
              key="kalender"
              type="button"
              onClick={() => {
                if (hasMovingDate) {
                  exportOrderMoveToCalendar(activeOrder);
                } else {
                  exportOrderViewingToCalendar(activeOrder);
                }
                if (inMenu) setActionsDropdownOpen(false);
              }}
              className={inMenu 
                ? "w-full text-left px-3.5 py-2.5 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                : "px-3.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-500/30 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              }
              title="Termin in Outlook / Samsung Kalender eintragen"
            >
              <CalendarDaysIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>In Kalender eintragen</span>
            </button>
          );
        };

        const renderEmailBtn = (inMenu = false) => {
          return (
            <button
              key="email-sender"
              type="button"
              onClick={() => {
                if (inMenu) setActionsDropdownOpen(false);
                setEmailModalOrder(activeOrder);
              }}
              className={inMenu 
                ? "w-full text-left px-3.5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer" 
                : "px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold border border-primary/30 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              }
              title="Angebot / Rechnung per E-Mail direkt an den Kunden senden"
            >
              <EnvelopeIcon className="w-4 h-4 text-primary shrink-0" />
              <span>E-Mail senden</span>
            </button>
          );
        };

        // Smart dynamic selection based on phase & signing state
        let primaryActions: React.ReactNode[] = [];
        let menuActions: (React.ReactNode | null)[] = [];

        if (isTeamLead) {
          // Teamleiter: Ausschlielich operative Aktionen (Laufzettel, Protokoll, Kalender, Reklamation)
          primaryActions = [
            renderLaufzettelBtn(false),
            renderProtokollBtn(false),
            renderKalenderBtn(false),
          ];
          menuActions = [
            renderReklamationBtn(true),
          ];
        } else if (currentPhaseInfo.phase <= 2 && !isSigned) {
          // Phase 1 & 2: Negotiation / Offer
          primaryActions = [
            renderAngebotPdfBtn(false),
            renderWhatsAppBtn(false),
            renderSignierenBtn(false),
          ];
          menuActions = [
            renderEmailBtn(true),
            renderKalenderBtn(true),
            renderLaufzettelBtn(true),
            renderProtokollBtn(true),
            renderRechnungBtn(true),
            renderZahlungBtn(true),
            renderReklamationBtn(true),
          ];
        } else if (currentPhaseInfo.phase === 3 && !hasInvoice && !isMoveDone) {
          // Phase 3: Confirmed / Move Preparation
          primaryActions = [
            renderAngebotPdfBtn(false),
            renderWhatsAppBtn(false),
            renderLaufzettelBtn(false),
            renderProtokollBtn(false),
          ];
          menuActions = [
            renderEmailBtn(true),
            renderKalenderBtn(true),
            renderRechnungBtn(true),
            renderZahlungBtn(true),
            renderSignierenBtn(true),
            renderReklamationBtn(true),
          ];
        } else {
          // Phase 4: Billing / Settlement
          primaryActions = [
            renderAngebotPdfBtn(false),
            renderRechnungBtn(false),
            renderZahlungBtn(false),
            renderProtokollBtn(false),
            renderWhatsAppBtn(false),
          ];
          menuActions = [
            renderEmailBtn(true),
            renderKalenderBtn(true),
            renderLaufzettelBtn(true),
            renderStornoBtn(),
            renderReklamationBtn(true),
          ];
        }

        const validMenuActions = menuActions.filter(Boolean);

        return (
          <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#6E8F64] animate-pulse"></span>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-headline uppercase tracking-wider block">
                  Aktionen & Dokumente
                </span>
                <span className="text-[10px] text-slate-400 font-medium block">
                  Auftrag #{activeOrder.orderNumber || activeOrder.id?.slice(-5).toUpperCase()}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {primaryActions}

              {/* Elegant Dropdown for Secondary / Contextual Actions */}
              {validMenuActions.length > 0 && (
                <div className="relative" ref={actionsDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setActionsDropdownOpen(prev => !prev)}
                    className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                    title="Weitere Aktionen anzeigen"
                  >
                    <EllipsisHorizontalIcon className="w-5 h-5" />
                  </button>

                  {actionsDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1">
                      <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Weitere Aktionen
                        </span>
                      </div>
                      {validMenuActions.map((actionNode, idx) => (
                        <div key={idx}>{actionNode}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Streamlined Executive Phase Bar: Ultra-Compact Single Row */}
      {activeOrder && (
        <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Left: 4 Interactive Phase Circles & Status Label */}
          <div className="flex items-center gap-3 min-w-0">
            {/* 4 Phase Circles with numbers, warnings and checkmarks */}
            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { num: 1, label: '1. Entwurf' },
                { num: 2, label: '2. Angebot' },
                { num: 3, label: '3. Bestätigt' },
                { num: 4, label: '4. Abrechnung' }
              ].map((st, i) => {
                const hasContact = Boolean(customer?.phone?.trim() || customer?.email?.trim() || activeOrder?.phone?.trim() || activeOrder?.email?.trim());
                const isPhase1Incomplete = st.num === 1 && !hasContact;
                const isDone = currentPhaseInfo.phase > st.num && !isPhase1Incomplete;
                const isWarning = currentPhaseInfo.phase > st.num && isPhase1Incomplete;
                const isCurrent = currentPhaseInfo.phase === st.num;

                return (
                  <React.Fragment key={st.num}>
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerInitialPhase(st.num);
                        setDrawerOrder(activeOrder);
                      }}
                      title={`Phase ${st.num}: ${st.label} (${isWarning ? 'Unvollständig (Telefon oder E-Mail fehlt)' : isDone ? 'Erledigt' : isCurrent ? 'Aktiv' : 'Offen'}) • Klicken für Details`}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[#6E8F64] text-white ring-2 ring-[#6E8F64]/30 shadow-xs scale-105'
                          : isWarning
                            ? 'bg-amber-500 text-white shadow-xs'
                            : isDone
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {isWarning ? (
                        <ExclamationTriangleIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                      ) : isDone ? (
                        <CheckIcon className="w-3.5 h-3.5 stroke-[3]" />
                      ) : (
                        st.num
                      )}
                    </button>
                    {i < 3 && (
                      <div className={`w-3 h-0.5 ${currentPhaseInfo.phase > st.num ? (isWarning ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-200 dark:bg-slate-800'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Current Phase Badge & Tasks Progress with Visual Percentage Bar */}
            <div className="min-w-0 flex flex-col justify-center">
              {(() => {
                const openItems = checklist.filter(c => !c.done);
                const percent = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;
                const tooltipText = percent === 100 
                  ? 'Alle Aufgaben dieser Phase erledigt (100% ✓)' 
                  : `Noch offen für 100%:\n${openItems.map(i => `• ${i.label}`).join('\n')}`;

                return (
                  <div
                    className="group cursor-pointer select-none"
                    title={tooltipText}
                    onClick={() => {
                      setDrawerInitialPhase(currentPhaseInfo.phase);
                      setDrawerOrder(activeOrder);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-slate-800 dark:text-slate-100 truncate group-hover:text-[#6E8F64] transition-colors">
                        Phase {currentPhaseInfo.phase}: {currentPhaseInfo.label}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hidden sm:inline">
                        • {completedCount}/{checklist.length} Aufgaben
                      </span>
                    </div>

                    {/* Visual Percentage Progress Bar with clear hover & subtle hint */}
                    {checklist.length > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-20 sm:w-28 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              percent === 100
                                ? 'bg-emerald-500'
                                : percent >= 50
                                  ? 'bg-[#6E8F64]'
                                  : 'bg-amber-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-extrabold ${
                          percent === 100
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}>
                          {percent}%
                        </span>

                        {/* Clean, elegant hint: exactly what is missing for 100% */}
                        {percent < 100 && openItems.length > 0 && (
                          <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 font-medium truncate max-w-[240px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span className="truncate">Noch offen: {openItems[0].label}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Right: Direct Cockpit Drawer Access Button */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => {
                setDrawerInitialPhase(currentPhaseInfo.phase);
                setDrawerOrder(activeOrder);
              }}
              className="py-2 px-3.5 rounded-xl bg-[#6E8F64] hover:bg-[#5C7A53] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs shadow-[#6E8F64]/20 cursor-pointer"
              title="Operatives Cockpit & Checkliste öffnen"
            >
              <AdjustmentsHorizontalIcon className="w-4 h-4 text-white" />
              <span>Operatives Cockpit</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      )}

      {/* Teamleiter-Zuweisung & Operativer Laufzettel (Elegantes Zuweisungs-Panel) */}
      {activeOrder && activeOrder.status !== 'archived' && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Left: Icon & Description */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <UserGroupIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-headline font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                    Zuständiger Teamleiter &amp; Laufzettel
                  </h3>
                  {(activeOrder.disposition?.assignedTeamLeadName || activeOrder.assignedTeamLeadName) ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>{activeOrder.disposition?.assignedTeamLeadName || activeOrder.assignedTeamLeadName}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                      <span>Noch nicht zugewiesen</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-xl">
                  {isTeamLead 
                    ? "Hier können Sie den vollständigen operativen Laufzettel mit Umzugsgut, Belade- & Entladestelle und Checkliste einsehen."
                    : "Wählen Sie den verantwortlichen Teamleiter. Nur der eingeteilte Teamleiter sieht diesen Umzug in seinem Kalender und erhält den operativen Laufzettel."
                  }
                </p>
              </div>
            </div>

            {/* Right: Interactive Dropdown & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              {!isTeamLead ? (
                <>
                  <div className="relative min-w-[210px]">
                    <select
                      value={activeOrder.disposition?.assignedTeamLeadUid || activeOrder.assignedTeamLeadUid || ''}
                      onChange={(e) => handleAssignTeamLead(e.target.value)}
                      disabled={isAssigningTeamLead}
                      className="w-full appearance-none pl-3.5 pr-9 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#6E8F64]/40 cursor-pointer disabled:opacity-50"
                      title="Teamleiter für diesen Umzug auswählen"
                    >
                      <option value="">-- Kein Teamleiter zugewiesen --</option>
                      {teamLeads.map((lead) => (
                        <option key={lead.uid} value={lead.uid}>
                          {lead.displayName} ({lead.role === 'teamlead' ? 'Teamleiter' : 'Admin'})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDownIcon className="w-4 h-4" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onViewPdf(activeOrder, 'employee')}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-500/30 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                    title="Mitarbeiter-Laufzettel (PDF ohne Preise) ansehen / ausdrucken"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Laufzettel (PDF)</span>
                  </button>

                  {(hasA || hasB) && (
                    <a
                      href={hasA && hasB
                        ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(aAddressFull)}&destination=${encodeURIComponent(bAddressFull)}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(aAddressFull || bAddressFull)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-500/20 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      title="Umzugsroute A ➔ B in Google Maps öffnen"
                    >
                      <MapPinIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>Route (Maps)</span>
                    </a>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onViewPdf(activeOrder, 'employee')}
                    className="px-4 py-2 rounded-xl bg-[#6E8F64] hover:bg-[#5C7A53] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    title="Meinen Laufzettel für diesen Auftrag öffnen"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4 text-white shrink-0" />
                    <span>Meinen Laufzettel öffnen (PDF)</span>
                  </button>

                  {(hasA || hasB) && (
                    <a
                      href={hasA && hasB
                        ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(aAddressFull)}&destination=${encodeURIComponent(bAddressFull)}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(aAddressFull || bAddressFull)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-500/20 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      title="Umzugsroute A ➔ B in Google Maps öffnen"
                    >
                      <MapPinIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      <span>Route (Maps)</span>
                    </a>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}





      {/* Main Content Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (7 cols): Route & Logistics + Checkliste */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Smart Logistics & Multi-Stop Route Engine (Bochum Depot Roundtrip) */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#6E8F64]/10 text-[#6E8F64] dark:text-[#93B489] flex items-center justify-center shrink-0">
                  <TruckIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white">
                    Routen- & Distanzberechnung
                  </h3>
                  <p className="text-xs text-slate-400">
                    Direkte Umzugsfahrt und Gesamtfahrstrecke ab/an Betriebshof Bochum
                  </p>
                </div>
              </div>

              {/* Route Action Buttons - Side by Side on Mobile & Desktop */}
              <div className={`grid ${googleMapsRouteUrl ? 'grid-cols-2' : 'grid-cols-1'} sm:flex sm:items-center gap-2 w-full sm:w-auto`}>
                <button
                  type="button"
                  onClick={handleCalculateRoute}
                  disabled={isCalculatingRoute || !bothAddressesPresent}
                  className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold bg-[#6E8F64] hover:bg-[#5C7A53] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 shadow-xs shadow-[#6E8F64]/20 cursor-pointer text-center"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 shrink-0 ${isCalculatingRoute ? 'animate-spin' : ''}`} />
                  <span className="truncate">{isCalculatingRoute ? 'Berechne...' : 'Route berechnen'}</span>
                </button>

                {googleMapsRouteUrl && (
                  <a
                    href={googleMapsRouteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer text-center"
                    title="Komplette Tour in Google Maps öffnen"
                  >
                    <MapPinIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">Auf Maps öffnen</span>
                  </a>
                )}
              </div>
            </div>

            {/* Smart Dual-Distance Result Banner */}
            {routeInfo && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#6E8F64]/8 via-slate-50 to-[#6E8F64]/8 dark:from-[#6E8F64]/15 dark:via-slate-900 dark:to-[#6E8F64]/15 border border-[#6E8F64]/25 dark:border-[#6E8F64]/30 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Leg 1: Direct Move (A -> B) */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#4A6642] dark:text-[#A8C69F] flex items-center gap-1 font-headline">
                      <TruckIcon className="w-3.5 h-3.5" />
                      Direkte Umzugsstrecke (A ➔ B)
                    </span>
                    <div className="text-base font-bold text-slate-900 dark:text-white">
                      {routeInfo.direct?.distanceKm || routeInfo.distanceKm} km
                      <span className="text-xs font-normal text-slate-500 ml-2">
                        (ca. {routeInfo.direct?.durationMinutes || routeInfo.durationMinutes} Min.)
                      </span>
                    </div>
                  </div>

                  {/* Leg 2: Total Bochum Depot Roundtrip */}
                  <div className="space-y-1 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 pt-2 sm:pt-0 sm:pl-4">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <BuildingOfficeIcon className="w-3.5 h-3.5 text-primary" />
                      Depot-Rundfahrt ab/an Bochum
                    </span>
                    <div className="text-base font-bold text-slate-900 dark:text-white">
                      {routeInfo.roundTrip ? (
                        <>
                          {routeInfo.roundTrip.distanceKm} km
                          <span className="text-xs font-normal text-slate-500 ml-2">
                            (ca. {Math.floor(routeInfo.roundTrip.durationMinutes / 60) > 0 ? `${Math.floor(routeInfo.roundTrip.durationMinutes / 60)} Std. ` : ''}{routeInfo.roundTrip.durationMinutes % 60} Min.)
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-normal text-slate-400">Automatische Rundfahrt verfügbar</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                  <span>Start & Ende: Grillostr. 70, 44799 Bochum</span>
                  <span className="font-semibold text-[#6E8F64] dark:text-[#93B489]">OSRM Präzisions-Routing</span>
                </div>
              </div>
            )}

            {/* Address Cards: Auszugsort (A) & Einzugsort (B) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Beladestelle (Auszug) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#4A6642] dark:text-[#A8C69F] flex items-center gap-1 font-headline">
                    <HomeIcon className="w-4 h-4" />
                    Beladestelle (Auszug A)
                  </span>
                  {hasA ? (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(aAddressFull)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-emerald-500/20"
                        title="In Google Maps navigieren"
                      >
                        <MapPinIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Maps</span>
                      </a>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Erfasst
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                      Fehlt
                    </span>
                  )}
                </div>

                {hasA ? (
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {aStreet ? `${aStreet} ${aHouseNr}` : 'Straße ohne Hausnummer'}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {aZip} {aCity}
                    </p>
                    <div className="pt-2 flex items-center gap-3 text-[11px] text-slate-500 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>Etage: {aFloor || 'EG / k.A.'}</span>
                      <span>•</span>
                      <span>Aufzug: {aElevator ? 'Ja' : 'Nein'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center space-y-2">
                    <p className="text-xs text-slate-400 italic">
                      Noch keine Beladestelle erfasst.
                    </p>
                    {activeOrder && (
                      <Link
                        href={`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                      >
                        <MapPinIcon className="w-3.5 h-3.5" />
                        <span>Im Angebot nachtragen</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Entladestelle (Einzug) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-headline">
                    <BuildingOfficeIcon className="w-4 h-4" />
                    Entladestelle (Einzug B)
                  </span>
                  {hasB ? (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(bAddressFull)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer border border-emerald-500/20"
                        title="In Google Maps navigieren"
                      >
                        <MapPinIcon className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Maps</span>
                      </a>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Erfasst
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                      Fehlt
                    </span>
                  )}
                </div>

                {hasB ? (
                  <div className="space-y-1">
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                      {bStreet ? `${bStreet} ${bHouseNr}` : 'Straße ohne Hausnummer'}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      {bZip} {bCity}
                    </p>
                    <div className="pt-2 flex items-center gap-3 text-[11px] text-slate-500 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span>Etage: {bFloor || 'EG / k.A.'}</span>
                      <span>•</span>
                      <span>Aufzug: {bElevator ? 'Ja' : 'Nein'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 text-center space-y-2">
                    <p className="text-xs text-slate-400 italic">
                      Noch keine Entladestelle erfasst.
                    </p>
                    {activeOrder && (
                      <Link
                        href={`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                      >
                        <MapPinIcon className="w-3.5 h-3.5" />
                        <span>Im Angebot nachtragen</span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Active Offer Switcher & Übergabeprotokolle */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Quick Active Order Selector (If customer has multiple orders) */}
          {orders.length > 1 && (
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="font-headline font-bold text-xs uppercase tracking-wider text-slate-400">
                Aktives Angebot umschalten ({orders.length})
              </h3>
              <div className="space-y-2">
                {orders.map((ord) => {
                  const isSelected = activeOrder?.id === ord.id;
                  const ordTot = calculateOrderTotals(ord);
                  return (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 ${
                        isSelected 
                          ? 'border-primary bg-primary/5 text-slate-900 dark:text-white font-bold shadow-xs' 
                          : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="truncate">
                        <span className="block text-xs truncate">
                          {ord.orderNumber || `Auftrag #${ord.id.slice(-5).toUpperCase()}`}
                        </span>
                        <span className="text-[10px] font-normal text-slate-400">
                          {ord.orderMeta?.movingDateFrom || ord.movingDate || ord.logistics?.movingDate || 'Ohne Datum'}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-primary block">
                          €{ordTot.gross.toLocaleString('de-DE')}
                        </span>
                        <span className="text-[9px] uppercase font-bold text-slate-400">
                          {ord.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dedicated Übergabeprotokolle & Haftung Card */}
          {activeOrder && (
            <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#6E8F64]/10 text-[#6E8F64] dark:text-[#93B489] flex items-center justify-center shrink-0">
                    <ClipboardDocumentCheckIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Übergabeprotokolle</span>
                      {hasActiveProtocols && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#6E8F64]/15 text-[#3B5233] dark:text-[#B5D1AC] font-bold">
                          {activeProtocols.length}
                        </span>
                      )}
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Abnahmen, Mängel & Haftung
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasActiveProtocols && (
                    <button
                      type="button"
                      onClick={() => onViewPdf(activeOrder, 'protocol')}
                      className="px-2.5 py-1.5 rounded-xl bg-[#6E8F64]/10 hover:bg-[#6E8F64]/20 text-[#3B5233] dark:text-[#B5D1AC] text-xs font-bold border border-[#6E8F64]/30 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Protokoll als PDF anzeigen / drucken"
                    >
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenProtocolModal(activeOrder)}
                    className="p-1.5 rounded-xl bg-[#6E8F64] hover:bg-[#5C7A53] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs shadow-[#6E8F64]/20"
                    title="Neues Protokoll anlegen"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {hasActiveProtocols ? (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                  {activeProtocols.map((proto: any, idx: number) => {
                    const isMangel = proto.type?.toLowerCase().includes('schäden') || proto.type?.toLowerCase().includes('mängel');
                    const isGefahr = proto.type?.toLowerCase().includes('gefahrenübergang') || proto.type?.toLowerCase().includes('haftung');
                    const isStandard = proto.type?.toLowerCase().includes('ohne mängel') || proto.type?.toLowerCase().includes('abnahme');

                    const badgeColor = isMangel
                      ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                      : isGefahr
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                      : isStandard
                      ? 'bg-[#6E8F64]/15 text-[#3B5233] dark:text-[#B5D1AC]'
                      : 'bg-[#6E8F64]/15 text-[#3B5233] dark:text-[#B5D1AC]';

                    return (
                      <div
                        key={proto.id || idx}
                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                            {proto.type || 'Protokoll'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatProtocolDate(proto.createdAt)}
                          </span>
                        </div>

                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line line-clamp-3">
                          {proto.text || 'Keine Notiz erfasst.'}
                        </p>

                        {proto.signature && (
                          <div className="flex items-center gap-2.5 pt-1">
                            <div className="bg-white p-1 rounded-lg border border-slate-200 dark:border-slate-700 w-24 h-10 flex items-center justify-center shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={proto.signature}
                                alt="Unterschrift"
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Digital unterschrieben
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-5 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <ClipboardDocumentCheckIcon className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                  <div>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Kein Protokoll hinterlegt
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Abnahmen, Mängel oder Treppenhaus-Haftungsausschluss digital erfassen.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenProtocolModal(activeOrder)}
                    className="py-2 px-4 rounded-xl bg-[#6E8F64] hover:bg-[#5C7A53] text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm shadow-[#6E8F64]/20 cursor-pointer transition-all"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    <span>Protokoll anlegen</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Alle Angebote & Aufträge dieses Kunden */}
      <section className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-primary" />
              Alle Angebote & Aufträge ({orders.length})
            </h3>
            <p className="text-xs text-slate-400">
              Übersicht aller historischen und aktuellen Vorgänge für diesen Kunden
            </p>
          </div>

          <Link
            href={`/dashboard/customers/${customer.id}/new-order`}
            className="py-2 px-4 rounded-full font-bold text-xs bg-primary hover:bg-[#b51822] text-white flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <span>+ Weiteres Angebot anlegen</span>
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            Keine Aufträge oder Angebote vorhanden.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {orders.map((ord: any) => {
              const ordTotals = calculateOrderTotals(ord);
              const ordNumber = ord.orderNumber || ord.orderIdShort || (ord.id ? `#${ord.id.slice(-5).toUpperCase()}` : '#AUFTRAG');
              const dateDisplay = ord.orderMeta?.movingDateFrom || ord.movingDate || ord.logistics?.movingDate || ord.createdAt?.toDate?.()?.toLocaleDateString('de-DE') || 'Kein Datum';
              const routeDisplay = ord.logistics?.a_city && ord.logistics?.b_city 
                ? `${ord.logistics.a_city} ➔ ${ord.logistics.b_city}`
                : 'Lokaler Auftrag';

              const ordLinkedInv = findActiveLinkedInvoice(ord, invoices);
              const ordLatestCancelledNum = getLatestCancelledInvoiceNumber(ord, invoices);
              const ordActiveInvNum = getActiveInvoiceNumber(ord, ordLinkedInv);
              const ordAllInvs = (invoices || []).filter((inv: any) =>
                !inv.isStorno && (
                  inv.sourceOrderId === ord.id ||
                  inv.orderId === ord.id ||
                  inv.id === ord.id ||
                  (ord.invoiceNumber && inv.invoiceNumber === ord.invoiceNumber)
                )
              );
              const ordAllInvsCancelled =
                ordAllInvs.length > 0 && ordAllInvs.every((inv: any) => isInvoiceCancelled(inv));

              const ordHasInvoice = Boolean(
                !ordAllInvsCancelled &&
                !isInvoiceCancelled(ord) && (
                  ordActiveInvNum ||
                  ordLinkedInv ||
                  ord.status === 'invoice_open' ||
                  ord.status === 'invoice_paid'
                )
              );
              const ordInvoiceNum = ordHasInvoice ? (ordLinkedInv?.invoiceNumber || ordActiveInvNum) : null;

              const getStatusBadge = (st: string) => {
                switch (st) {
                  case 'draft':
                    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">Entwurf</span>;
                  case 'quote':
                  case 'verhandlung':
                    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">Angebot versendet</span>;
                  case 'confirmed':
                  case 'bestaetigt':
                    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Bestätigt</span>;
                  case 'completed':
                  case 'abgeschlossen':
                    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-600 border border-slate-500/20">Abgeschlossen</span>;
                  default:
                    return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{st || 'Offen'}</span>;
                }
              };

              const isThisActive = activeOrder?.id === ord.id;

              return (
                <div key={ord.id} className={`py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${isThisActive ? 'bg-primary/5 -mx-4 px-4 rounded-2xl' : ''}`}>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white font-headline">
                        {ordNumber}
                      </span>
                      {getStatusBadge(ord.status)}
                      {!isTeamLead && (
                        <span className="text-xs font-bold text-primary">
                          €{ordTotals.gross.toLocaleString('de-DE')}
                        </span>
                      )}
                      {isThisActive ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 font-headline">
                          <CheckCircleIcon className="w-3 h-3 text-primary" />
                          <span>Aktiver Auftrag</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedOrderId(ord.id)}
                          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 hover:bg-primary hover:text-white dark:bg-slate-800 dark:hover:bg-primary text-slate-600 dark:text-slate-300 transition-all flex items-center gap-1 cursor-pointer font-headline"
                          title="Diesen Auftrag im oberen Cockpit aktivieren"
                        >
                          <EyeIcon className="w-3 h-3" />
                          <span>Im Cockpit öffnen</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400 font-medium flex-wrap">
                      <span className="flex items-center gap-1">
                        <CalendarDaysIcon className="w-3.5 h-3.5" />
                        <span>{dateDisplay}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPinIcon className="w-3.5 h-3.5" />
                        <span>{routeDisplay}</span>
                      </span>
                      {ord.logistics?.estimatedVolume && (
                        <span>{ord.logistics.estimatedVolume} m³</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                    {/* 1. Angebot / Entwurf bearbeiten Button (nur für Disponenten / Büro) */}
                    {!isTeamLead && (
                      <Link
                        href={`/dashboard/customers/${customer.id}/edit-order/${ord.id}`}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#D91E2A] text-white hover:bg-[#b51822] transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <PencilSquareIcon className="w-3.5 h-3.5" />
                        <span>{ord.status === 'draft' ? 'Entwurf bearbeiten' : 'Bearbeiten'}</span>
                      </Link>
                    )}

                    {/* 2. Auftrags-Cockpit & Prüfung (Drawer) */}
                    <button
                      type="button"
                      onClick={() => setDrawerOrder(ord)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all flex items-center gap-1 cursor-pointer"
                      title="Auftrags-Cockpit & Phasen-Prüfung im Drawer öffnen"
                    >
                      <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
                      <span>Prüfen</span>
                    </button>

                    {/* 3. Laufzettel (für Teamleiter) oder PDF Vorschau (für Büro) */}
                    {isTeamLead ? (
                      <button
                        type="button"
                        onClick={() => onViewPdf(ord, 'employee')}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                        title="Mitarbeiter-Laufzettel (PDF ohne Preise) ansehen"
                      >
                        <TruckIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Laufzettel</span>
                      </button>
                    ) : (() => {
                      const hasContent = isOrderPricedAndServiced(ord);
                      return (
                        <button
                          type="button"
                          onClick={() => handleOrderPdfClick(ord)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            !hasContent
                              ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border border-slate-300/70 dark:border-slate-700/60 hover:border-amber-500/50'
                              : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                          title={!hasContent ? "Angebot enthält noch keine Leistungen oder Preise (0,00 €)" : "PDF Vorschau"}
                        >
                          <DocumentTextIcon className={`w-3.5 h-3.5 ${!hasContent ? 'text-slate-400' : 'text-primary'}`} />
                          <span>PDF</span>
                          {!hasContent && (
                            <span className="text-[9px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1 py-0.2 rounded font-semibold border border-amber-500/30">
                              0 €
                            </span>
                          )}
                        </button>
                      );
                    })()}

                    {/* 4. Protokoll ansehen oder erstellen */}
                    {ord.protocols && ord.protocols.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => onViewPdf(ord, 'protocol')}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-[#6E8F64]/10 hover:bg-[#6E8F64]/20 text-[#3B5233] dark:text-[#B5D1AC] border border-[#6E8F64]/30 transition-all flex items-center gap-1.5 cursor-pointer"
                        title={`Übergabeprotokoll (${ord.protocols.length}) als PDF anzeigen`}
                      >
                        <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-[#6E8F64] dark:text-[#93B489]" />
                        <span>Protokoll ({ord.protocols.length})</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onOpenProtocolModal(ord)}
                        className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 transition-all flex items-center gap-1 cursor-pointer"
                        title="Übergabeprotokoll für diesen Auftrag erstellen"
                      >
                        <ClipboardDocumentCheckIcon className="w-3.5 h-3.5" />
                        <span>+ Protokoll</span>
                      </button>
                    )}

                    {/* 5. Intelligente Phase-spezifische Aktion (Signatur vs Rechnung) für inaktive Aufträge */}
                    {['quote', 'clarification', 'verhandlung'].includes(ord.status) && !(ord.signature || ord.orderMeta?.customerSignature) && !ordLatestCancelledNum ? (
                      !isThisActive ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenSignatureModal ? onOpenSignatureModal(ord) : setDrawerOrder(ord)}
                            className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white dark:text-amber-400 border border-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Vertrag digital signieren"
                          >
                            <PencilSquareIcon className="w-3.5 h-3.5" />
                            <span>Digital signieren</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRequestInvoice(ord)}
                            className="px-2.5 py-2 rounded-xl text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1 cursor-pointer"
                            title="Rechnung trotz fehlender Unterschrift erstellen (Sicherheitsprüfung wird geöffnet)"
                          >
                            <DocumentCheckIcon className="w-3.5 h-3.5" />
                            <span>Rechnung</span>
                          </button>
                        </div>
                      ) : null
                    ) : ordHasInvoice ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onViewPdf(ordLinkedInv || ord, 'invoice')}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-100 dark:bg-purple-950/60 hover:bg-purple-200 dark:hover:bg-purple-900/80 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700 transition-all flex items-center gap-1.5 cursor-pointer"
                          title={`Rechnung ${ordInvoiceNum || ''} als PDF anzeigen`}
                        >
                          <DocumentCheckIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>{(ordLinkedInv?.isKorrektur || ord.isKorrektur) ? 'Korrekturrechnung' : 'Rechnung'} {ordInvoiceNum ? `(${ordInvoiceNum})` : 'ansehen'}</span>
                        </button>
                        {!ord.isStorno && ord.status !== 'invoice_cancelled' && ord.status !== 'canceled' && (
                          <button
                            type="button"
                            onClick={() => setStornoInvoice(ordLinkedInv || { ...ord, invoiceNumber: ordInvoiceNum, id: ordLinkedInv?.id || ord.id })}
                            className="px-2.5 py-2 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500 text-amber-600 hover:text-white dark:text-amber-400 border border-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
                            title="Rechnung stornieren (Storno-Beleg erstellen)"
                          >
                            <span>Stornieren</span>
                          </button>
                        )}
                      </>
                    ) : ord.status !== 'draft' ? (
                      <button
                        type="button"
                        onClick={() => handleRequestInvoice(ord)}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1.5 cursor-pointer"
                        title={ordLatestCancelledNum ? `Rechnung ${ordLatestCancelledNum} wurde storniert. Klicken für Korrekturrechnung.` : "Rechnung für diesen bestätigten Auftrag erstellen"}
                      >
                        <DocumentCheckIcon className="w-3.5 h-3.5" />
                        <span>{ordLatestCancelledNum ? 'Korrekturrechnung erstellen' : 'Rechnung erstellen'}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* PRE-FLIGHT CHECK MODAL: Open Logistics Tasks before Invoicing */}
      {preInvoiceOpenTasks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Vorflug-Prüfung (Pre-Flight Check)
                </span>
                <h3 className="font-headline font-bold text-lg text-slate-900 dark:text-white mt-1">
                  Offene Aufgaben / Termine vorhanden
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <p className="font-semibold text-sm">
                Es gibt noch offene Aufgaben / Termine für diesen Kunden.
              </p>
              <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                Möchten Sie diese Aufgaben vor der Rechnungserstellung automatisch als erledigt markieren oder unverändert fortfahren?
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Offene Punkte ({preInvoiceOpenTasks.tasks.length}):
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {preInvoiceOpenTasks.tasks.map(t => (
                  <div key={t.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{t.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPreInvoiceOpenTasks(null)}
                disabled={isAutoClosingTasks}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={handleProceedWithoutClosingTasks}
                disabled={isAutoClosingTasks}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Trotzdem zur Rechnung
              </button>

              <button
                type="button"
                onClick={handleAutoCloseTasksAndInvoice}
                disabled={isAutoClosingTasks}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-[#6E8F64] hover:bg-[#5C7A53] text-white shadow-md shadow-[#6E8F64]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircleIcon className="w-4 h-4" />
                <span>{isAutoClosingTasks ? 'Schließe Aufgaben...' : 'Aufgaben schließen & Rechnung'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1 PRIORITY: Unconfirmed / Incomplete Order Invoice Warning Confirmation Modal */}
      {unconfirmedInvoiceOrder && (() => {
        const moveDateRaw = unconfirmedInvoiceOrder.orderMeta?.movingDateFrom || unconfirmedInvoiceOrder.movingDate || unconfirmedInvoiceOrder.logistics?.movingDate || unconfirmedInvoiceOrder.date;
        const isMoveInFuture = (() => {
          if (!moveDateRaw) return false;
          const moveD = new Date(String(moveDateRaw).split('T')[0] + 'T00:00:00');
          if (isNaN(moveD.getTime())) return false;
          const todayD = new Date();
          todayD.setHours(0, 0, 0, 0);
          return moveD.getTime() > todayD.getTime();
        })();
        const formattedMoveDate = moveDateRaw ? new Date(moveDateRaw).toLocaleDateString('de-DE') : null;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ExclamationTriangleIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Sicherheitsprüfung
                  </span>
                  <h3 className="font-headline font-bold text-lg text-slate-900 dark:text-white mt-1">
                    {isMoveInFuture ? 'Umzugstermin liegt noch in der Zukunft!' : 'Rechnung vorzeitig erstellen?'}
                  </h3>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                {isMoveInFuture ? (
                  <>
                    <p className="font-semibold text-sm">
                      Achtung: Der Umzugstermin ({formattedMoveDate}) hat noch nicht stattgefunden!
                    </p>
                    <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                      Wenn Sie jetzt eine Rechnung ausstellen, wird dieser Auftrag bzw. die Kundenakte als abgeschlossen eingestuft. Möchten Sie diesen Auftrag trotzdem jetzt abschließen?
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-sm">
                      Möchten Sie wirklich eine Rechnung erstellen, obwohl der Vertrag bzw. die vorherigen Aufgaben noch nicht vollständig abgeschlossen sind?
                    </p>
                    <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                      Normalerweise wird die Rechnung erst nach unterschriebenem Auftrag, erledigten Logistik-Aufgaben und durchgeführtem Umzug (Abnahmeprotokoll) generiert.
                    </p>
                  </>
                )}
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Betroffener Auftrag:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    #{unconfirmedInvoiceOrder.orderNumber || unconfirmedInvoiceOrder.id.slice(-5).toUpperCase()}
                  </span>
                </div>
                {formattedMoveDate && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Umzugstermin:</span>
                    <span className={`font-bold ${isMoveInFuture ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-200'}`}>
                      {formattedMoveDate} {isMoveInFuture ? '(Noch offen)' : ''}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Aktueller Status:</span>
                  <span className="font-bold uppercase text-amber-600 dark:text-amber-400">
                    {unconfirmedInvoiceOrder.status || 'Entwurf'}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUnconfirmedInvoiceOrder(null)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Abbrechen
                </button>

                {onOpenSignatureModal && !(unconfirmedInvoiceOrder.signatureOrder || unconfirmedInvoiceOrder.orderMeta?.signedContractScan || unconfirmedInvoiceOrder.isManuallySigned || unconfirmedInvoiceOrder.contractSigned) && (
                  <button
                    type="button"
                    onClick={() => {
                      const ord = unconfirmedInvoiceOrder;
                      setUnconfirmedInvoiceOrder(null);
                      onOpenSignatureModal(ord);
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Zuerst digital / per Foto signieren</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const ordId = unconfirmedInvoiceOrder.id;
                    setUnconfirmedInvoiceOrder(null);
                    autoCompletePreMoveTasks(ordId).catch(err => console.error('Error auto-completing pre-move tasks:', err));
                    router.push(`/dashboard/customers/${customer.id}/edit-invoice/${ordId}`);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 shadow-md transition-colors"
                >
                  Trotzdem abschließen & Rechnung erstellen
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Empty Offer Warning Modal (No services or 0,00 €) */}
      {emptyOfferWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Leistungs- & Preishinweis
                </span>
                <h3 className="font-headline font-bold text-lg text-slate-900 dark:text-white mt-1">
                  Angebot ohne Leistungen / 0,00 €
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-sm text-slate-900 dark:text-white">
                Dieses Angebot enthält noch keine Leistungen oder hat einen Betrag von 0,00 €.
              </p>
              <p className="leading-relaxed text-slate-500 dark:text-slate-400">
                Möchten Sie das Angebot jetzt im Editor öffnen und Leistungen hinzufügen, oder möchten Sie die PDF-Vorschau trotzdem öffnen?
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Auftrag:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  #{emptyOfferWarningModal.orderNumber || emptyOfferWarningModal.id?.slice(-5).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Leistungen:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {Array.isArray(emptyOfferWarningModal.services) ? emptyOfferWarningModal.services.length : 0} Positionen
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEmptyOfferWarningModal(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetOrd = emptyOfferWarningModal;
                  setEmptyOfferWarningModal(null);
                  onViewPdf(targetOrd, 'order');
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Trotzdem PDF ansehen
              </button>

              <button
                type="button"
                onClick={() => {
                  const targetOrdId = emptyOfferWarningModal.id;
                  setEmptyOfferWarningModal(null);
                  router.push(`/dashboard/customers/${customer.id}/edit-order/${targetOrdId}`);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold bg-primary hover:bg-[#b51822] text-white shadow-md shadow-primary/20 transition-colors flex items-center justify-center gap-1.5"
              >
                <PencilSquareIcon className="w-4 h-4" />
                <span>Leistungen im Editor bearbeiten</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Invoice Warning for Payment Modal */}
      {noInvoiceForPaymentOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Buchhaltungs-Prüfung
                </span>
                <h3 className="font-headline font-bold text-lg text-slate-900 dark:text-white mt-1">
                  Keine Rechnung vorhanden
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-sm text-slate-900 dark:text-white">
                Für diesen Auftrag existiert noch keine ausgestellte Rechnung.
              </p>
              <p className="leading-relaxed text-slate-500 dark:text-slate-400">
                Da in Ihrem Betrieb keine Anzahlungen erhoben werden, können Zahlungen erst verbucht werden, wenn die Rechnung offiziell erstellt wurde.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Auftrag:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  #{noInvoiceForPaymentOrder.orderNumber || noInvoiceForPaymentOrder.id.slice(-5).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold uppercase text-amber-600 dark:text-amber-400">
                  {noInvoiceForPaymentOrder.status || 'Entwurf'}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setNoInvoiceForPaymentOrder(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={() => {
                  const ord = noInvoiceForPaymentOrder;
                  setNoInvoiceForPaymentOrder(null);
                  handleRequestInvoice(ord);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold bg-primary hover:bg-[#b51822] text-white shadow-md shadow-primary/20 transition-colors flex items-center justify-center gap-1.5"
              >
                <DocumentCheckIcon className="w-4 h-4" />
                <span>Rechnung jetzt erstellen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guidance Modal for Automated Checklist Items */}
      {checklistGuidanceItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <InformationCircleIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  Automatische System-Prüfung
                </span>
                <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white mt-1">
                  {checklistGuidanceItem.label}
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                Dieses Feld kann nicht manuell per Klick abgehakt werden.
              </p>
              <p className="text-slate-500 dark:text-slate-400">
                {checklistGuidanceItem.missingReason || 'Das System setzt dieses Häkchen automatisch, sobald die entsprechenden Angaben im Angebot hinterlegt sind.'}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {activeOrder && (
                <Link
                  href={`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`}
                  onClick={() => setChecklistGuidanceItem(null)}
                  className="w-full py-3 px-4 rounded-xl bg-primary text-white font-bold text-xs hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-md shadow-primary/20"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  <span>Jetzt im Angebot ausfüllen</span>
                </Link>
              )}

              {checklistGuidanceItem.id === 'address' && (
                <button
                  type="button"
                  onClick={() => {
                    setChecklistGuidanceItem(null);
                    onEditCustomer();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all flex items-center justify-center gap-2"
                >
                  <PencilSquareIcon className="w-4 h-4" />
                  <span>Kundendaten bearbeiten</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setChecklistGuidanceItem(null)}
                className="w-full py-2 text-center text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors"
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Storno Modal */}
      {stornoInvoice && (
        <StornoModal
          invoice={stornoInvoice}
          onClose={() => setStornoInvoice(null)}
          onSuccess={(stornoDoc) => {
            if (onRefresh) onRefresh();
            if (stornoDoc) {
              onViewPdf(stornoDoc, 'invoice');
            }
          }}
        />
      )}

      {/* WhatsApp Template Selector Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <ChatBubbleLeftRightIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <span>WhatsApp Nachrichtenvorlagen</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-normal">
                      {allWaTemplates.length} Vorlagen
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Empfänger: <strong className="text-slate-700 dark:text-slate-200">{fullName}</strong> {customer?.phone ? `(${customer.phone})` : '(Keine Telefonnummer)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Category Filter Pills & Search */}
            <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5 sm:space-y-3">
              {/* Mobile Tab Switcher (< md) */}
              <div className="flex md:hidden p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 gap-1">
                <button
                  type="button"
                  onClick={() => setWaMobileTab('templates')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold font-headline transition-all cursor-pointer ${
                    waMobileTab === 'templates'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  1. Vorlagen ({filteredWaTemplates.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWaMobileTab('preview')}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold font-headline transition-all cursor-pointer ${
                    waMobileTab === 'preview'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  2. Vorschau & Senden
                </button>
              </div>

              {/* Search & Categories (shown on desktop, or on mobile when templates tab is active) */}
              <div className={`flex flex-col sm:flex-row items-center gap-3 justify-between ${waMobileTab === 'preview' ? 'hidden md:flex' : 'flex'}`}>
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Vorlage suchen..."
                    value={waSearchQuery}
                    onChange={(e) => setWaSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-white"
                  />
                </div>

                {/* Categories */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-thin">
                  {waCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setWaActiveCategory(cat)}
                      className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer ${
                        waActiveCategory === cat
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Body: Two columns (List on Left, Live Preview on Right) */}
            <div className="grid grid-cols-1 md:grid-cols-12 flex-1 overflow-hidden min-h-0 divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
              
              {/* Left Column: Template List */}
              <div className={`md:col-span-5 p-3 space-y-2 overflow-y-auto max-h-[60vh] md:max-h-[500px] ${
                waMobileTab === 'templates' ? 'block' : 'hidden md:block'
              }`}>
                {filteredWaTemplates.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400">
                    Keine Vorlagen für diesen Suchfilter gefunden.
                  </div>
                ) : (
                  filteredWaTemplates.map((t: any) => {
                    const isSelected = t.id === selectedWaTemplateId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setSelectedWaTemplateId(t.id);
                          setWaCustomText(formatTemplateText(t.body));
                          setWaMobileTab('preview');
                        }}
                        className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer block group ${
                          isSelected
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-100 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}>
                            {t.category || 'Vorlage'}
                          </span>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Aktiv
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1 group-hover:text-primary transition-colors">
                          {t.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 mt-1">
                          {t.body}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Right Column: Live Editor & Preview */}
              <div className={`md:col-span-7 p-4 sm:p-6 flex flex-col justify-between overflow-y-auto max-h-[65vh] md:max-h-[500px] space-y-4 ${
                waMobileTab === 'preview' ? 'flex' : 'hidden md:flex'
              }`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                      Nachrichtenvorschau & Anpassung
                    </label>
                    <span className="text-[11px] text-slate-400">
                      {waCustomText.length} Zeichen
                    </span>
                  </div>

                  <textarea
                    rows={7}
                    value={waCustomText}
                    onChange={(e) => setWaCustomText(e.target.value)}
                    placeholder="Text hier anpassen..."
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/40 font-mono leading-relaxed"
                  />

                  {/* Smart Placeholder Tags (Quick Helper) */}
                  <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] space-y-1">
                    <span className="font-bold text-slate-600 dark:text-slate-400 block">
                      Ersetzte Platzhalter:
                    </span>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 text-slate-500 dark:text-slate-400">
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] sm:text-[11px]">
                        [Name] ➔ <strong>{customer?.type === 'firma' ? customer.lastName : `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || 'Kunde'}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] sm:text-[11px]">
                        [Datum] ➔ <strong>{activeOrder?.logistics?.movingDate ? new Date(activeOrder.logistics.movingDate).toLocaleDateString('de-DE') : 'vereinbartem Datum'}</strong>
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] sm:text-[11px]">
                        [Mitarbeiter] ➔ <strong>{profile?.displayName || 'Rothirsch Team'}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons in Modal */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator?.clipboard) {
                        navigator.clipboard.writeText(waCustomText);
                        toast.success('In Zwischenablage kopiert!');
                      }
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                    <span>Text kopieren</span>
                  </button>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setShowWhatsAppModal(false)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendWhatsApp(waCustomText)}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ChatBubbleLeftRightIcon className="w-4 h-4" />
                      <span>In WhatsApp öffnen</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Schedule Modal from Customer Page */}
      {scheduleModalTodo && activeOrder && (
        <TaskScheduleModal
          isOpen={Boolean(scheduleModalTodo)}
          onClose={() => setScheduleModalTodo(null)}
          todo={scheduleModalTodo}
          parentOrder={activeOrder}
          onSaved={() => {
            if (onRefresh) onRefresh();
            setScheduleModalTodo(null);
          }}
        />
      )}

      {/* Direct E-Mail Sender Modal from Customer Action Hub */}
      {emailModalOrder && (
        <MessageSenderModal
          order={emailModalOrder}
          customer={customer}
          defaultTemplateName={hasInvoice ? 't9' : 't3'}
          onClose={() => setEmailModalOrder(null)}
        />
      )}

      {/* 4-Phasen Dashboard-Style Order Details Drawer */}
      {drawerOrder && (
        <OrderDetailsDrawer
          order={drawerOrder}
          customer={customer}
          initialPhase={drawerInitialPhase}
          onClose={() => {
            setDrawerOrder(null);
            setDrawerInitialPhase(undefined);
          }}
          onRefresh={() => {
            if (onRefresh) onRefresh();
            const updated = orders.find(o => o.id === drawerOrder.id);
            if (updated) setDrawerOrder(updated);
          }}
        />
      )}
    </div>
  );
}
