import React from 'react';
import { useOrderEditor } from './OrderEditorContext';
import { InventoryWizardModal } from '../InventoryWizardModal';
import { CreditCardIcon, DocumentTextIcon, ShoppingCartIcon, IdentificationIcon, FireIcon, PlusIcon, BoltIcon, BuildingOffice2Icon, HomeIcon, EyeIcon } from '@heroicons/react/24/outline';

export function Step5Summary() {
  const {
    customerData, setCustomerData, orderMeta, setOrderMeta, logistics, setLogistics,
    isFlatRate, setIsFlatRate, flatRateNet, setFlatRateNet, services, setServices,
    catalogSearch, setCatalogSearch, activeCategoryTab, setActiveCategoryTab, calcInput, setCalcInput,
    inventory, setInventory, appendInventoryToPDF, setAppendInventoryToPDF, isInventoryWizardOpen, setIsInventoryWizardOpen,
    totals, saveOrder, calculateRoute, updateFurnitureCount, addService, removeService, customerName, date, errorMessage, activeOrder, urlCustomerId,
    toggleStandardService, isStandardServiceSelected, updateServiceQuantity, updateServicePrice, updateServiceNote,
    generatePDF, isSaving, canEditPrices, canViewPrices
  } = useOrderEditor();

  return (
    <>
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
    </>
  );
}
