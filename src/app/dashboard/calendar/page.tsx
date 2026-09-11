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
  FunnelIcon,
  TruckIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { DispoModal } from './DispoModal';

type FilterType = 'all' | 'moves' | 'viewings' | 'logistics';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [viewingModalEvent, setViewingModalEvent] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Fetch all orders with a moving or viewing date
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

    // Fetch Settings for vehicles and employees
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
    // Adjust so Monday is 0
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

  // Pre-calculate all events for this month to display badge counts on filter tabs
  const monthStats = useMemo(() => {
    let totalMoves = 0;
    let totalViewings = 0;
    let totalLogistics = 0;

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    orders.forEach(o => {
      const isConfirmed = !['draft', 'quote'].includes(o.status);
      const moveDate = (o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate)?.split('T')[0];
      const viewDate = (o.orderMeta?.viewingDate || o.viewingDate)?.split('T')[0];

      if (moveDate && moveDate.startsWith(monthPrefix) && isConfirmed) {
        totalMoves++;
      }

      if (viewDate && viewDate.startsWith(monthPrefix)) {
        totalViewings++;
      }

      if (isConfirmed) {
        if (o.logistics?.noParkingZone) totalLogistics++;
        if (o.services?.some((s: any) => s.name?.toLowerCase().includes('karton'))) totalLogistics++;
        if (o.services?.some((s: any) => ['lift', 'möbellift', 'aufzug'].some(kw => s.name?.toLowerCase().includes(kw)))) totalLogistics++;
      }
    });

    return {
      moves: totalMoves,
      viewings: totalViewings,
      logistics: totalLogistics,
      all: totalMoves + totalViewings + totalLogistics
    };
  }, [orders, currentDate]);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Action & Navigation Bar */}
      <div className="bg-bg-panel border border-structure p-5 md:p-6 rounded-3xl shadow-sm flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold font-headline text-text-main flex items-center gap-2.5">
                <CalendarDaysIcon className="w-7 h-7 text-primary" />
                Einsatzplanung & Kalender
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase tracking-widest font-headline">
                Rothirsch v4.0
              </span>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Operative Planung, Besichtigungen und Materialfristen im Überblick
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-60">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Kunde, Ort, Auftrag..."
                className="w-full pl-9 pr-4 py-2 text-xs rounded-full bg-bg-card border border-structure focus:outline-none focus:ring-2 focus:ring-primary text-text-main placeholder:text-text-muted transition-all"
              />
            </div>

            {/* Month Stepper Pill */}
            <div className="flex items-center bg-bg-card border border-structure rounded-full p-1 shadow-inner">
              <button 
                onClick={prevMonth} 
                className="p-1.5 hover:bg-structure/60 rounded-full transition-colors text-text-main"
                title="Vorheriger Monat"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="text-xs md:text-sm font-bold text-text-main px-3 min-w-[130px] text-center font-headline">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button 
                onClick={nextMonth} 
                className="p-1.5 hover:bg-structure/60 rounded-full transition-colors text-text-main"
                title="Nächster Monat"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Today Button */}
            <button
              onClick={goToToday}
              className="px-3.5 py-2 rounded-full text-xs font-bold bg-bg-card hover:bg-structure/60 border border-structure text-text-main transition-colors font-headline"
            >
              Heute
            </button>
          </div>
        </div>

        {/* Functional Filter Tabs (Funktionen Trennen) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-structure">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-text-muted mr-1 hidden sm:flex items-center gap-1">
              <FunnelIcon className="w-3.5 h-3.5" /> Filter:
            </span>

            {/* Filter 1: Alle */}
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 font-headline ${
                activeFilter === 'all'
                  ? 'bg-[#D91E2A] text-white shadow-sm shadow-[#D91E2A]/20'
                  : 'bg-bg-card hover:bg-structure/60 text-text-muted hover:text-text-main border border-structure'
              }`}
            >
              <span>Alle Termine</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === 'all' ? 'bg-white/25 text-white' : 'bg-structure text-text-muted'}`}>
                {monthStats.all}
              </span>
            </button>

            {/* Filter 2: Umzüge */}
            <button
              onClick={() => setActiveFilter('moves')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 font-headline ${
                activeFilter === 'moves'
                  ? 'bg-[#D91E2A] text-white shadow-sm shadow-[#D91E2A]/20'
                  : 'bg-bg-card hover:bg-structure/60 text-text-muted hover:text-text-main border border-structure'
              }`}
            >
              <TruckIcon className="w-3.5 h-3.5" />
              <span>Umzüge</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === 'moves' ? 'bg-white/25 text-white' : 'bg-structure text-text-muted'}`}>
                {monthStats.moves}
              </span>
            </button>

            {/* Filter 3: Besichtigungen */}
            <button
              onClick={() => setActiveFilter('viewings')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 font-headline ${
                activeFilter === 'viewings'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-600/20'
                  : 'bg-bg-card hover:bg-structure/60 text-text-muted hover:text-text-main border border-structure'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">visibility</span>
              <span>Besichtigungen</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === 'viewings' ? 'bg-white/25 text-white' : 'bg-structure text-text-muted'}`}>
                {monthStats.viewings}
              </span>
            </button>

            {/* Filter 4: Logistik & Fristen */}
            <button
              onClick={() => setActiveFilter('logistics')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 font-headline ${
                activeFilter === 'logistics'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'bg-bg-card hover:bg-structure/60 text-text-muted hover:text-text-main border border-structure'
              }`}
            >
              <span className="material-symbols-outlined text-[13px]">inventory_2</span>
              <span>Logistik & Material</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeFilter === 'logistics' ? 'bg-white/25 text-white' : 'bg-structure text-text-muted'}`}>
                {monthStats.logistics}
              </span>
            </button>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#D91E2A]"></span> Umzug
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Besichtigung
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span> HVZ
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span> Kartons
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-teal-500"></span> Möbellift
            </span>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="bg-bg-panel border border-structure rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin h-10 w-10 border-t-2 border-b-2 border-primary rounded-full"></div>
          </div>
        ) : (
          <div className="w-full">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 border-b border-structure bg-bg-card/50">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                <div 
                  key={day} 
                  className="py-3 px-2 text-center font-bold text-text-muted text-xs uppercase tracking-wider font-headline"
                >
                  {day}
                </div>
              ))}
            </div>
            
            {/* Days Grid */}
            <div className="grid grid-cols-7 auto-rows-fr">
              {/* Blanks of previous month */}
              {blanksArray.map(b => (
                <div 
                  key={`blank-${b}`} 
                  className="min-h-[120px] p-2 border-b border-r border-structure/40 bg-structure/10"
                />
              ))}
              
              {/* Month Days */}
              {daysArray.map(day => {
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // Collect events for this day
                const dayEvents: any[] = [];
                
                orders.forEach(o => {
                  const effectiveMovingDate = o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate;
                  const isConfirmed = !['draft', 'quote'].includes(o.status);

                  if (effectiveMovingDate) {
                    const movingDateStr = effectiveMovingDate.split('T')[0];
                    const movingDateObj = new Date(movingDateStr);
                    
                    let createdAtObj = new Date();
                    if (o.createdAt) {
                      createdAtObj = o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000) : new Date(o.createdAt);
                    }
                    
                    // 1. Umzugstag (nur bestätigte Aufträge)
                    if (movingDateStr === dateStr && isConfirmed) {
                      const isDone = ['completed', 'invoice_open', 'invoice_paid'].includes(o.status);
                      dayEvents.push({
                        id: o.id + '_move',
                        type: 'move',
                        category: 'moves',
                        title: o.customerName || 'Kunde',
                        address: o.logistics?.b_city || o.logistics?.a_city || o.logistics?.loadingAddress?.split(',')[0] || 'Kein Zielort',
                        orderId: o.id,
                        customerId: o.customerId,
                        isDone,
                        disposition: o.disposition || null,
                        colorClass: 'bg-red-50 text-[#D91E2A] border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50'
                      });
                    }

                    // 2. Halteverbot (Soll: 7 Tage vorher oder Tag der Annahme)
                    if (o.logistics?.noParkingZone && isConfirmed) {
                      let hvDateStr = o.orderMeta?.halteverbotDate || '';
                      if (!hvDateStr) {
                        let hvDate = new Date(movingDateObj);
                        hvDate.setDate(hvDate.getDate() - 7);
                        if (hvDate < createdAtObj) hvDate = new Date(createdAtObj);
                        hvDateStr = `${hvDate.getFullYear()}-${String(hvDate.getMonth() + 1).padStart(2, '0')}-${String(hvDate.getDate()).padStart(2, '0')}`;
                      }

                      if (hvDateStr.split("T")[0] === dateStr) {
                        dayEvents.push({
                          id: o.id + '_hv',
                          ticketId: 'halteverbot',
                          type: 'parking',
                          category: 'logistics',
                          title: 'Halteverbot: ' + (o.customerName || 'Kunde'),
                          address: o.logistics?.a_city || 'HVZ einrichten',
                          orderId: o.id,
                          customerId: o.customerId,
                          isDone: !!o.ticketStates?.halteverbot,
                          timeStr: o.orderMeta?.halteverbotTime,
                          colorClass: 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900/50'
                        });
                      }
                    }

                    // 3. Karton-Lieferung (Soll: 28 Tage vorher)
                    if (o.services?.some((s: any) => s.name?.toLowerCase().includes('karton')) && isConfirmed) {
                      let boxDateStr = o.orderMeta?.kartonDeliveryDate || '';
                      if (!boxDateStr) {
                        let boxDate = new Date(movingDateObj);
                        boxDate.setDate(boxDate.getDate() - 28);
                        if (boxDate < createdAtObj) boxDate = new Date(createdAtObj);
                        boxDateStr = `${boxDate.getFullYear()}-${String(boxDate.getMonth() + 1).padStart(2, '0')}-${String(boxDate.getDate()).padStart(2, '0')}`;
                      }

                      if (boxDateStr.split("T")[0] === dateStr) {
                        dayEvents.push({
                          id: o.id + '_box',
                          ticketId: 'kartons_liefern',
                          type: 'boxes',
                          category: 'logistics',
                          title: 'Kartons: ' + (o.customerName || 'Kunde'),
                          address: o.logistics?.a_city || 'Kartonlieferung',
                          orderId: o.id,
                          customerId: o.customerId,
                          isDone: !!o.ticketStates?.kartons_liefern,
                          timeStr: o.orderMeta?.kartonDeliveryTime,
                          colorClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50'
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

                      if (liftDateStr.split("T")[0] === dateStr) {
                        dayEvents.push({
                          id: o.id + '_lift',
                          ticketId: 'moebellift_buchen',
                          type: 'lift',
                          category: 'logistics',
                          title: 'Möbellift: ' + (o.customerName || 'Kunde'),
                          address: o.logistics?.a_city || 'Lift reservieren',
                          orderId: o.id,
                          customerId: o.customerId,
                          isDone: !!o.ticketStates?.moebellift_buchen,
                          timeStr: o.orderMeta?.moebelliftTime,
                          colorClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-900/50'
                        });
                      }
                    }
                  }

                  // 5. Besichtigungstermine (Phase 2)
                  const effectiveViewingDate = o.orderMeta?.viewingDate || o.viewingDate;
                  if (effectiveViewingDate && effectiveViewingDate.split('T')[0] === dateStr) {
                    const isVideo = (o.orderMeta?.viewingType || '').toLowerCase().includes('video');
                    dayEvents.push({
                      id: o.id + '_view',
                      ticketId: 'viewing_requested',
                      type: 'viewing',
                      category: 'viewings',
                      isVideo,
                      title: (isVideo ? 'Video: ' : 'Besichtigung: ') + (o.customerName || 'Kunde'),
                      address: o.logistics?.a_city || (isVideo ? 'Online Video-Call' : 'Vor Ort'),
                      fullAddress: (o.logistics?.a_city || o.logistics?.a_street) 
                        ? `${o.logistics.a_street || ''} ${o.logistics.a_houseNr || ''}, ${o.logistics.a_zip || ''} ${o.logistics.a_city || ''}` 
                        : '',
                      orderId: o.id,
                      customerId: o.customerId,
                      isDone: !!o.ticketStates?.viewing_requested,
                      timeStr: effectiveViewingDate.split('T')[1] ? effectiveViewingDate.split('T')[1].substring(0, 5) : '',
                      colorClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
                    });
                  }
                });

                // Apply Active Category Filter
                const filteredEvents = dayEvents.filter(e => {
                  if (activeFilter !== 'all' && e.category !== activeFilter) {
                    return false;
                  }
                  if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase();
                    return (
                      e.title.toLowerCase().includes(q) || 
                      e.address.toLowerCase().includes(q) ||
                      (e.fullAddress && e.fullAddress.toLowerCase().includes(q))
                    );
                  }
                  return true;
                });

                const todayObj = new Date();
                const isToday = todayObj.toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                
                return (
                  <div 
                    key={`day-${day}`} 
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`min-h-[135px] p-2 border-b border-r border-structure/70 relative group transition-colors cursor-pointer flex flex-col justify-between ${
                      isToday 
                        ? 'bg-primary/5 ring-1 ring-primary/40 ring-inset' 
                        : 'hover:bg-structure/20 bg-bg-panel'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      {isToday ? (
                        <span className="bg-[#D91E2A] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-headline shadow-sm">
                          Heute
                        </span>
                      ) : (
                        <span></span>
                      )}
                      <span className={`font-headline font-bold text-xs ${isToday ? 'text-primary' : 'text-text-muted group-hover:text-text-main'}`}>
                        {day}
                      </span>
                    </div>
                    
                    {/* Events list */}
                    <div className="space-y-1.5 flex-1">
                      {filteredEvents.slice(0, 4).map((event: any) => {
                        const isMove = event.type === 'move';
                        const isViewing = event.type === 'viewing';
                        
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              if (isViewing) {
                                e.stopPropagation();
                                setViewingModalEvent(event);
                              }
                            }}
                            className={`p-1.5 rounded-xl border text-[11px] transition-all shadow-xs leading-tight font-medium ${event.colorClass} ${
                              event.isDone ? 'line-through opacity-45' : 'hover:scale-[1.01]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="truncate flex items-center gap-1 font-bold">
                                {event.isDone && <CheckIcon className="w-3 h-3 shrink-0" />}
                                {isMove && <span className="material-symbols-outlined text-xs shrink-0">local_shipping</span>}
                                {isViewing && (
                                  <span className="material-symbols-outlined text-xs shrink-0">
                                    {event.isVideo ? 'videocam' : 'location_on'}
                                  </span>
                                )}
                                {event.type === 'parking' && <span className="material-symbols-outlined text-xs shrink-0">block</span>}
                                {event.type === 'boxes' && <span className="material-symbols-outlined text-xs shrink-0">package_2</span>}
                                {event.type === 'lift' && <span className="material-symbols-outlined text-xs shrink-0">elevator</span>}
                                
                                <span className="truncate">{event.title}</span>
                              </div>

                              {event.timeStr && (
                                <span className="text-[10px] font-bold shrink-0 opacity-90">
                                  {event.timeStr}
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] opacity-80 truncate mt-0.5">
                              {event.address}
                            </div>

                            {/* Mini resources preview for move */}
                            {isMove && event.disposition && (event.disposition.helpers > 0 || event.disposition.koffer35t > 0 || event.disposition.lkw7t > 0) && (
                              <div className="mt-1 pt-1 border-t border-current/15 text-[9px] flex flex-wrap gap-x-2 opacity-90 font-semibold">
                                {event.disposition.helpers > 0 && <span>{event.disposition.helpers}H</span>}
                                {event.disposition.koffer35t > 0 && <span>{event.disposition.koffer35t}x 3,5t</span>}
                                {event.disposition.lkw7t > 0 && <span>{event.disposition.lkw7t}x 7,5t</span>}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {filteredEvents.length > 4 && (
                        <div className="text-[10px] font-bold text-center text-text-muted hover:text-primary py-0.5">
                          +{filteredEvents.length - 4} weitere
                        </div>
                      )}
                    </div>

                    <div className="text-[9px] text-right text-text-muted mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      Planen →
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dispositions-Modal (Tages-Detailansicht mit 3 getrennten Sektionen) */}
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
                <span className="material-symbols-outlined text-amber-500 text-2xl">
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
                <div className="font-bold text-text-main text-base">{viewingModalEvent.title}</div>
              </div>

              {viewingModalEvent.timeStr && (
                <div>
                  <div className="text-xs text-text-muted uppercase tracking-wider font-headline font-bold mb-1">Uhrzeit</div>
                  <div className="text-sm font-semibold text-text-main flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">schedule</span>
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
                  <MapPinIcon className="w-4 h-4 text-primary" /> Auf Google Maps öffnen
                </a>
              )}
              {viewingModalEvent.customerId && (
                <Link 
                  href={`/dashboard/customers/${viewingModalEvent.customerId}`} 
                  className="btn-primary w-full py-2.5 flex justify-center items-center gap-2 text-xs font-bold rounded-xl shadow-sm"
                >
                  Zum Kundenprofil
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
