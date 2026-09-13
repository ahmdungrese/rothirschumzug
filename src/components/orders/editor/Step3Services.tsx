import React from 'react';
import { useOrderEditor } from './OrderEditorContext';
import { STANDARD_SERVICES_A, STANDARD_SERVICES_B, STANDARD_SERVICES_FIXED } from './orderConstants';

export function Step3Services() {
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

                {/* Standard-Leistungen Picker */}
                <div className="mb-6 bg-bg-dark/40 rounded-2xl border border-structure/60 shadow-sm p-4 sm:p-5 flex flex-col gap-6">
                  <div className="flex items-center gap-2 border-b border-structure/60 pb-3">
                    <span className="material-symbols-outlined text-primary text-xl">view_list</span>
                    <span className="text-sm font-headline font-bold text-text-main">
                      Typische Umzugsleistungen
                    </span>
                  </div>

                  {/* Feste Leistungen (Transport, Basisschutz) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-structure/50">
                      <span className="w-6 h-6 rounded-full bg-slate-500/20 text-slate-400 flex items-center justify-center font-bold text-xs">
                        *
                      </span>
                      <h4 className="font-headline font-bold text-xs uppercase tracking-wider text-text-main">
                        Allgemeine & Feste Leistungen
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {STANDARD_SERVICES_FIXED.map((svc) => {
                        const isSelected = isStandardServiceSelected(svc.id, svc.name);
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
                              <span className="text-xs font-semibold truncate">{svc.name}</span>
                            </div>
                            <span className={`material-symbols-outlined text-base shrink-0 ${isSelected ? 'text-primary' : 'text-text-muted/60'}`}>
                              {isSelected ? 'check_circle' : 'add_circle'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
                          <tr key={svc.id} className="hover:bg-white/[0.02] transition-colors group align-top">
                            <td className="p-2.5 pl-4 flex flex-col gap-1.5">
                              <input
                                type="text"
                                value={svc.name}
                                onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                                className="bg-transparent font-medium text-text-main w-full focus:outline-none focus:bg-black/20 rounded px-1"
                              />
                              <textarea
                                value={svc.note || ''}
                                onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, note: e.target.value } : s))}
                                placeholder="Optionale Beschreibung (erscheint im Angebot)..."
                                className="text-[10px] text-text-muted bg-black/10 focus:bg-black/20 focus:outline-none rounded px-2 py-1 w-full resize-y min-h-[36px]"
                                rows={1}
                              />
                            </td>
                            <td className="p-2.5 text-center pt-3">
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
      
    </>
  );
}
