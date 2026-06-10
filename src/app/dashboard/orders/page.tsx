"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc, where, Timestamp } from 'firebase/firestore';
import { DocumentCheckIcon, DocumentTextIcon, DocumentIcon, BanknotesIcon, TruckIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { PaymentManager } from '@/components/orders/PaymentManager';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { DispoModal } from '@/components/orders/DispoModal';
import { getCol } from '@/lib/demoMode';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState<any>(null);
  const [invoiceConfirmOrder, setInvoiceConfirmOrder] = useState<any>(null);
  
  // Disposition Modal State
  const [dispoOrder, setDispoOrder] = useState<any>(null);

  useEffect(() => {
    // Limit to orders from the last 30 days to save Firebase reads
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const q = query(
      collection(db, getCol('orders')),
      where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      fetched.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setOrders(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchOrders = () => {}; // No-op for PaymentManager compatibility

  const generateInvoice = async (order: any) => {
    setInvoiceConfirmOrder(order);
  };

  const confirmGenerateInvoice = async () => {
    if (!invoiceConfirmOrder) return;
    try {
      const currentInvoices = orders.filter(o => o.invoiceNumber).map(o => {
        const parts = o.invoiceNumber.split('-');
        return parseInt(parts[2] || '0', 10);
      });
      const highestNumber = currentInvoices.length > 0 ? Math.max(...currentInvoices) : 0;
      const nextNumber = highestNumber + 1;
      const prefix = `RE-${new Date().getFullYear()}-`;
      const invoiceNumberString = `${prefix}${nextNumber.toString().padStart(4, '0')}`;

      await updateDoc(doc(db, getCol('orders'), invoiceConfirmOrder.id), {
        status: 'invoice_open',
        invoiceNumber: invoiceNumberString,
        invoiceDate: new Date()
      });
      toast.success("Rechnung erfolgreich finalisiert!");
    } catch (error) {
      console.error("Error generating invoice", error);
      toast.error("Fehler bei der Rechnungserstellung");
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, getCol('orders'), orderId), { status: newStatus });
    } catch (error) {
      console.error("Fehler beim Status-Update", error);
    }
  };

  const getStatusBadge = (order: any) => {
    const status = order.status;
    
    // Check for partial payment
    if (status === 'invoice_open' && order.payments && order.payments.length > 0) {
      const totalGross = order.totals?.gross || 0;
      const totalPaid = order.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
      if (totalPaid > 0 && totalPaid < totalGross) {
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs font-semibold uppercase tracking-wider">Teilweise bezahlt</span>;
      }
    }

    switch(status) {
      case 'draft': return <span className="px-2 py-1 bg-structure text-text-muted rounded text-xs font-semibold uppercase tracking-wider">Entwurf</span>;
      case 'clarification': return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs font-semibold uppercase tracking-wider">In Klärung</span>;
      case 'quote': return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold uppercase tracking-wider">Angebot</span>;
      case 'confirmed': return <span className="px-2 py-1 bg-primary/20 text-primary rounded text-xs font-semibold uppercase tracking-wider">Bestätigt (Aktiv)</span>;
      case 'invoice_open': return <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-semibold uppercase tracking-wider">Offen</span>;
      case 'invoice_paid': return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold uppercase tracking-wider">Bezahlt</span>;
      case 'invoice_overdue': return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-semibold uppercase tracking-wider">In Mahnung</span>;
      case 'canceled': return <span className="px-2 py-1 bg-red-900/30 text-red-500 rounded text-xs font-semibold uppercase tracking-wider line-through">Storniert</span>;
      case 'rejected': return <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded text-xs font-semibold uppercase tracking-wider line-through">Abgelehnt</span>;
      default: return <span className="px-2 py-1 bg-structure text-text-muted rounded text-xs">{status}</span>;
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-main">Aufträge & Disposition</h1>
        <p className="text-text-muted mt-1">Verwalten Sie Angebote, teilen Sie Fahrzeuge/Mitarbeiter ein und erstellen Sie Rechnungen.</p>
      </div>

      <div className="panel border-t-4 border-t-primary shadow-xl overflow-hidden">
        <div className="overflow-x-hidden md:overflow-x-auto">
          <table className="w-full text-left border-collapse block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-bg-dark text-text-muted text-sm border-b border-structure md:table-row">
                <th className="p-4 font-medium md:table-cell">Datum</th>
                <th className="p-4 font-medium md:table-cell">Nummer / Kunde / Details</th>
                <th className="p-4 font-medium md:table-cell">Status</th>
                <th className="p-4 font-medium md:text-right md:table-cell">Summe (Brutto)</th>
                <th className="p-4 font-medium md:text-right md:table-cell">Aktion</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-muted italic">Keine Aufträge vorhanden.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="block md:table-row border-b border-structure/50 hover:bg-structure/20 transition-colors p-4 md:p-0 mb-4 md:mb-0 bg-bg-dark md:bg-transparent rounded-lg md:rounded-none">
                    <td className="block md:table-cell p-2 md:p-4 text-sm text-text-muted border-b border-structure md:border-none">
                      <span className="md:hidden font-semibold text-text-main mr-2">Datum:</span>
                      {new Date(order.createdAt?.toMillis() || Date.now()).toLocaleDateString('de-DE')}
                    </td>
                    <td className="block md:table-cell p-2 md:p-4 border-b border-structure md:border-none">
                      <Link href={`/dashboard/customers/${order.customerId}`} className="hover:text-primary transition-colors flex flex-col md:block items-start md:items-stretch">
                        <div className="font-semibold text-text-main">
                          {order.invoiceNumber ? order.invoiceNumber : (order.orderNumber || (order.status === 'quote' ? 'Angebot' : 'Entwurf'))}
                        </div>
                        <div className="text-sm text-text-main mt-1">{order.customerName || `Kunde ID: ${order.customerId.slice(0, 8)}...`}</div>
                        {(order.logistics?.a_city || order.logistics?.b_city || order.orderMeta?.movingDateFrom) && (
                          <div className="text-xs text-text-muted mt-1 space-y-0.5">
                            {(order.logistics?.a_city || order.logistics?.b_city) && (
                              <div className="flex items-center gap-1">
                                {order.logistics?.a_city || '?'} &rarr; {order.logistics?.b_city || '?'}
                              </div>
                            )}
                            {order.orderMeta?.movingDateFrom && (
                              <div>Umzug: {new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE')}</div>
                            )}
                          </div>
                        )}
                      </Link>
                    </td>
                    <td className="block md:table-cell p-2 md:p-4 border-b border-structure md:border-none">
                      <div className="flex items-center gap-2 justify-between md:justify-start">
                        <span className="md:hidden text-text-muted text-sm">Status:</span>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(order)}
                          {order.payments && order.payments.length > 0 && (
                            <span className="text-xs text-text-muted bg-structure/50 px-2 py-0.5 rounded-full border border-structure flex items-center gap-1">
                              <BanknotesIcon className="w-3 h-3" />
                              {order.payments.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="block md:table-cell p-2 md:p-4 md:text-right font-medium text-text-main border-b border-structure md:border-none">
                      <div className="flex flex-col md:items-end gap-1">
                        <div className="flex justify-between md:justify-end w-full">
                          <span className="md:hidden text-text-muted text-sm">Summe:</span>
                          <span>€ {order.totals?.gross?.toFixed(2) || '0.00'}</span>
                        </div>
                        {order.payments && order.payments.length > 0 && order.status !== 'invoice_paid' && (
                          <div className="text-xs text-primary font-bold">
                            Offen: € {Math.max(0, (order.totals?.gross || 0) - order.payments.reduce((sum: number, p: any) => sum + p.amount, 0)).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="block md:table-cell p-2 md:p-4 md:text-right mt-2 md:mt-0">
                      <div className="flex flex-col sm:flex-row items-stretch md:items-center justify-end gap-2 w-full">
                        
                        {order.status === 'quote' && (
                          <button 
                            onClick={() => setDispoOrder(order)}
                            className="btn-primary py-2 px-3 text-xs w-full sm:w-auto flex justify-center"
                          >
                            <TruckIcon className="w-4 h-4 mr-1" />
                            Bestätigen & Disponieren
                          </button>
                        )}
                        
                        {order.status === 'confirmed' && (
                          <button 
                            onClick={() => generateInvoice(order)}
                            className="btn-secondary border-primary/50 text-primary py-2 px-3 text-xs w-full sm:w-auto flex justify-center"
                          >
                            <DocumentCheckIcon className="w-4 h-4 mr-1" />
                            Finalisieren (Rechnung)
                          </button>
                        )}

                        {order.invoiceNumber && (
                          <div className="flex flex-col sm:flex-row items-stretch md:items-center gap-2 w-full sm:w-auto">
                            <select 
                              value={order.status} 
                              onChange={(e) => updateStatus(order.id, e.target.value)}
                              className="bg-bg-dark border border-structure text-xs rounded px-2 py-2 text-text-muted focus:border-primary w-full sm:w-auto"
                            >
                              <option value="invoice_open">Offen</option>
                              <option value="invoice_paid">Bezahlt</option>
                              <option value="invoice_overdue">In Mahnung</option>
                              <option value="canceled">Storniert</option>
                            </select>
                            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                              <button 
                                onClick={() => setSelectedPaymentOrder(order)}
                                className="btn-secondary py-2 px-3 text-xs flex-1 sm:flex-none flex justify-center items-center"
                                title="Zahlungen"
                              >
                                <BanknotesIcon className="w-4 h-4 mr-1" /> Zahlungen
                              </button>
                              <Link href={`/dashboard/customers/${order.customerId}`} className="btn-secondary py-2 px-3 text-xs flex-1 sm:flex-none flex justify-center items-center">
                                <DocumentIcon className="w-4 h-4 mr-1" /> PDF
                              </Link>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {dispoOrder && (
        <DispoModal 
          order={dispoOrder} 
          onClose={() => setDispoOrder(null)} 
        />
      )}

      {selectedPaymentOrder && (
        <PaymentManager 
          order={selectedPaymentOrder} 
          onUpdate={fetchOrders} 
          onClose={() => setSelectedPaymentOrder(null)} 
        />
      )}

      <ConfirmModal 
        isOpen={invoiceConfirmOrder !== null}
        title="Rechnung finalisieren"
        message="Möchten Sie dieses Dokument wirklich finalisieren? Es wird eine feste Rechnungsnummer (RE-2026-XXXX) vergeben und das Dokument wird für Änderungen gesperrt."
        confirmText="Finalisieren"
        isDestructive={false}
        onConfirm={confirmGenerateInvoice}
        onCancel={() => setInvoiceConfirmOrder(null)}
      />
    </div>
  );
}
