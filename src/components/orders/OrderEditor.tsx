"use client";

import { useState } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';

export function OrderEditor({ orderId }: { orderId?: string }) {
  const params = useParams();
  const customerId = params.id as string;
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const [isFlatRate, setIsFlatRate] = useState(false);
  const [flatRateNet, setFlatRateNet] = useState<number>(0);

  const [services, setServices] = useState<{ id: string, name: string, quantity: number, unitPrice: number }[]>([
    { id: '1', name: 'Umzugskartons Standard', quantity: 20, unitPrice: 2.50 }
  ]);
  const [presetServices, setPresetServices] = useState<any[]>([]);

  useEffect(() => {
    import('firebase/firestore').then(({ collection, getDocs }) => {
      getDocs(collection(db, 'services')).then((snapshot) => {
        setPresetServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    });
  }, []);
  
  const [logistics, setLogistics] = useState({
    noParkingZone: false,
    furnitureLift: false,
    floors: 0,
    walkingDistance: 0
  });

  const addService = () => {
    setServices([...services, { id: Date.now().toString(), name: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateService = (id: string, field: string, value: any) => {
    setServices(services.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      // Auto-fill price if name matches a preset
      if (field === 'name') {
        const preset = presetServices.find(p => p.name === value);
        if (preset) {
          updated.unitPrice = preset.defaultPrice;
        }
      }
      return updated;
    }));
  };

  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const calculateTotal = () => {
    if (isFlatRate) {
      return { net: flatRateNet, tax: flatRateNet * 0.19, gross: flatRateNet * 1.19 };
    }
    const net = services.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    return { net, tax: net * 0.19, gross: net * 1.19 };
  };

  const totals = calculateTotal();

  const saveOrder = async (status: 'draft' | 'quote') => {
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'orders'), {
        customerId,
        status,
        isFlatRate,
        flatRateNet: isFlatRate ? flatRateNet : 0,
        services,
        logistics,
        totals,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      alert(`Erfolgreich als ${status === 'draft' ? 'Entwurf' : 'Angebot'} gespeichert!`);
      router.push(`/dashboard/customers/${customerId}`);
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      
      {/* 1. Logistik-Hürden */}
      <section className="panel border-t-4 border-t-structure shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-text-main flex items-center gap-2">
          🚚 Logistik & Hürden
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <label className="flex items-center gap-3 p-4 border border-structure rounded-xl cursor-pointer hover:bg-structure/30 transition-colors">
            <input 
              type="checkbox" 
              checked={logistics.noParkingZone}
              onChange={(e) => setLogistics({...logistics, noParkingZone: e.target.checked})}
              className="w-5 h-5 accent-primary rounded" 
            />
            <span className={`font-medium ${logistics.noParkingZone ? 'text-red-400' : 'text-text-main'}`}>Halteverbotszone</span>
          </label>
          <label className="flex items-center gap-3 p-4 border border-structure rounded-xl cursor-pointer hover:bg-structure/30 transition-colors">
            <input 
              type="checkbox" 
              checked={logistics.furnitureLift}
              onChange={(e) => setLogistics({...logistics, furnitureLift: e.target.checked})}
              className="w-5 h-5 accent-primary rounded" 
            />
            <span className="font-medium text-text-main">Möbellift benötigt</span>
          </label>
          <div className="p-4 border border-structure rounded-xl">
            <label className="block text-sm font-medium text-text-muted mb-1">Etagen (Trageweg)</label>
            <input 
              type="number" 
              value={logistics.floors}
              onChange={(e) => setLogistics({...logistics, floors: parseInt(e.target.value) || 0})}
              className="input-field py-1.5 px-3 bg-bg-dark/50"
              min="0"
            />
          </div>
          <div className="p-4 border border-structure rounded-xl">
            <label className="block text-sm font-medium text-text-muted mb-1">Laufweg (Meter)</label>
            <input 
              type="number" 
              value={logistics.walkingDistance}
              onChange={(e) => setLogistics({...logistics, walkingDistance: parseInt(e.target.value) || 0})}
              className="input-field py-1.5 px-3 bg-bg-dark/50"
              min="0"
              step="5"
            />
          </div>
        </div>
        {logistics.noParkingZone && (
          <div className="mt-6 bg-red-900/20 border border-red-500/30 text-red-300 p-4 rounded-xl text-sm flex items-start gap-3 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <span className="text-2xl mt-0.5">🚨</span> 
            <div>
              <strong className="block text-base text-red-200 mb-1">Halteverbotszone aktiviert!</strong>
              Dies wird ab sofort als Warnung im Admin-Dashboard angezeigt, bis sie offiziell genehmigt und organisiert wurde.
            </div>
          </div>
        )}
      </section>

      {/* 2. Leistungsmatrix */}
      <section className="panel border-t-4 border-t-primary shadow-lg overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-structure pb-4">
          <h2 className="text-xl font-semibold text-text-main flex items-center gap-2">
            📋 Leistungsmatrix
          </h2>
          
          <label className="flex items-center gap-3 bg-bg-dark px-4 py-2 rounded-xl cursor-pointer border border-structure shadow-inner">
            <span className="font-medium text-sm text-text-muted">Pauschalpreis-Modus:</span>
            <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isFlatRate ? 'bg-primary shadow-[0_0_8px_rgba(143,22,39,0.5)]' : 'bg-structure'}`}>
              <input type="checkbox" className="sr-only" checked={isFlatRate} onChange={(e) => setIsFlatRate(e.target.checked)} />
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isFlatRate ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
          </label>
        </div>

        <datalist id="preset-services">
          {presetServices.map(s => <option key={s.id} value={s.name} />)}
        </datalist>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-structure text-text-muted text-sm bg-bg-dark/30">
                <th className="py-3 px-2 w-20 font-medium">Menge</th>
                <th className="py-3 px-2 font-medium">Leistung / Beschreibung</th>
                {!isFlatRate && <th className="py-3 px-2 w-32 font-medium">Einzelpreis (€)</th>}
                <th className="py-3 px-2 w-32 text-right font-medium">Gesamt (€)</th>
                <th className="py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {services.map((item) => (
                <tr key={item.id} className="border-b border-structure/30 group hover:bg-structure/10 transition-colors">
                  <td className="py-2 px-2">
                    <input 
                      type="number" 
                      value={item.quantity}
                      onChange={(e) => updateService(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="input-field py-2 px-1 text-center bg-transparent border-transparent hover:border-structure focus:bg-bg-dark focus:border-primary transition-all"
                      min="1"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input 
                      type="text" 
                      value={item.name}
                      onChange={(e) => updateService(item.id, 'name', e.target.value)}
                      list="preset-services"
                      className="input-field py-2 px-3 bg-transparent border-transparent hover:border-structure focus:bg-bg-dark focus:border-primary transition-all"
                      placeholder="Bezeichnung eingeben oder wählen..."
                    />
                  </td>
                  {!isFlatRate && (
                    <td className="py-2 px-2">
                      <input 
                        type="number" 
                        value={item.unitPrice}
                        onChange={(e) => updateService(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="input-field py-2 px-3 text-right bg-transparent border-transparent hover:border-structure focus:bg-bg-dark focus:border-primary transition-all"
                        min="0"
                        step="0.01"
                      />
                    </td>
                  )}
                  <td className="py-2 px-2 text-right font-medium text-text-muted">
                    {isFlatRate ? (
                      <span className="italic text-xs text-primary bg-primary/10 border border-primary/20 px-2 py-1 rounded">Inklusiv</span>
                    ) : (
                      (item.quantity * item.unitPrice).toFixed(2)
                    )}
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button onClick={() => removeService(item.id)} className="text-text-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={addService} className="mt-4 flex items-center gap-2 text-primary hover:text-primary-hover font-medium text-sm transition-colors px-2 py-2 rounded-lg hover:bg-primary/5">
          <PlusIcon className="w-5 h-5" /> Leistung hinzufügen
        </button>

        {/* Summen */}
        <div className="mt-8 flex justify-end">
          <div className="w-full max-w-sm bg-bg-dark rounded-xl p-6 border border-structure shadow-inner">
            {isFlatRate && (
              <div className="mb-6 pb-6 border-b border-structure">
                <label className="block text-sm font-semibold text-primary mb-2 uppercase tracking-wide">Pauschal-Endsumme (Netto)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-lg">€</span>
                  <input 
                    type="number" 
                    value={flatRateNet}
                    onChange={(e) => setFlatRateNet(parseFloat(e.target.value) || 0)}
                    className="input-field pl-10 py-3 text-2xl font-bold text-white bg-bg-panel border-primary shadow-[0_0_10px_rgba(143,22,39,0.2)]"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <p className="text-xs text-text-muted mt-3 italic">Die oben erfassten Leistungen werden auf dem PDF als "Inklusiv" ohne Einzelpreise ausgewiesen.</p>
              </div>
            )}
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-text-muted">
                <span>Summe Netto:</span>
                <span>€ {totals.net.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>zzgl. 19% MwSt:</span>
                <span>€ {totals.tax.toFixed(2)}</span>
              </div>
              <div className="pt-4 mt-2 border-t border-structure flex justify-between font-bold text-xl text-text-main">
                <span>Gesamt (Brutto):</span>
                <span className="text-primary">€ {totals.gross.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Save Button */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-bg-panel/90 backdrop-blur-md border-t border-structure p-4 flex justify-end z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.3)]">
        <div className="max-w-7xl w-full mx-auto flex justify-between items-center px-4 lg:px-8">
          <span className="text-sm text-text-muted hidden sm:inline flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
            </span>
            Ungespeicherte Änderungen
          </span>
          <div className="flex gap-4">
            <button onClick={() => saveOrder('draft')} disabled={isSaving} className="btn-secondary">
              {isSaving ? 'Speichert...' : 'Als Entwurf speichern'}
            </button>
            <button onClick={() => saveOrder('quote')} disabled={isSaving} className="btn-primary">
              {isSaving ? 'Bitte warten...' : <span>Angebot erstellen <span className="hidden sm:inline">-&gt; Laufzettel generieren</span></span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
