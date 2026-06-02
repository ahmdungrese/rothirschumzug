"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';

export default function FinancesPage() {
  const [stats, setStats] = useState({ revenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFinances = async () => {
      try {
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => resolve({ _isTimeout: true }), 1000)
        );
        const q = query(collection(db, 'orders'));
        const queryPromise = getDocs(q);
        queryPromise.catch(() => {});
        
        const snapshot = await Promise.race([
          queryPromise,
          timeoutPromise
        ]) as any;
        
        if (snapshot && snapshot._isTimeout) {
          throw new Error("Firestore timeout");
        }
        
        let revenue = 0;
        snapshot.docs.forEach((doc: any) => {
          const data = doc.data();
          if (data.status === 'invoice_paid') {
            revenue += data.totals?.gross || 0;
          }
        });
        setStats({ revenue });
      } catch (error: any) {
        if (error.message !== "Firestore timeout") {
          console.error("Error fetching finances", error);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchFinances();
  }, []);

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl">
      <h1 className="text-2xl font-bold tracking-tight text-white">Finanzen</h1>
      <div className="panel border-t-4 border-t-green-500">
        <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider">Gesamtumsatz (Bezahlt)</h3>
        <p className="text-3xl font-bold mt-2 text-green-400">€ {stats.revenue.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
      </div>
    </div>
  );
}
