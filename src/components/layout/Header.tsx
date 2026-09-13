"use client";
import { Bars3Icon, PlusIcon, ArrowRightOnRectangleIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { NotificationBell } from '@/components/ui/NotificationBell';
import { ActivityFeed } from '@/components/ui/ActivityFeed';
import Link from 'next/link';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      <header className="sticky top-0 z-40 h-16 bg-bg-panel border-b border-structure flex items-center justify-between px-3 sm:px-6 lg:px-8 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-4">
          <button 
            onClick={onMenuClick}
            className="md:hidden p-2 -ml-1 text-text-muted hover:text-text-main hover:bg-structure/30 rounded-xl transition-colors"
            title="Menü öffnen"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
          {/* Quick Create Action */}
          <Link 
            href="/dashboard/orders/new"
            className="btn-primary py-1.5 px-3 sm:py-2 sm:px-4 text-xs sm:text-sm whitespace-nowrap flex items-center gap-1.5 rounded-xl shadow-xs"
          >
            <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Neues Angebot</span>
            <span className="sm:hidden font-bold">Angebot</span>
          </Link>

          <div className="hidden sm:block h-6 w-px bg-structure"></div>

          {/* Anti-Vergess System (Glocke) */}
          <NotificationBell />

          {/* Audit / Aktivitäten-Verlauf */}
          <ActivityFeed />

          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 text-text-muted hover:text-text-main hover:bg-structure/40 rounded-xl transition-colors"
            title={theme === 'dark' ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'}
          >
            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>

          {/* User Menu */}
          <div className="flex items-center gap-2 sm:gap-3 pl-1 sm:pl-2 border-l border-structure md:border-none">
            <div className="hidden md:block text-right">
              <div className="text-sm font-medium text-text-main">{profile?.displayName || profile?.email || 'Mitarbeiter'}</div>
              <div className="text-xs text-text-muted capitalize">{profile?.role || 'Lädt...'}</div>
            </div>
            <button onClick={logout} className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-colors" title="Abmelden">
              <ArrowRightOnRectangleIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
