"use client";
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, collection, query, where, onSnapshot, updateDoc, deleteDoc, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { PlusIcon, UserCircleIcon, PhoneIcon, MapPinIcon, DocumentTextIcon, XMarkIcon, EnvelopeIcon, StarIcon, CheckCircleIcon, PencilIcon, TrashIcon, CheckIcon, TruckIcon, CheckBadgeIcon, ClipboardDocumentIcon, ClipboardDocumentListIcon, DocumentArrowDownIcon, BanknotesIcon, ExclamationTriangleIcon, ArchiveBoxIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import Link from 'next/link';
import { PDFGenerator } from '@/components/pdf/PDFGenerator';
import { generateTickets } from '@/lib/ticketEngine';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { ProtocolModal } from '@/components/customers/ProtocolModal';
import { DispoModal } from '@/components/orders/DispoModal';
import { ClaimModal } from '@/components/customers/ClaimModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PaymentModal } from '@/components/orders/PaymentModal';
import { PdfModal } from '@/components/ui/PdfModal';
import { calculateRoute } from '@/lib/routeCalculator';
import { getCol } from '@/lib/demoMode';
import { LogisticsBoard } from '@/components/orders/LogisticsBoard';
import { MessageSenderModal } from '@/components/customers/MessageSenderModal';
import { useAuth } from '@/context/AuthContext';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';
import { InlinePDFViewer } from '@/components/pdf/InlinePDFViewer';

export default function CustomerProfilePage() {
  const { profile } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [protocolOrder, setProtocolOrder] = useState<any>(null);
  const [dispoOrder, setDispoOrder] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [pdfType, setPdfType] = useState<'order' | 'contract' | 'employee' | 'invoice' | 'protocol'>('order');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<string | null>(null);
  const [revertConfirmOrder, setRevertConfirmOrder] = useState<{order: any, newStatus: string} | null>(null);
  
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [messageOrder, setMessageOrder] = useState<any>(null);
  const [pdfModalOrder, setPdfModalOrder] = useState<any>(null);

  const [routeInfo, setRouteInfo] = useState<{ direct: { distanceKm: number, durationMinutes: number }, total: { distanceKm: number, durationMinutes: number } } | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'finances' | 'claims'>('overview');
  const [activeA4OrderId, setActiveA4OrderId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Fetch Customer
    const docRef = doc(db, getCol('customers'), customerId);
    const unsubCustomer = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setCustomer(data);
        if (!editData) setEditData(data); // Init edit state
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching customer", error);
      setLoading(false);
    });

    // Fetch Orders
    const q = query(collection(db, getCol('orders')), where('customerId', '==', customerId));
    const unsubOrders = onSnapshot(q, (querySnapshot) => {
      const fetchedOrders = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedOrders.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
      setOrders(fetchedOrders);
      
      // Auto-select the first valid order for A4 Editor if none selected
      if (fetchedOrders.length > 0 && !activeA4OrderId) {
        const defaultOrder = fetchedOrders.find(o => o.status !== 'archived') || fetchedOrders[0];
        setActiveA4OrderId(defaultOrder.id);
      }
    }, (error) => {
      console.error("Error fetching orders", error);
    });

    // Fetch Settings for Datalist
    const unsubSettings = onSnapshot(doc(db, getCol('system'), 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    });

    // Fetch Claims
    const qClaims = query(collection(db, getCol('claims')), where('customerId', '==', customerId));
    const unsubClaims = onSnapshot(qClaims, (querySnapshot) => {
      const fetchedClaims = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sortiere neu nach alt (da createdAt ein Timestamp ist)
      fetchedClaims.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
      setClaims(fetchedClaims);
    });

    return () => {
      unsubCustomer();
      unsubOrders();
      unsubSettings();
      unsubClaims();
    };
  }, [customerId]);

  useEffect(() => {
    const orderId = searchParams.get('orderId');
    const typeParam = searchParams.get('pdfType');
    const action = searchParams.get('action');
    
    if (orders.length > 0 && orderId) {
      const targetOrder = orders.find(o => o.id === orderId);
      if (targetOrder) {
        if (typeParam === 'invoice' || typeParam === 'order' || typeParam === 'contract' || typeParam === 'employee' || typeParam === 'protocol') {
          setPdfType(typeParam as any);
        }
        
        if (action === 'view-protocol') {
          if (!protocolOrder) setProtocolOrder(targetOrder);
        } else if (action === 'view-pdf') {
          if (!pdfModalOrder) setPdfModalOrder(targetOrder);
        }

        // Remove the params from URL
        router.replace(`/dashboard/customers/${customerId}`, { scroll: false });
      }
    }
  }, [orders, searchParams, protocolOrder, pdfModalOrder]);

  const handleCalculateRoute = async () => {
    if (orders.length > 0) {
      const activeOrder = orders.find(o => o.status === 'confirmed' || o.status === 'quote') || orders[0];
      if (activeOrder && activeOrder.logistics) {
        const addressA = `${activeOrder.logistics.a_street || ''} ${activeOrder.logistics.a_houseNr || ''}, ${activeOrder.logistics.a_zip || ''} ${activeOrder.logistics.a_city || ''}`.trim();
        const addressB = `${activeOrder.logistics.b_street || ''} ${activeOrder.logistics.b_houseNr || ''}, ${activeOrder.logistics.b_zip || ''} ${activeOrder.logistics.b_city || ''}`.trim();
        const baseAddress = "Bochum, Germany"; // Hauptsitz
        
        if (addressA.length > 5 && addressB.length > 5 && addressA !== addressB) {
          setIsCalculatingRoute(true);
          setRouteError(null);
          try {
            const resDirect = await calculateRoute(addressA, addressB);
            
            // Calculate base -> A, B -> base
            const resBaseToA = await calculateRoute(baseAddress, addressA);
            const resBToBase = await calculateRoute(addressB, baseAddress);

            if (resDirect && resBaseToA && resBToBase) {
              const totalDistance = resBaseToA.distanceKm + resDirect.distanceKm + resBToBase.distanceKm;
              const totalDuration = resBaseToA.durationMinutes + resDirect.durationMinutes + resBToBase.durationMinutes;
              
              setRouteInfo({
                direct: resDirect,
                total: { distanceKm: Math.round(totalDistance * 10) / 10, durationMinutes: totalDuration }
              });
              setRouteError(null);
            } else if (resDirect) {
              setRouteInfo({
                direct: resDirect,
                total: resDirect
              });
              setRouteError(null);
            } else {
              setRouteInfo(null);
              setRouteError("Route konnte nicht automatisch berechnet werden.");
            }
          } catch(err) {
            setRouteInfo(null);
            setRouteError("Fehler bei der Anfrage.");
          } finally {
            setIsCalculatingRoute(false);
          }
        } else {
          setRouteError("Unvollständige Adressen im Auftrag.");
        }
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  if (!customer) {
    return <div className="text-center p-12 text-red-400">Kunde nicht gefunden.</div>;
  }

  const deleteOrder = async (orderId: string) => {
    setDeleteConfirmOrder(orderId);
  };

  const confirmDeleteOrder = async () => {
    if (!deleteConfirmOrder) return;
    try {
      await updateDoc(doc(db, getCol('orders'), deleteConfirmOrder), { status: 'archived', updatedAt: serverTimestamp() });
      toast.success("Dokument wurde ins Archiv verschoben!");
    } catch (e) {
      toast.error("Fehler beim Archivieren.");
    }
    setDeleteConfirmOrder(null);
  };

  const safeRevertStatus = (order: any, newStatus: string) => {
    if (order.status === 'confirmed' || order.status === 'completed') {
      setRevertConfirmOrder({ order, newStatus });
      return;
    }
    handleUpdateOrderStatus(order, newStatus);
  };

  const handleUpdateOrderStatus = async (order: any, newStatus: string) => {
    try {
      const payload: any = { status: newStatus, updatedAt: serverTimestamp() };
      
      // Wenn zurück zu Entwurf oder Angebot gewechselt wird, löschen wir die Vertragsunterschrift
      // da der Vertrag durch die Änderung ungültig wird und neu unterschrieben werden muss.
      if (newStatus === 'draft' || newStatus === 'quote') {
        payload.signatureOrder = null;
        payload.signatureOrderDate = null;
        payload.signatureOrderPlace = null;
        payload.signatureOrderDateString = null;
      }
      
      // Get latest settings to pull correct numbers safely
      const settingsDoc = await getDoc(doc(db, getCol('system'), 'settings'));
      const settingsData = settingsDoc.exists() ? settingsDoc.data() : null;

      // 1. Wenn ein Entwurf zum Angebot wird (Nummer bleibt, da in OrderEditor generiert)
      // Aber wir stellen sicher, dass das Datum gesetzt wird.
      
      // 2. Wenn das Angebot bestätigt wird -> Auftragsnummer (AUF-xxx) ziehen
      if (newStatus === 'confirmed') {
        if (!order.contractNumber && settingsData) {
          const nextOrderNumber = settingsData.nextOrderNumber || 1;
          payload.contractNumber = `AUF-${new Date().getFullYear()}-${nextOrderNumber.toString().padStart(3, '0')}`;
          await updateDoc(doc(db, getCol('system'), 'settings'), { nextOrderNumber: nextOrderNumber + 1 });
        }

        toast.success("Angebot bestätigt! Auftragsnummer zugewiesen.", { duration: 4000 });
      }

      // 3. Wenn eine Rechnung generiert wird -> Rechnungsnummer (RE-xxx) ziehen
      if ((newStatus === 'invoice_open' || newStatus === 'invoice_paid') && !order.invoiceNumber && settingsData) {
        const nextInvoiceNumber = settingsData.nextInvoiceNumber || 1;
        payload.invoiceNumber = `RE-${new Date().getFullYear()}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
        payload.invoiceDate = new Date().toISOString();
        await updateDoc(doc(db, getCol('system'), 'settings'), { nextInvoiceNumber: nextInvoiceNumber + 1 });
        toast.success(`Rechnung ${payload.invoiceNumber} generiert!`);
      }
      
      await updateDoc(doc(db, getCol('orders'), order.id), payload);
    } catch (error) {
      console.error("Fehler beim Update des Status", error);
      toast.error("Ein Fehler ist aufgetreten.");
    }
  };

  const handleDeleteSignature = async (orderId: string, key: string) => {
    if (!confirm('Möchten Sie diese Unterschrift wirklich löschen?')) return;
    try {
      if (!orderId) return;
      await updateDoc(doc(db, getCol('orders'), orderId), {
        [key]: null,
        [`${key}Date`]: null,
        [`${key}Place`]: null,
        [`${key}DateString`]: null
      });
      // Update local state without selectedOrder
      setOrders(prevOrders => prevOrders.map(o => 
        o.id === orderId ? {
          ...o,
          [key]: null,
          [`${key}Date`]: null,
          [`${key}Place`]: null,
          [`${key}DateString`]: null
        } : o
      ));
      toast.success('Unterschrift erfolgreich gelöscht!');
    } catch (error) {
      console.error('Fehler beim Löschen der Unterschrift:', error);
      toast.error('Fehler beim Löschen.');
    }
  };

  const handleStorno = async (order: any, createCorrection: boolean = true) => {
    try {
      // 1. Original auf Storniert setzen
      await updateDoc(doc(db, getCol('orders'), order.id), { status: 'invoice_cancelled', updatedAt: serverTimestamp() });
      
      // Get next invoice number
      const settingsSnap = await getDoc(doc(db, getCol('system'), 'settings'));
      const nextInvoiceNum = settingsSnap.data()?.nextInvoiceNumber || 1000;
      const stornoInvoiceNumber = `RE-${new Date().getFullYear()}-${nextInvoiceNum}`;
      await updateDoc(doc(db, getCol('system'), 'settings'), { nextInvoiceNumber: nextInvoiceNum + 1 });
      
      // 2. Storno-Beleg erstellen (Minus-Beträge)
      const stornoTotals = {
        net: -(order.totals?.net || 0),
        tax: -(order.totals?.tax || 0),
        gross: -(order.totals?.gross || 0)
      };
      
      const { id, customerSignature, ...orderDataWithoutId } = order;
      
      await addDoc(collection(db, getCol('orders')), {
        ...orderDataWithoutId,
        status: 'invoice_cancelled', // Keep it cancelled so it doesn't show in finances
        isStorno: true,
        stornoFor: order.invoiceNumber,
        invoiceNumber: stornoInvoiceNumber,
        totals: stornoTotals,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3. Neuen Entwurf als Korrekturrechnung erstellen (nur wenn gewünscht)
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

      toast.success(createCorrection ? "Erfolgreich storniert! Storno-Beleg & neuer Entwurf erstellt." : "Erfolgreich storniert! Storno-Beleg wurde erstellt.");
    } catch (error) {
      console.error("Storno Error:", error);
      toast.error("Fehler beim Stornieren.");
    }
  };

  const totalRevenue = orders.filter(o => ['quote', 'confirmed', 'completed', 'invoice_open', 'invoice_paid'].includes(o.status)).reduce((sum, o) => sum + (o.totals?.gross ?? o.calcInput?.gross ?? 0), 0);
  const openItems = orders.filter(o => ['invoice_open', 'invoice_overdue', 'confirmed', 'completed'].includes(o.status)).reduce((sum, o) => {
    const gross = o.totals?.gross ?? o.calcInput?.gross ?? 0;
    const paid = o.payments?.reduce((pSum: number, p: any) => pSum + p.amount, 0) || 0;
    return sum + Math.max(0, gross - paid);
  }, 0);

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
      console.error("Fehler beim Speichern der Kundendaten", error);
      toast.error("Fehler beim Speichern");
    }
  };

  const handleArchiveCustomer = async () => {
    // Check for open invoices
    const hasOpenInvoices = orders.some(o => o.status === 'invoice_open' || o.status === 'invoice_overdue');
    if (hasOpenInvoices) {
      toast.error("Kunde kann nicht archiviert werden, da noch unbezahlte Rechnungen offen sind!");
      return;
    }

    if (!confirm("Möchten Sie diesen Kunden und alle seine Angebote ins Archiv verschieben?")) return;

    try {
      // Archive customer
      await updateDoc(doc(db, getCol('customers'), customerId), { isArchived: true, updatedAt: serverTimestamp() });
      
      // Archive all orders sequentially
      for (const order of orders) {
        if (order.status !== 'invoice_paid' && order.status !== 'invoice_cancelled') {
          await updateDoc(doc(db, getCol('orders'), order.id), { status: 'archived', updatedAt: serverTimestamp() });
        }
      }
      
      toast.success("Kunde erfolgreich archiviert!");
      router.push('/dashboard/customers');
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Archivieren des Kunden.");
    }
  };
  const globalActiveOrder = activeA4OrderId ? orders.find(o => o.id === activeA4OrderId) : (orders.find(o => o.status !== 'archived') || orders[0]);
  const isGlobalQuote = globalActiveOrder?.status === 'quote';
  const isGlobalConfirmed = globalActiveOrder?.status === 'confirmed' || globalActiveOrder?.status === 'completed';

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20 relative max-w-7xl mx-auto">
      
      {/* Background Graphic */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-[-1] overflow-hidden">
        <img src="/login-logo.png" alt="" className="w-full max-w-[800px] object-contain blur-[2px]" />
      </div>

      {/* 360-Degree Header Card */}
      <div className="glass-panel relative overflow-hidden shadow-2xl p-0">
        <div className="absolute right-0 top-0 opacity-[0.02] pointer-events-none">
          <UserCircleIcon className="w-96 h-96 -mt-12 -mr-12" />
        </div>

        <div className="p-6 md:p-8 flex flex-col md:flex-row items-start gap-8 relative z-10 border-b border-white/5">
          <div className="shrink-0">
            <Image src="/5.png" alt="Customer Profile" width={100} height={100} className="rounded-full border-2 border-structure object-cover bg-bg-dark shadow-lg" />
          </div>
          <div className="flex-1 w-full">
            
            {isEditing ? (
              <div className="space-y-4 bg-bg-dark/50 p-4 rounded-xl border border-structure w-full">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-text-main text-sm"><input type="radio" checked={editData.type === 'privat'} onChange={() => setEditData({...editData, type:'privat'})} className="accent-primary" /> Privatperson</label>
                  <label className="flex items-center gap-2 text-text-main text-sm"><input type="radio" checked={editData.type === 'firma'} onChange={() => setEditData({...editData, type:'firma'})} className="accent-primary" /> Firma</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {editData.type === 'privat' ? (
                    <>
                      <div>
                        <label className="text-xs text-text-muted">Anrede</label>
                        <select value={editData.salutation || ''} onChange={e => setEditData({...editData, salutation: e.target.value})} className="input-field w-full">
                          <option value="">Keine</option>
                          <option value="Herr">Herr</option>
                          <option value="Frau">Frau</option>
                        </select>
                      </div>
                      <div><label className="text-xs text-text-muted">Vorname</label><input type="text" value={editData.firstName} onChange={e => setEditData({...editData, firstName: e.target.value})} className="input-field w-full" /></div>
                      <div><label className="text-xs text-text-muted">Nachname</label><input type="text" value={editData.lastName} onChange={e => setEditData({...editData, lastName: e.target.value})} className="input-field w-full" /></div>
                    </>
                  ) : (
                    <>
                      <div><label className="text-xs text-text-muted">Firmenname</label><input type="text" value={editData.lastName} onChange={e => setEditData({...editData, lastName: e.target.value})} className="input-field w-full" /></div>
                      <div><label className="text-xs text-text-muted">Ansprechpartner (Vor- & Nachname)</label><input type="text" value={editData.firstName} onChange={e => setEditData({...editData, firstName: e.target.value})} className="input-field w-full" /></div>
                    </>
                  )}
                  <div><label className="text-xs text-text-muted">Telefon</label><input type="text" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} className="input-field w-full" /></div>
                  <div><label className="text-xs text-text-muted">E-Mail</label><input type="text" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} className="input-field w-full" /></div>
                  
                  <div className="col-span-1 md:col-span-2">
                    <label className="text-xs text-text-muted">Kundenquelle</label>
                    <input type="text" list="source-options" value={editData.source || ''} onChange={e => setEditData({...editData, source: e.target.value})} className="input-field w-full" placeholder="Auswählen oder tippen..." />
                    <datalist id="source-options">
                      {settings?.customerSources?.map((s: string) => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  
                  <div className="col-span-1 md:col-span-2 mt-2 border-t border-structure pt-2">
                    <label className="text-xs font-semibold text-text-muted mb-2 block">Hauptadresse</label>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-3"><input type="text" placeholder="Straße" value={editData.street || ''} onChange={e => setEditData({...editData, street: e.target.value})} className="input-field w-full" /></div>
                      <div className="col-span-1"><input type="text" placeholder="Haus-Nr." value={editData.houseNr || ''} onChange={e => setEditData({...editData, houseNr: e.target.value})} className="input-field w-full" /></div>
                      
                      <div className="col-span-1"><input type="text" placeholder="PLZ" value={editData.zip || ''} onChange={async (e) => {
                        const val = e.target.value;
                        setEditData((prev: any) => ({...prev, zip: val}));
                        if (val.length === 5) {
                          try {
                            const res = await fetch(`https://api.zippopotam.us/de/${val}`);
                            if (res.ok) {
                              const data = await res.json();
                              if (data.places && data.places.length > 0) {
                                setEditData((prev: any) => ({...prev, zip: val, city: data.places[0]['place name']}));
                              }
                            }
                          } catch(err) {}
                        }
                      }} className="input-field w-full" /></div>
                      <div className="col-span-3"><input type="text" placeholder="Ort" value={editData.city || ''} onChange={e => setEditData({...editData, city: e.target.value})} className="input-field w-full" /></div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 justify-end mt-2">
                  <button onClick={() => { setIsEditing(false); setEditData(customer); }} className="btn-secondary py-1 text-sm">Abbrechen</button>
                  <button onClick={handleSaveCustomer} className="btn-primary py-1 text-sm">Speichern</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h1 className="text-3xl font-bold text-text-main tracking-tight">
                    {customer.type === 'firma' ? customer.lastName : `${customer.salutation ? customer.salutation + ' ' : ''}${customer.firstName} ${customer.lastName}`.trim()}
                  </h1>
                  {customer.source && (
                    <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-semibold border border-primary/30 flex items-center gap-1 shadow-sm">
                      <UserCircleIcon className="w-4 h-4" /> {customer.source}
                    </span>
                  )}
                  <button onClick={() => setIsEditing(true)} className="p-1.5 bg-structure hover:bg-primary/20 text-text-muted hover:text-primary rounded-md transition-colors" title="Kunde bearbeiten">
                    <PencilIcon className="w-5 h-5" />
                  </button>
                  <button onClick={handleArchiveCustomer} className="p-1.5 bg-structure hover:bg-red-500/20 text-text-muted hover:text-red-400 rounded-md transition-colors ml-1" title="Kunde archivieren">
                    <ArchiveBoxIcon className="w-5 h-5" />
                  </button>
                </div>
                {customer.type === 'firma' && customer.firstName && (
                  <p className="text-text-muted mb-4 font-medium flex items-center gap-2">
                    <UserCircleIcon className="w-5 h-5 text-primary" /> Ansprechpartner: {customer.firstName}
                  </p>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <PhoneIcon className="w-5 h-5 text-primary" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <EnvelopeIcon className="w-5 h-5 text-primary" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {(customer.street || customer.zip) && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <MapPinIcon className="w-5 h-5 text-primary shrink-0" />
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${customer.street} ${customer.houseNr || ''}, ${customer.zip || ''} ${customer.city || ''}`)}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors hover:underline">
                        {customer.street} {customer.houseNr}, {customer.zip} {customer.city}
                      </a>
                    </div>
                  )}
                  {(!customer.street && customer.address) && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <MapPinIcon className="w-5 h-5 text-primary shrink-0" />
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(customer.address)}`} target="_blank" rel="noreferrer" className="hover:text-primary transition-colors hover:underline">
                        {customer.address}
                      </a>
                    </div>
                  )}

                  {orders.length > 0 && (() => {
                    const activeOrder = orders.find(o => o.status === 'confirmed' || o.status === 'quote') || orders[0];
                    const hasLogistics = activeOrder && activeOrder.logistics;
                    if (!hasLogistics) return null;
                    
                    const addressA = `${activeOrder.logistics.a_street || ''} ${activeOrder.logistics.a_houseNr || ''}, ${activeOrder.logistics.a_zip || ''} ${activeOrder.logistics.a_city || ''}`.trim();
                    const addressB = `${activeOrder.logistics.b_street || ''} ${activeOrder.logistics.b_houseNr || ''}, ${activeOrder.logistics.b_zip || ''} ${activeOrder.logistics.b_city || ''}`.trim();
                    
                    return (
                      <div className="col-span-1 md:col-span-2 mt-2 flex flex-wrap gap-2">
                        <button 
                          onClick={handleCalculateRoute} 
                          disabled={isCalculatingRoute}
                          className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-2 border-primary/50 text-primary hover:bg-primary/10 shadow-lg"
                        >
                          <TruckIcon className="w-4 h-4" /> {isCalculatingRoute ? "Berechne..." : "Route direkt berechnen"}
                        </button>
                        <a 
                          href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(addressA)}&destination=${encodeURIComponent(addressB)}`}
                          target="_blank" 
                          rel="noreferrer" 
                          className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-2 border-primary/50 text-primary hover:bg-primary/10 shadow-lg"
                          title="Google Maps Routenplanung öffnen"
                        >
                          <MapPinIcon className="w-4 h-4" /> Auf Maps prüfen
                        </a>
                      </div>
                    );
                  })()}

                  {(routeInfo || routeError) && (
                    <div className={`col-span-1 md:col-span-2 border rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between text-sm animate-in fade-in duration-300 gap-4 ${routeError ? 'bg-red-500/10 border-red-500/30' : 'bg-primary/5 border-primary/20 shadow-inner'}`}>
                      {routeError ? (
                        <div className="flex items-center gap-3 w-full">
                          <TruckIcon className="w-6 h-6 text-red-400" />
                          <span className="text-red-400 font-medium">{routeError}</span>
                        </div>
                      ) : routeInfo ? (
                        <>
                          <div className="flex items-start gap-3 flex-1">
                            <TruckIcon className="w-6 h-6 text-text-muted shrink-0" />
                            <div>
                              <div className="text-xs text-text-muted font-bold uppercase tracking-wider mb-0.5">Strecke A ➔ B</div>
                              <div className="text-text-main font-bold">{routeInfo.direct.distanceKm} km</div>
                              <div className="text-xs text-text-muted">ca. {Math.floor(routeInfo.direct.durationMinutes/60)}h {routeInfo.direct.durationMinutes%60}min</div>
                            </div>
                          </div>
                          <div className="hidden md:block w-px h-10 bg-structure"></div>
                          <div className="flex items-start gap-3 flex-1">
                            <TruckIcon className="w-6 h-6 text-primary shrink-0" />
                            <div>
                              <div className="text-xs text-primary font-bold uppercase tracking-wider mb-0.5">Gesamt ab Betriebshof</div>
                              <div className="text-primary font-bold">{routeInfo.total.distanceKm} km <span className="text-xs font-normal text-text-muted ml-1">(Bochum ➔ A ➔ B ➔ Bochum)</span></div>
                              <div className="text-xs text-text-muted">ca. {Math.floor(routeInfo.total.durationMinutes/60)}h {routeInfo.total.durationMinutes%60}min</div>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          
          <div className="shrink-0 mt-4 md:mt-0 flex flex-col gap-3 min-w-[200px]">
            <button 
              onClick={() => router.push(`/dashboard/customers/${customerId}/new-order`)}
              className="btn-primary shadow-lg shadow-primary/20 w-full justify-center"
            >
              <PlusIcon className="w-5 h-5" /> Neues Angebot
            </button>
            <button 
              onClick={() => router.push(`/dashboard/customers/${customerId}/new-order?type=invoice`)}
              className="btn-secondary border-primary/50 text-primary hover:bg-primary/10 w-full justify-center mb-2"
            >
              <DocumentTextIcon className="w-5 h-5" /> Neue Rechnung
            </button>
            
            {globalActiveOrder && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setProtocolOrder(globalActiveOrder)}
                  className="flex-1 py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 bg-bg-panel border border-structure text-text-main rounded-lg hover:bg-white/5 transition-colors"
                >
                  <ClipboardDocumentIcon className="w-4 h-4 text-orange-400" /> Protokoll
                </button>
                <button 
                  onClick={() => setMessageOrder(globalActiveOrder)}
                  className="flex-1 py-2 px-2 text-xs font-bold flex items-center justify-center gap-1.5 bg-bg-panel border border-structure text-text-main rounded-lg hover:bg-white/5 transition-colors"
                >
                  <EnvelopeIcon className="w-4 h-4 text-blue-400" /> Nachricht
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status Pipeline */}
        {globalActiveOrder && (
          <div className="bg-bg-dark/80 border-b border-white/5 px-6 py-3 flex items-center justify-between gap-4 overflow-x-auto custom-scrollbar">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-muted uppercase tracking-wider mr-2">Status ({globalActiveOrder.invoiceNumber ? `#${globalActiveOrder.invoiceNumber}` : globalActiveOrder.orderNumber ? `#${globalActiveOrder.orderNumber}` : ''}):</span>
              {(globalActiveOrder.status === 'draft' || globalActiveOrder.status === 'clarification' || globalActiveOrder.status === 'rejected') && (
                <>
                  <button onClick={() => handleUpdateOrderStatus(globalActiveOrder, 'quote')} className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm">
                    Zu Angebot
                  </button>
                  {globalActiveOrder.status !== 'rejected' && (
                    <button onClick={() => handleUpdateOrderStatus(globalActiveOrder, 'rejected')} className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      Abgelehnt
                    </button>
                  )}
                </>
              )}
              {isGlobalQuote && (
                <>
                  <button onClick={() => handleUpdateOrderStatus(globalActiveOrder, 'draft')} className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-white/5 transition-colors">
                    <ArrowUturnLeftIcon className="w-4 h-4" /> Zurück
                  </button>
                  <button onClick={() => setDispoOrder(globalActiveOrder)} className="flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors shadow-sm">
                    <CheckIcon className="w-4 h-4" /> Auftrag bestätigt
                  </button>
                </>
              )}
              {globalActiveOrder.status === 'confirmed' && (
                <>
                  <button onClick={() => safeRevertStatus(globalActiveOrder, 'quote')} className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-white/5 transition-colors">
                    <ArrowUturnLeftIcon className="w-4 h-4" /> Zurück
                  </button>
                  <button onClick={() => handleUpdateOrderStatus(globalActiveOrder, 'completed')} className="flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors shadow-sm">
                    Erledigt
                  </button>
                </>
              )}
              {globalActiveOrder.status === 'completed' && (
                <>
                  <button onClick={() => safeRevertStatus(globalActiveOrder, 'confirmed')} className="flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-white/5 transition-colors">
                    <ArrowUturnLeftIcon className="w-4 h-4" /> Zurück
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Custom Tabs */}
        <div className="flex overflow-x-auto custom-scrollbar px-6 py-2 gap-2 bg-black/20">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${activeTab === 'overview' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-main hover:bg-white/5'}`}
          >
            Akte & Übersicht
          </button>
          <button 
            onClick={() => setActiveTab('documents')} 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${activeTab === 'documents' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-main hover:bg-white/5'}`}
          >
            Angebote & Dokumente
          </button>
          <button 
            onClick={() => setActiveTab('finances')} 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${activeTab === 'finances' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-main hover:bg-white/5'}`}
          >
            Finanzen & Rechnungen
          </button>
          <button 
            onClick={() => setActiveTab('claims')} 
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${activeTab === 'claims' ? 'bg-primary text-white shadow-md' : 'text-text-muted hover:text-text-main hover:bg-white/5'}`}
          >
            Reklamationen ({claims.length})
          </button>
        </div>
      </div>



      {/* Tabs / Content Area */}
      <div className="mt-6 animate-in fade-in duration-300">
        
        {/* TAB: ÜBERSICHT & DOKUMENTE */}
        <div className="flex flex-col gap-6">
          
          {/* Top Row for Overview: Finanzübersicht & Reklamationen (Full Width Grid) */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-structure">
                <h3 className="text-xl font-bold mb-6 pb-4 border-b border-white/5 text-text-main flex items-center gap-3">
                  <BanknotesIcon className="w-7 h-7 text-green-400" /> Finanzübersicht
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center p-4 bg-black/20 rounded-xl border border-white/5 shadow-inner">
                    <span className="text-text-muted font-bold uppercase tracking-wider text-xs">Gesamtumsatz (Angebote & Rechnungen):</span>
                    <span className="font-bold text-primary text-xl">€ {totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-black/20 rounded-xl border border-white/5 shadow-inner">
                    <span className="text-text-muted font-bold uppercase tracking-wider text-xs">Offene Posten:</span>
                    <span className={`font-bold text-xl ${openItems > 0 ? 'text-red-400' : 'text-text-main'}`}>€ {openItems.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-red-500">
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                  <h3 className="text-xl font-bold text-text-main flex items-center gap-3">
                    <ExclamationTriangleIcon className="w-7 h-7 text-red-500" /> Reklamationen
                  </h3>
                  <button onClick={() => setClaimModalOpen(true)} className="btn-secondary py-1.5 px-3 text-xs bg-white text-black hover:bg-gray-200">
                    + Schaden melden
                  </button>
                </div>
                {claims.length === 0 ? (
                  <div className="text-center py-6 text-text-muted italic bg-black/20 rounded-xl border border-white/5 shadow-inner">
                    Keine gemeldeten Schäden.
                  </div>
                ) : (
                  <div className="space-y-3 custom-scrollbar overflow-y-auto max-h-[160px] pr-2">
                    {claims.map(claim => (
                      <div key={claim.id} onClick={() => setViewClaimId(claim.id)} className="p-3 bg-bg-dark border border-structure rounded-xl cursor-pointer hover:border-primary/50 transition-colors shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-text-main">
                            {claim.type === 'damage' ? 'Möbelschaden' : claim.type === 'property' ? 'Gebäudeschaden' : 'Sonstiges'}
                          </span>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${claim.status === 'open' ? 'bg-red-500/20 text-red-400' : claim.status === 'processing' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-400'}`}>
                            {claim.status === 'open' ? 'Offen' : claim.status === 'processing' ? 'In Bearbeitung' : 'Erledigt'}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted truncate">{claim.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Row for Overview OR Main Content for Documents: Historie */}
          {(activeTab === 'overview' || activeTab === 'documents') && (
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl shadow-xl">
                <h3 className="text-xl font-bold mb-6 pb-4 border-b border-white/5 text-text-main flex items-center gap-3">
                  <DocumentTextIcon className="w-7 h-7 text-primary" /> Historie (Angebote, Aufträge, Rechnungen & Protokolle)
                </h3>
                
                {orders.filter(o => o.status !== 'archived').length === 0 ? (
                  <div className="text-center py-16 text-text-muted italic border-2 border-dashed border-white/10 rounded-2xl bg-black/10">
                    Noch keine Dokumente vorhanden.
                    <div className="mt-6">
                      <button 
                        onClick={() => router.push(`/dashboard/customers/${customerId}/new-order`)}
                        className="btn-primary shadow-lg shadow-primary/20"
                      >
                        Erstes Angebot erstellen
                      </button>
                    </div>
                  </div>
                ) : (
                  isMobile ? (
                  <div className="space-y-4">
                    {orders.filter(o => o.status !== 'archived').map(order => {
                      const isInvoice = order.status === 'invoice_open' || order.status === 'invoice_paid' || order.status === 'invoice_overdue';
                      const isConfirmed = order.status === 'confirmed' || order.status === 'completed';
                      const isQuote = order.status === 'quote';
                      const isClarification = order.status === 'clarification';
                      const isRejected = order.status === 'rejected';
                      
                      const getStatusBadge = () => {
                        switch(order.status) {
                          case 'draft': return <span className="px-2 py-1 bg-white/5 text-text-muted rounded text-xs font-semibold uppercase tracking-wider">Entwurf</span>;
                          case 'clarification': return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs font-semibold uppercase tracking-wider shadow-sm shadow-yellow-500/10">In Klärung</span>;
                          case 'quote': return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold uppercase tracking-wider shadow-sm shadow-blue-500/10">Angebot</span>;
                          case 'confirmed': return <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs font-semibold uppercase tracking-wider shadow-sm shadow-primary/10">Bestätigt</span>;
                          case 'completed': return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold uppercase tracking-wider shadow-sm shadow-green-500/10">Erledigt</span>;
                          case 'invoice_open': return <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-semibold uppercase tracking-wider shadow-sm shadow-orange-500/10">Rechnung offen</span>;
                          case 'invoice_paid': return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold uppercase tracking-wider shadow-sm shadow-green-500/10">Rechnung bezahlt</span>;
                          case 'invoice_overdue': return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-semibold uppercase tracking-wider shadow-sm shadow-red-500/10">In Mahnung</span>;
                          case 'invoice_cancelled': return <span className="px-2 py-1 bg-red-900/30 text-red-500 rounded text-xs font-semibold uppercase tracking-wider line-through">Storniert</span>;
                          case 'rejected': return <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs font-semibold uppercase tracking-wider line-through">Abgelehnt</span>;
                          case 'archived': return <span className="px-2 py-1 bg-white/5 text-text-muted rounded text-xs font-semibold uppercase tracking-wider">Archiviert</span>;
                          default: return null;
                        }
                      };

                      return (
                      <div key={order.id} className="flex flex-col gap-4 p-5 rounded-xl border border-structure bg-bg-panel hover:border-primary/50 transition-colors shadow-sm hover:shadow-md">
                        
                        {/* Top Row: Info & Price (Clickable) */}
                        <div 
                          onClick={() => { setSelectedOrder(order); setPdfType('order'); }}
                          className="flex flex-wrap md:flex-nowrap justify-between items-start gap-4 cursor-pointer hover:bg-bg-dark p-3 -m-3 rounded-lg transition-colors group"
                        >
                          <div className="flex items-center gap-5">
                            <div className={`p-4 rounded-xl shrink-0 transition-transform group-hover:scale-105 shadow-inner ${isInvoice ? 'bg-purple-500/20 text-purple-400 border border-purple-500/20' : isConfirmed ? 'bg-green-500/20 text-green-400 border border-green-500/20' : isQuote ? 'bg-primary/20 text-primary border border-primary/20' : isClarification ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/20' : 'bg-bg-dark text-text-muted border border-structure'}`}>
                              <DocumentTextIcon className="w-7 h-7" />
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-text-main group-hover:text-primary transition-colors">
                                {isInvoice ? 'Rechnung' : isQuote ? 'Angebot' : isConfirmed ? 'Auftrag' : 'Entwurf'} 
                                {isInvoice && order.invoiceNumber ? ` #${order.invoiceNumber}` : order.orderNumber ? ` #${order.orderNumber}` : ''}
                              </h4>
                              <div className="flex items-center gap-3 mt-2">
                                {getStatusBadge()}
                                <span className="text-sm text-text-muted font-medium">
                                  {new Date(order.createdAt?.toMillis?.() || Date.now()).toLocaleDateString('de-DE')} • {order.services?.length || 0} Leistungen
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <div className="text-sm text-text-muted font-medium uppercase tracking-wider mb-1">Brutto</div>
                            <div className="font-bold text-text-main text-xl">€ {Number(order.totals?.gross || order.calcInput?.gross || 0).toFixed(2)}</div>
                          </div>
                        </div>

                        {/* Disposition Info Box */}
                        {['confirmed', 'completed', 'invoice_open', 'invoice_overdue', 'invoice_paid'].includes(order.status) && order.disposition && (
                          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-center justify-between text-sm shadow-inner">
                            <div>
                              <div className="text-blue-400 font-bold mb-1.5 flex items-center gap-2">
                                <TruckIcon className="w-5 h-5" /> Grob-Disposition
                              </div>
                              <div className="text-text-main font-medium">
                                {order.disposition.movingDateStr ? (
                                  <span>{new Date(order.disposition.movingDateStr).toLocaleDateString('de-DE')} {order.disposition.movingTimeStr ? `um ${order.disposition.movingTimeStr} Uhr` : ''}</span>
                                ) : (
                                  <span className="italic text-text-muted">Kein Datum</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right text-text-muted">
                              <div><span className="font-bold text-text-main text-base">{order.disposition.helpers || 0}</span> Helfer</div>
                              <div className="text-xs mt-1 font-medium">
                                {order.disposition.koffer35t > 0 && <span>{order.disposition.koffer35t}x 3,5t </span>}
                                {order.disposition.lkw7t > 0 && <span>{order.disposition.lkw7t}x 7,5t</span>}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Bottom Row: Unified Toolbar */}
                        <div className="mt-4 pt-5 border-t border-structure flex flex-wrap items-center justify-between gap-4">
                          
                          {/* Tool Group Left: Actions */}
                          <div className="flex flex-wrap items-center gap-3">
                            {/* Main Group */}
                            <div className="flex items-center rounded-xl overflow-hidden border border-primary/30 shadow-sm bg-bg-panel">
                              {/* Edit & Delete ONLY for Drafts/Quotes */}
                              {['draft', 'quote', 'clarification', 'rejected'].includes(order.status) && (
                                <button 
                                  onClick={() => router.push(`/dashboard/customers/${customerId}/edit-order/${order.id}`)}
                                  className="py-2.5 px-4 text-sm font-bold flex items-center gap-2 bg-primary text-white hover:bg-primary/90 transition-colors"
                                  title="Angebot bearbeiten"
                                >
                                  <PencilIcon className="w-4 h-4" /> Bearbeiten
                                </button>
                              )}
                              
                              <button 
                                onClick={() => { setPdfModalOrder(order); setPdfType(isInvoice ? 'invoice' : 'order'); }}
                                className={`py-2.5 px-4 text-sm font-bold flex items-center gap-2 transition-colors ${['draft', 'quote', 'clarification', 'rejected'].includes(order.status) ? 'text-text-main hover:bg-bg-dark border-l border-structure' : 'bg-primary text-white hover:bg-primary/90'}`}
                              >
                                <DocumentArrowDownIcon className="w-4 h-4" /> Ansicht / Download
                              </button>
                              
                              {['draft', 'quote', 'clarification', 'rejected'].includes(order.status) && (
                                <button 
                                  onClick={() => deleteOrder(order.id)}
                                  className="py-2.5 px-4 text-sm font-bold text-red-500 hover:bg-red-500/10 transition-colors border-l border-structure"
                                  title="Löschen"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            
                            {/* Invoice Specific Actions */}
                            {isInvoice && (
                              <div className="flex items-center gap-2 border-l border-structure pl-3">
                                {order.status === 'invoice_open' && (
                                  <button 
                                    onClick={() => setPaymentOrder(order)}
                                    className="py-2 px-4 rounded-xl text-sm font-bold border border-green-500/50 text-green-400 hover:bg-green-500/10 shadow-sm transition-colors"
                                    title="Teilzahlung oder vollständige Zahlung erfassen"
                                  >
                                    Zahlung erfassen
                                  </button>
                                )}
                                <div className="flex flex-col gap-1">
                                  <button 
                                    onClick={() => {
                                      if (confirm('Möchten Sie diese Rechnung stornieren und sofort einen NEUEN Entwurf zur Korrektur erstellen?')) {
                                        handleStorno(order, true);
                                      }
                                    }}
                                    className="py-1 px-3 rounded text-[11px] font-bold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                                    title="Rechnung stornieren und Kopie als Entwurf anlegen"
                                  >
                                    Stornieren & Neu
                                  </button>
                                  <button 
                                    onClick={() => {
                                      if (confirm('Möchten Sie diese Rechnung WIRKLICH stornieren OHNE einen neuen Entwurf zu erstellen?')) {
                                        handleStorno(order, false);
                                      }
                                    }}
                                    className="text-[10px] text-text-muted hover:text-red-400 font-medium underline underline-offset-2 text-center"
                                  >
                                    Nur Stornieren
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Inline Signatures */}
                        {!isInvoice && (
                          <div className="mt-4 pt-4 border-t border-white/5 space-y-4">
                            <h5 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                              <PencilIcon className="w-4 h-4 text-primary" /> Digitale Unterschriften
                            </h5>
                            
                            {/* AGB Signature (Always visible if Quote/Draft, or if already signed) */}
                            {(isQuote || order.status === 'clarification' || order.status === 'draft' || order.signatureAGB) && (
                              <div className="bg-bg-dark/30 rounded-xl p-4 border border-structure">
                                {order.signatureAGB ? (
                                  <div className="flex items-center justify-between gap-4">
                                    <div>
                                      <h4 className="font-semibold text-green-400 mb-1 flex items-center gap-2"><CheckBadgeIcon className="w-5 h-5" /> AGBs akzeptiert</h4>
                                      <p className="text-xs text-text-muted">Am {order.signatureAGBDate ? new Date(order.signatureAGBDate?.toMillis?.() || Date.now()).toLocaleString('de-DE') : 'kürzlich'}</p>
                                    </div>
                                    <div className="flex gap-4 items-center">
                                      <div className="bg-white rounded p-1">
                                        <img src={order.signatureAGB} alt="Unterschrift AGB" className="h-12 w-auto object-contain mix-blend-multiply" />
                                      </div>
                                      {!isConfirmed && order.status !== 'completed' && (
                                        <button onClick={() => handleDeleteSignature(order.id, 'signatureAGB')} className="p-2 text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title="Löschen">
                                          <TrashIcon className="w-5 h-5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <SignaturePad 
                                    orderId={order.id} 
                                    signatureKey="signatureAGB"
                                    title="1. AGB akzeptieren"
                                    description="Ich bestätige, dass ich die Allgemeinen Geschäftsbedingungen gelesen habe und diese akzeptiere."
                                    buttonText="AGBs bestätigen"
                                    onSigned={(key, dataUrl, place, dateStr) => {
                                      toast.success("AGBs erfolgreich bestätigt!");
                                    }} 
                                  />
                                )}
                              </div>
                            )}

                            {/* Order Signature (Visible if Quote/Draft and AGB is signed, or if already signed) */}
                            {(isQuote || order.status === 'clarification' || order.status === 'draft' || order.signatureOrder) && (
                              <div className={`bg-bg-dark/30 rounded-xl p-4 border border-structure ${!order.signatureAGB && !order.signatureOrder ? 'opacity-50 pointer-events-none' : ''}`}>
                                {order.signatureOrder ? (
                                  <div className="flex items-center justify-between gap-4">
                                    <div>
                                      <h4 className="font-semibold text-green-400 mb-1 flex items-center gap-2"><CheckBadgeIcon className="w-5 h-5" /> Auftrag erteilt</h4>
                                      <p className="text-xs text-text-muted">Am {order.signatureOrderDate ? new Date(order.signatureOrderDate?.toMillis?.() || Date.now()).toLocaleString('de-DE') : 'kürzlich'}</p>
                                    </div>
                                    <div className="flex gap-4 items-center">
                                      <div className="bg-white rounded p-1">
                                        <img src={order.signatureOrder} alt="Unterschrift Auftrag" className="h-12 w-auto object-contain mix-blend-multiply" />
                                      </div>
                                      {!isConfirmed && order.status !== 'completed' && (
                                        <button onClick={() => handleDeleteSignature(order.id, 'signatureOrder')} className="p-2 text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title="Löschen">
                                          <TrashIcon className="w-5 h-5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <SignaturePad 
                                      orderId={order.id} 
                                      signatureKey="signatureOrder"
                                      title="2. Auftrag erteilen"
                                      description="Mit dieser Unterschrift beauftrage ich verbindlich die Durchführung des Umzugs."
                                      buttonText="Verbindlich unterschreiben"
                                      onSigned={(key, dataUrl, place, dateStr) => {
                                        toast.success("Auftrag erfolgreich und verbindlich erteilt!");
                                        if (order.status === 'draft' || order.status === 'quote') {
                                          setDispoOrder(order);
                                        }
                                      }} 
                                    />
                                    {!order.signatureAGB && (
                                      <p className="text-xs text-orange-400 mt-2">Bitte zuerst die AGBs bestätigen.</p>
                                    )}
                                  </>
                                )}
                              </div>
                            )}

                            {/* Protocol Signature (Visible if Confirmed/Completed) */}
                            {(isConfirmed || order.status === 'completed') && (
                              <div className="bg-bg-dark/30 rounded-xl p-4 border border-structure">
                                {order.signatureProtocol ? (
                                  <div className="flex items-center justify-between gap-4">
                                    <div>
                                      <h4 className="font-semibold text-green-400 mb-1 flex items-center gap-2"><CheckBadgeIcon className="w-5 h-5" /> Protokoll unterschrieben</h4>
                                      <p className="text-xs text-text-muted">Am {order.signatureProtocolDate ? new Date(order.signatureProtocolDate?.toMillis?.() || Date.now()).toLocaleString('de-DE') : 'kürzlich'}</p>
                                    </div>
                                    <div className="flex gap-4 items-center">
                                      <div className="bg-white rounded p-1">
                                        <img src={order.signatureProtocol} alt="Unterschrift Protokoll" className="h-12 w-auto object-contain mix-blend-multiply" />
                                      </div>
                                      <button onClick={() => handleDeleteSignature(order.id, 'signatureProtocol')} className="p-2 text-red-500 hover:bg-red-500/10 rounded-md transition-colors" title="Löschen">
                                        <TrashIcon className="w-5 h-5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <SignaturePad 
                                    orderId={order.id} 
                                    signatureKey="signatureProtocol"
                                    title="Protokoll gegenzeichnen"
                                    description="Ich bestätige hiermit die Richtigkeit der dokumentierten Protokolle und Leistungen."
                                    buttonText="Protokoll unterschreiben"
                                    onSigned={(key, dataUrl, place, dateStr) => {
                                      toast.success("Protokoll erfolgreich unterschrieben!");
                                    }} 
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Protokolle anzeigen */}
                        {order.protocols && order.protocols.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-white/5">
                            <h5 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Hinterlegte Protokolle</h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {order.protocols.map((proto: any) => (
                                <div key={proto.id} className="bg-black/40 border border-orange-500/20 rounded-xl p-4 flex items-start gap-4 shadow-inner relative group">
                                  <DocumentTextIcon className="w-6 h-6 text-orange-400 shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <div className="font-bold text-sm text-text-main">{proto.type}</div>
                                    <div className="text-xs text-text-muted mt-1.5 italic font-medium">"{proto.text}"</div>
                                    {proto.signature && (
                                      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-green-400">
                                        <CheckCircleIcon className="w-4 h-4" /> Unterschrieben
                                      </div>
                                    )}
                                  </div>
                                  <button 
                                    onClick={async () => {
                                      if(confirm("Möchten Sie dieses Protokoll wirklich löschen? Die Unterschrift geht dabei unwiderruflich verloren.")) {
                                        try {
                                          const updatedProtocols = order.protocols.filter((p: any) => p.id !== proto.id);
                                          await updateDoc(doc(db, getCol('orders'), order.id), { protocols: updatedProtocols });
                                          toast.success("Protokoll gelöscht!");
                                        } catch (e) {
                                          toast.error("Fehler beim Löschen");
                                        }
                                      }
                                    }}
                                    className="absolute top-3 right-3 p-2 text-text-muted hover:text-red-400 bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity border border-white/5 hover:border-red-500/50"
                                    title="Protokoll löschen"
                                  >
                                    <TrashIcon className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Checkliste anzeigen (System + Manuell) */}
                        {(() => {
                          const systemTickets = generateTickets(order, customer);
                          const manualChecklist = order.checklist || [];
                          const hasTasks = systemTickets.length > 0 || manualChecklist.length > 0;
                          
                          if (!hasTasks) return null;
                          
                          return (
                            <div className="mt-4 pt-4 border-t border-white/5">
                              <h5 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                                <ClipboardDocumentListIcon className="w-4 h-4" />
                                Aufgaben (System & Checkliste)
                              </h5>
                              <div className="space-y-2">
                                {/* System Tickets */}
                                {systemTickets.map((task: any) => (
                                  <label key={task.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${task.done ? 'bg-bg-dark border-transparent opacity-60' : 'bg-bg-panel border-structure hover:border-primary/50 shadow-sm'}`}>
                                    <input 
                                      type="checkbox" 
                                      checked={task.done}
                                      onChange={async (e) => {
                                        const updatedStates = order.ticketStates || {};
                                        updatedStates[task.id] = e.target.checked;
                                        try {
                                          await updateDoc(doc(db, getCol('orders'), order.id), { ticketStates: updatedStates });
                                          toast.success("System-Aufgabe aktualisiert");
                                        } catch(err) {
                                          toast.error("Fehler beim Aktualisieren");
                                        }
                                      }}
                                      className="accent-primary w-5 h-5 rounded cursor-pointer"
                                    />
                                    <span className={`text-sm font-medium ${task.done ? 'text-text-muted line-through' : 'text-text-main'}`}>
                                      {task.title}
                                    </span>
                                    {!task.done && (
                                      <span className={`ml-auto text-[10px] px-2 py-1 rounded uppercase font-bold tracking-wider ${task.type === 'warning' ? 'bg-red-500/10 text-red-400' : task.type === 'action' ? 'bg-primary/10 text-primary' : 'bg-blue-500/10 text-blue-400'}`}>
                                        System
                                      </span>
                                    )}
                                  </label>
                                ))}
                                
                                {/* Manuelle Checkliste */}
                                {manualChecklist.map((task: any) => (
                                  <label key={task.id} className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${task.done ? 'bg-bg-dark border-transparent opacity-60' : 'bg-bg-panel border-structure hover:border-primary/50 shadow-sm'}`}>
                                    <input 
                                      type="checkbox" 
                                      checked={task.done}
                                      onChange={async (e) => {
                                        const updatedChecklist = order.checklist.map((t:any) => 
                                          t.id === task.id ? { ...t, done: e.target.checked } : t
                                        );
                                        try {
                                          await updateDoc(doc(db, getCol('orders'), order.id), { checklist: updatedChecklist });
                                          toast.success("Manuelle Aufgabe aktualisiert");
                                        } catch(err) {
                                          toast.error("Fehler beim Aktualisieren");
                                        }
                                      }}
                                      className="accent-primary w-5 h-5 rounded cursor-pointer"
                                    />
                                    <span className={`text-sm font-medium ${task.done ? 'text-text-muted line-through' : 'text-text-main'}`}>{task.text}</span>
                                    <span className="ml-auto text-[10px] px-2 py-1 rounded bg-white/5 text-text-muted uppercase font-bold tracking-wider">
                                      Manuell
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );})}
                  </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                      {/* Left Column: Document Tree (1/4 width) */}
                      <div className="xl:col-span-1 flex flex-col gap-4">
                        <div className="flex flex-col gap-3 custom-scrollbar overflow-y-auto max-h-[850px] pr-2">
                          {(() => {
                            const rootOrders = orders.filter(o => o.status !== 'archived' && (!o.type || o.type === 'order'));
                            const invoices = orders.filter(o => o.status !== 'archived' && o.type === 'invoice');
                            
                            return (
                              <>
                                {rootOrders.map(order => {
                                  const orderInvoices = invoices.filter(i => i.sourceOrderId === order.id);
                                  const isActiveOrder = activeA4OrderId === order.id;
                                  
                                  return (
                                    <div key={order.id} className="flex flex-col gap-1">
                                      <button 
                                        onClick={() => setActiveA4OrderId(order.id)}
                                        className={`text-left p-3 rounded-xl border transition-all ${isActiveOrder ? 'bg-primary/20 border-primary shadow-sm' : 'bg-bg-panel border-structure hover:border-primary/50'}`}
                                      >
                                        <div className="flex items-center gap-2 font-bold text-sm">
                                          <DocumentTextIcon className="w-4 h-4 text-primary" />
                                          {order.status === 'quote' ? 'Angebot' : order.status === 'confirmed' || order.status === 'completed' ? 'Auftrag' : 'Entwurf'} {order.orderNumber ? `#${order.orderNumber}` : ''}
                                        </div>
                                      </button>
                                      
                                      {/* Nested Invoices */}
                                      {orderInvoices.length > 0 && (
                                        <div className="flex flex-col gap-1 pl-4 mt-1 border-l-2 border-structure ml-3">
                                          {orderInvoices.map(inv => {
                                            const isActiveInv = activeA4OrderId === inv.id;
                                            return (
                                              <button 
                                                key={inv.id}
                                                onClick={() => setActiveA4OrderId(inv.id)}
                                                className={`text-left p-2.5 rounded-lg border transition-all ${isActiveInv ? 'bg-primary text-white shadow-sm border-primary' : 'bg-bg-dark border-transparent hover:bg-white/5'}`}
                                              >
                                                <div className="flex items-center gap-2 text-xs font-semibold">
                                                  <DocumentTextIcon className="w-3 h-3" />
                                                  {inv.status === 'draft' ? 'Entwurf Rg.' : 'Rechnung'} {inv.invoiceNumber ? `#${inv.invoiceNumber}` : ''}
                                                </div>
                                              </button>
                                            )
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                                
                                {/* Orphaned Invoices */}
                                {invoices.filter(i => !i.sourceOrderId).length > 0 && (
                                  <div className="mt-4">
                                    <div className="text-xs font-bold text-text-muted mb-2 uppercase tracking-wider">Sonstige Rechnungen</div>
                                    {invoices.filter(i => !i.sourceOrderId).map(inv => {
                                      const isActiveInv = activeA4OrderId === inv.id;
                                      return (
                                        <button 
                                          key={inv.id}
                                          onClick={() => setActiveA4OrderId(inv.id)}
                                          className={`w-full text-left p-3 rounded-xl border transition-all mb-1 ${isActiveInv ? 'bg-primary text-white shadow-sm border-primary' : 'bg-bg-panel border-structure hover:border-primary/50'}`}
                                        >
                                          <div className="flex items-center gap-2 text-sm font-bold">
                                            <DocumentTextIcon className="w-4 h-4" />
                                            {inv.status === 'draft' ? 'Entwurf Rechnung' : 'Rechnung'} {inv.invoiceNumber ? `#${inv.invoiceNumber}` : ''}
                                          </div>
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Right Column: PDF Viewer */}
                      <div className="xl:col-span-3 flex flex-col gap-4">
                        {/* A4 Editor for Desktop */}
                        {activeA4OrderId && orders.find(o => o.id === activeA4OrderId) ? (() => {
                          const activeOrder = orders.find(o => o.id === activeA4OrderId);
                          const isInvoice = activeOrder.type === 'invoice' || activeOrder.status.startsWith('invoice_');
                          const isConfirmed = activeOrder.status === 'confirmed' || activeOrder.status === 'completed';
                          const isQuote = activeOrder.status === 'quote';

                          return (
                            <div className="animate-in fade-in duration-300 bg-bg-panel border border-structure rounded-2xl p-4 shadow-xl">
                              {/* Desktop Toolbar */}
                              <div className="flex flex-wrap items-center justify-between gap-4 bg-bg-dark/80 p-3 rounded-xl border border-white/5 shadow-sm mb-4">
                                <div className="flex items-center gap-3">
                                  <h4 className="font-bold text-lg text-white ml-2">
                                    {isInvoice ? 'Rechnung' : 'Angebot / Auftrag'}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  {(!isInvoice) && (
                                    <button 
                                      onClick={() => router.push(`/dashboard/customers/${customerId}/edit-order/new?type=invoice&sourceOrder=${activeOrder.id}`)}
                                      className="py-2 px-4 text-sm font-bold flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:shadow-blue-500/20 transition-all border border-blue-400/30"
                                      title="Rechnung für diesen Auftrag schreiben"
                                    >
                                      🧾 Rechnung schreiben
                                    </button>
                                  )}
                                  {(activeOrder.status === 'draft' || activeOrder.status === 'quote') && (
                                    <button 
                                      onClick={() => router.push(`/dashboard/customers/${customerId}/edit-order/${activeOrder.id}`)}
                                      className="py-2 px-4 text-sm font-bold flex items-center gap-2 bg-white text-black rounded-lg hover:bg-gray-200 transition-colors shadow-sm"
                                      title="Dokument bearbeiten"
                                    >
                                      <PencilIcon className="w-4 h-4" /> Bearbeiten
                                    </button>
                                  )}
                                  <PDFDownloadButton 
                                    order={activeOrder} 
                                    customer={customer} 
                                    type={isInvoice ? 'invoice' : isConfirmed ? 'contract' : 'order'} 
                                  />
                                  {['draft', 'quote', 'clarification', 'rejected'].includes(activeOrder.status) && (
                                    <button 
                                      onClick={() => deleteOrder(activeOrder.id)}
                                      className="py-2 px-3 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                      title="Dokument löschen"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Actual PDF Viewer */}
                              <div className="w-full h-full min-h-[800px] flex items-center justify-center rounded-xl overflow-hidden border border-structure/50 bg-black/20">
                                  {settings ? (
                                    <InlinePDFViewer 
                                      order={activeOrder} 
                                      customer={customer} 
                                      type={isInvoice ? 'invoice' : isConfirmed ? 'contract' : 'order'} 
                                    />
                                  ) : (
                                    <div className="text-gray-400 animate-pulse font-medium">Lade Vorschau...</div>
                                  )}
                                </div>

                                {/* Signatures Section (AGB & Order) below PDF paper */}
                                {!isInvoice && (
                                  <div className="flex gap-4 mt-6">
                                    {(isQuote || activeOrder.status === 'clarification' || activeOrder.status === 'draft' || activeOrder.signatureAGB) && (
                                      <div className="flex-1 bg-bg-dark/30 rounded-xl p-4 border border-structure shadow-sm">
                                        {activeOrder.signatureAGB ? (
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <h4 className="font-semibold text-green-400 mb-1 flex items-center gap-1.5 text-sm"><CheckBadgeIcon className="w-4 h-4" /> AGBs akzeptiert</h4>
                                            </div>
                                            <div className="flex gap-2 items-center">
                                              <div className="bg-white rounded p-1"><img src={activeOrder.signatureAGB} alt="AGB" className="h-8 w-auto mix-blend-multiply" /></div>
                                              {!isConfirmed && activeOrder.status !== 'completed' && (
                                                <button onClick={() => handleDeleteSignature(activeOrder.id, 'signatureAGB')} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <SignaturePad 
                                            orderId={activeOrder.id} 
                                            signatureKey="signatureAGB"
                                            title="1. AGB akzeptieren"
                                            description="Ich akzeptiere die AGBs."
                                            buttonText="Bestätigen"
                                            onSigned={() => toast.success("AGBs bestätigt!")} 
                                          />
                                        )}
                                      </div>
                                    )}
                                    {(isQuote || activeOrder.status === 'clarification' || activeOrder.status === 'draft' || activeOrder.signatureOrder) && (
                                      <div className={`flex-1 bg-bg-dark/30 rounded-xl p-4 border border-structure shadow-sm ${!activeOrder.signatureAGB && !activeOrder.signatureOrder ? 'opacity-50 pointer-events-none' : ''}`}>
                                        {activeOrder.signatureOrder ? (
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <h4 className="font-semibold text-green-400 mb-1 flex items-center gap-1.5 text-sm"><CheckBadgeIcon className="w-4 h-4" /> Auftrag erteilt</h4>
                                            </div>
                                            <div className="flex gap-2 items-center">
                                              <div className="bg-white rounded p-1"><img src={activeOrder.signatureOrder} alt="Auftrag" className="h-8 w-auto mix-blend-multiply" /></div>
                                              {!isConfirmed && activeOrder.status !== 'completed' && (
                                                <button onClick={() => handleDeleteSignature(activeOrder.id, 'signatureOrder')} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-md transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                              )}
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <SignaturePad 
                                              orderId={activeOrder.id} 
                                              signatureKey="signatureOrder"
                                              title="2. Auftrag erteilen"
                                              description="Ich beauftrage verbindlich."
                                              buttonText="Unterschreiben"
                                              onSigned={() => {
                                                toast.success("Auftrag erteilt!");
                                                if (activeOrder.status === 'draft' || activeOrder.status === 'quote') setDispoOrder(activeOrder);
                                              }} 
                                            />
                                            {!activeOrder.signatureAGB && <p className="text-[10px] text-orange-400 mt-1">Zuerst AGB bestätigen.</p>}
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                            </div>
                          );
                        })() : (
                          <div className="flex flex-col items-center justify-center min-h-[400px] text-text-muted border-2 border-dashed border-structure rounded-2xl bg-bg-dark/20 mt-4">
                            <DocumentTextIcon className="w-12 h-12 mb-4 opacity-20" />
                            <p>Bitte wähle links ein Dokument aus der Liste.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* TAB: FINANZEN (Nur Finanzen) */}
          {(activeTab === 'finances') && (
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-structure">
                <h3 className="text-xl font-bold mb-6 pb-4 border-b border-white/5 text-text-main flex items-center gap-3">
                  <BanknotesIcon className="w-7 h-7 text-green-400" /> Finanzübersicht
                </h3>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between items-center p-4 bg-black/20 rounded-xl border border-white/5 shadow-inner">
                    <span className="text-text-muted font-bold uppercase tracking-wider text-xs">Gesamtumsatz (Angebote & Rechnungen):</span>
                    <span className="font-bold text-primary text-xl">€ {totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-black/20 rounded-xl border border-white/5 shadow-inner">
                    <span className="text-text-muted font-bold uppercase tracking-wider text-xs">Offene Posten:</span>
                    <span className={`font-bold text-xl ${openItems > 0 ? 'text-red-400' : 'text-text-main'}`}>€ {openItems.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: REKLAMATIONEN (Nur Reklamationen) */}
          {(activeTab === 'claims') && (
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-red-500">
                <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                  <h3 className="text-xl font-bold text-text-main flex items-center gap-3">
                    <ExclamationTriangleIcon className="w-7 h-7 text-red-500" /> Reklamationen
                  </h3>
                  <button onClick={() => setClaimModalOpen(true)} className="btn-secondary py-1.5 px-3 text-xs bg-white text-black hover:bg-gray-200">
                    + Schaden melden
                  </button>
                </div>
                {claims.length === 0 ? (
                  <div className="text-center py-6 text-text-muted italic bg-black/20 rounded-xl border border-white/5 shadow-inner">
                    Keine gemeldeten Schäden.
                  </div>
                ) : (
                  <div className="space-y-3 custom-scrollbar overflow-y-auto max-h-[400px] pr-2">
                    {claims.map(claim => (
                      <div key={claim.id} onClick={() => setViewClaimId(claim.id)} className="p-3 bg-bg-dark border border-structure rounded-xl cursor-pointer hover:border-primary/50 transition-colors shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-bold text-text-main">
                            {claim.type === 'damage' ? 'Möbelschaden' : claim.type === 'property' ? 'Gebäudeschaden' : 'Sonstiges'}
                          </span>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${claim.status === 'open' ? 'bg-red-500/20 text-red-400' : claim.status === 'processing' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/20 text-green-400'}`}>
                            {claim.status === 'open' ? 'Offen' : claim.status === 'processing' ? 'In Bearbeitung' : 'Erledigt'}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted truncate">{claim.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>


      {showClaimModal && (
        <ClaimModal 
          customerId={customer.id} 
          customerName={`${customer.firstName} ${customer.lastName}`} 
          onClose={() => setShowClaimModal(false)} 
        />
      )}

      {protocolOrder && (
        <ProtocolModal order={protocolOrder} onClose={() => setProtocolOrder(null)} />
      )}

      {paymentOrder && (
        <PaymentModal order={paymentOrder} onClose={() => setPaymentOrder(null)} />
      )}

      {/* Message Sender Modal */}
      {messageOrder && (
        <MessageSenderModal 
          order={messageOrder}
          customer={customer}
          onClose={() => setMessageOrder(null)}
        />
      )}

      <ConfirmModal 
        isOpen={deleteConfirmOrder !== null}
        title="Dokument archivieren"
        message="Möchten Sie dieses Dokument wirklich ins Archiv verschieben? Es taucht dann nicht mehr in der normalen Ansicht auf."
        confirmText="Archivieren"
        isDestructive={true}
        onConfirm={confirmDeleteOrder}
        onCancel={() => setDeleteConfirmOrder(null)}
      />

      <ConfirmModal 
        isOpen={revertConfirmOrder !== null}
        title="Achtung: Auftrag zurückstufen"
        message="Sie stufen einen bereits bestätigten Auftrag zurück! Die digitalen Vertragsunterschriften werden gelöscht. Alle damit verbundenen Termine im Kalender und in der Checkliste (wie Halteverbotszonen, Kartonlieferung) werden ausgeblendet. Falls Sie diese extern bereits beauftragt haben, müssen Sie sie MANUELL stornieren!"
        confirmText="Trotzdem fortfahren"
        isDestructive={true}
        onConfirm={() => {
          if (revertConfirmOrder) handleUpdateOrderStatus(revertConfirmOrder.order, revertConfirmOrder.newStatus);
          setRevertConfirmOrder(null);
        }}
        onCancel={() => setRevertConfirmOrder(null)}
      />

      {/* Dispo Modal */}
      {dispoOrder && (
        <DispoModal 
          order={dispoOrder} 
          onClose={() => setDispoOrder(null)} 
          onSuccess={() => {}}
        />
      )}

      {/* PDF Viewer Modal */}
      {pdfModalOrder && (
        <PdfModal 
          order={pdfModalOrder}
          customer={customer}
          type={pdfType}
          onClose={() => setPdfModalOrder(null)}
        />
      )}
    </div>
  );
}
