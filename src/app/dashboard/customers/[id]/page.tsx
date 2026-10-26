"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { doc, collection, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CustomerPremiumProfile } from '@/components/customers/CustomerPremiumProfile';
import { PaymentManager } from '@/components/orders/PaymentManager';
import { ProtocolModal } from '@/components/customers/ProtocolModal';
import { DispoModal } from '@/components/orders/DispoModal';
import { MessageSenderModal } from '@/components/customers/MessageSenderModal';
import { SignatureModal } from '@/components/orders/SignatureModal';
import { PdfModal } from '@/components/ui/PdfModal';
import { ClaimModal } from '@/components/customers/ClaimModal';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';
import { SmartBackButton } from '@/components/ui/SmartBackButton';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { triggerHaptic } from '@/lib/haptics';
import { sanitizeText } from '@/lib/inputValidation';

export default function CustomerProfilePage() {
  const { profile } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerId = params.id as string;
  const action = searchParams?.get('action');
  const actionOrderId = searchParams?.get('orderId');
  const queryPdfType = searchParams?.get('pdfType');

  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [freeInvoices, setFreeInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Action States
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [protocolOrder, setProtocolOrder] = useState<any>(null);
  const [dispoOrder, setDispoOrder] = useState<any>(null);
  const [messageOrder, setMessageOrder] = useState<any>(null);
  const [signatureOrder, setSignatureOrder] = useState<any>(null);
  const [pdfModalOrder, setPdfModalOrder] = useState<any>(null);
  const [pdfType, setPdfType] = useState<any>('order');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimOrder, setClaimOrder] = useState<any>(null);
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Close editing modal on mobile back button
  useModalBackHandler(isEditingCustomer, () => setIsEditingCustomer(false), 'edit-customer-modal');

  useEffect(() => {
    if (!customerId) return;

    const unsubCustomer = onSnapshot(doc(db, 'customers', customerId), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setCustomer(data);
        setEditFormData(data);
      }
      setLoading(false);
    });

    const qOrders = query(collection(db, 'orders'), where('customerId', '==', customerId));
    const unsubOrders = onSnapshot(qOrders, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setOrders(list);
    });

    const qInvoices = query(collection(db, 'invoices'), where('customerId', '==', customerId));
    const unsubInvoices = onSnapshot(qInvoices, (snap) => {
      const rawList: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const byId = new Map<string, any>();
      const byNum = new Map<string, any>();
      rawList.forEach(inv => {
        byId.set(inv.id, inv);
        if (inv.invoiceNumber && !inv.isStorno) {
          byNum.set(inv.invoiceNumber, inv);
        }
      });

      const seenStorno = new Set<string>();
      const deduped = rawList
        .filter(inv => {
          if (inv.isStorno || String(inv.invoiceNumber || '').startsWith('ST-')) {
            const key = inv.invoiceNumber || inv.id;
            if (seenStorno.has(key)) return false;
            seenStorno.add(key);
          }
          return true;
        })
        .map(inv => {
          if (!inv.isStorno) return inv;
          const orig = (inv.originalInvoiceId ? byId.get(inv.originalInvoiceId) : null) ||
            (inv.cancelsInvoiceNumber ? byNum.get(inv.cancelsInvoiceNumber) : null);
          if (!orig) return inv;
          return {
            ...inv,
            sourceOrderId: inv.sourceOrderId || orig.sourceOrderId,
            totals: inv.totals || orig.totals || orig.calcInput,
            calcInput: inv.calcInput || orig.calcInput,
            logistics: inv.logistics || orig.logistics,
            customerData: inv.customerData || orig.customerData
          };
        });

      setFreeInvoices(deduped);
    });

    return () => {
      unsubCustomer();
      unsubOrders();
      unsubInvoices();
    };
  }, [customerId]);

  useEffect(() => {
    if (action === 'view-protocol' && orders.length > 0) {
      const target = (actionOrderId ? orders.find(o => o.id === actionOrderId) : null) || orders[0];
      if (target) {
        if (target.protocols && target.protocols.length > 0) {
          setPdfType('protocol');
          setPdfModalOrder(target);
        } else {
          setProtocolOrder(target);
        }
      }
    } else if (queryPdfType && actionOrderId && (orders.length > 0 || freeInvoices.length > 0)) {
      const targetInv = freeInvoices.find(inv => inv.id === actionOrderId);
      const targetOrd = orders.find(o => o.id === actionOrderId);
      const target = targetInv || targetOrd;
      if (target) {
        setPdfType(queryPdfType);
        setPdfModalOrder(target);
      }
    }
  }, [action, actionOrderId, queryPdfType, orders, freeInvoices]);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCustomer(true);
    try {
      await updateDoc(doc(db, 'customers', customerId), {
        ...editFormData,
        updatedAt: new Date()
      });
      const editorName = profile?.displayName || profile?.email?.split('@')[0] || 'Mitarbeiter';
      const cName = `${editFormData.firstName || customer?.firstName || ''} ${editFormData.lastName || customer?.lastName || ''}`.trim() || 'Kunde';
      await logActivity(
        profile?.uid || 'unknown',
        editorName,
        'UPDATE_CUSTOMER',
        `Kundendaten für ${cName} aktualisiert`
      );
      toast.success('Kundendaten erfolgreich gespeichert!');
      triggerHaptic('success');
      setIsEditingCustomer(false);
    } catch (err: any) {
      toast.error('Fehler: ' + err.message);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  const handleViewPdf = (order: any, type: string) => {
    setPdfType(type);
    setPdfModalOrder(order);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-16 space-y-4">
        <h2 className="text-xl font-bold font-headline">Kunde nicht gefunden</h2>
        <Link href="/dashboard/customers" className="btn-primary py-2 px-6 rounded-full text-xs inline-flex">
          Zurück zur Kundenübersicht
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Breadcrumb Navigation & Mobile Back */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2 font-medium flex-wrap">
          <SmartBackButton
            fallbackHref="/dashboard/customers"
            fallbackLabel="Zurück zu Kunden"
            className="text-slate-600 dark:text-slate-400 hover:text-primary transition-colors flex items-center gap-1 font-semibold text-xs py-1 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 cursor-pointer"
          />
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">|</span>
          <Link href="/dashboard" className="hidden sm:flex hover:text-primary transition-colors items-center gap-1">
            <span className="material-symbols-outlined text-sm">dashboard</span>
            Disposition
          </Link>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">/</span>
          <Link href="/dashboard/customers" className="hidden sm:inline hover:text-primary transition-colors">
            Kunden
          </Link>
          <span className="hidden sm:inline text-slate-300 dark:text-slate-700">/</span>
          <span className="text-slate-900 dark:text-white font-bold truncate">
            {customer.firstName} {customer.lastName || customer.company}
          </span>
        </div>
      </div>

      {/* Main Modern Profile View */}
      <CustomerPremiumProfile
        customer={customer}
        orders={orders}
        invoices={freeInvoices}
        onEditCustomer={() => setIsEditingCustomer(true)}
        onOpenMessageModal={(ord) => setMessageOrder({ data: ord || orders[0], defaultTemplate: 'Allgemein' })}
        onOpenPaymentModal={(ord) => setPaymentOrder(ord || orders[0])}
        onOpenProtocolModal={(ord) => setProtocolOrder(ord || orders[0])}
        onOpenDispoModal={(ord) => setDispoOrder(ord || orders[0])}
        onOpenSignatureModal={(ord) => setSignatureOrder(ord || orders[0])}
        onOpenClaimModal={(ord) => {
          setClaimOrder(ord || orders[0] || null);
          setShowClaimModal(true);
        }}
        onViewPdf={handleViewPdf}
        onRefresh={() => router.refresh()}
      />

      {/* Edit Customer Details Modal (Bottom-Sheet on mobile, centered modal on tablet/desktop) */}
      {isEditingCustomer && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            {/* Mobile Drag Handle */}
            <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto -mt-2 mb-2 sm:hidden cursor-grab" />
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-headline font-bold text-lg text-slate-900 dark:text-white">
                Kundendaten bearbeiten
              </h3>
              <button 
                onClick={() => setIsEditingCustomer(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} noValidate className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Vorname (Optional)</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={editFormData.firstName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: sanitizeText(e.target.value, 50) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Nachname</label>
                  <input
                    type="text"
                    maxLength={50}
                    value={editFormData.lastName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: sanitizeText(e.target.value, 50) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Firma (Optional)</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={editFormData.company || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, company: sanitizeText(e.target.value, 80) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Quelle / Herkunft (Lead Source)</label>
                  <input
                    type="text"
                    maxLength={40}
                    list="leadSourcesList"
                    value={editFormData.source || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, source: sanitizeText(e.target.value, 40) })}
                    placeholder="Website, Google, Empfehlung..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                  <datalist id="leadSourcesList">
                    <option value="Website" />
                    <option value="Google / SEO" />
                    <option value="Empfehlung" />
                    <option value="Check24" />
                    <option value="Kleinanzeigen" />
                    <option value="Telefon" />
                    <option value="Direktanfrage" />
                    <option value="Sonstiges" />
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Telefon</label>
                  <input
                    type="text"
                    maxLength={35}
                    value={editFormData.phone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: sanitizeText(e.target.value, 35) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">E-Mail</label>
                  <input
                    type="email"
                    maxLength={80}
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, email: sanitizeText(e.target.value, 80).trim() })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-slate-500 uppercase block mb-1">Straße & Nr.</label>
                  <input
                    type="text"
                    maxLength={80}
                    value={editFormData.street || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, street: sanitizeText(e.target.value, 80) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">PLZ & Stadt</label>
                  <input
                    type="text"
                    maxLength={60}
                    value={editFormData.city || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, city: sanitizeText(e.target.value, 60) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditingCustomer(false)}
                  className="px-4 py-2 rounded-full font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="btn-primary py-2 px-6 rounded-full font-bold shadow-md"
                >
                  {isSavingCustomer ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action Modals */}
      {paymentOrder && (
        <PaymentManager
          order={paymentOrder}
          allOrders={orders}
          freeInvoices={freeInvoices}
          onUpdate={() => {
            router.refresh();
          }}
          onClose={() => setPaymentOrder(null)}
        />
      )}

      {protocolOrder && (
        <ProtocolModal
          order={protocolOrder}
          onClose={() => setProtocolOrder(null)}
          onSuccess={() => router.refresh()}
          onViewPdf={handleViewPdf}
        />
      )}

      {dispoOrder && (
        <DispoModal
          order={dispoOrder}
          onClose={() => setDispoOrder(null)}
        />
      )}

      {messageOrder && (
        <MessageSenderModal
          order={messageOrder.data}
          customer={customer}
          defaultTemplateName={messageOrder.defaultTemplate}
          onClose={() => setMessageOrder(null)}
        />
      )}

      {signatureOrder && (
        <SignatureModal
          order={signatureOrder}
          onClose={() => setSignatureOrder(null)}
          onSigned={async () => {
            setSignatureOrder(null);
            router.refresh();
          }}
        />
      )}

      {pdfModalOrder && (
        <PdfModal
          onClose={() => setPdfModalOrder(null)}
          order={pdfModalOrder}
          customer={customer}
          type={pdfType}
        />
      )}

      {showClaimModal && (
        <ClaimModal
          customerId={customerId}
          customerName={`${customer.firstName || ''} ${customer.lastName || customer.company || ''}`.trim()}
          orderId={claimOrder?.id}
          orderNumber={claimOrder?.orderNumber || claimOrder?.offerNumber}
          onClose={() => {
            setShowClaimModal(false);
            setClaimOrder(null);
          }}
          onSuccess={() => router.refresh()}
        />
      )}
    </div>
  );
}