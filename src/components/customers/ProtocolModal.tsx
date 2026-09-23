"use client";
import React, { useRef, useState, useEffect, useMemo } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '@/lib/firebase';
import { updateDoc, doc, arrayUnion, getDoc, serverTimestamp } from 'firebase/firestore';
import { 
  XMarkIcon, 
  ClipboardDocumentCheckIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckCircleIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  DocumentTextIcon,
  PlusIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface ProtocolModalProps {
  order: any;
  onClose: () => void;
  onSuccess?: () => void;
  onViewPdf?: (order: any, type: string) => void;
}

const PRESET_CATEGORIES = [
  {
    id: 'abnahme',
    name: 'Abnahme ohne Mängel (Standard)',
    icon: ShieldCheckIcon,
    color: 'emerald',
    defaultText: 'Der Umzug wurde ordnungsgemäß, vollständig und ohne Mängel oder Schäden durchgeführt. Alle Umzugsgüter wurden unversehrt am Bestimmungsort übergeben.',
    isCompletion: true,
  },
  {
    id: 'haftung',
    name: 'Gefahrenübergang / Haftungsausschluss',
    icon: ExclamationTriangleIcon,
    color: 'amber',
    defaultText: 'Gefahrenübergang: Der Transport erfolgt auf ausdrücklichen Wunsch und auf eigene Gefahr des Kunden (z.B. Engstelle im Treppenhaus / ungeeignete Maße / Demontage durch Kunden). Keine Haftung für Beschädigungen an Umzugsgut oder Gebäude.',
    isCompletion: false,
  },
  {
    id: 'schaden',
    name: 'Mängel- & Schadensfeststellung',
    icon: ExclamationTriangleIcon,
    color: 'red',
    defaultText: 'Folgende vorbestehende oder entstandene Mängel bzw. Schäden wurden vor Ort dokumentiert und vom Kunden bestätigt:\n- ',
    isCompletion: false,
  },
  {
    id: 'zaehler',
    name: 'Zählerstände & Schlüsselübergabe',
    icon: KeyIcon,
    color: 'blue',
    defaultText: 'Dokumentation der Zählerstände und Schlüssel:\nStrom: \nGas: \nWasser: \nSchlüssel übergeben: Ja',
    isCompletion: false,
  },
  {
    id: 'sonstiges',
    name: 'Sonstige Vereinbarung',
    icon: DocumentTextIcon,
    color: 'slate',
    defaultText: '',
    isCompletion: false,
  },
];

const PRESET_SNIPPETS = [
  { label: 'Treppenhaus Engstelle (auf Kundenrisiko)', text: 'Transport durch enges Treppenhaus auf ausdrücklichen Wunsch des Kunden. Keine Haftung für Kratzer.' },
  { label: 'Vorbestehende Kratzer dokumentiert', text: 'Vorbestehende Beschädigungen (Kratzer/Gebrauchsspuren) bereits vor Verladung am Umzugsgut vorhanden.' },
  { label: 'Eigenmontage durch Kunden', text: 'Möbelmontage / Demontage erfolgt eigenständig durch den Kunden. Keine Haftung für Stabilität oder Folgeschäden.' },
  { label: 'Wohnungsabnahme mängelfrei', text: 'Die Räumlichkeiten der Auszugsadresse wurden besenrein und ohne Schäden an Wänden/Böden übergeben.' },
];

export function ProtocolModal({ order, onClose, onSuccess, onViewPdf }: ProtocolModalProps) {
  const existingProtocols = order?.protocols || [];
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [type, setType] = useState('Abnahme ohne Mängel (Standard)');
  const [text, setText] = useState(PRESET_CATEGORIES[0].defaultText);
  const [markAsCompleted, setMarkAsCompleted] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const sigPad = useRef<any>(null);

  useEffect(() => {
    getDoc(doc(db, 'system', 'settings')).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(data);
        if (data.protocolCategories && data.protocolCategories.length > 0) {
          const firstCat = data.protocolCategories[0];
          setType(firstCat.name);
          if (firstCat.text) setText(firstCat.text);
          setMarkAsCompleted(firstCat.name.toLowerCase().includes('abschluss') || firstCat.name.toLowerCase().includes('ohne mängel'));
        }
      }
    });
  }, []);

  const availableCategories = useMemo(() => {
    if (settings?.protocolCategories && settings.protocolCategories.length > 0) {
      return settings.protocolCategories.map((c: any, idx: number) => {
        const lower = c.name?.toLowerCase() || '';
        let icon = DocumentTextIcon;
        let isCompletion = false;
        let subtitle = 'Individuelle Vereinbarung';

        if (lower.includes('abschluss') || lower.includes('keine schäden') || lower.includes('ohne mängel')) {
          icon = ShieldCheckIcon;
          isCompletion = true;
          subtitle = 'Vollständig & mängelfrei (Phase 4)';
        } else if (lower.includes('gefahr') || lower.includes('haftung')) {
          icon = ExclamationTriangleIcon;
          isCompletion = false;
          subtitle = 'Treppenhaus / Kundenrisiko';
        } else if (lower.includes('schaden') || lower.includes('mängel')) {
          icon = ExclamationTriangleIcon;
          isCompletion = false;
          subtitle = 'Schäden vor Ort dokumentieren';
        } else if (lower.includes('zähler') || lower.includes('schlüssel')) {
          icon = KeyIcon;
          isCompletion = false;
          subtitle = 'Strom, Wasser, Gas & Schlüssel';
        }

        return {
          id: c.id || `cat_${idx}`,
          name: c.name,
          icon,
          defaultText: c.text || '',
          subtitle,
          isCompletion,
        };
      });
    }
    return PRESET_CATEGORIES;
  }, [settings]);

  const allSnippets = useMemo(() => {
    const list = [...PRESET_SNIPPETS];
    if (settings?.protocolTemplates && Array.isArray(settings.protocolTemplates)) {
      settings.protocolTemplates.forEach((t: string) => {
        if (t && !list.some(s => s.text === t)) {
          list.push({
            label: t.length > 35 ? t.slice(0, 32) + '...' : t,
            text: t
          });
        }
      });
    }
    return list;
  }, [settings]);

  const handleSelectPreset = (cat: any) => {
    setType(cat.name);
    setText(cat.defaultText);
    setMarkAsCompleted(cat.isCompletion);
  };

  const handleCustomTypeChange = (newType: string) => {
    setType(newType);
    const isAbschluss = newType.toLowerCase().includes('abschluss') || newType.toLowerCase().includes('ohne mängel');
    setMarkAsCompleted(isAbschluss);
    if (settings?.protocolCategories) {
      const cat = settings.protocolCategories.find((c: any) => c.name === newType);
      if (cat && cat.text) {
        setText(cat.text);
      }
    }
  };

  const appendSnippet = (snippetText: string) => {
    setText((prev) => (prev ? `${prev}\n- ${snippetText}` : snippetText));
  };

  const clearSignature = () => {
    sigPad.current?.clear();
  };

  const saveProtocol = async () => {
    if (sigPad.current?.isEmpty()) {
      toast.error('Bitte unterschreiben Sie das Protokoll digital.');
      return;
    }
    if (!text.trim()) {
      toast.error('Bitte geben Sie einen Text oder eine Beschreibung für das Protokoll ein.');
      return;
    }

    setIsSaving(true);
    try {
      const signatureDataUrl = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');

      const newProtocol = {
        id: 'proto_' + Date.now(),
        type,
        text: text.trim(),
        signature: signatureDataUrl,
        createdAt: new Date().toISOString(),
      };

      const updates: Record<string, any> = {
        protocols: arrayUnion(newProtocol),
        'ticketStates.abnahmeprotokoll': true,
        updatedAt: serverTimestamp(),
      };

      if (markAsCompleted) {
        updates['status'] = 'completed';
        updates['completedAt'] = new Date().toISOString();
        updates['ticketStates.transition_complete'] = true;
      }

      await updateDoc(doc(db, 'orders', order.id), updates);

      toast.success(
        markAsCompleted
          ? 'Protokoll gespeichert & Umzug als abgeschlossen markiert!'
          : 'Protokoll erfolgreich gespeichert!'
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error('Fehler beim Speichern des Protokolls:', error);
      toast.error('Fehler beim Speichern des Protokolls.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProtocol = async (protoId: string) => {
    if (!confirm('Möchten Sie dieses Protokoll wirklich unwiderruflich löschen?')) return;
    setIsDeleting(protoId);
    try {
      const updatedProtocols = existingProtocols.filter((p: any) => p.id !== protoId);
      await updateDoc(doc(db, 'orders', order.id), {
        protocols: updatedProtocols,
        'ticketStates.abnahmeprotokoll': updatedProtocols.length > 0,
        updatedAt: serverTimestamp(),
      });
      toast.success('Protokoll erfolgreich gelöscht.');
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      toast.error('Fehler beim Löschen des Protokolls.');
    } finally {
      setIsDeleting(null);
    }
  };

  const formatTimestamp = (val: any) => {
    if (!val) return 'Gerade eben';
    try {
      return new Date(val).toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(val);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
              <ClipboardDocumentCheckIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <span>Übergabeprotokoll & Abnahme</span>
                {existingProtocols.length > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
                    {existingProtocols.length} {existingProtocols.length === 1 ? 'Eintrag' : 'Einträge'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Auftrag #{order?.orderNumber || order?.id?.slice(-5).toUpperCase()} &bull; Digitale Erfassung mit Unterschrift
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher if previous protocols exist */}
        {existingProtocols.length > 0 && (
          <div className="px-6 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'create'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Neues Protokoll anlegen</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'list'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <CheckCircleIcon className="w-3.5 h-3.5" />
                <span>Bisherige Protokolle ({existingProtocols.length})</span>
              </button>
            </div>

            {onViewPdf && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onViewPdf(order, 'protocol');
                }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                title="Aktuelles Protokoll als PDF öffnen"
              >
                <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                <span>PDF ansehen</span>
              </button>
            )}
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'list' ? (
            /* Tab: Previous Protocols List */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                  Bereits unterzeichnete Protokolle
                </span>
                <span className="text-xs text-slate-400">
                  {existingProtocols.length} Dokumentiert
                </span>
              </div>

              <div className="space-y-3">
                {existingProtocols.map((proto: any, idx: number) => (
                  <div
                    key={proto.id || idx}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {proto.type || 'Protokoll'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                            {formatTimestamp(proto.createdAt)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteProtocol(proto.id || '')}
                        disabled={isDeleting === proto.id}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        title="Protokoll löschen"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                      {proto.text || 'Keine Beschreibung angegeben.'}
                    </p>

                    {proto.signature && (
                      <div className="flex items-center gap-3 pt-1">
                        <div className="bg-white p-2 rounded-xl border border-slate-200 dark:border-slate-700 w-36 h-16 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={proto.signature}
                            alt="Kundenunterschrift"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-600 dark:text-slate-300 block">
                            Digital signiert vom Auftraggeber
                          </span>
                          <span>Am: {formatTimestamp(proto.createdAt)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Weiteres Protokoll erfassen</span>
                </button>
              </div>
            </div>
          ) : (
            /* Tab: Create Protocol */
            <div className="space-y-5">
              {/* Category Presets Pills */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                    Art des Protokolls & Textvorlage
                  </label>
                  <span className="text-[10px] text-slate-400">
                    Klick wählt den Typ & füllt den Standardtext
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableCategories.map((cat: any) => {
                    const isSelected = type === cat.name;
                    const IconComponent = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleSelectPreset(cat)}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-start gap-2.5 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500/50 text-blue-900 dark:text-blue-100 shadow-xs ring-1 ring-blue-500/30'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold block leading-tight truncate">
                            {cat.name}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5 line-clamp-1">
                            {cat.subtitle || 'Standard-Vorlage'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description & Clauses */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-headline">
                    Protokolltext & Bemerkungen
                  </label>
                  <span className="text-[11px] text-slate-400">
                    {text.length} Zeichen
                  </span>
                </div>

                <textarea
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 leading-relaxed font-sans"
                  placeholder="Beschreiben Sie hier die Abnahme, etwaige Mängel oder den Haftungsausschluss..."
                  required
                />

                {/* Quick Snippet Insert Pills */}
                <div className="mt-2 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Häufige Textbausteine anfügen:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {allSnippets.map((snip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => appendSnippet(snip.text)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                        title={snip.text}
                      >
                        + {snip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Completion Toggle */}
              <label className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 cursor-pointer select-none hover:border-blue-500/40 transition-colors">
                <input
                  type="checkbox"
                  checked={markAsCompleted}
                  onChange={(e) => setMarkAsCompleted(e.target.checked)}
                  className="w-5 h-5 rounded-md text-blue-600 focus:ring-blue-500 accent-blue-600 cursor-pointer shrink-0 mt-0.5"
                />
                <div>
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white block">
                    Umzug als erfolgreich durchgeführt abschließen (Phase 4)
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                    Versetzt den Auftrag in Phase 4 und schaltet die finale Rechnungserstellung sowie Bewertungsanfragen frei.
                  </span>
                </div>
              </label>

              {/* Digital Signature Canvas */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PencilIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-headline">
                      Kundenunterschrift digital
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="text-slate-400 hover:text-red-500 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    <span>Leeren</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400">
                  Der Auftraggeber bestätigt mit seiner Unterschrift auf dem Display die Richtigkeit der obigen Angaben.
                </p>

                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl bg-white overflow-hidden touch-none relative shadow-inner">
                  <SignatureCanvas
                    ref={sigPad}
                    penColor="black"
                    canvasProps={{
                      className: 'w-full h-44 cursor-crosshair',
                    }}
                  />
                  <div className="pointer-events-none absolute bottom-3 left-4 text-[10px] text-slate-300 uppercase tracking-widest font-mono select-none">
                    Unterschrift des Auftraggebers _________________________
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            {existingProtocols.length > 0 && activeTab === 'create' && (
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
              >
                <span>Bisherige Protokolle ansehen ({existingProtocols.length})</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-center"
            >
              Abbrechen
            </button>

            {activeTab === 'create' ? (
              <button
                type="button"
                onClick={saveProtocol}
                disabled={isSaving}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Speichert...</span>
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Protokoll speichern & signieren</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Neues Protokoll anlegen</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
