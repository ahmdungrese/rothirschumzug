"use client";

import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, CalculatorIcon, DocumentTextIcon, CheckCircleIcon, ArchiveBoxIcon, WrenchIcon, SparklesIcon, PlusCircleIcon, TagIcon, TruckIcon, MapPinIcon, CalendarDaysIcon, LockClosedIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { toast } from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { calculateOrderTotals } from '@/lib/financeHelpers';
import { StornoModal } from '@/components/finances/StornoModal';

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

export function InvoiceEditor({ orderId, sourceOrderId }: { orderId?: string, sourceOrderId?: string }) {
  const params = useParams();
  const urlCustomerId = params.id as string;
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const canEditPrices = profile?.role === 'admin' ? true : profile?.canEditPrices ?? true;
  const canViewPrices = profile?.role === 'admin' ? true : profile?.canViewPrices ?? true;
  
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [status, setStatus] = useState('draft'); // invoice_open if final
  const [activeSourceOrderId, setActiveSourceOrderId] = useState<string | null>(sourceOrderId || null);
  const [existingInvoiceNumber, setExistingInvoiceNumber] = useState<string | null>(null);
  const [isKorrektur, setIsKorrektur] = useState(false);
  const [correctionFor, setCorrectionFor] = useState('');
  const [showStornoModal, setShowStornoModal] = useState(false);

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

  useEffect(() => {
    const init = async () => {
      // 1. Load System Settings
      const settingsSnap = await getDoc(doc(db, 'system', 'settings'));
      if (settingsSnap.exists()) {
        const s = settingsSnap.data();
        setSettings(s);
        if (s.invoiceIntro) setTexts(t => ({...t, quoteIntro: s.invoiceIntro}));
        if (s.invoiceOutro) setTexts(t => ({...t, quoteOutro: s.invoiceOutro}));
        
        if (!orderId && !sourceOrderId && s.paymentMethods && s.paymentMethods.length > 0) {
          setOrderMeta(prev => ({...prev, paymentMethod: s.paymentMethods[0].name}));
          setTexts(t => ({...t, paymentTerms: s.paymentMethods[0].textInvoice || s.paymentMethods[0].textQuote}));
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
        // If orderId is provided (because ResponsiveOrderWrapper passes the id of the draft order), use 'orders' collection
        // If it's a legacy free invoice, it might be in 'invoices'. We check both.
        let targetCol = sourceOrderId ? 'orders' : (orderId ? 'orders' : 'invoices');
        let oSnap = await getDoc(doc(db, targetCol, idToLoad));
        
        if (!oSnap.exists() && targetCol === 'orders') {
          oSnap = await getDoc(doc(db, 'invoices', idToLoad));
        }

        if (oSnap.exists()) {
          const o = oSnap.data();
          if (orderId) setStatus(o.status);
          if (o.invoiceNumber) setExistingInvoiceNumber(o.invoiceNumber);
          
          if (o.customerData) setCustomerData(o.customerData);
          else if (o.billingAddress) setCustomerData(o.billingAddress);
          
          if (o.orderMeta) setOrderMeta(prev => ({...prev, ...o.orderMeta}));
          if (o.logistics) setLogistics(o.logistics);
          if (o.isFlatRate !== undefined) setIsFlatRate(o.isFlatRate);
          if (o.flatRateNet) setFlatRateNet(o.flatRateNet);
          if (o.services) setServices(o.services);
          if (o.calcInput) setCalcInput(o.calcInput);
          if (o.texts && orderId) setTexts(prev => ({...prev, ...o.texts}));
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
          } else if (o.type !== 'invoice') {
            setActiveSourceOrderId(idToLoad);
          }
        }
      }
    };
    init();
  }, [orderId, sourceOrderId, urlCustomerId]);

  const addService = (template: any) => {
    setServices(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      name: template.name || '',
      note: template.note || template.defaultDesc || '',
      quantity: template.quantity || 1,
      unitPrice: template.unitPrice ?? template.price ?? 0,
      unit: template.unit || 'Stk.',
      isIncluded: Boolean(template.isIncluded)
    }]);
  };

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

  const saveOrder = async (finalStatus: string = 'draft') => {
    if (isLocked) {
      toast.error('Festgeschriebene oder stornierte Rechnungen können nicht direkt bearbeitet werden. Bitte stornieren Sie die Rechnung.');
      return;
    }
    if (!customerData.lastName) {
      toast.error('Bitte Nachnamen / Firmennamen eingeben');
      return;
    }
    
    setIsSaving(true);
    try {
      // Wir aktualisieren das Haupt-Kundenprofil absichtlich NICHT mehr aus dem Rechnungs-Editor,
      // damit abweichende Rechnungsadressen niemals die Stammdaten des Kunden überschreiben!

      const calculatedTotals = calculateTotals() || { net: 0, tax: 0, gross: 0 };

      const payload: any = {
        type: 'invoice',
        status: finalStatus,
        customerId: urlCustomerId || null,
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
        updatedAt: serverTimestamp()
      };

      // Centralized finalizing logic for invoices
      if (existingInvoiceNumber) {
        payload.invoiceNumber = existingInvoiceNumber;
      }

      if (finalStatus === 'invoice_open' && !payload.invoiceNumber) {
        await runTransaction(db, async (t) => {
          // 1. ALL READS FIRST
          const settingsRef = doc(db, 'system', 'settings');
          const settingsSnap = await t.get(settingsRef);
          
          let parentOrderSnap = null;
          let parentOrderRef = null;
          if (activeSourceOrderId) {
            parentOrderRef = doc(db, 'orders', activeSourceOrderId);
            parentOrderSnap = await t.get(parentOrderRef);
          }

          // 2. DATA PREPARATION & CALCULATIONS
          const rawNext = settingsSnap.data()?.nextInvoiceNumber || 1771;
          const nextInvoiceNumber = Math.max(1771, rawNext);
          const invoiceNum = `R-${nextInvoiceNumber}`;
          
          payload.invoiceNumber = invoiceNum;
          payload.createdAt = payload.createdAt || serverTimestamp();
          
          const invoiceRef = orderId ? doc(db, 'invoices', orderId) : doc(collection(db, 'invoices'));

          // 3. ALL WRITES AFTER READS
          t.set(invoiceRef, payload, { merge: true });

          if (parentOrderRef && parentOrderSnap && parentOrderSnap.exists()) {
            const parentData = parentOrderSnap.data();
            const history = parentData.invoiceHistory || [];
            
            // Only push history if there's a previous active invoice number
            if (parentData.invoiceNumber && parentData.invoiceNumber !== invoiceNum) {
              history.push({
                invoiceNumber: parentData.invoiceNumber,
                status: parentData.status,
                date: new Date().toISOString()
              });
            }

            t.update(parentOrderRef, {
              invoiceNumber: invoiceNum,
              invoiceDate: payload.updatedAt,
              status: 'invoice_open',
              invoiceHistory: history,
              totals: payload.totals,
              calcInput: payload.calcInput,
              services: payload.services || parentData.services || [],
              isKorrektur: payload.isKorrektur,
              correctionFor: payload.correctionFor,
              updatedAt: serverTimestamp()
            });
          }
          
          // Update Settings
          t.update(settingsRef, { nextInvoiceNumber: nextInvoiceNumber + 1 });
        });

        const editorActorName = profile?.displayName || profile?.email?.split('@')[0] || 'Team';
        await logActivity(user?.uid || '', editorActorName, orderId ? 'UPDATE_ORDER' : 'CREATE_ORDER', `Rechnung ausgestellt: ${payload.invoiceNumber}`);
        toast.success('Rechnung erfolgreich ausgestellt!');
      } else if (finalStatus === 'invoice_open' && payload.invoiceNumber) {
        // Re-saving already finalized invoice
        const editorActorName = profile?.displayName || profile?.email?.split('@')[0] || 'Team';
        const invoiceRef = orderId ? doc(db, 'invoices', orderId) : doc(collection(db, 'invoices'));
        await setDoc(invoiceRef, payload, { merge: true });

        if (activeSourceOrderId) {
          try {
            await updateDoc(doc(db, 'orders', activeSourceOrderId), {
              invoiceNumber: payload.invoiceNumber,
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
        if (orderId) {
          await setDoc(doc(db, 'invoices', orderId), payload, { merge: true });
          await logActivity(user?.uid || '', editorActorName, 'UPDATE_ORDER', `Rechnungsentwurf bearbeitet`);
          toast.success('Rechnungsentwurf gespeichert!');
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, 'invoices'), payload);
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

      router.push(`/dashboard/customers/${urlCustomerId}`);
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
              {isCancelled ? `Rechnung ${existingInvoiceNumber || ''} (Storniert)` : existingInvoiceNumber ? `Rechnung ${existingInvoiceNumber}` : (orderId ? 'Rechnungsentwurf bearbeiten' : 'Neue Rechnung')}
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
          {orderId && status === 'draft' && (
            <button
              onClick={async () => {
                if (confirm('Möchten Sie diesen Rechnungsentwurf wirklich löschen?')) {
                  try {
                    const targetCol = activeSourceOrderId ? 'orders' : 'invoices';
                    let updateCol = targetCol;
                    if (!activeSourceOrderId) {
                      const checkInv = await getDoc(doc(db, 'invoices', orderId));
                      if (!checkInv.exists()) updateCol = 'orders';
                    }
                    await deleteDoc(doc(db, updateCol, orderId));
                    toast.success('Rechnungsentwurf gelöscht!');
                    router.push(`/dashboard/customers/${urlCustomerId}`);
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
            onClick={() => setCurrentStep(s.step)}
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
          <div className="flex justify-end mt-6">
             <button onClick={() => setCurrentStep(2)} className="btn-primary">Weiter zu Leistungen</button>
          </div>
        </section>
      )}

      {currentStep === 2 && (
        <section className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-primary">
          <h2 className="text-xl font-bold mb-4 text-text-main border-b border-structure pb-2">Leistungen & Preise</h2>
          
          <div className="bg-bg-dark p-4 rounded-xl border border-structure mb-6">
            <h3 className="text-sm font-bold text-text-main mb-3">Abrechnungsmodell</h3>
            <div className="flex gap-4">
              <label className={`flex items-center gap-2 text-sm text-text-main ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                <input type="radio" name="billingMode" disabled={isLocked} checked={isFlatRate} onChange={() => setIsFlatRate(true)} className="accent-primary" />
                Pauschalpreis
              </label>
              <label className={`flex items-center gap-2 text-sm text-text-main ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                <input type="radio" name="billingMode" disabled={isLocked} checked={!isFlatRate} onChange={() => setIsFlatRate(false)} className="accent-primary" />
                Nach Einzelpositionen berechnen
              </label>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {services.map((service, index) => {
              const lineTotal = service.isIncluded 
                ? 0 
                : ((service.quantity || 0) * (service.unitPrice || 0));

              return (
                <div key={service.id} className="bg-bg-panel p-4 rounded-xl border border-structure shadow-sm space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    <div className="col-span-1 md:col-span-1 hidden md:flex items-center justify-center pt-2.5 text-text-muted font-bold text-sm">
                      {index + 1}.
                    </div>
                    
                    <div className="col-span-1 md:col-span-5 space-y-2">
                      <label className="block text-[10px] text-text-muted uppercase font-bold tracking-wider">Leistung & Bezeichnung</label>
                      <input 
                        type="text" 
                        disabled={isLocked}
                        value={service.name} 
                        onChange={e => {
                          const newS = [...services];
                          newS[index].name = e.target.value;
                          setServices(newS);
                        }} 
                        className="input-field w-full font-medium disabled:opacity-60 disabled:cursor-not-allowed" 
                        placeholder="Leistungsbezeichnung..." 
                      />
                      <textarea
                        disabled={isLocked}
                        value={service.note || ''}
                        onChange={e => {
                          const newS = [...services];
                          newS[index].note = e.target.value;
                          setServices(newS);
                        }}
                        placeholder="Optionale Beschreibung / Bemerkung (wird auf der Rechnung gedruckt)..."
                        className="text-xs text-text-muted bg-black/10 dark:bg-black/20 focus:bg-black/30 focus:outline-none rounded-lg p-2 w-full resize-y min-h-[38px] border border-structure/30 disabled:opacity-60 disabled:cursor-not-allowed"
                        rows={1}
                      />
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-2">
                      <label className="block text-[10px] text-text-muted uppercase font-bold tracking-wider">Menge & Einheit</label>
                      <div className="flex gap-1 items-center">
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            const newS = [...services];
                            newS[index].quantity = Math.max(0, (newS[index].quantity || 0) - 1);
                            setServices(newS);
                          }}
                          className="w-7 h-8 bg-structure/40 hover:bg-structure text-text-main rounded font-bold text-xs flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          -
                        </button>
                        <input 
                          type="number" 
                          step="0.5" 
                          disabled={isLocked}
                          value={service.quantity || 0} 
                          onChange={e => {
                            const newS = [...services];
                            newS[index].quantity = parseFloat(e.target.value) || 0;
                            setServices(newS);
                          }} 
                          className="input-field w-16 text-center font-bold text-xs py-1.5 disabled:opacity-60 disabled:cursor-not-allowed" 
                        />
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            const newS = [...services];
                            newS[index].quantity = (newS[index].quantity || 0) + 1;
                            setServices(newS);
                          }}
                          className="w-7 h-8 bg-structure/40 hover:bg-structure text-text-main rounded font-bold text-xs flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                        <select 
                          disabled={isLocked}
                          value={service.unit} 
                          onChange={e => {
                            const newS = [...services];
                            newS[index].unit = e.target.value;
                            setServices(newS);
                          }} 
                          className="input-field px-1 min-w-[55px] text-xs py-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed" 
                        >
                          <option value="Stk.">Stk.</option>
                          <option value="Std.">Std.</option>
                          <option value="qm">qm</option>
                          <option value="Pausch.">Pausch.</option>
                          <option value="Lfm">Lfm</option>
                          <option value="Kartons">Kartons</option>
                          <option value="m³">m³</option>
                          <option value="Zone">Zone</option>
                        </select>
                      </div>

                      <div>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            const newS = [...services];
                            newS[index].isIncluded = !newS[index].isIncluded;
                            if (newS[index].isIncluded) newS[index].unitPrice = 0;
                            setServices(newS);
                          }}
                          className={`w-full py-1 px-2 rounded-lg text-[11px] font-bold transition-all border flex items-center justify-center gap-1 ${
                            isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                          } ${
                            service.isIncluded
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-xs'
                              : 'bg-white/5 text-text-muted hover:text-white border-white/10'
                          }`}
                        >
                          <CheckCircleIcon className="w-3.5 h-3.5" />
                          <span>{service.isIncluded ? '✓ Inklusiv (0 €)' : 'Als Inklusiv setzen'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] text-text-muted uppercase font-bold tracking-wider">Einzelpreis (Netto)</label>
                        {!isFlatRate && (
                          <span className="text-[10px] font-bold text-primary">
                            Zeile: {service.isIncluded ? 'Inklusiv' : `${lineTotal.toFixed(2)} €`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          disabled={!canEditPrices || service.isIncluded || isLocked} 
                          value={service.unitPrice || 0} 
                          onChange={e => {
                            const newS = [...services];
                            newS[index].unitPrice = parseFloat(e.target.value) || 0;
                            setServices(newS);
                          }} 
                          className={`input-field w-full text-right font-mono disabled:opacity-60 disabled:cursor-not-allowed ${service.isIncluded ? 'opacity-40 cursor-not-allowed bg-black/20' : ''}`} 
                        />
                        <span className="text-text-muted font-bold">€</span>
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-1 flex justify-end pt-5">
                      {!isLocked && (
                        <button 
                          type="button"
                          onClick={() => setServices(services.filter(s => s.id !== service.id))} 
                          className="p-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors border border-red-500/20 shadow-sm cursor-pointer" 
                          title="Position löschen"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!isLocked && (
            <div className="flex flex-wrap items-center gap-2 mb-8">
              <button 
                type="button"
                onClick={() => addService({ name: 'Neue Zusatzleistung', quantity: 1, unitPrice: 0, unit: 'Stk.' })} 
                className="btn-primary text-xs py-2 px-4 shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <PlusIcon className="w-4 h-4" /> Eigene Leistung hinzufügen
              </button>
              
              <div className="h-6 w-px bg-structure mx-1 hidden sm:block"></div>

              {/* Quick Fast Preset Buttons */}
              <button
                type="button"
                onClick={() => addService({ name: 'Zusätzliche Umzugskartons', quantity: 10, unitPrice: 3.5, unit: 'Kartons', note: 'Am Umzugstag zusätzlich bereitgestellt' })}
                className="px-3 py-1.5 text-xs bg-bg-panel border border-structure rounded-xl hover:border-primary/50 hover:text-primary transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer font-medium"
              >
                <ArchiveBoxIcon className="w-4 h-4 text-amber-500" /> + 10x Kartons (35 €)
              </button>

              <button
                type="button"
                onClick={() => addService({ name: 'Zusätzliche Möbelmontage', quantity: 1, unitPrice: 120, unit: 'Pausch.', note: 'Spontaner Mehraufwand am Umzugstag' })}
                className="px-3 py-1.5 text-xs bg-bg-panel border border-structure rounded-xl hover:border-primary/50 hover:text-primary transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer font-medium"
              >
                <WrenchIcon className="w-4 h-4 text-blue-500" /> + Montage (120 €)
              </button>

              <button
                type="button"
                onClick={() => addService({ name: 'Halteverbotszone (HVZ)', quantity: 1, unitPrice: 95, unit: 'Zone', note: 'Amtlich genehmigte Halteverbotszone' })}
                className="px-3 py-1.5 text-xs bg-bg-panel border border-structure rounded-xl hover:border-primary/50 hover:text-primary transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer font-medium"
              >
                <TruckIcon className="w-4 h-4 text-emerald-500" /> + Halteverbot (95 €)
              </button>

              {settings.serviceTemplates?.map((cat: any) => (
                <div key={cat.category} className="flex gap-2">
                  {cat.items?.map((item: any) => (
                    <button key={item.name} type="button" onClick={() => addService(item)} className="px-3 py-1.5 text-xs bg-bg-panel border border-structure rounded-lg hover:border-primary/50 hover:text-primary transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer">
                      {getCategoryIcon(cat.category)} {item.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="bg-bg-dark border border-structure rounded-2xl p-6 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 blur-xl"></div>
            <h3 className="text-sm font-bold text-text-main mb-6 flex items-center gap-2"><CalculatorIcon className="w-5 h-5 text-primary" /> Kalkulation & MwSt.</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {isFlatRate ? (
                 <div>
                   <label className="block text-xs text-text-muted mb-2 font-bold uppercase tracking-wider">Pauschalpreis Netto eingeben:</label>
                   <div className="flex items-center gap-3">
                     <input type="number" disabled={!canEditPrices || isLocked} value={flatRateNet || 0} onChange={e => setFlatRateNet(parseFloat(e.target.value))} className="input-field w-full text-right font-mono text-lg py-3 border-primary/50 shadow-inner disabled:opacity-60 disabled:cursor-not-allowed" />
                     <span className="text-xl font-bold text-text-main">€</span>
                   </div>
                 </div>
              ) : (
                <div className="p-4 bg-black/20 rounded-xl border border-white/5 flex flex-col justify-center h-full">
                  <div className="text-xs text-text-muted mb-1 font-bold uppercase tracking-wider">Summe Einzelpositionen (Netto):</div>
                  <div className="text-2xl font-mono text-text-main">{canViewPrices ? calcInput.net.toFixed(2) : '***'} €</div>
                  <div className="text-[10px] text-text-muted mt-2">Wird automatisch aus den obigen Positionen berechnet.</div>
                </div>
              )}

              <div className="space-y-4">
                 <div className="flex justify-between items-center p-3 bg-bg-panel rounded-xl border border-structure">
                    <span className="text-sm text-text-muted font-bold">Summe Netto:</span>
                    <span className="font-mono text-lg text-text-main">{canViewPrices ? calcInput.net.toFixed(2) : '***'} €</span>
                 </div>
                 <div className="flex justify-between items-center p-3 bg-bg-panel rounded-xl border border-structure">
                    <span className="text-sm text-text-muted flex items-center gap-2">MwSt (19%):</span>
                    <span className="font-mono text-lg text-text-main">{canViewPrices ? calcInput.tax.toFixed(2) : '***'} €</span>
                 </div>
                 <div className="flex justify-between items-center p-4 bg-primary/10 rounded-xl border border-primary/30 shadow-inner">
                    <span className="text-base font-bold text-primary">Gesamtbetrag (Brutto):</span>
                    <span className="font-mono text-2xl font-bold text-primary">{canViewPrices ? calcInput.gross.toFixed(2) : '***'} €</span>
                 </div>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <button onClick={() => setCurrentStep(1)} className="btn-secondary">Zurück</button>
            <button onClick={() => setCurrentStep(3)} className="btn-primary">Weiter zum Abschluss</button>
          </div>
        </section>
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
                      setTexts({...texts, paymentTerms: pm.textInvoice || pm.textQuote});
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
            <button onClick={() => setCurrentStep(2)} className="btn-secondary w-full md:w-auto">Zurück</button>
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

      {showStornoModal && (
        <StornoModal
          invoice={{
            id: orderId,
            invoiceNumber: existingInvoiceNumber,
            sourceOrderId: activeSourceOrderId,
            customerId: urlCustomerId,
            customerName: customerData.type === 'firma' ? customerData.lastName : `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim(),
            customerData,
            orderMeta,
            services,
            calcInput,
            isFlatRate,
            flatRateNet,
            _collection: orderId ? 'invoices' : undefined
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
