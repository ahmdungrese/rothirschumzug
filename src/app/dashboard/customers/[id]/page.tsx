"use client";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { doc, collection, query, where, onSnapshot, updateDoc, deleteDoc, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { 
  XMarkIcon, ArchiveBoxIcon, MapIcon, ArrowUpOnSquareIcon, 
  DocumentTextIcon, TruckIcon, CheckIcon, MapPinIcon, ClockIcon,
  UserIcon, PencilIcon, CheckBadgeIcon, CheckCircleIcon, DocumentArrowDownIcon, TrashIcon, EnvelopeIcon,
  LinkIcon, PlusIcon, UserCircleIcon, PhoneIcon, StarIcon, BanknotesIcon, ExclamationTriangleIcon, 
  ArrowUturnLeftIcon, EllipsisHorizontalIcon, ChevronDownIcon, ChevronUpIcon, BoltIcon, 
  ClipboardDocumentIcon, ClipboardDocumentListIcon, ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';
import { PDFGenerator } from '@/components/pdf/PDFGenerator';
import { InlinePDFViewer } from '@/components/pdf/InlinePDFViewer';
import { generateTickets } from '@/lib/ticketEngine';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { QuickCreateCustomer } from '@/components/customers/QuickCreateCustomer';
import { SignatureModal } from '@/components/orders/SignatureModal';
import { ProtocolModal } from '@/components/customers/ProtocolModal';
import { DispoModal } from '@/components/orders/DispoModal';
import { ClaimModal } from '@/components/customers/ClaimModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PaymentManager } from '@/components/orders/PaymentManager';
import { PdfModal } from '@/components/ui/PdfModal';
import { calculateRoute } from '@/lib/routeCalculator';
import { getCol } from '@/lib/demoMode';
import { changeOrderStatus, generateContract } from '@/lib/orderStateMachine';
import { LogisticsBoard } from '@/components/orders/LogisticsBoard';
import { MessageSenderModal } from '@/components/customers/MessageSenderModal';
import { useAuth } from '@/context/AuthContext';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';

export default function CustomerProfilePage() {
  const { user, profile } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals & Context States
  const [protocolOrder, setProtocolOrder] = useState<any>(null);
  const [dispoOrder, setDispoOrder] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [pdfType, setPdfType] = useState<'order' | 'contract' | 'employee' | 'invoice' | 'protocol'>('order');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<string | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [messageOrder, setMessageOrder] = useState<any>(null);
  const [signatureOrder, setSignatureOrder] = useState<any>(null);
  const [pdfModalOrder, setPdfModalOrder] = useState<any>(null);
  const [inlinePdfOrder, setInlinePdfOrder] = useState<any>(null);
  const [inlinePdfType, setInlinePdfType] = useState<string>('order');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Route calculation states mapping by orderId
  const [routeInfo, setRouteInfo] = useState<{ [orderId: string]: { direct: { distanceKm: number, durationMinutes: number }, total: { distanceKm: number, durationMinutes: number } } }>({});
  const [isCalculatingRoute, setIsCalculatingRoute] = useState<{ [orderId: string]: boolean }>({});
  const [routeError, setRouteError] = useState<{ [orderId: string]: string | null }>({});

  useEffect(() => {
    const docRef = doc(db, getCol('customers'), customerId);
    const unsubCustomer = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setCustomer(data);
        if (!editData) setEditData(data);
      }
      setLoading(false);
    });

    const q = query(collection(db, getCol('orders')), where('customerId', '==', customerId));
    const unsubOrders = onSnapshot(q, (querySnapshot) => {
      const fetchedOrders = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedOrders.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
      setOrders(fetchedOrders);
      // Auto expand newest order if none expanded
      if (fetchedOrders.length > 0 && !expandedOrderId) {
        setExpandedOrderId(fetchedOrders.find((o: any) => o.status !== 'archived')?.id || null);
      }
    });

    const unsubSettings = onSnapshot(doc(db, getCol('system'), 'settings'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });

    const qClaims = query(collection(db, getCol('claims')), where('customerId', '==', customerId));
    const unsubClaims = onSnapshot(qClaims, (querySnapshot) => {
      const fetchedClaims = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedClaims.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
      setClaims(fetchedClaims);
    });

    return () => { unsubCustomer(); unsubOrders(); unsubSettings(); unsubClaims(); };
  }, [customerId]);

  const activeOrdersList = useMemo(() => {
    return orders
      .filter(o => o.status !== 'archived')
      .filter(o => !(o.type === 'invoice' && o.sourceOrderId)) // Hide nested invoices
      .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
  }, [orders]);

  const checklist = useMemo(() => {
    if (!customer) return null;
    const items = [];
    
    // Phase 1: Kundendaten & Verifizierung
    const missingData = [];
    if (!customer.phone) missingData.push("Telefonnummer");
    if (!customer.email) missingData.push("E-Mail");
    if (!customer.street || !customer.houseNr || !customer.zip || !customer.city) {
      missingData.push("Vollständige Adresse (Str., Hausnr., PLZ, Ort)");
    }
    
    const activeOrder = orders.find(o => o.status !== 'archived');
    if (activeOrder) {
      if (!activeOrder.orderMeta?.movingDateFrom) {
        missingData.push("Umzugsdatum");
      }
      const log = activeOrder.logistics;
      if (!log?.a_street || !log?.a_houseNr || !log?.a_zip || !log?.a_city) {
        missingData.push("Auszugsadresse (A)");
      }
      if (!log?.b_street || !log?.b_houseNr || !log?.b_zip || !log?.b_city) {
        missingData.push("Einzugsadresse (B)");
      }
    }
    
    // Check if customer was created > 3 days ago for overdue status in Phase 1
    let phase1Status: 'warning' | 'danger' = 'warning';
    if (customer.createdAt) {
      const createdDate = customer.createdAt?.seconds ? new Date(customer.createdAt.seconds * 1000) : new Date(customer.createdAt);
      const diffTime = new Date().getTime() - createdDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays >= 3) {
        phase1Status = 'danger';
      }
    }

    if (missingData.length > 0) {
      items.push({ 
        phase: 1, 
        title: phase1Status === 'danger' ? 'Kundendaten-Verifizierung (ÜBERFÄLLIG!)' : 'Kundendaten-Verifizierung', 
        desc: `Es fehlen wichtige Verifizierungsdaten: ${missingData.join(', ')}`, 
        status: phase1Status, 
        action: () => setIsEditing(true) 
      });
    }

    // Phase 2: Angebot erstellen
    if (missingData.length === 0) { // Only if verified
      if (!activeOrder) {
        let phase2Status: 'warning' | 'danger' = 'warning';
        if (customer.createdAt) {
          const createdDate = customer.createdAt?.seconds ? new Date(customer.createdAt.seconds * 1000) : new Date(customer.createdAt);
          const diffTime = new Date().getTime() - createdDate.getTime();
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          if (diffDays >= 2) {
            phase2Status = 'danger';
          }
        }
        items.push({ 
          phase: 2, 
          title: phase2Status === 'danger' ? 'Erstes Angebot erstellen (ÜBERFÄLLIG!)' : 'Erstes Angebot erstellen', 
          desc: 'Der Kunde hat noch kein Angebot.', 
          status: phase2Status, 
          action: () => router.push(`/dashboard/customers/${customerId}/new-order`) 
        });
      } else if (activeOrder.status === 'draft') {
        if (activeOrder.orderMeta?.viewingDate === 'requested') {
          items.push({ 
            phase: 2, 
            title: 'Besichtigungstermin planen', 
            desc: 'Kunde wünscht einen Besichtigungstermin.', 
            status: 'warning',
            action: () => router.push(`/dashboard/customers/${customerId}/edit-order/${activeOrder.id}`)
          });
        } else {
          items.push({ 
            phase: 2, 
            title: 'Angebot fertigstellen & vorlegen', 
            desc: 'Bitte sende dem Kunden das finale Angebot.', 
            status: 'info' 
          });
        }
      } else if (activeOrder.status === 'quote') {
        if (activeOrder.orderMeta?.viewingDate === 'requested') {
          items.push({ 
            phase: 2, 
            title: 'Besichtigungstermin planen', 
            desc: 'Kunde wünscht einen Besichtigungstermin.', 
            status: 'warning',
            action: () => router.push(`/dashboard/customers/${customerId}/edit-order/${activeOrder.id}`)
          });
        }
      }
    }

    // Phase 3 & 4: Auftragsdetails & Status
    if (activeOrder && missingData.length === 0) {
      if (activeOrder.status === 'quote') {
        items.push({ 
          phase: 3, 
          title: 'Angebot bestätigen', 
          desc: 'Warten auf Kundenbestätigung (Digitale Signatur oder externe Zusage).', 
          status: 'warning' 
        });
      }
      
      // Phase 5: Rechnungen & Reklamationen
      const unpaidInvoices = orders.filter(o => o.status === 'invoice_open' || o.status === 'invoice_overdue');
      if (unpaidInvoices.length > 0) {
        items.push({ 
          phase: 5, 
          title: 'Offene Rechnungen', 
          desc: `${unpaidInvoices.length} Rechnung(en) warten auf Zahlungseingang.`, 
          status: 'danger', 
          action: () => setPaymentOrder(unpaidInvoices[0]) 
        });
      } else if (activeOrder.status === 'completed' && activeOrder.type !== 'invoice' && !activeOrder.invoiceNumber) {
        items.push({ 
          phase: 5, 
          title: 'Rechnung erstellen', 
          desc: 'Der Umzug ist abgeschlossen. Es wurde noch keine Rechnung generiert.', 
          status: 'warning', 
          action: async () => {
             try {
               await changeOrderStatus(activeOrder.id, 'invoice_open', { userId: profile?.uid });
               toast.success('Rechnung generiert!');
             } catch (err: any) {
               toast.error(err.message || 'Fehler beim Erstellen der Rechnung');
             }
          }
        });
      }
    }
    
    return items;
  }, [customer, orders, customerId, router]);

  const deleteOrder = async (orderId: string) => {
    if (!confirm('Möchten Sie diesen Auftrag wirklich archivieren/löschen?')) return;
    try {
      await updateDoc(doc(db, getCol('orders'), orderId), { status: 'archived', updatedAt: serverTimestamp() });
      toast.success("Dokument wurde archiviert!");
    } catch (e) {
      toast.error("Fehler beim Archivieren.");
    }
  };

  const handleDeleteCustomer = async () => {
    const hasInvoices = orders.some(o => o.type === 'invoice' || o.invoiceNumber || o.status.startsWith('invoice_') || o.status === 'completed');
    
    if (hasInvoices) {
      if (!confirm('Dieser Kunde hat bereits Rechnungen oder abgeschlossene Aufträge und kann aus rechtlichen Gründen nicht gelöscht werden. Bitte stornieren Sie zuerst die Rechnungen. Möchten Sie den Kunden stattdessen archivieren?')) return;
      try {
        await updateDoc(doc(db, getCol('customers'), customerId), { status: 'archived', updatedAt: serverTimestamp() });
        toast.success("Kunde wurde archiviert!");
        router.push('/dashboard/customers');
      } catch (e) {
        toast.error("Fehler beim Archivieren.");
      }
    } else {
      if (!confirm('Möchten Sie diesen Kunden wirklich unwiderruflich löschen? Alle zugehörigen Angebote und Entwürfe werden dabei ebenfalls gelöscht.')) return;
      try {
        for (const o of orders) {
          await deleteDoc(doc(db, getCol('orders'), o.id));
        }
        await deleteDoc(doc(db, getCol('customers'), customerId));
        toast.success("Kunde und zugehörige Dokumente erfolgreich gelöscht!");
        router.push('/dashboard/customers');
      } catch (e) {
        toast.error("Fehler beim Löschen.");
      }
    }
  };

  const handleCalculateRoute = async (orderId: string, logistics: any) => {
    const addressA = `${logistics?.a_street || ''} ${logistics?.a_houseNr || ''}, ${logistics?.a_zip || ''} ${logistics?.a_city || ''}`.trim();
    const addressB = `${logistics?.b_street || ''} ${logistics?.b_houseNr || ''}, ${logistics?.b_zip || ''} ${logistics?.b_city || ''}`.trim();
    const baseAddress = "Bochum, Germany"; // Hauptsitz
    
    if (addressA.length > 5 && addressB.length > 5 && addressA !== addressB) {
      setIsCalculatingRoute(prev => ({ ...prev, [orderId]: true }));
      setRouteError(prev => ({ ...prev, [orderId]: null }));
      try {
        const resDirect = await calculateRoute(addressA, addressB);
        const resBaseToA = await calculateRoute(baseAddress, addressA);
        const resBToBase = await calculateRoute(addressB, baseAddress);

        if (resDirect && resBaseToA && resBToBase) {
          const totalDistance = resBaseToA.distanceKm + resDirect.distanceKm + resBToBase.distanceKm;
          const totalDuration = resBaseToA.durationMinutes + resDirect.durationMinutes + resBToBase.durationMinutes;
          
          setRouteInfo(prev => ({
            ...prev,
            [orderId]: {
              direct: resDirect,
              total: { distanceKm: Math.round(totalDistance * 10) / 10, durationMinutes: totalDuration }
            }
          }));
        } else if (resDirect) {
          setRouteInfo(prev => ({
            ...prev,
            [orderId]: { direct: resDirect, total: resDirect }
          }));
        } else {
          setRouteError(prev => ({ ...prev, [orderId]: "Route konnte nicht berechnet werden." }));
        }
      } catch (err) {
        setRouteError(prev => ({ ...prev, [orderId]: "Fehler bei der Routenberechnung." }));
      }
      setIsCalculatingRoute(prev => ({ ...prev, [orderId]: false }));
    } else {
      setRouteError(prev => ({ ...prev, [orderId]: "Unvollständige Adressen." }));
    }
  };

  const handleUpdateOrderStatus = async (order: any, newStatus: string) => {
    try {
      await changeOrderStatus(order.id, newStatus as any, { 
        userId: user?.uid,
        userName: user?.email || 'System'
      });
      
      if (newStatus === 'confirmed') toast.success("Angebot bestätigt!");
      else if (newStatus === 'invoice_open') toast.success("Rechnung generiert!");
      else toast.success("Status aktualisiert!");
      
      setActiveDropdown(null);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Ein Fehler ist aufgetreten.");
    }
  };

  const handleConfirmOrder = async (order: any) => {
    if (order.signatureOrder || order.externallyConfirmed) {
      await handleUpdateOrderStatus(order, 'confirmed');
    } else {
      if (window.confirm("Der Auftrag hat noch keine digitale Unterschrift. Wurde er extern bestätigt (z.B. per WhatsApp / E-Mail)?\n\nKlicken Sie auf 'OK' für externe Bestätigung, oder 'Abbrechen' um digital zu unterschreiben.")) {
        try {
          await updateDoc(doc(db, getCol('orders'), order.id), {
            externallyConfirmed: true,
            updatedAt: serverTimestamp()
          });
          await handleUpdateOrderStatus({ ...order, externallyConfirmed: true }, 'confirmed');
          toast.success("Auftrag extern bestätigt!");
        } catch (e) {
          toast.error("Fehler beim Bestätigen.");
        }
      } else {
        setSignatureOrder(order);
      }
    }
  };

  const handleStorno = async (order: any, createCorrection: boolean = true) => {
    try {
      await updateDoc(doc(db, getCol('orders'), order.id), { status: 'invoice_cancelled', updatedAt: serverTimestamp() });
      const settingsSnap = await getDoc(doc(db, getCol('system'), 'settings'));
      const nextInvoiceNum = settingsSnap.data()?.nextInvoiceNumber || 1000;
      const stornoInvoiceNumber = `RE-${new Date().getFullYear()}-${nextInvoiceNum}`;
      await updateDoc(doc(db, getCol('system'), 'settings'), { nextInvoiceNumber: nextInvoiceNum + 1 });
      
      const origNet = order.totals?.net ?? order.calcInput?.net ?? (order.isFlatRate ? (order.flatRateNet || 0) : (order.services || []).reduce((acc: number, curr: any) => acc + (curr.quantity * (curr.unitPrice || 0)), 0));
      const origTax = order.totals?.tax ?? order.calcInput?.tax ?? (origNet * 0.19);
      const origGross = order.totals?.gross ?? order.calcInput?.gross ?? (origNet + origTax);
      
      const stornoTotals = { net: -origNet, tax: -origTax, gross: -origGross };
      
      const { id, customerSignature, ...orderDataWithoutId } = order;
      
      // Negate services and flatRate for the Storno document so the PDF table is correct
      const stornoServices = (order.services || []).map((s: any) => ({
        ...s,
        unitPrice: s.unitPrice ? -s.unitPrice : 0
      }));
      const stornoFlatRateNet = order.flatRateNet ? -order.flatRateNet : 0;
      
      await addDoc(collection(db, getCol('orders')), {
        ...orderDataWithoutId,
        status: 'invoice_cancelled',
        isStorno: true,
        stornoFor: order.invoiceNumber,
        invoiceNumber: stornoInvoiceNumber,
        totals: stornoTotals,
        calcInput: stornoTotals,
        services: stornoServices,
        flatRateNet: stornoFlatRateNet,
        payments: [], // Storno shouldn't copy the payments array
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (createCorrection) {
        await addDoc(collection(db, getCol('orders')), {
          ...orderDataWithoutId,
          status: 'draft',
          invoiceNumber: null,
          contractNumber: null,
          orderNumber: `${order.orderNumber}-KORR`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      toast.success(createCorrection ? "Erfolgreich storniert! Storno-Beleg & neuer Entwurf erstellt." : "Erfolgreich storniert!");
      setActiveDropdown(null);
    } catch (error) {
      toast.error("Fehler beim Stornieren.");
    }
  };

  const handleSaveCustomer = async () => {
    try {
      await updateDoc(doc(db, getCol('customers'), customerId), {
        salutation: editData.salutation || '',
        firstName: editData.firstName || '',
        lastName: editData.lastName || '',
        email: editData.email || '',
        phone: editData.phone || '',
        street: editData.street || '',
        houseNr: editData.houseNr || '',
        zip: editData.zip || '',
        city: editData.city || '',
        source: editData.source || '',
        type: editData.type || 'privat'
      });
      setIsEditing(false);
      toast.success("Kundendaten gespeichert!");
    } catch (error) {
      toast.error("Fehler beim Speichern");
    }
  };

  if (loading) return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  if (!customer) return <div className="text-center p-12 text-red-400">Kunde nicht gefunden.</div>;

  // Filter for valid financial documents to avoid double-counting
  const validFinancialDocs = orders.filter(o => o.status !== 'archived' && o.status !== 'canceled').filter(o => {
    if (o.type === 'invoice') return true; // Invoices always count
    // Orders only count if they haven't been invoiced yet
    const hasChildInvoice = orders.some(child => child.sourceOrderId === o.id && child.type === 'invoice' && child.status !== 'archived' && child.status !== 'canceled');
    return !hasChildInvoice;
  });

  const totalRevenue = validFinancialDocs.filter(o => ['quote', 'confirmed', 'completed', 'invoice_open', 'invoice_paid'].includes(o.status)).reduce((sum, o) => sum + (o.totals?.gross ?? o.calcInput?.gross ?? 0), 0);
  const openItems = validFinancialDocs.filter(o => ['invoice_open', 'invoice_overdue', 'confirmed', 'completed'].includes(o.status)).reduce((sum, o) => {
    const gross = o.totals?.gross ?? o.calcInput?.gross ?? 0;
    const paid = o.payments?.reduce((pSum: number, p: any) => pSum + p.amount, 0) || 0;
    return sum + Math.max(0, gross - paid);
  }, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-6 max-w-[1400px] mx-auto pb-20 pt-4 animate-in fade-in duration-500 min-h-screen">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] flex items-center justify-center z-[-1] overflow-hidden bg-bg-dark"></div>

      {/* LEFT SIDEBAR: Customer Master Info */}
      <div className="w-full lg:w-[320px] shrink-0 space-y-4">
        <div className="bg-bg-panel border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          
          <div className="flex items-center gap-4 mb-6 relative z-10">
            <div className="w-16 h-16 rounded-full bg-black/40 border border-white/10 flex items-center justify-center text-text-muted shadow-inner">
              <UserCircleIcon className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-main leading-tight">
                {customer.type === 'firma' ? customer.lastName : `${customer.firstName} ${customer.lastName}`.trim()}
              </h1>
              {customer.type === 'firma' && customer.firstName && <div className="text-sm text-text-muted">z.H. {customer.firstName}</div>}
              {customer.source && <div className="text-xs text-primary font-medium mt-1 uppercase tracking-wider">{customer.source}</div>}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5 relative z-10">
              <input type="text" placeholder="Vorname" value={editData.firstName} onChange={e => setEditData({...editData, firstName: e.target.value})} className="input-field w-full text-sm" />
              <input type="text" placeholder="Nachname" value={editData.lastName} onChange={e => setEditData({...editData, lastName: e.target.value})} className="input-field w-full text-sm" />
              <input type="text" placeholder="Telefon" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="input-field w-full text-sm" />
              <input type="email" placeholder="E-Mail" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="input-field w-full text-sm" />
              <div className="flex gap-2"><input type="text" placeholder="Str." value={editData.street} onChange={e => setEditData({...editData, street: e.target.value})} className="input-field w-full text-sm" /><input type="text" placeholder="Nr" value={editData.houseNr} onChange={e => setEditData({...editData, houseNr: e.target.value})} className="input-field w-16 text-sm" /></div>
              <div className="flex gap-2"><input type="text" placeholder="PLZ" value={editData.zip} onChange={e => setEditData({...editData, zip: e.target.value})} className="input-field w-24 text-sm" /><input type="text" placeholder="Ort" value={editData.city} onChange={e => setEditData({...editData, city: e.target.value})} className="input-field w-full text-sm" /></div>
              <div className="pt-2">
                <select value={editData.source} onChange={e => setEditData({...editData, source: e.target.value})} className="input-field w-full text-sm border-primary/30 focus:border-primary text-text-main">
                  <option value="">Kundenquelle auswählen...</option>
                  {settings?.customerSources?.map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setIsEditing(false)} className="btn-secondary flex-1 py-1.5 text-xs">Abbrechen</button>
                <button onClick={handleSaveCustomer} className="btn-primary flex-1 py-1.5 text-xs">Speichern</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-sm relative z-10">
              {customer.phone && <div className="flex items-center gap-3 text-text-muted"><PhoneIcon className="w-4 h-4 text-primary" /> {customer.phone}</div>}
              {customer.email && <div className="flex items-center gap-3 text-text-muted"><EnvelopeIcon className="w-4 h-4 text-primary" /> {customer.email}</div>}
              {(customer.street || customer.city) && <div className="flex items-start gap-3 text-text-muted"><MapPinIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" /> <span>{customer.street} {customer.houseNr}<br/>{customer.zip} {customer.city}</span></div>}
              <button onClick={() => setIsEditing(true)} className="text-xs text-primary hover:text-white transition-colors mt-2 underline underline-offset-2">Bearbeiten</button>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-white/10 relative z-10 space-y-3">
            <button onClick={() => router.push(`/dashboard/customers/${customerId}/new-order`)} className="btn-primary w-full py-3 shadow-lg shadow-primary/20 flex justify-center items-center gap-2 text-sm">
              <PlusIcon className="w-5 h-5" /> Neues Angebot
            </button>
            <button onClick={() => router.push(`/dashboard/customers/${customerId}/new-order?type=invoice`)} className="btn-secondary w-full py-2 flex justify-center items-center gap-2 text-xs border border-structure hover:bg-bg-panel">
              <DocumentTextIcon className="w-4 h-4" /> Neue freie Rechnung
            </button>
          </div>
          
          {/* Danger Zone */}
          <div className="mt-6 pt-6 border-t border-red-500/20 relative z-10">
             <button onClick={handleDeleteCustomer} className="w-full py-2 flex justify-center items-center gap-2 text-xs text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20">
               <TrashIcon className="w-4 h-4" /> Kunde löschen / archivieren
             </button>
          </div>
        </div>

        {/* Claims Alert if any */}
        {claims.filter(c => c.status !== 'closed').length > 0 && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center justify-between shadow-inner cursor-pointer hover:bg-red-500/20 transition-colors" onClick={() => setShowClaimModal(true)}>
            <div className="flex items-center gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
              <span className="text-sm font-bold text-red-400">Offene Reklamation!</span>
            </div>
            <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">{claims.filter(c => c.status !== 'closed').length}</span>
          </div>
        )}

        {/* Claims History List */}
        {claims.length > 0 && (
          <div className="bg-bg-panel border border-white/5 rounded-2xl p-5 shadow-xl mt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                <ExclamationTriangleIcon className="w-4 h-4 text-red-500" /> Reklamationen Historie
              </h3>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
              {claims.map(claim => (
                <Link href={`/dashboard/claims?claimId=${claim.id}`} key={claim.id}>
                  <div className="bg-black/20 border border-white/5 rounded-xl p-3 hover:border-red-500/50 hover:bg-black/40 transition-all cursor-pointer mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-xs text-red-400">{claim.claimNumber || 'Ohne Nummer'}</span>
                      <StatusBadge status={claim.status} />
                    </div>
                    <div className="text-xs text-text-muted line-clamp-2">{claim.description || 'Keine Beschreibung'}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT MAIN AREA: Timeline & Finances */}
      <div className="flex-1 space-y-4">
        
        {/* Unified Top Financial Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-bg-panel border border-white/5 rounded-2xl p-4 shadow-md">
          <h2 className="text-lg font-bold text-text-main flex items-center gap-2"><DocumentTextIcon className="w-5 h-5 text-primary" /> Auftragshistorie</h2>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-0.5">Gesamtumsatz</div>
              <div className="text-sm font-bold text-text-main">€ {totalRevenue.toFixed(2)}</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-0.5">Offen / Ausstehend</div>
              <div className={`text-sm font-bold ${openItems > 0 ? 'text-red-400' : 'text-text-main'}`}>€ {openItems.toFixed(2)}</div>
            </div>
            <button onClick={() => setShowClaimModal(true)} className="ml-2 p-2 bg-black/20 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-colors border border-white/5 shadow-inner" title="Reklamationen anzeigen">
              <ExclamationTriangleIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Timeline */}
        {activeOrdersList.length === 0 ? (
           <div className="flex flex-col items-center justify-center p-20 bg-black/10 border border-dashed border-white/10 rounded-2xl">
             <DocumentTextIcon className="w-12 h-12 text-text-muted/30 mb-4" />
             <div className="text-text-muted font-medium">Bisher keine Aufträge vorhanden.</div>
           </div>
        ) : (
          <div className="space-y-4">
            {activeOrdersList.map((order, index) => {
              const isExpanded = expandedOrderId === order.id;
              const isInvoice = order.type === 'invoice' || order.status.startsWith('invoice_');
              const isQuote = order.status === 'draft' || order.status === 'quote' || order.status === 'clarification';
              const linkedInvoices = orders.filter(o => o.sourceOrderId === order.id);
              const hasActiveInvoice = linkedInvoices.some(inv => inv.status !== 'canceled' && inv.status !== 'archived');
              
              return (
                <div key={order.id} className={`bg-bg-panel border ${isExpanded ? 'border-primary/40 shadow-lg shadow-primary/5' : 'border-white/5 hover:border-white/10 shadow-sm'} rounded-2xl overflow-hidden transition-all duration-300`}>
                  
                  {/* Timeline Header (Always Visible) */}
                  <div 
                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${isInvoice ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' : 'bg-primary/10 border-primary/30 text-primary'}`}>
                        <DocumentTextIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-text-main text-base flex items-center gap-2">
                          {isInvoice ? 'Rechnung' : (['draft', 'quote'].includes(order.status) ? 'Angebot' : 'Auftrag')} {order.invoiceNumber ? `#${order.invoiceNumber}` : order.orderNumber ? `#${order.orderNumber}` : ''}
                        </h3>
                        <div className="text-xs text-text-muted mt-0.5 flex items-center gap-2">
                          {new Date(order.createdAt?.toMillis?.() || Date.now()).toLocaleDateString('de-DE')}
                          <span>•</span>
                          <StatusBadge status={order.status} payments={order.payments} totals={order.totals} calcInput={order.calcInput} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="font-bold text-text-main">€ {Number(order.totals?.gross || order.calcInput?.gross || 0).toFixed(2)}</div>
                      </div>
                      <div className="text-text-muted">
                        {isExpanded ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail View */}
                  {isExpanded && (
                    <div className="border-t border-white/5 bg-black/20 p-5 animate-in slide-in-from-top-2 duration-300">
                      
                      {/* Unified Live-Reaktions-Fläche */}
                      <div className="mb-6 bg-bg-dark border border-structure rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-4 bg-gradient-to-r from-bg-panel to-bg-dark border-b border-white/5 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                            <BoltIcon className="w-5 h-5 text-primary" /> Live-Aktions-Feed & Verlauf
                          </h3>
                          {/* Right Side Actions */}
                          <div className="flex items-center gap-2">
                            {order.status !== 'archived' && order.status !== 'canceled' && (
                              <button 
                                onClick={() => router.push(`/dashboard/customers/${customerId}/edit-order/${order.id}`)} 
                                className="px-3 py-1.5 bg-bg-panel border border-structure text-text-main hover:text-primary text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                              >
                                <PencilIcon className="w-3.5 h-3.5 text-primary"/> Bearbeiten
                              </button>
                            )}
                            {/* Permanent Undo Button */}
                            {['quote', 'confirmed', 'completed'].includes(order.status) && !hasActiveInvoice && (
                              <button 
                                onClick={() => {
                                  const map: any = { 'quote': 'draft', 'confirmed': 'quote', 'completed': 'confirmed' };
                                  handleUpdateOrderStatus(order, map[order.status]);
                                }} 
                                className="p-1.5 bg-bg-panel hover:bg-white/10 border border-structure text-text-muted hover:text-white rounded-lg transition-colors"
                                title="Einen Schritt zurück"
                              >
                                <ArrowUturnLeftIcon className="w-4 h-4" />
                              </button>
                            )}
                            <button 
                              onClick={() => setActiveDropdown(activeDropdown === order.id ? null : order.id)}
                              className="p-1.5 bg-bg-panel hover:bg-white/10 border border-structure rounded-lg text-text-main transition-colors"
                            >
                              <EllipsisHorizontalIcon className="w-4 h-4" />
                            </button>
                            {activeDropdown === order.id && (
                              <div className="absolute right-6 mt-10 w-56 bg-bg-panel border border-structure rounded-xl shadow-2xl py-1 z-50">
                                {['confirmed', 'completed'].includes(order.status) && (
                                  <button onClick={() => { setActiveDropdown(null); setInlinePdfOrder(inlinePdfOrder?.id === order.id ? null : order); setInlinePdfType('protocol'); }} className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-structure flex items-center gap-2"><DocumentArrowDownIcon className="w-4 h-4"/> Leeres Protokoll drucken</button>
                                )}
                                <button onClick={() => { setActiveDropdown(null); setInlinePdfOrder(inlinePdfOrder?.id === order.id ? null : order); setInlinePdfType(isInvoice ? 'invoice' : 'order'); }} className="w-full text-left px-4 py-2 text-sm text-text-main hover:bg-structure flex items-center gap-2"><DocumentArrowDownIcon className="w-4 h-4"/> PDF / Drucken</button>
                                {['draft', 'quote', 'clarification', 'rejected'].includes(order.status) && (
                                  <button onClick={() => { setActiveDropdown(null); deleteOrder(order.id); }} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"><TrashIcon className="w-4 h-4"/> Löschen</button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="p-5">
                          {/* Pending Actions (Akuter Handlungsbedarf) */}
                          <div className="mb-6">
                            <h4 className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Akuter Handlungsbedarf
                            </h4>
                            <div className="space-y-2">
                              {/* 1. Missing Data (Checklist Items) */}
                              {checklist && checklist.length > 0 && checklist.map((item, idx) => (
                                <div key={`chk-${idx}`} className={`bg-${item.status === 'info' ? 'blue' : 'red'}-500/10 border border-${item.status === 'info' ? 'blue' : 'red'}-500/20 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3`}>
                                  <div>
                                    <div className={`text-[10px] text-${item.status === 'info' ? 'blue' : 'red'}-400/70 font-bold uppercase mb-0.5`}>Phase {item.phase} • Fehlende Information</div>
                                    <div className={`text-sm text-${item.status === 'info' ? 'blue' : 'red'}-400 font-bold`}>{item.title}</div>
                                    <div className="text-xs text-text-muted">{item.desc}</div>
                                  </div>
                                  {item.action && (
                                    <button onClick={item.action} className={`px-3 py-1.5 bg-${item.status === 'info' ? 'blue' : 'red'}-500 hover:bg-${item.status === 'info' ? 'blue' : 'red'}-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors`}>
                                      {item.title.includes('Protokoll') ? 'Protokoll öffnen' : item.title.includes('Bestätigung') ? 'Jetzt senden' : 'Daten eintragen'}
                                    </button>
                                  )}
                                </div>
                              ))}

                              {/* 2. Next Status Steps */}
                              {(order.status === 'draft' || order.status === 'clarification' || order.status === 'rejected') && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3">
                                  <div>
                                    <div className="text-[10px] text-blue-400/70 font-bold uppercase mb-0.5">Phase 2 • Angebot erstellen</div>
                                    <div className="text-sm text-blue-400 font-bold">Angebot ist im Entwurf</div>
                                    <div className="text-xs text-text-muted">Bitte sende dem Kunden das finale Angebot.</div>
                                  </div>
                                  <button onClick={() => handleUpdateOrderStatus(order, 'quote')} className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">Angebot vorlegen</button>
                                </div>
                              )}

                              {order.status === 'quote' && (
                                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3">
                                  <div>
                                    <div className="text-[10px] text-orange-400/70 font-bold uppercase mb-0.5">Phase 3 • Warten auf Zusage</div>
                                    <div className="text-sm text-orange-400 font-bold">Warten auf Kundenbestätigung</div>
                                    <div className="text-xs text-text-muted">Der Kunde hat das Angebot vorliegen.</div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button onClick={() => handleUpdateOrderStatus(order, 'rejected')} className="px-3 py-1.5 bg-white/5 hover:bg-red-500/10 text-text-muted hover:text-red-400 text-xs font-bold rounded-lg transition-colors">Kunde hat abgesagt</button>
                                    <button onClick={() => handleConfirmOrder(order)} className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"><CheckIcon className="w-4 h-4"/> Auftrag bestätigen</button>
                                  </div>
                                </div>
                              )}

                              {/* 3. Signatures */}
                              {!isInvoice && (order.status === 'quote' || order.status === 'confirmed') && !order.signatureOrder && !order.externallyConfirmed && (
                                <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3">
                                  <div>
                                    <div className="text-[10px] text-teal-400/70 font-bold uppercase mb-0.5">Unterschrift erforderlich</div>
                                    <div className="text-sm text-teal-400 font-bold">Digitale Signatur / Externe Zusage fehlt</div>
                                  </div>
                                  <button onClick={() => setSignatureOrder(order)} className="px-3 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">✍️ Jetzt unterschreiben lassen</button>
                                </div>
                              )}

                              {/* 4. Complete Move */}
                              {order.status === 'confirmed' && (
                                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3">
                                  <div>
                                    <div className="text-[10px] text-purple-400/70 font-bold uppercase mb-0.5">Phase 4 • Umzug</div>
                                    <div className="text-sm text-purple-400 font-bold">Umzug durchführen</div>
                                    <div className="text-xs text-text-muted">Markiere den Auftrag als erledigt, wenn der Umzug abgeschlossen ist.</div>
                                  </div>
                                  <button onClick={() => handleUpdateOrderStatus(order, 'completed')} className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">Umzug durchgeführt (Erledigt)</button>
                                </div>
                              )}

                              {/* 5. Invoicing */}
                              {(order.status === 'completed' && !isInvoice && !order.invoiceNumber) && (
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3">
                                  <div>
                                    <div className="text-[10px] text-blue-400/70 font-bold uppercase mb-0.5">Phase 5 • Rechnung</div>
                                    <div className="text-sm text-blue-400 font-bold">Es fehlt noch die Rechnung</div>
                                  </div>
                                  <button onClick={async () => {
                                    try {
                                      await changeOrderStatus(order.id, 'invoice_open', { userId: profile?.uid });
                                      toast.success('Rechnung generiert!');
                                    } catch (err: any) {
                                      toast.error(err.message || 'Fehler beim Generieren der Rechnung');
                                    }
                                  }} className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors">🧾 Rechnung generieren</button>
                                </div>
                              )}

                              {/* 6. System Tickets (Pending) */}
                              {generateTickets(order, customer).filter(t => !t.done).map(todo => {
                                const isKarton = todo.id === 'kartons_liefern';
                                const isHV = todo.id === 'halteverbot_bestellen' || todo.id === 'halteverbot_b_bestellen';
                                const isLift = todo.id === 'moebellift_bestellen' || todo.id === 'moebellift_b_bestellen';
                                return (
                                  <div key={todo.id} className="bg-bg-panel border border-white/5 rounded-xl p-3 flex flex-wrap justify-between items-center gap-3 hover:bg-white/5 transition-colors">
                                    <div className="flex items-start gap-3">
                                      <input 
                                        type="checkbox" 
                                        checked={todo.done} 
                                        disabled={todo.systemEvaluated && todo.done}
                                        onChange={async () => {
                                          if (todo.systemEvaluated) return;
                                          const updatedStates = order.ticketStates || {};
                                          updatedStates[todo.id] = !todo.done;
                                          await updateDoc(doc(db, getCol('orders'), order.id), { ticketStates: updatedStates });
                                          toast.success(todo.done ? "Aufgabe wieder geöffnet" : "Aufgabe abgeschlossen!");
                                        }}
                                        className="mt-1 w-4 h-4 rounded border-structure text-primary bg-bg-dark focus:ring-primary focus:ring-offset-bg-panel cursor-pointer"
                                      />
                                      <div>
                                        <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-0.5">Phase {todo.phase} • Logistik & Orga</div>
                                        <div className="text-sm font-bold text-text-main flex items-center gap-2">
                                          {todo.title}
                                          {todo.dueDateStatus === 'overdue' && (
                                            <span className="bg-red-500/20 text-red-500 text-[10px] px-2 py-0.5 rounded border border-red-500/20 shadow-sm uppercase tracking-wider">ÜBERFÄLLIG</span>
                                          )}
                                        </div>
                                        {/* Date Input inside Feed */}
                                        {(isKarton || isHV || isLift) && (
                                          <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-lg border border-white/5 w-fit">
                                              <span className="text-[10px] text-text-muted uppercase">Datum:</span>
                                              <input 
                                                type="date"
                                                value={
                                                  isKarton ? (order.orderMeta?.kartonDeliveryDate || '') :
                                                  isHV ? (order.orderMeta?.halteverbotDate || '') :
                                                  (order.orderMeta?.moebelliftDate || '')
                                                }
                                                onChange={async (e) => {
                                                  const val = e.target.value;
                                                  const field = isKarton ? 'kartonDeliveryDate' : isHV ? 'halteverbotDate' : 'moebelliftDate';
                                                  await updateDoc(doc(db, getCol('orders'), order.id), { [`orderMeta.${field}`]: val });
                                                }}
                                                className="bg-transparent text-xs text-text-main focus:outline-none"
                                              />
                                            </div>
                                            <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-lg border border-white/5 w-fit">
                                              <span className="text-[10px] text-text-muted uppercase">Zeitfenster:</span>
                                              <input 
                                                type="text"
                                                placeholder="z.B. 10-14 Uhr"
                                                value={
                                                  isKarton ? (order.orderMeta?.kartonDeliveryTime || '') :
                                                  isHV ? (order.orderMeta?.halteverbotTime || '') :
                                                  (order.orderMeta?.moebelliftTime || '')
                                                }
                                                onChange={async (e) => {
                                                  const val = e.target.value;
                                                  const field = isKarton ? 'kartonDeliveryTime' : isHV ? 'halteverbotTime' : 'moebelliftTime';
                                                  await updateDoc(doc(db, getCol('orders'), order.id), { [`orderMeta.${field}`]: val });
                                                }}
                                                className="bg-transparent text-xs text-text-main focus:outline-none w-28"
                                              />
                                            </div>
                                          </div>
                                        )}
                                        {/* Viewing Requested Special Button */}
                                        {todo.id === 'viewing_requested' && (
                                          <div className="mt-3">
                                            <button 
                                              onClick={async () => {
                                                await updateDoc(doc(db, getCol('orders'), order.id), { 'orderMeta.viewingCanceled': true });
                                                toast.success("Als 'Durch Fotos ersetzt' markiert");
                                              }} 
                                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-text-muted hover:text-white text-[10px] font-bold rounded-lg transition-colors border border-white/5"
                                            >
                                              Durch Fotos/Liste ersetzt
                                            </button>
                                          </div>
                                        )}

                                        {/* Confirmation Sent Button */}
                                        {todo.id === 'confirmation_sent' && (
                                          <div className="mt-3 flex gap-2">
                                            <button 
                                              onClick={() => setMessageOrder(order)} 
                                              className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-[10px] font-bold rounded-lg transition-colors border border-blue-500/20 flex items-center gap-1"
                                            >
                                              <EnvelopeIcon className="w-3.5 h-3.5"/> Nachricht senden
                                            </button>
                                          </div>
                                        )}

                                        {/* Abnahmeprotokoll Button */}
                                        {todo.id === 'abnahmeprotokoll' && (
                                          <div className="mt-3">
                                            <button 
                                              onClick={() => setProtocolOrder(order)} 
                                              className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[10px] font-bold rounded-lg transition-colors border border-emerald-500/20 flex items-center gap-1"
                                            >
                                              <DocumentTextIcon className="w-3.5 h-3.5"/> Protokoll öffnen
                                            </button>
                                          </div>
                                        )}

                                        {/* Employee Sheet Special Button */}
                                        {todo.id === 'employee_sheet' && (
                                          <div className="mt-3">
                                            <button 
                                              onClick={() => {
                                                setInlinePdfOrder(order); setInlinePdfType('employee');
                                                setTimeout(() => {
                                                  document.getElementById(`pdf-viewer-${order.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                }, 100);
                                              }} 
                                              className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-bold rounded-lg transition-colors border border-primary/20 flex items-center gap-1"
                                            >
                                              <DocumentTextIcon className="w-3.5 h-3.5"/> Laufzettel generieren
                                            </button>
                                          </div>
                                        )}

                                        {/* Default Action Link */}
                                        {todo.actionLink && todo.id !== 'viewing_requested' && (
                                          <div className="mt-3">
                                            <Link href={todo.actionLink} className="inline-flex items-center justify-center px-4 py-1.5 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 hover:border-primary text-[10px] uppercase tracking-wider font-bold rounded-lg transition-all shadow-sm">
                                              Jetzt erledigen
                                            </Link>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Empty State Handlungsbedarf */}
                              {(checklist?.length === 0 && generateTickets(order, customer).filter(t => !t.done).length === 0 && order.status === 'completed' && hasActiveInvoice) && (
                                <div className="flex items-center gap-2 text-sm text-emerald-400 font-bold bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
                                  <CheckBadgeIcon className="w-5 h-5" /> Alles erledigt! Aktuell kein Handlungsbedarf.
                                </div>
                              )}
                            </div>
                          </div>

                          {/* History (Verlauf & Erledigtes) */}
                          <div>
                            <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                              <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> Verlauf & Erledigte Tickets
                            </h4>
                            <div className="space-y-1 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px before:h-full before:w-0.5 before:bg-white/10">
                              
                              {/* Order Creation */}
                              <div className="relative pl-8 py-1">
                                <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-bg-dark border-2 border-emerald-500 flex items-center justify-center shrink-0">
                                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                </div>
                                <div className="text-[10px] text-text-muted">{new Date(order.createdAt?.toMillis?.() || Date.now()).toLocaleDateString('de-DE')}</div>
                                <div className="text-sm text-text-main font-bold">Angebot / Entwurf angelegt</div>
                              </div>

                              {/* Signature History */}
                              {!isInvoice && order.signatureOrder && (
                                <div className="relative pl-8 py-1">
                                  <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-bg-dark border-2 border-emerald-500 flex items-center justify-center shrink-0">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                  </div>
                                  <div className="text-[10px] text-text-muted">{order.signatureOrderDate ? new Date(order.signatureOrderDate.toMillis?.() || Date.now()).toLocaleDateString('de-DE') : order.signatureOrderDateString}</div>
                                  <div className="text-sm text-emerald-400 font-bold flex items-center gap-1"><CheckBadgeIcon className="w-4 h-4"/> Auftrag unterschrieben</div>
                                </div>
                              )}

                              {/* Completed Tickets */}
                              {generateTickets(order, customer).filter(t => t.done).map(todo => (
                                <div key={`hist-${todo.id}`} className="relative pl-8 py-1 group">
                                  <div className="absolute left-0 top-2 w-6 h-6 rounded-full bg-bg-dark border-2 border-emerald-500/50 flex items-center justify-center shrink-0 group-hover:border-emerald-500 transition-colors">
                                    <CheckIcon className="w-3 h-3 text-emerald-500/50 group-hover:text-emerald-500" />
                                  </div>
                                  <div className="text-[10px] text-text-muted">Erledigt</div>
                                  <div className="text-sm text-text-muted flex items-center justify-between">
                                    <span><span className="line-through">{todo.title}</span></span>
                                    <button 
                                      onClick={async () => {
                                        const updatedStates = order.ticketStates || {};
                                        updatedStates[todo.id] = false;
                                        await updateDoc(doc(db, getCol('orders'), order.id), { ticketStates: updatedStates });
                                      }}
                                      className="text-[10px] text-primary hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      Wieder öffnen
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                    {/* Info Cards inside Expanded View */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Logistics Summary */}
                        {order.logistics && (
                          <div className="bg-bg-dark border border-structure p-4 rounded-xl shadow-inner">
                            <h4 className="text-xs uppercase tracking-widest text-text-muted font-bold mb-3 flex items-center justify-between">
                              <span className="flex items-center gap-2"><TruckIcon className="w-4 h-4 text-primary"/> Route</span>
                              <button onClick={() => handleCalculateRoute(order.id, order.logistics)} disabled={isCalculatingRoute[order.id]} className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors">
                                {isCalculatingRoute[order.id] ? 'Berechne...' : 'Route berechnen'}
                              </button>
                            </h4>
                            <div className="text-sm font-medium text-text-main space-y-1">
                              <div className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0"></div> {order.logistics.a_city || 'Ausstehend'}</div>
                              <div className="w-0.5 h-3 bg-structure ml-1"></div>
                              <div className="flex items-start gap-2"><div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0"></div> {order.logistics.b_city || 'Ausstehend'}</div>
                            </div>
                            
                            {/* Route Results */}
                            {(routeInfo[order.id] || routeError[order.id]) && (
                              <div className="mt-4 pt-4 border-t border-structure space-y-3">
                                {routeError[order.id] ? (
                                  <div className="text-xs text-red-500">{routeError[order.id]}</div>
                                ) : routeInfo[order.id] ? (
                                  <>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-text-muted">A ➔ B (Direkt):</span>
                                      <span className="font-bold">{routeInfo[order.id].direct.distanceKm} km <span className="font-normal text-text-muted ml-1">({Math.floor(routeInfo[order.id].direct.durationMinutes/60)}h {routeInfo[order.id].direct.durationMinutes%60}m)</span></span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-text-muted">Gesamt (ab Bochum):</span>
                                      <span className="font-bold text-primary">{routeInfo[order.id].total.distanceKm} km <span className="font-normal text-text-muted ml-1">({Math.floor(routeInfo[order.id].total.durationMinutes/60)}h {routeInfo[order.id].total.durationMinutes%60}m)</span></span>
                                    </div>
                                    <a href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${order.logistics.a_street || ''} ${order.logistics.a_houseNr || ''}, ${order.logistics.a_zip || ''} ${order.logistics.a_city || ''}`)}&destination=${encodeURIComponent(`${order.logistics.b_street || ''} ${order.logistics.b_houseNr || ''}, ${order.logistics.b_zip || ''} ${order.logistics.b_city || ''}`)}`} target="_blank" rel="noopener noreferrer" className="mt-2 w-full btn-secondary text-[11px] py-1.5 flex justify-center items-center gap-1.5 hover:text-blue-400">
                                      <MapPinIcon className="w-3.5 h-3.5" /> Auf Google Maps öffnen
                                    </a>
                                  </>
                                ) : null}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Actions Quick Links */}
                        <div className="bg-bg-dark border border-structure p-4 rounded-xl shadow-inner flex flex-col justify-center gap-2">
                           <button onClick={() => { setInlinePdfOrder(inlinePdfOrder?.id === order.id ? null : order); setInlinePdfType(isInvoice ? 'invoice' : 'order'); }} className={`btn-secondary w-full justify-center flex items-center gap-2 text-xs py-2 transition-colors ${inlinePdfOrder?.id === order.id ? 'border-primary text-primary' : ''}`}>
                              <DocumentTextIcon className="w-4 h-4 shrink-0" /> PDF Vorschau
                           </button>
                           <PDFDownloadButton 
                              order={order} 
                              customer={customer} 
                              type={isInvoice ? 'invoice' : 'order'} 
                              className="btn-primary w-full justify-center flex items-center gap-2 text-xs py-2 transition-colors shadow-sm"
                           />
                           <button onClick={() => setMessageOrder(order)} className="btn-secondary w-full justify-center flex items-center gap-2 text-xs py-2 text-blue-400">
                              <EnvelopeIcon className="w-4 h-4 shrink-0" /> Nachricht senden
                           </button>
                           {['confirmed', 'completed'].includes(order.status) && (
                             <button onClick={() => setProtocolOrder(order)} className="btn-secondary w-full justify-center flex items-center gap-2 text-xs py-2 text-orange-500">
                                <PlusIcon className="w-4 h-4 shrink-0" /> Neues Protokoll (Digital)
                             </button>
                           )}
                           {!isInvoice && (
                             <button onClick={async () => {
                               if (order.status !== 'completed' && order.status !== 'invoice_open' && order.status !== 'invoice_paid') {
                                 toast.error(`Der Umzug ist noch nicht abgeschlossen (Status: ${order.status}). Bitte erst abschließen.`);
                                 return;
                               }
                               if (!order.invoiceNumber) {
                                 try {
                                   await changeOrderStatus(order.id, 'invoice_open', { userId: profile?.uid });
                                   toast.success('Rechnung wurde erstellt!');
                                 } catch (err: any) {
                                   toast.error(err.message || 'Fehler');
                                 }
                               } else {
                                 toast('Rechnung wurde bereits erstellt.', { icon: 'ℹ️' });
                               }
                             }} className="btn-secondary w-full justify-center flex items-center gap-2 text-xs py-2 text-green-400 font-bold border border-green-500/30 bg-green-500/10 hover:bg-green-500/20">
                                <PlusIcon className="w-4 h-4 shrink-0" /> {order.invoiceNumber ? 'Rechnung generiert' : 'Rechnung erstellen'}
                             </button>
                           )}
                           {isInvoice && order.status !== 'canceled' && (
                             <button onClick={() => setPaymentOrder(order)} className="btn-secondary w-full justify-center flex items-center gap-2 text-xs py-2 text-green-500">
                                <BanknotesIcon className="w-4 h-4 shrink-0" /> Zahlungen verwalten
                             </button>
                           )}
                           {isInvoice && order.status !== 'canceled' && (
                             <div className="flex gap-2 w-full">
                               <button onClick={() => { if(confirm('Rechnung stornieren und Kopie anlegen?')) handleStorno(order, true); }} className="btn-secondary flex-1 justify-center flex items-center gap-1 text-[10px] py-2 text-red-400">
                                  Storno & Neu
                               </button>
                               <button onClick={() => { if(confirm('Nur stornieren?')) handleStorno(order, false); }} className="btn-secondary flex-1 justify-center flex items-center gap-1 text-[10px] py-2 text-red-400 opacity-80">
                                  Nur Storno
                               </button>
                             </div>
                           )}
                         </div>

                         {/* Signed Protocols Quick View */}
                         {order.protocols && order.protocols.length > 0 && (
                           <div className="bg-bg-panel border border-structure p-4 rounded-xl shadow-inner flex flex-col gap-2 mt-2">
                             <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Signierte Protokolle</h4>
                             {order.protocols.map((proto: any, idx: number) => (
                               <div key={proto.id || idx} className="bg-bg-dark border border-structure p-3 rounded-lg flex flex-col gap-2">
                                 <div className="flex justify-between items-start">
                                   <div className="text-sm font-bold text-text-main flex items-center gap-1.5">
                                     <ClipboardDocumentCheckIcon className="w-4 h-4 text-emerald-500" /> {proto.type}
                                   </div>
                                   <div className="text-[10px] text-text-muted">{new Date(proto.createdAt).toLocaleDateString('de-DE')}</div>
                                 </div>
                                 <p className="text-xs text-text-muted line-clamp-2">{proto.text}</p>
                                 {proto.signature && (
                                   <div className="mt-1 pt-2 border-t border-structure/50 flex flex-col">
                                     <div className="text-[10px] text-text-muted mb-1 uppercase tracking-wider">Kunden-Unterschrift</div>
                                     <div className="bg-white/90 rounded p-1 inline-block">
                                       <img src={proto.signature} alt="Unterschrift" className="h-12 object-contain" />
                                     </div>
                                   </div>
                                 )}
                               </div>
                             ))}
                           </div>
                         )}

                        {/* Nested Invoices Section */}
                        {linkedInvoices.length > 0 && linkedInvoices.map(inv => (
                          <div key={inv.id} className="col-span-1 md:col-span-2 bg-bg-panel border border-structure p-4 rounded-xl shadow-sm mt-2">
                            <div className="flex justify-between items-center mb-4">
                              <h4 className="text-sm font-bold text-primary flex items-center gap-2"><DocumentTextIcon className="w-5 h-5"/> Rechnung {inv.invoiceNumber ? `#${inv.invoiceNumber}` : ''}</h4>
                              <StatusBadge status={inv.status} payments={inv.payments} totals={inv.totals} calcInput={inv.calcInput} />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button onClick={() => {
                                setInlinePdfOrder(inlinePdfOrder?.id === inv.id ? null : inv); setInlinePdfType('invoice');
                                setTimeout(() => {
                                  document.getElementById(`pdf-viewer-${inv.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }, 100);
                              }} className={`btn-secondary flex items-center gap-2 text-xs py-2 px-4 transition-colors ${inlinePdfOrder?.id === inv.id ? 'border-primary text-primary' : ''}`}><DocumentTextIcon className="w-4 h-4 shrink-0" /> PDF ansehen</button>
                              {inv.status !== 'canceled' && (
                                <button onClick={() => setPaymentOrder(inv)} className="btn-secondary flex items-center gap-2 text-xs py-2 px-4 text-green-500"><BanknotesIcon className="w-4 h-4 shrink-0" /> Zahlungen verwalten</button>
                              )}
                              {inv.status !== 'canceled' && (
                                <>
                                  <button onClick={() => { if(confirm('Rechnung stornieren und Kopie anlegen?')) handleStorno(inv, true); }} className="btn-secondary flex items-center gap-1 text-[10px] py-2 px-3 text-red-400">Storno & Neu</button>
                                  <button onClick={() => { if(confirm('Nur stornieren?')) handleStorno(inv, false); }} className="btn-secondary flex items-center gap-1 text-[10px] py-2 px-3 text-red-400 opacity-80">Nur Storno</button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                        {/* Inline PDF Viewer Area */}
                        {(inlinePdfOrder?.id === order.id || linkedInvoices.some(inv => inlinePdfOrder?.id === inv.id)) && (
                          <div id={`pdf-viewer-${inlinePdfOrder?.id}`} className="col-span-1 md:col-span-2 mt-4 bg-bg-dark rounded-xl border border-white/10 overflow-hidden h-[700px] shadow-2xl relative">
                            <div className="absolute top-4 right-4 z-10 flex gap-2">
                              <button onClick={() => setInlinePdfOrder(null)} className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors shadow-lg"><XMarkIcon className="w-5 h-5" /></button>
                            </div>
                            <InlinePDFViewer order={inlinePdfOrder} customer={customer} type={inlinePdfType as any} />
                          </div>
                        )}
                        
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showClaimModal && customer && <ClaimModal customerId={customerId} customerName={`${customer.firstName} ${customer.lastName}`} onClose={() => setShowClaimModal(false)} />}
      {paymentOrder && <PaymentManager order={paymentOrder} onUpdate={() => {}} onClose={() => setPaymentOrder(null)} />}
      {pdfModalOrder && customer && (
        <PdfModal
          onClose={() => setPdfModalOrder(null)}
          order={pdfModalOrder}
          customer={customer}
          type={pdfType}
        />
      )}
      {protocolOrder && <ProtocolModal order={protocolOrder} onClose={() => setProtocolOrder(null)} />}
      {dispoOrder && <DispoModal order={dispoOrder} onClose={() => setDispoOrder(null)} />}
      {messageOrder && <MessageSenderModal order={messageOrder} customer={customer} onClose={() => setMessageOrder(null)} />}
      {signatureOrder && (
        <SignatureModal 
          order={signatureOrder} 
          onClose={() => setSignatureOrder(null)} 
          onSigned={() => {
            // Data is already saved by the modal. Just close it.
            setSignatureOrder(null);
          }} 
        />
      )}
      {deleteConfirmOrder && <ConfirmModal isOpen={true} title="Löschen bestätigen" message="Wirklich löschen?" onConfirm={() => {}} onCancel={() => setDeleteConfirmOrder(null)} />}
    </div>
  );
}
