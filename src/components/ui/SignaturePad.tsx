"use client";
import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '@/lib/firebase';
import { updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { PencilIcon } from '@heroicons/react/24/outline';
import { getCol } from '@/lib/demoMode';

export function SignaturePad({ orderId, onSigned }: { orderId: string, onSigned: () => void }) {
  const sigPad = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const clear = () => {
    sigPad.current?.clear();
  };

  const save = async () => {
    if (sigPad.current?.isEmpty()) {
      toast.error("Bitte unterschreiben Sie zuerst.");
      return;
    }
    
    setIsSaving(true);
    try {
      const signatureDataUrl = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');
      
      await updateDoc(doc(db, getCol('orders'), orderId), {
        customerSignature: signatureDataUrl,
        signatureDate: serverTimestamp(),
      });
      
      onSigned();
    } catch (error) {
      console.error("Fehler beim Speichern der Unterschrift", error);
      toast.error("Fehler beim Speichern.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="panel border-2 border-primary/20 bg-bg-dark mt-6">
      <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
        <PencilIcon className="w-5 h-5" /> Digitale Unterschrift (Kunde)
      </h3>
      <p className="text-xs text-text-muted mb-4">
        Unterschreiben Sie hier auf dem Tablet oder Smartphone, um den Auftrag (oder das "Keine Schäden"-Protokoll nach dem Umzug) zu bestätigen.
      </p>
      
      <div className="border-2 border-dashed border-structure rounded-xl bg-white overflow-hidden touch-none mb-4">
        <SignatureCanvas 
          ref={sigPad}
          penColor="black"
          canvasProps={{
            className: 'w-full h-48 sm:h-64 cursor-crosshair'
          }}
        />
      </div>

      <div className="flex justify-between items-center">
        <button onClick={clear} className="text-text-muted hover:text-red-400 text-sm font-medium transition-colors">
          Leeren / Neu
        </button>
        <button onClick={save} disabled={isSaving} className="btn-primary">
          {isSaving ? 'Speichert...' : 'Verbindlich unterschreiben'}
        </button>
      </div>
    </div>
  );
}
