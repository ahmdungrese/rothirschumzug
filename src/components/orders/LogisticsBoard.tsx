"use client";

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';
import { CheckCircleIcon, CubeIcon, TruckIcon, WrenchScrewdriverIcon, ExclamationTriangleIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface LogisticsBoardProps {
  order: any;
}

export function LogisticsBoard({ order }: LogisticsBoardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Parse services to see what's needed
  const hasHalteverbot = order?.services?.some((s: any) => s.name?.toLowerCase().includes('halteverbot')) || false;
  const hasKartons = order?.services?.some((s: any) => s.name?.toLowerCase().includes('karton')) || false;
  const hasKuecheHandwerker = order?.services?.some((s: any) => 
    s.name?.toLowerCase().includes('küche') || 
    s.name?.toLowerCase().includes('montage') || 
    s.name?.toLowerCase().includes('handwerker')
  ) || false;

  const state = order?.logisticsState || {};
  const ticketStates = order?.ticketStates || {};

  const toggleState = async (key: string, ticketDependencyKey?: string, ticketDoneRequired?: boolean) => {
    if (isUpdating) return;
    setIsUpdating(true);

    try {
      const newState = { ...state, [key]: !state[key] };
      const updates: any = { logisticsState: newState };

      // Wenn eine System-Ticket-Abhängigkeit existiert und erfüllt ist, lösen wir das Ticket!
      if (ticketDependencyKey) {
        // Beispiel: Wenn `ticketDoneRequired` true ist, bedeutet das: Wenn dieser Haken gesetzt wird, ist das Ticket komplett erledigt
        // Für Halteverbot: Wir haben 3 Haken. Wenn der LETZTE Haken (aufgestellt) gesetzt wird, ist das Ticket fertig.
        if (ticketDoneRequired) {
          updates[`ticketStates.${ticketDependencyKey}`] = newState[key]; // Wenn Haken true -> Ticket erledigt (verschwindet vom Dashboard)
        }
      }

      await updateDoc(doc(db, getCol('orders'), order.id), updates);
    } catch (error) {
      console.error("Error updating logistics state", error);
      toast.error("Fehler beim Speichern");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-structure/50 animate-in fade-in slide-in-from-top-4">
      <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
        <BriefcaseIcon className="w-5 h-5" />
        Vorbereitungs-Board (Logistik)
      </h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* STANDARD: Mitarbeiter & Fahrzeuge */}
        <div className="bg-bg-dark border border-structure rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3 text-text-main font-medium">
            <TruckIcon className="w-5 h-5 text-blue-400" /> Disposition
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={state.team_besprochen || false} onChange={() => toggleState('team_besprochen')} className="w-5 h-5 rounded border-structure bg-bg-panel text-primary focus:ring-primary/50 cursor-pointer" />
              <span className={`text-sm ${state.team_besprochen ? 'text-text-muted line-through' : 'text-text-main group-hover:text-text-main'}`}>Mitarbeiter & Team besprochen</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={state.fahrzeuge_reserviert || false} onChange={() => toggleState('fahrzeuge_reserviert')} className="w-5 h-5 rounded border-structure bg-bg-panel text-primary focus:ring-primary/50 cursor-pointer" />
              <span className={`text-sm ${state.fahrzeuge_reserviert ? 'text-text-muted line-through' : 'text-text-main group-hover:text-text-main'}`}>Fahrzeuge reserviert / eingeteilt</span>
            </label>
          </div>
        </div>

        {/* HALTEVERBOT */}
        {hasHalteverbot && (
          <div className="bg-bg-dark border border-structure rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-text-main font-medium">
              <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400" /> Halteverbotszone
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={state.hv_beantragt || false} onChange={() => toggleState('hv_beantragt')} className="w-5 h-5 rounded border-structure bg-bg-panel text-yellow-500 focus:ring-yellow-500/50 cursor-pointer" />
                <span className={`text-sm ${state.hv_beantragt ? 'text-text-muted line-through' : 'text-text-main group-hover:text-text-main'}`}>Beim Amt beantragt</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={state.hv_bestaetigt || false} onChange={() => toggleState('hv_bestaetigt')} className="w-5 h-5 rounded border-structure bg-bg-panel text-yellow-500 focus:ring-yellow-500/50 cursor-pointer" />
                <span className={`text-sm ${state.hv_bestaetigt ? 'text-text-muted line-through' : 'text-text-main group-hover:text-text-main'}`}>Genehmigung erhalten</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                {/* Wenn aufgestellt -> Ticket erledigt! */}
                <input type="checkbox" checked={state.hv_aufgestellt || false} onChange={() => toggleState('hv_aufgestellt', 'halteverbot', true)} className="w-5 h-5 rounded border-structure bg-bg-panel text-yellow-500 focus:ring-yellow-500/50 cursor-pointer" />
                <span className={`text-sm ${state.hv_aufgestellt ? 'text-text-muted line-through' : 'text-text-main group-hover:text-text-main'}`}>Schilder auf der Straße aufgestellt</span>
              </label>
            </div>
          </div>
        )}

        {/* KARTONS */}
        {hasKartons && (
          <div className="bg-bg-dark border border-structure rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-text-main font-medium">
              <CubeIcon className="w-5 h-5 text-orange-400" /> Umzugskartons
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                {/* Wenn geliefert -> Ticket erledigt! */}
                <input type="checkbox" checked={state.kartons_geliefert || false} onChange={() => toggleState('kartons_geliefert', 'kartons_liefern', true)} className="w-5 h-5 rounded border-structure bg-bg-panel text-orange-500 focus:ring-orange-500/50 cursor-pointer" />
                <span className={`text-sm ${state.kartons_geliefert ? 'text-text-muted line-through' : 'text-text-main group-hover:text-text-main'}`}>Kartons an Kunden geliefert</span>
              </label>
            </div>
          </div>
        )}

        {/* KÜCHENMONTAGE / HANDWERKER */}
        {hasKuecheHandwerker && (
          <div className="bg-bg-dark border border-structure rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 text-text-main font-medium">
              <WrenchScrewdriverIcon className="w-5 h-5 text-purple-400" /> Handwerker / Montage
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                {/* Wenn gebucht -> Ticket erledigt! */}
                <input type="checkbox" checked={state.handwerker_gebucht || false} onChange={() => toggleState('handwerker_gebucht', 'einbau_service', true)} className="w-5 h-5 rounded border-structure bg-bg-panel text-purple-500 focus:ring-purple-500/50 cursor-pointer" />
                <span className={`text-sm ${state.handwerker_gebucht ? 'text-text-muted line-through' : 'text-text-main group-hover:text-text-main'}`}>Handwerker informiert / gebucht</span>
              </label>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
