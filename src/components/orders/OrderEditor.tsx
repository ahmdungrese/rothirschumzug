"use client";

import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, CalculatorIcon, DocumentTextIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { calculateRoute } from '@/lib/routeCalculator';

export function OrderEditor({ orderId }: { orderId?: string }) {
  const params = useParams();
  const urlCustomerId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInvoice = searchParams?.get('type') === 'invoice';
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  // 1. Kundeninformationen
  const [customerData, setCustomerData] = useState({
    type: 'privat', // 'privat' | 'firma'
    firstName: '',
    lastName: '',
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
    getDoc(doc(db, 'system', 'settings')).then((docSnap) => {
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
      getDoc(doc(db, 'orders', orderId)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrderMeta(data.orderMeta || {});
          setLogistics(data.logistics || {});
          setIsFlatRate(data.isFlatRate !== undefined ? data.isFlatRate : true);
          setFlatRateNet(data.flatRateNet || 0);
          setServices(data.services || []);
          setInventory(data.inventory || []);
          setAppendInventoryToPDF(data.appendInventoryToPDF || false);
          setChecklist(data.checklist || [
            { id: '1', text: 'Halteverbotszone beantragt', done: false },
            { id: '2', text: 'Umzugskartons geliefert', done: false }
          ]);
          setTexts(data.texts || {});
          // If viewingDate exists directly on order, migrate it into orderMeta (or handle both). In calendar we read `order.viewingDate`.
          if (data.viewingDate && !data.orderMeta?.viewingDate) {
            setOrderMeta(prev => ({...prev, viewingDate: data.viewingDate}));
          }
        }
      });
    }

    if (urlCustomerId) {
      getDoc(doc(db, 'customers', urlCustomerId)).then(docSnap => {
        if (docSnap.exists()) {
          const c = docSnap.data();
          setCustomerData({
            type: c.type || 'privat',
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            email: c.email || '',
            phone: c.phone || '',
            source: c.source || '',
            customerContact: '',
            street: c.street || '',
            houseNr: c.houseNr || '',
            zip: c.zip || '',
            city: c.city || ''
          });
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
    if (!urlCustomerId && (!customerData.lastName)) {
      setErrorMessage("Bitte mindestens Nachname/Firmenname ausfüllen!");
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      let finalCustomerId = urlCustomerId;
      if (!finalCustomerId) {
        const cRef = await addDoc(collection(db, 'customers'), { ...customerData, createdAt: serverTimestamp() });
        finalCustomerId = cRef.id;
      } else {
        // Update existing customer data if it was changed in the editor
        await updateDoc(doc(db, 'customers', finalCustomerId), {
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          email: customerData.email,
          phone: customerData.phone,
          source: customerData.source,
          street: customerData.street,
          houseNr: customerData.houseNr,
          zip: customerData.zip,
          city: customerData.city,
          type: customerData.type
        });
      }

      const payload = {
        customerId: finalCustomerId,
        customerName: customerData.type === 'firma' ? customerData.lastName : `${customerData.firstName} ${customerData.lastName}`.trim(),
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
        updatedAt: serverTimestamp()
      };

      if (orderId) {
        await updateDoc(doc(db, 'orders', orderId), payload);
      } else {
        await addDoc(collection(db, 'orders'), { 
          ...payload, 
          orderNumber: `${settings?.nextQuoteNumber ? `ANG-${new Date().getFullYear()}-${settings.nextQuoteNumber}` : `ANG-${Date.now()}`}`,
          createdAt: serverTimestamp() 
        });
        if (settings?.nextQuoteNumber) {
          await updateDoc(doc(db, 'system', 'settings'), { nextQuoteNumber: settings.nextQuoteNumber + 1 });
        }
      }
      setSaveStatus('success');
      router.push(`/dashboard/customers/${finalCustomerId}`);
    } catch (e) {
      console.error(e); 
      setErrorMessage("Systemfehler beim Speichern. Bitte erneut versuchen.");
      setSaveStatus('error');
      setTimeout(() => { setErrorMessage(''); setSaveStatus('idle'); }, 4000);
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) return <div className="p-12 text-center text-white">Lade Einstellungen...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32">
      <div className="flex justify-between items-center bg-bg-panel border border-structure p-4 rounded-xl shadow-lg mt-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {isInvoice ? 'Neue Rechnung' : (orderId ? 'Angebot bearbeiten' : 'Neues Angebot')}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {isInvoice ? 'Erstellen Sie eine direkte Rechnung.' : 'Erstellen Sie ein detailliertes Umzugsangebot.'}
          </p>
        </div>
      </div>

      {/* 1. Kundeninformationen */}
      <section className="panel border-t-4 border-t-primary shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-white border-b border-structure pb-2">Kundeninformationen</h2>
        {!urlCustomerId && (
          <div className="mb-4 text-xs text-text-muted bg-bg-dark p-3 rounded-lg border border-structure">
            Der Kunde wird beim Speichern automatisch angelegt. Die Adresse wird aus der Beladeadresse übernommen.
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="col-span-1 md:grid-cols-2 lg:col-span-4 flex gap-4">
            <label className="flex items-center gap-2 text-white cursor-pointer"><input type="radio" checked={customerData.type === 'privat'} onChange={() => setCustomerData({...customerData, type:'privat'})} className="accent-primary" /> Privatperson</label>
            <label className="flex items-center gap-2 text-white cursor-pointer"><input type="radio" checked={customerData.type === 'firma'} onChange={() => setCustomerData({...customerData, type:'firma'})} className="accent-primary" /> Firma / Geschäftlich</label>
          </div>
          {customerData.type === 'privat' ? (
              <>
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
            <h3 className="text-sm font-semibold text-white mb-3">Hauptadresse des Kunden</h3>
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
          <h2 className="text-xl font-bold text-white flex items-center gap-2">Logistik & Route</h2>
          <div className="flex flex-wrap gap-2">
            <button 
              type="button"
              onClick={handleCalculateRoute}
              disabled={isCalculatingRoute}
              className="btn-primary py-1.5 px-3 text-sm flex items-center gap-2 shadow-lg"
            >
              🚚 {isCalculatingRoute ? "Berechne..." : "Route direkt berechnen"}
            </button>
            <a 
              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${logistics.a_street || ''} ${logistics.a_houseNr || ''}, ${logistics.a_zip || ''} ${logistics.a_city || ''}`)}&destination=${encodeURIComponent(`${logistics.b_street || ''} ${logistics.b_houseNr || ''}, ${logistics.b_zip || ''} ${logistics.b_city || ''}`)}`}
              target="_blank" 
              rel="noreferrer" 
              className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-2 border-primary/50 text-primary hover:bg-primary/10 shadow-lg"
              title="Google Maps Routenplanung öffnen"
            >
              📍 Auf Maps öffnen
            </a>
          </div>
        </div>
        
        {/* Direkte Entfernungsberechnung */}
        {(isCalculatingRoute || routeInfo || routeError) && (
          <div className={`border rounded-lg p-3 flex items-center justify-between text-sm animate-in fade-in duration-300 ${routeError ? 'bg-red-500/10 border-red-500/30' : 'bg-primary/10 border-primary/30'}`}>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚚</span>
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
            <h2 className="text-xl font-bold text-white flex items-center gap-2">Beladeadresse (A)</h2>
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
              <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={logistics.a_elevator} onChange={e => setLogistics({...logistics, a_elevator: e.target.checked})} className="accent-primary w-4 h-4" /> Aufzug</label>
              <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={logistics.a_parking} onChange={e => setLogistics({...logistics, a_parking: e.target.checked})} className="accent-primary w-4 h-4" /> Halteverbot</label>
              <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={logistics.a_furnitureLift} onChange={e => setLogistics({...logistics, a_furnitureLift: e.target.checked})} className="accent-primary w-4 h-4" /> Möbellift</label>
            </div>
          </div>
        </div>

        <div className="panel border-t-4 border-t-structure shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-structure pb-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">Entladeadresse (B)</h2>
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
              <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={logistics.b_elevator} onChange={e => setLogistics({...logistics, b_elevator: e.target.checked})} className="accent-primary w-4 h-4" /> Aufzug</label>
              <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={logistics.b_parking} onChange={e => setLogistics({...logistics, b_parking: e.target.checked})} className="accent-primary w-4 h-4" /> Halteverbot</label>
              <label className="flex items-center gap-2 text-white cursor-pointer"><input type="checkbox" checked={logistics.b_furnitureLift} onChange={e => setLogistics({...logistics, b_furnitureLift: e.target.checked})} className="accent-primary w-4 h-4" /> Möbellift</label>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Leistungen & Preise */}
      <section className="panel border-t-4 border-t-blue-500 shadow-lg">
        <div className="flex justify-between items-center mb-4 border-b border-structure pb-2">
          <h2 className="text-xl font-bold text-white">Leistungen & Preise</h2>
          <label className="flex items-center gap-2 bg-bg-dark px-3 py-1.5 rounded-lg border border-structure cursor-pointer">
            <input type="checkbox" checked={isFlatRate} onChange={e => setIsFlatRate(e.target.checked)} className="accent-primary" />
            <span className="text-sm font-medium text-white">Pauschalangebot</span>
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
                  {cat.items.map((item:any, i:number) => (
                    <button key={i} onClick={() => addServiceFromCatalog(item)} className="w-full text-left p-2 rounded hover:bg-structure/30 text-sm text-white flex justify-between items-center transition-colors">
                      <span className="truncate pr-2">{item.name}</span>
                      <PlusIcon className="w-4 h-4 text-primary shrink-0" />
                    </button>
                  ))}
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
                      const newSvc = [...services]; newSvc[idx].name = e.target.value; setServices(newSvc);
                    }} className="bg-transparent border-none w-full text-white focus:outline-none" /></td>
                    <td className="py-2"><input type="number" value={svc.quantity} onChange={e => {
                      const newSvc = [...services]; newSvc[idx].quantity = parseFloat(e.target.value)||0; setServices(newSvc);
                    }} className="input-field py-1 px-2 w-full text-center" min="1" /></td>
                    <td className="py-2"><input type="text" value={svc.unit} onChange={e => {
                      const newSvc = [...services]; newSvc[idx].unit = e.target.value; setServices(newSvc);
                    }} className="input-field py-1 px-2 w-full text-center" /></td>
                    
                    {!isFlatRate && <td className="py-2 text-right"><input type="number" value={svc.unitPrice} onChange={e => {
                      const newSvc = [...services]; newSvc[idx].unitPrice = parseFloat(e.target.value)||0; setServices(newSvc);
                    }} className="input-field py-1 px-2 w-full text-right" /></td>}
                    
                    {!isFlatRate && <td className="py-2 text-right text-primary font-medium">{(svc.quantity * svc.unitPrice).toFixed(2)}</td>}
                    
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
                    <input type="number" value={flatRateNet} onChange={e => setFlatRateNet(parseFloat(e.target.value)||0)} className="input-field w-full text-right font-bold text-lg" placeholder="0.00" />
                  </div>
                ) : null}
                
                <div className="flex justify-between text-text-muted text-sm">
                  <span>Summe Netto:</span><span>{totals.net.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-text-muted text-sm">
                  <span>MwSt. 19%:</span><span>{totals.tax.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-white font-bold text-lg border-t border-structure pt-2 mt-2">
                  <span>Gesamtbetrag:</span><span className="text-primary">{totals.gross.toFixed(2)} €</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MwSt.-Schnellrechner */}
      <section className="bg-bg-dark border border-structure p-4 rounded-xl flex items-center justify-between shadow-inner">
        <div className="flex items-center gap-3">
          <CalculatorIcon className="w-8 h-8 text-text-muted" />
          <div>
            <h3 className="font-bold text-white text-sm">MwSt.-Schnellrechner (19%)</h3>
            <p className="text-xs text-text-muted">Hilfswerkzeug (Wird nicht gespeichert)</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div><label className="block text-[10px] text-text-muted mb-1">Brutto (inkl. MwSt)</label><input type="number" value={calcInput.gross} onChange={e => handleCalcInput('gross', e.target.value)} className="input-field w-24 py-1 text-sm text-right font-bold text-white" /></div>
          <div><label className="block text-[10px] text-text-muted mb-1">Netto</label><input type="number" value={calcInput.net.toFixed(2)} onChange={e => handleCalcInput('net', e.target.value)} className="input-field w-24 py-1 text-sm text-right" /></div>
          <div><label className="block text-[10px] text-text-muted mb-1">MwSt (19%)</label><input type="text" readOnly value={calcInput.tax.toFixed(2)} className="input-field w-24 py-1 text-sm text-right opacity-50" /></div>
        </div>
      </section>

      {/* 5. Umzugsgut / Inventarliste */}
      <section className="panel border-t-4 border-t-structure shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-structure pb-2 gap-4">
          <h2 className="text-xl font-bold text-white">Umzugsgut / Inventarliste</h2>
          <label className="flex items-center gap-2 bg-bg-dark px-3 py-1.5 rounded-lg border border-structure cursor-pointer">
            <input type="checkbox" checked={appendInventoryToPDF} onChange={e => setAppendInventoryToPDF(e.target.checked)} className="accent-primary" />
            <span className="text-sm font-medium text-white">Als Anhang (letzte Seite) an Angebot hängen</span>
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
                  <th className="pb-2 w-20">Menge</th>
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
                      const newInv = [...inventory]; newInv[idx].name = e.target.value; setInventory(newInv);
                    }} className="bg-transparent border-none w-full text-white focus:outline-none placeholder:text-text-muted/30" placeholder="Bezeichnung..." /></td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => {
                          const newInv = [...inventory]; if (newInv[idx].quantity > 1) { newInv[idx].quantity -= 1; setInventory(newInv); }
                        }} className="bg-structure/50 hover:bg-primary/20 text-text-muted px-2 py-1 rounded-l transition-colors">-</button>
                        <input type="number" value={item.quantity === 0 ? '' : item.quantity} onChange={e => {
                          const newInv = [...inventory]; newInv[idx].quantity = e.target.value === '' ? 0 : parseInt(e.target.value); setInventory(newInv);
                        }} className="input-field py-1 w-12 text-center text-white rounded-none border-x-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" min="1" />
                        <button type="button" onClick={() => {
                          const newInv = [...inventory]; newInv[idx].quantity += 1; setInventory(newInv);
                        }} className="bg-structure/50 hover:bg-primary/20 text-text-muted px-2 py-1 rounded-r transition-colors">+</button>
                      </div>
                    </td>
                    <td className="py-2 flex items-center gap-2">
                      <input type="text" value={item.note} onChange={e => {
                        const newInv = [...inventory]; newInv[idx].note = e.target.value; setInventory(newInv);
                      }} className="bg-transparent border-none w-full text-text-muted focus:outline-none text-xs" placeholder="..." />
                      {item.note && (
                        <button 
                          title={item.showNoteInPdf === false ? "Notiz wird im PDF versteckt" : "Notiz ist im PDF sichtbar"}
                          onClick={() => {
                            const newInv = [...inventory]; 
                            newInv[idx].showNoteInPdf = item.showNoteInPdf === false ? true : false; 
                            setInventory(newInv);
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
        <h2 className="text-xl font-bold mb-4 text-white border-b border-structure pb-2">Mitarbeiter-Checkliste</h2>
        <p className="text-sm text-text-muted mb-4">
          Diese Liste taucht automatisch auf dem Mitarbeiter-Laufzettel auf. Logistik-Auswahlen wie "Halteverbot" oder "Möbellift" werden dort ebenfalls automatisch angezeigt und müssen hier nicht doppelt eingetragen werden.
        </p>
        <div className="space-y-2 mb-4">
          {checklist.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border bg-bg-dark border-structure hover:border-primary/50 transition-colors">
              <button onClick={() => setChecklist(checklist.map(c => c.id === item.id ? { ...c, done: !c.done } : c))} className="flex items-center gap-3 flex-1 text-left">
                {item.done ? <CheckCircleIconSolid className="w-5 h-5 text-primary shrink-0" /> : <CheckCircleIcon className="w-5 h-5 text-text-muted shrink-0" />}
                <span className={`text-sm font-medium transition-all ${item.done ? 'text-text-muted line-through' : 'text-white'}`}>{item.text}</span>
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
          <h2 className="text-xl font-bold text-white flex items-center gap-2"><DocumentTextIcon className="w-6 h-6 text-text-muted"/> Dokumententexte & Bedingungen</h2>
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
          <button onClick={() => saveOrder('draft')} disabled={isSaving} className="btn-secondary">
            {isSaving ? '...' : 'Abbrechen'}
          </button>
          <button onClick={() => saveOrder(isInvoice ? 'invoice_open' : 'quote')} disabled={isSaving} className="btn-primary shadow-lg shadow-primary/30 flex items-center gap-2">
            {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isSaving ? 'Speichert...' : (isInvoice ? 'Als Rechnung speichern' : 'Speichern')}
          </button>
        </div>
      </div>
    </div>
  );
}
