"use client";

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { getCol } from '@/lib/demoMode';
import SignatureCanvas from 'react-signature-canvas';
import { 
  ChevronRightIcon, 
  ChevronLeftIcon, 
  CheckCircleIcon,
  XMarkIcon,
  MapPinIcon,
  TruckIcon,
  ClipboardDocumentListIcon,
  PencilIcon,
  BanknotesIcon,
  DocumentTextIcon,
  CalendarIcon,
  TrashIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';

const ROOMS = ['Wohnzimmer', 'Schlafzimmer', 'Kinderzimmer', 'Küche', 'Bad', 'Flur/Keller'];
const INVENTORY_ITEMS = {
  'Wohnzimmer': ['Sofa 2er', 'Sofa 3er', 'Ecksofa', 'Sessel', 'Couchtisch', 'TV-Board', 'Fernseher', 'Regal', 'Teppich', 'Umzugskarton'],
  'Schlafzimmer': ['Bett (Einzel)', 'Bett (Doppel)', 'Nachttisch', 'Kleiderschrank (2-türig)', 'Kleiderschrank (3-türig)', 'Kommode', 'Spiegel', 'Umzugskarton', 'Kleiderbox'],
  'Kinderzimmer': ['Kinderbett', 'Schreibtisch', 'Schreibtischstuhl', 'Spielzeugkiste', 'Regal klein', 'Umzugskarton'],
  'Küche': ['Esstisch', 'Stuhl', 'Kühlschrank', 'Gefrierschrank', 'Spülmaschine', 'Herd', 'Waschmaschine', 'Küchenschrank', 'Umzugskarton'],
  'Bad': ['Badschrank', 'Spiegelschrank', 'Waschmaschine', 'Trockner', 'Wäschekorb', 'Umzugskarton'],
  'Flur/Keller': ['Schuhschrank', 'Garderobe', 'Fahrrad', 'Reifen (Satz)', 'Werkzeugkasten', 'Bücherkarton', 'Umzugskarton']
};

export function MobileInspectionWizard({ orderId, onClose }: { orderId?: string, onClose?: () => void }) {
  const { profile } = useAuth();
  const params = useParams();
  const router = useRouter();
  const urlCustomerId = params.id as string;
  
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const sigCanvas = useRef<any>(null);
  const [settings, setSettings] = useState<any>(null);

  // --- STATES ---
  // 1. Kunde
  const [customer, setCustomer] = useState({ 
    type: 'privat', salutation: '', firstName: '', lastName: '', phone: '', email: '', source: '',
    street: '', houseNr: '', zip: '', city: ''
  });
  
  // 2. Termine
  const [orderMeta, setOrderMeta] = useState({
    movingDateFrom: '', movingDateTo: '', validUntil: '', manager: '', paymentMethod: '', viewingDate: ''
  });

  // 3. Logistik
  const [logistics, setLogistics] = useState({
    a_street: '', a_houseNr: '', a_zip: '', a_city: '', a_floor: 'Erdgeschoss', a_elevator: false, a_parking: false, a_furnitureLift: false, a_distance: 0,
    b_street: '', b_houseNr: '', b_zip: '', b_city: '', b_floor: 'Erdgeschoss', b_elevator: false, b_parking: false, b_furnitureLift: false, b_distance: 0,
  });

  // 4. Inventar
  const [inventory, setInventory] = useState<{id: string, name: string, quantity: number, note: string, room: string}[]>([]);
  const [activeRoom, setActiveRoom] = useState(ROOMS[0]);
  const [appendInventoryToPDF, setAppendInventoryToPDF] = useState(false);

  // 5. Leistungen & Preise
  const [isFlatRate, setIsFlatRate] = useState(true);
  const [flatRateNet, setFlatRateNet] = useState(0);
  const [services, setServices] = useState<{ id: string, name: string, quantity: number, unitPrice: number, unit: string }[]>([]);

  // 6. Texte & Checkliste
  const [texts, setTexts] = useState({ quoteIntro: '', paymentTerms: '', quoteOutro: '' });
  const [checklist, setChecklist] = useState<{ id: string, text: string, done: boolean }[]>([]);

  // LOAD DATA
  useEffect(() => {
    getDoc(doc(db, getCol('system'), 'settings')).then(snap => {
      if(snap.exists()) {
        const s = snap.data();
        setSettings(s);
        if (!orderId) {
          const days = parseInt(s.quoteValidDays) || 14;
          const validDate = new Date();
          validDate.setDate(validDate.getDate() + days);
          setOrderMeta(prev => ({ 
            ...prev, manager: s.contacts?.[0] || '', paymentMethod: s.paymentMethods?.[0]?.name || '', validUntil: validDate.toISOString().split('T')[0]
          }));
          setTexts({ quoteIntro: s.texts?.quoteIntro || '', paymentTerms: s.paymentMethods?.[0]?.textQuote || '', quoteOutro: s.texts?.quoteGreeting || '' });
        }
      }
    });

    if (orderId) {
      getDoc(doc(db, getCol('orders'), orderId)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.billingAddress) {
            setCustomer(prev => ({ ...prev, ...data.billingAddress, source: data.customerSource || '' }));
          }
          if (data.orderMeta) setOrderMeta(prev => ({ ...prev, ...data.orderMeta }));
          if (data.logistics) setLogistics(prev => ({ ...prev, ...data.logistics }));
          if (data.inventory) setInventory(data.inventory.map((i:any) => ({ ...i, room: i.room || 'Flur/Keller' })));
          
          setIsFlatRate(data.isFlatRate !== undefined ? data.isFlatRate : true);
          setFlatRateNet(data.flatRateNet || 0);
          if (data.services) setServices(data.services);
          if (data.texts) setTexts(prev => ({ ...prev, ...data.texts }));
          if (data.checklist) setChecklist(data.checklist);
          if (data.appendInventoryToPDF !== undefined) setAppendInventoryToPDF(data.appendInventoryToPDF);
        }
      });
    } else if (urlCustomerId) {
      getDoc(doc(db, getCol('customers'), urlCustomerId)).then(docSnap => {
        if (docSnap.exists()) {
          const c = docSnap.data();
          setCustomer(prev => ({
            ...prev, type: c.type || 'privat', salutation: c.salutation || '', firstName: c.firstName || '', lastName: c.lastName || '', phone: c.phone || '', email: c.email || '', source: c.source || '',
            street: c.street || '', houseNr: c.houseNr || '', zip: c.zip || '', city: c.city || ''
          }));
          setLogistics(prev => ({
            ...prev, a_street: c.street || '', a_houseNr: c.houseNr || '', a_zip: c.zip || '', a_city: c.city || ''
          }));
        }
      });
    }
  }, [orderId, urlCustomerId]);

  const updateInventory = (room: string, itemName: string, delta: number) => {
    setInventory(prev => {
      const existing = prev.find(i => i.name === itemName && i.room === room);
      if (existing) {
        const newQuant = existing.quantity + delta;
        if (newQuant <= 0) return prev.filter(i => i.id !== existing.id);
        return prev.map(i => i.id === existing.id ? { ...i, quantity: newQuant } : i);
      } else if (delta > 0) {
        return [...prev, { id: Date.now().toString(), name: itemName, quantity: delta, note: '', room }];
      }
      return prev;
    });
  };

  const getItemQuantity = (room: string, itemName: string) => inventory.find(i => i.name === itemName && i.room === room)?.quantity || 0;

  const addServiceFromCatalog = (item: any) => {
    setServices([...services, { id: Date.now().toString(), name: item.name, quantity: 1, unitPrice: item.price || 0, unit: item.unit || 'Stk' }]);
  };

  const totals = React.useMemo(() => {
    let net = isFlatRate ? flatRateNet : services.reduce((sum, s) => sum + ((s.quantity||0) * (s.unitPrice||0)), 0);
    const tax = net * 0.19;
    return { net, tax, gross: net + tax };
  }, [isFlatRate, flatRateNet, services]);

  const saveOrder = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Speichern fehlgeschlagen: Du bist offline! Bitte warte auf eine Internetverbindung.', { duration: 5000 });
      return;
    }

    if (!customer.lastName) {
      toast.error("Nachname des Kunden ist ein Pflichtfeld.");
      setStep(1); return;
    }

    setIsSaving(true);
    const toastId = toast.loading("Speichere Daten in der Cloud...");
    try {
      let signatureBase64 = null;
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        signatureBase64 = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      }

      let finalCustomerId = urlCustomerId;
      if (!finalCustomerId) {
        const cRef = await addDoc(collection(db, getCol('customers')), { 
          ...customer, createdAt: serverTimestamp(), createdBy: profile?.displayName || 'Außendienst' 
        });
        finalCustomerId = cRef.id;
      }

      const payload: any = {
        customerId: finalCustomerId,
        customerName: customer.type === 'firma' ? customer.lastName : `${customer.firstName} ${customer.lastName}`.trim(),
        billingAddress: customer,
        customerSource: customer.source || 'Unbekannt',
        logistics,
        orderMeta,
        viewingDate: orderMeta.viewingDate || '',
        inventory: inventory.map(i => ({ ...i, showNoteInPdf: true })),
        appendInventoryToPDF,
        isFlatRate,
        flatRateNet,
        services,
        texts,
        checklist,
        totals,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.displayName || 'Außendienst',
      };

      if (signatureBase64) {
        payload.customerSignature = signatureBase64;
        payload.signatureDate = serverTimestamp();
      }

      if (orderId) {
        await updateDoc(doc(db, getCol('orders'), orderId), payload);
        toast.success("Besichtigung erfolgreich und sicher aktualisiert!", { id: toastId });
      } else {
        payload.status = 'draft';
        payload.orderNumber = settings?.nextQuoteNumber ? `ANG-${new Date().getFullYear()}-${settings.nextQuoteNumber}` : `ANG-${Date.now()}`;
        payload.createdAt = serverTimestamp();
        payload.createdBy = profile?.displayName || 'Außendienst';
        
        await addDoc(collection(db, getCol('orders')), payload);
        if (settings?.nextQuoteNumber) {
          await updateDoc(doc(db, getCol('system'), 'settings'), { nextQuoteNumber: settings.nextQuoteNumber + 1 });
        }
        toast.success("Besichtigung erfolgreich und sicher gespeichert!", { id: toastId });
      }
      
      if (onClose) onClose();
      else router.push(`/dashboard/customers/${finalCustomerId}`);
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Speichern. Bitte überprüfe deine Internetverbindung.", { id: toastId, duration: 5000 });
    } finally {
      setIsSaving(false);
    }
  };

  const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0);

  const STEPS = [
    { s: 1, icon: MapPinIcon, title: "Kunde" },
    { s: 2, icon: CalendarIcon, title: "Termine" },
    { s: 3, icon: TruckIcon, title: "Logistik" },
    { s: 4, icon: ClipboardDocumentListIcon, title: "Inventar" },
    { s: 5, icon: BanknotesIcon, title: "Preise" },
    { s: 6, icon: DocumentTextIcon, title: "Texte" },
    { s: 7, icon: PencilIcon, title: "Unterschrift" }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-bg-dark flex flex-col md:flex-row animate-in slide-in-from-bottom-full duration-300">
      <div className="bg-bg-panel border-r border-b md:border-b-0 border-structure w-full md:w-64 p-4 shrink-0 flex flex-row md:flex-col justify-between overflow-x-auto custom-scrollbar">
        <div className="flex md:flex-col gap-2 md:gap-4 w-max md:w-full">
          {STEPS.map((item) => (
            <button key={item.s} onClick={() => setStep(item.s)} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-medium text-sm text-left whitespace-nowrap md:whitespace-normal ${step === item.s ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-text-muted hover:bg-structure/50'} ${step > item.s ? 'border border-primary/50 text-primary bg-primary/10' : ''}`}>
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline">{item.title}</span>
              <span className="md:hidden">{item.s}.</span>
            </button>
          ))}
        </div>
        {onClose && <button onClick={onClose} className="mt-auto hidden md:flex items-center gap-2 text-text-muted hover:text-red-400 p-3 rounded-xl transition-colors"><XMarkIcon className="w-5 h-5" /> Schließen</button>}
      </div>

      <div className="flex-1 overflow-y-auto bg-bg-dark relative flex flex-col custom-scrollbar">
        {onClose && <button onClick={onClose} className="md:hidden absolute top-4 right-4 z-10 p-2 bg-structure/50 rounded-full text-text-main"><XMarkIcon className="w-5 h-5" /></button>}

        <div className="p-4 md:p-8 lg:p-12 max-w-4xl mx-auto w-full flex-1">
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <h1 className="text-2xl font-bold text-text-main mb-6">Kunde & Rechnungsadresse</h1>
              <div className="flex gap-4 bg-bg-panel p-2 rounded-xl border border-structure w-max mb-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={customer.type === 'privat'} onChange={() => setCustomer({...customer, type: 'privat'})} className="accent-primary" /> Privatperson</label>
                <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={customer.type === 'firma'} onChange={() => setCustomer({...customer, type: 'firma'})} className="accent-primary" /> Firma / Amt</label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customer.type === 'privat' ? (
                  <>
                    <div><label className="block text-sm text-text-muted mb-2">Anrede</label><select value={customer.salutation} onChange={e => setCustomer({...customer, salutation: e.target.value})} className="input-field w-full text-lg py-3"><option value="">Keine</option><option value="Herr">Herr</option><option value="Frau">Frau</option></select></div>
                    <div><label className="block text-sm text-text-muted mb-2">Vorname</label><input type="text" value={customer.firstName} onChange={e => setCustomer({...customer, firstName: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                    <div><label className="block text-sm text-text-muted mb-2">Nachname *</label><input type="text" value={customer.lastName} onChange={e => setCustomer({...customer, lastName: e.target.value})} className="input-field w-full text-lg py-3 border-primary/50" /></div>
                  </>
                ) : (
                  <>
                    <div className="md:col-span-2"><label className="block text-sm text-text-muted mb-2">Firmenname *</label><input type="text" value={customer.lastName} onChange={e => setCustomer({...customer, lastName: e.target.value})} className="input-field w-full text-lg py-3 border-primary/50" /></div>
                    <div className="md:col-span-2"><label className="block text-sm text-text-muted mb-2">Ansprechpartner (Vor- & Nachname)</label><input type="text" value={customer.firstName} onChange={e => setCustomer({...customer, firstName: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  </>
                )}
                <div><label className="block text-sm text-text-muted mb-2">Telefon</label><input type="tel" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                <div><label className="block text-sm text-text-muted mb-2">E-Mail</label><input type="email" value={customer.email} onChange={e => setCustomer({...customer, email: e.target.value})} className="input-field w-full text-lg py-3" /></div>
              </div>

              <div className="mt-8 border-t border-structure pt-6">
                <h3 className="text-lg font-bold text-text-main mb-4">Rechnungsadresse</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3"><label className="block text-sm text-text-muted mb-2">Straße</label><input type="text" value={customer.street} onChange={e => setCustomer({...customer, street: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">Nr.</label><input type="text" value={customer.houseNr} onChange={e => setCustomer({...customer, houseNr: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">PLZ</label><input type="text" value={customer.zip} onChange={e => setCustomer({...customer, zip: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  <div className="col-span-3"><label className="block text-sm text-text-muted mb-2">Ort</label><input type="text" value={customer.city} onChange={e => setCustomer({...customer, city: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <h1 className="text-2xl font-bold text-text-main mb-6">Termine</h1>
              <div className="bg-bg-panel border border-structure rounded-2xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div><label className="block text-sm text-text-muted mb-2">Besichtigung am</label><input type="datetime-local" value={orderMeta.viewingDate} onChange={e => setOrderMeta({...orderMeta, viewingDate: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  <div><label className="block text-sm text-text-muted mb-2">Angebot gültig bis</label><input type="date" value={orderMeta.validUntil} onChange={e => setOrderMeta({...orderMeta, validUntil: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  <div><label className="block text-sm text-text-muted mb-2">Umzugstermin (Wunsch) von</label><input type="date" value={orderMeta.movingDateFrom} onChange={e => setOrderMeta({...orderMeta, movingDateFrom: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  <div><label className="block text-sm text-text-muted mb-2">Umzugstermin (Wunsch) bis</label><input type="date" value={orderMeta.movingDateTo} onChange={e => setOrderMeta({...orderMeta, movingDateTo: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <h1 className="text-2xl font-bold text-text-main mb-6">Logistik & Check</h1>
              
              <div className="bg-bg-panel p-5 rounded-2xl border border-structure shadow-lg mb-6">
                <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">Auszug <span className="text-text-muted text-sm font-normal">(Beladeadresse)</span></h3>
                <div className="space-y-4">
                  <div className="flex justify-end mb-2"><button onClick={() => setLogistics({...logistics, a_street: customer.street, a_houseNr: customer.houseNr, a_zip: customer.zip, a_city: customer.city})} className="text-xs text-primary hover:underline">Aus Rechnungsadresse übernehmen</button></div>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="col-span-3"><label className="block text-sm text-text-muted mb-2">Straße (A)</label><input type="text" value={logistics.a_street} onChange={e => setLogistics({...logistics, a_street: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                    <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">Nr.</label><input type="text" value={logistics.a_houseNr} onChange={e => setLogistics({...logistics, a_houseNr: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                    <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">PLZ</label><input type="text" value={logistics.a_zip} onChange={e => setLogistics({...logistics, a_zip: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                    <div className="col-span-3"><label className="block text-sm text-text-muted mb-2">Ort</label><input type="text" value={logistics.a_city} onChange={e => setLogistics({...logistics, a_city: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  </div>
                  <div><label className="block text-sm text-text-muted mb-2">Etage</label><select value={logistics.a_floor} onChange={e => setLogistics({...logistics, a_floor: e.target.value})} className="input-field w-full text-lg py-3"><option value="Erdgeschoss">Erdgeschoss</option><option value="1. OG">1. OG</option><option value="2. OG">2. OG</option><option value="3. OG">3. OG</option><option value="4. OG">4. OG</option><option value="5. OG +">5. OG oder höher</option></select></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${logistics.a_elevator ? 'border-primary bg-primary/10 text-primary' : 'border-structure bg-bg-dark text-text-muted'}`}><input type="checkbox" className="hidden" checked={logistics.a_elevator} onChange={e => setLogistics({...logistics, a_elevator: e.target.checked})} /><span className="font-bold">Aufzug</span></label>
                    <label className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${logistics.a_parking ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-structure bg-bg-dark text-text-muted'}`}><input type="checkbox" className="hidden" checked={logistics.a_parking} onChange={e => setLogistics({...logistics, a_parking: e.target.checked})} /><span className="font-bold">Halteverbot</span></label>
                    <label className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${logistics.a_furnitureLift ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-structure bg-bg-dark text-text-muted'}`}><input type="checkbox" className="hidden" checked={logistics.a_furnitureLift} onChange={e => setLogistics({...logistics, a_furnitureLift: e.target.checked})} /><span className="font-bold">Möbellift</span></label>
                  </div>
                </div>
              </div>

              <div className="bg-bg-panel p-5 rounded-2xl border border-structure shadow-lg">
                <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">Einzug <span className="text-text-muted text-sm font-normal">(Entladeadresse)</span></h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                     <div className="col-span-3"><label className="block text-sm text-text-muted mb-2">Straße (B)</label><input type="text" value={logistics.b_street} onChange={e => setLogistics({...logistics, b_street: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                    <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">Nr.</label><input type="text" value={logistics.b_houseNr} onChange={e => setLogistics({...logistics, b_houseNr: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                    <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">PLZ</label><input type="text" value={logistics.b_zip} onChange={e => setLogistics({...logistics, b_zip: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                    <div className="col-span-3"><label className="block text-sm text-text-muted mb-2">Ort</label><input type="text" value={logistics.b_city} onChange={e => setLogistics({...logistics, b_city: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  </div>
                  <div><label className="block text-sm text-text-muted mb-2">Etage (B)</label><select value={logistics.b_floor} onChange={e => setLogistics({...logistics, b_floor: e.target.value})} className="input-field w-full text-lg py-3"><option value="Erdgeschoss">Erdgeschoss</option><option value="1. OG">1. OG</option><option value="2. OG">2. OG</option><option value="3. OG">3. OG</option><option value="4. OG">4. OG</option></select></div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <label className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${logistics.b_elevator ? 'border-primary bg-primary/10 text-primary' : 'border-structure bg-bg-dark text-text-muted'}`}><input type="checkbox" className="hidden" checked={logistics.b_elevator} onChange={e => setLogistics({...logistics, b_elevator: e.target.checked})} /><span className="font-bold">Aufzug</span></label>
                    <label className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${logistics.b_parking ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-structure bg-bg-dark text-text-muted'}`}><input type="checkbox" className="hidden" checked={logistics.b_parking} onChange={e => setLogistics({...logistics, b_parking: e.target.checked})} /><span className="font-bold">Halteverbot</span></label>
                    <label className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${logistics.b_furnitureLift ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-structure bg-bg-dark text-text-muted'}`}><input type="checkbox" className="hidden" checked={logistics.b_furnitureLift} onChange={e => setLogistics({...logistics, b_furnitureLift: e.target.checked})} /><span className="font-bold">Möbellift</span></label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-4"><h1 className="text-2xl font-bold text-text-main">Umzugsgut</h1><div className="bg-primary/20 text-primary px-4 py-2 rounded-full font-bold">{totalItems} Teile</div></div>
              <div className="flex overflow-x-auto gap-2 pb-4 mb-4 border-b border-structure snap-x custom-scrollbar">
                {ROOMS.map(room => (
                  <button key={room} onClick={() => setActiveRoom(room)} className={`shrink-0 snap-start px-6 py-3 rounded-full font-bold text-sm transition-all ${activeRoom === room ? 'bg-primary text-white shadow-lg shadow-primary/40' : 'bg-bg-panel border border-structure text-text-muted hover:text-text-main'}`}>
                    {room}
                    {inventory.filter(i => i.room === room).length > 0 && <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">{inventory.filter(i => i.room === room).reduce((s, i) => s + i.quantity, 0)}</span>}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                {(INVENTORY_ITEMS[activeRoom as keyof typeof INVENTORY_ITEMS] || []).map(itemName => {
                  const qty = getItemQuantity(activeRoom, itemName);
                  return (
                    <div key={itemName} className={`p-4 rounded-2xl border transition-all ${qty > 0 ? 'border-primary bg-primary/5' : 'border-structure bg-bg-panel'}`}>
                      <div className="flex justify-between items-center mb-3"><span className={`font-semibold ${qty > 0 ? 'text-primary' : 'text-text-main'}`}>{itemName}</span></div>
                      <div className="flex items-center justify-between bg-bg-dark rounded-xl p-1 border border-structure">
                        <button onClick={() => updateInventory(activeRoom, itemName, -1)} className="w-12 h-12 flex items-center justify-center bg-structure hover:bg-structure/80 rounded-lg text-2xl font-bold text-text-main">-</button>
                        <span className="text-2xl font-bold w-12 text-center">{qty}</span>
                        <button onClick={() => updateInventory(activeRoom, itemName, 1)} className="w-12 h-12 flex items-center justify-center bg-primary text-white hover:bg-primary/90 rounded-lg text-2xl font-bold shadow-md">+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <h1 className="text-2xl font-bold text-text-main mb-6">Leistungen & Preise</h1>
              
              <div className="bg-bg-panel border border-structure p-5 rounded-2xl shadow-lg mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-text-main">Abrechnungsart</h3>
                  <label className="flex items-center gap-2 cursor-pointer bg-bg-dark p-2 rounded-lg border border-structure">
                    <span className="text-sm font-medium">Pauschalpreis</span>
                    <input type="checkbox" checked={isFlatRate} onChange={e => setIsFlatRate(e.target.checked)} className="accent-primary w-5 h-5" />
                  </label>
                </div>
                {isFlatRate && (
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Pauschalpreis Netto (€)</label>
                    <input type="number" value={flatRateNet} onChange={e => setFlatRateNet(parseFloat(e.target.value)||0)} className="input-field w-full text-2xl font-bold py-4 text-primary" placeholder="0.00" />
                  </div>
                )}
              </div>

              <div className="bg-bg-panel border border-structure rounded-2xl overflow-hidden shadow-lg">
                <div className="p-4 bg-bg-dark border-b border-structure flex justify-between items-center">
                  <h3 className="font-bold text-text-main">Positionen</h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-text-muted border-b border-structure bg-bg-dark/50">
                        <th className="p-3 w-8">#</th>
                        <th className="p-3">Beschreibung</th>
                        <th className="p-3 w-20">Menge</th>
                        <th className="p-3 w-20">Einh.</th>
                        {!isFlatRate && <th className="p-3 w-24 text-right">EP (€)</th>}
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {services.map((svc, idx) => (
                        <tr key={svc.id} className="border-b border-structure/30">
                          <td className="p-3 text-text-muted">{idx + 1}</td>
                          <td className="p-3"><input type="text" value={svc.name} onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))} className="bg-transparent border-b border-dashed border-structure/50 focus:border-primary w-full text-text-main outline-none py-1" /></td>
                          <td className="p-3"><input type="number" value={svc.quantity} onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: parseFloat(e.target.value) || 0 } : s))} className="input-field py-1 px-2 w-full text-center" /></td>
                          <td className="p-3"><input type="text" value={svc.unit} onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, unit: e.target.value } : s))} className="input-field py-1 px-2 w-full text-center" /></td>
                          {!isFlatRate && <td className="p-3 text-right"><input type="number" value={svc.unitPrice} onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, unitPrice: parseFloat(e.target.value) || 0 } : s))} className="input-field py-1 px-2 w-full text-right" /></td>}
                          <td className="p-3 text-right"><button onClick={() => setServices(services.filter(s => s.id !== svc.id))} className="text-text-muted hover:text-red-400 p-1"><TrashIcon className="w-5 h-5" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 bg-bg-dark flex justify-between items-center border-t border-structure">
                  <button onClick={() => setServices([...services, { id: Date.now().toString(), name: 'Neue Leistung', quantity: 1, unitPrice: 0, unit: 'Pausch.' }])} className="text-primary hover:underline font-medium text-sm flex items-center gap-1"><PlusIcon className="w-4 h-4" /> Leistung hinzufügen</button>
                </div>
              </div>

              {settings?.catalog && settings.catalog.length > 0 && (
                <div className="bg-bg-dark border border-structure p-4 rounded-xl mt-4">
                  <h4 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-3">Aus Katalog übernehmen</h4>
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {settings.catalog.map((cat:any) => cat.items.map((item:any, i:number) => (
                      <button key={i} onClick={() => addServiceFromCatalog(item)} className="shrink-0 bg-structure/30 hover:bg-primary/20 text-text-main px-3 py-1.5 rounded-lg text-sm border border-structure hover:border-primary/50 transition-colors whitespace-nowrap">
                        + {item.name}
                      </button>
                    )))}
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <div className="w-full md:w-72 bg-bg-panel p-5 rounded-2xl border border-structure shadow-lg">
                  <div className="flex justify-between text-text-muted mb-2"><span>Summe Netto:</span><span>{totals.net.toFixed(2)} €</span></div>
                  <div className="flex justify-between text-text-muted mb-4"><span>MwSt. 19%:</span><span>{totals.tax.toFixed(2)} €</span></div>
                  <div className="flex justify-between text-text-main font-bold text-xl border-t border-structure pt-4"><span>Gesamt:</span><span className="text-primary">{totals.gross.toFixed(2)} €</span></div>
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <h1 className="text-2xl font-bold text-text-main mb-6">Texte & Einstellungen</h1>
              <div className="bg-bg-panel border border-structure rounded-2xl p-6 mb-6">
                <h3 className="font-bold text-text-main mb-4">Einleitungstext</h3>
                <textarea value={texts.quoteIntro} onChange={e => setTexts({...texts, quoteIntro: e.target.value})} className="input-field w-full h-32 py-3" placeholder="Guten Tag..." />
              </div>
              <div className="bg-bg-panel border border-structure rounded-2xl p-6 mb-6">
                <h3 className="font-bold text-text-main mb-4">Zahlungsbedingungen</h3>
                <textarea value={texts.paymentTerms} onChange={e => setTexts({...texts, paymentTerms: e.target.value})} className="input-field w-full h-24 py-3" placeholder="Zahlbar sofort..." />
              </div>
              <div className="bg-bg-panel border border-structure rounded-2xl p-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={appendInventoryToPDF} onChange={e => setAppendInventoryToPDF(e.target.checked)} className="accent-primary w-6 h-6" />
                  <div>
                    <span className="font-bold text-text-main block">Inventarliste als Anlage anfügen</span>
                    <span className="text-xs text-text-muted">Druckt die erfassten Gegenstände auf die letzte Seite des PDFs.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <h1 className="text-2xl font-bold text-text-main mb-6">Abschluss & Unterschrift</h1>
              <div className="bg-bg-panel border border-structure rounded-2xl p-6 mb-6">
                <h3 className="font-bold text-text-main mb-2">Zusammenfassung</h3>
                <ul className="text-text-muted space-y-2 mb-4">
                  <li><strong>Kunde:</strong> {customer.firstName} {customer.lastName} ({customer.type})</li>
                  <li><strong>Von:</strong> {logistics.a_city} ({logistics.a_floor})</li>
                  <li><strong>Nach:</strong> {logistics.b_city} ({logistics.b_floor})</li>
                  <li><strong>Erfasste Gegenstände:</strong> {totalItems} Teile</li>
                  <li><strong>Angebotssumme:</strong> {totals.gross.toFixed(2)} € (Brutto)</li>
                </ul>
                <p className="text-xs text-text-muted italic">Der Kunde bestätigt hiermit die Richtigkeit der erfassten Daten für die Angebotserstellung.</p>
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-bold text-text-main">Unterschrift Kunde</label>
                <div className="bg-white rounded-2xl border-2 border-dashed border-primary/50 overflow-hidden shadow-inner">
                  <SignatureCanvas ref={sigCanvas} penColor="black" canvasProps={{className: 'w-full h-64'}} />
                </div>
                <button onClick={() => sigCanvas.current?.clear()} className="text-sm text-text-muted hover:text-red-400">Unterschrift löschen / Neu anfangen</button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-bg-panel border-t border-structure flex justify-between shrink-0 sticky bottom-0 z-20">
          <button onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className={`btn-secondary py-3 px-4 md:px-6 flex items-center gap-2 text-sm md:text-lg ${step === 1 ? 'opacity-0' : ''}`}><ChevronLeftIcon className="w-5 h-5" /> <span className="hidden md:inline">Zurück</span></button>
          {step < 7 ? (
            <button onClick={() => setStep(step + 1)} className="btn-primary py-3 px-6 md:px-8 flex items-center gap-2 text-sm md:text-lg shadow-lg">Weiter <ChevronRightIcon className="w-5 h-5" /></button>
          ) : (
            <button onClick={saveOrder} disabled={isSaving} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 md:px-8 rounded-xl shadow-lg shadow-green-600/30 flex items-center gap-2 text-sm md:text-lg transition-all">{isSaving ? 'Speichert...' : <><CheckCircleIcon className="w-6 h-6" /> <span className="hidden md:inline">Besichtigung abschließen</span><span className="md:hidden">Abschließen</span></>}</button>
          )}
        </div>
      </div>
    </div>
  );
}
