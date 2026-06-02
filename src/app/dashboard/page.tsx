"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function DashboardPage() {
  const { profile } = useAuth();
  
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    openItems: 0,
    overdueCount: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const q = query(collection(db, 'orders'));
        const snapshot = await getDocs(q);
        const orders = snapshot.docs.map(doc => doc.data());
        
        let revenue = 0;
        let openSum = 0;
        let overdue = 0;

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        orders.forEach((o: any) => {
          const orderDate = o.createdAt?.toDate() || new Date();
          const isCurrentMonth = orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;

          if (o.status === 'invoice_paid' && isCurrentMonth) {
            revenue += (o.totals?.gross || 0);
          }
          if (o.status === 'invoice_open' || o.status === 'invoice_overdue') {
            openSum += (o.totals?.gross || 0);
          }
          if (o.status === 'invoice_overdue') {
            overdue++;
          }
        });

        setStats({ monthlyRevenue: revenue, openItems: openSum, overdueCount: overdue });
      } catch (error) {
        console.error("Error fetching stats", error);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold tracking-tight text-white">Willkommen zurück, {profile?.firstName || 'Admin'}</h1>
      
      {profile?.role === 'admin' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="panel border-t-4 border-t-green-500">
            <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider">Bezahlt (Dieser Monat)</h3>
            <p className="text-3xl font-bold mt-2 text-green-400">€ {stats.monthlyRevenue.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="panel border-t-4 border-t-primary">
            <h3 className="text-text-muted text-sm font-semibold uppercase tracking-wider">Offene Posten</h3>
            <p className="text-3xl font-bold mt-2 text-primary">€ {stats.openItems.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="panel border-t-4 border-t-red-500 bg-red-500/5 relative overflow-hidden shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <div className="absolute -right-4 -top-4 text-red-500/10 text-9xl">!</div>
            <h3 className="text-red-400 text-sm font-bold uppercase tracking-wider relative z-10 flex items-center gap-2">
              <span className="animate-pulse">🚨</span> Kritische To-Dos
            </h3>
            <p className="text-3xl font-bold mt-2 text-red-400 relative z-10">{stats.overdueCount > 0 ? stats.overdueCount : '0'} Warnungen</p>
            <div className="mt-3 space-y-2 relative z-10">
              {stats.overdueCount > 0 ? (
                <div className="bg-bg-dark/50 border border-red-500/20 p-2 rounded text-sm text-red-300 font-medium">
                  {stats.overdueCount}x Rechnung(en) in Mahnung!
                </div>
              ) : (
                <div className="text-sm text-text-muted">Keine kritischen Mahnungen.</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="panel border-t-4 border-t-primary">
          <h2 className="text-xl font-semibold mb-4 text-primary">Mein Tag (Heutige Route)</h2>
          <div className="bg-bg-dark border border-structure rounded-lg p-6 text-center">
            <p className="text-text-muted text-lg">Keine Einsätze für heute geplant.</p>
            <p className="text-sm text-text-muted mt-2">Zeit für organisatorische Aufgaben im Lager.</p>
          </div>
        </div>
      )}
    </div>
  );
}
