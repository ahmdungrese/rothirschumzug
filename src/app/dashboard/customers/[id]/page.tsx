"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

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
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

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
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFreeInvoices(list);
    });

    return () => {
      unsubCustomer();
      unsubOrders();
      unsubInvoices();
    };
  }, [customerId]);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCustomer(true);
    try {
      await updateDoc(doc(db, 'customers', customerId), {
        ...editFormData,
        updatedAt: new Date()
      });
      toast.success('Kundendaten erfolgreich gespeichert!');
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
      {/* Breadcrumb Navigation */}
      <div className="mb-6 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2 font-medium">
          <Link href="/dashboard" className="hover:text-primary transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">dashboard</span>
            Disposition
          </Link>
          <span>/</span>
          <Link href="/dashboard/customers" className="hover:text-primary transition-colors">
            Kunden
          </Link>
          <span>/</span>
          <span className="text-slate-900 dark:text-white font-bold">
            {customer.firstName} {customer.lastName || customer.company}
          </span>
        </div>
      </div>

      {/* Main Modern Profile View */}
      <CustomerPremiumProfile
        customer={customer}
        orders={orders}
        onEditCustomer={() => setIsEditingCustomer(true)}
        onOpenMessageModal={(ord) => setMessageOrder({ data: ord || orders[0], defaultTemplate: 'Allgemein' })}
        onOpenPaymentModal={(ord) => setPaymentOrder(ord || orders[0])}
        onOpenProtocolModal={(ord) => setProtocolOrder(ord || orders[0])}
        onOpenDispoModal={(ord) => setDispoOrder(ord || orders[0])}
        onOpenSignatureModal={(ord) => setSignatureOrder(ord || orders[0])}
        onViewPdf={handleViewPdf}
      />

      {/* Edit Customer Details Modal */}
      {isEditingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
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

            <form onSubmit={handleSaveCustomer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Vorname</label>
                  <input
                    type="text"
                    value={editFormData.firstName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Nachname</label>
                  <input
                    type="text"
                    value={editFormData.lastName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-500 uppercase block mb-1">Firma (Optional)</label>
                <input
                  type="text"
                  value={editFormData.company || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, company: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">Telefon</label>
                  <input
                    type="text"
                    value={editFormData.phone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="font-bold text-slate-500 uppercase block mb-1">Straße & Nr.</label>
                  <input
                    type="text"
                    value={editFormData.street || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, street: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border-none font-medium"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-500 uppercase block mb-1">PLZ & Stadt</label>
                  <input
                    type="text"
                    value={editFormData.city || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
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
          onUpdate={() => {}}
          onClose={() => setPaymentOrder(null)}
        />
      )}

      {protocolOrder && (
        <ProtocolModal
          order={protocolOrder}
          onClose={() => setProtocolOrder(null)}
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
          onSigned={() => setSignatureOrder(null)}
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
          customerName={`${customer.firstName} ${customer.lastName}`}
          onClose={() => setShowClaimModal(false)}
        />
      )}
    </div>
  );
}