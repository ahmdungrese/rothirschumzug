"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { PlusIcon, TrashIcon, CalculatorIcon, DocumentTextIcon, CheckCircleIcon, ArchiveBoxIcon, WrenchIcon, SparklesIcon, PlusCircleIcon, TagIcon, TruckIcon, MapPinIcon, CalendarDaysIcon, LockClosedIcon, ArrowPathIcon, ExclamationTriangleIcon, ClipboardDocumentListIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { toast } from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import {
  calculateOrderTotals,
  isInvoiceCancelled,
  findActiveLinkedInvoice,
  getActiveInvoiceNumber,
  getLatestCancelledInvoiceNumber,
} from '@/lib/financeHelpers';
import { StornoModal } from '@/components/finances/StornoModal';
import { getServiceIcon } from './OrderEditor';
import { autoCompletePreMoveTasks } from '@/lib/taskStateController';

const STANDARD_SERVICES_A = [
  { id: 'kartonlieferung', name: 'Kartonlieferung vorab', price: 65, unit: 'pauschal', icon: 'inventory_2', defaultDesc: 'Anlieferung von Umzugskartons und Packmaterial vor dem Umzugstermin.' },
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
  { id: 'hvz_b', name: 'Halteverbot B', price: 95, unit: 'Zone', icon: 'signpost', defaultDesc: 'Einrichtung einer temporären Halteverbotszone (ca. 15m) an der Entladestelle inkl. behördlicher Genehmigung.' },
  { id: 'entsorgung', name: 'Müllentsorgung', price: 120, unit: 'pauschal', icon: 'delete', defaultDesc: 'Fachgerechte Entsorgung von Verpackungsmaterial und Restmüll.' }
];

const DEFAULT_ALLGEMEIN_SERVICES = [
  { id: 'trans_all', name: 'Transport inkl. Be- und Entladung, Umzugspersonal & Fahrzeugkosten', price: 0, unit: 'Pauschal', icon: 'local_shipping', defaultDesc: 'Bereitstellung von LKW, Fachpersonal und vollständige Be- und Entladung.' },
  { id: 'ein_auspack_all', name: 'Ein- und Auspackservice (inkl. Kartons & Schutzmaterial)', price: 0, unit: 'Pauschal', icon: 'inventory_2', defaultDesc: 'Fachgerechtes Ein- und Auspacken des gesamten Umzugsguts inkl. Schutzmaterial.' },
  { id: 'kartons_bereit', name: 'Kartons bereitstellen', price: 0, unit: 'Stk', icon: 'inventory_2', defaultDesc: 'Bereitstellung stabiler Umzugskartons vorab.' },
  { id: 'arbeitsplatte', name: 'Arbeitsplatte anpassen', price: 0, unit: 'Stk', icon: 'carpenter', defaultDesc: 'Fachgerechter Zuschnitt und Anpassung der Küchenarbeitsplatte.' },
  { id: 'kueche_komplett', name: 'Küchenauf- und abbau (inkl. Anpassung der Arbeitsplatte)', price: 0, unit: 'Pauschal', icon: 'countertops', defaultDesc: 'Fachgerechter Küchenauf- und abbau inklusive Anpassung der Arbeitsplatte.' },
  { id: 'trans_be_ent', name: 'Transport inkl. Be- und Entladung', price: 0, unit: 'Pauschal', icon: 'local_shipping', defaultDesc: 'Reiner Transport inkl. Be- und Entladung am Umzugstag.' },
  { id: 'personal_std', name: 'Umzugspersonal (Fahrer + Umzugshelfer)', price: 0, unit: 'Std', icon: 'groups', defaultDesc: 'Bereitstellung von erfahrenem Fachpersonal nach Aufwand.' },
  { id: 'fahrzeug_kraftstoff', name: 'Fahrzeugkosten (Kraftstoff)', price: 0, unit: 'Pauschal', icon: 'local_gas_station', defaultDesc: 'Kraftstoff- und Fahrzeugpauschale.' },
  { id: 'versicherung_basic', name: 'Versicherung Basic', price: 0, unit: 'Pauschal', icon: 'shield', defaultDesc: 'Gesetzliche Grundhaftung und Transportversicherung inklusive.' },
  { id: 'moebellift', name: 'Möbellift', price: 0, unit: 'Std', icon: 'elevator', defaultDesc: 'Einsatz eines Außenaufzugs für Etagenumzüge.' },
  { id: 'einlagerung', name: 'Einlagerung', price: 0, unit: 'm³', icon: 'warehouse', defaultDesc: 'Sichere und trockene Einlagerung des Umzugsguts.' },
  { id: 'kellerraeumung', name: 'Kellerräumung', price: 0, unit: 'Pauschal', icon: 'delete_sweep', defaultDesc: 'Besenreine Räumung und Entrümpelung des Kellerabteils.' },
  { id: 'garagenraeumung', name: 'Garagenräumung', price: 0, unit: 'Pauschal', icon: 'garage', defaultDesc: 'Besenreine Räumung und Entrümpelung der Garage.' },
  { id: 'lampen_montieren', name: 'Deckenlampen montieren', price: 0, unit: 'Stk', icon: 'lightbulb', defaultDesc: 'Fachgerechte Demontage und Montage von Deckenlampen.' },
  { id: 'einpacken_decken', name: 'Einpacken der Möbel mit Decken und Schutzfolien', price: 0, unit: 'Std', icon: 'layers', defaultDesc: 'Umfassender Möbelschutz mit Umzugsdecken und Stretchfolien.' }
];

export function InvoiceEditor({ orderId, sourceOrderId }: { orderId?: string, sourceOrderId?: string }) {
  const params = useParams();
  const urlCustomerId = params.id as string;
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const canEditPrices = profile?.role === 'admin' ? true : profile?.canEditPrices ?? true;
  const canViewPrices = profile?.role === 'admin' ? true : profile?.canViewPrices ?? true;
  
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [showFullCatalog, setShowFullCatalog] = useState(true);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [activeCatalogTab, setActiveCatalogTab] = useState('Alle');
  const [currentStep, setCurrentStep] = useState(1);
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const scrollToTop = () => {
    if (typeof window === 'undefined') return;
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
    document.body.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToTop();
  }, [currentStep]);

  const goToStep = (stepNum: number) => {
    if (stepNum > currentStepRef.current && typeof window !== 'undefined') {
      window.history.pushState({ invoiceStep: stepNum }, '');
    }
    setCurrentStep(stepNum);
    scrollToTop();
  };

  const handleStepBack = () => {
    if (currentStep > 1) {
      if (typeof window !== 'undefined' && window.history.state?.invoiceStep) {
        window.history.back();
      } else {
        setCurrentStep(prev => Math.max(1, prev - 1));
      }
      scrollToTop();
    }
  };

  const [resolvedCustomerId, setResolvedCustomerId] = useState<string | null>(urlCustomerId || null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const isBypassingCancelGuard = useRef(false);

  const executeExit = () => {
    isBypassingCancelGuard.current = true;
    setShowCancelModal(false);
    const targetCustId = resolvedCustomerId || urlCustomerId;
    if (targetCustId) {
      router.push(`/dashboard/customers/${targetCustId}`);
    } else {
      if (typeof window !== 'undefined' && document.referrer && document.referrer.includes(window.location.origin)) {
        router.back();
      } else {
        router.push('/dashboard');
      }
    }
  };

  const handleSafeCancel = () => {
    const isDirty = Boolean(
      flatRateNet > 0 ||
      services.length > 0 ||
      texts.quoteIntro ||
      customerData.lastName
    );

    if (isDirty) {
      setShowCancelModal(true);
      return;
    }

    executeExit();
  };

  const [status, setStatus] = useState('draft'); // invoice_open if final
  const [activeSourceOrderId, setActiveSourceOrderId] = useState<string | null>(sourceOrderId || null);
  const [resolvedInvoiceId, setResolvedInvoiceId] = useState<string | null>(orderId || null);
  const [existingInvoiceNumber, setExistingInvoiceNumber] = useState<string | null>(null);
  const [isKorrektur, setIsKorrektur] = useState(false);
  const [correctionFor, setCorrectionFor] = useState('');
  const [showStornoModal, setShowStornoModal] = useState(false);
  const [showEarlyCloseWarning, setShowEarlyCloseWarning] = useState(false);

  const isCancelled = status === 'invoice_cancelled' || status === 'canceled';
  const isFinalized = Boolean(existingInvoiceNumber || (status && status !== 'draft' && !isCancelled));
  const isLocked = isFinalized || isCancelled;

  // 1. Kundeninformationen
  const [customerData, setCustomerData] = useState({
    type: 'privat',
    firstName: '',
    lastName: '',
    salutation: '',
    email: '',
    phone: '',
    street: '',
    houseNr: '',
    zip: '',
    city: ''
  });

  const [orderMeta, setOrderMeta] = useState({
    invoiceDate: new Date().toISOString().split('T')[0],
    validUntil: '',
    paymentMethod: '',
    manager: profile?.displayName || ''
  });

  // 2. Leistungen
  const [isFlatRate, setIsFlatRate] = useState(false);
  const [flatRateNet, setFlatRateNet] = useState(0);
  const [services, setServices] = useState<{
    id: string;
    name: string;
    note?: string;
    quantity: number;
    unitPrice: number;
    unit: string;
    isIncluded?: boolean;
    location?: 'a' | 'b' | 'both';
  }[]>([]);
  
  // 3. MwSt Rechner
  const [calcInput, setCalcInput] = useState({ gross: 0, net: 0, tax: 0 });

  // 4. Texte
  const [texts, setTexts] = useState({
    quoteIntro: 'anbei erhalten Sie unsere Rechnung für die erbrachten Leistungen.',
    paymentTerms: '',
    quoteOutro: 'Wir bedanken uns für Ihren Auftrag.'
  });
  const [logistics, setLogistics] = useState<any>({
    from: { address: '', city: '', zip: '', floor: '', lift: 'Nein', parking: 'Nein' },
    to: { address: '', city: '', zip: '', floor: '', lift: 'Nein', parking: 'Nein' },
    distance: 0
  });

  const customerDataRef = useRef(customerData);
  customerDataRef.current = customerData;
  const flatRateNetRef = useRef(flatRateNet);
  flatRateNetRef.current = flatRateNet;
  const servicesRef = useRef(services);
  servicesRef.current = services;
  const textsRef = useRef(texts);
  textsRef.current = texts;

  // Intercept mobile hardware back button / swipe-back gesture
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (e: PopStateEvent) => {
      if (isBypassingCancelGuard.current) return;

      if (currentStepRef.current > 1) {
        setCurrentStep(prev => Math.max(1, prev - 1));
      } else {
        const isDirty = Boolean(
          flatRateNetRef.current > 0 ||
          servicesRef.current.length > 0 ||
          textsRef.current.quoteIntro ||
          customerDataRef.current.lastName
        );
        if (isDirty) {
          window.history.pushState({ invoiceStep: 1 }, '');
          setShowCancelModal(true);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      // 1. Load System Settings
      const settingsSnap = await getDoc(doc(db, 'system', 'settings'));
      let s: any = null;
      if (settingsSnap.exists()) {
        s = settingsSnap.data();
        setSettings(s);
        const intro = s.texts?.invoiceIntro || s.invoiceIntro;
        const outro = s.texts?.invoiceOutro || s.invoiceOutro;
        if (intro) setTexts(t => ({...t, quoteIntro: intro}));
        if (outro) setTexts(t => ({...t, quoteOutro: outro}));
        
        if (!orderId && !sourceOrderId && s.paymentMethods && s.paymentMethods.length > 0) {
          const defaultPm = s.paymentMethods.find((p: any) => p.isDefault) || s.paymentMethods[0];
          setOrderMeta(prev => ({...prev, paymentMethod: defaultPm.name}));
          setTexts(t => ({...t, paymentTerms: defaultPm.textInvoice || defaultPm.textQuote || ''}));
        }
      }

      // 2. Load Customer data (if new invoice and no source order)
      if (!orderId && !sourceOrderId && urlCustomerId) {
        const custSnap = await getDoc(doc(db, 'customers', urlCustomerId));
        if (custSnap.exists()) {
          const c = custSnap.data();
          setCustomerData({
            type: c.type || 'privat',
            firstName: c.firstName || '',
            lastName: c.lastName || '',
            salutation: c.salutation || '',
            email: c.email || '',
            phone: c.phone || '',
            street: c.street || '',
            houseNr: c.houseNr || '',
            zip: c.zip || '',
            city: c.city || ''
          });
        }
      }

      // 3. Load existing order or source order
      const idToLoad = orderId || sourceOrderId;
      if (idToLoad) {
        const [orderSnap, directInvSnap] = await Promise.all([
          getDoc(doc(db, 'orders', idToLoad)),
          getDoc(doc(db, 'invoices', idToLoad)),
        ]);

        if (orderSnap.exists()) {
          const orderData = { id: orderSnap.id, ...orderSnap.data() } as any;
          setActiveSourceOrderId(orderSnap.id);
          if (orderData.customerId) {
            setResolvedCustomerId(orderData.customerId);
          }

          // Also query all invoices linked to this order to distinguish active vs cancelled invoices
          let linkedInvs: any[] = [];
          try {
            const invQuerySnap = await getDocs(
              query(collection(db, 'invoices'), where('sourceOrderId', '==', orderSnap.id))
            );
            const byIdMap = new Map<string, any>();
            invQuerySnap.docs.forEach(d => byIdMap.set(d.id, { id: d.id, ...d.data() }));

            const custIdForQuery = orderData.customerId || urlCustomerId;
            if (custIdForQuery) {
              const custInvSnap = await getDocs(
                query(collection(db, 'invoices'), where('customerId', '==', custIdForQuery))
              );
              custInvSnap.docs.forEach(d => {
                const data = d.data() as any;
                if (
                  data.sourceOrderId === orderSnap.id ||
                  data.orderId === orderSnap.id ||
                  d.id === orderSnap.id ||
                  (orderData.invoiceNumber && data.invoiceNumber === orderData.invoiceNumber) ||
                  (orderData.activeInvoiceNumber && data.invoiceNumber === orderData.activeInvoiceNumber)
                ) {
                  byIdMap.set(d.id, { id: d.id, ...data });
                }
              });
            }
            linkedInvs = Array.from(byIdMap.values());
          } catch (qErr) {
            console.error('Error querying linked invoices in InvoiceEditor:', qErr);
          }

          const activeInvDoc = findActiveLinkedInvoice(orderData, linkedInvs);
          const nonStornoLinked = linkedInvs.filter((inv: any) => !inv.isStorno);
          const allLinkedCancelled = nonStornoLinked.length > 0 && nonStornoLinked.every((inv: any) => isInvoiceCancelled(inv));
          const latestCancelledNum = getLatestCancelledInvoiceNumber(orderData, linkedInvs);

          const baseDoc = activeInvDoc || orderData;

          if (baseDoc.customerData) setCustomerData(baseDoc.customerData);
          else if (baseDoc.billingAddress) setCustomerData(baseDoc.billingAddress);
          else if (orderData.customerData) setCustomerData(orderData.customerData);
          else if (orderData.billingAddress) setCustomerData(orderData.billingAddress);

          if (baseDoc.orderMeta || orderData.orderMeta) {
            setOrderMeta(prev => ({ ...prev, ...(orderData.orderMeta || {}), ...(baseDoc.orderMeta || {}) }));
          }
          if (baseDoc.logistics || orderData.logistics) {
            setLogistics(baseDoc.logistics || orderData.logistics);
          }
          if (baseDoc.isFlatRate !== undefined) setIsFlatRate(baseDoc.isFlatRate);
          if (baseDoc.flatRateNet !== undefined) setFlatRateNet(baseDoc.flatRateNet);
          if (baseDoc.services) setServices(baseDoc.services);
          if (baseDoc.calcInput) setCalcInput(baseDoc.calcInput);
          
          const savedTexts = activeInvDoc?.texts || {};
          const selectedMethod = activeInvDoc?.orderMeta?.paymentMethod || orderData?.orderMeta?.paymentMethod || s?.paymentMethods?.[0]?.name || '';
          let terms = savedTexts.paymentTerms;
          if (!terms && s?.paymentMethods?.length) {
            const pm = s.paymentMethods.find((p: any) => p.name === selectedMethod) || s.paymentMethods[0];
            terms = pm?.textInvoice || pm?.textQuote || '';
          }
          setTexts(prev => ({
            ...prev,
            ...savedTexts,
            ...(terms ? { paymentTerms: terms } : {})
          }));
          if (!baseDoc.orderMeta?.paymentMethod && !orderData.orderMeta?.paymentMethod && selectedMethod) {
            setOrderMeta(prev => ({ ...prev, paymentMethod: selectedMethod }));
          }

          if (activeInvDoc) {
            setResolvedInvoiceId(activeInvDoc.id);
            if (activeInvDoc.invoiceNumber) {
              setExistingInvoiceNumber(activeInvDoc.invoiceNumber);
              setStatus(activeInvDoc.status || 'invoice_open');
            } else {
              setExistingInvoiceNumber(null);
              setStatus('draft');
            }
            if (activeInvDoc.isKorrektur !== undefined) {
              setIsKorrektur(Boolean(activeInvDoc.isKorrektur));
              setCorrectionFor(activeInvDoc.correctionFor || '');
            } else if (latestCancelledNum) {
              setIsKorrektur(true);
              setCorrectionFor(latestCancelledNum);
            }
          } else if (!allLinkedCancelled && !isInvoiceCancelled(orderData) && getActiveInvoiceNumber(orderData)) {
            // Legacy order with active invoice directly on orders collection
            setResolvedInvoiceId(null);
            setExistingInvoiceNumber(getActiveInvoiceNumber(orderData));
            setStatus(orderData.status === 'invoice_paid' ? 'invoice_paid' : 'invoice_open');
            if (orderData.isKorrektur !== undefined) {
              setIsKorrektur(Boolean(orderData.isKorrektur));
              setCorrectionFor(orderData.correctionFor || '');
            }
          } else {
            // Creating a brand-new invoice or a Korrekturrechnung after Storno!
            setResolvedInvoiceId(null);
            setExistingInvoiceNumber(null);
            setStatus('draft');
            if (latestCancelledNum) {
              setIsKorrektur(true);
              setCorrectionFor(latestCancelledNum);
            } else if (orderData.isKorrektur !== undefined) {
              setIsKorrektur(Boolean(orderData.isKorrektur));
              setCorrectionFor(orderData.correctionFor || '');
            }
          }
        } else if (directInvSnap.exists()) {
          const o = directInvSnap.data();
          setResolvedInvoiceId(directInvSnap.id);
          if (o.customerId) {
            setResolvedCustomerId(o.customerId);
          }
          setStatus(o.status || 'draft');
          if (o.invoiceNumber) setExistingInvoiceNumber(o.invoiceNumber);

          if (o.customerData) setCustomerData(o.customerData);
          else if (o.billingAddress) setCustomerData(o.billingAddress);

          if (o.orderMeta) setOrderMeta(prev => ({ ...prev, ...o.orderMeta }));
          if (o.logistics) setLogistics(o.logistics);
          if (o.isFlatRate !== undefined) setIsFlatRate(o.isFlatRate);
          if (o.flatRateNet) setFlatRateNet(o.flatRateNet);
          if (o.services) setServices(o.services);
          if (o.calcInput) setCalcInput(o.calcInput);
          
          const savedTexts = o.texts || {};
          const selectedMethod = o.orderMeta?.paymentMethod || s?.paymentMethods?.[0]?.name || '';
          let terms = savedTexts.paymentTerms;
          if (!terms && s?.paymentMethods?.length) {
            const pm = s.paymentMethods.find((p: any) => p.name === selectedMethod) || s.paymentMethods[0];
            terms = pm?.textInvoice || pm?.textQuote || '';
          }
          setTexts(prev => ({
            ...prev,
            ...savedTexts,
            ...(terms ? { paymentTerms: terms } : {})
          }));
          if (!o.orderMeta?.paymentMethod && selectedMethod) {
            setOrderMeta(prev => ({ ...prev, paymentMethod: selectedMethod }));
          }
          if (o.isKorrektur !== undefined) {
            setIsKorrektur(Boolean(o.isKorrektur));
            setCorrectionFor(o.correctionFor || '');
          } else if (o.invoiceHistory && o.invoiceHistory.length > 0) {
            setIsKorrektur(true);
            const lastCancelled = o.invoiceHistory[o.invoiceHistory.length - 1];
            setCorrectionFor(lastCancelled?.invoiceNumber || '');
          }
          if (o.sourceOrderId) {
            setActiveSourceOrderId(o.sourceOrderId);
          }
        }
      }
    };
    init();
  }, [orderId, sourceOrderId, urlCustomerId]);

  // Ensure payment terms are automatically filled from selected/default payment method if empty
  useEffect(() => {
    if (isLocked || !settings?.paymentMethods || settings.paymentMethods.length === 0) return;

    if (!texts.paymentTerms || texts.paymentTerms.trim() === '') {
      const activeMethod = orderMeta.paymentMethod || settings.paymentMethods[0]?.name;
      const pm = settings.paymentMethods.find((p: any) => p.name === activeMethod) || settings.paymentMethods[0];
      if (pm) {
        const termsText = pm.textInvoice || pm.textQuote || '';
        if (termsText) {
          setTexts(prev => (prev.paymentTerms && prev.paymentTerms.trim() !== '') ? prev : { ...prev, paymentTerms: termsText });
        }
        if (!orderMeta.paymentMethod && pm.name) {
          setOrderMeta(prev => prev.paymentMethod ? prev : { ...prev, paymentMethod: pm.name });
        }
      }
    }
  }, [settings, orderMeta.paymentMethod, texts.paymentTerms, isLocked]);

  const addService = (template: any) => {
    if (isLocked) return;
    setServices(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: template.name || '',
      note: template.note || template.defaultDesc || '',
      quantity: template.quantity || 1,
      unitPrice: template.unitPrice ?? template.price ?? 0,
      unit: template.unit || 'Stk.',
      isIncluded: Boolean(template.isIncluded),
      location: template.location || 'both'
    }]);
  };

  const toggleStandardService = (srv: { id?: string; name: string; price?: number; defaultPrice?: number; unit?: string; defaultDesc?: string; description?: string }) => {
    if (isLocked) return;
    const srvName = (srv.name || '').trim();
    const existing = services.find(s => (srv.id && s.id === srv.id) || (s.name || '').trim().toLowerCase() === srvName.toLowerCase());
    if (existing) {
      setServices(prev => prev.filter(s => s.id !== existing.id));
    } else {
      setServices(prev => [...prev, {
        id: srv.id || (Date.now().toString() + Math.random().toString(36).substring(2, 6)),
        name: srvName,
        quantity: 1,
        unitPrice: srv.price ?? srv.defaultPrice ?? 0,
        unit: srv.unit || 'pauschal',
        note: srv.defaultDesc || srv.description || '',
        location: 'both'
      }]);
    }
  };

  const isStandardServiceSelected = (srvId?: string, srvName?: string) => {
    const targetName = (srvName || srvId || '').trim().toLowerCase();
    return services.some(s => (srvId && s.id === srvId) || (s.name || '').trim().toLowerCase() === targetName);
  };

  const getServiceQuantity = (srvId?: string, srvName?: string) => {
    const targetName = (srvName || srvId || '').trim().toLowerCase();
    return services.find(s => (srvId && s.id === srvId) || (s.name || '').trim().toLowerCase() === targetName)?.quantity || 0;
  };

  const allgemeinServices = useMemo(() => {
    const fromSettings = settings?.catalog?.find((c: any) => (c.category || '').trim().toLowerCase() === 'allgemein')?.items;
    if (fromSettings && Array.isArray(fromSettings) && fromSettings.length > 0) {
      return fromSettings.map((item: any, idx: number) => ({
        id: item.id || `allg_${idx}`,
        name: item.name,
        price: item.price ?? item.defaultPrice ?? 0,
        unit: item.unit || 'Pauschal',
        icon: item.icon || getServiceIcon(item.name),
        defaultDesc: item.description || item.defaultDesc || ''
      }));
    }
    return DEFAULT_ALLGEMEIN_SERVICES;
  }, [settings?.catalog]);

  const servicesA = useMemo(() => {
    const fromCatalogA = settings?.catalog?.find((c: any) => {
      const cat = (c.category || '').trim().toLowerCase();
      return cat.includes('beladestelle') || cat.includes('auszug') || cat === 'beladung (a)';
    })?.items;

    if (fromCatalogA && Array.isArray(fromCatalogA) && fromCatalogA.length > 0) {
      return fromCatalogA.map((item: any, idx: number) => ({
        id: item.id || `a_${idx}`,
        name: item.name,
        price: item.price ?? item.defaultPrice ?? 0,
        unit: item.unit || 'pauschal',
        icon: item.icon || getServiceIcon(item.name),
        defaultDesc: item.description || item.defaultDesc || ''
      }));
    }

    return STANDARD_SERVICES_A.map(base => {
      const match = settings?.catalog?.flatMap((c: any) => c.items || []).find((it: any) => 
        (it.name || '').trim().toLowerCase() === base.name.toLowerCase()
      );
      if (match) {
        return {
          ...base,
          price: match.price !== undefined ? match.price : base.price,
          unit: match.unit || base.unit,
          defaultDesc: match.description || match.defaultDesc || base.defaultDesc
        };
      }
      return base;
    });
  }, [settings?.catalog]);

  const servicesB = useMemo(() => {
    const fromCatalogB = settings?.catalog?.find((c: any) => {
      const cat = (c.category || '').trim().toLowerCase();
      return cat.includes('entladestelle') || cat.includes('einzug') || cat === 'entladung (b)';
    })?.items;

    if (fromCatalogB && Array.isArray(fromCatalogB) && fromCatalogB.length > 0) {
      return fromCatalogB.map((item: any, idx: number) => ({
        id: item.id || `b_${idx}`,
        name: item.name,
        price: item.price ?? item.defaultPrice ?? 0,
        unit: item.unit || 'pauschal',
        icon: item.icon || getServiceIcon(item.name),
        defaultDesc: item.description || item.defaultDesc || ''
      }));
    }

    return STANDARD_SERVICES_B.map(base => {
      const match = settings?.catalog?.flatMap((c: any) => c.items || []).find((it: any) => 
        (it.name || '').trim().toLowerCase() === base.name.toLowerCase()
      );
      if (match) {
        return {
          ...base,
          price: match.price !== undefined ? match.price : base.price,
          unit: match.unit || base.unit,
          defaultDesc: match.description || match.defaultDesc || base.defaultDesc
        };
      }
      return base;
    });
  }, [settings?.catalog]);

  const otherCatalogCategories = useMemo(() => {
    if (!settings?.catalog || !Array.isArray(settings.catalog)) {
      return ['Küchenservice', 'Kartonservice', 'Möbelservice'];
    }
    const cats = settings.catalog
      .map((c: any) => c.category)
      .filter((c: string) => {
        if (!c) return false;
        const lower = c.trim().toLowerCase();
        return lower !== 'allgemein' && !lower.includes('beladestelle') && !lower.includes('entladestelle');
      });
    return cats.length > 0 ? cats : ['Küchenservice', 'Kartonservice', 'Möbelservice'];
  }, [settings?.catalog]);

  const otherCatalogItems = useMemo(() => {
    if (!settings?.catalog || !Array.isArray(settings.catalog)) {
      return [
        { category: 'Küchenservice', name: 'Aufbauen Von Küche', price: 0, unit: 'Std' },
        { category: 'Küchenservice', name: 'Abbauen Von Küche', price: 0, unit: 'Std' },
        { category: 'Kartonservice', name: 'Einpackservice', price: 0, unit: 'Stk' },
        { category: 'Kartonservice', name: 'Auspackservice', price: 0, unit: 'Stk' },
        { category: 'Kartonservice', name: 'Ein- und Auspacken', price: 0, unit: 'Stk' },
        { category: 'Möbelservice', name: 'Montieren Von Möbel', price: 0, unit: 'Std' },
        { category: 'Möbelservice', name: 'Demontieren Von Möbel', price: 0, unit: 'Std' },
        { category: 'Möbelservice', name: 'Demontage und Montage von Möbel', price: 0, unit: 'Std' },
        { category: 'Möbelservice', name: 'Möbelmontage & -demontage (inkl. Schutzverpackung)', price: 0, unit: 'Std' }
      ];
    }
    return settings.catalog
      .filter((cat: any) => {
        const lower = (cat.category || '').trim().toLowerCase();
        return lower !== 'allgemein' && !lower.includes('beladestelle') && !lower.includes('entladestelle');
      })
      .flatMap((cat: any) =>
        (cat.items || []).map((item: any) => ({
          ...item,
          category: cat.category,
          icon: item.icon || getServiceIcon(item.name)
        }))
      );
  }, [settings?.catalog]);

  const filteredOtherCatalogItems = useMemo(() => {
    return otherCatalogItems.filter((item: any) => {
      const matchesSearch = !catalogSearch.trim() || 
        (item.name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(catalogSearch.toLowerCase());
      const matchesCat = activeCatalogTab === 'Alle' || item.category === activeCatalogTab;
      return matchesSearch && matchesCat;
    });
  }, [otherCatalogItems, activeCatalogTab, catalogSearch]);

  const calculateTotals = () => {
    let net = 0;
    if (isFlatRate) {
      net = Number(flatRateNet) || 0;
    } else {
      net = (services || []).reduce((acc, curr) => {
        if (curr?.isIncluded) return acc;
        return acc + ((Number(curr?.quantity) || 0) * (Number(curr?.unitPrice) || 0));
      }, 0);
    }
    const roundedNet = Math.round(net * 100) / 100;
    const tax = Math.round(roundedNet * 0.19 * 100) / 100;
    const gross = Math.round((roundedNet + tax) * 100) / 100;
    const totalsObj = { net: roundedNet, tax, gross };
    setCalcInput(totalsObj);
    return totalsObj;
  };

  useEffect(() => { calculateTotals(); }, [services, isFlatRate, flatRateNet]);

  const saveOrder = async (finalStatus: string = 'draft', forceEarlyClose: boolean = false) => {
    if (isLocked) {
      toast.error('Festgeschriebene oder stornierte Rechnungen können nicht direkt bearbeitet werden. Bitte stornieren Sie die Rechnung.');
      return;
    }
    if (!customerData.lastName) {
      toast.error('Bitte Nachnamen / Firmennamen eingeben');
      return;
    }

    if (finalStatus === 'invoice_open' && !existingInvoiceNumber && !forceEarlyClose && !isKorrektur) {
      const moveDateStr = (orderMeta as any)?.movingDateFrom || logistics?.movingDate;
      if (moveDateStr) {
        const moveD = new Date(String(moveDateStr).split('T')[0] + 'T00:00:00');
        const todayD = new Date();
        todayD.setHours(0, 0, 0, 0);
        if (!isNaN(moveD.getTime()) && moveD.getTime() > todayD.getTime()) {
          setShowEarlyCloseWarning(true);
          return;
        }
      }
    }
    
    setIsSaving(true);
    try {
      // Wir aktualisieren das Haupt-Kundenprofil absichtlich NICHT mehr aus dem Rechnungs-Editor,
      // damit abweichende Rechnungsadressen niemals die Stammdaten des Kunden überschreiben!

      const calculatedTotals = calculateTotals() || { net: 0, tax: 0, gross: 0 };

      const targetCustId = resolvedCustomerId || urlCustomerId || null;

      const payload: any = {
        type: 'invoice',
        status: finalStatus,
        customerId: targetCustId,
        sourceOrderId: activeSourceOrderId || null,
        customerName: customerData.type === 'firma' ? customerData.lastName : `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim(),
        customerData,
        orderMeta,
        logistics, // Include logistics in the invoice
        isFlatRate,
        flatRateNet,
        services,
        calcInput: {
          net: calculatedTotals.net || 0,
          tax: calculatedTotals.tax || 0,
          gross: calculatedTotals.gross || 0
        },
        totals: {
          net: calculatedTotals.net || 0,
          tax: calculatedTotals.tax || 0,
          gross: calculatedTotals.gross || 0
        },
        texts,
        isKorrektur: Boolean(isKorrektur),
        correctionFor: isKorrektur ? (correctionFor.trim() || null) : null,
        invoiceCancelled: false,
        isCanceled: false,
        updatedAt: serverTimestamp()
      };

      // Centralized finalizing logic for invoices
      if (existingInvoiceNumber) {
        payload.invoiceNumber = existingInvoiceNumber;
      }

      if (finalStatus === 'invoice_open' && !payload.invoiceNumber) {
        let assignedInvoiceNum = '';
        let parentDataCache: any = null;
        const targetInvoiceRef = resolvedInvoiceId ? doc(db, 'invoices', resolvedInvoiceId) : doc(collection(db, 'invoices'));

        const extractInvNum = (val: any): number => {
          if (!val) return 0;
          const m = String(val).match(/(\d+)/);
          return m ? parseInt(m[1], 10) : 0;
        };

        await runTransaction(db, async (t) => {
          // 1. ALL READS FIRST
          const settingsRef = doc(db, 'system', 'settings');
          const settingsSnap = await t.get(settingsRef);

          let parentOrderSnap = null;
          if (activeSourceOrderId) {
            const parentOrderRef = doc(db, 'orders', activeSourceOrderId);
            parentOrderSnap = await t.get(parentOrderRef);
          }

          // 2. DATA PREPARATION & CALCULATIONS (Ensure strictly greater than any cancelled invoice number)
          let maxPreviousNum = extractInvNum(correctionFor);
          if (parentOrderSnap && parentOrderSnap.exists()) {
            const pData = parentOrderSnap.data();
            parentDataCache = pData;
            if (!payload.customerId && pData.customerId) {
              payload.customerId = pData.customerId;
            }
            maxPreviousNum = Math.max(
              maxPreviousNum,
              extractInvNum(pData.invoiceNumber),
              extractInvNum(pData.activeInvoiceNumber),
              extractInvNum(pData.lastCancelledInvoiceNumber),
              extractInvNum(pData.cancelledInvoiceNumber)
            );
            if (Array.isArray(pData.invoiceHistory)) {
              pData.invoiceHistory.forEach((h: any) => {
                maxPreviousNum = Math.max(
                  maxPreviousNum,
                  extractInvNum(h?.invoiceNumber),
                  extractInvNum(h?.oldInvoiceNumber)
                );
              });
            }
          }

          const rawNext = settingsSnap.data()?.nextInvoiceNumber !== undefined ? Number(settingsSnap.data()?.nextInvoiceNumber) : 1771;
          const nextInvoiceNumber = Math.max(1771, rawNext || 1771, maxPreviousNum + 1);
          const invoiceNum = `R-${nextInvoiceNumber}`;
          assignedInvoiceNum = invoiceNum;

          const finalPayload = {
            ...payload,
            invoiceNumber: invoiceNum,
            createdAt: payload.createdAt || serverTimestamp(),
          };

          // 3. COMMIT INVOICE AND SETTINGS COUNTER ATOMICALLY
          t.set(targetInvoiceRef, finalPayload, { merge: true });
          t.set(settingsRef, { nextInvoiceNumber: nextInvoiceNumber + 1 }, { merge: true });
        });

        setResolvedInvoiceId(targetInvoiceRef.id);
        setExistingInvoiceNumber(assignedInvoiceNum);
        setStatus('invoice_open');

        // 4. SYNC PARENT ORDER (with graceful fallback if cloud rules restrict orders.invoiceNumber)
        if (activeSourceOrderId) {
          const parentOrderRef = doc(db, 'orders', activeSourceOrderId);
          const parentData = parentDataCache || {};
          const history = Array.isArray(parentData.invoiceHistory) ? [...parentData.invoiceHistory] : [];

          if (
            parentData.invoiceNumber &&
            parentData.invoiceNumber !== assignedInvoiceNum &&
            !history.some((h: any) => h?.invoiceNumber === parentData.invoiceNumber || h?.oldInvoiceNumber === parentData.invoiceNumber)
          ) {
            history.push({
              invoiceNumber: parentData.invoiceNumber,
              status: parentData.status || 'invoice_cancelled',
              date: new Date().toISOString()
            });
          }

          const baseParentUpdate: Record<string, any> = {
            activeInvoiceNumber: assignedInvoiceNum,
            invoiceCancelled: false,
            isCanceled: false,
            invoiceDate: new Date().toISOString(),
            status: 'invoice_open',
            'ticketStates.invoice': true,
            'checklistDone.invoice': true,
            invoiceHistory: history,
            totals: payload.totals,
            calcInput: payload.calcInput,
            services: payload.services || parentData.services || [],
            isKorrektur: payload.isKorrektur,
            correctionFor: payload.correctionFor,
            updatedAt: serverTimestamp()
          };

          try {
            await updateDoc(parentOrderRef, {
              ...baseParentUpdate,
              invoiceNumber: assignedInvoiceNum
            });
          } catch {
            try {
              await updateDoc(parentOrderRef, baseParentUpdate);
            } catch (fallbackErr) {
              console.error('Error syncing finalized invoice to parent order:', fallbackErr);
            }
          }
        }

        payload.invoiceNumber = assignedInvoiceNum;

        const editorActorName = profile?.displayName || profile?.email?.split('@')[0] || 'Mitarbeiter';
        const customerFullName = `${customerData?.firstName || ''} ${customerData?.lastName || 'Kunde'}`.trim();
        await logActivity(user?.uid || '', editorActorName, 'CREATE_INVOICE', `${isKorrektur ? 'Korrekturrechnung' : 'Rechnung'} ${payload.invoiceNumber} ausgestellt für Kunde ${customerFullName}`);
        toast.success(isKorrektur ? `Korrekturrechnung ${payload.invoiceNumber} erfolgreich ausgestellt!` : `Rechnung ${payload.invoiceNumber} erfolgreich ausgestellt!`);

        // Safely complete pre-move preparatory tasks for the linked order without data loss
        const linkedOrderToComplete = activeSourceOrderId || orderId || sourceOrderId;
        if (linkedOrderToComplete) {
          autoCompletePreMoveTasks(linkedOrderToComplete).catch(err => console.error('Error auto-completing pre-move tasks:', err));
        }
      } else if (finalStatus === 'invoice_open' && payload.invoiceNumber) {
        // Re-saving already finalized invoice
        const editorActorName = profile?.displayName || profile?.email?.split('@')[0] || 'Team';
        const invoiceRef = resolvedInvoiceId ? doc(db, 'invoices', resolvedInvoiceId) : doc(collection(db, 'invoices'));
        await setDoc(invoiceRef, payload, { merge: true });

        if (activeSourceOrderId) {
          try {
            await updateDoc(doc(db, 'orders', activeSourceOrderId), {
              activeInvoiceNumber: payload.invoiceNumber,
              invoiceCancelled: false,
              isCanceled: false,
              totals: payload.totals,
              calcInput: payload.calcInput,
              services: payload.services || [],
              isKorrektur: payload.isKorrektur,
              correctionFor: payload.correctionFor,
              updatedAt: serverTimestamp()
            });
          } catch (err) {
            console.error('Error syncing invoice to parent order:', err);
          }
        }
        await logActivity(user?.uid || '', editorActorName, 'UPDATE_ORDER', `Rechnung ${payload.invoiceNumber} aktualisiert`);
        toast.success(`Rechnung ${payload.invoiceNumber} aktualisiert!`);
      } else {
        const editorActorName = profile?.displayName || profile?.email?.split('@')[0] || 'Team';
        // Just save draft
        if (resolvedInvoiceId) {
          await setDoc(doc(db, 'invoices', resolvedInvoiceId), payload, { merge: true });
          await logActivity(user?.uid || '', editorActorName, 'UPDATE_ORDER', `Rechnungsentwurf bearbeitet`);
          toast.success('Rechnungsentwurf gespeichert!');
        } else {
          payload.createdAt = serverTimestamp();
          const newDocRef = await addDoc(collection(db, 'invoices'), payload);
          setResolvedInvoiceId(newDocRef.id);
          await logActivity(user?.uid || '', editorActorName, 'CREATE_ORDER', `Neuer Rechnungsentwurf für ${customerData.lastName}`);
          toast.success('Rechnungsentwurf erstellt!');
        }

        // Also sync draft totals to parent order if available
        if (activeSourceOrderId) {
          try {
            await updateDoc(doc(db, 'orders', activeSourceOrderId), {
              totals: payload.totals,
              calcInput: payload.calcInput,
              services: payload.services || [],
              isKorrektur: payload.isKorrektur,
              correctionFor: payload.correctionFor,
              updatedAt: serverTimestamp()
            });
          } catch (err) {
            console.error('Error syncing draft invoice totals to parent order:', err);
          }
        }
      }

      const finalRedirectCustId = payload.customerId || targetCustId;
      if (finalRedirectCustId) {
        router.push(`/dashboard/customers/${finalRedirectCustId}`);
      } else {
        router.push('/dashboard/finances');
      }
    } catch (e) {
      console.error(e);
      toast.error('Fehler beim Speichern.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) return <div className="p-12 text-center text-text-main">Lade Editor...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-bg-panel border border-structure p-4 rounded-xl shadow-lg mt-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
              {isCancelled ? `Rechnung ${existingInvoiceNumber || ''} (Storniert)` : existingInvoiceNumber ? `Rechnung ${existingInvoiceNumber}` : (resolvedInvoiceId ? 'Rechnungsentwurf bearbeiten' : (isKorrektur ? 'Neue Korrekturrechnung' : 'Neue Rechnung'))}
            </h1>
            {isCancelled ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20">
                Storniert
              </span>
            ) : isFinalized ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <LockClosedIcon className="w-3.5 h-3.5" /> Festgeschrieben
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Entwurf
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted mt-1">
            {isLocked ? 'Rechnungsdaten eingesehen (GoBD-Schreibschutz aktiv).' : 'Rechnungsdaten eingeben und dokumentieren.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFinalized && (
            <button
              type="button"
              onClick={() => setShowStornoModal(true)}
              className="btn-secondary px-4 py-2 bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20 flex items-center gap-2 text-xs font-bold rounded-lg cursor-pointer"
            >
              <ArrowPathIcon className="w-4 h-4" /> Rechnung stornieren
            </button>
          )}
          {resolvedInvoiceId && status === 'draft' && (
            <button
              onClick={async () => {
                if (confirm('Möchten Sie diesen Rechnungsentwurf wirklich löschen?')) {
                  try {
                    await deleteDoc(doc(db, 'invoices', resolvedInvoiceId));
                    toast.success('Rechnungsentwurf gelöscht!');
                    const targetCustId = resolvedCustomerId || urlCustomerId;
                    if (targetCustId) {
                      router.push(`/dashboard/customers/${targetCustId}`);
                    } else {
                      router.push('/dashboard/finances');
                    }
                  } catch (error) {
                    console.error(error);
                    toast.error('Fehler beim Löschen des Entwurfs.');
                  }
                }
              }}
              className="btn-secondary px-4 py-2 bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 flex items-center gap-2 text-xs font-bold rounded-lg"
            >
              <TrashIcon className="w-4 h-4" /> Entwurf löschen
            </button>
          )}
        </div>
      </div>

      {isFinalized && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg shrink-0 mt-0.5 sm:mt-0">
              <LockClosedIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                Rechnung {existingInvoiceNumber} ist finalisiert & GoBD-geschützt
              </h3>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                Gemäß GoBD sind festgeschriebene Rechnungen unveränderbar gesperrt. Änderungen an Leistungen, Beträgen oder Daten erfordern eine Stornierung (Stornorechnung).
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowStornoModal(true)}
            className="btn-secondary whitespace-nowrap bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30 flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg shrink-0 cursor-pointer shadow-xs"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Rechnung stornieren
          </button>
        </div>
      )}

      {isCancelled && (
        <div className="bg-red-500/10 border-2 border-red-500/30 text-red-900 dark:text-red-200 p-4 rounded-xl shadow-sm flex items-start gap-3">
          <div className="p-2 bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg shrink-0">
            <ExclamationTriangleIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base">
              Diese Rechnung ist storniert ({existingInvoiceNumber || 'Ohne Nummer'})
            </h3>
            <p className="text-xs text-red-800/80 dark:text-red-300/80 mt-0.5">
              Dieser Beleg wurde storniert und ist nach GoBD archiviert. Eine Bearbeitung ist nicht möglich.
            </p>
          </div>
        </div>
      )}
      
      <div className="glass-panel p-4 rounded-xl shadow-lg flex items-center justify-start overflow-x-auto custom-scrollbar gap-4">
        {[
          { step: 1, label: 'Kunde & Daten' },
          { step: 2, label: 'Leistungen & Preise' },
          { step: 3, label: 'Abschluss & Speichern' }
        ].map(s => (
          <button
            key={s.step}
            onClick={() => goToStep(s.step)}
            className={`flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-lg transition-all ${currentStep === s.step ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-text-muted hover:bg-bg-dark hover:text-text-main'}`}
          >
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {currentStep === 1 && (
        <section className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-primary">
          <h2 className="text-xl font-bold mb-4 text-text-main border-b border-structure pb-2">Kundeninformationen</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="col-span-1 md:grid-cols-2 lg:col-span-4 flex gap-4">
              <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="radio" disabled={isLocked} checked={customerData.type === 'privat'} onChange={() => setCustomerData({...customerData, type:'privat'})} className="accent-primary" /> Privatperson</label>
              <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="radio" disabled={isLocked} checked={customerData.type === 'firma'} onChange={() => setCustomerData({...customerData, type:'firma'})} className="accent-primary" /> Firma / Geschäftlich</label>
            </div>
            
            {customerData.type === 'privat' ? (
                <>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Anrede</label>
                    <select disabled={isLocked} value={customerData.salutation || ''} onChange={e => setCustomerData({...customerData, salutation: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed">
                      <option value="">Keine</option>
                      <option value="Herr">Herr</option>
                      <option value="Frau">Frau</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Vorname</label>
                    <input disabled={isLocked} type="text" value={customerData.firstName} onChange={e => setCustomerData({...customerData, firstName: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Nachname *</label>
                    <input disabled={isLocked} type="text" value={customerData.lastName} onChange={e => setCustomerData({...customerData, lastName: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-2">
                    <label className="block text-xs text-text-muted mb-1">Firmenname *</label>
                    <input disabled={isLocked} type="text" value={customerData.lastName} onChange={e => setCustomerData({...customerData, lastName: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Ansprechpartner</label>
                    <input disabled={isLocked} type="text" value={customerData.firstName} onChange={e => setCustomerData({...customerData, firstName: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                  </div>
                </>
              )}
            
            <div>
              <label className="block text-xs text-text-muted mb-1">E-Mail Adresse</label>
              <input disabled={isLocked} type="email" value={customerData.email} onChange={e => setCustomerData({...customerData, email: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2 border-t border-structure pt-4">
              <h3 className="text-sm font-semibold text-text-main mb-3">Rechnungsadresse</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <label className="block text-xs text-text-muted mb-1">Straße</label>
                  <input disabled={isLocked} type="text" value={customerData.street} onChange={e => setCustomerData({...customerData, street: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs text-text-muted mb-1">Haus-Nr.</label>
                  <input disabled={isLocked} type="text" value={customerData.houseNr} onChange={e => setCustomerData({...customerData, houseNr: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs text-text-muted mb-1">PLZ</label>
                  <input disabled={isLocked} type="text" value={customerData.zip} onChange={e => setCustomerData({...customerData, zip: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-text-muted mb-1">Ort</label>
                  <input disabled={isLocked} type="text" value={customerData.city} onChange={e => setCustomerData({...customerData, city: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-4 mt-2 border-t border-structure pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
               <div>
                  <label className="block text-xs text-text-muted mb-1">Rechnungsdatum</label>
                  <input disabled={isLocked} type="date" value={orderMeta.invoiceDate} onChange={e => setOrderMeta({...orderMeta, invoiceDate: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Fällig bis</label>
                  <input disabled={isLocked} type="date" value={orderMeta.validUntil} onChange={e => setOrderMeta({...orderMeta, validUntil: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Bearbeiter</label>
                  <input disabled={isLocked} type="text" value={orderMeta.manager} onChange={e => setOrderMeta({...orderMeta, manager: e.target.value})} className="input-field w-full disabled:opacity-60 disabled:cursor-not-allowed" />
                </div>
            </div>

            {/* Korrekturrechnung Option */}
            <div className="col-span-1 md:col-span-4 mt-2 border-t border-structure pt-4">
              <div className={`p-4 rounded-xl border transition-all ${isKorrektur ? 'bg-amber-500/10 border-amber-500/40 text-amber-900 dark:text-amber-200' : 'bg-bg-dark border-structure text-text-muted'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className={`flex items-center gap-2.5 ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={isKorrektur}
                      onChange={e => setIsKorrektur(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 disabled:opacity-60"
                    />
                    <div>
                      <span className="text-sm font-bold text-text-main block">
                        Als Korrekturrechnung ausstellen (PDF-Titel: KORREKTURRECHNUNG)
                      </span>
                      <span className="text-xs text-text-muted">
                        Aktivieren, wenn diese Rechnung eine vorherige, stornierte Rechnung korrigiert.
                      </span>
                    </div>
                  </label>
                  {isKorrektur && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                        Korrektur zu Rechnung:
                      </span>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={correctionFor}
                        onChange={e => setCorrectionFor(e.target.value)}
                        placeholder="z.B. R-1770"
                        className="input-field text-xs py-1.5 px-3 w-36 bg-bg-panel font-mono font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Logistics Section for Draft Invoices */}
            {sourceOrderId && (
              <div className="col-span-1 md:col-span-4 mt-4 border-t border-structure pt-4">
                <h3 className="text-sm font-semibold text-text-main mb-3">Leistungsort (Auszug / Einzug)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-bg-dark p-3 rounded-xl border border-structure">
                    <label className="block text-xs font-bold text-primary mb-2">Auszugsort (Start)</label>
                    <input disabled={isLocked} type="text" placeholder="Straße & Haus-Nr." value={`${logistics?.a_street || ''} ${logistics?.a_houseNr || ''}`.trim()} onChange={e => {
                      const parts = e.target.value.split(/(?=\d)/);
                      const street = parts[0]?.trim() || '';
                      const houseNr = parts.slice(1).join('').trim() || '';
                      setLogistics({...logistics, a_street: street, a_houseNr: houseNr});
                    }} className="input-field w-full mb-2 text-xs disabled:opacity-60 disabled:cursor-not-allowed" />
                    <div className="flex gap-2">
                      <input disabled={isLocked} type="text" placeholder="PLZ" value={logistics?.a_zip || ''} onChange={e => setLogistics({...logistics, a_zip: e.target.value})} className="input-field w-1/3 text-xs disabled:opacity-60 disabled:cursor-not-allowed" />
                      <input disabled={isLocked} type="text" placeholder="Ort" value={logistics?.a_city || ''} onChange={e => setLogistics({...logistics, a_city: e.target.value})} className="input-field w-2/3 text-xs disabled:opacity-60 disabled:cursor-not-allowed" />
                    </div>
                  </div>
                  <div className="bg-bg-dark p-3 rounded-xl border border-structure">
                    <label className="block text-xs font-bold text-primary mb-2">Einzugsort (Ziel)</label>
                    <input disabled={isLocked} type="text" placeholder="Straße & Haus-Nr." value={`${logistics?.b_street || ''} ${logistics?.b_houseNr || ''}`.trim()} onChange={e => {
                      const parts = e.target.value.split(/(?=\d)/);
                      const street = parts[0]?.trim() || '';
                      const houseNr = parts.slice(1).join('').trim() || '';
                      setLogistics({...logistics, b_street: street, b_houseNr: houseNr});
                    }} className="input-field w-full mb-2 text-xs disabled:opacity-60 disabled:cursor-not-allowed" />
                    <div className="flex gap-2">
                      <input disabled={isLocked} type="text" placeholder="PLZ" value={logistics?.b_zip || ''} onChange={e => setLogistics({...logistics, b_zip: e.target.value})} className="input-field w-1/3 text-xs disabled:opacity-60 disabled:cursor-not-allowed" />
                      <input disabled={isLocked} type="text" placeholder="Ort" value={logistics?.b_city || ''} onChange={e => setLogistics({...logistics, b_city: e.target.value})} className="input-field w-2/3 text-xs disabled:opacity-60 disabled:cursor-not-allowed" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center mt-6">
             <button type="button" onClick={handleSafeCancel} className="btn-secondary cursor-pointer">Abbrechen</button>
             <button type="button" onClick={() => goToStep(2)} className="btn-primary cursor-pointer">Weiter zu Leistungen</button>
          </div>
        </section>
      )}

      {currentStep === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-structure pb-4">
            <div>
              <h2 className="text-2xl font-headline font-bold text-text-main flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_task</span>
                Leistungen &amp; Finanzen
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Dienstleistungsauswahl nach Belade- und Entladestelle sowie Kostenkalkulation für die Rechnung.
              </p>
            </div>
            <label className={`flex items-center gap-2 bg-white/[0.03] px-3.5 py-2 rounded-xl border border-structure shadow-sm ${(!canEditPrices || isLocked) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input 
                type="checkbox" 
                checked={isFlatRate} 
                onChange={e => setIsFlatRate(e.target.checked)} 
                disabled={!canEditPrices || isLocked} 
                className="accent-primary w-4 h-4 rounded" 
              />
              <span className="text-xs font-bold text-text-main">Pauschalabrechnung (Festpreis)</span>
            </label>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Left: Quick Service Selection A vs B */}
            <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
              <div className={`bg-bg-card rounded-2xl p-6 border border-structure shadow-md ${isLocked ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-headline font-bold flex items-center gap-2 text-text-main">
                    <span className="material-symbols-outlined text-primary">touch_app</span>
                    Leistungsauswahl (Schnell-Auswahl)
                  </h3>
                  <span className="bg-primary/10 text-primary text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                    Belade- vs. Entladestelle
                  </span>
                </div>

                {/* Standard-Leistungen Picker (Typische Umzugsleistungen - Allgemein) */}
                <div className="mb-6 bg-bg-dark/40 rounded-2xl border border-structure/60 shadow-sm p-4 sm:p-5 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-structure/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl">view_list</span>
                      <span className="text-sm font-headline font-bold text-text-main">
                        Typische Umzugsleistungen
                      </span>
                    </div>
                    <span className="self-start sm:self-auto text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Allgemein ({allgemeinServices.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    {allgemeinServices.map((svc: any, idx: number) => {
                      const isSelected = isStandardServiceSelected(svc.id, svc.name);
                      const qty = getServiceQuantity(svc.id, svc.name);
                      const icon = svc.icon || getServiceIcon(svc.name);
                      return (
                        <button
                          key={svc.id || svc.name || idx}
                          type="button"
                          disabled={isLocked}
                          onClick={() => toggleStandardService(svc)}
                          className={`group relative flex items-start justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/40 font-bold'
                              : 'border-structure/80 bg-white/[0.02] text-text-main hover:bg-white/[0.05] hover:border-structure'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 pr-2">
                            <span className={`material-symbols-outlined text-lg shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-text-muted group-hover:text-text-main'} transition-colors`}>
                              {icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold leading-snug line-clamp-2 block break-words">
                                {svc.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {((svc.price || svc.defaultPrice || 0) > 0 || svc.unit) && (
                                  <span className="text-[10px] text-text-muted font-normal">
                                    {(svc.price || svc.defaultPrice || 0) > 0 ? `${(svc.price || svc.defaultPrice).toFixed(2)} € ` : ''}
                                    {svc.unit ? `(${svc.unit})` : ''}
                                  </span>
                                )}
                                {isSelected && qty > 1 && (
                                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded font-bold">
                                    {qty}x
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={`material-symbols-outlined text-lg shrink-0 ${isSelected ? 'text-primary' : 'text-text-muted/50 group-hover:text-text-muted'} transition-colors`}>
                            {isSelected ? 'check_circle' : 'add_circle'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weitere Katalog-Leistungen (Vor Belade- und Entladestelle) */}
                <div className="mb-6 bg-bg-dark/40 rounded-2xl border border-structure/60 shadow-sm p-4 sm:p-5 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-structure/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl">menu_book</span>
                      <div>
                        <span className="text-sm font-headline font-bold text-text-main block">
                          Weitere Katalog-Leistungen
                        </span>
                        <span className="text-[10px] text-text-muted">
                          Zusatzservices, Küchen-, Karton- &amp; Möbelservice
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-[10px] text-text-muted bg-white/[0.04] border border-structure/50 px-2 py-0.5 rounded-full font-medium">
                        {filteredOtherCatalogItems.length} Positionen
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFullCatalog(!showFullCatalog)}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {showFullCatalog ? 'expand_less' : 'expand_more'}
                        </span>
                        <span>{showFullCatalog ? 'Einklappen' : 'Katalog öffnen'}</span>
                      </button>
                    </div>
                  </div>

                  {showFullCatalog && (
                    <div className="space-y-3.5 animate-in fade-in duration-200">
                      {/* Search Bar */}
                      <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input 
                          type="text" 
                          placeholder="Weitere Leistungen suchen (z.B. Aufbau Küche, Montage, Kartons)..." 
                          value={catalogSearch} 
                          onChange={e => setCatalogSearch(e.target.value)} 
                          className="input-field w-full pl-9 pr-8 py-2 rounded-xl bg-black/20 text-xs shadow-inner" 
                        />
                        {catalogSearch && (
                          <button
                            type="button"
                            onClick={() => setCatalogSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Category Filter Tabs */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                        <button 
                          type="button"
                          onClick={() => setActiveCatalogTab('Alle')} 
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${activeCatalogTab === 'Alle' ? 'bg-primary text-white shadow-xs' : 'bg-structure/50 text-text-muted hover:bg-structure hover:text-text-main'}`}
                        >
                          Alle weiteren
                        </button>
                        {otherCatalogCategories.map((catName: string) => (
                          <button 
                            key={catName} 
                            type="button"
                            onClick={() => setActiveCatalogTab(catName)} 
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${activeCatalogTab === catName ? 'bg-primary text-white shadow-xs' : 'bg-structure/50 text-text-muted hover:bg-structure hover:text-text-main'}`}
                          >
                            {catName}
                          </button>
                        ))}
                      </div>

                      {/* Items Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {filteredOtherCatalogItems.length === 0 ? (
                          <div className="col-span-full py-6 text-center text-xs text-text-muted italic">
                            Keine weiteren Leistungen gefunden.
                          </div>
                        ) : (
                          filteredOtherCatalogItems.map((item: any, idx: number) => {
                            const isSelected = isStandardServiceSelected(item.id || item.name, item.name);
                            const qty = getServiceQuantity(item.id || item.name, item.name);
                            const icon = item.icon || getServiceIcon(item.name);
                            return (
                              <button 
                                key={item.id || item.name || idx} 
                                type="button"
                                disabled={isLocked}
                                onClick={() => toggleStandardService(item)} 
                                className={`group flex items-start justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/40 font-bold'
                                    : 'border-structure/80 bg-white/[0.02] text-text-main hover:bg-white/[0.05] hover:border-structure'
                                }`}
                              >
                                <div className="flex items-start gap-2.5 min-w-0 pr-2">
                                  <span className={`material-symbols-outlined text-base shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-text-muted group-hover:text-text-main'} transition-colors`}>
                                    {icon}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs font-semibold leading-snug line-clamp-2 block break-words">
                                      {item.name}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-text-muted font-normal">
                                        {!isFlatRate && (item.price || item.defaultPrice || 0) > 0 
                                          ? `${(item.price || item.defaultPrice).toFixed(2)} €` 
                                          : 'Katalog'}
                                        {item.unit ? ` / ${item.unit}` : ''}
                                      </span>
                                      {isSelected && qty > 1 && (
                                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded font-bold">
                                          {qty}x
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className={`material-symbols-outlined text-base shrink-0 ${isSelected ? 'text-primary' : 'text-text-muted/50 group-hover:text-text-muted'}`}>
                                  {isSelected ? 'check_circle' : 'add_circle'}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
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
                      {servicesA.map((svc) => {
                        const isSelected = isStandardServiceSelected(svc.id, svc.name);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            disabled={isLocked}
                            onClick={() => toggleStandardService(svc)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30 font-bold'
                                : 'border-structure/80 bg-white/[0.02] text-text-main hover:bg-white/[0.05] hover:border-structure'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-primary' : 'text-text-muted'}`}>
                                {svc.icon}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold">{svc.name}</span>
                                {!isFlatRate && svc.price > 0 && (
                                  <span className="text-[10px] text-text-muted font-normal">
                                    {svc.price.toFixed(2)} € {svc.unit ? `(${svc.unit})` : ''}
                                  </span>
                                )}
                              </div>
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
                      {servicesB.map((svc) => {
                        const isSelected = isStandardServiceSelected(svc.id, svc.name);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            disabled={isLocked}
                            onClick={() => toggleStandardService(svc)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30 font-bold'
                                : 'border-structure/80 bg-white/[0.02] text-text-main hover:bg-white/[0.05] hover:border-structure'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-primary' : 'text-text-muted'}`}>
                                {svc.icon}
                              </span>
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold">{svc.name}</span>
                                {!isFlatRate && svc.price > 0 && (
                                  <span className="text-[10px] text-text-muted font-normal">
                                    {svc.price.toFixed(2)} € {svc.unit ? `(${svc.unit})` : ''}
                                  </span>
                                )}
                              </div>
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

                <div className="max-h-96 overflow-y-auto custom-scrollbar divide-y divide-structure/40">
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
                          <th className="p-2.5 pr-4 text-right w-28">Summe</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-structure/30">
                        {services.map((svc, idx) => (
                          <tr key={svc.id} className="hover:bg-white/[0.02] transition-colors group align-top">
                            <td className="p-2.5 pl-4 flex flex-col gap-1.5">
                              <input
                                type="text"
                                disabled={isLocked}
                                value={svc.name}
                                onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                                className="bg-transparent font-medium text-text-main w-full focus:outline-none focus:bg-black/20 rounded px-1 disabled:opacity-60"
                              />
                              <textarea
                                disabled={isLocked}
                                value={svc.note || ''}
                                onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, note: e.target.value } : s))}
                                placeholder="Optionale Beschreibung (erscheint auf der Rechnung)..."
                                className="text-[10px] text-text-muted bg-black/10 focus:bg-black/20 focus:outline-none rounded px-2 py-1 w-full resize-y min-h-[36px] disabled:opacity-60"
                                rows={1}
                              />
                              <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold text-text-muted uppercase">Ort:</span>
                                  <div className="inline-flex rounded-lg p-0.5 bg-structure/40 border border-white/5">
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, location: 'a' } : s))}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                        svc.location === 'a' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
                                      }`}
                                    >
                                      A
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, location: 'b' } : s))}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                        svc.location === 'b' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
                                      }`}
                                    >
                                      B
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, location: 'both' } : s))}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                        !svc.location || svc.location === 'both' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
                                      }`}
                                    >
                                      Beide
                                    </button>
                                  </div>
                                </div>

                                {!isFlatRate && (
                                  <button
                                    type="button"
                                    disabled={isLocked}
                                    onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, isIncluded: !s.isIncluded, unitPrice: !s.isIncluded ? 0 : s.unitPrice } : s))}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                                      svc.isIncluded
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                        : 'bg-white/5 text-text-muted hover:text-white border-white/10'
                                    }`}
                                  >
                                    {svc.isIncluded ? '✓ Inklusiv (0 €)' : 'Inklusiv'}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5 text-center pt-3">
                              <div className="inline-flex items-center gap-1 bg-structure/40 rounded-lg px-1.5 py-0.5">
                                <button 
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: Math.max(0, (s.quantity || 0) - 1) } : s))} 
                                  className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-white font-bold disabled:opacity-40"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  disabled={isLocked}
                                  value={!svc.quantity ? '' : svc.quantity}
                                  onChange={e => {
                                    const val = parseInt(e.target.value, 10);
                                    setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: isNaN(val) ? 0 : Math.max(0, val) } : s));
                                  }}
                                  onFocus={e => e.target.select()}
                                  placeholder="0"
                                  className="font-bold w-12 text-center text-text-main bg-transparent focus:bg-black/20 rounded focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-xs disabled:opacity-50"
                                />
                                <button 
                                  type="button"
                                  disabled={isLocked}
                                  onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: (s.quantity || 0) + 1 } : s))} 
                                  className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-white font-bold disabled:opacity-40"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 pr-4 text-right font-bold text-text-main pt-3">
                              {!isFlatRate && canViewPrices ? (
                                svc.isIncluded ? (
                                  <span className="text-[10px] text-emerald-400 font-bold">Inklusiv</span>
                                ) : (
                                  <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        step="0.01"
                                        disabled={!canEditPrices || isLocked}
                                        value={svc.unitPrice === 0 ? '' : (svc.unitPrice ?? '')}
                                        onChange={e => {
                                          const val = parseFloat(e.target.value);
                                          setServices(prev => prev.map((s, i) => i === idx ? { ...s, unitPrice: isNaN(val) ? 0 : val } : s));
                                        }}
                                        onFocus={e => e.target.select()}
                                        placeholder="0.00"
                                        className="w-16 text-right bg-black/20 border border-structure/50 rounded px-1.5 py-0.5 text-xs font-mono text-text-main focus:outline-none focus:border-primary disabled:opacity-60"
                                        title="Einzelpreis (Netto)"
                                      />
                                      <span className="text-[10px] text-text-muted">€</span>
                                    </div>
                                    <span className="text-[10px] text-primary">
                                      = {((svc.quantity || 0) * (svc.unitPrice || 0)).toFixed(2)} €
                                    </span>
                                  </div>
                                )
                              ) : '—'}
                            </td>
                            <td className="pr-2 text-right pt-3">
                              {!isLocked && (
                                <button
                                  type="button"
                                  onClick={() => setServices(services.filter(s => s.id !== svc.id))}
                                  className="text-text-muted hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                >
                                  <XMarkIcon className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {!isLocked && (
                  <div className="p-3 border-t border-structure/50 bg-white/[0.01]">
                    <button
                      type="button"
                      onClick={() => addService({ name: 'Individuelle Leistung', quantity: 1, unitPrice: 0, unit: 'Pauschal' })}
                      className="w-full py-2 border border-dashed border-structure rounded-xl text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold cursor-pointer"
                    >
                      <PlusIcon className="w-4 h-4" /> Eigene Leistung hinzufügen
                    </button>
                  </div>
                )}
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
                          value={flatRateNet === 0 ? '' : flatRateNet} 
                          onChange={e => {
                            const val = parseFloat(e.target.value);
                            setFlatRateNet(isNaN(val) ? 0 : val);
                          }} 
                          onFocus={e => e.target.select()}
                          disabled={!canEditPrices || isLocked} 
                          className="input-field w-full text-right font-bold text-base pr-8 py-2 disabled:opacity-60" 
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
                        <span className="text-text-main font-bold">{calcInput.net.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-dashed border-structure/60 pb-1.5">
                        <span className="text-text-muted font-medium">USt. (19%)</span>
                        <span className="text-text-main font-bold">{calcInput.tax.toFixed(2)} €</span>
                      </div>
                      <div className="flex flex-col gap-0.5 pt-2">
                        <span className="text-[10px] font-extrabold text-primary uppercase tracking-[0.2em]">
                          BRUTTO GESAMT
                        </span>
                        <span className="text-4xl font-headline font-black text-primary tracking-tight">
                          {calcInput.gross.toFixed(2)} €
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
                      onClick={() => goToStep(3)}
                      className="w-full py-3 rounded-xl font-headline font-bold text-xs uppercase tracking-wider shadow-lg bg-primary text-white shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Weiter zum Abschluss</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleStepBack}
                      className="w-full py-2 bg-white/[0.04] text-text-main border border-structure/60 rounded-xl font-bold text-xs hover:bg-white/[0.08] transition-all cursor-pointer"
                    >
                      Zurück
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <section className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-primary">
          <h2 className="text-xl font-bold mb-4 text-text-main border-b border-structure pb-2">Texte & Abschluss</h2>
          
          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-xs text-text-muted mb-1 font-bold">Rechnung Einleitungstext</label>
              <textarea disabled={isLocked} value={texts.quoteIntro} onChange={e => setTexts({...texts, quoteIntro: e.target.value})} className="input-field w-full h-24 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Sehr geehrte(r)..." />
              {!isLocked && (
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => {
                      const from = `${logistics?.a_zip || ''} ${logistics?.a_city || ''}`.trim();
                      const to = `${logistics?.b_zip || ''} ${logistics?.b_city || ''}`.trim();
                      if (!from && !to) {
                        toast.error("Keine Adressdaten hinterlegt.");
                        return;
                      }
                      const textToAdd = `(Umzug von ${from || '?'} nach ${to || '?'})`;
                      setTexts({...texts, quoteIntro: texts.quoteIntro ? `${texts.quoteIntro} ${textToAdd}` : textToAdd});
                    }}
                    className="text-xs px-3 py-1.5 bg-bg-panel border border-structure text-text-main hover:text-primary rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <MapPinIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Adressen einfügen</span>
                  </button>
                  <button 
                    onClick={() => {
                      const movingDate = (orderMeta as any)?.movingDateFrom ? new Date((orderMeta as any).movingDateFrom).toLocaleDateString('de-DE') : '___';
                      const textToAdd = `am ${movingDate}`;
                      setTexts({...texts, quoteIntro: texts.quoteIntro ? `${texts.quoteIntro} ${textToAdd}` : textToAdd});
                    }}
                    className="text-xs px-3 py-1.5 bg-bg-panel border border-structure text-text-main hover:text-primary rounded-lg transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <CalendarDaysIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Umzugsdatum einfügen</span>
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 font-bold">Zahlungsbedingungen</label>
              <textarea disabled={isLocked} value={texts.paymentTerms} onChange={e => setTexts({...texts, paymentTerms: e.target.value})} className="input-field w-full h-24 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Zahlbar innerhalb von..." />
              
              {!isLocked && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {settings.paymentMethods?.map((pm:any) => (
                    <button key={pm.name} onClick={() => {
                      setOrderMeta({...orderMeta, paymentMethod: pm.name});
                      setTexts({...texts, paymentTerms: pm.textInvoice || pm.textQuote || ''});
                    }} className={`text-xs px-3 py-1.5 rounded-lg border ${orderMeta.paymentMethod === pm.name ? 'bg-primary/20 border-primary text-primary' : 'bg-bg-panel border-structure text-text-muted hover:border-primary/50'}`}>
                      {pm.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 font-bold">Rechnung Schlusstext</label>
              <textarea disabled={isLocked} value={texts.quoteOutro} onChange={e => setTexts({...texts, quoteOutro: e.target.value})} className="input-field w-full h-20 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Wir bedanken uns..." />
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-structure">
            <button type="button" onClick={handleStepBack} className="btn-secondary w-full md:w-auto cursor-pointer">Zurück</button>
            <div className="flex gap-4 w-full md:w-auto">
              {isLocked ? (
                <>
                  {isFinalized && (
                    <button 
                      type="button"
                      onClick={() => setShowStornoModal(true)} 
                      className="btn-secondary py-3 px-6 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30 flex items-center justify-center gap-2 w-full md:w-auto font-semibold cursor-pointer"
                    >
                      <ArrowPathIcon className="w-5 h-5" /> Stornorechnung erstellen
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => router.push(`/dashboard/customers/${urlCustomerId}`)} 
                    className="btn-primary py-3 px-8 flex items-center justify-center gap-2 text-base w-full md:w-auto"
                  >
                    Zur Kundenakte
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => saveOrder('draft')} 
                    disabled={isSaving}
                    className="btn-secondary py-3 px-6 shadow-lg border-structure hover:bg-bg-dark flex items-center justify-center gap-2 w-full md:w-auto"
                  >
                    Als Entwurf speichern
                  </button>
                  <button 
                    onClick={() => saveOrder('invoice_open')} 
                    disabled={isSaving}
                    className="btn-primary py-3 px-8 shadow-lg shadow-primary/30 flex items-center justify-center gap-2 text-base w-full md:w-auto"
                  >
                    {isSaving ? 'Speichere...' : <><CheckCircleIcon className="w-5 h-5" /> {isKorrektur ? 'Korrekturrechnung ausstellen' : 'Rechnung ausstellen'}</>}
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {showEarlyCloseWarning && (() => {
        const moveDateRaw = (orderMeta as any)?.movingDateFrom || logistics?.movingDate;
        const formattedMoveDate = moveDateRaw ? new Date(moveDateRaw).toLocaleDateString('de-DE') : '';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <ExclamationTriangleIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Sicherheitsprüfung
                  </span>
                  <h3 className="font-headline font-bold text-lg text-slate-900 dark:text-white mt-1">
                    Umzugstermin liegt noch in der Zukunft!
                  </h3>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <p className="font-semibold text-sm">
                  Achtung: Der Umzugstermin ({formattedMoveDate}) hat noch nicht stattgefunden!
                </p>
                <p className="text-amber-800/80 dark:text-amber-300/80 leading-relaxed">
                  Wenn Sie diese Rechnung jetzt ausstellen, wird der Auftrag bzw. die Kundenakte als abgeschlossen eingestuft. Möchten Sie diesen Auftrag trotzdem jetzt abschließen?
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEarlyCloseWarning(false)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEarlyCloseWarning(false);
                    saveOrder('invoice_open', true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-full text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 shadow-md transition-colors cursor-pointer"
                >
                  Trotzdem abschließen & Rechnung ausstellen
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* In-App Confirmation Modal: Bearbeitung abbrechen */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-bg-panel border-2 border-red-500/30 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/25 flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-outlined text-3xl">warning</span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-headline font-bold text-text-main">
                Rechnungserstellung abbrechen?
              </h3>
              <p className="text-xs font-semibold text-red-400">
                هل أنت متأكد من رغبتك في إلغاء عملية الفاتورة؟
              </p>
              <p className="text-xs text-text-muted leading-relaxed pt-1">
                Nicht gespeicherte Eingaben gehen verloren. Möchten Sie die Rechnungsbearbeitung wirklich verlassen?
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={executeExit}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold font-headline bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">delete_forever</span>
                <span>Verwerfen & Verlassen / إلغاء ومغادرة</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-text-muted hover:text-text-main bg-white/[0.04] hover:bg-white/[0.08] border border-structure transition-all cursor-pointer"
              >
                Weiter bearbeiten / البقاء ومتابعة العمل
              </button>
            </div>
          </div>
        </div>
      )}

      {showStornoModal && (
        <StornoModal
          invoice={{
            id: resolvedInvoiceId || orderId || activeSourceOrderId,
            invoiceNumber: existingInvoiceNumber,
            sourceOrderId: activeSourceOrderId,
            customerId: urlCustomerId,
            customerName: customerData.type === 'firma' ? customerData.lastName : `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim(),
            customerData,
            orderMeta,
            logistics,
            services,
            calcInput,
            totals: calcInput,
            isFlatRate,
            flatRateNet,
            _collection: (resolvedInvoiceId || orderId) ? 'invoices' : undefined
          }}
          onClose={() => setShowStornoModal(false)}
          onSuccess={() => {
            setShowStornoModal(false);
            setStatus('invoice_cancelled');
            router.push(`/dashboard/customers/${urlCustomerId}`);
          }}
        />
      )}
    </div>
  );
}
