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
import { changeOrderStatus } from '@/lib/orderStateMachine';
import { calculateOrderTotals } from '@/lib/financeHelpers';
import { InventoryWizardModal, ROOM_TYPES } from './InventoryWizardModal';

const getPropertyIcon = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('wohnung')) return <BuildingOffice2Icon className="w-6 h-6 mb-1" />;
  if (t.includes('haus')) return <HomeIcon className="w-6 h-6 mb-1" />;
  if (t.includes('büro') || t.includes('buero')) return <BriefcaseIcon className="w-6 h-6 mb-1" />;
  return <BuildingLibraryIcon className="w-6 h-6 mb-1" />;
};

const getCategoryIcon = (category: string) => {
  const c = (category || '').toLowerCase();
  if (c.includes('transport') || c.includes('grundlagen')) return <TruckIcon className="w-5 h-5" />;
  if (c.includes('verpack') || c.includes('karton') || c.includes('material')) return <ArchiveBoxIcon className="w-5 h-5" />;
  if (c.includes('montage') || c.includes('aufbau') || c.includes('abbau')) return <WrenchIcon className="w-5 h-5" />;
  if (c.includes('entsorgung') || c.includes('sperrmüll')) return <TrashIcon className="w-5 h-5" />;
  if (c.includes('reinigung') || c.includes('putz')) return <SparklesIcon className="w-5 h-5" />;
  if (c.includes('zuschlag') || c.includes('sonstig')) return <PlusCircleIcon className="w-5 h-5" />;
  return <TagIcon className="w-5 h-5" />;
};

const STANDARD_SERVICES_A = [
  { id: 'moebelabbau', name: 'Möbelabbau', price: 150, unit: 'pauschal', icon: 'tools_ladder', defaultDesc: 'Fachgerechter Abbau von Schränken, Betten und Regalen.' },
  { id: 'kueche_abbau', name: 'Abbau von Küche', price: 280, unit: 'pauschal', icon: 'countertops', defaultDesc: 'Abbau der Einbauküche inkl. Elektrogeräte und fachgerechte Trennung der Wasseranschlüsse.' },
  { id: 'packservice_ein', name: 'Einpackservice', price: 190, unit: 'pauschal', icon: 'inventory_2', defaultDesc: 'Einpacken des gesamten Hausrats in bereitgestellte Kartons inkl. Polstermaterial.' },
  { id: 'hvz_a', name: 'Halteverbot A', price: 95, unit: 'Zone', icon: 'signpost', defaultDesc: 'Einrichtung einer temporären Halteverbotszone (ca. 15m) an der Beladestelle inkl. behördlicher Genehmigung.' },
  { id: 'endreinigung', name: 'Endreinigung', price: 220, unit: 'pauschal', icon: 'cleaning_services', defaultDesc: 'Besenreine Endreinigung der Auszugsimmobilie.' }
];

const STANDARD_SERVICES_B = [
  { id: 'moebelaufbau', name: 'Möbelaufbau', price: 180, unit: 'pauschal', icon: 'build', defaultDesc: 'Fachgerechter Aufbau aller Möbel in den Zielräumen.' },
  { id: 'kueche_aufbau', name: 'Aufbau von Küche', price: 320, unit: 'pauschal', icon: 'kitchen', defaultDesc: 'Aufbau der Küchenzeile, Hängeschränke und Montage der Arbeitsplatte.' },
  { id: 'packservice_aus', name: 'Auspackservice', price: 160, unit: 'pauschal', icon: 'unarchive', defaultDesc: 'Auspacken aller Kartons und Platzieren des Inhalts nach Kundenwunsch.' },
  { id: 'bohren', name: 'Bohr- & Dübelarb.', price: 90, unit: 'pauschal', icon: 'handyman', defaultDesc: 'Fachgerechte Montage und Befestigung von Lampen, Spiegeln und Gardinenstangen.' },
  { id: 'hvz_b', name: 'Halteverbot B', price: 95, unit: 'Zone', icon: 'signpost', defaultDesc: 'Einrichtung einer temporären Halteverbotszone (ca. 15m) an der Entladestelle inkl. behördlicher Genehmigung.' }
];

const QUICK_FURNITURE = [
  { id: 'doppelbett', name: 'Doppelbett', cbm: 2.5, icon: 'single_bed', category: 'Betten', room: 'Schlafzimmer' },
  { id: 'schrank_2', name: 'Schrank (2türig)', cbm: 1.8, icon: 'door_sliding', category: 'Schränke', room: 'Schlafzimmer' },
  { id: 'esstisch', name: 'Esstisch', cbm: 0.9, icon: 'table_restaurant', category: 'Tische', room: 'Küche' },
  { id: 'karton', name: 'Umzugskarton', cbm: 0.15, icon: 'inventory_2', category: 'Kartons', room: 'Allgemein' },
  { id: 'sofa_3', name: '3er Sofa', cbm: 2.2, icon: 'chair', category: 'Sitzmöbel', room: 'Wohnzimmer' },
  { id: 'stuhl', name: 'Stuhl', cbm: 0.2, icon: 'chair_alt', category: 'Sitzmöbel', room: 'Wohnzimmer' },
  { id: 'regal', name: 'Bücherregal', cbm: 0.6, icon: 'shelves', category: 'Regale', room: 'Wohnzimmer' }
];

const QUICK_ROOMS = [
  { id: 'alle', name: 'Alle', icon: 'apps' },
  { id: 'wohnzimmer', name: 'Wohnzimmer', icon: 'chair' },
  { id: 'schlafzimmer', name: 'Schlafzimmer', icon: 'bed' },
  { id: 'kueche', name: 'Küche', icon: 'countertops' },
  { id: 'kinderzimmer', name: 'Kinderzimmer', icon: 'toys' },
  { id: 'buero', name: 'Büro', icon: 'desk' }
];

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

  return (
    <div 
      className="space-y-8 animate-in fade-in duration-500 pb-48"
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
      {/* Stepper Navigation matching Mockups */}
      <div className="mb-10 py-2">
        <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-4">
          {[
            { step: 1, label: '1. Kunde', icon: 'person' },
            { step: 2, label: '2. Logistik', icon: 'local_shipping' },
            { step: 3, label: '3. Leistungen', icon: 'construction' },
            { step: 4, label: '4. Inventar', icon: 'inventory_2' },
            { step: 5, label: '5. Abschluss', icon: 'task_alt' },
          ].map((s, idx) => (
            <React.Fragment key={s.step}>
              <div 
                onClick={() => validateAndSetStep(s.step)}
                className="flex flex-col items-center cursor-pointer group select-none"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  currentStep === s.step
                    ? 'bg-[#D91E2A] text-white shadow-lg shadow-[#D91E2A]/30 ring-4 ring-white dark:ring-slate-800 z-10 scale-105'
                    : currentStep > s.step
                      ? 'bg-emerald-600 text-white z-10 ring-4 ring-white dark:ring-slate-800 shadow-sm'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 z-10 ring-4 ring-white dark:ring-slate-800'
                }`}>
                  <span className="material-symbols-outlined text-xl">
                    {currentStep > s.step ? 'check' : s.icon}
                  </span>
                </div>
                <span className={`mt-2 text-xs font-bold font-display uppercase tracking-tight transition-colors ${
                  currentStep === s.step 
                    ? 'text-[#D91E2A] dark:text-red-400' 
                    : currentStep > s.step
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {s.label}
                </span>
              </div>
              {idx < 4 && (
                <div className={`flex-1 h-0.5 -mt-6 -mx-2 transition-all ${
                  currentStep > s.step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                }`}></div>
              )}
            </React.Fragment>
          ))}
        </div>
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
            <select value={customerData.source} onChange={e => setCustomerData({...customerData, source: e.target.value})} className="input-field w-full">
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

          <div id="highlight-movingDate" className="rounded-xl transition-all">
            <label className="flex justify-between items-center text-xs text-text-muted mb-1">
              <span>Umzugsdatum (von)</span>
              <button 
                type="button" 
                onClick={() => {
                  if (showBisDate) {
                    setOrderMeta({ ...orderMeta, movingDateTo: '' });
                  }
                  setShowBisDate(!showBisDate);
                }} 
                className="text-primary hover:opacity-70 transition-opacity flex items-center gap-1"
              >
                {showBisDate ? (
                  <>Ohne "bis" <span className="text-[10px]">▲</span></>
                ) : (
                  <>+ "bis" <span className="text-[10px]">▼</span></>
                )}
              </button>
            </label>
            <input id="input-movingDateFrom" type="date" value={orderMeta.movingDateFrom} onChange={e => setOrderMeta({...orderMeta, movingDateFrom: e.target.value})} className="input-field w-full" />
            
            {showBisDate && (
              <div className="mt-3 animate-fade-in">
                <label className="block text-xs text-text-muted mb-1">Umzugsdatum (bis)</label>
                <input type="date" value={orderMeta.movingDateTo} onChange={e => setOrderMeta({...orderMeta, movingDateTo: e.target.value})} className="input-field w-full" />
              </div>
            )}
          </div>
          <div id="highlight-viewingDate" className="rounded-xl transition-all">
            <label className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span>Besichtigungstermin</span>
              {(orderMeta.viewingDate === 'requested' || orderMeta.viewingDate === '') && (
                <button type="button" onClick={() => setOrderMeta({...orderMeta, viewingDate: 'erledigt_fotos'})} className="text-primary hover:opacity-70 transition-opacity underline">
                  Durch Fotos erledigt
                </button>
              )}
            </label>
            <input id="input-viewingDate" type="datetime-local" value={['requested', 'erledigt_fotos'].includes(orderMeta.viewingDate) ? '' : (orderMeta.viewingDate || '')} onChange={e => setOrderMeta({...orderMeta, viewingDate: e.target.value})} className="input-field w-full" />
            {orderMeta.viewingDate === 'erledigt_fotos' && (
              <p className="text-xs font-bold text-green-400 mt-1">✓ Erledigt durch Fotos/Inventarliste</p>
            )}
            {orderMeta.viewingDate === 'requested' && (
              <p className="text-xs font-bold text-orange-400 mt-1">Kunde hat Besichtigung angefragt!</p>
            )}
            <p className="text-[10px] text-text-muted mt-1">Erscheint automatisch im Kalender.</p>
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

        <div id="highlight-addressA" className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-structure shadow-lg transition-all">
          <div className="flex justify-between items-center mb-4 border-b border-structure pb-2">
            <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
              Beladeadresse (A)
              {!!(logistics.a_street && logistics.a_houseNr && logistics.a_zip && logistics.a_city) && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
            </h2>
            <button onClick={() => copyCustomerAddress('a')} className="text-xs btn-secondary py-1 px-2">Kundenadresse übernehmen</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Straße</label><input id="input-a_street" type="text" value={logistics.a_street} onChange={e => setLogistics({...logistics, a_street: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1"><label className="block text-xs text-text-muted mb-1">Haus-Nr.</label><input id="input-a_houseNr" type="text" value={logistics.a_houseNr} onChange={e => setLogistics({...logistics, a_houseNr: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1">
              <label className="block text-xs text-text-muted mb-1">PLZ</label>
              <input id="input-a_zip" type="text" value={logistics.a_zip} onChange={async (e) => {
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
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Ort</label><input id="input-a_city" type="text" value={logistics.a_city} onChange={e => setLogistics({...logistics, a_city: e.target.value})} className="input-field w-full" /></div>
            
            <div id="highlight-floorA" className="col-span-2 transition-all rounded-lg"><label className="block text-xs text-text-muted mb-1">Etage</label><input id="input-a_floor" type="text" list="floors" value={logistics.a_floor} onChange={e => setLogistics({...logistics, a_floor: e.target.value})} className="input-field w-full" placeholder="Auswählen oder tippen..." /></div>
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

        <div id="highlight-addressB" className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-structure shadow-lg transition-all">
          <div className="flex justify-between items-center mb-4 border-b border-structure pb-2">
            <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
              Entladeadresse (B)
              {!!(logistics.b_street && logistics.b_houseNr && logistics.b_zip && logistics.b_city) && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
            </h2>
            <button onClick={() => copyCustomerAddress('b')} className="text-xs btn-secondary py-1 px-2">Kundenadresse übernehmen</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Straße</label><input id="input-b_street" type="text" value={logistics.b_street} onChange={e => setLogistics({...logistics, b_street: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1"><label className="block text-xs text-text-muted mb-1">Haus-Nr.</label><input id="input-b_houseNr" type="text" value={logistics.b_houseNr} onChange={e => setLogistics({...logistics, b_houseNr: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1">
              <label className="block text-xs text-text-muted mb-1">PLZ</label>
              <input id="input-b_zip" type="text" value={logistics.b_zip} onChange={async (e) => {
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
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Ort</label><input id="input-b_city" type="text" value={logistics.b_city} onChange={e => setLogistics({...logistics, b_city: e.target.value})} className="input-field w-full" /></div>
            
            <div id="highlight-floorB" className="col-span-2 transition-all rounded-lg"><label className="block text-xs text-text-muted mb-1">Etage</label><input id="input-b_floor" type="text" list="floors" value={logistics.b_floor} onChange={e => setLogistics({...logistics, b_floor: e.target.value})} className="input-field w-full" placeholder="Auswählen oder tippen..." /></div>
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

        {/* Section 3: Routen-Details (from Mockups) */}
        <section className="col-span-1 lg:col-span-2 glass-panel p-6 md:p-8 rounded-2xl shadow-xl border border-structure">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-2xl">map</span>
              </div>
              <div>
                <h3 className="text-xl font-headline font-bold text-text-main">Routen-Details</h3>
                <p className="text-xs text-text-muted font-display uppercase tracking-widest font-bold">Distanz &amp; Logistik-Check</p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Distanz</span>
                <span className="text-2xl font-headline font-extrabold text-[#D91E2A] dark:text-red-400">
                  {routeInfo ? `${routeInfo.distanceKm} km` : '— km'}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Dauer (LKW)</span>
                <span className="text-2xl font-headline font-extrabold text-sky-600 dark:text-sky-400">
                  {routeInfo ? `~${Math.floor(routeInfo.durationMinutes / 60)}:${(routeInfo.durationMinutes % 60).toString().padStart(2, '0')} h` : '— h'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-structure">
            <button 
              type="button"
              onClick={handleCalculateRoute}
              disabled={isCalculatingRoute}
              className="py-2.5 px-6 bg-primary text-white text-xs font-bold rounded-full hover:brightness-110 transition-all flex items-center gap-2 shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">directions_car</span>
              {isCalculatingRoute ? "Berechne Route..." : "Strecke & Fahrzeit berechnen"}
            </button>
            <a 
              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${logistics.a_street || ''} ${logistics.a_houseNr || ''}, ${logistics.a_zip || ''} ${logistics.a_city || ''}`)}&destination=${encodeURIComponent(`${logistics.b_street || ''} ${logistics.b_houseNr || ''}, ${logistics.b_zip || ''} ${logistics.b_city || ''}`)}`}
              target="_blank" 
              rel="noreferrer" 
              className="py-2.5 px-6 bg-slate-100 dark:bg-slate-800 text-text-main text-xs font-bold rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 border border-structure"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              Auf Google Maps öffnen
            </a>
            {routeError && (
              <span className="text-xs text-red-500 font-medium pl-2">{routeError}</span>
            )}
          </div>
        </section>
      </section>

      
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-structure pb-4">
            <div>
              <h2 className="text-2xl font-headline font-bold text-text-main flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_task</span>
                Leistungen &amp; Finanzen
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Dienstleistungsauswahl nach Belade- und Entladestelle sowie Kostenkalkulation.
              </p>
            </div>
            <label className={`flex items-center gap-2 bg-white/[0.03] px-3.5 py-2 rounded-xl border border-structure shadow-sm ${!canEditPrices ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input 
                type="checkbox" 
                checked={isFlatRate} 
                onChange={e => setIsFlatRate(e.target.checked)} 
                disabled={!canEditPrices} 
                className="accent-primary w-4 h-4 rounded" 
              />
              <span className="text-xs font-bold text-text-main">Pauschalangebot (Festpreis)</span>
            </label>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Left: Quick Service Selection A vs B */}
            <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
              <div className="bg-bg-card rounded-2xl p-6 border border-structure shadow-md">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-headline font-bold flex items-center gap-2 text-text-main">
                    <span className="material-symbols-outlined text-primary">touch_app</span>
                    Leistungsauswahl (Schnell-Auswahl)
                  </h3>
                  <span className="bg-primary/10 text-primary text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                    Belade- vs. Entladestelle
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Beladestelle (A) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-structure/50">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                        A
                      </span>
                      <h4 className="font-headline font-bold text-xs uppercase tracking-wider text-text-main">
                        Beladestelle
                      </h4>
                    </div>
                    <div className="flex flex-col gap-2">
                      {STANDARD_SERVICES_A.map((svc) => {
                        const isSelected = isStandardServiceSelected(svc.name);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => toggleStandardService(svc)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30 font-bold'
                                : 'border-structure/80 bg-white/[0.02] text-text-main hover:bg-white/[0.05] hover:border-structure'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-primary' : 'text-text-muted'}`}>
                                {svc.icon}
                              </span>
                              <span className="text-xs font-semibold">{svc.name}</span>
                            </div>
                            <span className={`material-symbols-outlined text-base ${isSelected ? 'text-primary' : 'text-text-muted/60'}`}>
                              {isSelected ? 'check_circle' : 'add_circle'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Entladestelle (B) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-structure/50">
                      <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                        B
                      </span>
                      <h4 className="font-headline font-bold text-xs uppercase tracking-wider text-text-main">
                        Entladestelle
                      </h4>
                    </div>
                    <div className="flex flex-col gap-2">
                      {STANDARD_SERVICES_B.map((svc) => {
                        const isSelected = isStandardServiceSelected(svc.name);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => toggleStandardService(svc)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30 font-bold'
                                : 'border-structure/80 bg-white/[0.02] text-text-main hover:bg-white/[0.05] hover:border-structure'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-primary' : 'text-text-muted'}`}>
                                {svc.icon}
                              </span>
                              <span className="text-xs font-semibold">{svc.name}</span>
                            </div>
                            <span className={`material-symbols-outlined text-base ${isSelected ? 'text-primary' : 'text-text-muted/60'}`}>
                              {isSelected ? 'check_circle' : 'add_circle'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* System Tip */}
                <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-300 flex items-start gap-3">
                  <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">info</span>
                  <div className="text-xs leading-relaxed">
                    <p className="font-headline font-bold">Tipp vom System</p>
                    <p className="opacity-90">
                      Halteverbotszonen für A und B werden bei Auswahl automatisch auf die Mitarbeiter-Laufzettel und die Fristen-Erinnerung gesetzt.
                    </p>
                  </div>
                </div>

                {/* Full Catalog Toggle */}
                <div className="mt-4 pt-4 border-t border-structure/60 flex items-center justify-between">
                  <span className="text-xs text-text-muted">
                    Spezielle Materialien, Packmittel oder individuelle Sonderleistungen?
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFullCatalog(!showFullCatalog)}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {showFullCatalog ? 'expand_less' : 'expand_more'}
                    </span>
                    {showFullCatalog ? 'Katalog einklappen' : 'Vollständigen Katalog öffnen'}
                  </button>
                </div>

                {/* Expandable Full POS Catalog */}
                {showFullCatalog && (
                  <div className="mt-4 pt-4 border-t border-structure/40 space-y-4 animate-in fade-in duration-200">
                    <div className="relative">
                      <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input 
                        type="text" 
                        placeholder="Leistungen suchen (z.B. Karton, Klavier)..." 
                        value={catalogSearch} 
                        onChange={e => setCatalogSearch(e.target.value)} 
                        className="input-field w-full pl-10 py-2.5 rounded-xl bg-black/20 text-xs shadow-inner" 
                      />
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5">
                      <button 
                        onClick={() => setActiveCategoryTab('Alle')} 
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${activeCategoryTab === 'Alle' ? 'bg-primary text-white' : 'bg-structure/50 text-text-muted hover:bg-structure'}`}
                      >
                        Alle
                      </button>
                      {settings.catalog?.map((cat:any) => (
                        <button 
                          key={cat.category} 
                          onClick={() => setActiveCategoryTab(cat.category)} 
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${activeCategoryTab === cat.category ? 'bg-primary text-white' : 'bg-structure/50 text-text-muted hover:bg-structure'}`}
                        >
                          {cat.category}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                      {settings.catalog?.flatMap((cat:any) => cat.items.map((item:any) => ({ ...item, category: cat.category }))).filter((item:any) => {
                        const matchesSearch = (item.name||'').toLowerCase().includes((catalogSearch||'').toLowerCase());
                        const matchesCat = activeCategoryTab === 'Alle' || item.category === activeCategoryTab;
                        return matchesSearch && matchesCat;
                      }).map((item:any, idx:number) => (
                        <button 
                          key={idx} 
                          type="button"
                          onClick={() => addServiceFromCatalog(item)} 
                          className="bg-bg-dark/80 border border-white/10 hover:border-primary hover:bg-primary/10 rounded-xl p-2.5 flex flex-col items-center text-center gap-1.5 transition-all text-xs"
                        >
                          <span className="font-semibold text-text-main line-clamp-1">{item.name}</span>
                          <span className="text-[10px] text-text-muted">
                            {!isFlatRate && (item.price || item.defaultPrice || 0) > 0 ? `${(item.price || item.defaultPrice).toFixed(2)} €` : 'Katalog'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Preiskalkulation & Total Summary Card */}
            <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
              {/* Preiskalkulation Table */}
              <div className="bg-bg-card rounded-2xl border border-structure shadow-md overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 bg-white/[0.03] flex items-center justify-between border-b border-structure">
                  <h3 className="text-sm font-headline font-bold flex items-center gap-2 text-text-main">
                    <span className="material-symbols-outlined text-blue-400 text-lg">calculate</span>
                    Preiskalkulation
                  </h3>
                  <span className="text-[11px] font-bold text-text-muted bg-structure/50 px-2 py-0.5 rounded-full">
                    {services.length} Positionen
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-structure/40">
                  {services.length === 0 ? (
                    <div className="p-8 text-center text-text-muted text-xs">
                      Keine Leistungen gewählt. Klicken Sie links auf Leistungen zum Hinzufügen.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-white/[0.01] text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-structure/40">
                          <th className="p-2.5 pl-4">Service</th>
                          <th className="p-2.5 text-center w-24">Menge</th>
                          <th className="p-2.5 pr-4 text-right w-24">Summe</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-structure/30">
                        {services.map((svc, idx) => (
                          <tr key={svc.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="p-2.5 pl-4">
                              <input
                                type="text"
                                value={svc.name}
                                onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                                className="bg-transparent font-medium text-text-main w-full focus:outline-none focus:bg-black/20 rounded px-1"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="inline-flex items-center gap-1 bg-structure/40 rounded-lg px-1.5 py-0.5">
                                <button 
                                  type="button"
                                  onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: Math.max(0, s.quantity - 1) } : s))} 
                                  className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-white font-bold"
                                >
                                  -
                                </button>
                                <span className="font-bold w-6 text-center text-text-main">{svc.quantity}</span>
                                <button 
                                  type="button"
                                  onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: s.quantity + 1 } : s))} 
                                  className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-white font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 pr-4 text-right font-bold text-text-main">
                              {!isFlatRate && canViewPrices ? `${(svc.quantity * svc.unitPrice).toFixed(2)} €` : '—'}
                            </td>
                            <td className="pr-2 text-right">
                              <button
                                type="button"
                                onClick={() => setServices(services.filter(s => s.id !== svc.id))}
                                className="text-text-muted hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="p-3 border-t border-structure/50 bg-white/[0.01]">
                  <button
                    type="button"
                    onClick={() => setServices([...services, { id: Date.now().toString(), name: 'Individuelle Leistung', quantity: 1, unitPrice: 0, unit: 'Pauschal' }])}
                    className="w-full py-2 border border-dashed border-structure rounded-xl text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold"
                  >
                    <PlusIcon className="w-4 h-4" /> Eigene Leistung hinzufügen
                  </button>
                </div>
              </div>

              {/* Red-Bordered BRUTTO GESAMT Summary Card */}
              <div className="relative overflow-hidden bg-bg-card border-2 border-primary/60 rounded-2xl shadow-xl p-6">
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col gap-4 relative z-10">
                  {isFlatRate && (
                    <div className="mb-2">
                      <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1 block">
                        Pauschalabrechnung (Netto)
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={flatRateNet} 
                          onChange={e => setFlatRateNet(parseFloat(e.target.value)||0)} 
                          disabled={!canEditPrices} 
                          className="input-field w-full text-right font-bold text-base pr-8 py-2" 
                          placeholder="0.00" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-text-muted text-sm">€</span>
                      </div>
                    </div>
                  )}

                  {canViewPrices ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-dashed border-structure/60 pb-1.5">
                        <span className="text-text-muted font-medium">Netto Summe</span>
                        <span className="text-text-main font-bold">{totals.net.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-dashed border-structure/60 pb-1.5">
                        <span className="text-text-muted font-medium">USt. (19%)</span>
                        <span className="text-text-main font-bold">{totals.tax.toFixed(2)} €</span>
                      </div>
                      <div className="flex flex-col gap-0.5 pt-2">
                        <span className="text-[10px] font-extrabold text-primary uppercase tracking-[0.2em]">
                          BRUTTO GESAMT
                        </span>
                        <span className="text-4xl font-headline font-black text-primary tracking-tight">
                          {totals.gross.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-text-muted text-xs italic py-2">
                      Preise ausgeblendet
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => saveOrder('draft', true)}
                      disabled={isSaving}
                      className="w-full py-3 bg-primary text-white rounded-xl font-headline font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">description</span>
                      <span>Angebot Erstellen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => saveOrder('draft', false)}
                      disabled={isSaving}
                      className="w-full py-2 bg-white/[0.04] text-text-main border border-structure/60 rounded-xl font-bold text-xs hover:bg-white/[0.08] transition-all"
                    >
                      Zwischenspeichern
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-structure pb-4">
            <div>
              <h2 className="text-2xl font-headline font-bold text-text-main flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">inventory_2</span>
                Inventar &amp; Ladevolumen
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Raumbasierte Schnell-Erfassung von Möbeln &amp; Kartons mit automatischer $m^3$- und LKW-Kalkulation.
              </p>
            </div>
            <label className="flex items-center gap-2 bg-white/[0.03] px-3.5 py-2 rounded-xl border border-structure shadow-sm cursor-pointer">
              <input 
                type="checkbox" 
                checked={appendInventoryToPDF} 
                onChange={e => setAppendInventoryToPDF(e.target.checked)} 
                className="accent-primary w-4 h-4 rounded" 
              />
              <span className="text-xs font-bold text-text-main">Inventarliste an PDF-Angebot anhängen</span>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Room Tabs & Furniture Catalog */}
            <div className="lg:col-span-8 space-y-6">
              {/* Section 1: Zimmer-Auswahl Tabs */}
              <div className="bg-bg-card rounded-2xl p-5 border border-structure shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-headline font-bold text-text-main flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">meeting_room</span>
                    1. Raum-Auswahl
                  </h3>
                  <span className="text-xs text-text-muted">
                    Ausgewählt: <strong className="text-primary">{selectedRoomTab}</strong>
                  </span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar">
                  {QUICK_ROOMS.map(room => {
                    const isSelected = selectedRoomTab === room.name;
                    const itemsInRoom = inventory.filter(i => (i.room || 'Wohnzimmer') === room.name).reduce((sum, i) => sum + i.quantity, 0);
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setSelectedRoomTab(room.name)}
                        className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 min-w-[95px] ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25 scale-[1.02]'
                            : 'bg-white/[0.02] border-structure/80 text-text-main hover:border-structure hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-white' : 'text-text-muted'}`}>
                          {room.icon}
                        </span>
                        <span className="text-xs font-bold">{room.name}</span>
                        {itemsInRoom > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/20 text-primary'}`}>
                            {itemsInRoom} Stk.
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Möbel-Katalog mit Zählern */}
              <div className="bg-bg-card rounded-2xl p-5 border border-structure shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-headline font-bold text-text-main flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">chair</span>
                    2. Möbel &amp; Umzugsgut für {selectedRoomTab}
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setInitialWizardRoom(null); setIsInventoryWizardOpen(true); }}
                    className="text-primary text-xs font-bold flex items-center gap-1 hover:underline"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    Detaillierter Assistent
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
                  {QUICK_FURNITURE.map(item => {
                    const count = getFurnitureCount(item.name, selectedRoomTab);
                    const isPicked = count > 0;
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col items-center text-center relative ${
                          isPicked
                            ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                            : 'border-structure/80 bg-white/[0.02] hover:border-structure hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-full mb-2 flex items-center justify-center transition-colors ${
                          isPicked ? 'bg-primary/20 text-primary' : 'bg-structure/50 text-text-muted'
                        }`}>
                          <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                        </div>
                        <p className="font-bold text-xs text-text-main mb-0.5 line-clamp-1">{item.name}</p>
                        <p className="text-[10px] text-text-muted mb-3 font-medium">~{item.cbm} m³</p>

                        <div className="flex items-center gap-2 w-full justify-between px-2 bg-structure/40 rounded-lg py-1 border border-white/5 mt-auto">
                          <button
                            type="button"
                            onClick={() => updateFurnitureCount(item, selectedRoomTab, -1)}
                            disabled={count === 0}
                            className="w-6 h-6 rounded-md bg-white/[0.05] hover:bg-white/10 text-text-main flex items-center justify-center font-bold text-xs disabled:opacity-30 transition-colors"
                          >
                            -
                          </button>
                          <span className={`font-black text-xs ${isPicked ? 'text-primary' : 'text-text-muted'}`}>
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateFurnitureCount(item, selectedRoomTab, 1)}
                            className="w-6 h-6 rounded-md bg-primary text-white flex items-center justify-center font-bold text-xs hover:brightness-110 active:scale-95 transition-all shadow-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom / Add More Card */}
                  <div
                    onClick={() => { setInitialWizardRoom(null); setIsInventoryWizardOpen(true); }}
                    className="p-3.5 rounded-xl border-2 border-dashed border-structure/80 bg-white/[0.01] hover:bg-white/[0.04] hover:border-primary/50 transition-all flex flex-col items-center justify-center cursor-pointer text-center group min-h-[140px]"
                  >
                    <span className="material-symbols-outlined text-3xl text-text-muted group-hover:text-primary group-hover:scale-110 transition-all mb-1">
                      add_box
                    </span>
                    <p className="font-bold text-xs text-text-main">Eigener Gegenstand</p>
                    <p className="text-[10px] text-text-muted mt-0.5">Assistent öffnen</p>
                  </div>
                </div>
              </div>

              {/* Section 3: Erfasste Gegenstände Übersicht */}
              {inventory.length > 0 && (
                <div className="bg-bg-card rounded-2xl p-5 border border-structure shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-headline font-bold text-text-main flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">checklist</span>
                      Erfasstes Umzugsgut ({inventory.reduce((sum, i) => sum + i.quantity, 0)} Teile)
                    </h3>
                    <button
                      type="button"
                      onClick={() => setInventory([])}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      Alle leeren
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-structure/40 text-xs">
                    {inventory.map(item => (
                      <div key={item.id} className="py-2 px-1 flex items-center justify-between hover:bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-text-muted bg-structure/50 px-2 py-0.5 rounded">
                            {item.room || 'Allgemein'}
                          </span>
                          <span className="font-semibold text-text-main">{item.name}</span>
                          {(item.disassembly || item.assembly) && (
                            <span className="text-[10px] text-amber-400">
                              {[item.disassembly && 'Abbau', item.assembly && 'Aufbau'].filter(Boolean).join(' & ')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-primary">{item.quantity}x</span>
                          <button
                            type="button"
                            onClick={() => setInventory(inventory.filter(i => i.id !== item.id))}
                            className="text-text-muted hover:text-red-400 p-1"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Mitarbeiter-Checkliste */}
              <div className="bg-bg-card rounded-2xl p-5 border border-structure shadow-md">
                <div className="flex items-center justify-between mb-3 border-b border-structure pb-2">
                  <div>
                    <h3 className="text-sm font-headline font-bold text-text-main flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-400">assignment</span>
                      Mitarbeiter-Laufzettel &amp; Checkliste
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Wird automatisch auf dem Einsatzplan für die Umzugshelfer gedruckt.
                    </p>
                  </div>
                </div>
                <div className="space-y-2 mb-3">
                  {checklist.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-white/[0.02] border-structure/80 text-xs">
                      <button
                        type="button"
                        onClick={() => setChecklist(checklist.map(c => c.id === item.id ? { ...c, done: !c.done } : c))}
                        className="flex items-center gap-2.5 flex-1 text-left"
                      >
                        {item.done ? (
                          <CheckCircleIconSolid className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <CheckCircleIcon className="w-4 h-4 text-text-muted shrink-0" />
                        )}
                        <span className={`font-medium transition-all ${item.done ? 'text-text-muted line-through' : 'text-text-main'}`}>
                          {item.text}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChecklist(checklist.filter(c => c.id !== item.id))}
                        className="text-text-muted hover:text-red-400 p-1"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 relative">
                  <input
                    type="text"
                    value={newChecklistItem}
                    onChange={e => setNewChecklistItem(e.target.value)}
                    placeholder="Neuer Punkt (z.B. Klaviertragegurt bereitlegen)..."
                    className="input-field w-full pr-10 text-xs py-2"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newChecklistItem.trim()) {
                          setChecklist([...checklist, { id: Date.now().toString(), text: newChecklistItem.trim(), done: false }]);
                          setNewChecklistItem('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newChecklistItem.trim()) {
                        setChecklist([...checklist, { id: Date.now().toString(), text: newChecklistItem.trim(), done: false }]);
                        setNewChecklistItem('');
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary hover:text-primary-hover"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Live Summary, Loading Bar & Vehicle Selector */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-bg-card p-6 rounded-2xl border border-structure shadow-xl sticky top-24 space-y-6">
                <h3 className="text-base font-headline font-bold flex items-center gap-2 text-text-main border-b border-structure pb-3">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  Volumen &amp; LKW-Kalkulation
                </h3>

                {/* Key Metrics */}
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center border-b border-structure/40 pb-2">
                    <span className="text-text-muted">Erfasste Gegenstände</span>
                    <span className="font-bold text-text-main">{totalFurniturePieces} Stück</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-structure/40 pb-2">
                    <span className="text-text-muted">Empfohlene Fahrzeugklasse</span>
                    <span className="font-bold text-primary">
                      {calculateQuickCbm() <= 18 ? '1x Sprinter 3.5t' : calculateQuickCbm() <= 38 ? '1x LKW 7.5t' : '2x Fahrzeuge (LKW + Sprinter)'}
                    </span>
                  </div>
                </div>

                {/* Visual Loading Bar */}
                <div>
                  {(() => {
                    const activeCbm = calculateQuickCbm() > 0 ? calculateQuickCbm() : estimatedCbm || 0;
                    const maxCap = truckChoice === '1_transporter' ? 20 : truckChoice === '1_lkw' ? 35 : 65;
                    const pct = Math.min(100, Math.round((activeCbm / maxCap) * 100));
                    return (
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                            Ladekapazität ({truckChoice === '1_transporter' ? 'Sprinter' : '7.5t LKW'})
                          </span>
                          <span className="text-xs font-bold text-primary">{pct}%</span>
                        </div>
                        <div className="h-3.5 bg-structure/50 rounded-full overflow-hidden flex border border-white/5">
                          <div
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                          <div
                            className="bg-blue-400/30 h-full border-l border-white/20 transition-all duration-300"
                            style={{ width: `${Math.min(100 - pct, 15)}%` }}
                          />
                        </div>
                        <div className="flex gap-4 mt-2 text-[10px] text-text-muted">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary" /> Inventar ({activeCbm.toFixed(1)} m³)
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-400/50" /> Puffer (+15%)
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Total Volumen Highlight Box */}
                <div className="p-5 bg-primary/10 rounded-2xl border border-primary/30 text-center shadow-inner">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary mb-1">
                    Total Ladevolumen (m³)
                  </p>
                  <p className="text-5xl font-headline font-black text-primary tracking-tight">
                    {(calculateQuickCbm() > 0 ? calculateQuickCbm() : estimatedCbm || 0).toFixed(2)}
                  </p>
                  <p className="text-[11px] font-medium text-text-muted mt-1">
                    + {(((calculateQuickCbm() > 0 ? calculateQuickCbm() : estimatedCbm || 0) * 0.15)).toFixed(2)} m³ Sicherheitspuffer
                  </p>
                </div>

                {/* Schnell-Auswahl Fuhrpark */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-2">
                    Fahrzeugkategorie wählen
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: '1_transporter', label: 'Sprinter 3.5t', desc: '~15-20 m³' },
                      { id: '1_lkw', label: 'LKW 7.5t', desc: '~35 m³' },
                      { id: '2_lkw', label: '2x Fahrzeuge', desc: '~60 m³' },
                      { id: 'custom', label: 'Manuell', desc: 'Individuell' },
                    ].map(truck => (
                      <button
                        key={truck.id}
                        type="button"
                        onClick={() => setTruckChoice(truck.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          truckChoice === truck.id
                            ? 'border-primary bg-primary/15 text-primary font-bold shadow-sm'
                            : 'border-structure/80 bg-white/[0.02] text-text-muted hover:border-structure'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight">{truck.label}</div>
                        <div className="text-[10px] text-text-muted mt-0.5">{truck.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Next Step Controls */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-structure/60">
                  <button
                    type="button"
                    onClick={() => validateAndSetStep(5)}
                    className="w-full py-3.5 bg-primary text-white font-headline font-bold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-wider"
                  >
                    <span>Weiter zu Schritt 5: Abschluss</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => saveOrder('draft', false)}
                    disabled={isSaving}
                    className="w-full py-2.5 bg-white/[0.03] text-text-muted hover:text-text-main border border-structure/60 rounded-xl font-bold text-xs hover:bg-white/[0.06] transition-all"
                  >
                    Entwurf speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 5 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* Bento Grid Content */}
          <div className="grid grid-cols-12 gap-8">
            {/* Left Column: Kerndaten Bento Card */}
            <div className="col-span-12 lg:col-span-7 space-y-6">
              <div className="bg-bg-card rounded-2xl p-6 md:p-8 border border-structure shadow-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                <h3 className="text-lg font-headline font-bold text-text-main mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  Zusammenfassung der Kerndaten
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-6">
                  {/* Kunde */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">Kunde</p>
                    <p className="text-base font-bold text-text-main">{customerName || 'Neukunde'}</p>
                    <p className="text-xs text-text-muted">{customerEmail || 'Keine E-Mail angegeben'}</p>
                    <p className="text-xs text-text-muted">{customerPhone || 'Keine Telefonnummer'}</p>
                  </div>

                  {/* Termin */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">Umzugstermin</p>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">calendar_today</span>
                      <p className="text-base font-bold text-text-main">
                        {date ? new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Datum offen'}
                      </p>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      Beginn: {time || '08:00'} Uhr | Geschätzte Dauer: ~{calculatedDuration || 6}h
                    </p>
                  </div>

                  {/* Route & Logistik */}
                  <div className="col-span-1 sm:col-span-2 pt-4 border-t border-structure/60">
                    <p className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-3">Route &amp; Logistik</p>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                          <div className="w-0.5 h-8 bg-structure" />
                          <div className="w-2.5 h-2.5 rounded-full border-2 border-primary" />
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-bold text-text-main">{fromAddress || 'Beladestelle nicht erfasst'}</p>
                            <p className="text-[11px] text-text-muted">
                              Auszug: {fromFloor || 'EG'}, {hasElevatorA ? 'mit Fahrstuhl' : 'kein Fahrstuhl'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-main">{toAddress || 'Entladestelle nicht erfasst'}</p>
                            <p className="text-[11px] text-text-muted">
                              Einzug: {toFloor || 'EG'}, {hasElevatorB ? 'mit Fahrstuhl' : 'kein Fahrstuhl'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {distanceKm ? (
                        <div className="bg-white/[0.03] border border-structure rounded-xl p-3 text-center sm:min-w-[110px] shrink-0 self-start">
                          <p className="text-[10px] font-bold text-text-muted uppercase">Distanz</p>
                          <p className="text-base font-headline font-bold text-primary">{distanceKm} km</p>
                          {distanceDuration && (
                            <p className="text-[10px] text-text-muted mt-0.5">~{distanceDuration}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Gesamtpreis Box */}
                  <div className="col-span-1 sm:col-span-2 pt-5 border-t border-structure/60 bg-primary/10 -mx-6 md:-mx-8 -mb-6 md:-mb-8 px-6 md:px-8 py-5 rounded-b-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                          Voraussichtlicher Gesamtpreis (Brutto)
                        </p>
                        <p className="text-xs text-text-muted">
                          Inkl. 19% MwSt. ({totals.tax.toFixed(2)} €), Haftung &amp; Transportversicherung
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-3xl sm:text-4xl font-headline font-black text-primary tracking-tight">
                          {totals.gross.toFixed(2)} €
                        </p>
                        <p className="text-[10px] font-bold text-text-muted uppercase">
                          Netto: {totals.net.toFixed(2)} €
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plausibilität Bestätigung Banner */}
              <div className="bg-white/[0.02] rounded-2xl p-5 border border-structure shadow-sm flex items-center justify-between gap-4">
                <div className="flex gap-3.5 items-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <span className="material-symbols-outlined text-2xl">verified</span>
                  </div>
                  <div>
                    <h4 className="text-text-main font-headline font-bold text-sm">Angebot ist abschlussbereit</h4>
                    <p className="text-text-muted text-xs">Alle Logistik- und Tarifangaben sind vollständig hinterlegt.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => saveOrder('draft', false)}
                  disabled={isSaving}
                  className="bg-primary/15 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                >
                  Entwurf sichern
                </button>
              </div>

              {/* Manuelle / Externe Vertragsbestätigung Toggle */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircleIconSolid className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-emerald-400 block">
                      Bereits unterschrieben / bestätigt (WhatsApp oder Ausdruck)
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Setzt den Status sofort auf "Bestätigt" ohne digitalen Signatur-Link.
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isManuallySigned}
                    onChange={(e) => setIsManuallySigned(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Right Column: Dokumenten-Vorschau & Texte */}
            <div className="col-span-12 lg:col-span-5 space-y-6">
              <div className="bg-bg-card rounded-2xl p-6 border border-structure shadow-md flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-headline font-bold text-text-main flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">preview</span>
                    Dokumenten-Vorschau
                  </h3>
                  <div className="flex gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => window.print()} 
                      className="p-1.5 bg-white/[0.04] hover:bg-white/10 rounded-lg border border-structure text-text-muted hover:text-white transition-colors"
                      title="Drucken / PDF erzeugen"
                    >
                      <span className="material-symbols-outlined text-base">print</span>
                    </button>
                  </div>
                </div>

                {/* Simulated PDF Preview Paper */}
                <div 
                  onClick={() => window.print()}
                  className="flex-grow bg-white/[0.03] rounded-xl border border-dashed border-structure/80 p-6 flex flex-col justify-between cursor-pointer group hover:border-primary/50 transition-colors min-h-[260px] relative overflow-hidden"
                >
                  <div className="flex justify-between items-start border-b border-structure/40 pb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Rothirsch Logistics</span>
                      <p className="text-xs font-bold text-text-main mt-0.5">Umzugsangebot</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-base">local_shipping</span>
                    </div>
                  </div>

                  <div className="space-y-2 py-4 text-[11px] text-text-muted">
                    <div className="flex justify-between">
                      <span>Kunde:</span>
                      <span className="font-semibold text-text-main">{customerName || 'Herr/Frau Kunde'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Umzugsdatum:</span>
                      <span className="font-semibold text-text-main">{date || 'Termin offen'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Positionen:</span>
                      <span className="font-semibold text-text-main">{services.length} Einzelleistungen</span>
                    </div>
                    <div className="flex justify-between border-t border-structure/30 pt-2 font-bold text-text-main">
                      <span>Gesamt:</span>
                      <span className="text-primary">{totals.gross.toFixed(2)} €</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-structure/40 flex items-center justify-between text-[10px] text-text-muted">
                    <span>Rechtsgültiges Firmenangebot</span>
                    <span className="text-primary font-bold group-hover:underline flex items-center gap-1">
                      Klicken zum Drucken
                      <span className="material-symbols-outlined text-xs">north_east</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 text-xs">
                  <span className="material-symbols-outlined text-primary text-xl">description</span>
                  <div className="flex-grow min-w-0">
                    <p className="font-bold text-text-main truncate">
                      Angebot_{customerName ? customerName.replace(/\s+/g, '_') : 'Rothirsch'}_{new Date().getFullYear()}.pdf
                    </p>
                    <p className="text-[10px] text-text-muted">
                      Generiert &amp; druckbereit • Automatische Signaturzeile enthalten
                    </p>
                  </div>
                </div>

                {/* Collapsible Document Texts & Conditions */}
                <details className="mt-4 pt-4 border-t border-structure/50 group">
                  <summary className="text-xs font-bold text-text-muted hover:text-text-main cursor-pointer flex items-center justify-between">
                    <span>Dokumententexte &amp; Zahlungsbedingungen anpassen</span>
                    <span className="material-symbols-outlined text-sm group-open:rotate-180 transition-transform">expand_more</span>
                  </summary>
                  <div className="space-y-3 pt-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Einleitungstext</label>
                        <button type="button" onClick={loadStandardTexts} className="text-[10px] text-primary hover:underline">Standard laden</button>
                      </div>
                      <textarea
                        value={texts.quoteIntro}
                        onChange={e => setTexts({...texts, quoteIntro: e.target.value})}
                        className="input-field w-full h-16 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Zahlungsbedingungen</label>
                      <textarea
                        value={texts.paymentTerms}
                        onChange={e => setTexts({...texts, paymentTerms: e.target.value})}
                        className="input-field w-full h-14 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Schlusshinweise</label>
                      <textarea
                        value={texts.quoteOutro}
                        onChange={e => setTexts({...texts, quoteOutro: e.target.value})}
                        className="input-field w-full h-16 text-xs"
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* Section 3: 3 Large Action Cards */}
            <div className="col-span-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Action 1: Save */}
                <button
                  type="button"
                  onClick={() => saveOrder(isInvoice ? 'invoice_open' : 'draft', false)}
                  disabled={isSaving}
                  className="group flex flex-col items-center justify-center gap-3 p-6 bg-bg-card rounded-2xl border border-structure hover:border-primary transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-2xl">save</span>
                  </div>
                  <div>
                    <p className="font-headline font-bold text-sm text-text-main">Angebot speichern</p>
                    <p className="text-xs text-text-muted mt-0.5">In der Datenbank archivieren</p>
                  </div>
                </button>

                {/* Action 2: Download / Print */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="group flex flex-col items-center justify-center gap-3 p-6 bg-bg-card rounded-2xl border border-structure hover:border-primary transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-2xl">download</span>
                  </div>
                  <div>
                    <p className="font-headline font-bold text-sm text-text-main">PDF herunterladen</p>
                    <p className="text-xs text-text-muted mt-0.5">Lokal drucken oder als PDF sichern</p>
                  </div>
                </button>

                {/* Action 3: Email */}
                <button
                  type="button"
                  onClick={() => {
                    const subject = encodeURIComponent(`Ihr Umzugsangebot von Rothirsch - ${customerName || ''}`);
                    const body = encodeURIComponent(`Guten Tag ${customerName || ''},\n\nanbei erhalten Sie das Angebot für Ihren bevorstehenden Umzug.\nGesamtbetrag: ${totals.gross.toFixed(2)} €.\n\nMit freundlichen Grüßen\nIhr Rothirsch Team`);
                    window.location.href = `mailto:${customerEmail || ''}?subject=${subject}&body=${body}`;
                  }}
                  className="group flex flex-col items-center justify-center gap-3 p-6 bg-primary/10 rounded-2xl border border-primary/30 hover:border-primary transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                    <span className="material-symbols-outlined text-2xl">alternate_email</span>
                  </div>
                  <div>
                    <p className="font-headline font-bold text-sm text-primary">E-Mail an Kunden</p>
                    <p className="text-xs text-text-muted mt-0.5">Angebot direkt versenden</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Docked Material Action Bar (Mobile & Desktop Ergonomic) */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-[70] bg-bg-panel/98 backdrop-blur-xl border-t border-structure shadow-[0_-8px_30px_rgba(0,0,0,0.35)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-all">
        {errorMessage && (
          <div className="max-w-7xl mx-auto mb-2">
            <span className="text-red-400 text-xs font-semibold bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 block text-center">
              {errorMessage}
            </span>
          </div>
        )}

        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* LEFT: Zurück or Abbrechen */}
          <div className="flex items-center gap-2 shrink-0">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => prev - 1)}
                disabled={isSaving}
                className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold font-headline bg-structure/50 hover:bg-structure text-text-main transition-all flex items-center gap-1.5 border border-structure active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Zurück</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (urlCustomerId) router.push(`/dashboard/customers/${urlCustomerId}`);
                  else router.push('/dashboard/orders');
                }}
                disabled={isSaving}
                className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold font-headline text-text-muted hover:text-text-main transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                <span className="hidden xs:inline">Abbrechen</span>
              </button>
            )}
          </div>

          {/* CENTER: Step Indicator & Quick Save */}
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-[11px] font-bold font-headline uppercase tracking-wider text-text-muted px-2.5 py-1 rounded-full bg-structure/40 border border-structure hidden xs:inline-block">
              Schritt {currentStep}/5
            </span>

            <button
              type="button"
              onClick={() => saveOrder(isInvoice ? 'invoice_open' : 'draft', false)}
              disabled={isSaving}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold font-headline bg-structure/40 hover:bg-structure text-text-main transition-all flex items-center gap-1.5 border border-structure cursor-pointer active:scale-95"
              title="Als Entwurf zwischenspeichern"
            >
              {isSaving ? (
                <span className="w-3.5 h-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-sm text-primary">save</span>
              )}
              <span className="hidden sm:inline">{isSaving ? 'Speichert...' : 'Entwurf speichern'}</span>
              <span className="sm:hidden">{isSaving ? '...' : 'Speichern'}</span>
            </button>
          </div>

          {/* RIGHT: Weiter or Buchen (Primary Action) */}
          <div className="flex items-center gap-2 shrink-0">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => validateAndSetStep(currentStep + 1)}
                disabled={isSaving}
                className="btn-primary px-4 sm:px-6 py-2 rounded-xl text-xs font-bold font-headline flex items-center gap-1.5 shadow-md shadow-primary/30 active:scale-95 transition-all cursor-pointer"
              >
                <span>Weiter</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => saveOrder('confirmed', true)}
                disabled={isSaving}
                className="bg-primary hover:brightness-110 text-white px-5 sm:px-7 py-2.5 rounded-xl font-headline font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-primary/40 active:scale-95 transition-all cursor-pointer"
              >
                {isSaving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-base">check_circle</span>
                )}
                <span>Umzug buchen 🚀</span>
              </button>
            )}
          </div>
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
