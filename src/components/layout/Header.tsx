"use client";
import { Bars3Icon, PlusIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { QuickCreateCustomer } from '@/components/customers/QuickCreateCustomer';
import { NotificationBell } from '@/components/ui/NotificationBell';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, logout } = useAuth();
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  return (
    <>
      <header className="h-16 bg-bg-panel border-b border-structure flex items-center justify-between px-4 lg:px-8 shadow-sm">
        <div className="flex items-center gap-4">
          {/* Logo or other left-aligned items can go here */}
        </div>

        <div className="flex items-center gap-3 lg:gap-6">
          {/* Quick Create Action */}
          <button 
            onClick={() => setIsQuickCreateOpen(true)}
            className="btn-primary py-2 px-3 sm:px-4 text-sm whitespace-nowrap"
          >
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Neuer Kunde</span>
          </button>

          <div className="hidden sm:block h-8 w-px bg-structure"></div>

          {/* Anti-Vergess System (Glocke) */}
          <NotificationBell />

          {/* User Menu */}
          <div className="flex items-center gap-3 pl-2 border-l border-structure md:border-none">
            <div className="hidden md:block text-right">
              <div className="text-sm font-medium text-text-main">{profile?.displayName || profile?.email || 'Mitarbeiter'}</div>
              <div className="text-xs text-text-muted capitalize">{profile?.role || 'Lädt...'}</div>
            </div>
            <button onClick={logout} className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Abmelden">
              <ArrowRightOnRectangleIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      <SlideOver 
        isOpen={isQuickCreateOpen} 
        onClose={() => setIsQuickCreateOpen(false)} 
        title="Kunde schnell anlegen"
      >
        <QuickCreateCustomer onClose={() => setIsQuickCreateOpen(false)} />
      </SlideOver>
    </>
  );
}
