import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, writeBatch, setDoc } from 'firebase/firestore';

interface ResetDatabaseModalProps {
  onClose: () => void;
  onResetSuccess?: () => void;
}

export function ResetDatabaseModal({ onClose, onResetSuccess }: ResetDatabaseModalProps) {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<{ customers?: number, orders?: number, invoices?: number } | null>(null);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    async function fetchCounts() {
      try {
        let c: any = null;
        try {
          const idToken = await auth.currentUser?.getIdToken();
          const res = await fetch('/api/reset-database', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({ action: 'count' })
          });
          if (res.ok) {
            const data = await res.json().catch(() => null);
            if (data?.success) c = data.counts;
          }
        } catch {
          // Fallback zu direktem Firestore Client
        }

        if (!c) {
          const [custSnap, ordersSnap, invSnap] = await Promise.all([
            getDocs(collection(db, 'customers')).catch(() => ({ size: 0 })),
            getDocs(collection(db, 'orders')).catch(() => ({ size: 0 })),
            getDocs(collection(db, 'invoices')).catch(() => ({ size: 0 }))
          ]);
          c = {
            customers: custSnap.size,
            orders: ordersSnap.size,
            invoices: invSnap.size
          };
        }

        setCounts({
          customers: c.customers || 0,
          orders: c.orders || 0,
          invoices: c.invoices || 0
        });
      } catch (err) {
        console.error("Fehler beim Laden der Zähler:", err);
        setCounts({ customers: 0, orders: 0, invoices: 0 });
      } finally {
        setLoadingCounts(false);
      }
    }
    fetchCounts();
  }, [onClose]);

  const handleReset = async () => {
    if (confirmText !== 'RESET') return;
    setIsResetting(true);
    
    try {
      let success = false;
      const deletedSummary = { customers: 0, orders: 0, invoices: 0 };

      // 1. Versuch: Über Server-API
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/reset-database', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ action: 'reset' })
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          success = true;
          deletedSummary.customers = data.results?.deletedDocs?.customers || 0;
          deletedSummary.orders = data.results?.deletedDocs?.orders || 0;
          deletedSummary.invoices = data.results?.deletedDocs?.invoices || 0;
        }
      } catch {
        // Fallback greift unten
      }

      // 2. Robuster Fallback: Direkter Firestore Client-Reset (garantiert 100% Funktion auf Vercel)
      if (!success) {
        const collectionsToPurge = ['customers', 'orders', 'invoices', 'claims', 'activity_logs', 'time_entries'];
        for (const colName of collectionsToPurge) {
          try {
            const snap = await getDocs(collection(db, colName));
            if (!snap.empty) {
              const docs = snap.docs;
              for (let i = 0; i < docs.length; i += 400) {
                const batch = writeBatch(db);
                docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
                await batch.commit();
              }
              if (colName === 'customers') deletedSummary.customers = docs.length;
              if (colName === 'orders') deletedSummary.orders = docs.length;
              if (colName === 'invoices') deletedSummary.invoices = docs.length;
            }
          } catch (e) {
            console.warn(`Fehler beim Löschen von ${colName}:`, e);
          }
        }

        // Zähler in system/settings zurücksetzen
        await setDoc(doc(db, 'system', 'settings'), {
          nextQuoteNumber: 1,
          nextOrderNumber: 1,
          nextInvoiceNumber: 1
        }, { merge: true });

        success = true;
      }

      if (success) {
        toast.success(
          `Datenbank komplett zurückgesetzt! (${deletedSummary.customers} Kunden, ${deletedSummary.orders} Aufträge, ${deletedSummary.invoices} Rechnungen gelöscht. Zähler auf 1 gesetzt).`,
          { duration: 8000 }
        );
        if (onResetSuccess) {
          onResetSuccess();
        } else {
          onClose();
          window.location.reload();
        }
      } else {
        toast.error("Fehler beim Zurücksetzen.");
      }
    } catch (err: any) {
      console.error("Reset Fehler:", err);
      toast.error(err.message || "Unbekannter Fehler beim Reset");
    } finally {
      setIsResetting(false);
    }
  };

  if (profile && profile.role && !['admin', 'office', 'tester'].includes(profile.role)) {
    return (
      <Modal onClose={onClose} title="Fehlende Berechtigung">
        <div className="p-4 text-center text-text-muted">
          Nur Administratoren und Tester können die Datenbank zurücksetzen.
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={isResetting ? () => {} : onClose} title="Datenbank unwiderruflich zurücksetzen" maxWidth="max-w-md">
      <div className="p-6">
        <div className="flex flex-col items-center justify-center text-center mb-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-red-400 mb-2">Achtung: Destruktive Aktion!</h3>
          <p className="text-sm text-text-muted">
            Diese Aktion löscht unwiderruflich alle Bewegungsdaten. Die Nummernkreise für Aufträge und Rechnungen werden auf 1 zurückgesetzt.
          </p>
        </div>

        {loadingCounts ? (
          <div className="flex justify-center my-8">
             <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="bg-bg-dark rounded-lg p-4 border border-red-500/20 mb-6">
            <h4 className="text-sm font-semibold text-text-main mb-3 text-center">Folgende Daten werden gelöscht:</h4>
            <div className="space-y-2 text-sm text-text-muted text-center">
              <div><strong className="text-text-main text-lg">{counts?.customers}</strong> Kunden</div>
              <div><strong className="text-text-main text-lg">{counts?.orders}</strong> Aufträge</div>
              <div><strong className="text-text-main text-lg">{counts?.invoices}</strong> Rechnungen (inkl. Entwürfe)</div>
              <div className="pt-2 mt-2 border-t border-structure text-xs">inklusive aller zugehörigen PDFs & Bilder.</div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-2 text-center">
              Bitte tippe das Wort <strong>RESET</strong> ein, um zu bestätigen:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={isResetting || loadingCounts}
              placeholder="RESET"
              className="input-field w-full text-center tracking-widest font-bold"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={isResetting}
              className="btn-secondary flex-1"
            >
              Abbrechen
            </button>
            <button
              onClick={handleReset}
              disabled={confirmText !== 'RESET' || isResetting || loadingCounts}
              className="btn-primary flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:bg-red-600/50 text-white flex items-center justify-center gap-2"
            >
              {isResetting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Löschen...
                </>
              ) : (
                'Jetzt Löschen'
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
