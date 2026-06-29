"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ShieldExclamationIcon, CheckCircleIcon, TrashIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { getCol } from '@/lib/demoMode';

export default function ClaimsPage() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [highlightedClaimId, setHighlightedClaimId] = useState<string | null>(null);

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
            // Remove the parameter from URL to prevent highlighting again on refresh if unwanted
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }, 500);
      }
    }
  }, [loading]);

  useEffect(() => {
    const q = query(collection(db, getCol('claims')));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      // Neu nach alt
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
      await updateDoc(doc(db, getCol('claims'), id), { status: newStatus });
      toast.success(`Status auf "${newStatus}" geändert.`);
    } catch (e) {
      toast.error("Fehler beim Ändern des Status.");
    }
  };

  const deleteClaim = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, getCol('claims'), deleteConfirmId));
      toast.success("Schadensmeldung gelöscht.");
    } catch (e) {
      toast.error("Fehler beim Löschen.");
    } finally {
      setDeleteConfirmId(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-text-main flex items-center gap-3">
            <ShieldExclamationIcon className="w-8 h-8 text-red-500" />
            Zentrale Reklamationen
          </h1>
          <p className="text-text-muted mt-1">Hier verwaltest du alle offenen Schäden und Probleme deiner Kunden.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Status: Neu */}
        <div className="space-y-4">
          <h2 className="font-semibold text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-500/30 flex justify-between items-center">
            <span>Neu Gemeldet</span>
            <span className="bg-red-500/30 px-2 py-0.5 rounded-full text-xs">{claims.filter(c => c.status === 'Neu').length}</span>
          </h2>
          <div className="space-y-3">
            {claims.filter(c => c.status === 'Neu').map(claim => (
              <ClaimCard key={claim.id} claim={claim} updateStatus={updateStatus} onDelete={() => setDeleteConfirmId(claim.id)} isHighlighted={highlightedClaimId === claim.id} />
            ))}
          </div>
        </div>

        {/* Status: In Bearbeitung */}
        <div className="space-y-4">
          <h2 className="font-semibold text-yellow-400 bg-yellow-900/20 p-3 rounded-lg border border-yellow-500/30 flex justify-between items-center">
            <span>In Bearbeitung</span>
            <span className="bg-yellow-500/30 px-2 py-0.5 rounded-full text-xs">{claims.filter(c => c.status === 'In Bearbeitung').length}</span>
          </h2>
          <div className="space-y-3">
            {claims.filter(c => c.status === 'In Bearbeitung').map(claim => (
              <ClaimCard key={claim.id} claim={claim} updateStatus={updateStatus} onDelete={() => setDeleteConfirmId(claim.id)} isHighlighted={highlightedClaimId === claim.id} />
            ))}
          </div>
        </div>

        {/* Status: An Versicherung gemeldet */}
        <div className="space-y-4">
          <h2 className="font-semibold text-blue-400 bg-blue-900/20 p-3 rounded-lg border border-blue-500/30 flex justify-between items-center">
            <span>An Versicherung</span>
            <span className="bg-blue-500/30 px-2 py-0.5 rounded-full text-xs">{claims.filter(c => c.status === 'An Versicherung gemeldet').length}</span>
          </h2>
          <div className="space-y-3">
            {claims.filter(c => c.status === 'An Versicherung gemeldet').map(claim => (
              <ClaimCard key={claim.id} claim={claim} updateStatus={updateStatus} onDelete={() => setDeleteConfirmId(claim.id)} isHighlighted={highlightedClaimId === claim.id} />
            ))}
          </div>
        </div>

        {/* Status: Erledigt */}
        <div className="space-y-4">
          <h2 className="font-semibold text-green-400 bg-green-900/20 p-3 rounded-lg border border-green-500/30 flex justify-between items-center">
            <span>Erledigt / Abgeschlossen</span>
            <span className="bg-green-500/30 px-2 py-0.5 rounded-full text-xs">{claims.filter(c => c.status === 'Erledigt').length}</span>
          </h2>
          <div className="space-y-3">
            {claims.filter(c => c.status === 'Erledigt').map(claim => (
              <ClaimCard key={claim.id} claim={claim} updateStatus={updateStatus} onDelete={() => setDeleteConfirmId(claim.id)} isHighlighted={highlightedClaimId === claim.id} />
            ))}
          </div>
        </div>
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

function ClaimCard({ claim, updateStatus, onDelete, isHighlighted }: { claim: any, updateStatus: (id: string, s: string) => void, onDelete: () => void, isHighlighted?: boolean }) {
  return (
    <div id={`claim-${claim.id}`} className={`bg-bg-dark border p-4 rounded-xl shadow-lg transition-all duration-500 flex flex-col h-full ${isHighlighted ? 'border-primary ring-2 ring-primary/50 bg-primary/5 shadow-primary/20 scale-[1.02]' : 'border-structure hover:border-primary/50'}`}>
      <div className="flex justify-between items-start mb-2">
        <Link href={`/dashboard/customers/${claim.customerId}`} className="font-semibold text-text-main hover:text-primary transition-colors text-sm truncate">
          {claim.customerName}
        </Link>
        <button onClick={onDelete} className="text-text-muted hover:text-red-400 transition-colors">
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
      
      <p className="text-xs text-text-muted mb-2">
        Gemeldet: {new Date(claim.createdAt?.toMillis?.() || Date.now()).toLocaleDateString('de-DE')}
      </p>
      
      <p className="text-sm text-text-main line-clamp-3 mb-4 flex-1">
        {claim.description}
      </p>

      {claim.insuranceId && (
        <div className="bg-structure/50 p-2 rounded mb-3 text-xs text-text-main border border-structure">
          <span className="text-text-muted">Versicherung:</span> {claim.insuranceId}
        </div>
      )}

      <div className="mt-auto">
        <select 
          value={claim.status}
          onChange={(e) => updateStatus(claim.id, e.target.value)}
          className="w-full bg-bg-panel border border-structure text-xs text-text-main p-2 rounded-md focus:border-primary"
        >
          <option value="Neu">Neu Gemeldet</option>
          <option value="In Bearbeitung">In Bearbeitung</option>
          <option value="An Versicherung gemeldet">An Versicherung gemeldet</option>
          <option value="Erledigt">Erledigt</option>
        </select>
      </div>
    </div>
  );
}
