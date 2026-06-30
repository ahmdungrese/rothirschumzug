"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // Wenn es kein @ enthält, ist es eine Handynummer -> Fake E-Mail bauen
      const finalEmail = loginId.includes("@") ? loginId : `${loginId.replace(/[^0-9]/g, '')}@rothirsch-app.de`;
      
      await signInWithEmailAndPassword(auth, finalEmail, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError("Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Zugangsdaten.");
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center min-h-screen p-4 relative overflow-hidden">
      {/* Background Graphic */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05] flex items-center justify-center z-[-1]">
        <img src="/login-logo.png" alt="" className="w-full max-w-[800px] object-contain blur-[3px]" />
      </div>

      <div className="glass-panel w-full max-w-md p-6 md:p-8 animate-in zoom-in-95 duration-500">
        <div className="flex justify-center mb-8 px-4">
          <img src="/login-logo.png" alt="Rothirsch Login Logo" className="w-full max-w-[280px] md:max-w-[320px] object-contain drop-shadow-2xl" />
        </div>
        
        <h2 className="text-xl md:text-2xl font-bold mb-6 text-center text-text-main tracking-tight">Internes System</h2>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">E-Mail oder Handynummer</label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="input-field"
              placeholder="01761234567 oder E-Mail"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Passwort / PIN</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-8 py-3.5">
            Anmelden
          </button>
        </form>
      </div>
    </main>
  );
}
