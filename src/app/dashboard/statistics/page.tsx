"use client";

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, Timestamp, where } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { 
  ChartBarIcon, 
  CurrencyEuroIcon, 
  UsersIcon, 
  CursorArrowRaysIcon,
  TrophyIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline';
import { MonthlyExportPanel } from '@/components/finances/MonthlyExportPanel';

const COLORS = ['#D91E2A', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function StatisticsPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Marketing Data
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  
  // Team Data
  const [teamActivity, setTeamActivity] = useState<any[]>([]);
  
  // Helper to test if a name is empty or invalid
  const isInvalidName = (val?: string | null): boolean => {
    if (!val) return true;
    const s = val.trim().toLowerCase();
    return (
      s === '' ||
      s === 'unbekannt' ||
      s === 'unknown' ||
      s === 'mitarbeiter' ||
      s === 'undefined' ||
      s === 'null' ||
      s.startsWith('unbekannt')
    );
  };

  // High-Level KPIs
  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    topSource: 'Eigene Website',
    topEmployee: 'Tarek'
  });

  useEffect(() => {
    // Only Admin is allowed to load these stats
    if (profile?.role !== 'admin') {
      setLoading(false);
      return;
    }

    const fetchStats = async () => {
      try {
        // --- 1. Fetch Users to build a UID -> Name Map & find primary admin ---
        const usersMap: Record<string, string> = {};
        let primaryAdminName = '';

        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          usersSnap.docs.forEach(uDoc => {
            const uData = uDoc.data();
            const name = uData.displayName || uData.name || (uData.email ? uData.email.split('@')[0] : '');
            if (!isInvalidName(name)) {
              usersMap[uDoc.id] = name;
              if (uData.role === 'admin' && !primaryAdminName) {
                primaryAdminName = name;
              }
            }
          });
        } catch (uErr) {
          console.warn("Could not fetch users map", uErr);
        }

        // --- 2. Fetch Orders + Free Invoices (for Revenue & Sources) ---
        const ordersSnap = await getDocs(collection(db, 'orders'));
        const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

        const freeInvoicesSnap = await getDocs(collection(db, 'invoices'));
        const freeInvoices = freeInvoicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any, _isFreeInvoice: true }));

        const allRevenueDocs = [...orders, ...freeInvoices];

        let totalRev = 0;
        let confirmedOrdersCount = 0;
        
        // Group by source
        const sourceMap: Record<string, { count: number, revenue: number }> = {};
        
        // Group by month
        const monthMap: Record<string, number> = {};

        allRevenueDocs.forEach((o: any) => {
          const isFreeInv = o._isFreeInvoice;
          if (isFreeInv) {
            if (!['open', 'paid'].includes(o.status)) return;
          } else {
            if (!['confirmed', 'completed', 'invoice_open', 'invoice_overdue', 'invoice_paid'].includes(o.status)) return;
          }
          
          confirmedOrdersCount++;
          const rev = o.totals?.gross || 0;
          totalRev += rev;

          // Source Analysis
          const source = o.orderMeta?.source || o.customerSource || o.source || 'Direktanfrage';
          if (!sourceMap[source]) sourceMap[source] = { count: 0, revenue: 0 };
          sourceMap[source].count += 1;
          sourceMap[source].revenue += rev;

          // Monthly Revenue Analysis
          const date = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || Date.now());
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
          .slice(-6)
          .map(key => {
            const [y, m] = key.split('-');
            const monthNames = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
            return {
              name: `${monthNames[parseInt(m)-1]} ${y.substring(2)}`,
              Umsatz: Math.round(monthMap[key])
            };
          });

        const topSource = formattedSourceData.length > 0 ? formattedSourceData[0].name : 'Eigene Website';

        // --- 3. Fetch Activity Logs & Order Creators (Team Performance) ---
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const employeeMap: Record<string, { creations: number, orders: number }> = {};
        
        // A: Check Activity Logs
        try {
          const actQuery = query(collection(db, 'activity_logs'), where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)));
          const actSnap = await getDocs(actQuery);
          
          actSnap.docs.forEach(doc => {
            const d = doc.data();
            const uid = d.performedBy || d.userId;
            let emp = uid && usersMap[uid] ? usersMap[uid] : '';
            if (isInvalidName(emp) && d.userName && !isInvalidName(d.userName)) {
              emp = d.userName;
            }
            if (isInvalidName(emp) && d.userEmail && !isInvalidName(d.userEmail.split('@')[0])) {
              emp = d.userEmail.split('@')[0];
            }

            if (!isInvalidName(emp)) {
              if (!employeeMap[emp]) employeeMap[emp] = { creations: 0, orders: 0 };
              if (d.action === 'CREATE_CUSTOMER') employeeMap[emp].creations += 1;
              if (d.action === 'CREATE_ORDER' || d.action === 'UPDATE_ORDER') employeeMap[emp].orders += 1;
            }
          });
        } catch (actErr) {
          console.warn("Could not query activity logs", actErr);
        }

        // B: Supplement from orders created in the last 30 days
        orders.forEach(o => {
          const oDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt || Date.now());
          if (oDate >= thirtyDaysAgo) {
            const creatorUidOrName = o.createdBy || o.orderMeta?.creator;
            const resolvedCreator = (creatorUidOrName && usersMap[creatorUidOrName]) || creatorUidOrName;
            const emp = o.employeeName || o.assignedTo || resolvedCreator;
            if (!isInvalidName(emp)) {
              if (!employeeMap[emp]) employeeMap[emp] = { creations: 0, orders: 0 };
              employeeMap[emp].orders += 1;
            }
          }
        });

        // Determine effective active dispatcher name
        const fallbackDispatcher = 
          primaryAdminName || 
          (!isInvalidName(profile?.displayName) ? profile?.displayName : '') ||
          (profile?.email && !isInvalidName(profile.email.split('@')[0]) ? profile.email.split('@')[0] : '') ||
          'Tarek';

        // Filter and format team data
        const formattedTeamData = Object.keys(employeeMap)
          .filter(key => !isInvalidName(key))
          .map(key => ({
            name: key,
            Neukunden: employeeMap[key].creations,
            Angebote: employeeMap[key].orders
          }))
          .sort((a, b) => (b.Neukunden + b.Angebote) - (a.Neukunden + a.Angebote));

        // If no team activity yet, ensure dispatcher is shown
        if (formattedTeamData.length === 0) {
          formattedTeamData.push({
            name: fallbackDispatcher,
            Neukunden: 0,
            Angebote: confirmedOrdersCount
          });
        }

        // Resolve top employee (never Unbekannt)
        let topEmployee = formattedTeamData.length > 0 ? formattedTeamData[0].name : fallbackDispatcher;
        if (isInvalidName(topEmployee)) {
          topEmployee = fallbackDispatcher || 'Tarek';
        }

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
        <div className="animate-spin h-10 w-10 border-t-2 border-b-2 border-primary rounded-full"></div>
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[50vh] text-center p-8 bg-bg-panel border border-structure rounded-3xl">
        <ShieldExclamationIcon className="w-16 h-16 text-amber-500 mb-3" />
        <h1 className="text-2xl font-bold font-headline text-text-main mb-2">Zugriff verweigert</h1>
        <p className="text-xs text-text-muted">Nur Administratoren haben Zugriff auf die Unternehmens-Auswertungen.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-panel border border-structure p-3 rounded-2xl shadow-xl">
          <p className="font-bold text-xs text-text-main font-headline mb-1">{label || payload[0].name}</p>
          {payload.map((p: any, i: number) => (
            <p key={i} className="text-xs font-semibold" style={{ color: p.color || p.fill }}>
              {p.name}: {p.name.includes('Umsatz') || p.name.includes('value') ? `€ ${p.value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : p.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header */}
      <div className="bg-bg-panel border border-structure p-5 md:p-6 rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold font-headline text-text-main flex items-center gap-2.5">
                <ChartBarIcon className="w-7 h-7 text-primary" />
                Unternehmens-Auswertungen
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest font-headline">
                Rothirsch v4.0
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Live-Analyse aus deinen Echtzeit-Daten (Umsatz, Marketing-Performance und Team-Aktivität)
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Export Container */}
      <MonthlyExportPanel />

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Gesamtumsatz */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Gesamtumsatz (Brutto)
            </span>
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CurrencyEuroIcon className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-headline text-text-main">
            € {(kpis.totalRevenue / 1000).toFixed(1)}k
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            Aus allen bestätigten Rechnungen & Aufträgen
          </span>
        </div>

        {/* KPI 2: Aufträge */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Aktive Aufträge
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
              <ChartBarIcon className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl lg:text-3xl font-bold font-headline text-text-main">
            {kpis.totalOrders}
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            Bestätigte und ausgeführte Umzüge
          </span>
        </div>

        {/* KPI 3: Lead-Quelle */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Top Lead-Quelle
            </span>
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <CursorArrowRaysIcon className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <p className="text-xl lg:text-2xl font-bold font-headline text-text-main truncate">
            {kpis.topSource}
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            Stärkster Marketing-Kanal
          </span>
        </div>

        {/* KPI 4: Aktivster Mitarbeiter */}
        <div className="bg-bg-panel border border-structure rounded-3xl p-5 relative overflow-hidden shadow-xs hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted font-headline">
              Aktivster Mitarbeiter
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <TrophyIcon className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-xl lg:text-2xl font-bold font-headline text-primary truncate">
            {isInvalidName(kpis.topEmployee) ? 'Tarek' : kpis.topEmployee}
          </p>
          <span className="text-[10px] text-text-muted mt-1 block">
            Letzte 30 Tage (Kunden & Angebote)
          </span>
        </div>
      </section>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* CHART 1: Umsatz-Entwicklung */}
        <section className="bg-bg-panel border border-structure rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold font-headline text-text-main">
                Umsatz-Entwicklung
              </h2>
              <p className="text-xs text-text-muted">Verlauf der letzten 6 Monate</p>
            </div>
          </div>

          <div className="h-[280px] w-full">
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" vertical={false} />
                  <XAxis dataKey="name" stroke="#888" fontSize={11} tickMargin={8} />
                  <YAxis stroke="#888" fontSize={11} tickFormatter={(val) => `€${val/1000}k`} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Umsatz" fill="#D91E2A" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-text-muted">
                Noch nicht genug Daten vorhanden.
              </div>
            )}
          </div>
        </section>

        {/* CHART 2: Lead-Quellen */}
        <section className="bg-bg-panel border border-structure rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold font-headline text-text-main">
                Umsatz nach Marketing-Kanal
              </h2>
              <p className="text-xs text-text-muted">Aufteilung nach Herkunftsquelle</p>
            </div>
          </div>

          <div className="h-[280px] w-full flex items-center">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full w-full text-xs text-text-muted">
                Keine Lead-Daten erfasst.
              </div>
            )}
          </div>
        </section>

        {/* CHART 3: Team Performance */}
        <section className="bg-bg-panel border border-structure rounded-3xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-base font-bold font-headline text-text-main">
                Mitarbeiter-Aktivität & Leistung
              </h2>
              <p className="text-xs text-text-muted">Erstellte Neukunden und Angebote in den letzten 30 Tagen</p>
            </div>
          </div>

          <div className="h-[260px] w-full">
            {teamActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamActivity} margin={{ top: 10, right: 10, left: 10, bottom: 0 }} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.15)" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#888" fontSize={11} />
                  <YAxis dataKey="name" type="category" stroke="#888" fontSize={11} width={110} />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px' }}/>
                  <Bar dataKey="Neukunden" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="Angebote" stackId="a" fill="#10b981" radius={[0, 6, 6, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-text-muted">
                Keine Mitarbeiter-Aktivitäten aufgezeichnet.
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
