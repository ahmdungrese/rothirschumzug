"use client";
import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '@/lib/firebase';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { PencilIcon, CalendarIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { getCol } from '@/lib/demoMode';

interface SignaturePadProps {
  orderId: string;
  onSigned: (key: string, dataUrl: string, place: string, dateStr: string) => void;
  signatureKey?: string;
  title?: string;
  description?: string;
  buttonText?: string;
}

export function SignaturePad({ 
  orderId, 
  onSigned, 
  signatureKey = "customerSignature",
  title = "Digitale Unterschrift (Kunde)",
  description = "Unterschreiben Sie hier auf dem Tablet oder Smartphone, um den Auftrag zu bestätigen.",
  buttonText = "Verbindlich unterschreiben"
}: SignaturePadProps) {
  const sigPad = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [place, setPlace] = useState('');
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    // Set today's date automatically on mount
    setDateStr(new Date().toLocaleDateString('de-DE'));
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
      
      await updateDoc(doc(db, getCol('orders'), orderId), {
        [signatureKey]: signatureDataUrl,
        [`${signatureKey}Date`]: serverTimestamp(),
        [`${signatureKey}Place`]: place.trim(),
        [`${signatureKey}DateString`]: dateStr.trim()
      });
      
      onSigned(signatureKey, signatureDataUrl, place.trim(), dateStr.trim());
    } catch (error) {
      console.error("Fehler beim Speichern der Unterschrift", error);
      toast.error("Fehler beim Speichern.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="panel border-2 border-primary/20 bg-bg-dark mt-6 shadow-sm">
      <h3 className="font-semibold text-text-main mb-2 flex items-center gap-2">
        <PencilIcon className="w-5 h-5" /> {title}
      </h3>
      <p className="text-xs text-text-muted mb-4">
        {description}
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs text-text-muted mb-1 flex items-center gap-1"><MapPinIcon className="w-3 h-3"/> Ort</label>
          <input 
            type="text" 
            value={place} 
            onChange={(e) => setPlace(e.target.value)} 
            placeholder="z.B. Bochum" 
            className="input-field w-full text-sm py-1.5"
          />
        </div>
        <div>
          <div className="flex justify-between items-end mb-1">
            <label className="text-xs text-text-muted flex items-center gap-1"><CalendarIcon className="w-3 h-3"/> Datum</label>
            <button onClick={setToday} className="text-[10px] text-primary hover:text-text-main transition-colors">Heute</button>
          </div>
          <input 
            type="text" 
            value={dateStr} 
            onChange={(e) => setDateStr(e.target.value)} 
            placeholder="TT.MM.JJJJ" 
            className="input-field w-full text-sm py-1.5"
          />
        </div>
      </div>
      
      <div className="border-2 border-dashed border-structure rounded-xl bg-white overflow-hidden touch-none mb-4">
        <SignatureCanvas 
          ref={sigPad}
          penColor="black"
          canvasProps={{
            className: 'w-full h-48 sm:h-40 cursor-crosshair'
          }}
        />
      </div>

      <div className="flex justify-between items-center">
        <button onClick={clear} className="text-text-muted hover:text-red-400 text-sm font-medium transition-colors">
          Leeren / Neu
        </button>
        <button onClick={save} disabled={isSaving} className="btn-primary shadow-lg shadow-primary/20 py-1.5 px-4 text-sm">
          {isSaving ? 'Speichert...' : buttonText}
        </button>
      </div>
    </div>
  );
}
