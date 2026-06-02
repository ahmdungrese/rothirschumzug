"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { TimeTracker } from '@/components/dashboard/TimeTracker';

export default function DashboardPage() {
  const { profile } = useAuth();
  
  const [stats, setStats] = useState({
    monthlyRevenue: 0,
    openItems: 0,
    overdueCount: 0
  });
  
  const [activeTodos, setActiveTodos] = useState<any[]>([]);

  useEffect(() => {
    // Limit to orders from the last 30 days to save Firebase reads
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', Timestamp.fromDate(thirtyDaysAgo))
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map((doc: any) => doc.data());
      
      let revenue = 0;
      let openSum = 0;
      let overdue = 0;

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      orders.forEach((o: any) => {
        const orderDate = o.createdAt?.toDate() || new Date();
        const isCurrentMonth = orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;
        
        const totalGross = o.totals?.gross || 0;
        let totalPaid = 0;
        
        if (o.payments && Array.isArray(o.payments)) {
          o.payments.forEach((p: any) => {
            const pDate = p.date?.toDate() || new Date();
            if (pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear) {
              revenue += p.amount;
            }
            totalPaid += p.amount;
          });
        } else if (o.status === 'invoice_paid' && isCurrentMonth) {
          revenue += totalGross;
          totalPaid = totalGross;
        }

        const remaining = Math.max(0, totalGross - totalPaid);

        if ((o.status === 'invoice_open' || o.status === 'invoice_overdue') && remaining > 0) {
          openSum += remaining;
        }
        if (o.status === 'invoice_overdue') {
          overdue++;
        }
      });

      setStats({ monthlyRevenue: revenue, openItems: openSum, overdueCount: overdue });
    }, (error) => {
      console.error("Error fetching stats", error);
    });

    // Fetch active Todos from confirmed orders
    const qTodos = query(
      collection(db, 'orders'),
      where('status', '==', 'confirmed')
    );
    const unsubTodos = onSnapshot(qTodos, (snapshot) => {
      let extractedTodos: any[] = [];
      snapshot.docs.forEach(docSnap => {
        const o = docSnap.data();
        if (o.todos && Array.isArray(o.todos)) {
          o.todos.forEach(t => {
            if (!t.isDone) {
              extractedTodos.push({ ...t, orderId: docSnap.id, customerId: o.customerId });
            }
          });
        }
      });
      setActiveTodos(extractedTodos);
    });

    return () => { unsubscribe(); unsubTodos(); };
  }, []);

  const markTodoDone = async (todo: any) => {
    try {
      const orderRef = doc(db, 'orders', todo.orderId);
      // We need to fetch the current order to modify the specific todo inside the array
      // Since it's a demo, we can just let it be or do a quick transaction
      import('firebase/firestore').then(({ getDoc, updateDoc }) => {
        getDoc(orderRef).then(docSnap => {
           if(docSnap.exists()) {
             const data = docSnap.data();
             const newTodos = data.todos.map((t:any) => t.id === todo.id ? {...t, isDone: true} : t);
             updateDoc(orderRef, { todos: newTodos });
           }
        });
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold tracking-tight text-white">Willkommen zurück, {profile?.displayName || 'Admin'}</h1>
      
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
      ) : null}

      {profile?.role === 'admin' && (
        <div className="panel border-t-4 border-t-orange-500 shadow-xl mb-8">
          <h2 className="text-xl font-semibold mb-4 text-orange-400 flex items-center gap-2">
            📋 Anstehende Vorbereitungen (Automatisierte To-Dos)
          </h2>
          {activeTodos.length === 0 ? (
            <div className="text-text-muted text-sm italic p-4 bg-bg-dark rounded-xl border border-structure">
              Aktuell keine offenen Automatisierungs-Aufgaben für bestätigte Aufträge.
            </div>
          ) : (
            <div className="space-y-2">
              {activeTodos.map(todo => (
                <div key={todo.id} className="flex items-center justify-between p-3 bg-bg-dark rounded-xl border border-structure hover:border-orange-500/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <button onClick={() => markTodoDone(todo)} className="w-5 h-5 rounded-full border-2 border-orange-500 hover:bg-orange-500/20 transition-colors" title="Erledigt" />
                    <span className="font-medium text-white">{todo.title}</span>
                  </div>
                  <button onClick={() => window.location.href = `/dashboard/customers/${todo.customerId}`} className="text-xs text-orange-400 hover:text-orange-300 bg-orange-500/10 px-2 py-1 rounded">
                    Zum Auftrag
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {profile?.role !== 'admin' && (
        <div className="space-y-6">
          <TimeTracker />
          
          <div className="panel border-t-4 border-t-primary">
            <h2 className="text-xl font-semibold mb-4 text-primary">Mein Tag (Heutige Route)</h2>
            <div className="bg-bg-dark border border-structure rounded-lg p-6 text-center">
              <p className="text-text-muted text-lg">Keine Einsätze für heute geplant.</p>
              <p className="text-sm text-text-muted mt-2">Zeit für organisatorische Aufgaben im Lager.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
