import React from 'react';
import { useOrderEditor } from './OrderEditorContext';

export function Step2Addresses() {
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
      
    </>
  );
}
