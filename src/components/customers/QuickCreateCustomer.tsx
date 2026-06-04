"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { toast } from 'react-hot-toast';
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { getCol } from '@/lib/demoMode';

export function QuickCreateCustomer({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<"privat" | "firma">("privat");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [street, setStreet] = useState("");
  const [houseNr, setHouseNr] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { profile } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastName) return;

    setIsSubmitting(true);
    try {
      // Add a 5 second timeout to prevent infinite hanging if Firestore network drops
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Firestore timeout")), 5000)
      );

      const addPromise = addDoc(collection(db, getCol('customers')), {
        type,
        lastName,
        firstName,
        street,
        houseNr,
        zip,
        city,
        phone,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: profile?.displayName || profile?.email || 'Unbekannt',
      });

      const docRef = await Promise.race([addPromise, timeoutPromise]) as any;
      
      if (!docRef || !docRef.id) throw new Error("Document creation failed");

      // Log activity
      await logActivity(
        profile?.uid || 'unknown',
        profile?.displayName || profile?.email || 'Unbekannt',
        'CREATE_CUSTOMER',
        `Kunde ${firstName} ${lastName} angelegt`
      );

      router.push(`/dashboard/customers/${docRef.id}`);
      onClose();
      toast.success("Kunde erfolgreich erstellt!");
    } catch (error: any) {
      console.error("Error adding document: ", error);
      toast.error(error.message === "Firestore timeout" 
        ? "Die Datenbank antwortet nicht. Bitte prüfen Sie Ihre Internetverbindung oder Firebase-Config."
        : "Fehler beim Erstellen des Kunden.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-primary/10 border border-primary/20 text-primary p-4 rounded-lg text-sm">
        <strong>Minimal Typing:</strong> Geben Sie hier auf die Schnelle nur das Nötigste ein. Weitere Details können Sie später im Kundenprofil ergänzen.
      </div>
      
      <div className="space-y-4">
        
        <div className="flex gap-4 p-2 bg-bg-dark rounded-lg border border-structure">
          <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
            <input type="radio" checked={type === 'privat'} onChange={() => setType('privat')} className="accent-primary" /> 
            Privatperson
          </label>
          <label className="flex items-center gap-2 text-white text-sm cursor-pointer">
            <input type="radio" checked={type === 'firma'} onChange={() => setType('firma')} className="accent-primary" /> 
            Firma
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">{type === 'firma' ? 'Firmenname' : 'Nachname'} *</label>
          <input 
            type="text" 
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="input-field" 
            placeholder={type === 'firma' ? 'Muster GmbH' : 'Müller'}
            required 
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">{type === 'firma' ? 'Ansprechpartner (Vorname)' : 'Vorname'} (Optional)</label>
          <input 
            type="text" 
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="input-field" 
            placeholder="Max"
          />
        </div>
        
        <div className="flex gap-3">
          <div className="flex-[3]">
            <label className="block text-sm font-medium text-text-muted mb-1">Straße</label>
            <input 
              type="text" 
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="input-field" 
              placeholder="Musterstr."
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-muted mb-1">Nr.</label>
            <input 
              type="text" 
              value={houseNr}
              onChange={(e) => setHouseNr(e.target.value)}
              className="input-field" 
              placeholder="12a"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-muted mb-1">PLZ</label>
            <input 
              type="text" 
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="input-field" 
              placeholder="44787"
            />
          </div>
          <div className="flex-[2]">
            <label className="block text-sm font-medium text-text-muted mb-1">Ort</label>
            <input 
              type="text" 
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="input-field" 
              placeholder="Bochum"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Telefon (Optional, für WhatsApp)</label>
          <input 
            type="text" 
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-field" 
            placeholder="+49 177 4652154"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">E-Mail (Optional)</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field" 
            placeholder="kunde@beispiel.de"
          />
        </div>
      </div>

      <div className="pt-4 flex gap-3">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">
          Abbrechen
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
          {isSubmitting ? 'Speichert...' : 'Erstellen & Akte öffnen'}
        </button>
      </div>
    </form>
  );
}
