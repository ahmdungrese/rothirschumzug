"use client";
import { useState } from "react";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { toast } from 'react-hot-toast';
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activityLogger";
import { useModalBackHandler } from "@/hooks/useModalBackHandler";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { sanitizeText, sanitizePhoneNumber, validateCustomerEmail, validateCustomerPhone, ARABIC_CHARS_REGEX } from "@/lib/inputValidation";

export function QuickCreateCustomer({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<"privat" | "firma">("privat");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [salutation, setSalutation] = useState("");
  const [street, setStreet] = useState("");
  const [houseNr, setHouseNr] = useState("");
  const [zip, setZip] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [emailError, setEmailError] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);
  const { profile } = useAuth();

  const handleSafeClose = () => {
    const hasData = Boolean(lastName.trim() || firstName.trim() || phone.trim() || email.trim() || street.trim());
    if (hasData) {
      setShowConfirmCancel(true);
    } else {
      onClose();
    }
  };

  useModalBackHandler(true, handleSafeClose, 'quick-create-customer');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lastName) return;

    const emailErr = validateCustomerEmail(email);
    const phoneErr = validateCustomerPhone(phone);
    if (emailErr || phoneErr) {
      setEmailError(emailErr || '');
      setPhoneError(phoneErr || '');
      toast.error(emailErr || phoneErr || 'Bitte korrigieren Sie die markierten Felder.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Add a 5 second timeout to prevent infinite hanging if Firestore network drops
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Firestore timeout")), 5000)
      );

      const addPromise = addDoc(collection(db, 'customers'), {
        type,
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        salutation,
        street: street.trim(),
        houseNr,
        zip,
        city,
        phone,
        email,
        source: source.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: profile?.displayName || profile?.email?.split('@')[0] || 'Team',
      });

      const docRef = await Promise.race([addPromise, timeoutPromise]) as any;
      
      if (!docRef || !docRef.id) throw new Error("Document creation failed");

      // Log activity
      const creatorName = profile?.displayName || profile?.email?.split('@')[0] || 'Team';
      await logActivity(
        profile?.uid || 'unknown',
        creatorName,
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
          <label className="flex items-center gap-2 text-text-main text-sm cursor-pointer">
            <input type="radio" checked={type === 'privat'} onChange={() => setType('privat')} className="accent-primary" /> 
            Privatperson
          </label>
          <label className="flex items-center gap-2 text-text-main text-sm cursor-pointer">
            <input type="radio" checked={type === 'firma'} onChange={() => setType('firma')} className="accent-primary" /> 
            Firma
          </label>
        </div>

        <div className="flex gap-3">
          <div className="w-1/3">
            <label className="block text-sm font-medium text-text-muted mb-1">Anrede</label>
            <select 
              value={salutation} 
              onChange={(e) => setSalutation(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Keine</option>
              <option value="Herr">Herr</option>
              <option value="Frau">Frau</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-muted mb-1">{type === 'firma' ? 'Firmenname' : 'Nachname'} *</label>
            <input 
              type="text" 
              maxLength={80}
              value={lastName}
              onChange={(e) => setLastName(sanitizeText(e.target.value, 80))}
              className="input-field w-full" 
              placeholder={type === 'firma' ? 'Muster GmbH' : 'Müller'}
              required 
              autoFocus
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">{type === 'firma' ? 'Ansprechpartner (Vorname)' : 'Vorname'} (Optional)</label>
          <input 
            type="text" 
            maxLength={50}
            value={firstName}
            onChange={(e) => setFirstName(sanitizeText(e.target.value, 50))}
            className="input-field" 
            placeholder="Max"
          />
        </div>
        
        <div className="flex gap-3">
          <div className="flex-[3]">
            <label className="block text-sm font-medium text-text-muted mb-1">Straße</label>
            <input 
              type="text" 
              maxLength={80}
              value={street}
              onChange={(e) => setStreet(sanitizeText(e.target.value, 80))}
              className="input-field" 
              placeholder="Musterstr."
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-text-muted mb-1">Nr.</label>
            <input 
              type="text" 
              maxLength={15}
              value={houseNr}
              onChange={(e) => setHouseNr(sanitizeText(e.target.value, 15))}
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
              maxLength={10}
              value={zip}
              onChange={(e) => setZip(sanitizeText(e.target.value, 10).replace(/[^0-9a-zA-Z]/g, ''))}
              className="input-field" 
              placeholder="44787"
            />
          </div>
          <div className="flex-[2]">
            <label className="block text-sm font-medium text-text-muted mb-1">Ort</label>
            <input 
              type="text" 
              maxLength={60}
              value={city}
              onChange={(e) => setCity(sanitizeText(e.target.value, 60))}
              className="input-field" 
              placeholder="Bochum"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Quelle (Woher kommt der Kunde?)</label>
          <input 
            type="text" 
            maxLength={40}
            list="sources"
            value={source}
            onChange={(e) => setSource(sanitizeText(e.target.value, 40))}
            className="input-field w-full" 
            placeholder="z.B. Google, Check24, Empfehlung..."
          />
          <datalist id="sources">
            <option value="Google" />
            <option value="Check24" />
            <option value="MyHammer" />
            <option value="Empfehlung" />
            <option value="Kleinanzeigen" />
            <option value="Stammkunde" />
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Telefon (Optional, für WhatsApp)</label>
          <input 
            type="text" 
            maxLength={30}
            value={phone}
            onChange={(e) => {
              const cleaned = sanitizePhoneNumber(e.target.value, 30);
              setPhone(cleaned);
              if (phoneError) setPhoneError(validateCustomerPhone(cleaned) || '');
            }}
            onBlur={() => setPhoneError(validateCustomerPhone(phone) || '')}
            className={`input-field transition-all duration-200 ${
              phoneError ? 'border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-500/5 text-red-100' : ''
            }`}
            placeholder="+49 177 4652154"
          />
          {phoneError && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-400 font-medium animate-in fade-in duration-200">
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0 text-red-400" />
              <span>{phoneError}</span>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">E-Mail (Optional)</label>
          <input 
            type="email" 
            maxLength={80}
            value={email}
            onChange={(e) => {
              const cleaned = sanitizeText(e.target.value, 80).trim();
              setEmail(cleaned);
              if (emailError || ARABIC_CHARS_REGEX.test(e.target.value)) {
                setEmailError(validateCustomerEmail(cleaned) || '');
              }
            }}
            onBlur={() => setEmailError(validateCustomerEmail(email) || '')}
            className={`input-field transition-all duration-200 ${
              emailError ? 'border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-500/5 text-red-100' : ''
            }`}
            placeholder="kunde@beispiel.de"
          />
          {emailError && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-400 font-medium animate-in fade-in duration-200">
              <ExclamationTriangleIcon className="w-4 h-4 shrink-0 text-red-400" />
              <span>{emailError}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-4 flex gap-3">
        <button type="button" onClick={handleSafeClose} className="btn-secondary flex-1">
          Abbrechen
        </button>
        <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
          {isSubmitting ? 'Speichert...' : 'Erstellen & Akte öffnen'}
        </button>
      </div>

      {showConfirmCancel && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-bg-panel border border-red-500/30 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 text-red-400 border border-red-500/25 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div>
              <h4 className="text-base font-bold text-text-main">Erfassung abbrechen?</h4>
              <p className="text-xs text-text-muted mt-1">Eingegebene Daten gehen verloren. Möchten Sie wirklich abbrechen?</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmCancel(false)}
                className="btn-secondary flex-1 text-xs py-2"
              >
                Weiter erfassen
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmCancel(false);
                  onClose();
                }}
                className="bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex-1 text-xs py-2"
              >
                Ja, abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
