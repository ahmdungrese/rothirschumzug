"use client";

import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, CalculatorIcon, DocumentTextIcon, CheckCircleIcon, ArchiveBoxIcon, WrenchIcon, SparklesIcon, PlusCircleIcon, TagIcon, TruckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { toast } from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { getCol } from '@/lib/demoMode';
import { calculateOrderTotals } from '@/lib/financeHelpers';

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
  const [services, setServices] = useState<{ id: string, name: string, quantity: number, unitPrice: number, unit: string }[]>([]);
  
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
      const settingsSnap = await getDoc(doc(db, getCol('system'), 'settings'));
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
        const custSnap = await getDoc(doc(db, getCol('customers'), urlCustomerId));
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
        let oSnap = await getDoc(doc(db, getCol(targetCol), idToLoad));
        
        if (!oSnap.exists() && targetCol === 'orders') {
          oSnap = await getDoc(doc(db, getCol('invoices'), idToLoad));
        }

        if (oSnap.exists()) {
          const o = oSnap.data();
          if (orderId) setStatus(o.status);
          
          if (o.customerData) setCustomerData(o.customerData);
          else if (o.billingAddress) setCustomerData(o.billingAddress);
          
          if (o.orderMeta) setOrderMeta(prev => ({...prev, ...o.orderMeta}));
          if (o.logistics) setLogistics(o.logistics);
          if (o.isFlatRate !== undefined) setIsFlatRate(o.isFlatRate);
          if (o.flatRateNet) setFlatRateNet(o.flatRateNet);
          if (o.services) setServices(o.services);
          if (o.calcInput) setCalcInput(o.calcInput);
          if (o.texts && orderId) setTexts(prev => ({...prev, ...o.texts}));
          if (o.sourceOrderId) setActiveSourceOrderId(o.sourceOrderId);
        }
      }
    };
    init();
  }, [orderId, sourceOrderId, urlCustomerId]);

  const addService = (template: any) => {
    setServices([...services, {
      id: Math.random().toString(36).substr(2, 9),
      name: template.name,
      quantity: 1,
      unitPrice: template.unitPrice || 0,
      unit: template.unit || 'Stk.'
    }]);
  };

  const calculateTotals = () => {
    const { net, tax, gross } = calculateOrderTotals({
      isFlatRate,
      flatRateNet,
      services,
      calcInput: null // Force recalculation from services/flatRate
    });
    setCalcInput({ net, tax, gross });
  };

  useEffect(() => { calculateTotals(); }, [services, isFlatRate, flatRateNet]);

  const saveOrder = async (finalStatus: string = 'draft') => {
    if (!customerData.lastName) {
      toast.error('Bitte Nachnamen / Firmennamen eingeben');
      return;
    }
    
    setIsSaving(true);
    try {
      // Wir aktualisieren das Haupt-Kundenprofil absichtlich NICHT mehr aus dem Rechnungs-Editor,
      // damit abweichende Rechnungsadressen niemals die Stammdaten des Kunden überschreiben!

      const payload: any = {
        type: 'invoice',
        status: finalStatus,
        customerId: urlCustomerId || null,
        sourceOrderId: activeSourceOrderId || null,
        customerName: customerData.type === 'firma' ? customerData.lastName : `${customerData.firstName} ${customerData.lastName}`.trim(),
        customerData,
        orderMeta,
        logistics, // Include logistics in the invoice
        isFlatRate,
        flatRateNet,
        services,
        calcInput,
        texts,
        updatedAt: serverTimestamp()
      };

      // Centralized finalizing logic for invoices
      if (finalStatus === 'invoice_open' && !payload.invoiceNumber) {
        await runTransaction(db, async (t) => {
          // 1. ALL READS FIRST
          const settingsRef = doc(db, getCol('system'), 'settings');
          const settingsSnap = await t.get(settingsRef);
          
          let parentOrderSnap = null;
          let parentOrderRef = null;
          if (activeSourceOrderId) {
            parentOrderRef = doc(db, getCol('orders'), activeSourceOrderId);
            parentOrderSnap = await t.get(parentOrderRef);
          }

          // 2. DATA PREPARATION & CALCULATIONS
          const nextInvoiceNumber = settingsSnap.data()?.nextInvoiceNumber || 1;
          const invoiceNum = `RE-${new Date().getFullYear()}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
          
          payload.invoiceNumber = invoiceNum;
          payload.createdAt = payload.createdAt || serverTimestamp();
          
          const invoiceRef = orderId ? doc(db, getCol('invoices'), orderId) : doc(collection(db, getCol('invoices')));

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
              updatedAt: serverTimestamp()
            });
          }
          
          // Update Settings
          t.update(settingsRef, { nextInvoiceNumber: nextInvoiceNumber + 1 });
        });

        await logActivity(user?.uid || '', profile?.displayName || 'Unbekannt', orderId ? 'UPDATE_ORDER' : 'CREATE_ORDER', `Rechnung ausgestellt: ${payload.invoiceNumber}`);
        toast.success('Rechnung erfolgreich ausgestellt!');
      } else {
        // Just save draft
        if (orderId) {
          await updateDoc(doc(db, getCol('invoices'), orderId), payload);
          await logActivity(user?.uid || '', profile?.displayName || 'Unbekannt', 'UPDATE_ORDER', `Rechnungsentwurf bearbeitet`);
          toast.success('Rechnungsentwurf gespeichert!');
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, getCol('invoices')), payload);
          await logActivity(user?.uid || '', profile?.displayName || 'Unbekannt', 'CREATE_ORDER', `Neuer Rechnungsentwurf für ${customerData.lastName}`);
          toast.success('Rechnungsentwurf erstellt!');
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
      <div className="flex justify-between items-center bg-bg-panel border border-structure p-4 rounded-xl shadow-lg mt-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            {orderId ? 'Rechnung bearbeiten' : 'Neue Rechnung'}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Rechnungsdaten eingeben und dokumentieren.
          </p>
        </div>
        {orderId && status === 'draft' && (
          <button
            onClick={async () => {
              if (confirm('Möchten Sie diesen Rechnungsentwurf wirklich löschen?')) {
                try {
                  const targetCol = activeSourceOrderId ? 'orders' : 'invoices';
                  // Verify if we need to check the other collection just in case
                  let updateCol = targetCol;
                  if (!activeSourceOrderId) {
                    const checkInv = await getDoc(doc(db, getCol('invoices'), orderId));
                    if (!checkInv.exists()) updateCol = 'orders';
                  }
                  await deleteDoc(doc(db, getCol(updateCol), orderId));
                  toast.success('Rechnungsentwurf gelöscht!');
                  router.push(`/dashboard/customers/${urlCustomerId}`);
                } catch (error) {
                  console.error(error);
                  toast.error('Fehler beim Löschen des Entwurfs.');
                }
              }
            }}
            className="btn-secondary px-4 py-2 bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20 flex items-center gap-2"
          >
            <TrashIcon className="w-5 h-5" /> Entwurf löschen
          </button>
        )}
      </div>
      
      <div className="glass-panel p-4 rounded-xl shadow-lg flex items-center justify-start overflow-x-auto custom-scrollbar gap-4">
        {[
          { step: 1, label: 'Kunde & Daten', icon: '👤' },
          { step: 2, label: 'Leistungen & Preise', icon: '💶' },
          { step: 3, label: 'Abschluss & Speichern', icon: '✅' }
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
                  <div className="col-span-2">
                    <label className="block text-xs text-text-muted mb-1">Firmenname *</label>
                    <input type="text" value={customerData.lastName} onChange={e => setCustomerData({...customerData, lastName: e.target.value})} className="input-field w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">Ansprechpartner</label>
                    <input type="text" value={customerData.firstName} onChange={e => setCustomerData({...customerData, firstName: e.target.value})} className="input-field w-full" />
                  </div>
                </>
              )}
            
            <div>
              <label className="block text-xs text-text-muted mb-1">E-Mail Adresse</label>
              <input type="email" value={customerData.email} onChange={e => setCustomerData({...customerData, email: e.target.value})} className="input-field w-full" />
            </div>

            <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2 border-t border-structure pt-4">
              <h3 className="text-sm font-semibold text-text-main mb-3">Rechnungsadresse</h3>
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
                  <input type="text" value={customerData.zip} onChange={e => setCustomerData({...customerData, zip: e.target.value})} className="input-field w-full" />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-text-muted mb-1">Ort</label>
                  <input type="text" value={customerData.city} onChange={e => setCustomerData({...customerData, city: e.target.value})} className="input-field w-full" />
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-4 mt-2 border-t border-structure pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
               <div>
                  <label className="block text-xs text-text-muted mb-1">Rechnungsdatum</label>
                  <input type="date" value={orderMeta.invoiceDate} onChange={e => setOrderMeta({...orderMeta, invoiceDate: e.target.value})} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Fällig bis</label>
                  <input type="date" value={orderMeta.validUntil} onChange={e => setOrderMeta({...orderMeta, validUntil: e.target.value})} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Bearbeiter</label>
                  <input type="text" value={orderMeta.manager} onChange={e => setOrderMeta({...orderMeta, manager: e.target.value})} className="input-field w-full" />
                </div>
            </div>

            {/* Logistics Section for Draft Invoices */}
            {sourceOrderId && (
              <div className="col-span-1 md:col-span-4 mt-4 border-t border-structure pt-4">
                <h3 className="text-sm font-semibold text-text-main mb-3">Leistungsort (Auszug / Einzug)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-bg-dark p-3 rounded-xl border border-structure">
                    <label className="block text-xs font-bold text-primary mb-2">Auszugsort (Start)</label>
                    <input type="text" placeholder="Straße & Haus-Nr." value={`${logistics?.a_street || ''} ${logistics?.a_houseNr || ''}`.trim()} onChange={e => {
                      const parts = e.target.value.split(/(?=\d)/);
                      const street = parts[0]?.trim() || '';
                      const houseNr = parts.slice(1).join('').trim() || '';
                      setLogistics({...logistics, a_street: street, a_houseNr: houseNr});
                    }} className="input-field w-full mb-2 text-xs" />
                    <div className="flex gap-2">
                      <input type="text" placeholder="PLZ" value={logistics?.a_zip || ''} onChange={e => setLogistics({...logistics, a_zip: e.target.value})} className="input-field w-1/3 text-xs" />
                      <input type="text" placeholder="Ort" value={logistics?.a_city || ''} onChange={e => setLogistics({...logistics, a_city: e.target.value})} className="input-field w-2/3 text-xs" />
                    </div>
                  </div>
                  <div className="bg-bg-dark p-3 rounded-xl border border-structure">
                    <label className="block text-xs font-bold text-primary mb-2">Einzugsort (Ziel)</label>
                    <input type="text" placeholder="Straße & Haus-Nr." value={`${logistics?.b_street || ''} ${logistics?.b_houseNr || ''}`.trim()} onChange={e => {
                      const parts = e.target.value.split(/(?=\d)/);
                      const street = parts[0]?.trim() || '';
                      const houseNr = parts.slice(1).join('').trim() || '';
                      setLogistics({...logistics, b_street: street, b_houseNr: houseNr});
                    }} className="input-field w-full mb-2 text-xs" />
                    <div className="flex gap-2">
                      <input type="text" placeholder="PLZ" value={logistics?.b_zip || ''} onChange={e => setLogistics({...logistics, b_zip: e.target.value})} className="input-field w-1/3 text-xs" />
                      <input type="text" placeholder="Ort" value={logistics?.b_city || ''} onChange={e => setLogistics({...logistics, b_city: e.target.value})} className="input-field w-2/3 text-xs" />
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
              <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
                <input type="radio" name="billingMode" checked={isFlatRate} onChange={() => setIsFlatRate(true)} className="accent-primary" />
                Pauschalpreis
              </label>
              <label className="flex items-center gap-2 text-sm text-text-main cursor-pointer">
                <input type="radio" name="billingMode" checked={!isFlatRate} onChange={() => setIsFlatRate(false)} className="accent-primary" />
                Nach Einzelpositionen berechnen
              </label>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            {services.map((service, index) => (
              <div key={service.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end bg-bg-panel p-3 rounded-lg border border-structure shadow-sm">
                <div className="col-span-1 md:col-span-1 hidden md:flex justify-center items-center h-full text-text-muted font-bold">{index + 1}.</div>
                <div className="col-span-1 md:col-span-5">
                  <label className="block text-[10px] text-text-muted mb-1 uppercase font-bold tracking-wider">Leistung</label>
                  <input type="text" value={service.name} onChange={e => {
                    const newS = [...services];
                    newS[index].name = e.target.value;
                    setServices(newS);
                  }} className="input-field w-full" placeholder="Bezeichnung..." />
                </div>
                <div className="col-span-1 md:col-span-2">
                  <label className="block text-[10px] text-text-muted mb-1 uppercase font-bold tracking-wider">Menge</label>
                  <div className="flex gap-1">
                    <input type="number" step="0.5" value={service.quantity || 0} onChange={e => {
                      const newS = [...services];
                      newS[index].quantity = parseFloat(e.target.value);
                      setServices(newS);
                    }} className="input-field w-full text-center" />
                    <select value={service.unit} onChange={e => {
                      const newS = [...services];
                      newS[index].unit = e.target.value;
                      setServices(newS);
                    }} className="input-field px-1 min-w-[60px] text-xs">
                      <option value="Stk.">Stk.</option>
                      <option value="Std.">Std.</option>
                      <option value="qm">qm</option>
                      <option value="Pausch.">Pausch.</option>
                      <option value="Lfm">Lfm</option>
                      <option value="Kartons">Kartons</option>
                      <option value="m³">m³</option>
                    </select>
                  </div>
                </div>
                <div className="col-span-1 md:col-span-3">
                  <label className="block text-[10px] text-text-muted mb-1 uppercase font-bold tracking-wider">Einzelpreis (Netto)</label>
                  <div className="flex items-center gap-2">
                    <input type="number" disabled={!canEditPrices} value={service.unitPrice || 0} onChange={e => {
                      const newS = [...services];
                      newS[index].unitPrice = parseFloat(e.target.value);
                      setServices(newS);
                    }} className="input-field w-full text-right font-mono" />
                    <span className="text-text-muted">€</span>
                  </div>
                </div>
                <div className="col-span-1 md:col-span-1 flex justify-end">
                  <button onClick={() => setServices(services.filter(s => s.id !== service.id))} className="p-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors border border-red-500/20 shadow-sm" title="Position löschen">
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 mb-8">
            <button onClick={() => addService({ name: '', unitPrice: 0 })} className="btn-secondary text-sm py-2 px-4 bg-bg-dark border border-structure shadow-sm flex items-center gap-2">
              <PlusIcon className="w-4 h-4" /> Leere Position
            </button>
            <div className="h-8 w-px bg-structure mx-2 hidden sm:block"></div>
            {settings.serviceTemplates?.map((cat: any) => (
              <div key={cat.category} className="flex gap-2">
                {cat.items?.map((item: any) => (
                  <button key={item.name} onClick={() => addService(item)} className="px-3 py-1.5 text-xs bg-bg-panel border border-structure rounded-lg hover:border-primary/50 hover:text-primary transition-colors flex items-center gap-1.5 shadow-sm">
                    {getCategoryIcon(cat.category)} {item.name}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="bg-bg-dark border border-structure rounded-2xl p-6 shadow-inner relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10 blur-xl"></div>
            <h3 className="text-sm font-bold text-text-main mb-6 flex items-center gap-2"><CalculatorIcon className="w-5 h-5 text-primary" /> Kalkulation & MwSt.</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {isFlatRate ? (
                 <div>
                   <label className="block text-xs text-text-muted mb-2 font-bold uppercase tracking-wider">Pauschalpreis Netto eingeben:</label>
                   <div className="flex items-center gap-3">
                     <input type="number" disabled={!canEditPrices} value={flatRateNet || 0} onChange={e => setFlatRateNet(parseFloat(e.target.value))} className="input-field w-full text-right font-mono text-lg py-3 border-primary/50 shadow-inner" />
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
              <textarea value={texts.quoteIntro} onChange={e => setTexts({...texts, quoteIntro: e.target.value})} className="input-field w-full h-24" placeholder="Sehr geehrte(r)..." />
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
                  className="text-xs px-3 py-1.5 bg-bg-panel border border-structure text-text-main hover:text-primary rounded-lg transition-colors shadow-sm"
                >
                  📍 Adressen einfügen
                </button>
                <button 
                  onClick={() => {
                    const movingDate = orderMeta?.movingDateFrom ? new Date(orderMeta.movingDateFrom).toLocaleDateString('de-DE') : '___';
                    const textToAdd = `am ${movingDate}`;
                    setTexts({...texts, quoteIntro: texts.quoteIntro ? `${texts.quoteIntro} ${textToAdd}` : textToAdd});
                  }}
                  className="text-xs px-3 py-1.5 bg-bg-panel border border-structure text-text-main hover:text-primary rounded-lg transition-colors shadow-sm"
                >
                  📅 Umzugsdatum einfügen
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 font-bold">Zahlungsbedingungen</label>
              <textarea value={texts.paymentTerms} onChange={e => setTexts({...texts, paymentTerms: e.target.value})} className="input-field w-full h-24" placeholder="Zahlbar innerhalb von..." />
              
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
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1 font-bold">Rechnung Schlusstext</label>
              <textarea value={texts.quoteOutro} onChange={e => setTexts({...texts, quoteOutro: e.target.value})} className="input-field w-full h-20" placeholder="Wir bedanken uns..." />
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-structure">
            <button onClick={() => setCurrentStep(2)} className="btn-secondary w-full md:w-auto">Zurück</button>
            <div className="flex gap-4 w-full md:w-auto">
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
                {isSaving ? 'Speichere...' : <><CheckCircleIcon className="w-5 h-5" /> Rechnung ausstellen</>}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
