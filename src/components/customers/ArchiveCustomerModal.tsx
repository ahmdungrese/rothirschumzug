"use client";

import React, { useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  doc, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  ArchiveBoxIcon, 
  ExclamationTriangleIcon, 
  ShieldExclamationIcon, 
  TruckIcon, 
  CalendarDaysIcon, 
  XMarkIcon,
  DocumentTextIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { generateTickets } from '@/lib/ticketEngine';
import toast from 'react-hot-toast';

interface ArchiveCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: any;
  orders?: any[];
  invoices?: any[];
  claims?: any[];
  onSuccess?: () => void;
}

export function ArchiveCustomerModal({
  isOpen,
  onClose,
  customer,
  orders = [],
  invoices = [],
  claims = [],
  onSuccess
}: ArchiveCustomerModalProps) {
  const { profile } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Identify active invoices (non-cancelled, non-storno)
  const activeInvoices = useMemo(() => {
    const activeMap = new Map<string, any>();

    // From invoices collection
    invoices.forEach((inv: any) => {
      const isCancelled = Boolean(inv.isStorno || inv.isCanceled || inv.status === 'invoice_cancelled' || inv.status === 'canceled');
      const num = inv.invoiceNumber || inv.activeInvoiceNumber;
      if (!isCancelled && num) {
        activeMap.set(num, {
          id: inv.id,
          invoiceNumber: num,
          invoiceDate: inv.invoiceDate || (inv.createdAt?.toDate ? inv.createdAt.toDate().toISOString() : ''),
          total: inv.totals?.gross || inv.calcInput?.gross || 0,
          sourceOrderId: inv.sourceOrderId || inv.orderId || null
        });
      }
    });

    // From orders with active invoiceNumber
    orders.forEach((ord: any) => {
      const isCancelled = Boolean(ord.isStorno || ord.invoiceCancelled || ord.status === 'invoice_cancelled' || ord.status === 'canceled');
      const num = ord.invoiceNumber || ord.activeInvoiceNumber;
      if (!isCancelled && num && !activeMap.has(num)) {
        activeMap.set(num, {
          id: null,
          invoiceNumber: num,
          invoiceDate: ord.invoiceDate || (ord.createdAt?.toDate ? ord.createdAt.toDate().toISOString() : ''),
          total: ord.totals?.gross || ord.calcInput?.gross || ord.flatRateNet || 0,
          sourceOrderId: ord.id
        });
      }
    });

    return Array.from(activeMap.values());
  }, [invoices, orders]);

  // 2. Identify active / confirmed move contracts
  const activeMoves = useMemo(() => {
    return orders.filter(o => {
      if (o.status === 'archived' || o.isArchived) return false;
      const isConfirmed = o.status === 'confirmed' || o.status === 'completed';
      const hasDate = Boolean(o.orderMeta?.movingDateFrom || o.movingDate || o.logistics?.movingDate);
      return isConfirmed || hasDate;
    });
  }, [orders]);

  // 3. Identify pending logistics tasks (tickets not done)
  const pendingTasksSummary = useMemo(() => {
    let uncompletedCount = 0;
    const taskLabels: string[] = [];

    orders.forEach(ord => {
      if (ord.status === 'archived' || ord.isArchived) return;
      const tickets = generateTickets(ord, customer);
      tickets.forEach(t => {
        if (!t.done) {
          uncompletedCount++;
          if (t.title && !taskLabels.includes(t.title) && taskLabels.length < 4) {
            taskLabels.push(t.title);
          }
        }
      });
    });

    return { count: uncompletedCount, labels: taskLabels };
  }, [orders, customer]);

  // 4. Identify open damage claims / complaints
  const openClaims = useMemo(() => {
    return claims.filter(c => c.status !== 'Erledigt' && !c.isArchived);
  }, [claims]);

  if (!isOpen || !customer) return null;

  const custDisplayName = customer.type === 'firma'
    ? (customer.company || customer.lastName || 'Firma')
    : `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Kunde';

  const hasAnyActiveIssues = activeInvoices.length > 0 || activeMoves.length > 0 || pendingTasksSummary.count > 0 || openClaims.length > 0;

  const handleExecuteArchive = async () => {
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);

      // 1. GoBD Storno: Generate cancellation documents for active invoices
      if (activeInvoices.length > 0) {
        for (const inv of activeInvoices) {
          const invNum = inv.invoiceNumber;
          const stornoNumber = `ST-${invNum.replace(/^(RE-|R-|ST-)/i, '')}`;

          // Create Storno doc in 'invoices'
          const stornoDocRef = doc(collection(db, 'invoices'));
          batch.set(stornoDocRef, {
            type: 'invoice',
            isStorno: true,
            stornoFor: invNum,
            invoiceNumber: stornoNumber,
            invoiceDate: new Date().toISOString(),
            customerId: customer.id,
            customerName: custDisplayName,
            sourceOrderId: inv.sourceOrderId || null,
            status: 'invoice_cancelled',
            isCanceled: true,
            stornoReason: 'Kunde archiviert (Vorgang eingefroren)',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Update original invoice if exists in 'invoices'
          if (inv.id) {
            const origInvRef = doc(db, 'invoices', inv.id);
            batch.update(origInvRef, {
              status: 'invoice_cancelled',
              isCanceled: true,
              stornoReason: 'Kunde archiviert (Vorgang eingefroren)',
              stornoDocumentNumber: stornoNumber,
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      // 2. Cascade freeze & archive to all customer orders
      for (const ord of orders) {
        const ordRef = doc(db, 'orders', ord.id);
        const updatePayload: any = {
          status: 'archived',
          isArchived: true,
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (activeInvoices.length > 0) {
          updatePayload.invoiceCancelled = true;
        }
        batch.update(ordRef, updatePayload);
      }

      // 3. Freeze & archive customer document
      const custRef = doc(db, 'customers', customer.id);
      batch.update(custRef, {
        isArchived: true,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 4. Freeze & archive any open claims associated with this customer
      for (const clm of openClaims) {
        if (clm.id) {
          const claimRef = doc(db, 'claims', clm.id);
          batch.update(claimRef, {
            isArchived: true,
            archivedAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
      }

      // Commit atomic batch
      await batch.commit();

      // Log activity
      logActivity(
        profile?.uid || 'system',
        profile?.displayName || profile?.email || 'Mitarbeiter',
        'ARCHIVE_CUSTOMER',
        `Kunde "${custDisplayName}" (${customer.customerNumber || customer.id}) und ${orders.length} Auftrag/Aufträge eingefroren archiviert.`
      );

      toast.success(`Kunde "${custDisplayName}" wurde eingefroren und erfolgreich archiviert.`);
      if (onSuccess) {
        onSuccess();
      } else {
        onClose();
      }
    } catch (err) {
      console.error("Fehler beim Archivieren des Kunden:", err);
      toast.error("Fehler beim Archivieren des Kunden.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 md:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <ArchiveBoxIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Kunde archivieren
              </h3>
              <p className="text-xs text-slate-500">
                {custDisplayName} {customer.customerNumber ? `(${customer.customerNumber})` : ''}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Warning & Active Vorgänge Overview */}
        <div className="space-y-2.5 text-xs">
          {hasAnyActiveIssues ? (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <ExclamationTriangleIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Offene Vorgänge bei diesem Kunden festgestellt:</span>
              </div>
              <ul className="space-y-1.5 text-[11px] list-disc list-inside text-amber-900 dark:text-amber-200 pl-1">
                {activeMoves.length > 0 && (
                  <li>
                    <strong className="text-amber-950 dark:text-amber-100">Aktiver Umzugsauftrag:</strong>{' '}
                    {activeMoves.map(m => m.orderMeta?.movingDateFrom || m.movingDate || m.orderNumber || 'Auftrag').join(', ')}
                  </li>
                )}
                {pendingTasksSummary.count > 0 && (
                  <li>
                    <strong className="text-amber-950 dark:text-amber-100">{pendingTasksSummary.count} offene Aufgaben</strong>{' '}
                    in der Logistik ({pendingTasksSummary.labels.join(', ')}
                    {pendingTasksSummary.count > pendingTasksSummary.labels.length ? ' u.a.' : ''})
                  </li>
                )}
                {openClaims.length > 0 && (
                  <li>
                    <strong className="text-amber-950 dark:text-amber-100">{openClaims.length} offene Schadensmeldung(en) / Reklamation(en)</strong>
                  </li>
                )}
                {activeInvoices.length > 0 && (
                  <li>
                    <strong className="text-amber-950 dark:text-amber-100">{activeInvoices.length} aktive Rechnung(en):</strong>{' '}
                    {activeInvoices.map(i => i.invoiceNumber).join(', ')}{' '}
                    (wird automatisch per GoBD-Stornobeleg storniert)
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300">
              <p>Dieser Kunde hat keine offenen Aufträge, keine unfertigen Aufgaben und keine Rechnungen.</p>
            </div>
          )}

          {/* DNA Clarification: Frozen State Guarantee */}
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-[11px]">
              <ShieldExclamationIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>Status wird eingefroren (Nicht als erledigt markiert):</span>
            </div>
            <p className="text-[11px] text-blue-800/90 dark:text-blue-200/90 leading-relaxed">
              Beim Archivieren werden offene Aufgaben <strong>nicht als erledigt verbucht</strong>, sondern im aktuellen Zustand pausiert und ins Archiv übertragen. Der Kunde wird aus den aktiven Ansichten (Dispo, Logistik & Kalender) entfernt.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isProcessing}
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleExecuteArchive}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArchiveBoxIcon className="w-4 h-4" />
            <span>
              {isProcessing
                ? "Wird archiviert..."
                : activeInvoices.length > 0
                  ? "Stornieren & Kunde archivieren"
                  : hasAnyActiveIssues
                    ? "Trotzdem archivieren (Einfrieren)"
                    : "Kunde archivieren"}
            </span>
          </button>
        </div>

      </div>
    </div>
  );
}
