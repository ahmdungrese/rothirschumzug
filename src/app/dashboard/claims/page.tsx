"use client";

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  ShieldExclamationIcon, 
  CheckCircleIcon, 
  TrashIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  PhotoIcon,
  CurrencyEuroIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

export default function ClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [highlightedClaimId, setHighlightedClaimId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!loading && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = params.get('claimId');
      if (id) {
        setHighlightedClaimId(id);
        setTimeout(() => {
          const el = document.getElementById(`claim-${id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }, 500);
      }
    }
  }, [loading]);

  useEffect(() => {
    const q = query(collection(db, 'claims'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      fetched.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || Date.now()) - (a.createdAt?.toMillis?.() || Date.now()));
      setClaims(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching claims", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'claims', id), { status: newStatus });
      toast.success(`Status auf "${newStatus}" geändert.`);
    } catch (e) {
      toast.error("Fehler beim Ändern des Status.");
    }
  };

  const deleteClaim = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'claims', deleteConfirmId));
      toast.success("Schadensmeldung gelöscht.");
    } catch (e) {
      toast.error("Fehler beim Löschen.");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Filter claims based on search
  const filteredClaims = useMemo(() => {
    if (!searchQuery.trim()) return claims;
    const q = searchQuery.toLowerCase();
    return claims.filter(c => 
      (c.customerName && c.customerName.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.insuranceId && c.insuranceId.toLowerCase().includes(q))
    );
  }, [claims, searchQuery]);

  const claimsNeu = filteredClaims.filter(c => c.status === 'Neu');
  const claimsInBearbeitung = filteredClaims.filter(c => c.status === 'In Bearbeitung');
  const claimsVersicherung = filteredClaims.filter(c => c.status === 'An Versicherung gemeldet');
  const claimsErledigt = filteredClaims.filter(c => c.status === 'Erledigt');

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <div className="animate-spin h-10 w-10 border-t-2 border-b-2 border-primary rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Action & Navigation Bar */}
      <div className="bg-bg-panel border border-structure p-5 md:p-6 rounded-3xl shadow-sm flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold font-headline text-text-main flex items-center gap-2.5">
                <ShieldExclamationIcon className="w-7 h-7 text-primary" />
                Zentrale Reklamationen
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest font-headline">
                Rothirsch v4.0
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Schadensabwicklung, Versicherungsvorgänge und Fristenprüfung
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-4 pr-8 py-2 text-xs rounded-full bg-bg-card border border-structure focus:outline-none focus:ring-2 focus:ring-primary text-text-main appearance-none cursor-pointer"
              >
                <option value="all">Alle Status</option>
                <option value="Neu">Neu Gemeldet</option>
                <option value="In Bearbeitung">In Bearbeitung</option>
                <option value="An Versicherung gemeldet">Versicherung</option>
                <option value="Erledigt">Erledigt</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-muted">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Schaden, Kunde, Aktenzeichen..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-full bg-bg-card border border-structure focus:outline-none focus:ring-2 focus:ring-primary text-text-main placeholder:text-text-muted transition-all"
              />
            </div>
          </div>
        </div>

        {/* Quick KPI Overview Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-structure">
          <div className="bg-bg-card border border-structure p-3 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-red-500 font-headline">Neu gemeldet</div>
              <div className="text-xl font-bold text-text-main font-headline">{claimsNeu.length}</div>
            </div>
            <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
          </div>

          <div className="bg-bg-card border border-structure p-3 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-amber-500 font-headline">In Bearbeitung</div>
              <div className="text-xl font-bold text-text-main font-headline">{claimsInBearbeitung.length}</div>
            </div>
            <span className="w-3 h-3 rounded-full bg-amber-500/80"></span>
          </div>

          <div className="bg-bg-card border border-structure p-3 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-blue-500 font-headline">An Versicherung</div>
              <div className="text-xl font-bold text-text-main font-headline">{claimsVersicherung.length}</div>
            </div>
            <span className="w-3 h-3 rounded-full bg-blue-500/80"></span>
          </div>

          <div className="bg-bg-card border border-structure p-3 rounded-2xl flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-emerald-500 font-headline">Erledigt</div>
              <div className="text-xl font-bold text-text-main font-headline">{claimsErledigt.length}</div>
            </div>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80"></span>
          </div>
        </div>
      </div>

      {/* 4 Kanban Columns */}
      <div className={`grid grid-cols-1 gap-6 items-start ${statusFilter === 'all' ? 'md:grid-cols-2 xl:grid-cols-4' : ''}`}>
        
        {/* Column 1: Neu Gemeldet */}
        {(statusFilter === 'all' || statusFilter === 'Neu') && (
        <div className="bg-red-50/60 dark:bg-red-950/20 p-4 rounded-3xl border border-red-200/80 dark:border-red-900/40 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <h3 className="text-xs font-bold uppercase tracking-widest font-headline text-slate-800 dark:text-slate-200">
                Neu Gemeldet
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
              {claimsNeu.length} Fälle
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
            {claimsNeu.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                Keine neuen Reklamationen
              </div>
            ) : (
              claimsNeu.map(claim => (
                <ClaimCard 
                  key={claim.id} 
                  claim={claim} 
                  updateStatus={updateStatus} 
                  onDelete={() => setDeleteConfirmId(claim.id)} 
                  isHighlighted={highlightedClaimId === claim.id} 
                />
              ))
            )}
          </div>
        </div>
        )}

        {/* Column 2: In Bearbeitung */}
        {(statusFilter === 'all' || statusFilter === 'In Bearbeitung') && (
        <div className="bg-amber-50/60 dark:bg-amber-950/20 p-4 rounded-3xl border border-amber-200/80 dark:border-amber-900/40 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h3 className="text-xs font-bold uppercase tracking-widest font-headline text-slate-800 dark:text-slate-200">
                In Bearbeitung
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {claimsInBearbeitung.length} Aktiv
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
            {claimsInBearbeitung.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                Keine Fälle in Bearbeitung
              </div>
            ) : (
              claimsInBearbeitung.map(claim => (
                <ClaimCard 
                  key={claim.id} 
                  claim={claim} 
                  updateStatus={updateStatus} 
                  onDelete={() => setDeleteConfirmId(claim.id)} 
                  isHighlighted={highlightedClaimId === claim.id} 
                />
              ))
            )}
          </div>
        </div>
        )}

        {/* Column 3: An Versicherung gemeldet */}
        {(statusFilter === 'all' || statusFilter === 'An Versicherung gemeldet') && (
        <div className="bg-blue-50/60 dark:bg-blue-950/20 p-4 rounded-3xl border border-blue-200/80 dark:border-blue-900/40 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h3 className="text-xs font-bold uppercase tracking-widest font-headline text-slate-800 dark:text-slate-200">
                Versicherung
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              {claimsVersicherung.length} Eingereicht
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
            {claimsVersicherung.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                Keine Fälle bei der Versicherung
              </div>
            ) : (
              claimsVersicherung.map(claim => (
                <ClaimCard 
                  key={claim.id} 
                  claim={claim} 
                  updateStatus={updateStatus} 
                  onDelete={() => setDeleteConfirmId(claim.id)} 
                  isHighlighted={highlightedClaimId === claim.id} 
                />
              ))
            )}
          </div>
        </div>
        )}

        {/* Column 4: Erledigt / Abgeschlossen */}
        {(statusFilter === 'all' || statusFilter === 'Erledigt') && (
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-3xl border border-emerald-200/80 dark:border-emerald-900/40 flex flex-col min-h-[500px]">
          <div className="flex items-center justify-between mb-4 px-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 className="text-xs font-bold uppercase tracking-widest font-headline text-slate-800 dark:text-slate-200">
                Erledigt
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              {claimsErledigt.length} Gelöst
            </span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-[70vh] pr-1 custom-scrollbar">
            {claimsErledigt.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 font-medium">
                Keine erledigten Reklamationen
              </div>
            ) : (
              claimsErledigt.map(claim => (
                <ClaimCard 
                  key={claim.id} 
                  claim={claim} 
                  updateStatus={updateStatus} 
                  onDelete={() => setDeleteConfirmId(claim.id)} 
                  isHighlighted={highlightedClaimId === claim.id} 
                />
              ))
            )}
          </div>
        </div>
        )}

      </div>

      <ConfirmModal 
        isOpen={deleteConfirmId !== null}
        title="Schadensmeldung löschen"
        message="Möchten Sie diese Reklamation wirklich löschen? Dies kann nicht rückgängig gemacht werden."
        confirmText="Löschen"
        isDestructive={true}
        onConfirm={deleteClaim}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
}

function ClaimCard({ 
  claim, 
  updateStatus, 
  onDelete, 
  isHighlighted 
}: { 
  claim: any; 
  updateStatus: (id: string, s: string) => void; 
  onDelete: () => void; 
  isHighlighted?: boolean;
}) {
  // Check for overdue statuses
  let isOverdue = false;
  let isInsuranceOverdue = false;
  const createdDate = claim.createdAt?.seconds 
    ? new Date(claim.createdAt.seconds * 1000) 
    : claim.createdAt ? new Date(claim.createdAt) : new Date();
  
  const diffTime = new Date().getTime() - createdDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  if (claim.status === 'Neu' && diffDays >= 3) {
    isOverdue = true;
  }
  if ((claim.status === 'In Bearbeitung' || claim.status === 'An Versicherung gemeldet') && diffDays >= 10) {
    isInsuranceOverdue = true;
  }

  const isDone = claim.status === 'Erledigt';

  return (
    <div 
      id={`claim-${claim.id}`} 
      className={`bg-white dark:bg-slate-800/90 border rounded-2xl p-4 shadow-xs hover:shadow-md transition-all duration-300 flex flex-col gap-3 ${
        isHighlighted 
          ? 'border-primary ring-2 ring-primary/50 scale-[1.02]' 
          : isOverdue || isInsuranceOverdue 
            ? 'border-red-500/80 dark:border-red-500/60' 
            : 'border-slate-200/80 dark:border-slate-700/60'
      }`}
    >
      {/* Header: Customer Link + Delete */}
      <div className="flex justify-between items-start gap-2">
        {claim.customerId ? (
          <Link 
            href={`/dashboard/customers/${claim.customerId}`}
            className="font-bold text-sm text-slate-900 dark:text-white hover:text-[#D91E2A] transition-colors font-headline flex items-center gap-1 truncate"
          >
            <span className="truncate">{claim.customerName || 'Kunde'}</span>
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 opacity-50 shrink-0" />
          </Link>
        ) : (
          <span className="font-bold text-sm text-slate-900 dark:text-white font-headline truncate">
            {claim.customerName || 'Kunde'}
          </span>
        )}

        <button 
          onClick={onDelete} 
          className="text-slate-400 hover:text-red-500 transition-colors p-1 -mr-1"
          title="Reklamation löschen"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
      
      {/* Date & Alert Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          {createdDate.toLocaleDateString('de-DE')}
        </span>

        {isOverdue && (
          <span className="bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
            <ExclamationTriangleIcon className="w-3 h-3" />
            &gt;3 Tage offen
          </span>
        )}

        {isInsuranceOverdue && (
          <span className="bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
            <ExclamationTriangleIcon className="w-3 h-3" />
            &gt;10 Tage Versicherung
          </span>
        )}

        {isDone && (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
            <CheckCircleIcon className="w-3 h-3" />
            Gelöst
          </span>
        )}
      </div>
      
      {/* Description */}
      <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-3 leading-relaxed">
        {claim.description || 'Keine Schadensbeschreibung vorhanden.'}
      </p>

      {/* Insurance info or amount if present */}
      {(claim.insuranceId || claim.amount) && (
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1">
          {claim.insuranceId && (
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-400">Versicherung:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{claim.insuranceId}</span>
            </div>
          )}
          {claim.amount && (
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span className="text-[10px] uppercase font-bold text-slate-400">Schadenshöhe:</span>
              <span className="font-bold text-[#D91E2A]">{claim.amount} €</span>
            </div>
          )}
        </div>
      )}

      {/* Status Selector */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 mt-auto">
        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
          Status aktualisieren:
        </label>
        <select 
          value={claim.status}
          onChange={(e) => updateStatus(claim.id, e.target.value)}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white p-2 rounded-xl focus:border-primary focus:outline-none cursor-pointer font-medium"
        >
          <option value="Neu">Neu Gemeldet</option>
          <option value="In Bearbeitung">In Bearbeitung</option>
          <option value="An Versicherung gemeldet">An Versicherung gemeldet</option>
          <option value="Erledigt">Erledigt / Abgeschlossen</option>
        </select>
      </div>
    </div>
  );
}

