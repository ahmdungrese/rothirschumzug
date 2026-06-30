"use client";
import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '@/lib/firebase';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { PencilIcon, CalendarIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getCol } from '@/lib/demoMode';

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
  const [isSaving, setIsSaving] = useState(false);
  const [place, setPlace] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    // Set today's date automatically on mount
    setDateStr(new Date().toLocaleDateString('de-DE'));
    
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  const setToday = () => {
    setDateStr(new Date().toLocaleDateString('de-DE'));
  };

  const clear = () => {
    sigPad.current?.clear();
  };

  const save = async () => {
    if (sigPad.current?.isEmpty()) {
      toast.error("Bitte unterschreiben Sie zuerst.");
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
      const signatureDataUrl = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');
      
      // Save signature for both Order and AGB to avoid double signing
      const updateData: any = {
        [signatureKey]: signatureDataUrl,
        [`${signatureKey}Date`]: serverTimestamp(),
        [`${signatureKey}Place`]: place.trim(),
        [`${signatureKey}DateString`]: dateStr.trim(),
      };

      // Automatically sign AGB as well if this is the main order signature
      if (signatureKey === 'signatureOrder') {
        updateData.signatureAGB = signatureDataUrl;
        updateData.signatureAGBDate = serverTimestamp();
        updateData.signatureAGBPlace = place.trim();
        updateData.signatureAGBDateString = dateStr.trim();
      }
      
      await updateDoc(doc(db, getCol('orders'), order.id), updateData);
      
      onSigned(signatureKey, signatureDataUrl, place.trim(), dateStr.trim());
      toast.success("Erfolgreich unterschrieben!");
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

          {/* Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            <p className="text-sm text-text-muted mb-6 leading-relaxed">
              {description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                <label className="text-xs text-text-muted mb-1 flex items-center gap-1 font-semibold"><MapPinIcon className="w-4 h-4"/> Ort</label>
                <input 
                  type="text" 
                  value={place} 
                  onChange={(e) => setPlace(e.target.value)} 
                  placeholder="z.B. Bochum" 
                  className="input-field w-full text-base py-2 bg-bg-dark"
                />
              </div>
              <div className="bg-black/20 p-3 rounded-xl border border-white/5">
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
            
            {/* Signature Area */}
            <div className="bg-white rounded-2xl overflow-hidden border-4 border-dashed border-primary/30 shadow-inner relative">
              <div className="absolute top-4 left-4 pointer-events-none opacity-20">
                <PencilIcon className="w-16 h-16 text-black" />
              </div>
              <SignatureCanvas 
                ref={sigPad}
                penColor="black"
                canvasProps={{
                  className: 'w-full h-[300px] sm:h-[400px] cursor-crosshair touch-none'
                }}
              />
              <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none text-gray-300 text-xs font-semibold uppercase tracking-widest">
                Bitte hier unterschreiben
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t border-structure bg-bg-dark flex flex-col sm:flex-row justify-between items-center gap-4">
            <button onClick={clear} className="w-full sm:w-auto px-6 py-3 text-text-muted hover:text-red-400 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-colors">
              Leeren / Neu beginnen
            </button>
            <button onClick={save} disabled={isSaving} className="w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-lg shadow-xl shadow-primary/20 transition-colors flex justify-center items-center gap-2">
              {isSaving ? 'Speichert...' : buttonText}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
