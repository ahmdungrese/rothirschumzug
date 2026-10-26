"use client";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { toast } from "react-hot-toast";
import { CheckIcon, XMarkIcon, LockClosedIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// Create secondary app to prevent logging out the admin
const createSecondaryApp = () => {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  const apps = getApps();
  const existingApp = apps.find(app => app.name === 'Secondary');
  return existingApp || initializeApp(firebaseConfig, 'Secondary');
};

export function TeamAccessManager() {
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState(""); // Can be email or phone
  const [password, setPassword] = useState(""); // Or PIN
  const [role, setRole] = useState<"admin" | "office" | "teamlead">("office");
  const [canViewPrices, setCanViewPrices] = useState(true);
  const [canEditPrices, setCanEditPrices] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // App DNA Validierungs-States
  const [nameError, setNameError] = useState("");
  const [loginError, setLoginError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Chef-PIN Bestätigung vor dem Anlegen eines neuen Mitarbeiters
  const [showPinModal, setShowPinModal] = useState(false);
  const [ownerPin, setOwnerPin] = useState("");
  const [pinError, setPinError] = useState("");

  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snap) => {
      setTeamMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Formular-Validierung mit App DNA Regeln (wie auf der Login-Seite)
  const validateInputs = () => {
    let isValid = true;
    setNameError("");
    setLoginError("");
    setPasswordError("");

    const trimmedName = name.trim();
    const trimmedLogin = loginId.trim();
    const trimmedPassword = password.trim();

    // 1. Name prüfen
    if (!trimmedName) {
      setNameError("Bitte geben Sie einen Namen oder Anzeigenamen ein.");
      isValid = false;
    } else if (trimmedName.length < 2) {
      setNameError("Der Name muss mindestens 2 Zeichen lang sein.");
      isValid = false;
    }

    // 2. Handynummer oder E-Mail prüfen (App DNA)
    if (!trimmedLogin) {
      setLoginError("Bitte geben Sie eine Handynummer oder E-Mail-Adresse ein.");
      isValid = false;
    } else if (trimmedLogin.includes("@")) {
      if (!EMAIL_REGEX.test(trimmedLogin)) {
        setLoginError("Bitte geben Sie eine gültige E-Mail-Adresse ein (z. B. name@rothirsch-umzug.de).");
        isValid = false;
      }
    } else {
      const digitsOnly = trimmedLogin.replace(/[^0-9]/g, "");
      const isValidPhoneChars = /^[+0-9\s\-./()]+$/.test(trimmedLogin);
      if (!isValidPhoneChars || digitsOnly.length < 6) {
        setLoginError("Ungültige Eingabe: Bitte eine gültige Handynummer (mind. 6 Ziffern) oder E-Mail eingeben.");
        isValid = false;
      }
    }

    // 3. Start-Passwort / PIN prüfen (App DNA)
    if (!trimmedPassword) {
      setPasswordError("Bitte geben Sie ein Start-Passwort oder einen PIN ein.");
      isValid = false;
    } else if (trimmedPassword.length < 6) {
      setPasswordError("Das Passwort muss mindestens 6 Zeichen oder Ziffern lang sein (z. B. 6-stelliger PIN).");
      isValid = false;
    }

    return isValid;
  };

  // Schritt 1: Formular-Validierung & Öffnen der Chef-PIN-Abfrage
  const handleRequestCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateInputs()) {
      return;
    }

    setOwnerPin("");
    setPinError("");
    setShowPinModal(true);
  };

  // Schritt 2: Server-seitige Prüfung des Chef-PINs (0777) & Anlegen des Mitarbeiters
  const handleConfirmPinAndCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerPin.trim() || isSubmitting) return;
    setPinError("");
    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      const verifyRes = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ pin: ownerPin.trim(), scope: 'mitarbeiter' })
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.valid) {
        const msg = verifyData.error || "Falscher Chef-PIN! Zugriff verweigert.";
        setPinError(msg);
        toast.error(msg);
        setIsSubmitting(false);
        return;
      }

      const trimmedLogin = loginId.trim();
      let finalEmail = "";
      if (trimmedLogin.includes("@")) {
        finalEmail = trimmedLogin.toLowerCase();
      } else {
        const cleanDigits = trimmedLogin.replace(/[^0-9]/g, '');
        finalEmail = `${cleanDigits}@rothirsch-app.de`;
      }

      const secondaryApp = createSecondaryApp();
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, password);
      const newUid = userCredential.user.uid;

      // In Firestore anlegen
      await setDoc(doc(db, 'users', newUid), {
        uid: newUid,
        displayName: name.trim(),
        email: finalEmail,
        role: role,
        loginId: trimmedLogin,
        canViewPrices: role === 'admin' ? true : role === 'teamlead' ? false : canViewPrices,
        canEditPrices: role === 'admin' ? true : role === 'teamlead' ? false : canEditPrices,
        createdAt: serverTimestamp(),
      });

      toast.success(`Mitarbeiter ${name.trim()} erfolgreich angelegt!`);
      setShowPinModal(false);
      setOwnerPin("");
      setName("");
      setLoginId("");
      setPassword("");
      setNameError("");
      setLoginError("");
      setPasswordError("");
      setRole("office");
      setCanViewPrices(true);
      setCanEditPrices(true);
    } catch (error: any) {
      console.error("Mitarbeiter-Erstellungsfehler:", error);
      if (error.code === 'auth/email-already-in-use') {
        const msg = "Diese E-Mail oder Handynummer ist bereits für einen Mitarbeiter vergeben!";
        toast.error(msg);
        setLoginError(msg);
        setShowPinModal(false);
      } else if (error.code === 'auth/weak-password') {
        const msg = "Passwort ist zu schwach (mind. 6 Zeichen oder Ziffern erforderlich).";
        toast.error(msg);
        setPasswordError(msg);
        setShowPinModal(false);
      } else if (error.code === 'auth/invalid-email') {
        const msg = "Ungültiges E-Mail- oder Telefonnummer-Format.";
        toast.error(msg);
        setLoginError(msg);
        setShowPinModal(false);
      } else if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        toast.error("Keine Schreibberechtigung in Firestore: Nur Administratoren dürfen neue Mitarbeiter anlegen.");
      } else {
        toast.error(error.message || "Fehler beim Anlegen des Mitarbeiters.");
      }
    } finally {
      // Sign out from secondary auth just to be clean
      const secondaryApp = createSecondaryApp();
      getAuth(secondaryApp).signOut().catch(() => {});
      setIsSubmitting(false);
    }
  };

  const handleUpdateName = async (uid: string) => {
    if (!editName.trim()) return;
    try {
      await updateDoc(doc(db, 'users', uid), {
        displayName: editName.trim()
      });
      toast.success("Name erfolgreich aktualisiert!");
      setEditingUid(null);
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Aktualisieren des Namens.");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-text-main mb-2">Team & Zugänge</h2>
        <p className="text-text-muted text-sm">Erstellen Sie Logins für Ihre Mitarbeiter. Das System nutzt im Hintergrund Firebase, ohne Sie auszuloggen.</p>
      </div>

      <div className="bg-bg-dark border border-structure rounded-xl p-6">
        <h3 className="text-text-main font-semibold mb-4">Neuen Mitarbeiter anlegen</h3>
        <form onSubmit={handleRequestCreateUser} noValidate onInvalid={e => e.preventDefault()} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* NAME */}
            <div>
              <label className="block text-sm text-text-muted mb-1 font-medium">Name / Anzeigename</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => {
                  setName(e.target.value);
                  if (nameError) setNameError("");
                }} 
                className={`input-field transition-all duration-200 ${
                  nameError ? "border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-500/5 text-red-100" : ""
                }`} 
                placeholder="Max Mustermann" 
                autoComplete="off"
                data-lpignore="true"
                spellCheck={false}
              />
              {nameError && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400 font-medium animate-in fade-in duration-200">
                  <ExclamationTriangleIcon className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{nameError}</span>
                </div>
              )}
            </div>

            {/* LOGIN-ID */}
            <div>
              <label className="block text-sm text-text-muted mb-1 font-medium">Handynummer oder E-Mail</label>
              <input 
                type="text" 
                value={loginId} 
                onChange={e => {
                  setLoginId(e.target.value);
                  if (loginError) setLoginError("");
                }} 
                className={`input-field transition-all duration-200 ${
                  loginError ? "border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-500/5 text-red-100" : ""
                }`} 
                placeholder="01761234567 oder name@firma.de" 
                autoComplete="off"
                data-lpignore="true"
                spellCheck={false}
              />
              {loginError ? (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400 font-medium animate-in fade-in duration-200">
                  <ExclamationTriangleIcon className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{loginError}</span>
                </div>
              ) : (
                <p className="text-xs text-text-muted mt-1">Dient später als Benutzername beim Login.</p>
              )}
            </div>

            {/* START-PASSWORT */}
            <div>
              <label className="block text-sm text-text-muted mb-1 font-medium">Start-Passwort (z.B. 6-stelliger PIN)</label>
              <input 
                type="text" 
                value={password} 
                onChange={e => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError("");
                }} 
                className={`input-field transition-all duration-200 ${
                  passwordError ? "border-red-500/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 bg-red-500/5 text-red-100" : ""
                }`} 
                placeholder="123456" 
                autoComplete="off"
                data-lpignore="true"
                spellCheck={false}
              />
              {passwordError ? (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400 font-medium animate-in fade-in duration-200">
                  <ExclamationTriangleIcon className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{passwordError}</span>
                </div>
              ) : (
                <p className="text-xs text-text-muted mt-1">Firebase benötigt mind. 6 Zeichen (z.B. 6-stelliger PIN).</p>
              )}
            </div>

            {/* ROLLE */}
            <div>
              <label className="block text-sm text-text-muted mb-1 font-medium">Rolle (Rechte)</label>
              <select value={role} onChange={e => setRole(e.target.value as any)} className="input-field bg-bg-dark">
                <option value="office">Büroassistent (Kunden, Angebote)</option>
                <option value="teamlead">Teamleiter (Laufzettel & Kalender)</option>
                <option value="admin">Admin (Voller Zugriff)</option>
              </select>
            </div>

            {role === 'office' && (
              <div className="md:col-span-2 bg-structure/20 p-4 rounded-lg border border-structure mt-2">
                <h4 className="text-sm font-semibold text-text-main mb-3">Spezielle Rechte für Büroassistenten</h4>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={canViewPrices} onChange={e => setCanViewPrices(e.target.checked)} className="accent-primary w-4 h-4" />
                    <span className="text-sm text-text-main">
                      <strong className="text-text-main">Darf Preise sehen:</strong> Wenn aktiv, werden Rechnungsbeträge und Umsätze im Kundenprofil angezeigt.
                    </span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={canEditPrices} onChange={e => setCanEditPrices(e.target.checked)} className="accent-primary w-4 h-4" disabled={!canViewPrices} />
                    <span className={`text-sm ${!canViewPrices ? 'text-text-muted opacity-50' : 'text-text-main'}`}>
                      <strong className={!canViewPrices ? '' : 'text-text-main'}>Darf Preise bearbeiten:</strong> Wenn aktiv, darf der Mitarbeiter im Angebots-Editor manuelle Preise eintippen oder Rabatte geben. Ansonsten greifen feste Katalogpreise.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full md:w-auto mt-4 flex items-center justify-center gap-2">
            <LockClosedIcon className="w-4 h-4" />
            <span>{isSubmitting ? 'Wird angelegt...' : 'Mitarbeiter Zugang erstellen'}</span>
          </button>
        </form>
      </div>

      {/* Sicherheits-Modal: Chef-PIN (0777) erforderlich */}
      {showPinModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => !isSubmitting && setShowPinModal(false)}
        >
          <div
            className="bg-bg-panel border border-structure rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-structure pb-3">
              <div className="flex items-center gap-2 text-text-main font-bold">
                <LockClosedIcon className="w-5 h-5 text-primary" />
                <span>Inhaber-Freigabe erforderlich</span>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowPinModal(false)}
                className="p-1 text-text-muted hover:text-text-main rounded-lg"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPinAndCreateUser} className="space-y-4">
              <p className="text-xs text-text-muted leading-relaxed">
                Bitte geben Sie das Inhaber-Passwort (PIN) ein, um den neuen Mitarbeiter{" "}
                <strong className="text-text-main">{name}</strong> anzulegen:
              </p>

              <input
                type="password"
                value={ownerPin}
                onChange={(e) => {
                  setOwnerPin(e.target.value);
                  setPinError("");
                }}
                placeholder="••••"
                maxLength={8}
                autoFocus
                disabled={isSubmitting}
                className="input-field w-full text-center tracking-widest font-mono text-xl py-2.5"
                required
              />

              {pinError && (
                <p className="text-xs text-red-400 font-semibold text-center">{pinError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowPinModal(false)}
                  className="btn-secondary flex-1 py-2 text-sm"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !ownerPin.trim()}
                  className="btn-primary flex-1 py-2 text-sm font-bold"
                >
                  {isSubmitting ? "Prüfe..." : "Bestätigen & Anlegen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-bg-dark border border-structure rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-structure/50 text-text-muted text-sm">
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Login-ID</th>
              <th className="p-4 font-medium">Rolle</th>
              <th className="p-4 font-medium text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map(member => (
              <tr key={member.uid} className="border-b border-structure/50 hover:bg-structure/20">
                <td className="p-4 font-medium text-text-main">
                  {editingUid === member.uid ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)} 
                        className="input-field py-1 px-2 text-sm max-w-[200px]" 
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateName(member.uid)}
                      />
                      <button onClick={() => handleUpdateName(member.uid)} className="text-[#6E8F64] hover:bg-[#6E8F64]/10 p-1 rounded" title="Speichern"><CheckIcon className="w-4 h-4" /></button>
                      <button onClick={() => setEditingUid(null)} className="text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 p-1 rounded" title="Abbrechen"><XMarkIcon className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    member.displayName || 'Unbekannt'
                  )}
                </td>
                <td className="p-4 text-text-muted">{member.loginId || member.email}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                    member.role === 'admin' ? 'bg-[#6E8F64]/20 text-[#435E3A] dark:text-[#A8C69F] border border-[#6E8F64]/30' :
                    member.role === 'office' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    {member.role === 'admin' ? 'Admin' : member.role === 'office' ? 'Büro' : 'Teamleiter'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {editingUid !== member.uid && (
                    <button 
                      onClick={() => {
                        setEditingUid(member.uid);
                        setEditName(member.displayName || '');
                      }} 
                      className="text-xs px-2 py-1 bg-structure/50 hover:bg-structure text-text-muted hover:text-text-main rounded transition-colors"
                    >
                      Bearbeiten
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {teamMembers.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-text-muted italic">Keine Mitarbeiter gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
