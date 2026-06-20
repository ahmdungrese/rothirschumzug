"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, Timestamp, where } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { ChartBarIcon, CurrencyEuroIcon, UsersIcon, CursorArrowRaysIcon } from '@heroicons/react/24/outline';
import { MonthlyExportPanel } from '@/components/finances/MonthlyExportPanel';

const COLORS = ['#e11d48', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function StatisticsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Marketing Data
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  
  // Team Data
  const [teamActivity, setTeamActivity] = useState<any[]>([]);
  
  // High-Level KPIs
  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    topSource: '',
    topEmployee: ''
  });

  useEffect(() => {
    // Only Admin is allowed to load these stats
    if (profile?.role !== 'admin') {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        // --- 1. Fetch Orders (for Revenue & Sources) ---
        const ordersSnap = await getDocs(collection(db, 'orders'));
        const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        let totalRev = 0;
        let confirmedOrdersCount = 0;
        
        // Group by source
        const sourceMap: Record<string, { count: number, revenue: number }> = {};
        
        // Group by month
        const monthMap: Record<string, number> = {};

        orders.forEach((o: any) => {
          // Nur bestätigte Aufträge / Rechnungen betrachten
          if (!['confirmed', 'completed', 'invoice_open', 'invoice_overdue', 'invoice_paid'].includes(o.status)) return;
          
          confirmedOrdersCount++;
          const rev = o.totals?.gross || 0;
          totalRev += rev;

          // Source Analysis (Using orderMeta.source or fallback to "Unbekannt")
          // If orders don't have source, we might need to look at customer.source, but let's assume it's in orderMeta or we use "Unbekannt"
          const source = o.orderMeta?.source || o.customerSource || 'Unbekannt';
          if (!sourceMap[source]) sourceMap[source] = { count: 0, revenue: 0 };
          sourceMap[source].count += 1;
          sourceMap[source].revenue += rev;

          // Monthly Revenue Analysis
          const date = o.createdAt?.toDate() || new Date();
          const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!monthMap[monthYear]) monthMap[monthYear] = 0;
          monthMap[monthYear] += rev;
        });

        // Format Source Data for PieChart
        const formattedSourceData = Object.keys(sourceMap)
          .map(key => ({
            name: key,
            value: sourceMap[key].revenue,
            count: sourceMap[key].count
          }))
          .sort((a, b) => b.value - a.value);

        // Format Monthly Data for BarChart (Sort by date)
        const formattedRevenueData = Object.keys(monthMap)
          .sort()
          .slice(-6) // Last 6 months
          .map(key => {
            const [y, m] = key.split('-');
            const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
            return {
              name: `${monthNames[parseInt(m)-1]} ${y.substring(2)}`,
              Umsatz: monthMap[key]
            };
          });

        const topSource = formattedSourceData.length > 0 ? formattedSourceData[0].name : '-';

        // --- 2. Fetch Activity Logs (for Team Performance) ---
        // We look at the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const actQuery = query(collection(db, 'activity_logs'), where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)));
        const actSnap = await getDocs(actQuery);
        
        const employeeMap: Record<string, { creations: number, orders: number }> = {};
        
        actSnap.docs.forEach(doc => {
          const d = doc.data();
          const emp = d.userName || 'Unbekannt';
          if (!employeeMap[emp]) employeeMap[emp] = { creations: 0, orders: 0 };
          
          if (d.action === 'CREATE_CUSTOMER') employeeMap[emp].creations += 1;
          if (d.action === 'CREATE_ORDER') employeeMap[emp].orders += 1;
        });

        const formattedTeamData = Object.keys(employeeMap)
          .map(key => ({
            name: key,
            Neukunden: employeeMap[key].creations,
            Angebote: employeeMap[key].orders
          }))
          .sort((a, b) => (b.Neukunden + b.Angebote) - (a.Neukunden + a.Angebote));

        const topEmployee = formattedTeamData.length > 0 ? formattedTeamData[0].name : '-';

        // Update State
        setSourceData(formattedSourceData);
        setRevenueData(formattedRevenueData);
        setTeamActivity(formattedTeamData);
        setKpis({
          totalRevenue: totalRev,
          totalOrders: confirmedOrdersCount,
          topSource,
          topEmployee
        });
        
        setLoading(false);
      } catch (error) {
        console.error("Fehler beim Laden der Statistiken", error);
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile]);

  if (loading) {
    return (
      <div className="flex justify-center p-20">
        <div className="animate-spin h-10 w-10 border-t-2 border-primary rounded-full"></div>
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <ChartBarIcon className="w-20 h-20 text-structure mb-4" />
        <h1 className="text-2xl font-bold text-text-main mb-2">Zugriff verweigert</h1>
        <p className="text-text-muted">Nur Administratoren haben Zugriff auf die Unternehmens-Auswertungen.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-dark border border-structure p-3 rounded-lg shadow-xl">
          <p className="font-bold text-text-main">{label || payload[0].name}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} style={{ color: p.color || p.fill }}>
              {p.name}: {p.name.includes('Umsatz') || p.name.includes('value') ? `€ ${p.value.toLocaleString('de-DE', {minimumFractionDigits: 2})}` : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <section>
        <h1 className="text-3xl font-bold tracking-tight text-text-main flex items-center gap-3">
          <ChartBarIcon className="w-8 h-8 text-primary" /> Unternehmens-Auswertungen
        </h1>
        <p className="text-text-muted mt-1">Live-Analyse aus deinen Echtzeit-Daten (Gesamtzeitraum / Letzte 30 Tage).</p>
      </section>

      <MonthlyExportPanel />

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-bg-panel border border-structure rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-green-500/10 rounded-bl-full flex items-start justify-end p-3 transition-transform group-hover:scale-110">
            <CurrencyEuroIcon className="w-6 h-6 text-green-500" />
          </div>
          <h3 className="text-text-muted text-xs font-bold uppercase tracking-wider mb-2">Gesamtumsatz (System)</h3>
          <p className="text-3xl font-bold text-text-main">€ {(kpis.totalRevenue / 1000).toFixed(1)}k</p>
        </div>

        <div className="bg-bg-panel border border-structure rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-blue-500/10 rounded-bl-full flex items-start justify-end p-3 transition-transform group-hover:scale-110">
            <ChartBarIcon className="w-6 h-6 text-blue-500" />
          </div>
          <h3 className="text-text-muted text-xs font-bold uppercase tracking-wider mb-2">Umzüge / Aufträge</h3>
          <p className="text-3xl font-bold text-text-main">{kpis.totalOrders}</p>
        </div>

        <div className="bg-bg-panel border border-structure rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-orange-500/10 rounded-bl-full flex items-start justify-end p-3 transition-transform group-hover:scale-110">
            <CursorArrowRaysIcon className="w-6 h-6 text-orange-500" />
          </div>
          <h3 className="text-text-muted text-xs font-bold uppercase tracking-wider mb-2">Beste Lead-Quelle</h3>
          <p className="text-2xl font-bold text-text-main truncate">{kpis.topSource}</p>
        </div>

        <div className="bg-bg-panel border border-structure rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute right-0 top-0 w-16 h-16 bg-purple-500/10 rounded-bl-full flex items-start justify-end p-3 transition-transform group-hover:scale-110">
            <UsersIcon className="w-6 h-6 text-purple-500" />
          </div>
          <h3 className="text-text-muted text-xs font-bold uppercase tracking-wider mb-2">Aktivster Mitarbeiter</h3>
          <p className="text-2xl font-bold text-text-main truncate">{kpis.topEmployee}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CHART 1: Umsatz-Entwicklung */}
        <section className="bg-bg-panel border border-structure rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-text-main mb-6">Umsatz-Entwicklung (Letzte 6 Monate)</h2>
          <div className="h-[300px] w-full">
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={12} tickMargin={10} />
                  <YAxis stroke="#888" fontSize={12} tickFormatter={(val) => `€${val/1000}k`} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#222'}} />
                  <Bar dataKey="Umsatz" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-text-muted">Noch nicht genug Daten vorhanden.</div>
            )}
          </div>
        </section>

        {/* CHART 2: Lead-Quellen */}
        <section className="bg-bg-panel border border-structure rounded-xl p-6 shadow-xl">
          <h2 className="text-xl font-bold text-text-main mb-6">Umsatz nach Herkunft (Marketing)</h2>
          <div className="h-[300px] w-full flex items-center">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full w-full text-text-muted">Keine Lead-Daten erfasst.</div>
            )}
          </div>
        </section>

        {/* CHART 3: Team Performance */}
        <section className="bg-bg-panel border border-structure rounded-xl p-6 shadow-xl lg:col-span-2">
          <h2 className="text-xl font-bold text-text-main mb-6">Mitarbeiter-Aktivität (Letzte 30 Tage)</h2>
          <div className="h-[300px] w-full">
            {teamActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#888" fontSize={12} />
                  <YAxis dataKey="name" type="category" stroke="#888" fontSize={12} width={100} />
                  <RechartsTooltip content={<CustomTooltip />} cursor={{fill: '#222'}} />
                  <Legend wrapperStyle={{ fontSize: '12px' }}/>
                  <Bar dataKey="Neukunden" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Angebote" stackId="a" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-text-muted">Keine Mitarbeiter-Aktivitäten aufgezeichnet.</div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
