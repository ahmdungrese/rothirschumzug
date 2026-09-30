"use client";
import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { Tutorial } from '@/components/ui/Tutorial';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Route-Protection für Teamleiter: Nur Kalender & Handbuch erlaubt
  useEffect(() => {
    if (!loading && user && profile?.role === 'teamlead') {
      const allowedPaths = ['/dashboard/calendar', '/dashboard/manual'];
      const isAllowed = allowedPaths.some(p => pathname === p || pathname.startsWith(p + '/'));
      if (!isAllowed) {
        router.replace('/dashboard/calendar');
      }
    }
  }, [user, profile, loading, pathname, router]);

  // Track client-side navigation history in sessionStorage so SmartBackButton always knows real origin
  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;
    try {
      const prev = sessionStorage.getItem('rothirsch_current_path');
      if (prev && prev !== pathname) {
        sessionStorage.setItem('rothirsch_prev_path', prev);
      }
      sessionStorage.setItem('rothirsch_current_path', pathname);
    } catch {}
  }, [pathname]);

  // Ensure pressing the browser Back button never leaves a stale or blank view
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (
        e.state?.rothirschModal ||
        e.state?.wizardStep ||
        e.state?.orderStep ||
        e.state?.invoiceStep
      ) {
        return;
      }
      router.refresh();
    };
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        router.refresh();
      }
    };
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [router]);

  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading || !user) {
      timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 15000);
    } else {
      setLoadingTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [loading, user]);

  if (loading || !user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
        {loadingTimeout && (
          <div className="max-w-md bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 mt-4 text-center animate-in fade-in">
            <h3 className="text-sm font-bold text-amber-400 mb-1">
              Verbindung zur Datenbank dauert ungewöhnlich lange / تأخر الاتصال بالسيرفر
            </h3>
            <p className="text-xs text-text-muted mb-4 leading-relaxed">
              Die Cloud-Datenbank antwortet momentan verzögert. Möglicherweise ist das Internet schwach oder getrennt.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary py-2 px-4 text-xs font-bold"
              >
                Seite neu laden
              </button>
              <button
                onClick={() => logout()}
                className="btn-secondary py-2 px-4 text-xs font-bold"
              >
                Zum Login
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sicherheitscheck: Konto ohne Profil sperren
  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen p-6 text-center bg-bg-dark">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-red-400 text-3xl">shield_person</span>
        </div>
        <h2 className="text-xl font-bold text-text-main mb-2">Kein freigeschaltetes Profil</h2>
        <p className="text-sm text-text-muted max-w-md mb-6">
          Ihr Benutzerkonto ist im internen Rothirsch-System noch nicht freigeschaltet. Bitte wenden Sie sich an die Geschäftsleitung.
        </p>
        <button 
          onClick={() => logout()} 
          className="btn-secondary px-6 py-2.5 text-xs font-bold rounded-xl"
        >
          Abmelden
        </button>
      </div>
    );
  }

  const isMainDashboard = pathname === '/dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-bg-dark">
      <Tutorial />
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 pb-28 md:pb-8">
          <div className={isMainDashboard ? "w-full" : "max-w-7xl mx-auto"}>
            {children}
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
