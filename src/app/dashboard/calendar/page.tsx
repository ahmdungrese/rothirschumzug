"use client";

import { useEffect, useState, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, getDoc, doc } from 'firebase/firestore';
import { 
  CalendarDaysIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  CheckIcon, 
  MapPinIcon, 
  XMarkIcon,
  MagnifyingGlassIcon,
  TruckIcon,
  Squares2X2Icon,
  QueueListIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { DispoModal } from './DispoModal';
import { isTaskCompleted } from '@/lib/taskStateController';

type FilterType = 'all' | 'moves' | 'viewings' | 'logistics';
type CalendarViewMode = 'hybrid' | 'agenda';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [viewingModalEvent, setViewingModalEvent] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('hybrid');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['draft', 'quote', 'confirmed', 'completed', 'invoice_open', 'invoice_overdue', 'invoice_paid'])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(fetched);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching orders for calendar:", err);
      setLoading(false);
    });

    getDoc(doc(db, 'system', 'settings')).then(docSnap => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    });

    return () => unsubscribe();
  }, []);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthNames = [
    "Januar", "Februar", "März", "April", "Mai", "Juni", 
    "Juli", "August", "September", "Oktober", "November", "Dezember"
  ];
  
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: firstDay }, (_, i) => i);

  // Build day-by-day events map for the entire month once (used by both Hybrid Grid and Agenda View)
  const monthDaysData = useMemo(() => {
    const map: Record<string, any[]> = {};
    let totalMoves = 0;
    let totalViewings = 0;
    let totalLogistics = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      map[dateStr] = [];
    }

    orders.forEach(o => {
      const effectiveMovingDate = o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate;
      const isConfirmed = !['draft', 'quote'].includes(o.status);
      const custShortName = o.customerName || 'Kunde';

      if (effectiveMovingDate) {
        const movingDateStr = effectiveMovingDate.split('T')[0];
        const movingDateObj = new Date(movingDateStr);
        
        let createdAtObj = new Date();
        if (o.createdAt) {
          createdAtObj = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date(o.createdAt);
        }
        
        // 1. Umzugstag (Light Olive-Sage Green instead of Red!)
        if (map[movingDateStr] && isConfirmed) {
          totalMoves++;
          const isDone = ['completed', 'invoice_open', 'invoice_paid'].includes(o.status);
          map[movingDateStr].push({
            id: o.id + '_move',
            type: 'move',
            category: 'moves',
            symbol: 'local_shipping',
            shortLabel: 'Umzug',
            customerName: custShortName,
            title: custShortName,
            address: o.logistics?.b_city || o.logistics?.a_city || o.logistics?.loadingAddress?.split(',')[0] || 'Zielort',
            orderId: o.id,
            customerId: o.customerId,
            isDone,
            disposition: o.disposition || null,
            colorClass: 'bg-[#6E8F64]/15 text-[#3B5233] border-[#6E8F64]/35 dark:bg-[#6E8F64]/25 dark:text-[#C5DEC0] dark:border-[#6E8F64]/40'
          });
        }

        // 2. Halteverbot
        if (o.logistics?.noParkingZone && isConfirmed) {
          let hvDateStr = o.orderMeta?.halteverbotDate || '';
          if (!hvDateStr) {
            let hvDate = new Date(movingDateObj);
            hvDate.setDate(hvDate.getDate() - 7);
            if (hvDate < createdAtObj) hvDate = new Date(createdAtObj);
            hvDateStr = `${hvDate.getFullYear()}-${String(hvDate.getMonth() + 1).padStart(2, '0')}-${String(hvDate.getDate()).padStart(2, '0')}`;
          }
          const cleanHvDate = hvDateStr.split("T")[0];
          if (map[cleanHvDate]) {
            totalLogistics++;
            map[cleanHvDate].push({
              id: o.id + '_hv',
              ticketId: 'halteverbot',
              type: 'parking',
              category: 'logistics',
              symbol: 'local_parking',
              shortLabel: 'HVZ',
              customerName: custShortName,
              title: `HVZ • ${custShortName}`,
              address: o.logistics?.a_city || 'HVZ einrichten',
              orderId: o.id,
              customerId: o.customerId,
              isDone: isTaskCompleted(o, 'halteverbot'),
              timeStr: o.orderMeta?.halteverbotTime,
              colorClass: 'bg-amber-500/12 text-amber-800 border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
            });
          }
        }

        // 3. Karton-Lieferung
        if (o.services?.some((s: any) => s.name?.toLowerCase().includes('karton')) && isConfirmed) {
          let boxDateStr = o.orderMeta?.kartonDeliveryDate || '';
          if (!boxDateStr) {
            let boxDate = new Date(movingDateObj);
            boxDate.setDate(boxDate.getDate() - 28);
            if (boxDate < createdAtObj) boxDate = new Date(createdAtObj);
            boxDateStr = `${boxDate.getFullYear()}-${String(boxDate.getMonth() + 1).padStart(2, '0')}-${String(boxDate.getDate()).padStart(2, '0')}`;
          }
          const cleanBoxDate = boxDateStr.split("T")[0];
          if (map[cleanBoxDate]) {
            totalLogistics++;
            map[cleanBoxDate].push({
              id: o.id + '_box',
              ticketId: 'kartons_liefern',
              type: 'boxes',
              category: 'logistics',
              symbol: 'inventory_2',
              shortLabel: 'Kartons',
              customerName: custShortName,
              title: `Kartons • ${custShortName}`,
              address: o.logistics?.a_city || 'Kartonlieferung',
              orderId: o.id,
              customerId: o.customerId,
              isDone: isTaskCompleted(o, 'kartons_liefern'),
              timeStr: o.orderMeta?.kartonDeliveryTime,
              colorClass: 'bg-orange-500/12 text-orange-800 border-orange-500/25 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/50'
            });
          }
        }

        // 4. Möbellift buchen
        if (o.services?.some((s: any) => ['lift', 'möbellift', 'aufzug'].some(kw => s.name?.toLowerCase().includes(kw))) && isConfirmed) {
          let liftDateStr = o.orderMeta?.moebelliftDate || '';
          if (!liftDateStr) {
            let liftDate = new Date(movingDateObj);
            liftDate.setDate(liftDate.getDate() - 3);
            if (liftDate < createdAtObj) liftDate = new Date(createdAtObj);
            liftDateStr = `${liftDate.getFullYear()}-${String(liftDate.getMonth() + 1).padStart(2, '0')}-${String(liftDate.getDate()).padStart(2, '0')}`;
          }
          const cleanLiftDate = liftDateStr.split("T")[0];
          if (map[cleanLiftDate]) {
            totalLogistics++;
            map[cleanLiftDate].push({
              id: o.id + '_lift',
              ticketId: 'moebellift_buchen',
              type: 'lift',
              category: 'logistics',
              symbol: 'elevator',
              shortLabel: 'Lift',
              customerName: custShortName,
              title: `Lift • ${custShortName}`,
              address: o.logistics?.a_city || 'Lift reservieren',
              orderId: o.id,
              customerId: o.customerId,
              isDone: isTaskCompleted(o, 'moebellift_buchen'),
              timeStr: o.orderMeta?.moebelliftTime,
              colorClass: 'bg-sky-500/12 text-sky-800 border-sky-500/25 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/50'
            });
          }
        }
      }

      // 5. Besichtigungstermine (Phase 2)
      const effectiveViewingDate = o.orderMeta?.viewingDate || o.viewingDate;
      if (effectiveViewingDate) {
        const cleanViewDate = effectiveViewingDate.split('T')[0];
        if (map[cleanViewDate]) {
          totalViewings++;
          const isVideo = (o.orderMeta?.viewingType || '').toLowerCase().includes('video');
          map[cleanViewDate].push({
            id: o.id + '_view',
            ticketId: 'viewing_requested',
            type: 'viewing',
            category: 'viewings',
            symbol: isVideo ? 'videocam' : 'chair',
            shortLabel: isVideo ? 'Video' : 'Besichtigung',
            isVideo,
            customerName: custShortName,
            title: custShortName,
            address: o.logistics?.a_city || (isVideo ? 'Video-Call' : 'Vor Ort'),
            fullAddress: (o.logistics?.a_city || o.logistics?.a_street) 
              ? `${o.logistics.a_street || ''} ${o.logistics.a_houseNr || ''}, ${o.logistics.a_zip || ''} ${o.logistics.a_city || ''}` 
              : '',
            orderId: o.id,
            customerId: o.customerId,
            isDone: isTaskCompleted(o, 'viewing_requested'),
            timeStr: effectiveViewingDate.split('T')[1] ? effectiveViewingDate.split('T')[1].substring(0, 5) : (o.orderMeta?.viewingTime || ''),
            colorClass: 'bg-purple-500/12 text-purple-800 border-purple-500/25 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50'
          });
        }
      }
    });

    return {
      byDate: map,
      stats: {
        moves: totalMoves,
        viewings: totalViewings,
        logistics: totalLogistics,
        all: totalMoves + totalViewings + totalLogistics
      }
    };
  }, [orders, currentDate, daysInMonth]);

  // Filter helper for a day's events
  const getFilteredDayEvents = (dateStr: string) => {
    const raw = monthDaysData.byDate[dateStr] || [];
    return raw.filter(e => {
      if (activeFilter !== 'all' && e.category !== activeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.customerName.toLowerCase().includes(q) ||
          e.address.toLowerCase().includes(q) ||
          (e.fullAddress && e.fullAddress.toLowerCase().includes(q))
        );
      }
      return true;
    });
  };

  // Active days with events for the Agenda View
  const activeAgendaDays = useMemo(() => {
    const list: { dateStr: string; dayNum: number; events: any[] }[] = [];
    daysArray.forEach(day => {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const evs = getFilteredDayEvents(dateStr);
      if (evs.length > 0) {
        list.push({ dateStr, dayNum: day, events: evs });
      }
    });
    return list;
  }, [daysArray, currentDate, monthDaysData, activeFilter, searchQuery]);

  return (
    <div className="space-y-4 pb-20">
      {/* Ultra-Compact Hybrid Top Bar (Light Olive-Sage Green #6E8F64 — Zero Red) */}
      <div className="bg-bg-panel border border-structure px-4 py-3 rounded-2xl shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        
        {/* Left: Month Stepper + Today + View Switcher (Hybrid Grid vs Agenda) */}
        <div className="flex items-center justify-between sm:justify-start gap-2 flex-wrap">
          <div className="flex items-center bg-bg-card border border-structure rounded-xl p-1 shadow-inner">
            <button 
              onClick={prevMonth} 
              className="p-1.5 hover:bg-structure/60 rounded-lg transition-colors text-text-main cursor-pointer"
              title="Vorheriger Monat"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>
            <span className="text-xs md:text-sm font-bold text-text-main px-3 min-w-[125px] text-center font-headline">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button 
              onClick={nextMonth} 
              className="p-1.5 hover:bg-structure/60 rounded-lg transition-colors text-text-main cursor-pointer"
              title="Nächster Monat"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#6E8F64]/15 hover:bg-[#6E8F64] text-[#435E3A] dark:text-[#B5D1AC] hover:text-white border border-[#6E8F64]/35 transition-colors font-headline cursor-pointer shrink-0"
          >
            Heute
          </button>

          {/* Hybrid View Mode Switcher: 1. Hybrid-Kalender (Grid) | 2. Pro Tag (Agenda) */}
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setCalendarView('hybrid')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                calendarView === 'hybrid'
                  ? 'bg-[#6E8F64] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Hybrid-Monatsraster mit kompakten Symbol-Badges"
            >
              <Squares2X2Icon className="w-3.5 h-3.5" />
              <span>Hybrid-Raster</span>
            </button>
            <button
              type="button"
              onClick={() => setCalendarView('agenda')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                calendarView === 'agenda'
                  ? 'bg-[#6E8F64] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Gebündelte Tages-Agenda (nur Tage mit Terminen)"
            >
              <QueueListIcon className="w-3.5 h-3.5" />
              <span>Tages-Agenda ({activeAgendaDays.length})</span>
            </button>
          </div>
        </div>

        {/* Center: Compact Filter Pills (Light Olive-Sage Green #6E8F64 instead of Red) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-headline shrink-0 cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#6E8F64] text-white shadow-xs'
                : 'bg-bg-card hover:bg-structure/60 text-text-muted hover:text-text-main border border-structure'
            }`}
          >
            <span>Alle</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeFilter === 'all' ? 'bg-white/20 text-white' : 'bg-structure text-text-muted'}`}>
              {monthDaysData.stats.all}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('moves')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-headline shrink-0 cursor-pointer ${
              activeFilter === 'moves'
                ? 'bg-[#6E8F64] text-white shadow-xs'
                : 'bg-bg-card hover:bg-structure/60 text-text-muted hover:text-text-main border border-structure'
            }`}
          >
            <TruckIcon className="w-3.5 h-3.5" />
            <span>Umzüge</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeFilter === 'moves' ? 'bg-white/20 text-white' : 'bg-structure text-text-muted'}`}>
              {monthDaysData.stats.moves}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('viewings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-headline shrink-0 cursor-pointer ${
              activeFilter === 'viewings'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-bg-card hover:bg-structure/60 text-text-muted hover:text-text-main border border-structure'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>Besichtigungen</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeFilter === 'viewings' ? 'bg-white/20 text-white' : 'bg-structure text-text-muted'}`}>
              {monthDaysData.stats.viewings}
            </span>
          </button>

          <button
            onClick={() => setActiveFilter('logistics')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-headline shrink-0 cursor-pointer ${
              activeFilter === 'logistics'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-bg-card hover:bg-structure/60 text-text-muted hover:text-text-main border border-structure'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Logistik</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${activeFilter === 'logistics' ? 'bg-white/20 text-white' : 'bg-structure text-text-muted'}`}>
              {monthDaysData.stats.logistics}
            </span>
          </button>
        </div>

        {/* Right: Search Input */}
        <div className="relative w-full sm:w-52 shrink-0">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Kunde, Ort suchen..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-bg-card border border-structure focus:outline-none focus:ring-2 focus:ring-[#6E8F64] text-text-main placeholder:text-text-muted transition-all"
          />
        </div>
      </div>

      {/* Calendar Content */}
      {loading ? (
        <div className="bg-bg-panel border border-structure rounded-3xl flex justify-center p-20">
          <div className="animate-spin h-10 w-10 border-t-2 border-b-2 border-[#6E8F64] rounded-full"></div>
        </div>
      ) : calendarView === 'agenda' ? (
        /* ========================================================================= */
        /* VIEW 2: TAGES-AGENDA (Chronological grouped cards for days with events)   */
        /* ========================================================================= */
        <div className="space-y-3">
          {activeAgendaDays.length === 0 ? (
            <div className="bg-bg-panel border border-structure rounded-3xl p-12 text-center text-xs text-text-muted">
              Keine Termine in diesem Monat für den gewählten Filter gefunden.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeAgendaDays.map(({ dateStr, events }) => {
                const dateObj = new Date(dateStr);
                const formattedDay = dateObj.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
                const isToday = new Date().toDateString() === dateObj.toDateString();

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`bg-bg-panel rounded-2xl border p-4 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-2.5 ${
                      isToday ? 'border-[#6E8F64] ring-1 ring-[#6E8F64]/30' : 'border-structure hover:border-[#6E8F64]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-structure pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-headline font-extrabold text-sm text-text-main">
                          {formattedDay}
                        </span>
                        {isToday && (
                          <span className="bg-[#6E8F64] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                            Heute
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-[#6E8F64]">
                        {events.length} {events.length === 1 ? 'Termin' : 'Termine'} →
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {events.map((ev: any) => (
                        <div
                          key={ev.id}
                          onClick={(e) => {
                            if (ev.type === 'viewing') {
                              e.stopPropagation();
                              setViewingModalEvent(ev);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${ev.colorClass} ${
                            ev.isDone ? 'line-through opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-sm shrink-0">{ev.symbol}</span>
                            <div className="truncate">
                              <span className="font-bold">{ev.shortLabel}: {ev.customerName}</span>
                              <span className="opacity-75 ml-1.5 text-[11px]">• {ev.address}</span>
                            </div>
                          </div>
                          {ev.timeStr && (
                            <span className="text-[10px] font-bold shrink-0">{ev.timeStr}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 1 (DEFAULT): HYBRID SYMBOL CALENDAR GRID (De-cluttered & Zero Red)   */
        /* ========================================================================= */
        <div className="bg-bg-panel border border-structure rounded-3xl overflow-hidden shadow-sm">
          <div className="w-full">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 border-b border-structure bg-bg-card/50">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                <div 
                  key={day} 
                  className="py-2.5 px-2 text-center font-bold text-text-muted text-xs uppercase tracking-wider font-headline"
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* Days Grid */}
            <div className="grid grid-cols-7 auto-rows-fr">
              {blanksArray.map(b => (
                <div 
                  key={`blank-${b}`} 
                  className="min-h-[115px] p-2 border-b border-r border-structure/40 bg-structure/10"
                />
              ))}
              
              {daysArray.map(day => {
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const filteredEvents = getFilteredDayEvents(dateStr);

                const movesCount = filteredEvents.filter(e => e.category === 'moves').length;
                const viewingsCount = filteredEvents.filter(e => e.category === 'viewings').length;
                const logisticsCount = filteredEvents.filter(e => e.category === 'logistics').length;

                const todayObj = new Date();
                const isToday = todayObj.toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                
                return (
                  <div 
                    key={`day-${day}`} 
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`min-h-[118px] p-2 border-b border-r border-structure/70 relative group transition-colors cursor-pointer flex flex-col justify-between ${
                      isToday 
                        ? 'bg-[#6E8F64]/8 ring-1 ring-[#6E8F64]/50 ring-inset' 
                        : 'hover:bg-structure/20 bg-bg-panel'
                    }`}
                  >
                    {/* Day Header: Day Number + Mini Symbol Summary Counters */}
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <div className="flex items-center gap-1">
                        <span className={`font-headline font-bold text-xs ${
                          isToday 
                            ? 'bg-[#6E8F64] text-white px-2 py-0.5 rounded-full shadow-xs' 
                            : 'text-text-muted group-hover:text-text-main'
                        }`}>
                          {day}
                        </span>
                        {isToday && (
                          <span className="text-[9px] font-bold text-[#6E8F64] uppercase hidden sm:inline">
                            Heute
                          </span>
                        )}
                      </div>

                      {/* Mini Symbol Workload Indicators */}
                      {filteredEvents.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] font-bold">
                          {movesCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-[#6E8F64]/15 text-[#435E3A] dark:text-[#B5D1AC]" title={`${movesCount} Umzüge`}>
                              🚚{movesCount}
                            </span>
                          )}
                          {viewingsCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300" title={`${viewingsCount} Besichtigungen`}>
                              🏠{viewingsCount}
                            </span>
                          )}
                          {logisticsCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300" title={`${logisticsCount} Logistik-Aufgaben`}>
                              📦{logisticsCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Compact 1-Line Symbol Pills (Max 3 visible, rest folded neatly) */}
                    <div className="space-y-1 flex-1">
                      {filteredEvents.slice(0, 3).map((event: any) => {
                        const isMove = event.type === 'move';
                        const isViewing = event.type === 'viewing';
                        const hasHelpers = isMove && event.disposition?.helpers > 0;
                        
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              if (isViewing) {
                                e.stopPropagation();
                                setViewingModalEvent(event);
                              }
                            }}
                            className={`px-2 py-1 rounded-lg border text-[10px] transition-all flex items-center justify-between gap-1 font-semibold ${event.colorClass} ${
                              event.isDone ? 'line-through opacity-45' : 'hover:brightness-95'
                            }`}
                            title={`${event.shortLabel}: ${event.customerName} (${event.address})`}
                          >
                            <div className="truncate flex items-center gap-1 min-w-0">
                              {event.isDone ? (
                                <CheckIcon className="w-3 h-3 shrink-0" />
                              ) : (
                                <span className="material-symbols-outlined text-[12px] shrink-0">{event.symbol}</span>
                              )}
                              <span className="truncate font-bold">{event.customerName}</span>
                              <span className="opacity-70 truncate hidden xl:inline">• {event.address}</span>
                            </div>

                            {hasHelpers ? (
                              <span className="text-[9px] px-1 rounded bg-black/10 dark:bg-white/10 shrink-0 font-bold">
                                {event.disposition.helpers}H
                              </span>
                            ) : event.timeStr ? (
                              <span className="text-[9px] font-bold shrink-0 opacity-85">
                                {event.timeStr}
                              </span>
                            ) : null}
                          </div>
                        );
                      })}

                      {filteredEvents.length > 3 && (
                        <div className="text-[10px] font-bold text-center text-[#6E8F64] bg-[#6E8F64]/10 rounded-lg py-0.5">
                          +{filteredEvents.length - 3} weitere anzeigen
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Dispositions-Modal (Tages-Detailansicht) */}
      {selectedDateStr && (
        <DispoModal 
          dateStr={selectedDateStr} 
          orders={orders} 
          settings={settings} 
          onClose={() => setSelectedDateStr(null)} 
        />
      )}

      {/* Viewing Quick Info Modal */}
      {viewingModalEvent && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" 
          onClick={() => setViewingModalEvent(null)}
        >
          <div 
            className="relative bg-bg-panel border border-structure w-full max-w-md p-6 rounded-3xl flex flex-col gap-4 shadow-xl shadow-black/20" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-structure pb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#6E8F64] text-2xl">
                  {viewingModalEvent.isVideo ? 'videocam' : 'calendar_month'}
                </span>
                <h2 className="text-xl font-bold text-text-main font-headline">
                  {viewingModalEvent.isVideo ? 'Videobesichtigung' : 'Vor-Ort-Besichtigung'}
                </h2>
              </div>
              <button 
                type="button" 
                onClick={() => setViewingModalEvent(null)} 
                className="p-1.5 hover:bg-structure rounded-full transition-colors text-text-muted hover:text-text-main"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3.5">
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider font-headline font-bold mb-1">Kunde</div>
                <div className="font-bold text-text-main text-base">{viewingModalEvent.customerName}</div>
              </div>

              {viewingModalEvent.timeStr && (
                <div>
                  <div className="text-xs text-text-muted uppercase tracking-wider font-headline font-bold mb-1">Uhrzeit</div>
                  <div className="text-sm font-semibold text-text-main flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#6E8F64]">schedule</span>
                    {viewingModalEvent.timeStr} Uhr
                  </div>
                </div>
              )}

              {viewingModalEvent.fullAddress && (
                <div>
                  <div className="text-xs text-text-muted uppercase tracking-wider font-headline font-bold mb-1">Besichtigungsadresse</div>
                  <div className="text-sm text-text-main">{viewingModalEvent.fullAddress}</div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-structure flex flex-col gap-2">
              {viewingModalEvent.fullAddress && (
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(viewingModalEvent.fullAddress)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary w-full py-2.5 flex justify-center items-center gap-2 text-xs font-bold rounded-xl"
                >
                  <MapPinIcon className="w-4 h-4 text-[#6E8F64]" /> Auf Google Maps öffnen
                </a>
              )}
              {viewingModalEvent.customerId && (
                <Link 
                  href={`/dashboard/customers/${viewingModalEvent.customerId}/edit-order/${viewingModalEvent.orderId}?step=4`} 
                  className="w-full py-2.5 bg-[#6E8F64] hover:bg-[#5C7A53] text-white flex justify-center items-center gap-2 text-xs font-bold rounded-xl shadow-sm transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">chair</span>
                  <span>Besichtigung starten (Umzugsliste)</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
