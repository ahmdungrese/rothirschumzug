"use client";
import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '@/lib/firebase';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { PencilIcon, CalendarIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SignatureModalProps {
  order: any;
  onClose: () => void;
  onSigned: (key: string, dataUrl: string, place: string, dateStr: string) => void;
  signatureKey?: string;
  title?: string;
  description?: string;
  buttonText?: string;
}

export function SignatureModal({ 
  order, 
  onClose,
  onSigned, 
  signatureKey = "signatureOrder",
  title = "Auftrag Unterschreiben",
  description = "Bitte unterschreiben Sie hier auf dem Display, um den Auftrag verbindlich zu bestätigen. Diese Unterschrift gilt für den Auftrag sowie die AGB.",
  buttonText = "Verbindlich unterschreiben"
}: SignatureModalProps) {
  const sigPad = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'pad' | 'upload'>('pad');
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string>(order?.orderMeta?.signedContractScan || '');
  const [uploadedFileName, setUploadedFileName] = useState<string>(order?.orderMeta?.signedContractScanName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [place, setPlace] = useState(order?.signatureOrderPlace || order?.logistics?.a_city || 'Bochum');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setDateStr(new Date().toLocaleDateString('de-DE'));
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const setToday = () => {
    setDateStr(new Date().toLocaleDateString('de-DE'));
  };

  const clear = () => {
    if (mode === 'pad') {
      sigPad.current?.clear();
    } else {
      setUploadedDataUrl('');
      setUploadedFileName('');
    }
  };

  // Compress image to keep Firestore document lightweight
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', 0.78);
          setUploadedDataUrl(compressed);
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setUploadedDataUrl(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const save = async () => {
    if (mode === 'pad' && sigPad.current?.isEmpty()) {
      toast.error("Bitte unterschreiben Sie zuerst oder wählen Sie 'Foto / Scan hochladen'.");
      return;
    }
    if (mode === 'upload' && !uploadedDataUrl) {
      toast.error("Bitte wählen Sie zuerst ein Foto oder Dokument des unterschriebenen Angebots aus.");
      return;
    }
    if (!place.trim()) {
      toast.error("Bitte geben Sie einen Ort ein.");
      return;
    }
    if (!dateStr.trim()) {
      toast.error("Bitte geben Sie ein Datum ein.");
      return;
    }
    
    setIsSaving(true);
    try {
      const signatureDataUrl = mode === 'pad'
        ? sigPad.current?.getTrimmedCanvas().toDataURL('image/png')
        : uploadedDataUrl;
      
      const updateData: any = {
        [signatureKey]: signatureDataUrl,
        [`${signatureKey}Date`]: serverTimestamp(),
        [`${signatureKey}Place`]: place.trim(),
        [`${signatureKey}DateString`]: dateStr.trim(),
      };

      if (mode === 'upload') {
        updateData['orderMeta.signedContractScan'] = uploadedDataUrl;
        updateData['orderMeta.signedContractScanName'] = uploadedFileName || 'Unterschriebenes_Angebot.jpg';
        updateData['orderMeta.signedContractScanDate'] = dateStr.trim();
        updateData['orderMeta.signatureMethod'] = 'scan_upload';
      } else {
        updateData['orderMeta.signatureMethod'] = 'digital_pad';
      }

      if (signatureKey === 'signatureOrder') {
        if (mode === 'pad') {
          updateData.signatureAGB = signatureDataUrl;
        }
        updateData.signatureAGBDate = serverTimestamp();
        updateData.signatureAGBPlace = place.trim();
        updateData.signatureAGBDateString = dateStr.trim();

        if (order.status !== 'completed' && !order.status?.startsWith('invoice_')) {
          updateData.status = 'confirmed';
        }
        updateData.contractSigned = true;
        updateData.isManuallySigned = true;
        updateData.signedAt = serverTimestamp();
        updateData['ticketStates.signature'] = true;
        updateData['checklistDone.signature'] = true;
      }
      
      await updateDoc(doc(db, 'orders', order.id), updateData);
      
      onSigned(signatureKey, signatureDataUrl, place.trim(), dateStr.trim());
      toast.success(mode === 'upload' ? "Unterschriebenes Angebot erfolgreich gespeichert!" : "Erfolgreich unterschrieben!");
      onClose();
    } catch (error) {
      console.error("Fehler beim Speichern der Unterschrift", error);
      toast.error("Fehler beim Speichern.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex-1 w-full max-w-4xl mx-auto p-4 flex flex-col justify-center">
        
        <div className="bg-bg-panel border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex justify-between items-center p-4 sm:p-6 border-b border-structure bg-bg-dark">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-text-main flex items-center gap-2">
                <PencilIcon className="w-6 h-6 text-primary" /> {title}
              </h2>
              {order.orderNumber && <p className="text-sm text-text-muted mt-1">Auftragsnummer: {order.orderNumber}</p>}
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 hover:bg-red-500 hover:text-white text-text-muted rounded-full transition-colors">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-slate-100 dark:bg-slate-800/80 border-b border-structure">
            <button
              type="button"
              onClick={() => setMode('pad')}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                mode === 'pad'
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white/60 dark:bg-slate-900/50 text-text-muted hover:text-text-main'
              }`}
            >
              <PencilIcon className="w-4 h-4" />
              <span>Digital auf Display unterschreiben</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('upload')}
              className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                mode === 'upload'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white/60 dark:bg-slate-900/50 text-text-muted hover:text-text-main'
              }`}
            >
              <span className="material-symbols-outlined text-base">add_a_photo</span>
              <span>Unterschriebenes Foto / Scan hochladen</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            <p className="text-sm text-text-muted mb-5 leading-relaxed">
              {mode === 'pad'
                ? description
                : 'Hat der Kunde das Angebot ausgedruckt, unterschrieben und per WhatsApp oder E-Mail als Foto/Scan geschickt? Laden Sie das Bild hier direkt hoch – der Auftrag wird automatisch bestätigt.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-black/10 dark:bg-black/20 p-3 rounded-xl border border-structure">
                <label className="text-xs text-text-muted mb-1 flex items-center gap-1 font-semibold"><MapPinIcon className="w-4 h-4"/> Ort</label>
                <input 
                  type="text" 
                  value={place} 
                  onChange={(e) => setPlace(e.target.value)} 
                  placeholder="z.B. Bochum" 
                  className="input-field w-full text-base py-2 bg-bg-dark"
                />
              </div>
              <div className="bg-black/10 dark:bg-black/20 p-3 rounded-xl border border-structure">
                <div className="flex justify-between items-end mb-1">
                  <label className="text-xs text-text-muted flex items-center gap-1 font-semibold"><CalendarIcon className="w-4 h-4"/> Datum</label>
                  <button onClick={setToday} className="text-xs text-primary hover:text-primary-hover font-bold transition-colors">Heute</button>
                </div>
                <input 
                  type="text" 
                  value={dateStr} 
                  onChange={(e) => setDateStr(e.target.value)} 
                  placeholder="TT.MM.JJJJ" 
                  className="input-field w-full text-base py-2 bg-bg-dark"
                />
              </div>
            </div>
            
            {mode === 'pad' ? (
              <div className="bg-white rounded-2xl overflow-hidden border-4 border-dashed border-primary/30 shadow-inner relative">
                <div className="absolute top-4 left-4 pointer-events-none opacity-20">
                  <PencilIcon className="w-16 h-16 text-black" />
                </div>
                <SignatureCanvas 
                  ref={sigPad}
                  penColor="black"
                  canvasProps={{
                    className: 'w-full h-[260px] sm:h-[340px] cursor-crosshair touch-none'
                  }}
                />
                <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none text-gray-400 text-xs font-semibold uppercase tracking-widest">
                  Bitte hier unterschreiben
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-emerald-500/50 bg-emerald-500/5 p-6 flex flex-col items-center justify-center text-center gap-4 min-h-[260px]">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {uploadedDataUrl ? (
                  <div className="space-y-3 w-full max-w-md">
                    {uploadedDataUrl.startsWith('data:image') ? (
                      <img
                        src={uploadedDataUrl}
                        alt="Unterschriebenes Angebot"
                        className="max-h-56 mx-auto rounded-xl border border-emerald-500/40 shadow-md object-contain bg-white"
                      />
                    ) : (
                      <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                        Dokument ausgewählt: {uploadedFileName || 'PDF-Dokument'}
                      </div>
                    )}
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      ✓ {uploadedFileName || 'Unterschriebener Nachweis bereit zum Speichern'}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold hover:brightness-95"
                    >
                      Anderes Foto / Datei wählen
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-3xl">upload_file</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-main">
                        Foto oder Scan vom unterschriebenen Angebot auswählen
                      </h4>
                      <p className="text-xs text-text-muted mt-1 max-w-md">
                        Unterstützt Fotos (WhatsApp, Kamera, Galerie) sowie gescannte Dokumente.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                    >
                      Foto / Datei jetzt auswählen
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t border-structure bg-bg-dark flex flex-col sm:flex-row justify-between items-center gap-4">
            <button onClick={clear} className="w-full sm:w-auto px-6 py-3 text-text-muted hover:text-red-400 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors">
              {mode === 'pad' ? 'Leeren / Neu beginnen' : 'Auswahl entfernen'}
            </button>
            <button onClick={save} disabled={isSaving} className="w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-lg shadow-xl shadow-primary/20 transition-colors flex justify-center items-center gap-2">
              {isSaving ? 'Speichert...' : mode === 'upload' ? 'Foto speichern & Auftrag bestätigen' : buttonText}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
