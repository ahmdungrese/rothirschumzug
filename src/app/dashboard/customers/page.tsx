"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, getCol('customers')));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .filter((c: any) => !c.isArchived); // Filter out archived
      setCustomers(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching customers", error);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto relative">
      {/* Background Graphic */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-[-1] overflow-hidden">
        <img src="/login-logo.png" alt="" className="w-full max-w-[800px] object-contain blur-[2px]" />
      </div>

      <div className="flex justify-between items-center glass-panel p-6 rounded-2xl mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-main flex items-center gap-3">
            Kundenverzeichnis
          </h1>
          <p className="text-text-muted mt-1">Verwalten Sie hier alle Ihre Kunden und deren Akten.</p>
        </div>
      </div>

      <div className="glass-panel p-0 overflow-hidden rounded-2xl shadow-xl">
        <div className="overflow-x-hidden md:overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-black/20 text-text-muted text-xs uppercase tracking-wider border-b border-white/10 md:table-row">
                <th className="p-5 font-bold md:table-cell">Name</th>
                <th className="p-5 font-bold md:table-cell">E-Mail</th>
                <th className="p-5 font-bold md:table-cell">Telefon</th>
                <th className="p-5 font-bold md:text-right md:table-cell">Aktion</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-text-muted italic bg-black/10">Keine Kunden gefunden oder Datenbank noch nicht konfiguriert.</td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="block md:table-row border-b border-white/5 hover:bg-white/[0.03] transition-colors p-4 md:p-0 mb-4 md:mb-0 bg-black/20 md:bg-transparent rounded-lg md:rounded-none">
                    <td className="block md:table-cell p-3 md:p-5 text-sm text-text-main font-bold border-b border-white/5 md:border-none">
                      {customer.firstName} {customer.lastName}
                    </td>
                    <td className="block md:table-cell p-3 md:p-5 text-sm text-text-muted border-b border-white/5 md:border-none">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-text-muted font-bold text-xs uppercase tracking-wider">E-Mail:</span>
                        <span>{customer.email || '-'}</span>
                      </div>
                    </td>
                    <td className="block md:table-cell p-3 md:p-5 text-sm text-text-muted border-b border-white/5 md:border-none">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-text-muted font-bold text-xs uppercase tracking-wider">Telefon:</span>
                        <span>{customer.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="block md:table-cell p-3 md:p-5 md:text-right mt-2 md:mt-0">
                      <Link href={`/dashboard/customers/${customer.id}`} className="btn-secondary py-2 px-4 text-sm w-full md:w-auto flex justify-center shadow-sm">
                        Akte öffnen
                      </Link>
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
