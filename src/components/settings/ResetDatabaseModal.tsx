import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';

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
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/reset-database', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ action: 'count' })
        });
        
        const data = await res.json();
        if (data.success) {
          const c = data.counts || {};
          setCounts({
            customers: (c.customers || 0) + (c.customers_demo || 0),
            orders: (c.orders || 0) + (c.orders_demo || 0),
            invoices: (c.invoices || 0) + (c.invoices_demo || 0)
          });
        } else {
          toast.error("Fehler beim Abrufen der Zähler.");
          onClose();
        }
      } catch (err) {
        console.error(err);
        toast.error("Verbindungsfehler.");
        onClose();
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
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/reset-database', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ action: 'reset' })
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(
          `Gelöscht: ${data.results.deletedDocs.customers || 0} Kunden, ` +
          `${data.results.deletedDocs.orders || 0} Aufträge, ` +
          `${data.results.deletedDocs.invoices || 0} Rechnungen, ` +
          `${data.results.deletedFiles || 0} Dateien. Zähler auf 1 gesetzt.`,
          { duration: 8000 }
        );
        if (onResetSuccess) {
          onResetSuccess();
        } else {
          onClose();
        }
      } else {
        toast.error(data.error || "Fehler beim Reset");
      }
    } catch (err: any) {
      toast.error(err.message || "Unbekannter Fehler beim Reset");
    } finally {
      setIsResetting(false);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <Modal onClose={onClose} title="Fehlende Berechtigung">
        <div className="p-4 text-center text-text-muted">
          Nur Administratoren können die Datenbank zurücksetzen.
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
