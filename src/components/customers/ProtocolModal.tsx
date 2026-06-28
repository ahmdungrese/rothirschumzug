"use client";
import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '@/lib/firebase';
import { updateDoc, doc, arrayUnion, getDoc } from 'firebase/firestore';
import { XMarkIcon, PlusCircleIcon, ClipboardDocumentIcon, PencilIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { getCol } from '@/lib/demoMode';

export function ProtocolModal({ order, onClose }: { order: any, onClose: () => void }) {
  const [type, setType] = useState('Gefahrenübergang (Haftungsausschluss)');
  const [text, setText] = useState('');
  const sigPad = useRef<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  React.useEffect(() => {
    getDoc(doc(db, getCol('system'), 'settings')).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(data);
        if (data.protocolCategories && data.protocolCategories.length > 0) {
          const firstCat = data.protocolCategories[0];
          setType(firstCat.name);
          setText(firstCat.text);
        } else if (data.protocolTypes && data.protocolTypes.length > 0) {
          // Fallback for legacy
          setType(data.protocolTypes[0]);
          setText('');
        }
      }
    });
  }, []);

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (settings?.protocolCategories) {
      const cat = settings.protocolCategories.find((c: any) => c.name === newType);
      if (cat) {
        setText(cat.text);
      }
    }
  };

  const clear = () => sigPad.current?.clear();

  const save = async () => {
    if (sigPad.current?.isEmpty()) {
      toast.error("Bitte unterschreiben Sie das Protokoll.");
      return;
    }
    if (!text) {
      toast.error("Bitte geben Sie einen Text/Grund für das Protokoll ein.");
      return;
    }
    
    setIsSaving(true);
    try {
      const signatureDataUrl = sigPad.current?.getTrimmedCanvas().toDataURL('image/png');
      
      const newProtocol = {
        id: 'proto_' + Date.now(),
        type,
        text,
        signature: signatureDataUrl,
        createdAt: new Date().toISOString()
      };

      await updateDoc(doc(db, getCol('orders'), order.id), {
        protocols: arrayUnion(newProtocol)
      });
      
      toast.success("Protokoll erfolgreich gespeichert!");
      onClose();
    } catch (error) {
      console.error("Fehler", error);
      toast.error("Fehler beim Speichern des Protokolls.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-bg-panel border border-structure rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-structure flex justify-between items-center bg-bg-dark shrink-0">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <ClipboardDocumentIcon className="w-6 h-6" /> Neues Protokoll anlegen
          </h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main rounded-full transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Art des Protokolls</label>
              <select 
                value={type} 
                onChange={(e) => handleTypeChange(e.target.value)}
                className="input-field py-3 px-4 w-full bg-bg-dark text-text-main font-medium border-primary/30 focus:border-primary"
              >
                {settings?.protocolCategories ? (
                  settings.protocolCategories.map((cat: any) => <option key={cat.id} value={cat.name}>{cat.name}</option>)
                ) : settings?.protocolTypes ? (
                  settings.protocolTypes.map((pt: string) => <option key={pt} value={pt}>{pt}</option>)
                ) : (
                  <>
                    <option value="Gefahrenübergang (Haftungsausschluss)">Gefahrenübergang (Haftungsausschluss)</option>
                    <option value="Keine Schäden (Abschluss)">Keine Schäden (Abschluss-Protokoll)</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </>
                )}
              </select>
            </div>
            
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-medium text-text-muted">Beschreibung / Bemerkung</label>
              </div>
              <textarea 
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="input-field py-3 px-4 w-full h-32 bg-bg-dark"
                placeholder={type.includes('Gefahrenübergang') ? "z.B. Kundeneigener Kleiderschrank passt nicht durchs Treppenhaus. Transport auf eigene Gefahr des Kunden, keine Haftung für Kratzer." : "Hier Bemerkungen eintragen..."}
                required
              />
            </div>
          </div>
          
          <div className="bg-bg-dark p-4 rounded-xl border-2 border-primary/20">
            <h3 className="font-semibold text-text-main mb-2 flex items-center gap-2">
              <PencilIcon className="w-5 h-5" /> Unterschrift (Kunde)
            </h3>
            <p className="text-xs text-text-muted mb-4">
              Hiermit bestätige ich die Richtigkeit der obigen Angaben.
            </p>
            <div className="border-2 border-dashed border-structure rounded-xl bg-white overflow-hidden touch-none mb-4">
              <SignatureCanvas 
                ref={sigPad}
                penColor="black"
                canvasProps={{
                  className: 'w-full h-48 cursor-crosshair'
                }}
              />
            </div>
            <div className="flex justify-end">
              <button onClick={clear} className="text-text-muted hover:text-red-400 text-sm font-medium transition-colors">
                Unterschrift leeren
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-structure bg-bg-dark flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={save} disabled={isSaving} className="btn-primary">
            {isSaving ? 'Speichert...' : 'Protokoll & Unterschrift speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
