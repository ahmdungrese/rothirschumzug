import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { STANDARD_SERVICES_A, STANDARD_SERVICES_B, STANDARD_SERVICES_FIXED, QUICK_FURNITURE, QUICK_ROOMS } from './orderConstants';
import { calculateOrderTotals } from '@/lib/financeHelpers';

const OrderEditorContext = createContext<any>(null);

export const useOrderEditor = () => {
  const context = useContext(OrderEditorContext);
  if (!context) {
    throw new Error('useOrderEditor must be used within an OrderEditorProvider');
  }
  return context;
};

export const OrderEditorProvider = ({ children, orderId }: { children: React.ReactNode, orderId?: string }) => {
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
  const stepParam = searchParams?.get('step');
  const initialStep = (stepParam === 'inventory' || stepParam === '4') ? 4 : (stepParam ? parseInt(stepParam, 10) || 1 : 1);
  const [currentStep, setCurrentStep] = useState(initialStep);

  useEffect(() => {
    const s = searchParams?.get('step');
    if (s === '4' || s === 'inventory') {
      setCurrentStep(4);
    } else if (s) {
      const parsed = parseInt(s, 10);
      if (parsed >= 1 && parsed <= 5) setCurrentStep(parsed);
    }
  }, [searchParams]);

  // 1. Kundeninformationen
  const [customerData, setCustomerData] = useState({
    type: 'privat', // 'privat' | 'firma'
    firstName: '',
    lastName: '',
    salutation: '',
    email: '',
    phone: '',
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

  // 9. Fuhrpark & Volumen (Schnell-Auswahl) & Externe Signatur
  const [truckChoice, setTruckChoice] = useState<'1_transporter' | '1_lkw' | '2_lkw' | 'custom'>('1_lkw');
  const [estimatedCbm, setEstimatedCbm] = useState<number>(30);
  const [isManuallySigned, setIsManuallySigned] = useState<boolean>(false);
  const [selectedRoomTab, setSelectedRoomTab] = useState('Alle');
  const [showFullCatalog, setShowFullCatalog] = useState(false);
  const [showBisDate, setShowBisDate] = useState(false);

  useEffect(() => {
    if (orderMeta.movingDateTo) {
      setShowBisDate(true);
    }
  }, [orderMeta.movingDateTo]);
  // Helper to toggle standard service in Step 3
  const toggleStandardService = (srv: typeof STANDARD_SERVICES_A[0]) => {
    const existing = services.find(s => s.id === srv.id || (s.name||'').toLowerCase() === (srv.name||'').toLowerCase());
    if (existing) {
      setServices(prev => prev.filter(s => s.id !== existing.id));
      if (srv.id === 'hvz_a') setLogistics(l => ({ ...l, a_parking: false }));
      if (srv.id === 'hvz_b') setLogistics(l => ({ ...l, b_parking: false }));
    } else {
      setServices(prev => [...prev, {
        id: srv.id,
        name: srv.name,
        quantity: 1,
        unitPrice: srv.price,
        unit: srv.unit
      }]);
      if (srv.id === 'hvz_a') setLogistics(l => ({ ...l, a_parking: true }));
      if (srv.id === 'hvz_b') setLogistics(l => ({ ...l, b_parking: true }));
    }
  };

  const isStandardServiceSelected = (srvId: string, srvName: string) => {
    return services.some(s => s.id === srvId || (s.name||'').toLowerCase() === (srvName||'').toLowerCase());
  };

  // Helper for quick furniture items in Step 4
  const getFurnitureCount = (name: string, room?: string) => {
    const item = inventory.find(i => 
      (i.name||'').toLowerCase() === (name||'').toLowerCase() && 
      (!room || room === 'Alle' || (i.room || 'Wohnzimmer').toLowerCase() === (room||'').toLowerCase())
    );
    return item ? item.quantity : 0;
  };

  const updateFurnitureCount = (fItem: typeof QUICK_FURNITURE[0], room: string, delta: number) => {
    const targetRoom = room === 'Alle' ? (fItem.room || 'Wohnzimmer') : room;
    const existingIdx = inventory.findIndex(i => 
      (i.name||'').toLowerCase() === (fItem.name||'').toLowerCase() && 
      (i.room || 'Wohnzimmer').toLowerCase() === (targetRoom||'').toLowerCase()
    );
    if (existingIdx >= 0) {
      const newQty = inventory[existingIdx].quantity + delta;
      if (newQty <= 0) {
        setInventory(prev => prev.filter((_, idx) => idx !== existingIdx));
      } else {
        setInventory(prev => prev.map((item, idx) => idx === existingIdx ? { ...item, quantity: newQty } : item));
      }
    } else if (delta > 0) {
      setInventory(prev => [...prev, {
        id: Date.now().toString() + Math.random(),
        name: fItem.name,
        quantity: delta,
        note: '',
        room: targetRoom
      }]);
    }
  };

  const totalFurniturePieces = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const calculateQuickCbm = () => {
    let sum = 0;
    inventory.forEach(item => {
      const found = QUICK_FURNITURE.find(q => (q.name||'').toLowerCase() === (item.name||'').toLowerCase());
      sum += (item.quantity || 0) * (found ? found.cbm : 0.25);
    });
    return sum > 0 ? Number(sum.toFixed(2)) : estimatedCbm;
  };

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
          if (data.truckChoice) setTruckChoice(data.truckChoice);
          if (data.estimatedCbm) setEstimatedCbm(data.estimatedCbm);
          if (data.isManuallySigned) setIsManuallySigned(data.isManuallySigned);
          
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
              source: data.billingAddress.source || ''
            }));
          }
        }
      });
    }

    if (urlCustomerId) {
      getDoc(doc(db, 'customers', urlCustomerId)).then(docSnap => {
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
            street: c.street || prev.street || '',
            houseNr: c.houseNr || prev.houseNr || '',
            zip: c.zip || prev.zip || '',
            city: c.city || prev.city || ''
          }));
        }
      });
    }
  }, [orderId, urlCustomerId]);

  useEffect(() => {
    const stepParam = searchParams?.get('step');
    if (stepParam) {
      setCurrentStep(parseInt(stepParam));
    }
  }, [searchParams]);

  useEffect(() => {
    const highlightParam = searchParams?.get('highlight');
    if (highlightParam) {
      setTimeout(() => {
        const el = document.getElementById(`highlight-${highlightParam}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          let isComplete = false;
          if (highlightParam === 'addressA') isComplete = !!(logistics.a_street && logistics.a_houseNr && logistics.a_zip && logistics.a_city);
          else if (highlightParam === 'addressB') isComplete = !!(logistics.b_street && logistics.b_houseNr && logistics.b_zip && logistics.b_city);
          else if (highlightParam === 'movingDate') isComplete = !!orderMeta.movingDateFrom;
          else if (highlightParam === 'viewingDate') isComplete = !!orderMeta.viewingDate;
          else if (highlightParam === 'floorA') isComplete = !!logistics.a_floor;
          else if (highlightParam === 'floorB') isComplete = !!logistics.b_floor;

          if (!isComplete) {
            el.classList.add('highlight-pulse', 'border');
            setTimeout(() => el.classList.remove('highlight-pulse', 'border'), 3600);
            
            // Auto Focus
            const focusMap: any = {
              'addressA': !logistics.a_street ? 'a_street' : !logistics.a_houseNr ? 'a_houseNr' : !logistics.a_zip ? 'a_zip' : 'a_city',
              'addressB': !logistics.b_street ? 'b_street' : !logistics.b_houseNr ? 'b_houseNr' : !logistics.b_zip ? 'b_zip' : 'b_city',
              'movingDate': 'movingDateFrom',
              'viewingDate': 'viewingDate',
              'floorA': 'a_floor',
              'floorB': 'b_floor'
            };
            const targetId = focusMap[highlightParam];
            if (targetId) document.getElementById(`input-${targetId}`)?.focus();
          }
        }
      }, 500); // Wait for render and optional tab switch
    }
  }, [searchParams, currentStep]);


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
    return calculateOrderTotals({
      isFlatRate,
      flatRateNet,
      services,
      calcInput: null // Force recalculation from services/flatRate
    });
  };
  const totals = calculateTotal();
  const customerName = customerData.type === 'firma' ? customerData.lastName : `${customerData.firstName} ${customerData.lastName}`.trim();
  const customerEmail = customerData.email;
  const customerPhone = customerData.phone;

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
      const cleanCreatorName = profile?.displayName || profile?.email?.split('@')[0] || 'Team';
      if (!finalCustomerId) {
        const cRef = await addDoc(collection(db, 'customers'), { 
          ...customerData, 
          createdAt: serverTimestamp(),
          createdBy: cleanCreatorName 
        });
        finalCustomerId = cRef.id;
        await logActivity(profile?.uid || 'unknown', cleanCreatorName, 'CREATE_CUSTOMER', `Kunde ${customerData.lastName} im Angebots-Editor angelegt`);
      }
      
      // Update the main customer profile so that salutation and other details are persisted for future orders
      if (finalCustomerId) {
        await updateDoc(doc(db, 'customers', finalCustomerId), {
          salutation: customerData.salutation || '',
          firstName: customerData.firstName || '',
          lastName: customerData.lastName || '',
          email: customerData.email || '',
          phone: customerData.phone || '',
          street: customerData.street || '',
          houseNr: customerData.houseNr || '',
          zip: customerData.zip || '',
          city: customerData.city || '',
          type: customerData.type || 'privat',
          source: customerData.source || ''
        });
      }

      let finalStatus = status;
      // Prevent downgrading the order status to draft when simply saving.
      // If generateQuote is true, status is already passed as 'quote' or changed later.
      // If it's an invoice, status is 'invoice_open'.
      if (orderId && orderStatus && orderStatus !== 'draft' && status === 'draft') {
        finalStatus = orderStatus as any;
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
        customerSource: customerData.source || 'Direktanfrage',
        status: finalStatus,
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
        truckChoice,
        estimatedCbm,
        isManuallySigned,
        updatedAt: serverTimestamp(),
        updatedBy: cleanCreatorName
      };

      if (orderId) {
        await updateDoc(doc(db, 'orders', orderId), payload);
        await logActivity(profile?.uid || 'unknown', cleanCreatorName, 'UPDATE_ORDER', `Angebot/Auftrag aktualisiert für Kunde ${payload.customerName}`);
        
        if (generateQuote) {
          try {
            await changeOrderStatus(orderId, 'quote', { userId: profile?.uid });
          } catch (err: any) {
            toast.error(err.message || "Fehler bei der Angebotserstellung.");
          }
        }
      } else {
        const docRef = await addDoc(collection(db, 'orders'), { 
          ...payload, 
          createdAt: serverTimestamp(),
          createdBy: cleanCreatorName 
        });
        await logActivity(profile?.uid || 'unknown', cleanCreatorName, 'CREATE_ORDER', `Angebot erstellt für Kunde ${payload.customerName}`);
        
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

  const validateAndSetStep = (targetStep: number) => {
    // If going backwards, always allow
    if (targetStep < currentStep) {
      setCurrentStep(targetStep);
      return;
    }

    // Step 1 Validation: Customer Data
    if (currentStep === 1 || targetStep > 1) {
      if (!urlCustomerId && !customerData.lastName?.trim()) {
        const errorMsg = customerData.type === 'firma' 
          ? "Bitte Firmenname im Schritt '1. Kunde' ausfüllen!" 
          : "Bitte Nachname im Schritt '1. Kunde' ausfüllen!";
        toast.error(errorMsg);
        setErrorMessage(errorMsg);
        setTimeout(() => setErrorMessage(''), 4000);
        setCurrentStep(1);
        return;
      }
    }

    // Step 2 Validation: Moving Addresses
    if (currentStep === 2 && targetStep > 2) {
      if (!logistics.a_city?.trim() && !logistics.a_street?.trim()) {
        const errorMsg = "Hinweis: Bitte mindestens Ort oder Straße der Beladestelle (A) angeben!";
        toast.error(errorMsg);
        setErrorMessage(errorMsg);
        setTimeout(() => setErrorMessage(''), 4000);
        return;
      }
    }

    setCurrentStep(targetStep);
  };

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const minSwipeDistance = 50;
    
    if (distance > minSwipeDistance && currentStep < 5) {
      validateAndSetStep(currentStep + 1);
    }
    if (distance < -minSwipeDistance && currentStep > 1) {
      validateAndSetStep(currentStep - 1);
    }
  };

  if (!settings) return <div className="p-12 text-center text-text-main">Lade Einstellungen...</div>;

  const date = orderMeta?.movingDateFrom || "";
  const time = orderMeta?.movingTimeFrom || "";
  const calculatedDuration = orderMeta?.estimatedDuration || "";


  const value = {
    orderId, urlCustomerId, router, searchParams, isInvoice, profile, canEditPrices, canViewPrices,
    isSaving, setIsSaving, settings, orderStatus, setOrderStatus, currentStep, setCurrentStep,
    customerData, setCustomerData, orderMeta, setOrderMeta, logistics, setLogistics,
    isFlatRate, setIsFlatRate, flatRateNet, setFlatRateNet, services, setServices,
    catalogSearch, setCatalogSearch, activeCategoryTab, setActiveCategoryTab, calcInput, setCalcInput,
    inventory, setInventory, appendInventoryToPDF, setAppendInventoryToPDF, isInventoryWizardOpen, setIsInventoryWizardOpen,
    totals, saveOrder, calculateRoute, updateFurnitureCount, addService, removeService, customerName, date, errorMessage, activeOrder,
    toggleStandardService, isStandardServiceSelected, updateServiceQuantity, updateServicePrice, updateServiceNote,
    generatePDF
  };

  return <OrderEditorContext.Provider value={value}>{children}</OrderEditorContext.Provider>;
};
