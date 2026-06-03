"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { toast } from 'react-hot-toast';

export function QuickCreateCustomer({ onClose }: { onClose: () => void }) {
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastName || !address) return;

    setIsSubmitting(true);
    try {
      // Add a 5 second timeout to prevent infinite hanging if Firestore network drops
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Firestore timeout")), 5000)
      );

      const addPromise = addDoc(collection(db, "customers"), {
        lastName,
        firstName,
        billingAddress: {
          street: address,
          zip: "",
          city: ""
        },
        phone,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const docRef = await Promise.race([addPromise, timeoutPromise]) as any;
      
      if (!docRef || !docRef.id) throw new Error("Document creation failed");

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
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Nachname / Firmenname *</label>
          <input 
            type="text" 
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="input-field" 
            placeholder="Müller"
            required 
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Vorname (Optional)</label>
          <input 
            type="text" 
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="input-field" 
            placeholder="Max"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Adresse (Straße & Ort) *</label>
          <input 
            type="text" 
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input-field" 
            placeholder="Grillostr. 70, 44799 Bochum"
            required 
          />
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
