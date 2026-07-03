"use client";

import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, CalculatorIcon, DocumentTextIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon, TruckIcon, MapPinIcon, ExclamationTriangleIcon, StarIcon, BuildingOffice2Icon, HomeIcon, BriefcaseIcon, BuildingLibraryIcon, ArchiveBoxIcon, WrenchIcon, SparklesIcon, PlusCircleIcon, TagIcon, ArrowsUpDownIcon, NoSymbolIcon, ArrowUpTrayIcon, MagnifyingGlassIcon, ShoppingCartIcon, XMarkIcon } from '@heroicons/react/24/outline';
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
import { changeOrderStatus } from '@/lib/orderStateMachine';
import { InventoryWizardModal, ROOM_TYPES } from './InventoryWizardModal';

const getPropertyIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('wohnung')) return <BuildingOffice2Icon className="w-6 h-6 mb-1" />;
  if (t.includes('haus')) return <HomeIcon className="w-6 h-6 mb-1" />;
  if (t.includes('büro') || t.includes('buero')) return <BriefcaseIcon className="w-6 h-6 mb-1" />;
  return <BuildingLibraryIcon className="w-6 h-6 mb-1" />;
};

const getCategoryIcon = (category: string) => {
  const c = category.toLowerCase();
  if (c.includes('transport') || c.includes('grundlagen')) return <TruckIcon className="w-5 h-5" />;
  if (c.includes('verpack') || c.includes('karton') || c.includes('material')) return <ArchiveBoxIcon className="w-5 h-5" />;
  if (c.includes('montage') || c.includes('aufbau') || c.includes('abbau')) return <WrenchIcon className="w-5 h-5" />;
  if (c.includes('entsorgung') || c.includes('sperrmüll')) return <TrashIcon className="w-5 h-5" />;
  if (c.includes('reinigung') || c.includes('putz')) return <SparklesIcon className="w-5 h-5" />;
  if (c.includes('zuschlag') || c.includes('sonstig')) return <PlusCircleIcon className="w-5 h-5" />;
  return <TagIcon className="w-5 h-5" />;
};

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
  const [currentStep, setCurrentStep] = useState(1);

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
  const [catalogSearch, setCatalogSearch] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState('Alle');
  
  // 4. MwSt Rechner
  const [calcInput, setCalcInput] = useState({ gross: 0, net: 0, tax: 0 });

  // 5. Inventarliste
  const [inventory, setInventory] = useState<{ id: string, name: string, quantity: number, note: string, showNoteInPdf?: boolean, room?: string, disassembly?: number, assembly?: number, disconnection?: number, connection?: number }[]>([]);
  const [appendInventoryToPDF, setAppendInventoryToPDF] = useState(false);
  const [isInventoryWizardOpen, setIsInventoryWizardOpen] = useState(false);
  const [initialWizardRoom, setInitialWizardRoom] = useState<string | null>(null);
  
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
            // PRIORITIZE CUSTOMER PROFILE: The customer document is the single source of truth.
            // If it exists in the customer profile, it overwrites the old snapshot from the order.
            type: c.type || prev.type || 'privat',
            salutation: c.salutation || prev.salutation || '',
            firstName: c.firstName || prev.firstName || '',
            lastName: c.lastName || prev.lastName || '',
            email: c.email || prev.email || '',
            phone: c.phone || prev.phone || '',
            source: c.source || prev.source || '',
            customerContact: '',
            street: c.street || prev.street || '',
            houseNr: c.houseNr || prev.houseNr || '',
            zip: c.zip || prev.zip || '',
            city: c.city || prev.city || ''
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
    setServices(prev => {
      const existing = prev.find(s => s.name === service.name);
      if (existing) {
        return prev.map(s => s.name === service.name ? { ...s, quantity: s.quantity + 1 } : s);
      }
      return [...prev, { id: Date.now().toString() + Math.random(), name: service.name, quantity: 1, unitPrice: service.price || service.defaultPrice || 0, unit: service.unit || 'Stk' }];
    });
  };

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const saveOrder = async (status: 'draft' | 'quote' | 'invoice_open', generateQuote: boolean = false) => {
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
      
      // Update the main customer profile so that salutation and other details are persisted for future orders
      if (finalCustomerId) {
        await updateDoc(doc(db, getCol('customers'), finalCustomerId), {
          salutation: customerData.salutation || '',
          firstName: customerData.firstName || '',
          lastName: customerData.lastName || '',
          email: customerData.email || '',
          phone: customerData.phone || '',
          street: customerData.street || '',
          houseNr: customerData.houseNr || '',
          zip: customerData.zip || '',
          city: customerData.city || '',
          type: customerData.type || 'privat'
        });
      }

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
        
        if (generateQuote) {
          try {
            await changeOrderStatus(orderId, 'quote', { userId: profile?.uid });
          } catch (err: any) {
            toast.error(err.message || "Fehler bei der Angebotserstellung.");
          }
        }
      } else {
        const docRef = await addDoc(collection(db, getCol('orders')), { 
          ...payload, 
          createdAt: serverTimestamp(),
          createdBy: profile?.displayName || profile?.email || 'Unbekannt' 
        });
        await logActivity(profile?.uid || 'unknown', profile?.displayName || profile?.email || 'Unbekannt', 'CREATE_ORDER', `Angebot erstellt für Kunde ${payload.customerName}`);
        
        if (generateQuote) {
          try {
            await changeOrderStatus(docRef.id, 'quote', { userId: profile?.uid });
          } catch (err: any) {
            toast.error(err.message || "Fehler bei der Angebotserstellung.");
          }
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

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    
    if (distance > minSwipeDistance && currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    }
    if (distance < -minSwipeDistance && currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!settings) return <div className="p-12 text-center text-text-main">Lade Einstellungen...</div>;

  return (
    <div 
      className="space-y-8 animate-in fade-in duration-500 pb-32"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEndHandler}
    >
      <div className="flex justify-between items-center bg-bg-panel border border-structure p-4 rounded-xl shadow-lg mt-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            {isInvoice ? 'Neue Rechnung' : (orderId ? 'Angebot bearbeiten' : 'Neues Angebot')}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {isInvoice ? 'Erstellen Sie eine direkte Rechnung.' : 'Erstellen Sie ein detailliertes Umzugsangebot.'}
          </p>
        </div>
      </div>
      {/* Stepper Navigation */}
      <div className="glass-panel p-4 rounded-xl shadow-lg flex items-center justify-between overflow-x-auto custom-scrollbar gap-4">
        {[
          { step: 1, label: 'Kunde & Termine', icon: '1️⃣' },
          { step: 2, label: 'Logistik & Route', icon: '2️⃣' },
          { step: 3, label: 'Leistungen & Finanzen', icon: '3️⃣' },
          { step: 4, label: 'Inventar & Checkliste', icon: '4️⃣' },
          { step: 5, label: 'Abschluss & Dokumente', icon: '5️⃣' }
        ].map(s => (
          <button
            key={s.step}
            onClick={() => setCurrentStep(s.step)}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-lg transition-all ${currentStep === s.step ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-text-muted hover:bg-white/5 hover:text-text-main'}`}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </div>


      {currentStep === 1 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* 1. Kundeninformationen */}
      <section className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-primary shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-text-main border-b border-structure pb-2">Kundeninformationen</h2>
        {!urlCustomerId && (
          <div className="mb-4 text-xs text-text-muted bg-white/[0.02] p-3 rounded-lg border border-structure">
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
            <select value={customerData.source} onChange={e => setCustomerData({...customerData, source: e.target.value})} className="input-field w-full text-text-main">
              <option value="">Auswählen...</option>
              {settings.customerSources?.map((s:string) => <option key={s} value={s}>{s}</option>)}
            </select>
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
            <label className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span>Besichtigungstermin</span>
              {(orderMeta.viewingDate === 'requested' || orderMeta.viewingDate === '') && (
                <button type="button" onClick={() => setOrderMeta({...orderMeta, viewingDate: 'erledigt_fotos'})} className="text-primary hover:text-white underline">
                  Durch Fotos erledigt
                </button>
              )}
            </label>
            <input type="datetime-local" value={['requested', 'erledigt_fotos'].includes(orderMeta.viewingDate) ? '' : (orderMeta.viewingDate || '')} onChange={e => setOrderMeta({...orderMeta, viewingDate: e.target.value})} className="input-field w-full" />
            {orderMeta.viewingDate === 'erledigt_fotos' && (
              <p className="text-xs font-bold text-green-400 mt-1">✓ Erledigt durch Fotos/Inventarliste</p>
            )}
            {orderMeta.viewingDate === 'requested' && (
              <p className="text-xs font-bold text-orange-400 mt-1">Kunde hat Besichtigung angefragt!</p>
            )}
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

      
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
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

        <div className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-structure shadow-lg">
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
            
            <div className="col-span-4">
              <label className="block text-xs text-text-muted mb-2">Immobilienart</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {settings.propertyTypes?.map((pt:string) => (
                  <button 
                    key={pt} 
                    type="button" 
                    onClick={() => setLogistics({...logistics, a_type: pt})} 
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.a_type === pt ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-black/20 text-text-muted hover:border-white/30 hover:bg-black/40'}`}
                  >
                    {getPropertyIcon(pt)}
                    <span className="text-xs font-medium">{pt}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="col-span-4 mt-2">
              <label className="block text-xs text-text-muted mb-2">Besonderheiten (Auszug)</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button" 
                  onClick={() => setLogistics({...logistics, a_elevator: !logistics.a_elevator})} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.a_elevator ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <ArrowsUpDownIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Aufzug</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setLogistics({...logistics, a_parking: !logistics.a_parking})} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.a_parking ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <NoSymbolIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Halteverbot</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setLogistics({...logistics, a_furnitureLift: !logistics.a_furnitureLift})} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.a_furnitureLift ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <ArrowUpTrayIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Möbellift</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-structure shadow-lg">
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
            
            <div className="col-span-4">
              <label className="block text-xs text-text-muted mb-2">Immobilienart</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {settings.propertyTypes?.map((pt:string) => (
                  <button 
                    key={pt} 
                    type="button" 
                    onClick={() => setLogistics({...logistics, b_type: pt})} 
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.b_type === pt ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-black/20 text-text-muted hover:border-white/30 hover:bg-black/40'}`}
                  >
                    {getPropertyIcon(pt)}
                    <span className="text-xs font-medium">{pt}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="col-span-4 mt-2">
              <label className="block text-xs text-text-muted mb-2">Besonderheiten (Einzug)</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button" 
                  onClick={() => setLogistics({...logistics, b_elevator: !logistics.b_elevator})} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.b_elevator ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <ArrowsUpDownIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Aufzug</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setLogistics({...logistics, b_parking: !logistics.b_parking})} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.b_parking ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <NoSymbolIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Halteverbot</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setLogistics({...logistics, b_furnitureLift: !logistics.b_furnitureLift})} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.b_furnitureLift ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <ArrowUpTrayIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Möbellift</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* 3. Leistungen & Preise */}
      <section className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-blue-500 shadow-lg">
        <div className="flex justify-between items-center mb-6 border-b border-structure pb-4">
          <div>
             <h2 className="text-xl font-bold text-text-main">Leistungen & Preise</h2>
             <p className="text-sm text-text-muted mt-1">Klicken Sie auf Leistungen im Katalog, um sie hinzuzufügen.</p>
          </div>
          <label className={`flex items-center gap-2 bg-white/[0.02] px-3 py-1.5 rounded-lg border border-structure ${!canEditPrices ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
            <input type="checkbox" checked={isFlatRate} onChange={e => setIsFlatRate(e.target.checked)} disabled={!canEditPrices} className="accent-primary w-4 h-4" />
            <span className="text-sm font-medium text-text-main">Pauschalangebot (Nur Netto-Gesamtpreis)</span>
          </label>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* LEFT: POS-Style Catalog Grid */}
          <div className="w-full lg:w-1/2 flex flex-col gap-4 border-b lg:border-b-0 lg:border-r border-structure pb-8 lg:pb-0 pr-0 lg:pr-8">
            <div className="sticky top-4 space-y-4">
               {/* Search */}
               <div className="relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input type="text" placeholder="Leistungen suchen (z.B. Karton)..." value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)} className="input-field w-full pl-10 py-3 rounded-xl bg-black/20 shadow-inner" />
               </div>
               
               {/* Categories */}
               <div className="flex flex-wrap gap-2">
                 <button onClick={() => setActiveCategoryTab('Alle')} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeCategoryTab === 'Alle' ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-structure/50 text-text-muted hover:bg-structure'}`}>Alle</button>
                 {settings.catalog?.map((cat:any) => (
                   <button key={cat.category} onClick={() => setActiveCategoryTab(cat.category)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${activeCategoryTab === cat.category ? 'bg-primary text-white shadow-md shadow-primary/20' : 'bg-structure/50 text-text-muted hover:bg-structure'}`}>{cat.category}</button>
                 ))}
               </div>

               {/* Grid */}
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar pb-4 pr-2">
                 {settings.catalog?.flatMap((cat:any) => cat.items.map((item:any) => ({ ...item, category: cat.category }))).filter((item:any) => {
                    const matchesSearch = item.name.toLowerCase().includes(catalogSearch.toLowerCase());
                    const matchesCat = activeCategoryTab === 'Alle' || item.category === activeCategoryTab;
                    return matchesSearch && matchesCat;
                 }).map((item:any, idx:number) => {
                    const isTicketTrigger = ['karton', 'box', 'kartons', 'küche', 'kueche', 'einbau', 'montage', 'einpack', 'auspack', 'packservice', 'einräum', 'ausräum'].some(kw => item.name.toLowerCase().includes(kw));
                    return (
                     <button key={idx} onClick={() => addServiceFromCatalog(item)} className="bg-bg-dark border border-white/10 hover:border-primary hover:bg-primary/10 rounded-xl p-3 flex flex-col items-center text-center gap-2 transition-all active:scale-95 shadow-sm group relative">
                        {isTicketTrigger && <StarIconSolid className="w-3 h-3 text-orange-400 absolute top-2 right-2 drop-shadow-[0_0_5px_rgba(251,146,60,0.5)]" title="Erzeugt System-Ticket" />}
                        <div className="w-10 h-10 rounded-full bg-structure/50 text-primary flex items-center justify-center">
                          {getCategoryIcon(item.category)}
                        </div>
                        <span className="text-xs font-bold text-text-main line-clamp-2 leading-tight">{item.name}</span>
                        <div className="mt-auto w-full pt-2 border-t border-white/5 flex justify-between items-center">
                           <span className="text-[10px] text-text-muted">
                             {!isFlatRate && (item.price || item.defaultPrice || 0) > 0 ? `${(item.price || item.defaultPrice).toFixed(2)} €` : ''}
                           </span>
                           <PlusCircleIcon className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors" />
                        </div>
                     </button>
                   )
                 })}
               </div>
            </div>
          </div>

          {/* RIGHT: Selected Items */}
          <div className="w-full lg:w-1/2 flex flex-col">
            <h3 className="font-semibold text-text-main mb-3 flex justify-between items-center">
              <span>Ausgewählte Leistungen</span>
              <span className="text-xs text-text-muted bg-structure/50 px-2 py-1 rounded-full">{services.length} Positionen</span>
            </h3>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 flex-1">
               {services.length === 0 ? (
                 <div className="p-8 text-center text-text-muted border-2 border-dashed border-structure rounded-xl bg-white/[0.01]">
                   <div className="w-12 h-12 rounded-full bg-structure/50 mx-auto flex items-center justify-center mb-3">
                     <ShoppingCartIcon className="w-6 h-6" />
                   </div>
                   Keine Leistungen ausgewählt.<br/>Klicken Sie links auf Kacheln, um sie hinzuzufügen.
                 </div>
               ) : (
                 services.map((svc, idx) => (
                   <div key={svc.id} className="bg-bg-dark border border-white/5 rounded-xl p-3 flex flex-col gap-2 relative group hover:border-primary/30 transition-colors shadow-sm">
                     <button onClick={() => setServices(services.filter(s => s.id !== svc.id))} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600 z-10">
                       <XMarkIcon className="w-4 h-4" />
                     </button>
                     
                     <div className="flex justify-between gap-2">
                       <textarea 
                         value={svc.name} 
                         onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))} 
                         className="bg-transparent border border-transparent hover:border-structure focus:border-primary/50 focus:bg-black/20 rounded font-semibold text-sm w-full text-text-main focus:outline-none p-1 resize-none" 
                         rows={1}
                       />
                     </div>
                     
                     <div className="flex items-center justify-between gap-4 mt-1 border-t border-structure/50 pt-2">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1 bg-structure/50 rounded-lg p-1 border border-white/5 shrink-0">
                           <button onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: Math.max(0, s.quantity - 1) } : s))} className="w-6 h-6 flex items-center justify-center text-text-main hover:bg-white/10 rounded font-bold">-</button>
                           <input type="number" value={svc.quantity} onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: parseFloat(e.target.value) || 0 } : s))} className="w-10 text-center bg-transparent font-bold text-sm focus:outline-none" />
                           <button onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: s.quantity + 1 } : s))} className="w-6 h-6 flex items-center justify-center text-text-main hover:bg-white/10 rounded font-bold">+</button>
                        </div>
                        
                        <div className="w-16 shrink-0">
                           <input type="text" value={svc.unit} onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, unit: e.target.value } : s))} className="input-field py-1 px-2 w-full text-center text-xs text-text-muted" placeholder="Einheit" />
                        </div>
                        
                        {!isFlatRate && (
                          <div className="flex-1 flex justify-end items-center gap-1">
                            <input type="number" value={svc.unitPrice} onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, unitPrice: parseFloat(e.target.value) || 0 } : s))} disabled={!canEditPrices} className="input-field py-1 px-2 w-20 text-right text-xs" placeholder="0.00" />
                            <span className="text-text-muted text-xs">€/{svc.unit}</span>
                          </div>
                        )}
                        {!isFlatRate && (
                           <div className="text-right w-20 font-bold text-primary text-sm shrink-0">
                             {canViewPrices ? (svc.quantity * svc.unitPrice).toFixed(2) : '***'} €
                           </div>
                        )}
                     </div>
                   </div>
                 ))
               )}
               <button onClick={() => setServices([...services, { id: Date.now().toString(), name: 'Manuelle Leistung', quantity: 1, unitPrice: 0, unit: 'Pauschal' }])} className="w-full py-3 border-2 border-dashed border-structure rounded-xl text-primary hover:bg-primary/5 hover:border-primary/30 transition-colors flex items-center justify-center gap-2 text-sm font-semibold mt-2">
                 <PlusIcon className="w-4 h-4" /> Manuelle Leistung hinzufügen
               </button>
            </div>
            
            {/* Totals Section */}
            <div className="mt-auto pt-6 lg:border-t border-structure">
               <div className="flex justify-end">
                 <div className="w-full max-w-xs space-y-2 bg-bg-dark p-4 rounded-xl border border-white/5 shadow-inner">
                   {isFlatRate ? (
                     <div className="mb-2">
                       <label className="text-xs text-text-muted font-bold uppercase tracking-wider mb-1 block">Pauschalabrechnung (Netto)</label>
                       <div className="relative">
                          <input type="number" value={flatRateNet} onChange={e => setFlatRateNet(parseFloat(e.target.value)||0)} disabled={!canEditPrices} className={`input-field w-full text-right font-bold text-lg pr-8 ${!canEditPrices ? 'opacity-50 cursor-not-allowed' : ''}`} placeholder="0.00" />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-text-muted">€</span>
                       </div>
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
                       <div className="flex justify-between text-text-main font-bold text-lg border-t border-white/10 pt-2 mt-2">
                         <span>Gesamtbetrag:</span><span className="text-primary">{totals.gross.toFixed(2)} €</span>
                       </div>
                     </>
                   ) : (
                     <div className="text-center text-text-muted text-sm italic py-2">
                       Preise ausgeblendet
                     </div>
                   )}
                 </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. MwSt.-Schnellrechner */}
      {canViewPrices && (
        <section className="bg-white/[0.02] border border-structure p-4 rounded-xl flex items-center justify-between shadow-inner">
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

      
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* 5. Umzugsgut / Inventarliste */}
      <section className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-structure shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b border-structure pb-2 gap-4">
          <h2 className="text-xl font-bold text-text-main">Umzugsgut / Inventarliste</h2>
          <label className="flex items-center gap-2 bg-white/[0.02] px-3 py-1.5 rounded-lg border border-structure cursor-pointer">
            <input type="checkbox" checked={appendInventoryToPDF} onChange={e => setAppendInventoryToPDF(e.target.checked)} className="accent-primary" />
            <span className="text-sm font-medium text-text-main">Als Anhang (letzte Seite) an Angebot hängen</span>
          </label>
        </div>
        <div className="flex flex-col gap-8">
          <div className="w-full bg-white/[0.02] border border-structure p-6 rounded-xl shadow-inner">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-bold text-text-main flex items-center gap-2 text-lg">
                  <ArchiveBoxIcon className="w-6 h-6 text-primary" /> Inventar-Assistent
                </h3>
                <p className="text-sm text-text-muted mt-1">
                  Klicken Sie auf einen Raum, um direkt mit der Erfassung zu beginnen.
                </p>
              </div>
              <button 
                onClick={() => { setInitialWizardRoom(null); setIsInventoryWizardOpen(true); }} 
                className="bg-primary hover:bg-primary-hover text-white font-semibold px-6 py-3 rounded-lg transition-all shadow-lg flex items-center gap-2 shadow-primary/20 shrink-0"
              >
                <PlusIcon className="w-5 h-5 font-bold" /> Assistent starten
              </button>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3">
              {ROOM_TYPES.slice(0, 8).map(room => (
                <button
                  key={room.id}
                  onClick={() => { setInitialWizardRoom(room.id); setIsInventoryWizardOpen(true); }}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-structure bg-bg-dark hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                >
                  <room.icon className="w-6 h-6 text-text-muted group-hover:text-primary mb-2 transition-colors" />
                  <span className="text-xs font-medium text-text-main text-center">{room.name}</span>
                </button>
              ))}
            </div>
          </div>
          
          <div className="w-full">
            <h3 className="font-semibold text-text-main mb-3">Erfasstes Umzugsgut</h3>
            <div className="glass-panel rounded-xl border border-white/5 overflow-x-auto shadow-inner bg-black/10">
              <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                <thead>
                  <tr className="text-text-muted border-b border-structure bg-white/[0.02] text-xs uppercase tracking-wider">
                    <th className="p-3 pl-4">Möbelliste</th>
                    <th className="p-3 w-1/3">Service</th>
                    <th className="p-3 w-24 text-center">Stück</th>
                    <th className="p-3 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-text-muted">
                        Keine Gegenstände erfasst. Nutzen Sie den Assistenten.
                      </td>
                    </tr>
                  ) : (
                    Object.entries(
                      inventory.reduce((acc, item) => {
                        const room = item.room || 'Allgemein';
                        if (!acc[room]) acc[room] = [];
                        acc[room].push(item);
                        return acc;
                      }, {} as Record<string, typeof inventory>)
                    ).map(([room, items], rIdx) => (
                      <React.Fragment key={room}>
                        <tr className="bg-white/[0.02] border-b border-structure">
                          <td colSpan={4} className="p-2 pl-4">
                            <div className="flex items-center gap-2">
                              <HomeIcon className="w-4 h-4 text-primary" />
                              <span className="font-bold text-text-main text-xs uppercase">{room}</span>
                            </div>
                          </td>
                        </tr>
                        {items.map(item => (
                          <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                            <td className="p-3 pl-4">
                              <div className="font-medium text-text-main">{item.name}</div>
                              {item.note && <div className="text-xs text-text-muted mt-1">{item.note}</div>}
                            </td>
                            <td className="p-3 text-text-muted">
                              {[
                                item.disassembly ? `${item.disassembly}x Abbau` : null,
                                item.assembly ? `${item.assembly}x Aufbau` : null,
                                item.disconnection ? `${item.disconnection}x Abklemmen` : null,
                                item.connection ? `${item.connection}x Anschluss` : null
                              ].filter(Boolean).join(' | ')}
                            </td>
                            <td className="p-3 text-center">
                              <span className="font-semibold text-text-main">{item.quantity}</span>
                            </td>
                            <td className="p-3 text-center">
                              <button onClick={() => setInventory(inventory.filter(i => i.id !== item.id))} className="w-8 h-8 rounded-full bg-transparent hover:bg-red-500/10 text-text-muted hover:text-red-400 flex items-center justify-center transition-colors mx-auto opacity-0 group-hover:opacity-100 focus:opacity-100">
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Mitarbeiter-Checkliste */}
      <section className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-orange-500 shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-text-main border-b border-structure pb-2">Mitarbeiter-Checkliste</h2>
        <p className="text-sm text-text-muted mb-4">
          Diese Liste taucht automatisch auf dem Mitarbeiter-Laufzettel auf. Logistik-Auswahlen wie "Halteverbot" oder "Möbellift" werden dort ebenfalls automatisch angezeigt und müssen hier nicht doppelt eingetragen werden.
        </p>
        <div className="space-y-2 mb-4">
          {checklist.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border bg-white/[0.02] border-structure hover:border-primary/50 transition-colors">
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

      
        </div>
      )}

      {currentStep === 5 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* 6. Dokumententexte & Bedingungen */}
      <section className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-structure shadow-lg">
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

      
        </div>
      )}
{/* Floating Save Button */}
      <div className="fixed bottom-16 mb-[env(safe-area-inset-bottom)] md:mb-0 md:bottom-0 left-0 right-0 md:left-64 bg-bg-panel/90 backdrop-blur-md border-t border-structure p-4 flex justify-between items-center z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.3)] px-4 lg:px-8">
        <div>
          {errorMessage && <span className="text-red-400 text-sm font-semibold animate-in fade-in slide-in-from-bottom-4 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">{errorMessage}</span>}
        </div>
        <div className="flex justify-end gap-2 sm:gap-4 flex-wrap">
          <button onClick={() => {
            if (urlCustomerId) router.push(`/dashboard/customers/${urlCustomerId}`);
            else router.push('/dashboard/orders');
          }} disabled={isSaving} className="btn-secondary hidden sm:flex text-xs sm:text-sm px-2 sm:px-4">
            Abbrechen
          </button>
          
          <button onClick={() => saveOrder(isInvoice ? 'invoice_open' : 'draft', false)} disabled={isSaving} className={`btn-secondary flex items-center gap-2 text-xs sm:text-sm px-3 sm:px-4`}>
            {isSaving && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {isSaving ? 'Speichert...' : (isInvoice ? 'Als Rechnung speichern' : 'Speichern')}
          </button>
          
          {currentStep === 5 && !isInvoice && orderStatus === 'draft' && (
            <button 
              onClick={() => {
                if (services.length === 0 && !confirm("Es sind keine Leistungen erfasst — trotzdem erstellen?")) return;
                saveOrder('draft', true);
              }} 
              disabled={isSaving} 
              className="btn-primary shadow-lg shadow-primary/30 flex items-center gap-2 text-xs sm:text-sm px-3 sm:px-4"
            >
              Angebot erstellen
            </button>
          )}

          {currentStep > 1 && (
            <button onClick={() => setCurrentStep(prev => prev - 1)} disabled={isSaving} className="btn-secondary hidden sm:flex text-xs sm:text-sm px-3 sm:px-4">
              Zurück
            </button>
          )}
          {currentStep < 5 && (
            <button onClick={() => setCurrentStep(prev => prev + 1)} disabled={isSaving} className="btn-primary flex items-center gap-2 shadow-lg shadow-primary/30 text-xs sm:text-sm px-3 sm:px-4">
              Weiter
            </button>
          )}
        </div>
      </div>
      <InventoryWizardModal 
        isOpen={isInventoryWizardOpen}
        onClose={() => {
          setIsInventoryWizardOpen(false);
          // Small timeout to prevent UI flicker while modal closes
          setTimeout(() => setInitialWizardRoom(null), 300);
        }}
        inventory={inventory}
        setInventory={setInventory}
        initialRoomId={initialWizardRoom}
      />
    </div>
  );
}
