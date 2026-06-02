"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
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
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (err: any) {
      setError("Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Zugangsdaten.");
    }
  };

  return (
    <main className="flex-1 flex items-center justify-center min-h-screen p-4">
      <div className="panel w-full max-w-md">
        <div className="flex justify-center mb-8 px-4">
          <img src="/login-logo.png" alt="Rothirsch Login Logo" className="w-full max-w-[280px] md:max-w-[380px] object-contain" />
        </div>
        
        <h2 className="text-xl font-semibold mb-6 text-center">Internes System Login</h2>
        
        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">E-Mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="mitarbeiter@rothirsch.de"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-6">
            Anmelden
          </button>
        </form>
      </div>
    </main>
  );
}
