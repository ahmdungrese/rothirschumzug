"use client";
import { Bars3Icon, PlusIcon, ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';
import { SlideOver } from '@/components/ui/SlideOver';
import { QuickCreateCustomer } from '@/components/customers/QuickCreateCustomer';

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { profile, logout } = useAuth();
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  return (
    <>
      <header className="h-16 bg-bg-panel border-b border-structure flex items-center justify-between px-4 lg:px-8 shadow-sm">
        <div className="flex items-center gap-4">
          
          {/* Time Tracking Toggle (UI Only for now) */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-sm text-text-muted font-medium">Status:</span>
            <button 
              onClick={() => setIsClockedIn(!isClockedIn)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all duration-300 ${
                isClockedIn 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30 shadow-[0_0_10px_rgba(34,197,94,0.2)]' 
                  : 'bg-structure text-text-muted border border-transparent hover:text-text-main hover:bg-inactive'
              }`}
            >
              <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${isClockedIn ? 'bg-green-400' : 'bg-text-muted'}`}></div>
              {isClockedIn ? 'Eingestempelt' : 'Ausgestempelt'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 lg:gap-6">
          {/* Quick Create Action */}
          <button 
            onClick={() => setIsQuickCreateOpen(true)}
            className="btn-primary py-2 px-3 sm:px-4 text-sm whitespace-nowrap"
          >
            <PlusIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Neuer Kunde / Angebot</span>
          </button>

          <div className="hidden sm:block h-8 w-px bg-structure"></div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
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
