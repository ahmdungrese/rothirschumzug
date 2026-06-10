"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { toast } from "react-hot-toast";
import { getCol } from '@/lib/demoMode';

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

  useEffect(() => {
    const q = query(collection(db, getCol('users')));
    const unsub = onSnapshot(q, (snap) => {
      setTeamMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !loginId || !password) return;
    setIsSubmitting(true);

    try {
      let newUid = "";
      const isDemoMode = typeof window !== 'undefined' && localStorage.getItem('demoMode') === 'true';
      const finalEmail = loginId.includes("@") ? loginId : `${loginId.replace(/[^0-9]/g, '')}@rothirsch-app.de`;

      if (isDemoMode) {
        // Im Demo-Modus legen wir keine echten Firebase Auth User an, um Konflikte zu vermeiden!
        newUid = "demo-team-" + Date.now();
      } else {
        const secondaryApp = createSecondaryApp();
        const secondaryAuth = getAuth(secondaryApp);
        // Create user in real Auth
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, finalEmail, password);
        newUid = userCredential.user.uid;
      }

      // Save to Firestore
      await setDoc(doc(db, getCol('users'), newUid), {
        uid: newUid,
        displayName: name,
        email: finalEmail,
        role: role,
        loginId: loginId,
        canViewPrices: role === 'admin' ? true : role === 'teamlead' ? false : canViewPrices,
        canEditPrices: role === 'admin' ? true : role === 'teamlead' ? false : canEditPrices,
        createdAt: serverTimestamp(),
      });

      toast.success(`Mitarbeiter ${name} erfolgreich angelegt!`);
      setName("");
      setLoginId("");
      setPassword("");
      setRole("office");
      setCanViewPrices(true);
      setCanEditPrices(true);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error("Diese E-Mail/Handynummer wird bereits verwendet!");
      } else if (error.code === 'auth/weak-password') {
        toast.error("Passwort muss mind. 6 Zeichen (oder Zahlen) haben!");
      } else {
        toast.error("Fehler beim Anlegen des Mitarbeiters.");
      }
    } finally {
      // Sign out from secondary auth just to be clean
      const secondaryApp = createSecondaryApp();
      getAuth(secondaryApp).signOut().catch(() => {});
      setIsSubmitting(false);
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
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-text-muted mb-1">Name / Anzeigename</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Max Mustermann" required />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Handynummer oder E-Mail</label>
              <input type="text" value={loginId} onChange={e => setLoginId(e.target.value)} className="input-field" placeholder="01761234567" required />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Start-Passwort (z.B. 6-stelliger PIN)</label>
              <input type="text" value={password} onChange={e => setPassword(e.target.value)} className="input-field" placeholder="123456" minLength={6} required />
              <p className="text-xs text-text-muted mt-1">Firebase benötigt mind. 6 Zeichen (z.B. 6-stelliger PIN).</p>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Rolle (Rechte)</label>
              <select value={role} onChange={e => setRole(e.target.value as any)} className="input-field bg-bg-dark">
                <option value="office">💻 Büroassistent (Kunden, Angebote)</option>
                <option value="teamlead">🚚 Teamleiter (Laufzettel & Kalender)</option>
                <option value="admin">👑 Admin (Voller Zugriff)</option>
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
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full md:w-auto mt-4">
            {isSubmitting ? 'Wird angelegt...' : 'Mitarbeiter Zugang erstellen'}
          </button>
        </form>
      </div>

      <div className="bg-bg-dark border border-structure rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-structure/50 text-text-muted text-sm">
              <th className="p-4 font-medium">Name</th>
              <th className="p-4 font-medium">Login-ID</th>
              <th className="p-4 font-medium">Rolle</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map(member => (
              <tr key={member.uid} className="border-b border-structure/50 hover:bg-structure/20">
                <td className="p-4 font-medium text-text-main">{member.displayName || 'Unbekannt'}</td>
                <td className="p-4 text-text-muted">{member.loginId || member.email}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    member.role === 'admin' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                    member.role === 'office' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                    'bg-green-500/20 text-green-400 border border-green-500/30'
                  }`}>
                    {member.role === 'admin' ? '👑 Admin' : member.role === 'office' ? '💻 Büro' : '🚚 Teamleiter'}
                  </span>
                </td>
              </tr>
            ))}
            {teamMembers.length === 0 && (
              <tr><td colSpan={3} className="p-8 text-center text-text-muted italic">Keine Mitarbeiter gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
