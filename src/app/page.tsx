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

function getSecurityCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function setSecurityCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${Math.max(1, Math.floor(maxAgeSeconds))}; path=/; SameSite=Strict`;
}

function clearSecurityCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; max-age=0; path=/; SameSite=Strict`;
}

function persistLockoutState(lockoutUntilMs: number, attempts: number) {
  const remainingSec = Math.max(1, Math.ceil((lockoutUntilMs - Date.now()) / 1000));
  try {
    localStorage.setItem(STORAGE_LOCKOUT_KEY, lockoutUntilMs.toString());
    localStorage.setItem(STORAGE_ATTEMPTS_KEY, attempts.toString());
  } catch {}
  try {
    sessionStorage.setItem(STORAGE_LOCKOUT_KEY, lockoutUntilMs.toString());
    sessionStorage.setItem(STORAGE_ATTEMPTS_KEY, attempts.toString());
  } catch {}
  setSecurityCookie(STORAGE_LOCKOUT_KEY, lockoutUntilMs.toString(), remainingSec);
  setSecurityCookie(STORAGE_ATTEMPTS_KEY, attempts.toString(), remainingSec);
}

function persistAttemptsState(attempts: number) {
  try {
    localStorage.setItem(STORAGE_ATTEMPTS_KEY, attempts.toString());
  } catch {}
  try {
    sessionStorage.setItem(STORAGE_ATTEMPTS_KEY, attempts.toString());
  } catch {}
  setSecurityCookie(STORAGE_ATTEMPTS_KEY, attempts.toString(), LOCKOUT_DURATION_SECONDS);
}

function clearAllSecurityState() {
  try {
    localStorage.removeItem(STORAGE_LOCKOUT_KEY);
    localStorage.removeItem(STORAGE_ATTEMPTS_KEY);
  } catch {}
  try {
    sessionStorage.removeItem(STORAGE_LOCKOUT_KEY);
    sessionStorage.removeItem(STORAGE_ATTEMPTS_KEY);
  } catch {}
  clearSecurityCookie(STORAGE_LOCKOUT_KEY);
  clearSecurityCookie(STORAGE_ATTEMPTS_KEY);
}

export default function Home() {
  const { user, profile, loading } = useAuth();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Check existing lockout or failed attempts on mount across localStorage, sessionStorage & cookie
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const lockoutCandidates = [
        localStorage.getItem(STORAGE_LOCKOUT_KEY),
        sessionStorage.getItem(STORAGE_LOCKOUT_KEY),
        getSecurityCookie(STORAGE_LOCKOUT_KEY),
      ]
        .map((v) => (v ? parseInt(v, 10) : 0))
        .filter((v) => !isNaN(v) && v > 0);

      const maxLockoutUntil = lockoutCandidates.length > 0 ? Math.max(...lockoutCandidates) : 0;

      const attemptCandidates = [
        localStorage.getItem(STORAGE_ATTEMPTS_KEY),
        sessionStorage.getItem(STORAGE_ATTEMPTS_KEY),
        getSecurityCookie(STORAGE_ATTEMPTS_KEY),
      ]
        .map((v) => (v ? parseInt(v, 10) : 0))
        .filter((v) => !isNaN(v) && v > 0);

      const maxAttempts = attemptCandidates.length > 0 ? Math.max(...attemptCandidates) : 0;

      if (maxLockoutUntil > 0) {
        const diff = Math.ceil((maxLockoutUntil - Date.now()) / 1000);
        if (diff > 0) {
          const effectiveAttempts = Math.max(maxAttempts, MAX_LOGIN_ATTEMPTS);
          setLockoutRemaining(diff);
          setFailedAttempts(effectiveAttempts);
          persistLockoutState(maxLockoutUntil, effectiveAttempts);
        } else {
          clearAllSecurityState();
        }
      } else if (maxAttempts > 0) {
        setFailedAttempts(maxAttempts);
        persistAttemptsState(maxAttempts);
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
          clearAllSecurityState();
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
    if (isSubmitting) return;
    setError("");

    if (lockoutRemaining > 0) {
      setError(`Zu viele Fehlversuche! Bitte warten Sie noch ${formatTimer(lockoutRemaining)} Minuten.`);
      return;
    }

    setIsSubmitting(true);

    try {
      // Exponential Backoff Delay vor jedem weiteren Versuch nach vorangegangenen Fehlversuchen
      if (failedAttempts > 0) {
        const backoffDelayMs = Math.min(Math.pow(2, failedAttempts - 1) * 1000, 8000);
        await new Promise((resolve) => setTimeout(resolve, backoffDelayMs));
      }

      // Wenn es kein @ enthält, ist es eine Handynummer -> Fake E-Mail bauen
      const finalEmail = loginId.includes("@") ? loginId : `${loginId.replace(/[^0-9]/g, '')}@rothirsch-app.de`;
      
      await signInWithEmailAndPassword(auth, finalEmail, password);

      // Reset counters upon successful login
      clearAllSecurityState();

      router.push("/dashboard");
    } catch (err: any) {
      const isFirebaseRateLimited =
        err?.code === "auth/too-many-requests" ||
        (typeof err?.message === "string" && err.message.includes("auth/too-many-requests"));

      const nextCount = isFirebaseRateLimited
        ? MAX_LOGIN_ATTEMPTS
        : failedAttempts + 1;
      setFailedAttempts(nextCount);

      if (isFirebaseRateLimited || nextCount >= MAX_LOGIN_ATTEMPTS) {
        const lockoutUntil = Date.now() + (LOCKOUT_DURATION_SECONDS * 1000);
        persistLockoutState(lockoutUntil, nextCount);
        setLockoutRemaining(LOCKOUT_DURATION_SECONDS);
        setError(
          isFirebaseRateLimited
            ? "Sicherheitssperre durch Server aktiviert (auth/too-many-requests)! Zu viele Anmeldeversuche. Der Zugriff ist für 10 Minuten gesperrt / تم تفعيل الحظر الأمني من الخادم بسبب كثرة المحاولات! الدخول محظور لمدة 10 دقائق."
            : "Sicherheitssperre aktiviert! 5 fehlgeschlagene Anmeldeversuche. Aus Sicherheitsgründen ist die Anmeldung für 10 Minuten gesperrt / تم تفعيل الحظر الأمني! 5 محاولات خاطئة. الدخول محظور لمدة 10 دقائق لحماية النظام."
        );
      } else {
        persistAttemptsState(nextCount);
        const remaining = MAX_LOGIN_ATTEMPTS - nextCount;
        const nextBackoffSec = Math.min(Math.pow(2, nextCount - 1), 8);
        setError(
          `Anmeldung fehlgeschlagen (Falsche Anmeldedaten). Verbleibende Versuche: ${remaining} von ${MAX_LOGIN_ATTEMPTS} (Verzögerung: ${nextBackoffSec}s) / فشل تسجيل الدخول. المحاولات المتبقية: ${remaining} من ${MAX_LOGIN_ATTEMPTS}.`
        );
      }
    } finally {
      setIsSubmitting(false);
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
          Umzugs-Management
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
              E-Mail-Adresse
            </label>
            <input
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="name@rothirsch-umzug.de"
              disabled={isLocked || isSubmitting}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">
              Passwort
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="••••••••"
              disabled={isLocked || isSubmitting}
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLocked || isSubmitting}
            className={`btn-primary w-full mt-8 py-3.5 flex items-center justify-center gap-2 font-bold ${
              isLocked || isSubmitting ? 'opacity-50 cursor-not-allowed bg-slate-600' : ''
            }`}
          >
            {isLocked ? (
              <>
                <LockClosedIcon className="w-5 h-5" />
                <span>Gesperrt ({formatTimer(lockoutRemaining)})</span>
              </>
            ) : isSubmitting ? (
              <span>Prüfe Anmeldung...</span>
            ) : (
              <span>Anmelden</span>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
