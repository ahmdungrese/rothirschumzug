"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, collection, query, where, onSnapshot, updateDoc, deleteDoc, serverTimestamp, getDoc, addDoc } from 'firebase/firestore';
import { PlusIcon, UserCircleIcon, PhoneIcon, MapPinIcon, DocumentTextIcon, XMarkIcon, EnvelopeIcon, StarIcon, CheckCircleIcon, PencilIcon, TrashIcon, CheckIcon, TruckIcon, CheckBadgeIcon, ClipboardDocumentIcon, DocumentArrowDownIcon, BanknotesIcon, ExclamationTriangleIcon, ArchiveBoxIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import { PDFGenerator } from '@/components/pdf/PDFGenerator';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { ProtocolModal } from '@/components/customers/ProtocolModal';
import { ClaimModal } from '@/components/customers/ClaimModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PaymentModal } from '@/components/orders/PaymentModal';
import { calculateRoute } from '@/lib/routeCalculator';
import { getCol } from '@/lib/demoMode';

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [protocolOrder, setProtocolOrder] = useState<any>(null);
  const [claims, setClaims] = useState<any[]>([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [pdfType, setPdfType] = useState<'order' | 'employee'>('order');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [deleteConfirmOrder, setDeleteConfirmOrder] = useState<string | null>(null);
  
  // Payment Modal
  const [paymentOrder, setPaymentOrder] = useState<any>(null);

  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number, durationMinutes: number } | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

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
      fetchedOrders.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setOrders(fetchedOrders);
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
      fetchedClaims.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
      setClaims(fetchedClaims);
    });

    return () => {
      unsubCustomer();
      unsubOrders();
      unsubSettings();
      unsubClaims();
    };
  }, [customerId]);

  const handleCalculateRoute = async () => {
    if (orders.length > 0) {
      const activeOrder = orders.find(o => o.status === 'confirmed' || o.status === 'quote') || orders[0];
      if (activeOrder && activeOrder.logistics) {
        const addressA = `${activeOrder.logistics.a_street || ''} ${activeOrder.logistics.a_houseNr || ''}, ${activeOrder.logistics.a_zip || ''} ${activeOrder.logistics.a_city || ''}`.trim();
        const addressB = `${activeOrder.logistics.b_street || ''} ${activeOrder.logistics.b_houseNr || ''}, ${activeOrder.logistics.b_zip || ''} ${activeOrder.logistics.b_city || ''}`.trim();
        
        if (addressA.length > 5 && addressB.length > 5 && addressA !== addressB) {
          setIsCalculatingRoute(true);
          setRouteError(null);
          try {
            const res = await calculateRoute(addressA, addressB);
            if (res) {
              setRouteInfo(res);
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

  const handleUpdateOrderStatus = async (order: any, newStatus: string) => {
    try {
      const payload: any = { status: newStatus, updatedAt: serverTimestamp() };
      
      // Get latest settings to pull correct numbers safely
      const settingsDoc = await getDoc(doc(db, getCol('system'), 'settings'));
      const settingsData = settingsDoc.exists() ? settingsDoc.data() : null;

      // 1. Wenn ein Entwurf zum Angebot wird (Nummer bleibt, da in OrderEditor generiert)
      // Aber wir stellen sicher, dass das Datum gesetzt wird.
      
      // 2. Wenn das Angebot bestätigt wird -> Auftragsnummer (AUF-xxx) ziehen
      if (newStatus === 'confirmed') {
        const todos = [];
        if (order.logistics?.noParkingZone && !order.todos?.some((t:any) => t.title === 'Halteverbot beantragen')) {
          todos.push({ id: 'todo_' + Date.now() + 1, title: 'Halteverbot beantragen', isDone: false });
        }
        if (order.logistics?.furnitureLift && !order.todos?.some((t:any) => t.title === 'Möbellift reservieren')) {
          todos.push({ id: 'todo_' + Date.now() + 2, title: 'Möbellift reservieren', isDone: false });
        }
        if (order.services?.some((s: any) => s.name.toLowerCase().includes('karton')) && !order.todos?.some((t:any) => t.title === 'Umzugskartons ausliefern')) {
          todos.push({ id: 'todo_' + Date.now() + 3, title: 'Umzugskartons ausliefern', isDone: false });
        }
        if (order.disposition && (order.disposition.koffer35t > 0 || order.disposition.lkw7t > 0) && !order.todos?.some((t:any) => t.title.includes('Fahrzeug mieten'))) {
          todos.push({ id: 'todo_' + Date.now() + 4, title: `Fahrzeug mieten (${order.disposition.koffer35t}x 3,5t | ${order.disposition.lkw7t}x 7,5t)`, isDone: false });
        }
        if (order.disposition && order.disposition.helpers > 0 && !order.todos?.some((t:any) => t.title === 'Mitarbeiter einteilen')) {
          todos.push({ id: 'todo_' + Date.now() + 5, title: 'Mitarbeiter einteilen', isDone: false });
        }
        payload.todos = [...(order.todos || []), ...todos];

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

  const totalRevenue = orders.filter(o => o.status === 'quote' || o.status === 'confirmed' || o.status === 'invoice_open' || o.status === 'invoice_paid').reduce((sum, o) => sum + (o.totals?.gross || 0), 0);
  const openItems = orders.filter(o => o.status === 'invoice_open' || o.status === 'invoice_overdue' || o.status === 'confirmed').reduce((sum, o) => {
    const gross = o.totals?.gross || 0;
    const paid = o.payments?.reduce((pSum: number, p: any) => pSum + p.amount, 0) || 0;
    return sum + Math.max(0, gross - paid);
  }, 0);

  const handleSaveCustomer = async () => {
    try {
      await updateDoc(doc(db, getCol('customers'), customerId), {
        firstName: editData.firstName,
        lastName: editData.lastName,
        email: editData.email,
        phone: editData.phone,
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 360-Degree Header Card */}
      <div className="panel bg-gradient-to-br from-bg-panel to-bg-dark border-l-4 border-l-primary relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
          <UserCircleIcon className="w-64 h-64 -mt-12 -mr-12" />
        </div>

        <div className="flex flex-col md:flex-row items-start gap-6 relative z-10">
          <div className="shrink-0">
            <Image src="/5.png" alt="Customer Profile" width={100} height={100} className="rounded-full border-2 border-structure object-cover bg-bg-dark shadow-lg" />
          </div>
          <div className="flex-1 w-full">
            
            {isEditing ? (
              <div className="space-y-4 bg-bg-dark/50 p-4 rounded-xl border border-structure w-full">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-white text-sm"><input type="radio" checked={editData.type === 'privat'} onChange={() => setEditData({...editData, type:'privat'})} className="accent-primary" /> Privatperson</label>
                  <label className="flex items-center gap-2 text-white text-sm"><input type="radio" checked={editData.type === 'firma'} onChange={() => setEditData({...editData, type:'firma'})} className="accent-primary" /> Firma</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {editData.type === 'privat' ? (
                    <>
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
                  <h1 className="text-3xl font-bold text-white tracking-tight">
                    {customer.type === 'firma' ? customer.lastName : `${customer.firstName} ${customer.lastName}`}
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
                      <a href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="ml-3 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-xs px-3 py-1 rounded-full font-semibold hover:bg-[#25D366]/20 transition-colors shadow-sm flex items-center gap-1">
                        WhatsApp
                      </a>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <EnvelopeIcon className="w-5 h-5 text-primary" />
                      <span>{customer.email}</span>
                      <a href={`mailto:${customer.email}`} className="ml-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs px-3 py-1 rounded-full font-semibold hover:bg-blue-500/20 transition-colors shadow-sm flex items-center gap-1">
                        E-Mail
                      </a>
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
                    <div className={`col-span-1 md:col-span-2 border rounded-lg p-3 flex items-center justify-between text-sm animate-in fade-in duration-300 ${routeError ? 'bg-red-500/10 border-red-500/30' : 'bg-primary/10 border-primary/30'}`}>
                      <div className="flex items-center gap-3">
                        <TruckIcon className="w-6 h-6 text-text-muted" />
                        <div>
                          <span className="text-text-muted">Aktuelle Route: </span>
                          {routeError ? (
                            <span className="text-red-400 font-medium">{routeError}</span>
                          ) : routeInfo ? (
                            <span className="text-primary font-bold">{routeInfo.distanceKm} km <span className="text-text-muted font-normal">(Fahrzeit: ca. {Math.floor(routeInfo.durationMinutes/60)}h {routeInfo.durationMinutes%60}min)</span></span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <div className="shrink-0 mt-4 md:mt-0 flex flex-col gap-3">
            <button 
              onClick={() => router.push(`/dashboard/customers/${customerId}/new-order`)}
              className="btn-primary shadow-lg shadow-primary/20 w-full justify-center"
            >
              <PlusIcon className="w-5 h-5" /> Neues Angebot
            </button>
            <button 
              onClick={() => router.push(`/dashboard/customers/${customerId}/new-order?type=invoice`)}
              className="btn-secondary border-primary/50 text-primary hover:bg-primary/10 w-full justify-center"
            >
              <DocumentTextIcon className="w-5 h-5" /> Neue Rechnung
            </button>
            {customer.phone && (
              <a 
                href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hallo ${customer.firstName}, wir hoffen, Ihr Umzug lief perfekt! Wir würden uns riesig über eine kleine Google-Bewertung freuen. Liebe Grüße vom Rothirsch-Team! \n\n[Hier Google-Link einfügen]`)}`}
                target="_blank" 
                rel="noreferrer"
                className="btn-secondary w-full justify-center border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
              >
                <StarIcon className="w-5 h-5" /> Bewertung anfragen
              </a>
            )}
          </div>
        </div>
      </div>

      {selectedOrder && (
        <div className="panel border-t-4 border-t-primary shadow-2xl relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">
              Dokumenten-Vorschau: {selectedOrder.status === 'draft' ? 'Entwurf' : 'Angebot / Auftrag'}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex bg-bg-dark rounded-lg p-1 border border-structure overflow-x-auto">
                <button 
                  onClick={() => setPdfType('order')} 
                  className={`px-3 py-1 rounded-md text-sm whitespace-nowrap transition-colors ${pdfType === 'order' ? 'bg-structure text-white' : 'text-text-muted hover:text-white'}`}
                >
                  Angebot
                </button>
                <button 
                  onClick={() => setPdfType('contract')} 
                  className={`px-3 py-1 rounded-md text-sm whitespace-nowrap transition-colors ${pdfType === 'contract' ? 'bg-structure text-white' : 'text-text-muted hover:text-white'}`}
                >
                  Auftrag
                </button>
                <button 
                  onClick={() => setPdfType('employee')} 
                  className={`px-3 py-1 rounded-md text-sm whitespace-nowrap transition-colors ${pdfType === 'employee' ? 'bg-structure text-white' : 'text-text-muted hover:text-white'}`}
                >
                  Laufzettel
                </button>
                <button 
                  onClick={() => setPdfType('invoice')} 
                  className={`px-3 py-1 rounded-md text-sm whitespace-nowrap transition-colors ${pdfType === 'invoice' ? 'bg-structure text-white' : 'text-text-muted hover:text-white'}`}
                >
                  Rechnung
                </button>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="p-2 bg-bg-dark text-text-muted hover:text-white rounded-full transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
          <PDFGenerator order={selectedOrder} customer={customer} type={pdfType} />
          
          {selectedOrder.customerSignature ? (
            <div className="mt-6 panel border border-green-500/30 bg-green-500/5">
              <h3 className="font-semibold text-green-400 mb-2 flex items-center gap-2"><CheckBadgeIcon className="w-5 h-5" /> Dokument wurde digital unterschrieben</h3>
              <p className="text-xs text-text-muted mb-4">Unterschrift vom: {new Date(selectedOrder.signatureDate?.toMillis()).toLocaleString('de-DE')}</p>
              <img src={selectedOrder.customerSignature} alt="Kundenunterschrift" className="bg-white rounded p-2 h-32 object-contain" />
            </div>
          ) : (
            <SignaturePad 
              orderId={selectedOrder.id} 
              onSigned={() => {
                toast.success("Erfolgreich unterschrieben!");
                setSelectedOrder({...selectedOrder, customerSignature: 'pending'}); // Optimistic update to trigger refresh on close
              }} 
            />
          )}
        </div>
      )}

      {/* Tabs / Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel">
            <h3 className="text-lg font-semibold mb-4 border-b border-structure pb-3 text-text-main flex items-center gap-2">
              <DocumentTextIcon className="w-6 h-6" /> Historie (Angebote, Aufträge, Rechnungen & Protokolle)
            </h3>
            
            {orders.length === 0 ? (
              <div className="text-center py-12 text-text-muted italic border-2 border-dashed border-structure rounded-xl bg-bg-dark/30">
                Noch keine Dokumente vorhanden.
                <div className="mt-4">
                  <button 
                    onClick={() => router.push(`/dashboard/customers/${customerId}/new-order`)}
                    className="text-primary hover:text-primary-hover font-medium underline underline-offset-4"
                  >
                    Erstes Angebot erstellen
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map(order => {
                  const isInvoice = order.status === 'invoice_open' || order.status === 'invoice_paid' || order.status === 'invoice_overdue';
                  const isConfirmed = order.status === 'confirmed' || order.status === 'completed';
                  const isQuote = order.status === 'quote';
                  return (
                  <div key={order.id} className="flex flex-col gap-4 p-4 rounded-xl border border-structure bg-bg-dark hover:border-primary/50 transition-colors">
                    
                    {/* Top Row: Info & Price */}
                    <div className="flex flex-wrap md:flex-nowrap justify-between items-start gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg shrink-0 ${isInvoice ? 'bg-purple-500/20 text-purple-400' : isConfirmed ? 'bg-green-500/20 text-green-400' : isQuote ? 'bg-primary/20 text-primary' : 'bg-structure text-text-muted'}`}>
                          <DocumentTextIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">
                            {isInvoice ? 'Rechnung' : isQuote ? 'Angebot' : isConfirmed ? 'Auftrag' : 'Entwurf'} 
                            {order.orderNumber ? ` #${order.orderNumber}` : ''}
                          </h4>
                          <p className="text-sm text-text-muted">
                            {new Date(order.createdAt?.toMillis() || Date.now()).toLocaleDateString('de-DE')} • {order.services?.length || 0} Leistungen
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right shrink-0">
                        <div className="text-sm text-text-muted">Brutto</div>
                        <div className="font-bold text-white text-lg">€ {order.totals?.gross?.toFixed(2) || '0.00'}</div>
                      </div>
                    </div>

                    {/* Bottom Row: Workflow Actions & Button Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2 pt-4 border-t border-structure/50">
                      {/* Workflow Actions */}
                      <div className="flex flex-wrap items-center gap-2">
                        {order.status === 'draft' && (
                          <button onClick={() => handleUpdateOrderStatus(order, 'quote')} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                            Entwurf abschließen
                          </button>
                        )}
                        {isQuote && (
                          <button onClick={() => handleUpdateOrderStatus(order, 'confirmed')} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">
                            <CheckIcon className="w-4 h-4" /> Angebot bestätigt
                          </button>
                        )}
                        {order.status === 'confirmed' && (
                          <button onClick={() => handleUpdateOrderStatus(order, 'completed')} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20">
                            Umzug abgeschlossen
                          </button>
                        )}
                        {(order.status === 'completed' || isInvoice) && (
                          <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-structure text-text-main">
                            <CheckCircleIcon className="w-4 h-4" /> Finalisiert
                          </span>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3">
                        {order.status === 'confirmed' && (
                          <button 
                            onClick={() => handleUpdateOrderStatus(order, 'quote')}
                            className="btn-secondary py-1.5 px-3 text-xs shrink-0 text-text-muted hover:text-white"
                            title="Status zurücksetzen auf 'Angebot'"
                          >
                            Zurücksetzen
                          </button>
                        )}
                        {order.status === 'completed' && (
                          <button 
                            onClick={() => handleUpdateOrderStatus(order, 'confirmed')}
                            className="btn-secondary py-1.5 px-3 text-xs shrink-0 text-text-muted hover:text-white"
                            title="Status zurücksetzen auf 'Auftrag'"
                          >
                            Zurücksetzen
                          </button>
                        )}
                        {isInvoice && (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setPaymentOrder(order)}
                              className="btn-secondary py-1.5 px-3 text-xs shrink-0 border-green-500/50 text-green-400 hover:bg-green-500/10"
                              title="Teilzahlung oder vollständige Zahlung erfassen"
                            >
                              Zahlung erfassen
                            </button>
                            <div className="flex flex-col gap-1">
                              <button 
                                onClick={() => {
                                  if (confirm('Möchten Sie diese Rechnung stornieren und sofort einen NEUEN Entwurf zur Korrektur erstellen?')) {
                                    handleStorno(order, true);
                                  }
                                }}
                                className="btn-secondary py-1.5 px-3 text-xs shrink-0 border-red-500/50 text-red-400 hover:bg-red-500/10"
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
                                className="text-[10px] text-text-muted hover:text-red-400 underline underline-offset-2 text-center"
                                title="Nur stornieren, kein neuer Entwurf"
                              >
                                Nur Stornieren
                              </button>
                            </div>
                          </div>
                        )}
                        
                        <div className="h-6 w-px bg-structure mx-1 hidden sm:block"></div>

                        <button 
                          onClick={() => setProtocolOrder(order)}
                          className="btn-secondary py-1.5 px-3 text-xs shrink-0 border-orange-500/50 text-orange-400 hover:bg-orange-500/10 flex items-center gap-1"
                        >
                          <ClipboardDocumentIcon className="w-4 h-4" /> Protokoll
                        </button>
                        
                        <button 
                          onClick={() => { setSelectedOrder(order); setPdfType('order'); }}
                          className="btn-secondary py-1.5 px-3 text-xs shrink-0 flex items-center gap-1"
                        >
                          <DocumentArrowDownIcon className="w-4 h-4" /> PDFs
                        </button>

                        <button 
                          onClick={() => { setSelectedOrder(order); setPdfType('employee'); }}
                          className="btn-secondary py-1.5 px-3 text-xs shrink-0 border-primary/50 text-primary hover:bg-primary/10 flex items-center gap-1"
                        >
                          <DocumentTextIcon className="w-4 h-4" /> Laufzettel
                        </button>
                        
                        <div className="h-6 w-px bg-structure mx-1 hidden sm:block"></div>
                        
                        <button 
                          onClick={() => router.push(`/dashboard/customers/${customerId}/edit-order/${order.id}`)}
                          className="p-1.5 text-text-muted hover:text-primary transition-colors bg-bg-panel rounded border border-structure"
                          title="Bearbeiten"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteOrder(order.id)}
                          className="p-1.5 text-text-muted hover:text-red-400 transition-colors bg-bg-panel rounded border border-structure"
                          title="Löschen"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Protokolle anzeigen */}
                    {order.protocols && order.protocols.length > 0 && (
                      <div className="mt-2 pt-3 border-t border-structure/50">
                        <h5 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Hinterlegte Protokolle</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {order.protocols.map((proto: any) => (
                            <div key={proto.id} className="bg-bg-panel border border-orange-500/20 rounded-lg p-3 flex items-start gap-3 shadow-inner">
                              <DocumentTextIcon className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div className="font-medium text-sm text-white">{proto.type}</div>
                                <div className="text-xs text-text-muted mt-1 italic">"{proto.text}"</div>
                                {proto.signature && (
                                  <div className="mt-2 flex items-center gap-2 text-xs text-green-400">
                                    <CheckCircleIcon className="w-4 h-4" /> Unterschrieben
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );})}
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="panel border-t-4 border-t-structure shadow-lg">
            <h3 className="text-lg font-semibold mb-4 border-b border-structure pb-3 text-text-main">
              <BanknotesIcon className="w-6 h-6" /> Finanzübersicht
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center p-3 bg-bg-dark rounded-lg">
                <span className="text-text-muted">Gesamtumsatz (Angebote):</span>
                <span className="font-semibold text-primary text-base">€ {totalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-bg-dark rounded-lg border border-transparent">
                <span className="text-text-muted">Offene Posten:</span>
                <span className={`font-semibold text-base ${openItems > 0 ? 'text-primary' : 'text-text-main'}`}>€ {openItems.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="panel border-t-4 border-t-red-500 shadow-lg">
            <div className="flex justify-between items-center mb-4 border-b border-structure pb-3">
              <h3 className="text-lg font-semibold text-red-400">
                <ExclamationTriangleIcon className="w-6 h-6" /> Reklamationen & Schäden
              </h3>
              <button 
                onClick={() => setShowClaimModal(true)}
                className="btn-secondary py-1 px-3 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                + Schaden melden
              </button>
            </div>
            
            <div className="space-y-3">
              {claims.length === 0 ? (
                <p className="text-sm text-text-muted italic text-center py-4">Keine gemeldeten Schäden.</p>
              ) : (
                claims.map(claim => (
                  <div key={claim.id} className="bg-bg-dark border border-structure rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        claim.status === 'Neu' ? 'bg-red-500/20 text-red-400' :
                        claim.status === 'Erledigt' ? 'bg-green-500/20 text-green-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {claim.status}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(claim.createdAt?.toMillis() || Date.now()).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    <p className="text-sm text-white line-clamp-2">{claim.description}</p>
                    {claim.insuranceId && (
                      <p className="text-xs text-text-muted mt-2">Versicherung: {claim.insuranceId}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
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

      <ConfirmModal 
        isOpen={deleteConfirmOrder !== null}
        title="Angebot/Auftrag löschen"
        message="Möchten Sie dieses Dokument wirklich endgültig löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmText="Endgültig löschen"
        isDestructive={true}
        onConfirm={confirmDeleteOrder}
        onCancel={() => setDeleteConfirmOrder(null)}
      />
    </div>
  );
}
