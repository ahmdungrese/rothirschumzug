import React from 'react';
import { useOrderEditor } from './OrderEditorContext';
import { QUICK_FURNITURE, QUICK_ROOMS } from './orderConstants';
import { InventoryWizardModal } from '../InventoryWizardModal';

export function Step4Inventory() {
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
      
    </>
  );
}
