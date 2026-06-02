"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { DocumentCheckIcon, DocumentTextIcon, DocumentIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const q = query(collection(db, 'orders'));
      const querySnapshot = await getDocs(q);
      const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort manually by creation date
      fetched.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setOrders(fetched);
    } catch (error) {
      console.error("Error fetching orders", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const generateInvoice = async (order: any) => {
    if (!confirm("Rechnung wirklich finalisieren? Eine feste Rechnungsnummer (RE-2026-XXXX) wird vergeben und das Dokument wird für Änderungen gesperrt.")) return;
    
    try {
      // Very basic counter approach for Phase 5 prototype
      // In production, you would use a Firestore transaction with a counter document
      const currentInvoices = orders.filter(o => o.invoiceNumber).map(o => {
        const parts = o.invoiceNumber.split('-');
        return parseInt(parts[2] || '0', 10);
      });
      const highestNumber = currentInvoices.length > 0 ? Math.max(...currentInvoices) : 0;
      const nextNumber = highestNumber + 1;
      const invoiceNumberString = `RE-2026-${nextNumber.toString().padStart(4, '0')}`;

      await updateDoc(doc(db, 'orders', order.id), {
        status: 'invoice_open',
        invoiceNumber: invoiceNumberString,
        invoiceDate: new Date()
      });
      
      fetchOrders();
    } catch (error) {
      console.error("Error generating invoice", error);
      alert("Fehler bei der Rechnungserstellung");
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      fetchOrders();
    } catch (error) {
      console.error("Fehler beim Status-Update", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'draft': return <span className="px-2 py-1 bg-structure text-text-muted rounded text-xs font-semibold uppercase tracking-wider">Entwurf</span>;
      case 'quote': return <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold uppercase tracking-wider">Angebot</span>;
      case 'invoice_open': return <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-xs font-semibold uppercase tracking-wider">Offen</span>;
      case 'invoice_paid': return <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-semibold uppercase tracking-wider">Bezahlt</span>;
      case 'invoice_overdue': return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-semibold uppercase tracking-wider">In Mahnung</span>;
      case 'canceled': return <span className="px-2 py-1 bg-red-900/30 text-red-500 rounded text-xs font-semibold uppercase tracking-wider line-through">Storniert</span>;
      default: return <span className="px-2 py-1 bg-structure text-text-muted rounded text-xs">{status}</span>;
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Aufträge & Rechnungen</h1>
        <p className="text-text-muted mt-1">Die zentrale Übersicht aller Angebote, Aufträge und finalisierten Rechnungen.</p>
      </div>

      <div className="panel border-t-4 border-t-primary shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-dark text-text-muted text-sm border-b border-structure">
                <th className="p-4 font-medium">Datum</th>
                <th className="p-4 font-medium">Nummer / Kunde</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Summe (Brutto)</th>
                <th className="p-4 font-medium text-right">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-muted italic">Keine Aufträge vorhanden.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-structure/50 hover:bg-structure/20 transition-colors">
                    <td className="p-4 text-sm text-text-muted">
                      {new Date(order.createdAt?.toMillis() || Date.now()).toLocaleDateString('de-DE')}
                    </td>
                    <td className="p-4">
                      <Link href={`/dashboard/customers/${order.customerId}`} className="hover:text-primary transition-colors">
                        <div className="font-semibold text-white">
                          {order.invoiceNumber ? order.invoiceNumber : (order.status === 'quote' ? 'Angebot' : 'Entwurf')}
                        </div>
                        <div className="text-xs text-text-muted mt-1">Kunden-ID: {order.customerId.slice(0, 8)}...</div>
                      </Link>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="p-4 text-right font-medium text-white">
                      € {order.totals?.gross?.toFixed(2) || '0.00'}
                    </td>
                    <td className="p-4 text-right flex items-center justify-end gap-2">
                      {order.status === 'quote' && (
                        <button 
                          onClick={() => generateInvoice(order)}
                          className="btn-primary py-1.5 px-3 text-xs"
                        >
                          <DocumentCheckIcon className="w-4 h-4 inline mr-1" />
                          Rechnung finalisieren
                        </button>
                      )}
                      {order.invoiceNumber && (
                        <div className="flex items-center gap-2">
                          <select 
                            value={order.status} 
                            onChange={(e) => updateStatus(order.id, e.target.value)}
                            className="bg-bg-dark border border-structure text-xs rounded px-2 py-1.5 text-text-muted focus:border-primary"
                          >
                            <option value="invoice_open">Offen</option>
                            <option value="invoice_paid">Bezahlt</option>
                            <option value="invoice_overdue">In Mahnung</option>
                            <option value="canceled">Storniert</option>
                          </select>
                          <Link href={`/dashboard/customers/${order.customerId}`} className="btn-secondary py-1.5 px-3 text-xs inline-flex items-center">
                            <DocumentIcon className="w-4 h-4 mr-1" /> PDF
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
