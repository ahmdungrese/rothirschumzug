import React from 'react';
import { useOrderEditor } from './OrderEditorContext';

export function Step1Customer() {
  const {
    customerData, setCustomerData, orderMeta, setOrderMeta, logistics, setLogistics,
    isFlatRate, setIsFlatRate, flatRateNet, setFlatRateNet, services, setServices,
    catalogSearch, setCatalogSearch, activeCategoryTab, setActiveCategoryTab, calcInput, setCalcInput,
    inventory, setInventory, appendInventoryToPDF, setAppendInventoryToPDF, isInventoryWizardOpen, setIsInventoryWizardOpen,
    totals, saveOrder, calculateRoute, updateFurnitureCount, addService, removeService,
    toggleStandardService, isStandardServiceSelected, updateServiceQuantity, updateServicePrice, updateServiceNote,
    generatePDF, isSaving, canEditPrices, canViewPrices
  } = useOrderEditor();

  return (
    <>
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
      
    </>
  );
}
