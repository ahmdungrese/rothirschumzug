"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { 
  addDoc, 
  collection, 
  serverTimestamp, 
  getDocs, 
  query, 
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { 
  XMarkIcon, 
  ExclamationTriangleIcon, 
  MagnifyingGlassIcon,
  UserIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  CurrencyEuroIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';
import { triggerHaptic } from '@/lib/haptics';

export interface ClaimModalProps {
  customerId?: string;
  customerName?: string;
  orderId?: string;
  orderNumber?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ClaimModal({ 
  customerId, 
  customerName, 
  orderId, 
  orderNumber,
  onClose,
  onSuccess
}: ClaimModalProps) {
  useModalBackHandler(true, onClose, 'claim-modal');

  // Customer selection state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customerId || '');
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>(customerName || '');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(!customerId);

  // Orders list state
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orderId || '');
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string>(orderNumber || '');
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Form Fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [settlementPreference, setSettlementPreference] = useState('rechnung_abzug');
  const [insuranceId, setInsuranceId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load all customers if not pre-provided
  useEffect(() => {
    if (customerId) return;
    const fetchCustomers = async () => {
      try {
        setLoadingCustomers(true);
        const snap = await getDocs(collection(db, 'customers'));
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((c: any) => !c.isArchived);
        
        list.sort((a: any, b: any) => {
          const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim().toLowerCase();
          const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim().toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setCustomersList(list);
      } catch (err) {
        console.error('Fehler beim Laden der Kunden:', err);
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, [customerId]);

  // Load orders for selected customer
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerOrders([]);
      return;
    }
    const fetchOrders = async () => {
      try {
        setLoadingOrders(true);
        const qOrders = query(
          collection(db, 'orders'),
          where('customerId', '==', selectedCustomerId)
        );
        const snap = await getDocs(qOrders);
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter((o: any) => !o.isArchived && o.status !== 'archived');

        list.sort((a: any, b: any) => {
          const dateA = a.moveDate || a.createdAt?.toDate?.()?.toISOString() || '';
          const dateB = b.moveDate || b.createdAt?.toDate?.()?.toISOString() || '';
          return dateB.localeCompare(dateA);
        });

        setCustomerOrders(list);

        // If an orderId was pre-provided or we only have 1 order, select it
        if (orderId && !selectedOrderId) {
          setSelectedOrderId(orderId);
          const found = list.find((o: any) => o.id === orderId) as any;
          if (found) {
            setSelectedOrderNumber(found.orderNumber || found.offerNumber || '');
          }
        }
      } catch (err) {
        console.error('Fehler beim Laden der Aufträge:', err);
      } finally {
        setLoadingOrders(false);
      }
    };
    fetchOrders();
  }, [selectedCustomerId, orderId]);

  // Filtered customer list for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customersList.slice(0, 50);
    const q = customerSearch.toLowerCase();
    return customersList.filter(c => {
      const full = `${c.firstName || ''} ${c.lastName || ''} ${c.company || ''} ${c.city || ''} ${c.phone || ''}`.toLowerCase();
      return full.includes(q);
    });
  }, [customersList, customerSearch]);

  const handleSelectCustomer = (c: any) => {
    const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.company || 'Kunde';
    setSelectedCustomerId(c.id);
    setSelectedCustomerName(fullName);
    setSelectedOrderId('');
    setSelectedOrderNumber('');
    setCustomerSearch('');
  };

  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedOrderId(val);
    if (!val) {
      setSelectedOrderNumber('');
      return;
    }
    const found = customerOrders.find(o => o.id === val);
    if (found) {
      setSelectedOrderNumber(found.orderNumber || found.offerNumber || '');
    }
  };

  const save = async () => {
    if (!selectedCustomerId) {
      toast.error("Bitte wählen Sie zuerst einen Kunden aus.");
      return;
    }

    if (!description.trim()) {
      toast.error("Bitte eine Beschreibung des Schadens oder Problems eingeben.");
      return;
    }
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'claims'), {
        customerId: selectedCustomerId,
        customerName: selectedCustomerName || 'Unbekannter Kunde',
        orderId: selectedOrderId || null,
        orderNumber: selectedOrderNumber || null,
        description: description.trim(),
        amount: amount ? parseFloat(amount) : null,
        settlementPreference,
        insuranceId: insuranceId.trim() || null,
        status: 'Neu',
        source: 'manual',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        photos: []
      });
      
      triggerHaptic('success');
      toast.success("Reklamation / Schaden erfolgreich im System erfasst! 🛡️");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Fehler beim Speichern der Reklamation:", error);
      toast.error("Fehler beim Speichern der Meldung.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[100] animate-in fade-in duration-200">
      <div className="bg-bg-panel border border-structure rounded-t-3xl sm:rounded-3xl w-full max-w-xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 flex flex-col">
        
        {/* Mobile Drag Handle */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden bg-red-950/20">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-structure flex justify-between items-center bg-red-900/15 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
              <ExclamationTriangleIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-text-main font-headline">
                Neue Reklamation erfassen
              </h2>
              <p className="text-[11px] text-text-muted">
                Schaden, Mangel oder Kundenproblem zentral erfassen
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-text-muted hover:text-text-main rounded-xl hover:bg-bg-card transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        
        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5 custom-scrollbar">

          {/* 1. Customer Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main uppercase tracking-wider font-headline">
              <UserIcon className="w-3.5 h-3.5 text-primary" />
              1. Kunde auswählen <span className="text-red-500">*</span>
            </label>

            {customerId ? (
              // Pre-selected customer badge
              <div className="p-3 rounded-2xl bg-bg-card border border-structure flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-text-main block">
                    {selectedCustomerName || 'Ausgewählter Kunde'}
                  </span>
                  <span className="text-[10px] text-text-muted">Kunde aus aktueller Akte</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Zugeordnet ✓
                </span>
              </div>
            ) : selectedCustomerId ? (
              // Selected customer with change option
              <div className="p-3 rounded-2xl bg-bg-card border border-primary/40 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-text-main block">
                    {selectedCustomerName}
                  </span>
                  <span className="text-[10px] text-text-muted">ID: {selectedCustomerId.slice(0, 10)}...</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId('');
                    setSelectedCustomerName('');
                    setSelectedOrderId('');
                    setSelectedOrderNumber('');
                  }}
                  className="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  Anderen Kunden wählen
                </button>
              </div>
            ) : (
              // Customer Search & Dropdown Picker
              <div className="space-y-2">
                <div className="relative">
                  <MagnifyingGlassIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    maxLength={60}
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value.replace(/<[^>]*>/g, '').replace(/[\r\n]+/g, '').slice(0, 60))}
                    placeholder="Kunde suchen (Name, Firma, Ort)..."
                    className="w-full pl-10 pr-4 py-2.5 text-xs rounded-2xl bg-bg-card border border-structure focus:outline-none focus:ring-2 focus:ring-primary text-text-main placeholder:text-text-muted"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto border border-structure rounded-2xl bg-bg-card divide-y divide-structure custom-scrollbar">
                  {loadingCustomers ? (
                    <div className="p-3 text-center text-xs text-text-muted">Kunden werden geladen...</div>
                  ) : filteredCustomers.length === 0 ? (
                    <div className="p-3 text-center text-xs text-text-muted">Keine Kunden gefunden</div>
                  ) : (
                    filteredCustomers.map((c: any) => {
                      const name = `${c.lastName || ''}, ${c.firstName || ''}`.trim() || c.company || 'Kunde';
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCustomer(c)}
                          className="w-full text-left p-2.5 hover:bg-bg-panel transition-colors flex items-center justify-between gap-2 text-xs cursor-pointer"
                        >
                          <div>
                            <span className="font-bold text-text-main block">{name}</span>
                            {c.city && <span className="text-[10px] text-text-muted">{c.city}</span>}
                          </div>
                          {c.phone && (
                            <span className="text-[10px] font-mono text-text-muted shrink-0">{c.phone}</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Order / Quote Selection */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main uppercase tracking-wider font-headline">
              <DocumentTextIcon className="w-3.5 h-3.5 text-primary" />
              2. Angebot oder Auftrag zuordnen <span className="text-text-muted text-[10px] lowercase font-normal">(optional)</span>
            </label>

            {!selectedCustomerId ? (
              <p className="text-[11px] text-text-muted italic bg-bg-card/50 p-2.5 rounded-xl border border-structure">
                Wählen Sie zuerst oben einen Kunden aus, um dessen Aufträge und Angebote zu sehen.
              </p>
            ) : loadingOrders ? (
              <p className="text-[11px] text-text-muted italic p-2.5">Aufträge werden geladen...</p>
            ) : (
              <select
                value={selectedOrderId}
                onChange={handleOrderChange}
                className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-bg-card border border-structure focus:outline-none focus:ring-2 focus:ring-primary text-text-main cursor-pointer"
              >
                <option value="">-- Ohne konkreten Auftrag (Allgemeine Reklamation) --</option>
                {customerOrders.map((ord: any) => {
                  const num = ord.orderNumber || ord.offerNumber || ord.id.slice(0, 8);
                  const isOffer = ord.status === 'draft' || ord.status === 'offer_sent';
                  const dateStr = ord.moveDate 
                    ? `Umzug: ${new Date(ord.moveDate).toLocaleDateString('de-DE')}`
                    : (ord.createdAt?.toDate ? `Erstellt: ${ord.createdAt.toDate().toLocaleDateString('de-DE')}` : '');
                  const price = ord.totals?.gross ? `${ord.totals.gross.toFixed(2)} €` : '';
                  const label = `${isOffer ? 'Angebot' : 'Auftrag'} #${num} ${dateStr ? `(${dateStr})` : ''} ${price ? `- ${price}` : ''}`;
                  return (
                    <option key={ord.id} value={ord.id}>
                      {label}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* 3. Damage Description */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-text-main uppercase tracking-wider font-headline">
              3. Beschreibung des Schadens / Problems <span className="text-red-500">*</span>
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3.5 text-xs rounded-2xl bg-bg-card border border-red-500/30 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40 text-text-main h-24 placeholder:text-text-muted leading-relaxed"
              placeholder="Was ist genau passiert? (z.B. Kratzer an der Schranktür beim Transport durch das Treppenhaus, Transportschaden am Fernseher...)"
              required
            />
          </div>

          {/* 4. Financials & Settlement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-main uppercase tracking-wider font-headline">
                Schadenshöhe / Betrag (€)
              </label>
              <div className="relative">
                <input 
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono rounded-2xl bg-bg-card border border-structure focus:outline-none focus:ring-2 focus:ring-primary text-text-main"
                  placeholder="z.B. 150.00"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-text-muted font-bold">€</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-text-main uppercase tracking-wider font-headline">
                Geplante Abwicklung
              </label>
              <select
                value={settlementPreference}
                onChange={(e) => setSettlementPreference(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-bg-card border border-structure focus:outline-none focus:ring-2 focus:ring-primary text-text-main cursor-pointer"
              >
                <option value="rechnung_abzug">Mit Rechnung verrechnen (Abzug)</option>
                <option value="versicherung">Über Versicherung einreichen</option>
                <option value="auszahlung">Direkte Auszahlung an Kunden</option>
                <option value="kulanz">Kulanzregelung / Nachbesserung</option>
                <option value="offen">Noch in Prüfung / Offen</option>
              </select>
            </div>
          </div>
          
          {/* 5. Insurance Number (Optional) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main uppercase tracking-wider font-headline">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-text-muted" />
              Versicherungs-Schadensnummer <span className="text-text-muted text-[10px] lowercase font-normal">(optional)</span>
            </label>
            <input 
              type="text"
              value={insuranceId}
              onChange={(e) => setInsuranceId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-bg-card border border-structure focus:outline-none focus:ring-2 focus:ring-primary text-text-main placeholder:text-text-muted font-mono"
              placeholder="z.B. V-123456789"
            />
            <p className="text-[10px] text-text-muted">
              Kann auch nachträglich ergänzt werden, sobald der Vorgang an die Versicherung gemeldet wurde.
            </p>
          </div>

        </div>
        
        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-structure bg-bg-card/50 flex items-center justify-end gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2.5 rounded-xl border border-structure text-xs font-bold text-text-muted hover:text-text-main transition-colors cursor-pointer"
          >
            Abbrechen
          </button>
          <button 
            type="button"
            onClick={save} 
            disabled={isSaving} 
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <ExclamationTriangleIcon className="w-4 h-4" />
            <span>{isSaving ? 'Speichert...' : 'Reklamation anlegen'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
