"use client";

import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, CalculatorIcon, DocumentTextIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon, TruckIcon, MapPinIcon, ExclamationTriangleIcon, StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { calculateRoute } from '@/lib/routeCalculator';
import { getCol } from '@/lib/demoMode';

export function OrderEditor({ orderId }: { orderId?: string }) {
  const params = useParams();
  const urlCustomerId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInvoice = searchParams?.get('type') === 'invoice';
  const { profile } = useAuth();
  const canEditPrices = profile?.role === 'admin' ? true : profile?.canEditPrices ?? true;
  const canViewPrices = profile?.role === 'admin' ? true : profile?.canViewPrices ?? true;
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [orderStatus, setOrderStatus] = useState('draft');

  // 1. Kundeninformationen
  const [customerData, setCustomerData] = useState({
    type: 'privat', // 'privat' | 'firma'
    firstName: '',
    lastName: '',
    salutation: '',
    email: '',
    phone: '',
    customerContact: '', // Name der Person vor Ort
    source: '',
    street: '',
    houseNr: '',
    zip: '',
    city: ''
  });

  const [orderMeta, setOrderMeta] = useState({
    movingDateFrom: '',
    movingDateTo: '',
    validUntil: '',
    manager: '',
    paymentMethod: '',
    viewingDate: ''
  });

  // 2. Adressen
  const [logistics, setLogistics] = useState({
    a_street: '', a_houseNr: '', a_zip: '', a_city: '', a_floor: '', a_distance: 0, a_type: '', a_elevator: false, a_parking: false, a_furnitureLift: false,
    b_street: '', b_houseNr: '', b_zip: '', b_city: '', b_floor: '', b_distance: 0, b_type: '', b_elevator: false, b_parking: false, b_furnitureLift: false,
  });

  // 3. Leistungen
  const [isFlatRate, setIsFlatRate] = useState(true);
  const [flatRateNet, setFlatRateNet] = useState(0);
  const [services, setServices] = useState<{ id: string, name: string, quantity: number, unitPrice: number, unit: string }[]>([]);
  
  // 4. MwSt Rechner
  const [calcInput, setCalcInput] = useState({ gross: 0, net: 0, tax: 0 });

  // 5. Inventarliste
  const [inventory, setInventory] = useState<{ id: string, name: string, quantity: number, note: string, showNoteInPdf?: boolean }[]>([]);
  const [appendInventoryToPDF, setAppendInventoryToPDF] = useState(false);
  
  // 6. Dokumententexte
  const [texts, setTexts] = useState({
    quoteIntro: '',
    paymentTerms: '',
    quoteOutro: ''
  });

  // 7. Route & Entfernung
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number, durationMinutes: number } | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // 8. Checkliste
  const [checklist, setChecklist] = useState<{ id: string, text: string, done: boolean }[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  const handleCalculateRoute = async () => {
    const addressA = `${logistics.a_street || ''} ${logistics.a_houseNr || ''}, ${logistics.a_zip || ''} ${logistics.a_city || ''}`.trim();
    const addressB = `${logistics.b_street || ''} ${logistics.b_houseNr || ''}, ${logistics.b_zip || ''} ${logistics.b_city || ''}`.trim();

    if (addressA.length > 5 && addressB.length > 5) {
      setIsCalculatingRoute(true);
      setRouteError(null);
      try {
        const res = await calculateRoute(addressA, addressB);
        if (res) {
          setRouteInfo(res);
          setRouteError(null);
        } else {
          setRouteInfo(null);
          setRouteError("Route konnte nicht berechnet werden. Bitte überprüfe die Adressen.");
        }
      } catch (err) {
        setRouteInfo(null);
        setRouteError("Fehler bei der API-Anfrage.");
      } finally {
        setIsCalculatingRoute(false);
      }
    } else {
      setRouteError("Bitte gib zuerst vollständige Adressen ein.");
    }
  };

  const INVENTORY_CATALOG = ['Umzugskarton', 'Kleiderbox', 'Bücherkarton', 'Sofa 2er', 'Sofa 3er', 'Ecksofa', 'Sessel', 'Couchtisch', 'Esstisch', 'Stuhl', 'Bett (Einzel)', 'Bett (Doppel)', 'Nachttisch', 'Kleiderschrank (2-türig)', 'Kleiderschrank (3-türig)', 'Kommode', 'Sideboard', 'Regal', 'Schreibtisch', 'Waschmaschine', 'Trockner', 'Spülmaschine', 'Kühlschrank', 'Gefrierschrank', 'Fahrrad', 'Spiegel', 'Lampe', 'Teppich'];

  useEffect(() => {
    // Lade globale Settings
    getDoc(doc(db, getCol('system'), 'settings')).then((docSnap) => {
      if(docSnap.exists()) {
        const s = docSnap.data();
        setSettings(s);
        // Defaults aus Settings setzen, wenn neues Angebot
        if (!orderId) {
          const days = parseInt(s.quoteValidDays) || 14;
          const validDate = new Date();
          validDate.setDate(validDate.getDate() + days);
          
          setOrderMeta(prev => ({ 
            ...prev, 
            manager: s.contacts?.[0] || '', 
            paymentMethod: s.paymentMethods?.[0]?.name || '',
            validUntil: validDate.toISOString().split('T')[0]
          }));
          setTexts({
            quoteIntro: s.texts?.quoteIntro || '',
            paymentTerms: s.paymentMethods?.[0]?.textQuote || '',
            quoteOutro: s.texts?.quoteGreeting || ''
          });
        }
      } else {
        // Fallback falls noch keine Settings gespeichert wurden
        setSettings({
          contacts: [],
          paymentMethods: [],
          propertyTypes: ['Wohnung', 'Haus', 'Büro'],
          catalog: []
        });
      }
    }).catch((err) => {
      console.error("Fehler beim Laden der Einstellungen", err);
      setSettings({ catalog: [], paymentMethods: [] }); // Notfall-Fallback
    });

    if (orderId) {
      getDoc(doc(db, getCol('orders'), orderId)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrderStatus(data.status || 'draft');
          setOrderMeta({
            movingDateFrom: data.orderMeta?.movingDateFrom || '',
            movingDateTo: data.orderMeta?.movingDateTo || '',
            validUntil: data.orderMeta?.validUntil || '',
            manager: data.orderMeta?.manager || '',
            paymentMethod: data.orderMeta?.paymentMethod || '',
            viewingDate: data.orderMeta?.viewingDate || data.viewingDate || ''
          });
          setLogistics({
            a_street: data.logistics?.a_street || '', a_houseNr: data.logistics?.a_houseNr || '', a_zip: data.logistics?.a_zip || '', a_city: data.logistics?.a_city || '', a_floor: data.logistics?.a_floor || '', a_distance: data.logistics?.a_distance || 0, a_type: data.logistics?.a_type || '', a_elevator: data.logistics?.a_elevator || false, a_parking: data.logistics?.a_parking || false, a_furnitureLift: data.logistics?.a_furnitureLift || false,
            b_street: data.logistics?.b_street || '', b_houseNr: data.logistics?.b_houseNr || '', b_zip: data.logistics?.b_zip || '', b_city: data.logistics?.b_city || '', b_floor: data.logistics?.b_floor || '', b_distance: data.logistics?.b_distance || 0, b_type: data.logistics?.b_type || '', b_elevator: data.logistics?.b_elevator || false, b_parking: data.logistics?.b_parking || false, b_furnitureLift: data.logistics?.b_furnitureLift || false,
          });
          setIsFlatRate(data.isFlatRate !== undefined ? data.isFlatRate : true);
          setFlatRateNet(data.flatRateNet || 0);
          setServices(data.services || []);
          setInventory(data.inventory || []);
          setAppendInventoryToPDF(data.appendInventoryToPDF || false);
          setChecklist(data.checklist || []);
          setTexts(data.texts || {});
          
          if (data.billingAddress) {
            setCustomerData(prev => ({
              ...prev,
              type: data.billingAddress.type || 'privat',
              salutation: data.billingAddress.salutation || '',
              firstName: data.billingAddress.firstName || '',
              lastName: data.billingAddress.lastName || '',
              street: data.billingAddress.street || '',
              houseNr: data.billingAddress.houseNr || '',
              zip: data.billingAddress.zip || '',
              city: data.billingAddress.city || '',
              email: data.billingAddress.email || '',
              phone: data.billingAddress.phone || '',
              source: data.billingAddress.source || '',
              customerContact: data.billingAddress.customerContact || ''
            }));
          }
        }
      });
    }

    if (urlCustomerId) {
      getDoc(doc(db, getCol('customers'), urlCustomerId)).then(docSnap => {
        if (docSnap.exists()) {
          const c = docSnap.data();
          setCustomerData(prev => ({
            // If we already loaded a billingAddress from the order, we don't want to overwrite the form with the customer profile again.
            // So we only merge if the fields are empty or if we didn't have an order.
            type: prev.lastName ? prev.type : (c.type || 'privat'),
            salutation: prev.lastName ? prev.salutation : (c.salutation || ''),
            firstName: prev.lastName ? prev.firstName : (c.firstName || ''),
            lastName: prev.lastName ? prev.lastName : (c.lastName || ''),
            email: prev.lastName ? prev.email : (c.email || ''),
            phone: prev.lastName ? prev.phone : (c.phone || ''),
            source: prev.lastName ? prev.source : (c.source || ''),
            customerContact: '',
            street: prev.lastName ? prev.street : (c.street || ''),
            houseNr: prev.lastName ? prev.houseNr : (c.houseNr || ''),
            zip: prev.lastName ? prev.zip : (c.zip || ''),
            city: prev.lastName ? prev.city : (c.city || '')
          }));
        }
      });
    }
  }, [orderId, urlCustomerId]);

  const copyCustomerAddress = (target: 'a' | 'b') => {
    if (customerData.street || customerData.zip) {
      setLogistics(prev => ({
        ...prev,
        [`${target}_street`]: customerData.street,
        [`${target}_houseNr`]: customerData.houseNr,
        [`${target}_zip`]: customerData.zip,
        [`${target}_city`]: customerData.city
      }));
      toast.success("Adresse übernommen!");
    } else {
      toast.error("Für diesen Kunden ist noch keine Adresse hinterlegt.");
    }
  };

  const loadStandardTexts = () => {
    if (!settings) return;
    const pm = settings.paymentMethods?.find((p:any) => p.name === orderMeta.paymentMethod) || settings.paymentMethods?.[0];
    setTexts({
      quoteIntro: settings.texts?.quoteIntro || '',
      paymentTerms: pm?.textQuote || '',
      quoteOutro: settings.texts?.quoteGreeting || ''
    });
  };

  const calculateTotal = () => {
    if (isFlatRate) return { net: flatRateNet, tax: flatRateNet * 0.19, gross: flatRateNet * 1.19 };
    const net = services.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    return { net, tax: net * 0.19, gross: net * 1.19 };
  };
  const totals = calculateTotal();

  const handleCalcInput = (field: 'gross' | 'net', val: string) => {
    const num = parseFloat(val) || 0;
    if (field === 'gross') {
      setCalcInput({ gross: num, net: num / 1.19, tax: num - (num / 1.19) });
    } else {
      setCalcInput({ gross: num * 1.19, net: num, tax: num * 0.19 });
    }
  };

  const addInventoryItem = (name: string = '') => {
    if (name === '') {
      setInventory([...inventory, { id: Date.now().toString(), name: '', quantity: 1, note: '', showNoteInPdf: true }]);
      return;
    }
    const existing = inventory.find(i => i.name === name);
    if (existing) {
      setInventory(inventory.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setInventory([...inventory, { id: Date.now().toString(), name, quantity: 1, note: '', showNoteInPdf: true }]);
    }
  };

  const addServiceFromCatalog = (service: any) => {
    setServices([...services, { id: Date.now().toString() + Math.random(), name: service.name, quantity: 1, unitPrice: service.price, unit: service.unit }]);
  };

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const saveOrder = async (status: 'draft' | 'quote' | 'invoice_open') => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Speichern fehlgeschlagen: Du bist offline!', { duration: 5000 });
      setErrorMessage('Kein Internet! Bitte warte auf eine Verbindung.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    if (!urlCustomerId && (!customerData.lastName)) {
      toast.error("Bitte mindestens Nachname/Firmenname ausfüllen!");
      setErrorMessage("Bitte mindestens Nachname/Firmenname ausfüllen!");
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      let finalCustomerId = urlCustomerId;
      if (!finalCustomerId) {
        const cRef = await addDoc(collection(db, getCol('customers')), { 
          ...customerData, 
          createdAt: serverTimestamp(),
          createdBy: profile?.displayName || profile?.email || 'Unbekannt' 
        });
        finalCustomerId = cRef.id;
        await logActivity(profile?.uid || 'unknown', profile?.displayName || profile?.email || 'Unbekannt', 'CREATE_CUSTOMER', `Kunde ${customerData.lastName} im Angebots-Editor angelegt`);
      }
      
      // We DO NOT update the main customer profile here anymore to keep it decoupled.
      // The name and address entered in the form belong to this specific order (Billing Address).

      const payload = {
        customerId: finalCustomerId,
        customerName: customerData.type === 'firma' ? customerData.lastName : `${customerData.firstName} ${customerData.lastName}`.trim(),
        billingAddress: {
          firstName: customerData.firstName || '',
          lastName: customerData.lastName || '',
          salutation: customerData.salutation || '',
          street: customerData.street || '',
          houseNr: customerData.houseNr || '',
          zip: customerData.zip || '',
          city: customerData.city || '',
          email: customerData.email || '',
          phone: customerData.phone || '',
          type: customerData.type || 'privat'
        },
        customerSource: customerData.source || 'Unbekannt',
        status,
        orderMeta,
        logistics,
        viewingDate: orderMeta.viewingDate || '', // Expose on root level for calendar
        isFlatRate,
        flatRateNet,
        services,
        inventory,
        appendInventoryToPDF,
        checklist,
        texts,
        totals,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.displayName || profile?.email || 'Unbekannt'
      };

      if (orderId) {
        await updateDoc(doc(db, getCol('orders'), orderId), payload);
        await logActivity(profile?.uid || 'unknown', profile?.displayName || profile?.email || 'Unbekannt', 'UPDATE_ORDER', `Angebot/Auftrag aktualisiert für Kunde ${payload.customerName}`);
      } else {
        await addDoc(collection(db, getCol('orders')), { 
          ...payload, 
          orderNumber: `${settings?.nextQuoteNumber ? `ANG-${new Date().getFullYear()}-${settings.nextQuoteNumber}` : `ANG-${Date.now()}`}`,
          createdAt: serverTimestamp(),
          createdBy: profile?.displayName || profile?.email || 'Unbekannt' 
        });
        await logActivity(profile?.uid || 'unknown', profile?.displayName || profile?.email || 'Unbekannt', 'CREATE_ORDER', `Angebot erstellt für Kunde ${payload.customerName}`);
        if (settings?.nextQuoteNumber) {
          await updateDoc(doc(db, getCol('system'), 'settings'), { nextQuoteNumber: settings.nextQuoteNumber + 1 });
        }
      }
      setSaveStatus('success');
      toast.success(orderId ? "Änderungen erfolgreich gespeichert!" : "Neues Angebot erfolgreich erstellt!");
      router.push(`/dashboard/customers/${finalCustomerId}`);
    } catch (e) {
      console.error(e); 
      toast.error("Systemfehler beim Speichern. Bitte erneut versuchen.");
      setErrorMessage("Systemfehler beim Speichern. Bitte erneut versuchen.");
      setSaveStatus('error');
      setTimeout(() => { setErrorMessage(''); setSaveStatus('idle'); }, 4000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) return <div className="p-12 text-center text-text-main">Lade Einstellungen...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32">
      <div className="flex justify-between items-center bg-bg-panel border border-structure p-4 rounded-xl shadow-lg mt-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            {isInvoice ? 'Neue Rechnung' : (orderId ? 'Angebot bearbeiten' : 'Neues Angebot')}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {isInvoice ? 'Erstellen Sie eine direkte Rechnung.' : 'Erstellen Sie ein detailliertes Umzugsangebot.'}
          </p>
        </div>
      </div>{/* 1. Kundeninformationen */}
      <section className="panel border-t-4 border-t-primary shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-text-main border-b border-structure pb-2">Kundeninformationen</h2>
        {!urlCustomerId && (
          <div className="mb-4 text-xs text-text-muted bg-bg-dark p-3 rounded-lg border border-structure">
            Der Kunde wird beim Speichern automatisch angelegt. Die Adresse wird aus der Beladeadresse übernommen.
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="col-span-1 md:grid-cols-2 lg:col-span-4 flex gap-4">
            <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="radio" checked={customerData.type === 'privat'} onChange={() => setCustomerData({...customerData, type:'privat'})} className="accent-primary" /> Privatperson</label>
            <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="radio" checked={customerData.type === 'firma'} onChange={() => setCustomerData({...customerData, type:'firma'})} className="accent-primary" /> Firma / Geschäftlich</label>
          </div>
          {customerData.type === 'privat' ? (
              <>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Anrede</label>
                  <select value={customerData.salutation || ''} onChange={e => setCustomerData({...customerData, salutation: e.target.value})} className="input-field w-full">
                    <option value="">Keine</option>
                    <option value="Herr">Herr</option>
                    <option value="Frau">Frau</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Vorname</label>
                  <input type="text" value={customerData.firstName} onChange={e => setCustomerData({...customerData, firstName: e.target.value})} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Nachname *</label>
                  <input type="text" value={customerData.lastName} onChange={e => setCustomerData({...customerData, lastName: e.target.value})} className="input-field w-full" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Firmenname *</label>
                  <input type="text" value={customerData.lastName} onChange={e => setCustomerData({...customerData, lastName: e.target.value})} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Ansprechpartner (Vor- & Nachname)</label>
                  <input type="text" value={customerData.firstName} onChange={e => setCustomerData({...customerData, firstName: e.target.value})} className="input-field w-full" />
                </div>
              </>
            )}
          <div>
            <label className="block text-xs text-text-muted mb-1">E-Mail Adresse</label>
            <input type="email" value={customerData.email} onChange={e => setCustomerData({...customerData, email: e.target.value})} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Telefonnummer</label>
            <input type="text" value={customerData.phone} onChange={e => setCustomerData({...customerData, phone: e.target.value})} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Kundenquelle</label>
            <input type="text" list="order-source-options" value={customerData.source} onChange={e => setCustomerData({...customerData, source: e.target.value})} className="input-field w-full" placeholder="Auswählen oder tippen..." />
            <datalist id="order-source-options">
              {settings.customerSources?.map((s:string) => <option key={s} value={s} />)}
            </datalist>
          </div>
          
          {/* Adress-Block (Aufgeteilt) */}
          <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2 border-t border-structure pt-4">
            <h3 className="text-sm font-semibold text-text-main mb-3">Hauptadresse des Kunden</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3">
                <label className="block text-xs text-text-muted mb-1">Straße</label>
                <input type="text" value={customerData.street} onChange={e => setCustomerData({...customerData, street: e.target.value})} className="input-field w-full" />
              </div>
              <div className="col-span-1">
                <label className="block text-xs text-text-muted mb-1">Haus-Nr.</label>
                <input type="text" value={customerData.houseNr} onChange={e => setCustomerData({...customerData, houseNr: e.target.value})} className="input-field w-full" />
              </div>
              <div className="col-span-1">
                <label className="block text-xs text-text-muted mb-1">PLZ</label>
                <input type="text" value={customerData.zip} onChange={async (e) => {
                  const val = e.target.value;
                  setCustomerData(prev => ({...prev, zip: val}));
                  if (val.length === 5) {
                    try {
                      const res = await fetch(`https://api.zippopotam.us/de/${val}`);
                      if (res.ok) {
                        const data = await res.json();
                        if (data.places && data.places.length > 0) {
                          setCustomerData(prev => ({...prev, zip: val, city: data.places[0]['place name']}));
                        }
                      }
                    } catch(err) {}
                  }
                }} className="input-field w-full" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-text-muted mb-1">Ort</label>
                <input type="text" value={customerData.city} onChange={e => setCustomerData({...customerData, city: e.target.value})} className="input-field w-full" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Umzugsdatum (von)</label>
            <input type="date" value={orderMeta.movingDateFrom} onChange={e => setOrderMeta({...orderMeta, movingDateFrom: e.target.value})} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Besichtigungstermin</label>
            <input type="datetime-local" value={orderMeta.viewingDate || ''} onChange={e => setOrderMeta({...orderMeta, viewingDate: e.target.value})} className="input-field w-full" />
            <p className="text-[10px] text-text-muted mt-1">Erscheint automatisch im Kalender.</p>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Umzugsdatum (bis - optional)</label>
            <input type="date" value={orderMeta.movingDateTo} onChange={e => setOrderMeta({...orderMeta, movingDateTo: e.target.value})} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Gültig bis</label>
            <input type="date" value={orderMeta.validUntil} onChange={e => setOrderMeta({...orderMeta, validUntil: e.target.value})} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Ansprechpartner (Berater)</label>
            <select value={orderMeta.manager} onChange={e => setOrderMeta({...orderMeta, manager: e.target.value})} className="input-field w-full">
              <option value="">Wählen...</option>
              {settings.contacts?.map((c:string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Zahlungsmethode</label>
            <select value={orderMeta.paymentMethod} onChange={e => {
              setOrderMeta({...orderMeta, paymentMethod: e.target.value});
              const pm = settings.paymentMethods?.find((p:any) => p.name === e.target.value);
              if (pm) setTexts(t => ({...t, paymentTerms: pm.textQuote}));
            }} className="input-field w-full">
              {settings.paymentMethods?.map((pm:any) => <option key={pm.name} value={pm.name}>{pm.name}</option>)}
            </select>
          </div>
          <div className="col-span-1 md:col-span-3">
            <label className="block text-xs text-text-muted mb-1">Ansprechpartner vor Ort (Kunde)</label>
            <input type="text" value={customerData.customerContact} onChange={e => setCustomerData({...customerData, customerContact: e.target.value})} className="input-field w-full" placeholder="Name der Person vor Ort..." />
          </div>
        </div>
      </section>

      {/* 2. Adressen (A -> B) */}
      <div className="flex flex-col gap-4 mb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">Logistik & Route</h2>
          <div className="flex flex-wrap gap-2">
            <button 
              type="button"
              onClick={handleCalculateRoute}
              disabled={isCalculatingRoute}
              className="btn-primary py-1.5 px-3 text-sm flex items-center gap-2 shadow-lg"
            >
              <TruckIcon className="w-4 h-4" /> {isCalculatingRoute ? "Berechne..." : "Route direkt berechnen"}
            </button>
            <a 
              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${logistics.a_street || ''} ${logistics.a_houseNr || ''}, ${logistics.a_zip || ''} ${logistics.a_city || ''}`)}&destination=${encodeURIComponent(`${logistics.b_street || ''} ${logistics.b_houseNr || ''}, ${logistics.b_zip || ''} ${logistics.b_city || ''}`)}`}
              target="_blank" 
              rel="noreferrer" 
              className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-2 border-primary/50 text-primary hover:bg-primary/10 shadow-lg"
              title="Google Maps Routenplanung öffnen"
            >
              <MapPinIcon className="w-4 h-4" /> Auf Maps öffnen
            </a>
          </div>
        </div>
        
        {/* Direkte Entfernungsberechnung */}
        {(isCalculatingRoute || routeInfo || routeError) && (
          <div className={`border rounded-lg p-3 flex items-center justify-between text-sm animate-in fade-in duration-300 ${routeError ? 'bg-red-500/10 border-red-500/30' : 'bg-primary/10 border-primary/30'}`}>
            <div className="flex items-center gap-3">
              <TruckIcon className="w-6 h-6 text-text-muted" />
              <div>
                <span className="text-text-muted">Direkte Strecke: </span>
                {isCalculatingRoute ? (
                  <span className="text-primary font-medium animate-pulse">Berechne Route...</span>
                ) : routeError ? (
                  <span className="text-red-400 font-medium">{routeError}</span>
                ) : routeInfo ? (
                  <span className="text-primary font-bold">{routeInfo.distanceKm} km <span className="text-text-muted font-normal">(Fahrzeit: ca. {Math.floor(routeInfo.durationMinutes/60)}h {routeInfo.durationMinutes%60}min)</span></span>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Etagen Datalist (Wird für beide Inputs genutzt) */}
        <datalist id="floors">
          <option value="Erdgeschoss" />
          <option value="Hochparterre" />
          <option value="1. OG" />
          <option value="2. OG" />
          <option value="3. OG" />
          <option value="4. OG" />
          <option value="5. OG" />
          <option value="6. OG" />
          <option value="7. OG" />
          <option value="8. OG" />
          <option value="9. OG" />
          <option value="10. OG" />
          <option value="Dachgeschoss" />
        </datalist>

        <div className="panel border-t-4 border-t-structure shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-structure pb-2">
            <h2 className="text-xl font-bold text-text-main flex items-center gap-2">Beladeadresse (A)</h2>
            <button onClick={() => copyCustomerAddress('a')} className="text-xs btn-secondary py-1 px-2">Kundenadresse übernehmen</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Straße</label><input type="text" value={logistics.a_street} onChange={e => setLogistics({...logistics, a_street: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1"><label className="block text-xs text-text-muted mb-1">Haus-Nr.</label><input type="text" value={logistics.a_houseNr} onChange={e => setLogistics({...logistics, a_houseNr: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1">
              <label className="block text-xs text-text-muted mb-1">PLZ</label>
              <input type="text" value={logistics.a_zip} onChange={async (e) => {
                  const val = e.target.value;
                  setLogistics(prev => ({...prev, a_zip: val}));
                  if (val.length === 5) {
                    try {
                      const res = await fetch(`https://api.zippopotam.us/de/${val}`);
                      if (res.ok) {
                        const data = await res.json();
                        if (data.places && data.places.length > 0) {
                          setLogistics(prev => ({...prev, a_zip: val, a_city: data.places[0]['place name']}));
                        }
                      }
                    } catch(err) {}
                  }
                }} className="input-field w-full" />
            </div>
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Ort</label><input type="text" value={logistics.a_city} onChange={e => setLogistics({...logistics, a_city: e.target.value})} className="input-field w-full" /></div>
            
            <div className="col-span-2"><label className="block text-xs text-text-muted mb-1">Etage</label><input type="text" list="floors" value={logistics.a_floor} onChange={e => setLogistics({...logistics, a_floor: e.target.value})} className="input-field w-full" placeholder="Auswählen oder tippen..." /></div>
            <div className="col-span-2"><label className="block text-xs text-text-muted mb-1">Laufweg (m)</label><input type="number" min="0" value={logistics.a_distance === 0 ? '' : logistics.a_distance} onChange={e => setLogistics({...logistics, a_distance: e.target.value === '' ? 0 : parseInt(e.target.value)})} className="input-field w-full" placeholder="Unter 10 Meter" /></div>
            
            <div className="col-span-4"><label className="block text-xs text-text-muted mb-1">Immobilienart</label>
              <select value={logistics.a_type} onChange={e => setLogistics({...logistics, a_type: e.target.value})} className="input-field w-full">
                <option value="">Wählen...</option>
                {settings.propertyTypes?.map((pt:string) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
            
            <div className="col-span-4 mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="checkbox" checked={logistics.a_elevator} onChange={e => setLogistics({...logistics, a_elevator: e.target.checked})} className="accent-primary w-4 h-4" /> Aufzug</label>
              <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="checkbox" checked={logistics.a_parking} onChange={e => setLogistics({...logistics, a_parking: e.target.checked})} className="accent-primary w-4 h-4" /> Halteverbot</label>
              <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="checkbox" checked={logistics.a_furnitureLift} onChange={e => setLogistics({...logistics, a_furnitureLift: e.target.checked})} className="accent-primary w-4 h-4" /> Möbellift</label>
            </div>
          </div>
        </div>

        <div className="panel border-t-4 border-t-structure shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-structure pb-2">
            <h2 className="text-xl font-bold text-text-main flex items-center gap-2">Entladeadresse (B)</h2>
            <button onClick={() => copyCustomerAddress('b')} className="text-xs btn-secondary py-1 px-2">Kundenadresse übernehmen</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Straße</label><input type="text" value={logistics.b_street} onChange={e => setLogistics({...logistics, b_street: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1"><label className="block text-xs text-text-muted mb-1">Haus-Nr.</label><input type="text" value={logistics.b_houseNr} onChange={e => setLogistics({...logistics, b_houseNr: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1">
              <label className="block text-xs text-text-muted mb-1">PLZ</label>
              <input type="text" value={logistics.b_zip} onChange={async (e) => {
                  const val = e.target.value;
                  setLogistics(prev => ({...prev, b_zip: val}));
                  if (val.length === 5) {
                    try {
                      const res = await fetch(`https://api.zippopotam.us/de/${val}`);
                      if (res.ok) {
                        const data = await res.json();
                        if (data.places && data.places.length > 0) {
                          setLogistics(prev => ({...prev, b_zip: val, b_city: data.places[0]['place name']}));
                        }
                      }
                    } catch(err) {}
                  }
                }} className="input-field w-full" />
            </div>
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Ort</label><input type="text" value={logistics.b_city} onChange={e => setLogistics({...logistics, b_city: e.target.value})} className="input-field w-full" /></div>
            
            <div className="col-span-2"><label className="block text-xs text-text-muted mb-1">Etage</label><input type="text" list="floors" value={logistics.b_floor} onChange={e => setLogistics({...logistics, b_floor: e.target.value})} className="input-field w-full" placeholder="Auswählen oder tippen..." /></div>
            <div className="col-span-2"><label className="block text-xs text-text-muted mb-1">Laufweg (m)</label><input type="number" min="0" value={logistics.b_distance === 0 ? '' : logistics.b_distance} onChange={e => setLogistics({...logistics, b_distance: e.target.value === '' ? 0 : parseInt(e.target.value)})} className="input-field w-full" placeholder="Unter 10 Meter" /></div>
            
            <div className="col-span-4"><label className="block text-xs text-text-muted mb-1">Immobilienart</label>
              <select value={logistics.b_type} onChange={e => setLogistics({...logistics, b_type: e.target.value})} className="input-field w-full">
                <option value="">Wählen...</option>
                {settings.propertyTypes?.map((pt:string) => <option key={pt} value={pt}>{pt}</option>)}
              </select>
            </div>
            
            <div className="col-span-4 mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="checkbox" checked={logistics.b_elevator} onChange={e => setLogistics({...logistics, b_elevator: e.target.checked})} className="accent-primary w-4 h-4" /> Aufzug</label>
              <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="checkbox" checked={logistics.b_parking} onChange={e => setLogistics({...logistics, b_parking: e.target.checked})} className="accent-primary w-4 h-4" /> Halteverbot</label>
              <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="checkbox" checked={logistics.b_furnitureLift} onChange={e => setLogistics({...logistics, b_furnitureLift: e.target.checked})} className="accent-primary w-4 h-4" /> Möbellift</label>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Leistungen & Preise */}
      <section className="panel border-t-4 border-t-blue-500 shadow-lg">
        <div className="flex justify-between items-center mb-4 border-b border-structure pb-2">
          <h2 className="text-xl font-bold text-text-main">Leistungen & Preise</h2>
          <label className={`flex items-center gap-2 bg-bg-dark px-3 py-1.5 rounded-lg border border-structure ${!canEditPrices ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input type="checkbox" checked={isFlatRate} onChange={e => setIsFlatRate(e.target.checked)} disabled={!canEditPrices} className="accent-primary" />
            <span className="text-sm font-medium text-text-main">Pauschalangebot</span>
          </label>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Katalog Checkliste */}
          <div className="w-full lg:w-1/3 bg-bg-dark border border-structure rounded-xl p-4 max-h-[600px] overflow-y-auto custom-scrollbar">
            <h3 className="font-semibold text-primary mb-3">Katalog-Checkliste</h3>
            {settings.catalog?.map((cat:any, idx:number) => (
              <div key={idx} className="mb-4">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">{cat.category}</div>
                <div className="space-y-1">
                  {cat.items.map((item:any, i:number) => {
                    const isTicketTrigger = ['karton', 'box', 'kartons', 'küche', 'kueche', 'einbau', 'montage', 'einpack', 'auspack', 'packservice', 'einräum', 'ausräum'].some(kw => item.name.toLowerCase().includes(kw));
                    
                    return (
                      <button key={i} onClick={() => addServiceFromCatalog(item)} className="w-full text-left p-2 rounded hover:bg-structure/30 text-sm text-text-main flex justify-between items-center transition-colors group">
                        <span className="truncate pr-2 flex items-center gap-2">
                          {item.name}
                          {isTicketTrigger && <StarIconSolid className="w-3 h-3 text-orange-400 opacity-70 group-hover:opacity-100" title="Erzeugt ein System-Ticket" />}
                        </span>
                        <PlusIcon className="w-4 h-4 text-primary shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Aktive Leistungen */}
          <div className="flex-1 space-y-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-text-muted border-b border-structure">
                  <th className="pb-2 w-8">#</th>
                  <th className="pb-2">Beschreibung</th>
                  <th className="pb-2 w-20">Menge</th>
                  <th className="pb-2 w-20">Einheit</th>
                  {!isFlatRate && <th className="pb-2 w-24 text-right">Einzelpreis</th>}
                  {!isFlatRate && <th className="pb-2 w-24 text-right">Gesamt</th>}
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc, idx) => (
                  <tr key={svc.id} className="border-b border-structure/30">
                    <td className="py-2 text-text-muted">{idx + 1}</td>
                    <td className="py-2"><input type="text" value={svc.name} onChange={e => {
                      setServices(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s));
                    }} className="bg-transparent border-none w-full text-text-main focus:outline-none" /></td>
                    <td className="py-2"><input type="number" value={svc.quantity} onChange={e => {
                      setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: parseFloat(e.target.value) || 0 } : s));
                    }} className="input-field py-1 px-2 w-full text-center" min="1" /></td>
                    <td className="py-2"><input type="text" value={svc.unit} onChange={e => {
                      setServices(prev => prev.map((s, i) => i === idx ? { ...s, unit: e.target.value } : s));
                    }} className="input-field py-1 px-2 w-full text-center" /></td>
                    
                    {!isFlatRate && <td className="py-2 text-right"><input type="number" value={svc.unitPrice} onChange={e => {
                      setServices(prev => prev.map((s, i) => i === idx ? { ...s, unitPrice: parseFloat(e.target.value) || 0 } : s));
                    }} disabled={!canEditPrices} className={`input-field py-1 px-2 w-full text-right ${!canEditPrices ? 'opacity-50 cursor-not-allowed' : ''}`} /></td>}
                    
                    {!isFlatRate && <td className="py-2 text-right text-primary font-medium">{canViewPrices ? (svc.quantity * svc.unitPrice).toFixed(2) : '***'}</td>}
                    
                    <td className="py-2 text-right">
                      <button onClick={() => setServices(services.filter(s => s.id !== svc.id))} className="text-text-muted hover:text-red-400 p-1"><TrashIcon className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setServices([...services, { id: Date.now().toString(), name: 'Weitere Leistung', quantity: 1, unitPrice: 0, unit: 'Pauschal' }])} className="text-primary hover:underline text-sm font-medium">
              + Weitere Leistung hinzufügen
            </button>

            {/* Summen */}
            <div className="flex justify-end mt-8">
              <div className="w-72 space-y-2">
                {isFlatRate ? (
                  <div className="mb-4">
                    <label className="text-xs text-text-muted font-bold uppercase tracking-wider mb-1 block">Pauschalabrechnung (Netto)</label>
                    <input type="number" value={flatRateNet} onChange={e => setFlatRateNet(parseFloat(e.target.value)||0)} disabled={!canEditPrices} className={`input-field w-full text-right font-bold text-lg ${!canEditPrices ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="0.00" />
                  </div>
                ) : null}
                
                {canViewPrices ? (
                  <>
                    <div className="flex justify-between text-text-muted text-sm">
                      <span>Summe Netto:</span><span>{totals.net.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-text-muted text-sm">
                      <span>MwSt. 19%:</span><span>{totals.tax.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between text-text-main font-bold text-lg border-t border-structure pt-2 mt-2">
                      <span>Gesamtbetrag:</span><span className="text-primary">{totals.gross.toFixed(2)} €</span>
                    </div>
                  </>
                ) : (
                  <div className="text-right text-text-muted italic text-sm border-t border-structure pt-2 mt-2">
                    Summen ausgeblendet (fehlende Berechtigung)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MwSt.-Schnellrechner */}
      {canViewPrices && (
        <section className="bg-bg-dark border border-structure p-4 rounded-xl flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-3">
            <CalculatorIcon className="w-8 h-8 text-text-muted" />
            <div>
              <h3 className="font-semibold text-text-main">MwSt.-Schnellrechner</h3>
              <p className="text-xs text-text-muted">Hilfe zum Umrechnen (speichert nicht ins Angebot)</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Brutto eingeben</label>
              <input type="number" value={calcInput.gross === 0 ? '' : calcInput.gross.toFixed(2)} onChange={e => handleCalcInput('gross', e.target.value)} className="input-field w-32" placeholder="z.B. 1190" />
            </div>
            <div className="pt-6 text-text-muted">=</div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Netto Ergebnis</label>
              <div className="input-field w-32 bg-structure/30 text-text-main font-mono">{calcInput.net.toFixed(2)}</div>
            </div>
          </div>
        </section>
      )}

      {/* 5. Umzugsgut / Inventarliste */}
      <section className="panel border-t-4 border-t-structure shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-structure pb-2 gap-4">
          <h2 className="text-xl font-bold text-text-main">Umzugsgut / Inventarliste</h2>
          <label className="flex items-center gap-2 bg-bg-dark px-3 py-1.5 rounded-lg border border-structure cursor-pointer">
            <input type="checkbox" checked={appendInventoryToPDF} onChange={e => setAppendInventoryToPDF(e.target.checked)} className="accent-primary" />
            <span className="text-sm font-medium text-text-main">Als Anhang (letzte Seite) an Angebot hängen</span>
          </label>
        </div>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-1/3 bg-bg-dark border border-structure rounded-xl p-4 max-h-[400px] overflow-y-auto custom-scrollbar">
            <h3 className="font-semibold text-text-muted mb-3 text-sm">Schnell-Hinzufügen</h3>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => addInventoryItem('')} className="bg-primary hover:bg-primary/80 text-white font-medium text-xs px-2 py-1 rounded transition-colors shadow-sm mb-2">
                + Eigener Gegenstand
              </button>
              <div className="w-full border-b border-structure/50 mb-2"></div>
              {INVENTORY_CATALOG.map(item => (
                <button key={item} onClick={() => addInventoryItem(item)} className="bg-structure/30 hover:bg-primary/20 text-text-muted hover:text-primary text-xs px-2 py-1 rounded transition-colors border border-structure/50">
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-text-muted border-b border-structure">
                  <th className="pb-2 w-8">#</th>
                  <th className="pb-2">Gegenstand / Beschreibung</th>
                  <th className="pb-2 w-28 text-center">Anzahl</th>
                  <th className="pb-2">Notiz</th>
                  <th className="pb-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {inventory.length === 0 ? (
                  <tr><td colSpan={5} className="py-4 text-center text-text-muted italic text-xs">Keine Gegenstände erfasst. Nutzen Sie die Schnell-Auswahl.</td></tr>
                ) : inventory.map((item, idx) => (
                  <tr key={item.id} className="border-b border-structure/30">
                    <td className="py-2 text-text-muted">{idx + 1}</td>
                    <td className="py-2"><input type="text" value={item.name} onChange={e => {
                      setInventory(prev => prev.map((invItem, i) => i === idx ? { ...invItem, name: e.target.value } : invItem));
                    }} className="bg-transparent border-none w-full text-text-main focus:outline-none placeholder:text-text-muted/30" placeholder="Bezeichnung..." /></td>
                    <td className="py-2">
                      <div className="flex items-center justify-center gap-2 bg-bg-dark rounded-lg p-1 border border-structure/50 w-28">
                        <button type="button" onClick={() => {
                          setInventory(prev => prev.map((invItem, i) => i === idx && invItem.quantity > 1 ? { ...invItem, quantity: Number(invItem.quantity) - 1 } : invItem));
                        }} className="w-6 h-6 flex items-center justify-center bg-structure/50 hover:bg-primary/20 text-white rounded transition-colors font-bold">-</button>
                        <span className="w-6 text-center text-text-main font-semibold text-sm">{item.quantity}</span>
                        <button type="button" onClick={() => {
                          setInventory(prev => prev.map((invItem, i) => i === idx ? { ...invItem, quantity: (Number(invItem.quantity) || 0) + 1 } : invItem));
                        }} className="w-6 h-6 flex items-center justify-center bg-structure/50 hover:bg-primary/20 text-white rounded transition-colors font-bold">+</button>
                      </div>
                    </td>
                    <td className="py-2 flex items-center gap-2">
                      <input type="text" value={item.note} onChange={e => {
                        setInventory(prev => prev.map((invItem, i) => i === idx ? { ...invItem, note: e.target.value } : invItem));
                      }} className="bg-transparent border-none w-full text-text-muted focus:outline-none text-xs" placeholder="..." />
                      {item.note && (
                        <button 
                          title={item.showNoteInPdf === false ? "Notiz wird im PDF versteckt" : "Notiz ist im PDF sichtbar"}
                          onClick={() => {
                            setInventory(prev => prev.map((invItem, i) => i === idx ? { ...invItem, showNoteInPdf: invItem.showNoteInPdf === false } : invItem));
                          }}
                          className={`p-1 rounded shrink-0 transition-colors ${item.showNoteInPdf === false ? 'text-red-400 bg-red-400/10 hover:bg-red-400/20' : 'text-green-400 bg-green-400/10 hover:bg-green-400/20'}`}>
                          {item.showNoteInPdf === false ? <EyeSlashIcon className="w-4 h-4"/> : <EyeIcon className="w-4 h-4"/>}
                        </button>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => setInventory(inventory.filter(i => i.id !== item.id))} className="text-text-muted hover:text-red-400 p-1"><TrashIcon className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 8. Mitarbeiter-Checkliste */}
      <section className="panel border-t-4 border-t-orange-500 shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-text-main border-b border-structure pb-2">Mitarbeiter-Checkliste</h2>
        <p className="text-sm text-text-muted mb-4">
          Diese Liste taucht automatisch auf dem Mitarbeiter-Laufzettel auf. Logistik-Auswahlen wie "Halteverbot" oder "Möbellift" werden dort ebenfalls automatisch angezeigt und müssen hier nicht doppelt eingetragen werden.
        </p>
        <div className="space-y-2 mb-4">
          {checklist.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border bg-bg-dark border-structure hover:border-primary/50 transition-colors">
              <button onClick={() => setChecklist(checklist.map(c => c.id === item.id ? { ...c, done: !c.done } : c))} className="flex items-center gap-3 flex-1 text-left">
                {item.done ? <CheckCircleIconSolid className="w-5 h-5 text-primary shrink-0" /> : <CheckCircleIcon className="w-5 h-5 text-text-muted shrink-0" />}
                <span className={`text-sm font-medium transition-all ${item.done ? 'text-text-muted line-through' : 'text-text-main'}`}>{item.text}</span>
              </button>
              <button onClick={() => setChecklist(checklist.filter(c => c.id !== item.id))} className="text-text-muted hover:text-red-400 p-1"><TrashIcon className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 relative">
          <input type="text" value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)} placeholder="Neuer Punkt (z.B. Schlüsselübergabe)" className="input-field w-full pr-10" onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (newChecklistItem.trim()) {
                setChecklist([...checklist, { id: Date.now().toString(), text: newChecklistItem.trim(), done: false }]);
                setNewChecklistItem('');
              }
            }
          }} />
          <button type="button" onClick={() => {
            if (newChecklistItem.trim()) {
              setChecklist([...checklist, { id: Date.now().toString(), text: newChecklistItem.trim(), done: false }]);
              setNewChecklistItem('');
            }
          }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary hover:text-primary-hover disabled:opacity-50 transition-colors">
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* 6. Dokumententexte & Bedingungen */}
      <section className="panel border-t-4 border-t-structure shadow-lg">
        <div className="flex justify-between items-center mb-4 border-b border-structure pb-2">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2"><DocumentTextIcon className="w-6 h-6 text-text-muted"/> Dokumententexte & Bedingungen</h2>
          <button onClick={loadStandardTexts} className="btn-secondary text-xs">Standard laden</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Einleitungstext (Angebot)</label>
            <textarea value={texts.quoteIntro} onChange={e => setTexts({...texts, quoteIntro: e.target.value})} className="input-field w-full h-20 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Zahlungsbedingungen (Kurz)</label>
            <textarea value={texts.paymentTerms} onChange={e => setTexts({...texts, paymentTerms: e.target.value})} className="input-field w-full h-16 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase mb-1">Schlusstext / Hinweise</label>
            <textarea value={texts.quoteOutro} onChange={e => setTexts({...texts, quoteOutro: e.target.value})} className="input-field w-full h-24 text-sm" />
          </div>
        </div>
      </section>

      {/* Floating Save Button */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-bg-panel/90 backdrop-blur-md border-t border-structure p-4 flex justify-between items-center z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] px-4 lg:px-8">
        <div>
          {errorMessage && <span className="text-red-400 text-sm font-semibold animate-in fade-in slide-in-from-bottom-4 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">{errorMessage}</span>}
        </div>
        <div className="flex justify-end gap-4">
          <button onClick={() => {
            if (urlCustomerId) router.push(`/dashboard/customers/${urlCustomerId}`);
            else router.push('/dashboard/orders');
          }} disabled={isSaving} className="btn-secondary">
            Abbrechen
          </button>
          <button onClick={() => saveOrder(isInvoice ? 'invoice_open' : orderStatus === 'draft' ? 'quote' : (orderStatus as 'draft' | 'quote' | 'invoice_open'))} disabled={isSaving} className="btn-primary shadow-lg shadow-primary/30 flex items-center gap-2">
            {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isSaving ? 'Speichert...' : (isInvoice ? 'Als Rechnung speichern' : 'Speichern')}
          </button>
        </div>
      </div>
    </div>
  );
}
