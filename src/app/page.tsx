"use client";

import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { LockClosedIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 10 * 60; // 10 Minuten

const STORAGE_ATTEMPTS_KEY = "rothirsch_failed_login_attempts";
const STORAGE_LOCKOUT_KEY = "rothirsch_login_lockout_until";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const router = useRouter();

  // Check existing lockout or failed attempts on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedLockout = localStorage.getItem(STORAGE_LOCKOUT_KEY);
      if (storedLockout) {
        const lockoutUntil = parseInt(storedLockout, 10);
        const diff = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (diff > 0) {
          setLockoutRemaining(diff);
        } else {
          localStorage.removeItem(STORAGE_LOCKOUT_KEY);
          localStorage.removeItem(STORAGE_ATTEMPTS_KEY);
        }
      } else {
        const storedAttempts = localStorage.getItem(STORAGE_ATTEMPTS_KEY);
        if (storedAttempts) {
          setFailedAttempts(parseInt(storedAttempts, 10) || 0);
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  // Countdown timer when locked out
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          try {
            localStorage.removeItem(STORAGE_LOCKOUT_KEY);
            localStorage.removeItem(STORAGE_ATTEMPTS_KEY);
          } catch {}
          setFailedAttempts(0);
          setError("");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  useEffect(() => {
    if (user && !loading) {
      if (profile?.role === 'teamlead') {
        router.push("/dashboard/calendar");
      } else {
        router.push("/dashboard");
      }
    }
  }, [user, profile, loading, router]);

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

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (lockoutRemaining > 0) {
      setError(`Zu viele Fehlversuche! Bitte warten Sie noch ${formatTimer(lockoutRemaining)} Minuten.`);
      return;
    }

    try {
      // Wenn es kein @ enthält, ist es eine Handynummer -> Fake E-Mail bauen
      const finalEmail = loginId.includes("@") ? loginId : `${loginId.replace(/[^0-9]/g, '')}@rothirsch-app.de`;
      
      await signInWithEmailAndPassword(auth, finalEmail, password);

      // Reset counters upon successful login
      try {
        localStorage.removeItem(STORAGE_ATTEMPTS_KEY);
        localStorage.removeItem(STORAGE_LOCKOUT_KEY);
      } catch {}

      router.push("/dashboard");
    } catch (err: any) {
      const nextCount = failedAttempts + 1;
      setFailedAttempts(nextCount);

      if (nextCount >= MAX_LOGIN_ATTEMPTS) {
        const lockoutUntil = Date.now() + (LOCKOUT_DURATION_SECONDS * 1000);
        try {
          localStorage.setItem(STORAGE_LOCKOUT_KEY, lockoutUntil.toString());
          localStorage.setItem(STORAGE_ATTEMPTS_KEY, nextCount.toString());
        } catch {}
        setLockoutRemaining(LOCKOUT_DURATION_SECONDS);
        setError("Sicherheitssperre aktiviert! 5 fehlgeschlagene Anmeldeversuche. Aus Sicherheitsgründen ist die Anmeldung für 10 Minuten gesperrt / تم تفعيل الحظر الأمني! 5 محاولات خاطئة. الدخول محظور لمدة 10 دقائق لحماية النظام.");
      } else {
        try {
          localStorage.setItem(STORAGE_ATTEMPTS_KEY, nextCount.toString());
        } catch {}
        const remaining = MAX_LOGIN_ATTEMPTS - nextCount;
        setError(
          `Anmeldung fehlgeschlagen (Falsche Anmeldedaten). Verbleibende Versuche: ${remaining} von ${MAX_LOGIN_ATTEMPTS} / فشل تسجيل الدخول. المحاولات المتبقية: ${remaining} من ${MAX_LOGIN_ATTEMPTS}.`
        );
      }
    }
  };

  const isLocked = lockoutRemaining > 0;

  return (
    <main className="flex-1 flex items-center justify-center min-h-screen p-4 relative overflow-hidden bg-slate-900/10 dark:bg-bg-dark">
      {/* Background Graphic */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.05] flex items-center justify-center z-[-1]">
        <img src="/login-logo.png" alt="" className="w-full max-w-[800px] object-contain blur-[3px]" />
      </div>

      <div className="glass-panel w-full max-w-md p-6 md:p-8 animate-in zoom-in-95 duration-500 shadow-2xl rounded-2xl border border-structure/80">
        <div className="flex justify-center mb-6">
          <div className="bg-[#0B132B] py-3.5 px-6 rounded-2xl shadow-md border border-slate-700/60 flex items-center justify-center">
            <img src="/Rothirsch.png" alt="Rothirsch Logo" className="h-10 md:h-11 w-auto object-contain" />
          </div>
        </div>
        
        <h2 className="text-xl md:text-2xl font-bold mb-6 text-center text-text-main tracking-tight font-headline">
          Internes ERP-System
        </h2>
        
        {/* Lockout Warning Banner with Live Countdown */}
        {isLocked ? (
          <div className="bg-red-500/15 border-2 border-red-500/50 text-red-300 p-4 rounded-xl mb-6 text-sm flex flex-col gap-2 shadow-lg animate-pulse">
            <div className="flex items-center gap-2 font-bold text-red-400">
              <LockClosedIcon className="w-6 h-6 shrink-0" />
              <span>Sicherheitssperre aktiv / تم تجميد الدخول</span>
            </div>
            <p className="text-xs text-red-200/90 leading-relaxed">
              Aufgrund von 5 falschen Anmeldeversuchen wurde der Zugriff temporär gesperrt, um unbefugte Angriffe abzuwehren.
            </p>
            <div className="mt-2 bg-black/40 rounded-lg p-2.5 text-center border border-red-500/30">
              <span className="text-[11px] block uppercase text-red-300 font-semibold tracking-wider">
                Verbleibende Wartezeit / الوقت المتبقي
              </span>
              <span className="text-2xl font-black font-mono text-white tracking-widest">
                {formatTimer(lockoutRemaining)}
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-lg mb-6 text-sm flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold block mb-0.5">{error}</span>
              {failedAttempts > 0 && failedAttempts < MAX_LOGIN_ATTEMPTS && (
                <span className="text-[11px] text-amber-400/80 block mt-1">
                  Hinweis: Nach {MAX_LOGIN_ATTEMPTS} Fehlversuchen wird das System für 10 Minuten gesperrt.
                </span>
              )}
            </div>
          </div>
        ) : null}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              E-Mail oder Handynummer
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="01761234567 oder E-Mail"
              disabled={isLocked}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Passwort / PIN
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="••••••••"
              disabled={isLocked}
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLocked}
            className={`btn-primary w-full mt-8 py-3.5 flex items-center justify-center gap-2 font-bold ${
              isLocked ? 'opacity-50 cursor-not-allowed bg-slate-600' : ''
            }`}
          >
            {isLocked ? (
              <>
                <LockClosedIcon className="w-5 h-5" />
                <span>Gesperrt ({formatTimer(lockoutRemaining)})</span>
              </>
            ) : (
              <span>Anmelden</span>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
