"use client";

import React, { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
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
  PlusIcon,
  PlusCircleIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowsUpDownIcon,
  NoSymbolIcon,
  ArrowUpTrayIcon,
  BuildingOffice2Icon,
  HomeIcon,
  BriefcaseIcon,
  BuildingLibraryIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { FLOOR_OPTIONS } from '@/lib/constants';

const getPropertyIcon = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('wohnung')) return <BuildingOffice2Icon className="w-6 h-6 mb-1" />;
  if (t.includes('haus')) return <HomeIcon className="w-6 h-6 mb-1" />;
  if (t.includes('büro') || t.includes('buero')) return <BriefcaseIcon className="w-6 h-6 mb-1" />;
  return <BuildingLibraryIcon className="w-6 h-6 mb-1" />;
};

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
  const [orderMeta, setOrderMeta] = useState<any>({
    movingDateFrom: '', movingDateTo: '', validUntil: '', manager: '', paymentMethod: '', viewingDate: '', viewingTime: '',
    hvzMethod: 'selbst', hvzMethodA: 'selbst', hvzMethodB: 'selbst', hvzLocation: 'a',
    halteverbotDate: '', halteverbotTime: '',
    halteverbotDateA: '', halteverbotTimeA: '',
    halteverbotDateB: '', halteverbotTimeB: '',
    hvzSameAsA: false
  });
  const [showBisDate, setShowBisDate] = useState(false);
  useEffect(() => { if (orderMeta.movingDateTo) setShowBisDate(true); }, [orderMeta.movingDateTo]);

  // 3. Logistik
  const [logistics, setLogistics] = useState<any>({
    a_type: 'Wohnung', a_street: '', a_houseNr: '', a_zip: '', a_city: '', a_floor: 'Erdgeschoss', a_elevator: false, a_parking: false, a_furnitureLift: false, a_distance: 0,
    b_type: 'Wohnung', b_street: '', b_houseNr: '', b_zip: '', b_city: '', b_floor: 'Erdgeschoss', b_elevator: false, b_parking: false, b_furnitureLift: false, b_distance: 0,
    hvzDateA: '', hvzTimeA: '', hvzDateB: '', hvzTimeB: '', hvzSameAsA: false
  });

  // 4. Inventar
  const [inventory, setInventory] = useState<{id: string, name: string, quantity: number, note: string, room: string}[]>([]);
  const [activeRoom, setActiveRoom] = useState(ROOMS[0]);
  const [appendInventoryToPDF, setAppendInventoryToPDF] = useState(false);

  // 5. Leistungen & Preise
  const [isFlatRate, setIsFlatRate] = useState(true);
  const [flatRateNet, setFlatRateNet] = useState(0);
  const [services, setServices] = useState<{
    id: string;
    name: string;
    note?: string;
    quantity: number;
    unitPrice: number;
    unit: string;
    location?: 'a' | 'b' | 'both';
  }[]>([]);

  // --- DRAFT AUTO-SAVE & RECOVERY ---
  const draftKey = `rothirsch_draft_${orderId || 'new'}`;
  const [existingDraft, setExistingDraft] = useState<any>(null);

  // Check for saved local draft on mount (for new offers)
  useEffect(() => {
    if (typeof window === 'undefined' || orderId) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.customer?.lastName || parsed?.inventory?.length > 0 || parsed?.customer?.phone) {
          setExistingDraft(parsed);
        }
      }
    } catch {
      // Ignore
    }
  }, [draftKey, orderId]);

  // Auto-save draft to localStorage whenever fields change (debounced 1s)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasData = Boolean(
      customer.lastName?.trim() ||
      customer.phone?.trim() ||
      customer.street?.trim() ||
      inventory.length > 0
    );
    if (!hasData) return;

    const timer = setTimeout(() => {
      try {
        const draft = {
          customer,
          orderMeta,
          logistics,
          inventory,
          services,
          isFlatRate,
          flatRateNet,
          texts,
          savedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
        };
        localStorage.setItem(draftKey, JSON.stringify(draft));
      } catch {
        // Ignore
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [customer, orderMeta, logistics, inventory, services, isFlatRate, flatRateNet, texts, draftKey]);

  // --- MULTI-STEP HISTORY & SAFE CANCEL ---
  const stepRef = useRef(step);
  stepRef.current = step;

  const goToStep = (nextStep: number) => {
    if (nextStep > stepRef.current) {
      if (typeof window !== 'undefined') {
        window.history.pushState({ wizardStep: nextStep }, '');
      }
    }
    setStep(nextStep);
  };

  const handleSafeCancel = () => {
    const isDirty = Boolean(
      customer.lastName?.trim() ||
      customer.phone?.trim() ||
      customer.street?.trim() ||
      inventory.length > 0
    );

    if (isDirty) {
      const confirmLeave = window.confirm(
        "Möchten Sie die Besichtigung / das Angebot wirklich abbrechen? Eingegebene Daten bleiben lokal als Entwurf gesichert."
      );
      if (!confirmLeave) return false;
    }

    if (onClose) {
      onClose();
    } else if (urlCustomerId) {
      router.push(`/dashboard/customers/${urlCustomerId}`);
    } else {
      if (typeof window !== 'undefined' && document.referrer && document.referrer.includes(window.location.origin)) {
        router.back();
      } else {
        router.push('/dashboard');
      }
    }
    return true;
  };

  // Intercept mobile hardware back button / swipe-back gesture
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (e: PopStateEvent) => {
      if (stepRef.current > 1) {
        // Step back inside wizard without leaving the page
        setStep(prev => Math.max(1, prev - 1));
      } else {
        const isDirty = Boolean(
          customer.lastName?.trim() ||
          customer.phone?.trim() ||
          customer.street?.trim() ||
          inventory.length > 0
        );
        if (isDirty) {
          const confirmLeave = window.confirm(
            "Möchten Sie die Eingabe wirklich verlassen? Nicht gespeicherte Änderungen bleiben als lokaler Entwurf gesichert."
          );
          if (!confirmLeave) {
            window.history.pushState({ wizardStep: 1 }, '');
            return;
          }
        }
        if (onClose) {
          onClose();
        } else if (urlCustomerId) {
          router.push(`/dashboard/customers/${urlCustomerId}`);
        } else {
          router.push('/dashboard');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onClose, urlCustomerId, router, customer, inventory]);

  // Catalog Modal State
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogCategory, setSelectedCatalogCategory] = useState<string>('all');
  const [invoicedWarning, setInvoicedWarning] = useState<string | null>(null);

  // 6. Texte & Checkliste
  const [texts, setTexts] = useState({ quoteIntro: '', paymentTerms: '', quoteOutro: '' });
  const [checklist, setChecklist] = useState<{ id: string, text: string, done: boolean }[]>([]);

  // LOAD DATA
  useEffect(() => {
    getDoc(doc(db, 'system', 'settings')).then(snap => {
      if(snap.exists()) {
        const s = snap.data();
        setSettings(s);
        if (!orderId) {
          const days = parseInt(s.quoteValidDays) || 14;
          const validDate = new Date();
          validDate.setDate(validDate.getDate() + days);
          setOrderMeta((prev: any) => ({ 
            ...prev, manager: s.contacts?.[0] || '', paymentMethod: s.paymentMethods?.[0]?.name || '', validUntil: validDate.toISOString().split('T')[0]
          }));
          setTexts({ quoteIntro: s.texts?.quoteIntro || '', paymentTerms: s.paymentMethods?.[0]?.textQuote || '', quoteOutro: s.texts?.quoteGreeting || '' });
        }
      }
    });

    if (orderId) {
      getDoc(doc(db, 'orders', orderId)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.billingAddress) {
            setCustomer((prev: any) => ({ ...prev, ...data.billingAddress, source: data.customerSource || '' }));
          }
          if (data.orderMeta) {
            setOrderMeta((prev: any) => ({
              ...prev,
              ...data.orderMeta,
              halteverbotDateA: data.orderMeta.halteverbotDateA || data.orderMeta.halteverbotDate || data.logistics?.hvzDateA || data.logistics?.hvzDate || '',
              halteverbotTimeA: data.orderMeta.halteverbotTimeA || data.orderMeta.halteverbotTime || data.logistics?.hvzTimeA || data.logistics?.hvzTime || '',
              halteverbotDateB: data.orderMeta.halteverbotDateB || data.logistics?.hvzDateB || '',
              halteverbotTimeB: data.orderMeta.halteverbotTimeB || data.logistics?.hvzTimeB || '',
              hvzSameAsA: Boolean(data.orderMeta.hvzSameAsA ?? data.logistics?.hvzSameAsA)
            }));
          }
          if (data.logistics) {
            setLogistics((prev: any) => ({
              ...prev,
              ...data.logistics,
              hvzDateA: data.logistics.hvzDateA || data.logistics.hvzDate || data.orderMeta?.halteverbotDateA || data.orderMeta?.halteverbotDate || '',
              hvzTimeA: data.logistics.hvzTimeA || data.logistics.hvzTime || data.orderMeta?.halteverbotTimeA || data.orderMeta?.halteverbotTime || '',
              hvzDateB: data.logistics.hvzDateB || data.orderMeta?.halteverbotDateB || '',
              hvzTimeB: data.logistics.hvzTimeB || data.orderMeta?.halteverbotTimeB || '',
              hvzSameAsA: Boolean(data.logistics.hvzSameAsA ?? data.orderMeta?.hvzSameAsA)
            }));
          }
          if (data.inventory) setInventory(data.inventory.map((i:any) => ({ ...i, room: i.room || 'Flur/Keller' })));
          
          setIsFlatRate(data.isFlatRate !== undefined ? data.isFlatRate : true);
          setFlatRateNet(data.flatRateNet || 0);
          if (data.services) {
            setServices(data.services.map((s: any) => ({
              ...s,
              note: s.note || s.description || '',
              location: s.location || 'both'
            })));
          }
          if (data.texts) setTexts((prev: any) => ({ ...prev, ...data.texts }));
          if (data.checklist) setChecklist(data.checklist);
          if (data.appendInventoryToPDF !== undefined) setAppendInventoryToPDF(data.appendInventoryToPDF);

          // Check if invoice already created for this offer
          if (data.invoiceNumber || data.status?.startsWith('invoice_') || (data.invoiceHistory && data.invoiceHistory.length > 0)) {
            setInvoicedWarning(data.invoiceNumber || 'Rechnung vorhanden');
          }
        }
      });
    } else if (urlCustomerId) {
      getDoc(doc(db, 'customers', urlCustomerId)).then(docSnap => {
        if (docSnap.exists()) {
          const c = docSnap.data();
          setCustomer((prev: any) => ({
            ...prev, type: c.type || 'privat', salutation: c.salutation || '', firstName: c.firstName || '', lastName: c.lastName || '', phone: c.phone || '', email: c.email || '', source: c.source || '',
            street: c.street || '', houseNr: c.houseNr || '', zip: c.zip || '', city: c.city || ''
          }));
          setLogistics((prev: any) => ({
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

  const catalogCategories = React.useMemo(() => {
    if (!settings?.catalog) return [];
    const cats: string[] = settings.catalog.map((c: any) => c.category).filter(Boolean);
    return Array.from(new Set(cats));
  }, [settings]);

  const allCatalogItems = React.useMemo(() => {
    if (!settings?.catalog) return [];
    return settings.catalog.flatMap((cat: any) => 
      (cat.items || []).map((item: any) => ({ ...item, category: cat.category || 'Allgemein' }))
    );
  }, [settings]);

  const filteredCatalogItems = React.useMemo(() => {
    return allCatalogItems.filter((item: any) => {
      const matchCat = selectedCatalogCategory === 'all' || item.category === selectedCatalogCategory;
      const matchSearch = !catalogSearch.trim() || 
        (item.name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(catalogSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allCatalogItems, selectedCatalogCategory, catalogSearch]);

  const addServiceFromCatalog = (item: any) => {
    setServices(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 4),
        name: item.name,
        note: item.description || item.defaultDesc || '',
        quantity: item.quantity || 1,
        unitPrice: item.price || item.defaultPrice || 0,
        unit: item.unit || 'Stk.',
        location: 'both'
      }
    ]);
    toast.success(`"${item.name}" hinzugefügt`, { duration: 1500 });
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
        const cRef = await addDoc(collection(db, 'customers'), { 
          ...customer, createdAt: serverTimestamp(), createdBy: profile?.displayName || 'Außendienst' 
        });
        finalCustomerId = cRef.id;
      } else {
        await updateDoc(doc(db, 'customers', finalCustomerId), {
          type: customer.type || 'privat',
          salutation: customer.salutation || '',
          firstName: customer.firstName || '',
          lastName: customer.lastName || '',
          email: customer.email || '',
          phone: customer.phone || '',
          source: customer.source || '',
          street: customer.street || '',
          houseNr: customer.houseNr || '',
          zip: customer.zip || '',
          city: customer.city || ''
        });
      }

      const dateA = orderMeta.halteverbotDateA || orderMeta.halteverbotDate || logistics.hvzDateA || logistics.hvzDate || '';
      const timeA = orderMeta.halteverbotTimeA || orderMeta.halteverbotTime || logistics.hvzTimeA || logistics.hvzTime || '';
      const dateB = orderMeta.hvzSameAsA ? dateA : (orderMeta.halteverbotDateB || logistics.hvzDateB || '');
      const timeB = orderMeta.hvzSameAsA ? timeA : (orderMeta.halteverbotTimeB || logistics.hvzTimeB || '');

      const finalOrderMeta = {
        ...orderMeta,
        halteverbotDate: dateA || dateB,
        halteverbotTime: timeA || timeB,
        halteverbotDateA: dateA,
        halteverbotTimeA: timeA,
        halteverbotDateB: dateB,
        halteverbotTimeB: timeB,
        hvzSameAsA: Boolean(orderMeta.hvzSameAsA)
      };

      const finalLogistics = {
        ...logistics,
        hvzDate: dateA || dateB,
        hvzTime: timeA || timeB,
        hvzDateA: dateA,
        hvzTimeA: timeA,
        hvzDateB: dateB,
        hvzTimeB: timeB,
        hvzSameAsA: Boolean(orderMeta.hvzSameAsA)
      };

      const payload: any = {
        customerId: finalCustomerId,
        customerName: customer.type === 'firma' ? customer.lastName : `${customer.firstName} ${customer.lastName}`.trim(),
        billingAddress: customer,
        customerSource: customer.source || 'Unbekannt',
        logistics: finalLogistics,
        orderMeta: finalOrderMeta,
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
        await updateDoc(doc(db, 'orders', orderId), payload);
        toast.success("Besichtigung erfolgreich und sicher aktualisiert!", { id: toastId });
      } else {
        payload.status = 'draft';
        const rawQuote = settings?.nextQuoteNumber || 1771;
        const nextQuote = Math.max(1771, rawQuote);
        payload.orderNumber = `AN-${nextQuote}`;
        payload.createdAt = serverTimestamp();
        payload.createdBy = profile?.displayName || 'Außendienst';
        
        await addDoc(collection(db, 'orders'), payload);
        await updateDoc(doc(db, 'system', 'settings'), { nextQuoteNumber: nextQuote + 1 });
        toast.success("Besichtigung erfolgreich und sicher gespeichert!", { id: toastId });
      }
      
      try {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(draftKey);
        }
      } catch {
        // Ignore
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xl flex flex-col md:flex-row animate-in slide-in-from-bottom-full duration-300">
      <div className="glass-panel w-full md:w-64 p-4 shrink-0 flex flex-row md:flex-col justify-between overflow-x-auto custom-scrollbar m-4 md:m-8 rounded-2xl">
        <div className="flex md:flex-col gap-2 md:gap-4 w-max md:w-full">
          {STEPS.map((item) => (
            <button key={item.s} onClick={() => setStep(item.s)} className={`flex items-center gap-3 p-3 rounded-xl transition-all font-medium text-sm text-left whitespace-nowrap md:whitespace-normal ${step === item.s ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-text-muted hover:bg-structure/50'} ${step > item.s ? 'border border-primary/50 text-primary bg-primary/10' : ''}`}>
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="hidden md:inline">{item.title}</span>
              <span className="md:hidden">{item.s}.</span>
            </button>
          ))}
        </div>
        {onClose && <button type="button" onClick={handleSafeCancel} className="mt-auto hidden md:flex items-center gap-2 text-text-muted hover:text-red-400 p-3 rounded-xl transition-colors cursor-pointer"><XMarkIcon className="w-5 h-5" /> Schließen</button>}
      </div>

      <div className="flex-1 overflow-y-auto bg-transparent relative flex flex-col custom-scrollbar">
        {onClose && <button type="button" onClick={handleSafeCancel} className="md:hidden absolute top-4 right-4 z-10 p-2 bg-structure/50 rounded-full text-text-main cursor-pointer"><XMarkIcon className="w-5 h-5" /></button>}

        <div className="p-4 md:p-8 lg:p-12 max-w-4xl mx-auto w-full flex-1">
          {existingDraft && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-300 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500 shrink-0">
                  <ClipboardDocumentListIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-text-main">
                    Ungespeicherter Entwurf gefunden {existingDraft.savedAt ? `(um ${existingDraft.savedAt} Uhr gesichert)` : ''}
                  </div>
                  <div className="text-[11px] text-text-muted mt-0.5">
                    Kunde: {existingDraft.customer?.firstName} {existingDraft.customer?.lastName || 'Ohne Nachname'} • {existingDraft.inventory?.length || 0} Möbelstücke/Kartons
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    if (existingDraft.customer) setCustomer(existingDraft.customer);
                    if (existingDraft.orderMeta) setOrderMeta(existingDraft.orderMeta);
                    if (existingDraft.logistics) setLogistics(existingDraft.logistics);
                    if (existingDraft.inventory) setInventory(existingDraft.inventory);
                    if (existingDraft.services) setServices(existingDraft.services);
                    if (existingDraft.texts) setTexts(existingDraft.texts);
                    if (existingDraft.isFlatRate !== undefined) setIsFlatRate(existingDraft.isFlatRate);
                    if (existingDraft.flatRateNet !== undefined) setFlatRateNet(existingDraft.flatRateNet);
                    setExistingDraft(null);
                    toast.success("Entwurf erfolgreich wiederhergestellt!");
                  }}
                  className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs hover:brightness-110 transition-all cursor-pointer"
                >
                  Entwurf laden
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem(draftKey);
                    } catch {}
                    setExistingDraft(null);
                    toast("Entwurf verworfen.", { icon: '🗑️' });
                  }}
                  className="px-3 py-2 rounded-xl bg-structure/50 hover:bg-structure text-text-muted hover:text-text-main text-xs font-medium transition-colors cursor-pointer"
                >
                  Verwerfen
                </button>
              </div>
            </div>
          )}

          {invoicedWarning && (
            <div className="p-4 mb-6 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-3 shadow-md animate-in fade-in">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-sm text-amber-800 dark:text-amber-300">
                  Achtung: Angebot bereits abgerechnet ({invoicedWarning})
                </div>
                <p className="mt-0.5 text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                  Für diesen Auftrag wurde bereits eine Rechnung erstellt. Nachträgliche Änderungen hier im Angebot wirken sich <strong>nicht automatisch</strong> auf die bestehende Rechnung aus!
                </p>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300 glass-panel p-6 m-4 md:m-0 rounded-2xl">
              <h1 className="text-2xl font-bold text-text-main mb-6 border-b border-white/10 pb-4">Kunde & Rechnungsadresse</h1>
              <div className="flex gap-4 bg-black/20 p-2 rounded-xl border border-white/5 w-max mb-4 shadow-inner">
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
                <div className="md:col-span-2"><label className="block text-sm text-text-muted mb-2">Quelle (Woher kommt der Kunde?)</label><input type="text" list="sources" value={customer.source} onChange={e => setCustomer({...customer, source: e.target.value})} className="input-field w-full text-lg py-3" placeholder="z.B. Google, Check24, Empfehlung..." /></div>
              </div>

              <div className="mt-8 border-t border-structure pt-6">
                <h3 className="text-lg font-bold text-text-main mb-4">Rechnungsadresse</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3"><label className="block text-sm text-text-muted mb-2">Straße</label><input type="text" value={customer.street} onChange={e => setCustomer({...customer, street: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">Nr.</label><input type="text" value={customer.houseNr} onChange={e => setCustomer({...customer, houseNr: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">PLZ</label><input type="text" inputMode="numeric" value={customer.zip} onChange={async e => {
                    const val = e.target.value;
                    setCustomer({...customer, zip: val});
                    const cleanVal = val.trim();
                    if (cleanVal.length === 5) {
                      try {
                        const res = await fetch(`https://api.zippopotam.us/de/${cleanVal}`);
                        if (res.ok) {
                          const data = await res.json();
                          if (data.places && data.places.length > 0) {
                            setCustomer(prev => ({...prev, zip: cleanVal, city: data.places[0]['place name']}));
                          }
                        }
                      } catch(err) {}
                    }
                  }} className="input-field w-full text-lg py-3" /></div>
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
                  <div className="space-y-2">
                    <label className="flex items-center justify-between text-sm text-text-muted mb-1">
                      <span>Besichtigung am</span>
                      {orderMeta.viewingDate !== 'erledigt_fotos' ? (
                        <button type="button" onClick={() => setOrderMeta({...orderMeta, viewingDate: 'erledigt_fotos', viewingTime: ''})} className="text-primary hover:text-white underline text-xs font-bold">
                          Durch Fotos erledigt
                        </button>
                      ) : (
                        <button type="button" onClick={() => setOrderMeta({...orderMeta, viewingDate: '', viewingTime: ''})} className="text-text-muted hover:text-primary underline text-xs">
                          Termin wählen
                        </button>
                      )}
                    </label>
                    {orderMeta.viewingDate === 'erledigt_fotos' ? (
                      <p className="text-xs font-bold text-green-400 p-3 rounded-xl bg-green-500/10 border border-green-500/30">✓ Erledigt durch Fotos/Liste</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={['requested', 'erledigt_fotos'].includes(orderMeta.viewingDate) ? '' : (orderMeta.viewingDate || '').split('T')[0]}
                          onChange={e => {
                            const newDate = e.target.value;
                            const timeMatch = (orderMeta.viewingTime || '').match(/(\d{2}:\d{2})/);
                            const isoTime = timeMatch ? timeMatch[1] : ((orderMeta.viewingDate || '').includes('T') ? (orderMeta.viewingDate || '').split('T')[1]?.slice(0, 5) : '');
                            const combined = newDate ? (isoTime ? `${newDate}T${isoTime}` : newDate) : '';
                            setOrderMeta({ ...orderMeta, viewingDate: combined, viewingDateOnly: newDate });
                          }}
                          className="input-field w-full text-base py-2.5"
                        />
                        <select
                          value={orderMeta.viewingTime || ((orderMeta.viewingDate || '').includes('T') ? (orderMeta.viewingDate || '').split('T')[1]?.slice(0, 5) : '')}
                          onChange={e => {
                            const newTime = e.target.value;
                            const datePart = ['requested', 'erledigt_fotos'].includes(orderMeta.viewingDate) ? '' : (orderMeta.viewingDate || '').split('T')[0];
                            const timeMatch = newTime.match(/(\d{2}:\d{2})/);
                            const isoTime = timeMatch ? timeMatch[1] : '';
                            const combined = datePart ? (isoTime ? `${datePart}T${isoTime}` : datePart) : '';
                            setOrderMeta({ ...orderMeta, viewingTime: newTime, viewingDate: combined });
                          }}
                          className="input-field w-full text-sm py-2.5"
                        >
                          <option value="">Uhrzeit / Zeitfenster...</option>
                          <option value="08:00 - 12:00">08:00 - 12:00 (Vormittag)</option>
                          <option value="10:00 - 14:00">10:00 - 14:00 (Mittag)</option>
                          <option value="13:00 - 17:00">13:00 - 17:00 (Nachmittag)</option>
                          <option value="10:00">10:00 Uhr</option>
                          <option value="12:00">12:00 Uhr</option>
                          <option value="14:00">14:00 Uhr</option>
                          <option value="16:00">16:00 Uhr</option>
                          <option value="Ganztägig">Ganztägig</option>
                        </select>
                      </div>
                    )}
                    {orderMeta.viewingDate === 'requested' && <p className="text-xs font-bold text-orange-400 mt-1">Kunde hat Besichtigung angefragt!</p>}
                  </div>
                  <div><label className="block text-sm text-text-muted mb-2">Angebot gültig bis</label><input type="date" value={orderMeta.validUntil} onChange={e => setOrderMeta({...orderMeta, validUntil: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  <div className="flex flex-col">
                    <label className="flex justify-between items-center text-sm text-text-muted mb-2">
                      <span>Umzugstermin (von)</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          if (showBisDate) {
                            setOrderMeta({ ...orderMeta, movingDateTo: '' });
                          }
                          setShowBisDate(!showBisDate);
                        }} 
                        className="text-primary hover:opacity-70 transition-opacity flex items-center gap-1 font-medium"
                      >
                        {showBisDate ? (
                          <>Ohne "bis" <span className="text-[10px]">▲</span></>
                        ) : (
                          <>+ "bis" <span className="text-[10px]">▼</span></>
                        )}
                      </button>
                    </label>
                    <input type="date" value={orderMeta.movingDateFrom} onChange={e => setOrderMeta({...orderMeta, movingDateFrom: e.target.value})} className="input-field w-full text-lg py-3" />
                  </div>
                  {showBisDate && (
                    <div className="animate-fade-in"><label className="block text-sm text-text-muted mb-2">Umzugstermin (bis)</label><input type="date" value={orderMeta.movingDateTo} onChange={e => setOrderMeta({...orderMeta, movingDateTo: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  )}
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
                    <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">PLZ</label><input type="text" inputMode="numeric" value={logistics.a_zip} onChange={async e => {
                      const val = e.target.value;
                      setLogistics({...logistics, a_zip: val});
                      const cleanVal = val.trim();
                      if (cleanVal.length === 5) {
                        try {
                          const res = await fetch(`https://api.zippopotam.us/de/${cleanVal}`);
                          if (res.ok) {
                            const data = await res.json();
                            if (data.places && data.places.length > 0) setLogistics((prev: any) => ({...prev, a_zip: cleanVal, a_city: data.places[0]['place name']}));
                          }
                        } catch(err) {}
                      }
                    }} className="input-field w-full text-lg py-3" /></div>
                    <div className="col-span-3"><label className="block text-sm text-text-muted mb-2">Ort</label><input type="text" value={logistics.a_city} onChange={e => setLogistics({...logistics, a_city: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                    <div id="highlight-floorA">
                      <label className="block text-sm text-text-muted mb-2 font-medium">Etage (A)</label>
                      <select
                        value={logistics.a_floor || 'Erdgeschoss'}
                        onChange={e => setLogistics({...logistics, a_floor: e.target.value})}
                        className="input-field w-full text-base py-3"
                      >
                        {logistics.a_floor && !FLOOR_OPTIONS.includes(logistics.a_floor) && (
                          <option value={logistics.a_floor}>{logistics.a_floor}</option>
                        )}
                        {FLOOR_OPTIONS.map(fl => (
                          <option key={fl} value={fl}>{fl}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-muted mb-2 font-medium">Laufweg (A in m)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="0"
                        placeholder="z.B. 10 (Meter)"
                        value={logistics.a_distance === 0 ? '' : logistics.a_distance}
                        onChange={e => setLogistics({...logistics, a_distance: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                        className="input-field w-full text-base py-3"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Immobilienart (A)</label>
                    <div className="grid grid-cols-2 gap-3">
                      {settings?.propertyTypes?.map((pt:string) => (
                        <button key={pt} type="button" onClick={() => setLogistics({...logistics, a_type: pt})} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${logistics.a_type === pt ? 'border-primary bg-primary/20 text-primary shadow-md' : 'border-structure bg-bg-dark text-text-muted'}`}>
                          {getPropertyIcon(pt)}
                          <span className="font-bold">{pt}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button type="button" onClick={() => setLogistics({...logistics, a_elevator: !logistics.a_elevator})} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${logistics.a_elevator ? 'border-primary bg-primary/10 text-primary' : 'border-structure bg-bg-dark text-text-muted'}`}><ArrowsUpDownIcon className="w-6 h-6 mb-1" /><span className="font-bold">Aufzug</span></button>
                    <button type="button" onClick={() => {
                      const nextA = !logistics.a_parking;
                      const nextLoc = nextA && logistics.b_parking ? 'both' : nextA ? 'a' : logistics.b_parking ? 'b' : 'a';
                      setLogistics({...logistics, a_parking: nextA, hvzLocation: nextLoc});
                      setOrderMeta({...orderMeta, hvzLocation: nextLoc});
                    }} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${logistics.a_parking ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-structure bg-bg-dark text-text-muted'}`}><NoSymbolIcon className="w-6 h-6 mb-1" /><span className="font-bold">Halteverbot</span></button>
                    <button type="button" onClick={() => setLogistics({...logistics, a_furnitureLift: !logistics.a_furnitureLift})} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${logistics.a_furnitureLift ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-structure bg-bg-dark text-text-muted'}`}><ArrowUpTrayIcon className="w-6 h-6 mb-1" /><span className="font-bold">Möbellift</span></button>
                  </div>

                  {logistics.a_parking && (
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-500 block">Halteverbotszone (Auszug A) planen</span>
                        <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Beladestelle (A)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => { setOrderMeta({...orderMeta, hvzMethodA: 'selbst', hvzMethod: 'selbst'}); setLogistics({...logistics, hvzMethodA: 'selbst', hvzMethod: 'selbst'}); }} className={`py-2 px-3 rounded-xl border text-xs font-bold ${(orderMeta.hvzMethodA || orderMeta.hvzMethod || 'selbst') === 'selbst' ? 'bg-primary text-white border-primary' : 'bg-bg-dark border-structure text-text-muted'}`}>Selbst aufstellen</button>
                        <button type="button" onClick={() => { setOrderMeta({...orderMeta, hvzMethodA: 'extern', hvzMethod: 'extern'}); setLogistics({...logistics, hvzMethodA: 'extern', hvzMethod: 'extern'}); }} className={`py-2 px-3 rounded-xl border text-xs font-bold ${(orderMeta.hvzMethodA || orderMeta.hvzMethod) === 'extern' ? 'bg-primary text-white border-primary' : 'bg-bg-dark border-structure text-text-muted'}`}>Externe Firma</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input 
                          type="date" 
                          value={orderMeta.halteverbotDateA || orderMeta.halteverbotDate || logistics.hvzDateA || logistics.hvzDate || ''} 
                          onChange={e => { 
                            const val = e.target.value;
                            const nextMeta = { ...orderMeta, halteverbotDateA: val, halteverbotDate: val };
                            const nextLog = { ...logistics, hvzDateA: val, hvzDate: val };
                            if (orderMeta.hvzSameAsA) {
                              nextMeta.halteverbotDateB = val;
                              nextLog.hvzDateB = val;
                            }
                            setOrderMeta(nextMeta); 
                            setLogistics(nextLog); 
                          }} 
                          className="input-field w-full text-xs" 
                        />
                        <select 
                          value={orderMeta.halteverbotTimeA || orderMeta.halteverbotTime || logistics.hvzTimeA || logistics.hvzTime || ''} 
                          onChange={e => { 
                            const val = e.target.value;
                            const nextMeta = { ...orderMeta, halteverbotTimeA: val, halteverbotTime: val };
                            const nextLog = { ...logistics, hvzTimeA: val, hvzTime: val };
                            if (orderMeta.hvzSameAsA) {
                              nextMeta.halteverbotTimeB = val;
                              nextLog.hvzTimeB = val;
                            }
                            setOrderMeta(nextMeta); 
                            setLogistics(nextLog); 
                          }} 
                          className="input-field w-full text-xs"
                        >
                          <option value="">Zeitfenster wählen...</option>
                          <option value="08:00 - 12:00">08:00 - 12:00 (Vormittag)</option>
                          <option value="10:00 - 14:00">10:00 - 14:00 (Mittag)</option>
                          <option value="13:00 - 17:00">13:00 - 17:00 (Nachmittag)</option>
                          <option value="Ganztägig">Ganztägig</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-bg-panel p-5 rounded-2xl border border-structure shadow-lg">
                <h3 className="text-lg font-bold text-blue-400 mb-4 flex items-center gap-2">Einzug <span className="text-text-muted text-sm font-normal">(Entladeadresse)</span></h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                     <div className="col-span-3"><label className="block text-sm text-text-muted mb-2">Straße (B)</label><input type="text" value={logistics.b_street} onChange={e => setLogistics({...logistics, b_street: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                    <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">Nr.</label><input type="text" value={logistics.b_houseNr} onChange={e => setLogistics({...logistics, b_houseNr: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                    <div className="col-span-1"><label className="block text-sm text-text-muted mb-2">PLZ</label><input type="text" inputMode="numeric" value={logistics.b_zip} onChange={async e => {
                      const val = e.target.value;
                      setLogistics({...logistics, b_zip: val});
                      const cleanVal = val.trim();
                      if (cleanVal.length === 5) {
                        try {
                          const res = await fetch(`https://api.zippopotam.us/de/${cleanVal}`);
                          if (res.ok) {
                            const data = await res.json();
                            if (data.places && data.places.length > 0) setLogistics((prev: any) => ({...prev, b_zip: cleanVal, b_city: data.places[0]['place name']}));
                          }
                        } catch(err) {}
                      }
                    }} className="input-field w-full text-lg py-3" /></div>
                    <div className="col-span-3"><label className="block text-sm text-text-muted mb-2">Ort</label><input type="text" value={logistics.b_city} onChange={e => setLogistics({...logistics, b_city: e.target.value})} className="input-field w-full text-lg py-3" /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                    <div id="highlight-floorB">
                      <label className="block text-sm text-text-muted mb-2 font-medium">Etage (B)</label>
                      <select
                        value={logistics.b_floor || 'Erdgeschoss'}
                        onChange={e => setLogistics({...logistics, b_floor: e.target.value})}
                        className="input-field w-full text-base py-3"
                      >
                        {logistics.b_floor && !FLOOR_OPTIONS.includes(logistics.b_floor) && (
                          <option value={logistics.b_floor}>{logistics.b_floor}</option>
                        )}
                        {FLOOR_OPTIONS.map(fl => (
                          <option key={fl} value={fl}>{fl}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-text-muted mb-2 font-medium">Laufweg (B in m)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min="0"
                        placeholder="z.B. 10 (Meter)"
                        value={logistics.b_distance === 0 ? '' : logistics.b_distance}
                        onChange={e => setLogistics({...logistics, b_distance: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                        className="input-field w-full text-base py-3"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Immobilienart (B)</label>
                    <div className="grid grid-cols-2 gap-3">
                      {settings?.propertyTypes?.map((pt:string) => (
                        <button key={pt} type="button" onClick={() => setLogistics({...logistics, b_type: pt})} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${logistics.b_type === pt ? 'border-primary bg-primary/20 text-primary shadow-md' : 'border-structure bg-bg-dark text-text-muted'}`}>
                          {getPropertyIcon(pt)}
                          <span className="font-bold">{pt}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button type="button" onClick={() => setLogistics({...logistics, b_elevator: !logistics.b_elevator})} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${logistics.b_elevator ? 'border-primary bg-primary/10 text-primary' : 'border-structure bg-bg-dark text-text-muted'}`}><ArrowsUpDownIcon className="w-6 h-6 mb-1" /><span className="font-bold">Aufzug</span></button>
                    <button type="button" onClick={() => {
                      const nextB = !logistics.b_parking;
                      const nextLoc = logistics.a_parking && nextB ? 'both' : nextB ? 'b' : logistics.a_parking ? 'a' : 'b';
                      setLogistics({...logistics, b_parking: nextB, hvzLocation: nextLoc});
                      setOrderMeta({...orderMeta, hvzLocation: nextLoc});
                    }} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${logistics.b_parking ? 'border-red-500 bg-red-500/10 text-red-500' : 'border-structure bg-bg-dark text-text-muted'}`}><NoSymbolIcon className="w-6 h-6 mb-1" /><span className="font-bold">Halteverbot</span></button>
                    <button type="button" onClick={() => setLogistics({...logistics, b_furnitureLift: !logistics.b_furnitureLift})} className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${logistics.b_furnitureLift ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-structure bg-bg-dark text-text-muted'}`}><ArrowUpTrayIcon className="w-6 h-6 mb-1" /><span className="font-bold">Möbellift</span></button>
                  </div>

                  {logistics.b_parking && (
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-500 block">Halteverbotszone (Einzug B) planen</span>
                        <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Entladestelle (B)</span>
                      </div>

                      {/* Quick Checkbox: Gleicher Termin wie Beladestelle (A) */}
                      {logistics.a_parking && (
                        <label className="flex items-center gap-2.5 p-2.5 bg-structure/30 rounded-xl cursor-pointer text-xs text-text-main font-medium border border-structure/60 hover:bg-structure/50 transition-colors">
                          <input
                            type="checkbox"
                            checked={Boolean(orderMeta.hvzSameAsA)}
                            onChange={e => {
                              const checked = e.target.checked;
                              const dateA = orderMeta.halteverbotDateA || orderMeta.halteverbotDate || logistics.hvzDate || '';
                              const timeA = orderMeta.halteverbotTimeA || orderMeta.halteverbotTime || logistics.hvzTime || '';
                              setOrderMeta({
                                ...orderMeta,
                                hvzSameAsA: checked,
                                halteverbotDateB: checked ? dateA : (orderMeta.halteverbotDateB || ''),
                                halteverbotTimeB: checked ? timeA : (orderMeta.halteverbotTimeB || '')
                              });
                              setLogistics({
                                ...logistics,
                                hvzSameAsA: checked,
                                hvzDateB: checked ? dateA : (logistics.hvzDateB || ''),
                                hvzTimeB: checked ? timeA : (logistics.hvzTimeB || '')
                              });
                            }}
                            className="accent-primary w-4 h-4 rounded cursor-pointer"
                          />
                          <span className="font-semibold">Gleicher Termin wie Beladestelle (A)</span>
                        </label>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => { setOrderMeta({...orderMeta, hvzMethodB: 'selbst', hvzMethod: 'selbst'}); setLogistics({...logistics, hvzMethodB: 'selbst', hvzMethod: 'selbst'}); }} className={`py-2 px-3 rounded-xl border text-xs font-bold ${(orderMeta.hvzMethodB || orderMeta.hvzMethod || 'selbst') === 'selbst' ? 'bg-primary text-white border-primary' : 'bg-bg-dark border-structure text-text-muted'}`}>Selbst aufstellen</button>
                        <button type="button" onClick={() => { setOrderMeta({...orderMeta, hvzMethodB: 'extern', hvzMethod: 'extern'}); setLogistics({...logistics, hvzMethodB: 'extern', hvzMethod: 'extern'}); }} className={`py-2 px-3 rounded-xl border text-xs font-bold ${(orderMeta.hvzMethodB || orderMeta.hvzMethod) === 'extern' ? 'bg-primary text-white border-primary' : 'bg-bg-dark border-structure text-text-muted'}`}>Externe Firma</button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input 
                          type="date" 
                          disabled={Boolean(orderMeta.hvzSameAsA && logistics.a_parking)}
                          value={orderMeta.halteverbotDateB || logistics.hvzDateB || ''} 
                          onChange={e => { setOrderMeta({...orderMeta, halteverbotDateB: e.target.value}); setLogistics({...logistics, hvzDateB: e.target.value}); }} 
                          className="input-field w-full text-xs disabled:opacity-50" 
                        />
                        <select 
                          disabled={Boolean(orderMeta.hvzSameAsA && logistics.a_parking)}
                          value={orderMeta.halteverbotTimeB || logistics.hvzTimeB || ''} 
                          onChange={e => { setOrderMeta({...orderMeta, halteverbotTimeB: e.target.value}); setLogistics({...logistics, hvzTimeB: e.target.value}); }} 
                          className="input-field w-full text-xs disabled:opacity-50"
                        >
                          <option value="">Zeitfenster wählen...</option>
                          <option value="08:00 - 12:00">08:00 - 12:00 (Vormittag)</option>
                          <option value="10:00 - 14:00">10:00 - 14:00 (Mittag)</option>
                          <option value="13:00 - 17:00">13:00 - 17:00 (Nachmittag)</option>
                          <option value="Ganztägig">Ganztägig</option>
                        </select>
                      </div>
                    </div>
                  )}
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

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-text-main text-lg">
                    Positionen <span className="text-sm font-normal text-text-muted">({services.length})</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCatalogModal(true)}
                      className="btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 shrink-0"
                    >
                      <ClipboardDocumentListIcon className="w-4 h-4" />
                      Aus Katalog wählen
                    </button>
                    <button
                      type="button"
                      onClick={() => setServices([...services, { id: Date.now().toString(), name: 'Neue Leistung', quantity: 1, unitPrice: 0, unit: 'Pausch.', note: '', location: 'both' }])}
                      className="btn-secondary py-2 px-2.5 text-xs flex items-center gap-1 hover:border-primary/50 text-text-muted hover:text-text-main shrink-0"
                    >
                      <PlusIcon className="w-4 h-4" />
                      Manuell
                    </button>
                  </div>
                </div>

                {services.length === 0 ? (
                  <div className="bg-bg-panel border-2 border-dashed border-structure rounded-2xl p-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                      <ClipboardDocumentListIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-text-main">Noch keine Leistungen hinzugefügt</p>
                      <p className="text-xs text-text-muted mt-1">Wähle Standardleistungen aus dem Katalog oder erfasse eigene Positionen.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCatalogModal(true)}
                      className="btn-primary py-2.5 px-5 text-xs font-bold inline-flex items-center gap-2 shadow-md mx-auto"
                    >
                      <ClipboardDocumentListIcon className="w-4 h-4" />
                      Katalog öffnen
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {services.map((svc, idx) => (
                      <div key={svc.id} className="bg-bg-panel border border-structure/80 rounded-2xl p-4 shadow-sm space-y-3">
                        {/* Title & Delete */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-bold text-text-muted bg-structure/50 px-2 py-0.5 rounded shrink-0 mt-0.5">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={svc.name}
                            onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                            placeholder="Bezeichnung der Leistung..."
                            className="flex-1 font-bold text-sm text-text-main bg-transparent border-b border-dashed border-structure/60 focus:border-primary pb-1 outline-none transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setServices(services.filter(s => s.id !== svc.id))}
                            className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0"
                            title="Löschen"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Note / Description */}
                        <div>
                          <textarea
                            value={svc.note || ''}
                            onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, note: e.target.value } : s))}
                            placeholder="Optionale Notiz / Beschreibung für das Angebot..."
                            className="w-full text-xs text-text-main bg-bg-dark border border-structure/60 rounded-xl p-2.5 focus:border-primary outline-none transition-colors resize-y min-h-[46px]"
                            rows={2}
                          />
                        </div>

                        {/* Location Pills */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">
                            Ausführungsort
                          </label>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, location: 'a' } : s))}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold text-center border transition-all ${
                                svc.location === 'a'
                                  ? 'bg-primary text-white border-primary shadow-sm'
                                  : 'bg-bg-dark border-structure/60 text-text-muted hover:text-text-main'
                              }`}
                            >
                              Beladung (A)
                            </button>
                            <button
                              type="button"
                              onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, location: 'b' } : s))}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold text-center border transition-all ${
                                svc.location === 'b'
                                  ? 'bg-primary text-white border-primary shadow-sm'
                                  : 'bg-bg-dark border-structure/60 text-text-muted hover:text-text-main'
                              }`}
                            >
                              Entladung (B)
                            </button>
                            <button
                              type="button"
                              onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, location: 'both' } : s))}
                              className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold text-center border transition-all ${
                                !svc.location || svc.location === 'both'
                                  ? 'bg-primary text-white border-primary shadow-sm'
                                  : 'bg-bg-dark border-structure/60 text-text-muted hover:text-text-main'
                              }`}
                            >
                              Beide
                            </button>
                          </div>
                        </div>

                        {/* Quantity, Unit, Unit Price */}
                        <div className="flex items-center gap-3 pt-2 border-t border-structure/40 flex-wrap">
                          {/* Stepper Quantity */}
                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] text-text-muted font-medium">Menge:</label>
                            <div className="flex items-center bg-bg-dark border border-structure rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: Math.max(0, (s.quantity || 1) - 1) } : s))}
                                className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-main hover:bg-white/5 active:scale-95 text-xs font-bold"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={svc.quantity}
                                onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: parseFloat(e.target.value) || 0 } : s))}
                                className="w-10 text-center bg-transparent text-xs font-bold text-text-main outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: (s.quantity || 0) + 1 } : s))}
                                className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-main hover:bg-white/5 active:scale-95 text-xs font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Unit */}
                          <div className="flex items-center gap-1.5">
                            <label className="text-[11px] text-text-muted font-medium">Einheit:</label>
                            <input
                              type="text"
                              value={svc.unit}
                              onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, unit: e.target.value } : s))}
                              className="w-16 px-2 py-1 bg-bg-dark border border-structure rounded-lg text-xs text-center text-text-main"
                              placeholder="Stk."
                            />
                          </div>

                          {/* Price (if !isFlatRate) */}
                          {!isFlatRate && (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <label className="text-[11px] text-text-muted font-medium">EP (€):</label>
                              <input
                                type="number"
                                value={svc.unitPrice}
                                onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, unitPrice: parseFloat(e.target.value) || 0 } : s))}
                                className="w-20 px-2 py-1 bg-bg-dark border border-structure rounded-lg text-xs text-right font-bold text-primary"
                                placeholder="0.00"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Catalog Bar */}
              {settings?.catalog && settings.catalog.length > 0 && (
                <div className="bg-bg-dark border border-structure p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-2.5">
                    <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Häufige Leistungen</h4>
                    <button
                      type="button"
                      onClick={() => setShowCatalogModal(true)}
                      className="text-xs text-primary hover:underline font-semibold"
                    >
                      Alle anzeigen
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {allCatalogItems.slice(0, 10).map((item: any, i: number) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => addServiceFromCatalog(item)}
                        className="shrink-0 bg-structure/30 hover:bg-primary/20 text-text-main px-3 py-1.5 rounded-lg text-xs border border-structure hover:border-primary/50 transition-colors whitespace-nowrap"
                      >
                        + {item.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Catalog Modal */}
              {showCatalogModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
                  <div className="bg-bg-panel border border-structure rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                    {/* Modal Header */}
                    <div className="p-4 border-b border-structure bg-bg-dark flex items-center justify-between shrink-0">
                      <div>
                        <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                          <ClipboardDocumentListIcon className="w-5 h-5 text-primary" />
                          Leistungskatalog
                        </h3>
                        <p className="text-xs text-text-muted">Klicke auf eine Leistung, um sie zum Angebot hinzuzufügen</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowCatalogModal(false)}
                        className="p-1.5 text-text-muted hover:text-white rounded-lg hover:bg-white/10"
                      >
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Search & Filter */}
                    <div className="p-3 border-b border-structure bg-bg-dark/50 space-y-2.5 shrink-0">
                      <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={catalogSearch}
                          onChange={e => setCatalogSearch(e.target.value)}
                          placeholder="Leistung suchen (z.B. Karton, Klavier, Montage)..."
                          className="input-field w-full pl-9 pr-8 py-2 text-xs"
                          autoFocus
                        />
                        {catalogSearch && (
                          <button
                            type="button"
                            onClick={() => setCatalogSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white text-xs"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Categories Chips */}
                      {catalogCategories.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
                          <button
                            type="button"
                            onClick={() => setSelectedCatalogCategory('all')}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                              selectedCatalogCategory === 'all'
                                ? 'bg-primary text-white shadow-sm'
                                : 'bg-structure/40 text-text-muted hover:bg-structure'
                            }`}
                          >
                            Alle ({allCatalogItems.length})
                          </button>
                          {catalogCategories.map((cat: string) => {
                            const count = allCatalogItems.filter((i: any) => i.category === cat).length;
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => setSelectedCatalogCategory(cat)}
                                className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                                  selectedCatalogCategory === cat
                                    ? 'bg-primary text-white shadow-sm'
                                    : 'bg-structure/40 text-text-muted hover:bg-structure'
                                }`}
                              >
                                {cat} ({count})
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Catalog Items List */}
                    <div className="p-3 overflow-y-auto flex-1 custom-scrollbar space-y-2">
                      {filteredCatalogItems.length === 0 ? (
                        <div className="p-8 text-center text-text-muted text-xs">
                          Keine Leistungen gefunden.
                        </div>
                      ) : (
                        filteredCatalogItems.map((item: any, idx: number) => {
                          const alreadyInList = services.some(s => s.name.toLowerCase() === item.name.toLowerCase());
                          return (
                            <div
                              key={idx}
                              onClick={() => addServiceFromCatalog(item)}
                              className="p-3 rounded-xl border border-structure/70 bg-bg-dark/60 hover:bg-primary/10 hover:border-primary/50 transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99]"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-text-main truncate">{item.name}</span>
                                  {alreadyInList && (
                                    <span className="text-[10px] bg-green-500/20 text-green-400 font-bold px-1.5 py-0.5 rounded">
                                      bereits drin
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">{item.description}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-text-muted bg-structure/40 px-2 py-0.5 rounded">
                                    {item.category}
                                  </span>
                                  {(item.price || item.defaultPrice) > 0 && (
                                    <span className="text-[10px] font-bold text-primary">
                                      {(item.price || item.defaultPrice).toFixed(2)} € {item.unit ? `/ ${item.unit}` : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); addServiceFromCatalog(item); }}
                                className="w-8 h-8 rounded-lg bg-primary/20 text-primary hover:bg-primary hover:text-white flex items-center justify-center shrink-0 transition-colors font-bold text-sm"
                              >
                                +
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Modal Footer */}
                    <div className="p-3 border-t border-structure bg-bg-dark flex justify-between items-center shrink-0">
                      <span className="text-xs text-text-muted font-medium">
                        {services.length} Leistung(en) im Angebot
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCatalogModal(false)}
                        className="btn-primary py-2 px-5 text-xs font-bold"
                      >
                        Fertig
                      </button>
                    </div>
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

        {/* Mobile Sticky Bar */}
        <div 
          className="md:hidden p-3 bg-bg-panel/95 backdrop-blur-md border-t border-structure flex flex-col gap-3 shrink-0 sticky z-[60] w-full shadow-[0_-10px_30px_rgba(0,0,0,0.3)]"
          style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex justify-between gap-2 w-full">
            <button type="button" onClick={handleSafeCancel} disabled={isSaving} className="btn-secondary text-xs flex-1 py-2 cursor-pointer">Abbrechen</button>
            <button type="button" onClick={saveOrder} disabled={isSaving} className="btn-secondary text-xs flex-1 py-2 cursor-pointer">{isSaving ? 'Speichert...' : 'Speichern'}</button>
          </div>
          <div className="flex justify-between gap-2 w-full">
            <button type="button" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className={`btn-secondary py-3 px-4 flex items-center gap-2 text-sm flex-1 justify-center cursor-pointer ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}><ChevronLeftIcon className="w-5 h-5" /> Zurück</button>
            {step < 7 ? (
              <button type="button" onClick={() => goToStep(step + 1)} className="btn-primary py-3 px-4 flex items-center gap-2 text-sm shadow-lg flex-1 justify-center cursor-pointer">Weiter <ChevronRightIcon className="w-5 h-5" /></button>
            ) : (
              <button type="button" onClick={saveOrder} disabled={isSaving} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-green-600/30 flex items-center gap-2 text-sm transition-all flex-1 justify-center cursor-pointer">{isSaving ? 'Speichert...' : <><CheckCircleIcon className="w-5 h-5" /> Abschließen</>}</button>
            )}
          </div>
        </div>

        {/* Desktop Sticky Bar */}
        <div className="hidden md:flex p-4 bg-bg-panel border-t border-structure justify-between items-center shrink-0 sticky bottom-0 z-20 w-full">
          <div className="flex gap-4">
            <button type="button" onClick={handleSafeCancel} disabled={isSaving} className="btn-secondary py-3 px-6 flex items-center gap-2 text-lg cursor-pointer">Abbrechen</button>
            <button type="button" onClick={saveOrder} disabled={isSaving} className="btn-secondary py-3 px-6 flex items-center gap-2 text-lg cursor-pointer">{isSaving ? 'Speichert...' : 'Speichern'}</button>
          </div>
          <div className="flex gap-4">
            <button type="button" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1} className={`btn-secondary py-3 px-6 flex items-center gap-2 text-lg cursor-pointer ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}><ChevronLeftIcon className="w-5 h-5" /> Zurück</button>
            {step < 7 ? (
              <button type="button" onClick={() => goToStep(step + 1)} className="btn-primary py-3 px-8 flex items-center gap-2 text-lg shadow-lg cursor-pointer">Weiter <ChevronRightIcon className="w-5 h-5" /></button>
            ) : (
              <button type="button" onClick={saveOrder} disabled={isSaving} className="bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-green-600/30 flex items-center gap-2 text-lg transition-all cursor-pointer">{isSaving ? 'Speichert...' : <><CheckCircleIcon className="w-6 h-6" /> Besichtigung abschließen</>}</button>
            )}
          </div>
        </div>

        {/* Spacer to allow scrolling past the sticky bar and BottomNav */}
        <div className="md:hidden w-full shrink-0" style={{ height: 'calc(10rem + env(safe-area-inset-bottom, 0px))' }}></div>
        <datalist id="floors">
          <option value="Erdgeschoss" />
          <option value="1. OG" />
          <option value="2. OG" />
          <option value="3. OG" />
          <option value="4. OG" />
          <option value="5. OG" />
        </datalist>
        <datalist id="sources">
          <option value="Google" />
          <option value="Check24" />
          <option value="MyHammer" />
          <option value="Empfehlung" />
          <option value="Kleinanzeigen" />
          <option value="Stammkunde" />
        </datalist>
      </div>
    </div>
  );
}
