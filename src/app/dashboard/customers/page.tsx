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
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Kunden</h1>
          <p className="text-text-muted mt-1">Verwalten Sie hier alle Kunden.</p>
        </div>
      </div>

      <div className="panel border-t-4 border-t-primary shadow-xl overflow-hidden">
        <div className="overflow-x-hidden md:overflow-x-auto">
          <table className="w-full text-left border-collapse block md:table">
            <thead className="hidden md:table-header-group">
              <tr className="bg-bg-dark text-text-muted text-sm border-b border-structure md:table-row">
                <th className="p-4 font-medium md:table-cell">Name</th>
                <th className="p-4 font-medium md:table-cell">Email</th>
                <th className="p-4 font-medium md:table-cell">Telefon</th>
                <th className="p-4 font-medium md:text-right md:table-cell">Aktion</th>
              </tr>
            </thead>
            <tbody className="block md:table-row-group">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-text-muted italic">Keine Kunden gefunden oder Datenbank noch nicht konfiguriert.</td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="block md:table-row border-b border-structure/50 hover:bg-structure/20 transition-colors p-4 md:p-0 mb-4 md:mb-0 bg-bg-dark md:bg-transparent rounded-lg md:rounded-none">
                    <td className="block md:table-cell p-2 md:p-4 text-sm text-white font-medium border-b border-structure md:border-none">
                      {customer.firstName} {customer.lastName}
                    </td>
                    <td className="block md:table-cell p-2 md:p-4 text-sm text-text-muted border-b border-structure md:border-none">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-text-muted">E-Mail:</span>
                        <span>{customer.email || '-'}</span>
                      </div>
                    </td>
                    <td className="block md:table-cell p-2 md:p-4 text-sm text-text-muted border-b border-structure md:border-none">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-text-muted">Telefon:</span>
                        <span>{customer.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="block md:table-cell p-2 md:p-4 md:text-right mt-2 md:mt-0">
                      <Link href={`/dashboard/customers/${customer.id}`} className="btn-secondary py-2 px-3 text-sm w-full md:w-auto flex justify-center">
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
