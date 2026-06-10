"use client";
import React, { useState } from 'react';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { getCol } from '@/lib/demoMode';

export function ClaimModal({ 
  customerId, 
  customerName, 
  orderId, 
  onClose 
}: { 
  customerId: string;
  customerName: string;
  orderId?: string;
  onClose: () => void;
}) {
  const [description, setDescription] = useState('');
  const [insuranceId, setInsuranceId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    if (!description.trim()) {
      toast.error("Bitte eine Beschreibung des Schadens / Problems eingeben.");
      return;
    }
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, getCol('claims')), {
        customerId,
        customerName,
        orderId: orderId || null,
        description,
        insuranceId: insuranceId || null,
        status: 'Neu',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        photos: [] // Placeholder für zukünftige Foto-Uploads
      });
      
      toast.success("Schaden / Problem erfolgreich gemeldet!");
      onClose();
    } catch (error) {
      console.error("Fehler", error);
      toast.error("Fehler beim Speichern der Meldung.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-bg-panel border border-structure rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
        <div className="p-4 border-b border-structure flex justify-between items-center bg-red-900/20 shrink-0">
          <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-6 h-6" /> Schaden / Problem erfassen
          </h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main rounded-full transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <p className="text-sm text-text-muted">
            Lege hier ein neues Ticket für einen Schaden oder ein Problem (z.B. Kratzer, Reklamation) an. Es wird in deiner zentralen Reklamations-Übersicht verfolgt.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Beschreibung des Schadens</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field py-3 px-4 w-full h-32 bg-bg-dark border-red-500/30 focus:border-red-500"
                placeholder="Was ist passiert? (z.B. Kratzer am Kühlschrank beim Verladen)"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Versicherungs-Schadensnummer (Optional)</label>
              <input 
                type="text"
                value={insuranceId}
                onChange={(e) => setInsuranceId(e.target.value)}
                className="input-field py-3 px-4 w-full bg-bg-dark"
                placeholder="z.B. V-123456789"
              />
              <p className="text-xs text-text-muted mt-1">Kann später nachgetragen werden, sobald die Versicherung kontaktiert wurde.</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-structure bg-bg-dark flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={save} disabled={isSaving} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-semibold shadow-lg transition-colors flex items-center gap-2">
            {isSaving ? 'Speichert...' : 'Schaden melden'}
          </button>
        </div>
      </div>
    </div>
  );
}
