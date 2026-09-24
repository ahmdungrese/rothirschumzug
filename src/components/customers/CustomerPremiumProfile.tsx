"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { calculateOrderTotals, calculateTotalPaid, calculateOpenAmount } from '@/lib/financeHelpers';
import { evaluateOrderLogistics } from '@/lib/orderValidation';
import { toggleTaskCompletion, updateTaskSchedule, isTaskCompleted } from '@/lib/taskStateController';
import { updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { calculateRoute, RouteCalculationResult } from '@/lib/routeCalculator';
import { 
  DocumentTextIcon, 
  DocumentCheckIcon, 
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
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';
import { StornoModal } from '@/components/finances/StornoModal';
import { OrderDetailsDrawer } from '@/components/dashboard/OrderDetailsDrawer';
import { TaskScheduleModal } from '@/components/logistics/TaskScheduleModal';

const DEFAULT_COMMUNICATION_TEMPLATES = [
  {
    id: 't1',
    name: 'Erstkontakt (Bilder erhalten)',
    category: 'Erstkontakt',
    body: 'Hallo [Name],\n\nvielen Dank für Ihr Interesse an unserem Service und für die Übersendung der Bilder.\n\nGerne erstellen wir Ihnen ein individuelles Angebot mit Festpreis und lassen Ihnen dieses zeitnah zukommen.\n\nSollten Sie vorab noch weitere Fragen haben, stehen wir Ihnen selbstverständlich jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't2',
    name: 'Erstkontakt (Details anfragen)',
    category: 'Erstkontakt',
    body: 'Hallo [Name],\n\nvielen Dank für Ihr Interesse an unserem Service. Gerne erstellen wir für Sie ein Angebot mit einem fairen Festpreis. Bitte teilen Sie uns kurz eine Liste oder Bilder der Möbel und das gewünschte Umzugsdatum mit. Sie können uns auch jederzeit gerne anrufen.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't3',
    name: 'Angebot übermitteln',
    category: 'Angebot',
    body: 'Guten Tag [Name],\n\nanbei sende ich Ihnen unser verbindliches Angebot mit Festpreis für Ihren bevorstehenden Umzug. Bei Rothirsch Umzüge sind alle Möbelstücke durch Profi-Decken und Schutzfolien optimal geschützt. Bitte prüfen Sie das Angebot und geben Sie uns kurz Bescheid, um Ihren Wunschtermin zu sichern!\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't4',
    name: 'Nachfrage zum Umzugsangebot',
    category: 'Nachfassen',
    body: 'Hallo [Name],\n\nich wollte mich kurz erkundigen, ob Sie bereits eine Entscheidung zu unserem Angebot treffen konnten? Ihr Wunschtermin ist aktuell noch verfügbar. Sollten noch Fragen offen sein oder Sie Anpassungen wünschen, melden Sie sich gerne telefonisch oder per Nachricht!\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't5',
    name: 'Aktualisiertes Angebot senden',
    category: 'Angebot',
    body: 'Sehr geehrte(r) [Name],\n\nvielen Dank für Ihre Rückmeldung. Anbei erhalten Sie das aktualisierte Umzugsangebot angepasst an Ihre Änderungswünsche.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't6',
    name: 'Freundliche Absage',
    category: 'Nachfassen',
    body: 'Hallo [Name],\n\nes ist schade zu hören, dass es diesmal nicht geklappt hat. Wir wünschen Ihnen dennoch einen reibungslosen Umzug und alles Gute!\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't7',
    name: 'Auftragsbestätigung & Termin',
    category: 'Auftrag',
    body: 'Hallo [Name],\n\nvielen Dank für Ihr Vertrauen und die Auftragsbestätigung! Hiermit bestätige ich Ihnen verbindlich Ihren Umzugstermin am [Datum]. Unser Team freut sich auf einen reibungslosen und professionellen Ablauf!\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't8',
    name: 'Uhrzeit des Umzugs (Team-Eintreffen)',
    category: 'Auftrag',
    body: 'Hallo [Name],\n\nkurze Information zu Ihrem Umzug am [Datum]: Unser Team wird voraussichtlich zwischen 8:00 und 9:00 Uhr bei Ihnen an der Beladestelle eintreffen.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 'hvz_info',
    name: 'Halteverbotszone (HVZ) Info',
    category: 'Logistik',
    body: 'Guten Tag [Name],\n\ndie amtlich genehmigte Halteverbotszone für Ihren Umzugstermin am [Datum] wurde beauftragt und wird rechtzeitig vorschriftsmäßig mit Protokoll aufgestellt.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 'kartons_info',
    name: 'Umzugskartons Bereitstellung',
    category: 'Logistik',
    body: 'Guten Tag [Name],\n\nIhre bestellten Umzugskartons stehen abholbereit bzw. werden wie vereinbart an Ihre Adresse geliefert.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't9',
    name: 'Rechnung übermitteln & Google-Bewertung',
    category: 'Abrechnung',
    body: 'Sehr geehrte(r) [Name],\n\nvielen Dank für den erfolgreichen Umzug! Anbei erhalten Sie Ihre Rechnung. Wir hoffen, Sie haben sich in Ihrem neuen Zuhause gut eingelebt. Falls Sie zufrieden waren, würden wir uns riesig über eine kurze Google-Bewertung freuen!\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't10',
    name: 'Dankeschön für Bewertung',
    category: 'Nachbereitung',
    body: 'Hallo [Name],\n\nvielen herzlichen Dank für Ihre wunderbare Bewertung! Wir haben uns sehr über Ihr Feedback gefreut und wünschen Ihnen alles Gute im neuen Heim.\n\nHerzliche Grüße\n[Mitarbeiter]\nRothirsch Umzüge'
  }
];

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

    // 1. Load all 12 comprehensive default templates (t1 to t10, hvz_info, kartons_info)
    DEFAULT_COMMUNICATION_TEMPLATES.forEach((t) => {
      map.set(t.id, t);
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

  // Invoice detection for active order (from parent order or linked invoice document)
  const linkedInvoice = (invoices || []).find((inv: any) => 
    inv.sourceOrderId === activeOrder?.id || 
    inv.orderId === activeOrder?.id || 
    inv.id === activeOrder?.id ||
    (activeOrder?.invoiceNumber && inv.invoiceNumber === activeOrder.invoiceNumber)
  );

  const hasInvoice = Boolean(
    activeOrder?.invoiceNumber || 
    activeOrder?.status?.startsWith('invoice_') ||
    activeOrder?.status === 'invoice_open' ||
    activeOrder?.status === 'invoice_paid' ||
    linkedInvoice ||
    (activeOrder?.invoiceHistory && activeOrder.invoiceHistory.length > 0)
  );

  const invoiceNumberDisplay = activeOrder?.invoiceNumber || linkedInvoice?.invoiceNumber || null;

  // Unconfirmed invoice warning modal state
  const [unconfirmedInvoiceOrder, setUnconfirmedInvoiceOrder] = useState<any>(null);

  // No invoice warning for payment modal state
  const [noInvoiceForPaymentOrder, setNoInvoiceForPaymentOrder] = useState<any>(null);

  // Storno modal state
  const [stornoInvoice, setStornoInvoice] = useState<any>(null);

  // WhatsApp quick messenger modal / popover state
  const [showWhatsAppQuickMenu, setShowWhatsAppQuickMenu] = useState(false);

  // Automated checklist guidance modal
  const [isUpdatingChecklist, setIsUpdatingChecklist] = useState(false);
  const [checklistGuidanceItem, setChecklistGuidanceItem] = useState<any>(null);

  // Dashboard-Style Drawer State for full 4-phase examination
  const [drawerOrder, setDrawerOrder] = useState<any | null>(null);
  const [drawerInitialPhase, setDrawerInitialPhase] = useState<number | undefined>(undefined);
  const [scheduleModalTodo, setScheduleModalTodo] = useState<any | null>(null);

  // Keep drawerOrder synced with live orders array from Firestore
  useEffect(() => {
    if (drawerOrder?.id) {
      const updated = orders.find((o: any) => o.id === drawerOrder.id);
      if (updated) setDrawerOrder(updated);
    }
  }, [orders]);

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
    (totals.gross > 0 && openAmount <= 0) || 
    activeOrder?.status === 'invoice_paid' || 
    linkedInvoice?.status === 'invoice_paid'
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
    
    // If an invoice exists or status is completed / invoice_open / invoice_paid, it is Phase 4!
    if (hasInvoice || st === 'completed' || st?.startsWith('invoice_') || st === 'archived') {
      return { 
        phase: 4, 
        label: isInvoiceFullyPaid ? 'Abgeschlossen & Bezahlt' : 'Rechnung gestellt', 
        themeColor: 'slate' 
      };
    }

    const isSigned = isTaskCompleted(ord, 'signature');
    if (st === 'confirmed' || isSigned) {
      return { phase: 3, label: 'Auftrag bestätigt', themeColor: 'emerald' };
    }
    
    if (st === 'quote' || st === 'clarification') return { phase: 2, label: 'Angebot versendet', themeColor: 'amber' };
    return { phase: 1, label: 'Entwurf', themeColor: 'blue' };
  };

  const currentPhaseInfo = getCurrentPhase(activeOrder);

  // Moving Date Countdown calculation
  const getMoveCountdown = () => {
    const rawDate = activeOrder?.logistics?.movingDate;
    if (!rawDate) return null;
    const moveDateObj = new Date(rawDate);
    if (isNaN(moveDateObj.getTime())) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    moveDateObj.setHours(0, 0, 0, 0);
    
    const diffTime = moveDateObj.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { text: 'Heute!', color: 'bg-emerald-500 text-white' };
    if (diffDays === 1) return { text: 'Morgen', color: 'bg-amber-500 text-white' };
    if (diffDays > 1) return { text: `In ${diffDays} Tagen`, color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' };
    return { text: `Vor ${Math.abs(diffDays)} Tagen`, color: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300' };
  };

  const moveCountdown = getMoveCountdown();

  // Invoice creation interception guard
  const handleRequestInvoice = (orderToInvoice: any) => {
    if (!orderToInvoice) return;

    // Check if invoice ALREADY exists for this order!
    const existingInv = (invoices || []).find((inv: any) => 
      inv.sourceOrderId === orderToInvoice.id || 
      inv.orderId === orderToInvoice.id || 
      inv.id === orderToInvoice.id ||
      (orderToInvoice.invoiceNumber && inv.invoiceNumber === orderToInvoice.invoiceNumber)
    );

    if (existingInv || orderToInvoice.invoiceNumber) {
      toast.info(`Rechnung ${orderToInvoice.invoiceNumber || existingInv?.invoiceNumber || ''} existiert bereits.`);
      onViewPdf(existingInv || orderToInvoice, 'invoice');
      return;
    }

    const isConfirmedOrSigned = 
      orderToInvoice.status === 'confirmed' || 
      orderToInvoice.status === 'completed' || 
      orderToInvoice.status?.startsWith('invoice_') ||
      Boolean(orderToInvoice.signature || orderToInvoice.signedAt || orderToInvoice.customerSignature || orderToInvoice.isContractLocked);

    if (!isConfirmedOrSigned) {
      // Intercept with warning modal
      setUnconfirmedInvoiceOrder(orderToInvoice);
      return;
    }

    // Proceed directly if confirmed or signed
    router.push(`/dashboard/customers/${customer.id}/edit-invoice/${orderToInvoice.id}`);
  };

  // Payment interception guard: Invoices must exist before recording payments
  const handleRequestPayment = (orderToPay: any) => {
    if (!orderToPay && !linkedInvoice) {
      toast.error('Kein Auftrag oder Rechnung ausgewählt.');
      return;
    }

    const orderHasInvoice = Boolean(
      orderToPay?.invoiceNumber || 
      orderToPay?.status?.startsWith('invoice_') ||
      orderToPay?.invoiceHistory?.length > 0 ||
      linkedInvoice
    );

    if (!orderHasInvoice) {
      setNoInvoiceForPaymentOrder(orderToPay);
      return;
    }

    // Pass the merged document so PaymentManager gets the authoritative totals & invoice number
    const targetDoc = linkedInvoice
      ? {
          ...(orderToPay || linkedInvoice),
          totals,
          invoiceNumber: linkedInvoice.invoiceNumber || orderToPay?.invoiceNumber,
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

    // Phase 3: Confirmed (before invoice is issued)
    if (activeOrder.status === 'confirmed' && !hasInvoice) {
      return {
        title: 'Umzug durchführen & Schlussrechnung erstellen',
        desc: 'Der Vertrag ist bestätigt und der Auftrag disponiert. Nach oder während der Durchführung erstellen Sie hier direkt die Schlussrechnung.',
        btnText: 'Schlussrechnung jetzt erstellen',
        secondaryBtnText: 'Laufzettel drucken',
        onSecondaryAction: () => onViewPdf(activeOrder, 'employee'),
        badge: 'Phase 3: Umzugsdurchführung & Abrechnung',
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
    const cName = customer?.type === 'firma' 
      ? customer.lastName 
      : `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || customer?.lastName || 'Kunde';
    text = text.replace(/\[Name\]/g, cName);

    const rawMoveDate = activeOrder?.logistics?.movingDate || activeOrder?.orderMeta?.movingDateFrom;
    let moveDate = 'vereinbartem Datum';
    if (rawMoveDate) {
      try {
        moveDate = new Date(rawMoveDate).toLocaleDateString('de-DE');
      } catch {
        moveDate = String(rawMoveDate);
      }
    }
    text = text.replace(/\[Datum\]/g, moveDate);

    const employee = profile?.displayName || profile?.email?.split('@')[0] || 'Rothirsch Team';
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

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onEditCustomer}
              className="px-4 py-2.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <PencilSquareIcon className="w-4 h-4" />
              <span>Kundendaten</span>
            </button>

            {activeOrder && (
              <Link
                href={`/dashboard/customers/${customer.id}/edit-order/${activeOrder.id}`}
                className="px-5 py-2.5 rounded-full font-bold text-xs bg-[#D91E2A] hover:bg-[#b51822] text-white shadow-md shadow-[#D91E2A]/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <DocumentTextIcon className="w-4 h-4" />
                <span>Angebot bearbeiten</span>
              </Link>
            )}

            <Link
              href={`/dashboard/customers/${customer.id}/new-order`}
              className="py-2.5 px-5 rounded-full font-bold text-xs bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <span>+ Neues Angebot</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Documents Hub (1-Klick Dokumentenzentrale) */}
      {activeOrder && (
        <div className="bg-slate-50 dark:bg-slate-900/60 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 font-headline uppercase tracking-wider flex items-center gap-1.5">
              <DocumentTextIcon className="w-4 h-4 text-primary" />
              Dokumente (#{activeOrder.orderNumber || activeOrder.id?.slice(-5).toUpperCase()}):
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. Angebot PDF */}
            <button
              type="button"
              onClick={() => onViewPdf(activeOrder, 'order')}
              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 shadow-xs hover:border-primary/50 cursor-pointer"
              title="Angebot als PDF anzeigen oder drucken"
            >
              <DocumentTextIcon className="w-4 h-4 text-primary" />
              <span>Angebot PDF</span>
            </button>

            {/* 2. Rechnung PDF / erstellen */}
            {hasInvoice ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onViewPdf(linkedInvoice || activeOrder, 'invoice')}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Rechnung als PDF ansehen"
                >
                  <DocumentCheckIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Rechnung {invoiceNumberDisplay ? `(${invoiceNumberDisplay})` : 'PDF'}</span>
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
            ) : (
              <button
                type="button"
                onClick={() => handleRequestInvoice(activeOrder)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold border border-dashed border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Noch keine Rechnung ausgestellt. Klicken zum Erstellen."
              >
                <DocumentCheckIcon className="w-4 h-4 text-slate-400" />
                <span>+ Rechnung erstellen</span>
              </button>
            )}

            {/* 3. Protokoll */}
            {hasActiveProtocols ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onViewPdf(activeOrder, 'protocol')}
                  className="px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                  title="Übergabeprotokoll als PDF ansehen / drucken"
                >
                  <ClipboardDocumentCheckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
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
            ) : (
              <button
                type="button"
                onClick={() => onOpenProtocolModal(activeOrder)}
                className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 shadow-xs hover:border-blue-500/50 cursor-pointer"
                title="Übergabeprotokoll öffnen / erfassen"
              >
                <ClipboardDocumentCheckIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>+ Protokoll erfassen</span>
              </button>
            )}

            {/* 4. Laufzettel */}
            <button
              type="button"
              onClick={() => onViewPdf(activeOrder, 'employee')}
              className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 shadow-xs hover:border-amber-500/50 cursor-pointer"
              title="Mitarbeiter-Laufzettel ausdrucken"
            >
              <TruckIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Laufzettel</span>
            </button>

            {/* 5. Digital signieren (wenn noch offen) */}
            {!logisticsEval?.angebotStatus.isSigned && onOpenSignatureModal && (
              <button
                type="button"
                onClick={() => onOpenSignatureModal(activeOrder)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-500/30 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                title="Vertrag digital signieren"
              >
                <CheckCircleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Digital signieren</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Streamlined Auftrags-Cockpit: 4-Phasen Stepper, Nächste Aktion & Cockpit/Prüfung Drawer */}
      {activeOrder && (
        <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          
          {/* 1. Cockpit Header: Phase, Progress & Prominent Cockpit & Prüfung Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                completedCount === checklist.length && checklist.length > 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-primary/10 text-primary border border-primary/20'
              }`}>
                <ClipboardDocumentCheckIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-headline font-extrabold text-base md:text-lg text-slate-900 dark:text-white">
                    Auftrags-Cockpit & Phasensteuerung
                  </h2>
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Phase {currentPhaseInfo.phase}: {currentPhaseInfo.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Auftrag #{activeOrder.orderNumber || activeOrder.id?.slice(-5).toUpperCase()} • {completedCount} von {checklist.length} Aufgaben erledigt
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap sm:flex-nowrap">
              {/* Progress Bar */}
              <div className="flex items-center gap-2">
                <div className="w-20 sm:w-28 bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${checklist.length > 0 ? (completedCount / checklist.length) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                  {checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0}%
                </span>
              </div>

              {/* Prominent Cockpit & Prüfung (Drawer) Button */}
              <button
                type="button"
                onClick={() => {
                  setDrawerInitialPhase(currentPhaseInfo.phase);
                  setDrawerOrder(activeOrder);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:hover:bg-[#b51822] text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                title="Operative Aufgaben, Checkliste und 4-Phasen-Prüfung öffnen"
              >
                <AdjustmentsHorizontalIcon className="w-4 h-4 text-primary dark:text-white" />
                <span>Cockpit & Prüfung</span>
              </button>
            </div>
          </div>

          {/* 2. 4-Phasen Stepper (Klickbar -> Öffnet Cockpit-Drawer direkt in der jeweiligen Phase) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { num: 1, label: '1. Entwurf' },
              { num: 2, label: '2. Angebot' },
              { num: 3, label: '3. Bestätigt' },
              { num: 4, label: '4. Abrechnung' }
            ].map((st) => {
              const isDone = currentPhaseInfo.phase > st.num;
              const isCurrent = currentPhaseInfo.phase === st.num;
              return (
                <button
                  key={st.num}
                  type="button"
                  onClick={() => {
                    setDrawerInitialPhase(st.num);
                    setDrawerOrder(activeOrder);
                  }}
                  title={`Klicken, um Phase ${st.num} (${st.label}) im Cockpit & Prüfung zu öffnen`}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer hover:scale-[1.01] ${
                    isCurrent
                      ? st.num === 3 
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20 shadow-xs' 
                        : st.num === 2 
                          ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20 shadow-xs'
                          : st.num === 4
                            ? 'bg-purple-500/10 border-purple-500 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20 shadow-xs'
                            : 'bg-blue-500/10 border-blue-500 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20 shadow-xs'
                      : isDone
                        ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:border-emerald-500/60'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black shadow-xs ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                        ? st.num === 3 ? 'bg-emerald-500 text-white animate-pulse' : st.num === 2 ? 'bg-amber-500 text-white animate-pulse' : 'bg-primary text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}>
                    {isDone ? <CheckIcon className="w-4 h-4 stroke-[3]" /> : st.num}
                  </div>
                  <div className="truncate min-w-0">
                    <span className="text-xs font-bold block truncate leading-tight">
                      {st.label}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                      {isDone ? 'Erledigt (Prüfen)' : isCurrent ? 'Aktiv (Prüfen)' : 'Offen (Prüfen)'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 3. Nächste empfohlene Aktion (Volle Breite, sauber eingebetteter roter Button ohne Überlauf) */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary font-headline">
                  Nächste empfohlene Aktion
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {nextStep.badge}
                </span>
              </div>
              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white leading-snug">
                {nextStep.title}
              </h4>
              {nextStep.desc && (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                  {nextStep.desc}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              {nextStep.secondaryBtnText && nextStep.onSecondaryAction && (
                <button
                  type="button"
                  onClick={nextStep.onSecondaryAction}
                  className="py-2.5 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                >
                  <span>{nextStep.secondaryBtnText}</span>
                </button>
              )}
              <button
                type="button"
                onClick={nextStep.action}
                className="py-2.5 px-5 rounded-xl bg-primary hover:bg-[#b51822] text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm shadow-primary/20 cursor-pointer group shrink-0"
              >
                <span>{nextStep.btnText}</span>
                <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-0.5 transition-transform shrink-0" />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Quick Action Navigation Toolbar */}
      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
            Schnellaktionen & Workflows
          </h2>
          {activeOrder && (
            <span className="text-xs text-slate-400 font-medium">
              Ausgewählter Auftrag: <strong className="text-slate-700 dark:text-slate-200">#{activeOrder.orderNumber || activeOrder.id?.slice(-5).toUpperCase()}</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* 1. WhatsApp Quick Chat */}
          <button
            type="button"
            onClick={() => {
              const defaultT = allWaTemplates.find((t: any) => t.id === 't3') || allWaTemplates[0];
              if (defaultT) {
                setSelectedWaTemplateId(defaultT.id);
                setWaCustomText(formatTemplateText(defaultT.body));
              }
              setShowWhatsAppModal(true);
            }}
            className="w-full p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 hover:shadow-md transition-all group flex flex-col items-center text-center gap-2 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-xs">
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              WhatsApp Chat
            </span>
          </button>

          {/* 2. Zahlung erfassen (GUARDED: Nur mit Rechnung) */}
          <button
            type="button"
            onClick={() => handleRequestPayment(activeOrder)}
            className={`p-4 rounded-2xl bg-white dark:bg-slate-900 border transition-all group flex flex-col items-center text-center gap-2 ${
              hasInvoice 
                ? 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 hover:shadow-md' 
                : 'border-slate-200/80 dark:border-slate-800/80 opacity-75 hover:opacity-100 hover:border-amber-400'
            }`}
            title={hasInvoice ? "Zahlung auf Rechnung erfassen" : "Keine Rechnung vorhanden (Klicken zum Erstellen)"}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-xs ${
              hasInvoice 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-amber-500'
            }`}>
              <CurrencyEuroIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Zahlung erfassen
              </span>
              {!hasInvoice && (
                <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 block mt-0.5">
                  Rechnung fehlt
                </span>
              )}
            </div>
          </button>

          {/* 3. Protokoll erstellen / verwalten */}
          <button
            type="button"
            onClick={() => onOpenProtocolModal(activeOrder)}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/40 hover:shadow-md transition-all group flex flex-col items-center text-center gap-2 cursor-pointer relative"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs relative">
              <ClipboardDocumentCheckIcon className="w-5 h-5" />
              {hasActiveProtocols && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                  {activeProtocols.length}
                </span>
              )}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {hasActiveProtocols ? 'Protokolle verwalten' : 'Protokoll erfassen'}
              </span>
              {hasActiveProtocols ? (
                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 block mt-0.5">
                  {activeProtocols.length} {activeProtocols.length === 1 ? 'Eintrag' : 'Einträge'}
                </span>
              ) : (
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  Abnahme & Mängel
                </span>
              )}
            </div>
          </button>

          {/* 4. Laufzettel drucken */}
          <button
            type="button"
            onClick={() => onViewPdf(activeOrder, 'employee')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 hover:shadow-md transition-all group flex flex-col items-center text-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all shadow-xs">
              <DocumentTextIcon className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Laufzettel drucken
            </span>
          </button>

          {/* 5. Rechnung erstellen oder ansehen */}
          <button
            type="button"
            onClick={() => hasInvoice ? onViewPdf(linkedInvoice || activeOrder, 'invoice') : handleRequestInvoice(activeOrder)}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/40 hover:shadow-md transition-all group flex flex-col items-center text-center gap-2"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs">
              <DocumentCheckIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {hasInvoice ? 'Rechnung ansehen' : 'Rechnung erstellen'}
              </span>
              {hasInvoice && invoiceNumberDisplay && (
                <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 block mt-0.5">
                  {invoiceNumberDisplay}
                </span>
              )}
            </div>
          </button>
        </div>
      </section>



      {/* Main Content Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (7 cols): Route & Logistics + Checkliste */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Key Metrics Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Financial Health Card with Visual Progress */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                  Finanzen & Zahlung
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
                      ? 'Rechnung noch offen' 
                      : openAmount > 0 
                        ? `Offen: €${openAmount.toLocaleString('de-DE')}` 
                        : 'Ausgeglichen'}
                  </span>
                </div>
              </div>
            </div>

            {/* Move Schedule & Scope Card (Synchronized with Cockpit & Offer Form) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                  Termine & Umfang (Live-Sync)
                </span>
                <CalendarDaysIcon className="w-5 h-5 text-blue-500" />
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
                {(orderLogistics.estimatedVolume || activeOrder?.estimatedCbm) && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                    {orderLogistics.estimatedVolume || activeOrder?.estimatedCbm} m³
                  </span>
                )}
              </div>

              {activeOrder && (
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
                        </span>
                      ) : (
                        <span className="text-primary underline">+ Termin planen</span>
                      )}
                    </button>
                  </div>

                  {/* 2. Halteverbotszone (HVZ) */}
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
                      {activeOrder.orderMeta?.halteverbotDate || activeOrder.logistics?.hvzDate ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatCustomerDate(activeOrder.orderMeta?.halteverbotDate || activeOrder.logistics?.hvzDate, activeOrder.orderMeta?.halteverbotTime || activeOrder.logistics?.hvzTime)}</span>
                        </span>
                      ) : (
                        <span className="text-primary underline">+ Termin planen</span>
                      )}
                    </button>
                  </div>

                  {/* 3. Kartonlieferung */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Kartonlieferung:</span>
                    <button
                      type="button"
                      onClick={() => setScheduleModalTodo({ id: 'kartons_liefern', kanbanCategory: 'kartons', name: 'Kartons' })}
                      className="font-bold text-right hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                      title="Klicken zum Planen oder Ändern der Kartonlieferung"
                    >
                      {activeOrder.orderMeta?.kartonDeliveryDate || activeOrder.logistics?.boxDeliveryDate ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{formatCustomerDate(activeOrder.orderMeta?.kartonDeliveryDate || activeOrder.logistics?.boxDeliveryDate, activeOrder.orderMeta?.kartonDeliveryTime || activeOrder.logistics?.boxDeliveryTime)}</span>
                        </span>
                      ) : (
                        <span className="text-primary underline">+ Termin planen</span>
                      )}
                    </button>
                  </div>

                  {/* 4. Möbellift (if needed or scheduled) */}
                  {(activeOrder.logistics?.a_furnitureLift || activeOrder.logistics?.b_furnitureLift || activeOrder.orderMeta?.moebelliftDate) && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">Möbellift:</span>
                      <button
                        type="button"
                        onClick={() => setScheduleModalTodo({ id: 'moebellift_buchen', kanbanCategory: 'moebellift', name: 'Möbellift' })}
                        className="font-bold text-right hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                        title="Klicken zum Planen oder Ändern des Möbellifts"
                      >
                        {activeOrder.orderMeta?.moebelliftDate ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{formatCustomerDate(activeOrder.orderMeta.moebelliftDate, activeOrder.orderMeta.moebelliftTime)}</span>
                          </span>
                        ) : (
                          <span className="text-primary underline">+ Termin planen</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>



          {/* Smart Logistics & Multi-Stop Route Engine (Bochum Depot Roundtrip) */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
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

              {/* Route Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCalculateRoute}
                  disabled={isCalculatingRoute || !bothAddressesPresent}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-xs shadow-blue-500/20"
                >
                  <ArrowPathIcon className={`w-3.5 h-3.5 ${isCalculatingRoute ? 'animate-spin' : ''}`} />
                  <span>{isCalculatingRoute ? 'Berechne...' : 'Route berechnen'}</span>
                </button>

                {googleMapsRouteUrl && (
                  <a
                    href={googleMapsRouteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
                    title="Komplette Tour in Google Maps öffnen"
                  >
                    <MapPinIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Auf Maps öffnen</span>
                  </a>
                )}
              </div>
            </div>

            {/* Smart Dual-Distance Result Banner */}
            {routeInfo && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50 dark:from-blue-950/30 dark:via-slate-900 dark:to-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Leg 1: Direct Move (A -> B) */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1">
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
                  <span className="font-semibold text-blue-600 dark:text-blue-400">OSRM Präzisions-Routing</span>
                </div>
              </div>
            )}

            {/* Address Cards: Auszugsort (A) & Einzugsort (B) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Beladestelle (Auszug) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1 font-headline">
                    <HomeIcon className="w-4 h-4" />
                    Beladestelle (Auszug A)
                  </span>
                  {hasA ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      Erfasst
                    </span>
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
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      Erfasst
                    </span>
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

        {/* Right Column (5 cols): Contact Info + Active Offer Switcher */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Contact Details Card with Direct Actions */}
          <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white">
                Kontaktdaten
              </h3>
              <button
                type="button"
                onClick={onEditCustomer}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <PencilSquareIcon className="w-3.5 h-3.5" />
                <span>Bearbeiten</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Phone */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <PhoneIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Telefon</span>
                    <a href={`tel:${customer?.phone}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-primary">
                      {customer?.phone || 'Keine Nummer hinterlegt'}
                    </a>
                  </div>
                </div>
                {customer?.phone && (
                  <a
                    href={`tel:${customer.phone}`}
                    className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-primary hover:text-white transition-colors text-slate-700 dark:text-slate-200"
                    title="Anrufen"
                  >
                    <PhoneIcon className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <EnvelopeIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">E-Mail</span>
                    <a href={`mailto:${customer?.email}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-primary truncate block max-w-[180px]">
                      {customer?.email || 'Keine E-Mail hinterlegt'}
                    </a>
                  </div>
                </div>
                {customer?.email && (
                  <a
                    href={`mailto:${customer.email}`}
                    className="p-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-primary hover:text-white transition-colors text-slate-700 dark:text-slate-200"
                    title="E-Mail schreiben"
                  >
                    <EnvelopeIcon className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Main Address */}
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                  <HomeIcon className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Kundenadresse</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {customer?.street ? `${customer.street}, ${customer.zip || ''} ${customer.city || ''}` : 'Keine Stamm-Adresse hinterlegt'}
                  </span>
                </div>
              </div>
            </div>
          </div>

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
                          {ord.logistics?.movingDate || 'Ohne Datum'}
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
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <ClipboardDocumentCheckIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <span>Übergabeprotokolle</span>
                      {hasActiveProtocols && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
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
                      className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Protokoll als PDF anzeigen / drucken"
                    >
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenProtocolModal(activeOrder)}
                    className="p-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer"
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
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300';

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
                    className="py-1.5 px-3.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 font-bold text-xs inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
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
              const dateDisplay = ord.logistics?.movingDate || ord.createdAt?.toDate?.()?.toLocaleDateString('de-DE') || 'Kein Datum';
              const routeDisplay = ord.logistics?.a_city && ord.logistics?.b_city 
                ? `${ord.logistics.a_city} ➔ ${ord.logistics.b_city}`
                : 'Lokaler Auftrag';

              const ordLinkedInv = (invoices || []).find((inv: any) => 
                inv.sourceOrderId === ord.id || 
                inv.orderId === ord.id || 
                inv.id === ord.id || 
                (ord.invoiceNumber && inv.invoiceNumber === ord.invoiceNumber)
              );
              const ordHasInvoice = Boolean(
                ord.invoiceNumber || 
                ord.status?.startsWith('invoice_') || 
                ordLinkedInv ||
                (ord.invoiceHistory && ord.invoiceHistory.length > 0)
              );
              const ordInvoiceNum = ord.invoiceNumber || ordLinkedInv?.invoiceNumber;

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
                      <span className="text-xs font-bold text-primary">
                        €{ordTotals.gross.toLocaleString('de-DE')}
                      </span>
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
                    {/* 1. Angebot / Entwurf bearbeiten Button */}
                    <Link
                      href={`/dashboard/customers/${customer.id}/edit-order/${ord.id}`}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#D91E2A] text-white hover:bg-[#b51822] transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <PencilSquareIcon className="w-3.5 h-3.5" />
                      <span>{ord.status === 'draft' ? 'Entwurf bearbeiten' : 'Bearbeiten'}</span>
                    </Link>

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

                    {/* 3. PDF Vorschau */}
                    <button
                      type="button"
                      onClick={() => onViewPdf(ord, 'order')}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <DocumentTextIcon className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>

                    {/* 4. Protokoll ansehen oder erstellen */}
                    {ord.protocols && ord.protocols.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => onViewPdf(ord, 'protocol')}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-all flex items-center gap-1.5 cursor-pointer"
                        title={`Übergabeprotokoll (${ord.protocols.length}) als PDF anzeigen`}
                      >
                        <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
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

                    {/* 5. Intelligente Phase-spezifische Aktion (Signatur vs Rechnung) */}
                    {['quote', 'clarification', 'verhandlung'].includes(ord.status) && !(ord.signature || ord.orderMeta?.customerSignature) ? (
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
                    ) : ordHasInvoice ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onViewPdf(ordLinkedInv || ord, 'invoice')}
                          className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-100 dark:bg-purple-950/60 hover:bg-purple-200 dark:hover:bg-purple-900/80 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-700 transition-all flex items-center gap-1.5 cursor-pointer"
                          title={`Rechnung ${ordInvoiceNum || ''} als PDF anzeigen`}
                        >
                          <DocumentCheckIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                          <span>Rechnung {ordInvoiceNum ? `(${ordInvoiceNum})` : 'ansehen'}</span>
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
                        title="Rechnung für diesen bestätigten Auftrag erstellen"
                      >
                        <DocumentCheckIcon className="w-3.5 h-3.5" />
                        <span>Rechnung erstellen</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* STEP 1 PRIORITY: Unconfirmed Invoice Warning Confirmation Modal */}
      {unconfirmedInvoiceOrder && (
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
                  Angebot noch nicht bestätigt
                </h3>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-2">
              <p className="font-semibold text-sm">
                Der Kunde hat dieses Angebot noch nicht bestätigt oder digital signiert.
              </p>
              <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                Möchten Sie trotzdem fortfahren und eine Rechnung erstellen? Normalerweise wird die Rechnung erst nach unterschriebenem Auftrag oder durchgeführtem Umzug generiert.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Betroffenes Angebot:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  #{unconfirmedInvoiceOrder.orderNumber || unconfirmedInvoiceOrder.id.slice(-5).toUpperCase()}
                </span>
              </div>
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

              {onOpenSignatureModal && (
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
                  <span>Zuerst digital signieren</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const ordId = unconfirmedInvoiceOrder.id;
                  setUnconfirmedInvoiceOrder(null);
                  router.push(`/dashboard/customers/${customer.id}/edit-invoice/${ordId}`);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 shadow-md transition-colors"
              >
                Trotzdem Rechnung erstellen
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
