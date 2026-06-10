"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { ArchiveBoxIcon, ArrowUturnLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { getCol } from '@/lib/demoMode';

export default function ArchivePage() {
  const [archivedCustomers, setArchivedCustomers] = useState<any[]>([]);
  const [archivedOrders, setArchivedOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'customers' | 'orders'>('customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{collectionName: string, id: string} | null>(null);

  useEffect(() => {
    // Fetch archived customers
    const qCust = query(collection(db, getCol('customers')), where('isArchived', '==', true));
    const unsubCust = onSnapshot(qCust, (snapshot) => {
      setArchivedCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch archived orders
    const qOrd = query(collection(db, getCol('orders')), where('status', '==', 'archived'));
    const unsubOrd = onSnapshot(qOrd, (snapshot) => {
      setArchivedOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubCust();
      unsubOrd();
    };
  }, []);

  const handleRestore = async (collectionName: string, id: string) => {
    try {
      if (collectionName === 'customers') {
        await updateDoc(doc(db, collectionName, id), { isArchived: false });
      } else {
        await updateDoc(doc(db, collectionName, id), { status: 'draft' });
      }
      toast.success("Erfolgreich wiederhergestellt!");
    } catch (error) {
      console.error("Fehler beim Wiederherstellen", error);
      toast.error("Fehler beim Wiederherstellen");
    }
  };

  const handleDelete = async (collectionName: string, id: string) => {
    setDeleteConfirmTarget({ collectionName, id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    try {
      await deleteDoc(doc(db, deleteConfirmTarget.collectionName, deleteConfirmTarget.id));
      toast.success("Endgültig gelöscht!");
    } catch (error) {
      console.error("Fehler beim Löschen", error);
      toast.error("Fehler beim Löschen");
    }
  };

  const filteredCustomers = archivedCustomers.filter(c => 
    c.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.lastName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOrders = archivedOrders.filter(o => 
    o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.orderNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-panel border border-structure p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-main flex items-center gap-3">
            <ArchiveBoxIcon className="w-8 h-8 text-text-muted" /> Archiv
          </h1>
          <p className="text-text-muted mt-1">Gelöschte Daten verwalten (Wiederherstellen oder endgültig löschen).</p>
        </div>
        <div className="w-full md:w-auto">
          <input 
            type="text" 
            placeholder="Suchen..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field w-full md:w-64"
          />
        </div>
      </div>

      <div className="flex gap-4 border-b border-structure pb-4">
        <button 
          onClick={() => setActiveTab('customers')} 
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'customers' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-bg-dark text-text-muted hover:text-text-main border border-structure'}`}
        >
          Kunden ({archivedCustomers.length})
        </button>
        <button 
          onClick={() => setActiveTab('orders')} 
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'orders' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-bg-dark text-text-muted hover:text-text-main border border-structure'}`}
        >
          Angebote/Aufträge ({archivedOrders.length})
        </button>
      </div>

      <div className="panel min-h-[500px]">
        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>
        ) : (
          <div className="overflow-x-auto">
            {activeTab === 'customers' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-dark text-text-muted text-sm border-b border-structure">
                    <th className="p-4 font-medium">Kundennr.</th>
                    <th className="p-4 font-medium">Name</th>
                    <th className="p-4 font-medium">Stadt</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-text-muted italic">Keine archivierten Kunden gefunden.</td></tr>
                  ) : (
                    filteredCustomers.map(customer => (
                      <tr key={customer.id} className="border-b border-structure/50 hover:bg-structure/20 transition-colors">
                        <td className="p-4 text-text-muted text-sm">{customer.customerNumber || '-'}</td>
                        <td className="p-4 font-semibold text-text-main">{customer.firstName} {customer.lastName}</td>
                        <td className="p-4 text-text-muted">{customer.billingAddress?.city || '-'}</td>
                        <td className="p-4"><span className="bg-structure text-text-muted text-xs px-2 py-1 rounded">Archiviert</span></td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleRestore('customers', customer.id)} className="btn-secondary text-sm border-green-500/30 text-green-400 hover:bg-green-500/10">
                              <ArrowUturnLeftIcon className="w-4 h-4 mr-1" /> Restore
                            </button>
                            <button onClick={() => handleDelete('customers', customer.id)} className="btn-secondary text-sm border-red-500/30 text-red-400 hover:bg-red-500/10">
                              <TrashIcon className="w-4 h-4 mr-1" /> Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'orders' && (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg-dark text-text-muted text-sm border-b border-structure">
                    <th className="p-4 font-medium">Angebotsnr.</th>
                    <th className="p-4 font-medium">Kunde</th>
                    <th className="p-4 font-medium">Betrag</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-text-muted italic">Keine archivierten Angebote gefunden.</td></tr>
                  ) : (
                    filteredOrders.map(order => (
                      <tr key={order.id} className="border-b border-structure/50 hover:bg-structure/20 transition-colors">
                        <td className="p-4 text-text-muted text-sm">{order.orderNumber || '-'}</td>
                        <td className="p-4 font-semibold text-text-main">{order.customerName || 'Unbekannt'}</td>
                        <td className="p-4 text-text-main font-medium">€ {order.totals?.gross?.toFixed(2) || '0.00'}</td>
                        <td className="p-4"><span className="bg-structure text-text-muted text-xs px-2 py-1 rounded">Archiviert</span></td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => handleRestore('orders', order.id)} className="btn-secondary text-sm border-green-500/30 text-green-400 hover:bg-green-500/10">
                              <ArrowUturnLeftIcon className="w-4 h-4 mr-1" /> Restore
                            </button>
                            <button onClick={() => handleDelete('orders', order.id)} className="btn-secondary text-sm border-red-500/30 text-red-400 hover:bg-red-500/10">
                              <TrashIcon className="w-4 h-4 mr-1" /> Löschen
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <ConfirmModal 
        isOpen={deleteConfirmTarget !== null}
        title="Endgültig löschen"
        message="Möchten Sie dieses Element wirklich endgültig aus dem System löschen? Dieser Schritt kann nicht rückgängig gemacht werden!"
        confirmText="Endgültig löschen"
        isDestructive={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmTarget(null)}
      />
    </div>
  );
}
