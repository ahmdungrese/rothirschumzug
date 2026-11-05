"use client";

import React, { useEffect, useState, useMemo, Fragment } from 'react';
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
  HomeIcon,
  ArchiveBoxIcon,
  Squares2X2Icon,
  QueueListIcon,
  PhoneIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { DispoModal } from './DispoModal';
import { isTaskCompleted, toggleTaskCompletion } from '@/lib/taskStateController';
import { hasFixedService } from '@/lib/serviceKeys';
import { useAuth } from '@/context/AuthContext';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';

type FilterType = 'all' | 'moves' | 'viewings' | 'logistics';
type CalendarViewMode = 'hybrid' | 'agenda';

export default function CalendarPage() {
  const { profile } = useAuth();
  const isTeamLead = profile?.role === 'teamlead';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Record<string, any>>({});
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [viewingModalEvent, setViewingModalEvent] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>(isTeamLead ? 'moves' : 'all');
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('hybrid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlannerEvent, setSelectedPlannerEvent] = useState<any | null>(null);

  useModalBackHandler(Boolean(viewingModalEvent), () => setViewingModalEvent(null), 'calendar-viewing-modal');
  useModalBackHandler(Boolean(selectedPlannerEvent), () => setSelectedPlannerEvent(null), 'calendar-planner-drawer');

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

    const qCust = query(collection(db, 'customers'));
    const unsubCust = onSnapshot(qCust, (snapshot) => {
      const map: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        map[doc.id] = { id: doc.id, ...doc.data() };
      });
      setCustomers(map);
    }, (err) => {
      console.warn("Notice: Calendar customers listener", err?.message);
    });

    getDoc(doc(db, 'system', 'settings')).then(docSnap => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    });

    return () => {
      unsubscribe();
      unsubCust();
    };
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
      if (o.isArchived === true || o.status === 'archived') return;
      const cust = customers[o.customerId];
      if (cust?.isArchived === true) return;
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
          // Teamleiter: Sieht AUSSCHLIESSLICH die ihm persönlich zugewiesenen Umzüge
          if (isTeamLead) {
            const assignedLeadUid = o.disposition?.assignedTeamLeadUid || o.assignedTeamLeadUid;
            if (!assignedLeadUid || assignedLeadUid !== profile?.uid) {
              return; // Nicht diesem Teamleiter zugewiesen
            }
          }

          totalMoves++;
          const isDone = ['completed', 'invoice_open', 'invoice_paid'].includes(o.status);

          const fromStreet = `${o.logistics?.a_street || ''} ${o.logistics?.a_houseNr || ''}`.trim();
          const fromCity = `${o.logistics?.a_zip || ''} ${o.logistics?.a_city || ''}`.trim();
          const fromFull = [fromStreet, fromCity].filter(Boolean).join(', ');

          const toStreet = `${o.logistics?.b_street || ''} ${o.logistics?.b_houseNr || ''}`.trim();
          const toCity = `${o.logistics?.b_zip || ''} ${o.logistics?.b_city || ''}`.trim();
          const toFull = [toStreet, toCity].filter(Boolean).join(', ');

          const isTeamDone = isTaskCompleted(o, 'team');
          const dispo = o.disposition || {};
          const helperCount = dispo.helpers !== undefined ? Number(dispo.helpers) : 0;
          const kofferCount = dispo.koffer35t !== undefined ? Number(dispo.koffer35t) : 0;
          const lkwCount = dispo.lkw7t !== undefined ? Number(dispo.lkw7t) : 0;
          const leadName = dispo.assignedTeamLeadName || o.assignedTeamLeadName;
          const assignedStaff = Array.isArray(o.assignedEmployees) ? o.assignedEmployees.length : (Array.isArray(o.team) ? o.team.length : 0);
          const effectiveHelpers = helperCount > 0 ? helperCount : assignedStaff;
          const effectiveVehicles = (dispo.vehicles ? Number(dispo.vehicles) : 0) || (dispo.trucks ? Number(dispo.trucks) : 0) || (kofferCount + lkwCount) || (effectiveHelpers > 0 ? 1 : 0);

          const teamSummaryParts: string[] = [];
          if (leadName) teamSummaryParts.push(`Leiter: ${leadName}`);
          if (effectiveHelpers > 0) teamSummaryParts.push(`${effectiveHelpers} Helfer`);
          if (kofferCount > 0 && lkwCount > 0) {
            teamSummaryParts.push(`${kofferCount + lkwCount} LKW`);
          } else if (kofferCount > 0) {
            teamSummaryParts.push(`${kofferCount}x 3,5t`);
          } else if (lkwCount > 0) {
            teamSummaryParts.push(`${lkwCount}x 7,5t`);
          } else if (effectiveVehicles > 0) {
            teamSummaryParts.push(`${effectiveVehicles} LKW`);
          }

          let dispoLabel = 'Dispo offen';
          if (teamSummaryParts.length > 0) {
            dispoLabel = teamSummaryParts.join(' • ');
          } else if (isTeamDone) {
            dispoLabel = 'Disponiert ✓';
          }

          map[movingDateStr].push({
            id: o.id + '_move',
            type: 'move',
            category: 'moves',
            symbol: 'local_shipping',
            shortLabel: 'Umzug',
            customerName: custShortName,
            title: custShortName,
            address: o.logistics?.b_city || o.logistics?.a_city || o.logistics?.loadingAddress?.split(',')[0] || '',
            fromAddress: fromFull,
            toAddress: toFull,
            a_floor: o.logistics?.a_floor || '',
            a_elevator: o.logistics?.a_elevator ? 'mit Aufzug' : (o.logistics?.a_floor ? 'ohne Aufzug' : ''),
            b_floor: o.logistics?.b_floor || '',
            b_elevator: o.logistics?.b_elevator ? 'mit Aufzug' : (o.logistics?.b_floor ? 'ohne Aufzug' : ''),
            helpers: effectiveHelpers,
            vehicles: effectiveVehicles,
            isTeamDone,
            dispoLabel,
            leadName,
            dateStr: movingDateStr,
            timeStr: o.orderMeta?.movingTime || o.movingTime || '08:00',
            phone: cust?.phone || o.customerPhone || o.phone || '',
            rawOrder: o,
            orderId: o.id,
            customerId: o.customerId,
            isDone,
            disposition: o.disposition || null,
            colorClass: 'bg-[#6E8F64]/15 text-[#3B5233] border-[#6E8F64]/35 dark:bg-[#6E8F64]/25 dark:text-[#C5DEC0] dark:border-[#6E8F64]/40'
          });
        }

        // Teamleiter: Nur Umzugstermine im Kalender anzeigen
        if (isTeamLead) return;

        // 2. Halteverbot
        if ((o.logistics?.noParkingZone || o.logistics?.a_parking || o.logistics?.b_parking || hasFixedService(o.services, 'hvz')) && isConfirmed) {
          const isBoth = (o.orderMeta?.hvzLocation || o.logistics?.hvzLocation) === 'both';
          const dateA = o.orderMeta?.halteverbotDateA;
          const dateB = o.orderMeta?.halteverbotDateB;

          if (isBoth && (dateA || dateB)) {
            if (dateA && map[dateA.split('T')[0]]) {
              const cleanA = dateA.split('T')[0];
              totalLogistics++;
              map[cleanA].push({
                id: o.id + '_hv_a',
                ticketId: 'halteverbot',
                type: 'parking',
                category: 'logistics',
                symbol: 'local_parking',
                shortLabel: 'HVZ A',
                customerName: custShortName,
                title: `HVZ (Auszug) • ${custShortName}`,
                address: o.logistics?.a_city || 'HVZ Auszug A',
                orderId: o.id,
                customerId: o.customerId,
                isDone: isTaskCompleted(o, 'halteverbot'),
                timeStr: o.orderMeta?.halteverbotTimeA || o.orderMeta?.halteverbotTime,
                colorClass: 'bg-amber-500/12 text-amber-800 border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
              });
            }
            if (dateB && map[dateB.split('T')[0]]) {
              const cleanB = dateB.split('T')[0];
              totalLogistics++;
              map[cleanB].push({
                id: o.id + '_hv_b',
                ticketId: 'halteverbot',
                type: 'parking',
                category: 'logistics',
                symbol: 'local_parking',
                shortLabel: 'HVZ B',
                customerName: custShortName,
                title: `HVZ (Einzug) • ${custShortName}`,
                address: o.logistics?.b_city || 'HVZ Einzug B',
                orderId: o.id,
                customerId: o.customerId,
                isDone: isTaskCompleted(o, 'halteverbot'),
                timeStr: o.orderMeta?.halteverbotTimeB || o.orderMeta?.halteverbotTime,
                colorClass: 'bg-amber-500/12 text-amber-800 border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50'
              });
            }
          } else {
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
        }

        // 3. Karton-Lieferung
        if ((hasFixedService(o.services, 'kartons') || Boolean(o.orderMeta?.kartonDeliveryDate)) && isConfirmed) {
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
        if ((o.logistics?.a_furnitureLift || o.logistics?.b_furnitureLift || hasFixedService(o.services, 'moebellift')) && isConfirmed) {
          const isBoth = (o.orderMeta?.moebelliftLocation || o.logistics?.moebelliftLocation) === 'both';
          const dateA = o.orderMeta?.moebelliftDateA;
          const dateB = o.orderMeta?.moebelliftDateB;

          if (isBoth && (dateA || dateB)) {
            if (dateA && map[dateA.split('T')[0]]) {
              const cleanA = dateA.split('T')[0];
              totalLogistics++;
              map[cleanA].push({
                id: o.id + '_lift_a',
                ticketId: 'moebellift_buchen',
                type: 'lift',
                category: 'logistics',
                symbol: 'elevator',
                shortLabel: 'Lift A',
                customerName: custShortName,
                title: `Lift (Auszug) • ${custShortName}`,
                address: o.logistics?.a_city || 'Lift Auszug A',
                orderId: o.id,
                customerId: o.customerId,
                isDone: isTaskCompleted(o, 'moebellift_buchen'),
                timeStr: o.orderMeta?.moebelliftTimeA || o.orderMeta?.moebelliftTime,
                colorClass: 'bg-sky-500/12 text-sky-800 border-sky-500/25 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/50'
              });
            }
            if (dateB && map[dateB.split('T')[0]]) {
              const cleanB = dateB.split('T')[0];
              totalLogistics++;
              map[cleanB].push({
                id: o.id + '_lift_b',
                ticketId: 'moebellift_buchen',
                type: 'lift',
                category: 'logistics',
                symbol: 'elevator',
                shortLabel: 'Lift B',
                customerName: custShortName,
                title: `Lift (Einzug) • ${custShortName}`,
                address: o.logistics?.b_city || 'Lift Einzug B',
                orderId: o.id,
                customerId: o.customerId,
                isDone: isTaskCompleted(o, 'moebellift_buchen'),
                timeStr: o.orderMeta?.moebelliftTimeB || o.orderMeta?.moebelliftTime,
                colorClass: 'bg-sky-500/12 text-sky-800 border-sky-500/25 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/50'
              });
            }
          } else {
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
      }

      // 5. Besichtigungstermine (Phase 2)
      const rawViewingDate = o.orderMeta?.viewingDate || o.viewingDate;
      const effectiveViewingDate = typeof rawViewingDate === 'string' 
        ? rawViewingDate 
        : (rawViewingDate?.seconds ? new Date(rawViewingDate.seconds * 1000).toISOString() : '');

      if (effectiveViewingDate && effectiveViewingDate !== 'erledigt_fotos' && effectiveViewingDate !== 'requested') {
        const cleanViewDate = effectiveViewingDate.split('T')[0];
        if (map[cleanViewDate]) {
          totalViewings++;
          const isVideo = (o.orderMeta?.viewingType || '').toLowerCase().includes('video');
          const viewingAddressStr = typeof o.orderMeta?.viewingAddress === 'string' ? o.orderMeta.viewingAddress : '';
          const addressA = (o.logistics?.a_city || o.logistics?.a_street) 
            ? `${o.logistics.a_street || ''} ${o.logistics.a_houseNr || ''}, ${o.logistics.a_zip || ''} ${o.logistics.a_city || ''}`.trim()
            : viewingAddressStr;

          map[cleanViewDate].push({
            id: o.id + '_view',
            ticketId: 'viewing_requested',
            type: 'viewing',
            category: 'viewings',
            symbol: isVideo ? 'videocam' : 'chair',
            shortLabel: isVideo ? 'Video' : 'Besichtigung',
            isVideo,
            customerName: String(custShortName || 'Kunde'),
            title: String(custShortName || 'Kunde'),
            address: o.logistics?.a_city || (isVideo ? 'Video-Call' : 'Vor Ort'),
            fullAddress: addressA,
            phone: cust?.phone || o.customerPhone || o.phone || '',
            rawOrder: o,
            orderId: o.id,
            customerId: o.customerId,
            isDone: isTaskCompleted(o, 'viewing_requested'),
            timeStr: effectiveViewingDate.includes('T') ? effectiveViewingDate.split('T')[1].substring(0, 5) : (o.orderMeta?.viewingTime || ''),
            colorClass: 'bg-purple-500/12 text-purple-800 border-purple-500/25 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50'
          });
        }
      }
    });

    return {
      byDate: map,
      stats: {
        moves: totalMoves,
        viewings: isTeamLead ? 0 : totalViewings,
        logistics: isTeamLead ? 0 : totalLogistics,
        all: isTeamLead ? totalMoves : (totalMoves + totalViewings + totalLogistics)
      }
    };
  }, [orders, customers, currentDate, daysInMonth, isTeamLead]);

  // Filter helper for a day's events
  const getFilteredDayEvents = (dateStr: string) => {
    const raw = monthDaysData.byDate[dateStr] || [];
    return raw.filter(e => {
      if (activeFilter !== 'all' && e.category !== activeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = typeof e.title === 'string' && e.title.toLowerCase().includes(q);
        const nameMatch = typeof e.customerName === 'string' && e.customerName.toLowerCase().includes(q);
        const addrMatch = typeof e.address === 'string' && e.address.toLowerCase().includes(q);
        const fullAddrMatch = typeof e.fullAddress === 'string' && e.fullAddress.toLowerCase().includes(q);
        return titleMatch || nameMatch || addrMatch || fullAddrMatch;
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
    <div className="space-y-4 pb-20 w-full max-w-full overflow-hidden min-w-0">
      {/* Ultra-Compact Hybrid Top Bar (Light Olive-Sage Green #6E8F64 — Zero Red) */}
      <div className="bg-bg-panel border border-structure p-3 sm:px-4 sm:py-3 rounded-2xl shadow-xs flex flex-col xl:flex-row xl:items-center justify-between gap-3 w-full max-w-full min-w-0">
        
        {/* Left: Month Stepper + Today + View Switcher (Hybrid Grid vs Agenda) */}
        <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
          <div className="flex items-center bg-bg-card border border-structure rounded-xl p-0.5 sm:p-1 shadow-inner shrink-0">
            <button 
              onClick={prevMonth} 
              className="p-1 sm:p-1.5 hover:bg-structure/60 rounded-lg transition-colors text-text-main cursor-pointer"
              title="Vorheriger Monat"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <span className="text-xs sm:text-sm font-bold text-text-main px-1.5 sm:px-3 min-w-[95px] sm:min-w-[125px] text-center font-headline">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button 
              onClick={nextMonth} 
              className="p-1 sm:p-1.5 hover:bg-structure/60 rounded-lg transition-colors text-text-main cursor-pointer"
              title="Nächster Monat"
            >
              <ChevronRightIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          <button
            onClick={goToToday}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold bg-[#6E8F64]/15 hover:bg-[#6E8F64] text-[#435E3A] dark:text-[#B5D1AC] hover:text-white border border-[#6E8F64]/35 transition-colors font-headline cursor-pointer shrink-0"
          >
            Heute
          </button>

          {/* Hybrid View Mode Switcher: 1. Hybrid-Kalender (Grid) | 2. Pro Tag (Agenda) (Desktop/Tablet only) */}
          <div className="hidden md:inline-flex p-0.5 sm:p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setCalendarView('hybrid')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                calendarView === 'hybrid'
                  ? 'bg-[#6E8F64] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Hybrid-Monatsraster mit kompakten Symbol-Badges"
            >
              <Squares2X2Icon className="w-3.5 h-3.5" />
              <span><span className="hidden sm:inline">Hybrid-</span>Raster</span>
            </button>
            <button
              type="button"
              onClick={() => setCalendarView('agenda')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                calendarView === 'agenda'
                  ? 'bg-[#6E8F64] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
              title="Gebündelte Tages-Agenda (nur Tage mit Terminen)"
            >
              <QueueListIcon className="w-3.5 h-3.5" />
              <span><span className="hidden sm:inline">Tages-</span>Agenda ({activeAgendaDays.length})</span>
            </button>
          </div>
        </div>

        {/* Center: Compact Filter Pills (Light Olive-Sage Green #6E8F64 instead of Red) with subtle thin white scroll indicator on mobile */}
        {!isTeamLead ? (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none sm:scrollbar-auto [&::-webkit-scrollbar]:h-0.5 [&::-webkit-scrollbar-track]:bg-white/5 [&::-webkit-scrollbar-thumb]:bg-white/40 [&::-webkit-scrollbar-thumb]:rounded-full w-full xl:w-auto">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-headline shrink-0 cursor-pointer ${
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
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-headline shrink-0 cursor-pointer ${
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
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-headline shrink-0 cursor-pointer ${
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
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 font-headline shrink-0 cursor-pointer ${
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
        ) : (
          <div className="flex items-center gap-2 font-headline text-xs font-bold text-[#6E8F64] bg-[#6E8F64]/10 border border-[#6E8F64]/25 px-3.5 py-1.5 rounded-xl">
            <TruckIcon className="w-4 h-4 text-[#6E8F64]" />
            <span>Umzugstermine ({monthDaysData.stats.moves})</span>
          </div>
        )}

        {/* Right: Search Input */}
        <div className="relative w-full sm:w-52 shrink-0">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            maxLength={60}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.replace(/<[^>]*>/g, '').replace(/[\r\n]+/g, '').slice(0, 60))}
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
      ) : (
        <>
          {/* ========================================================================= */}
          {/* MOBILE PLANNER VIEW (Inspired by Trello Planner: Minimalist Dots & Hairlines) */}
          {/* ========================================================================= */}
          <div className="block md:hidden bg-bg-panel border border-structure rounded-2xl overflow-hidden shadow-xs w-full max-w-full">
            <div className="divide-y divide-structure/70">
              {daysArray.map(day => {
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = getFilteredDayEvents(dateStr);
                const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                const weekdayShort = dateObj.toLocaleDateString('de-DE', { weekday: 'short' });
                const todayObj = new Date();
                const isToday = todayObj.toDateString() === dateObj.toDateString();

                return (
                  <div 
                    key={`planner-day-${day}`} 
                    className={`p-3.5 flex gap-3 transition-colors ${
                      isToday ? 'bg-[#6E8F64]/8' : 'hover:bg-structure/20'
                    }`}
                  >
                    {/* Left Column: Fixed Date Marker */}
                    <div className="w-10 flex flex-col items-center pt-0.5 shrink-0 select-none">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${
                        isToday ? 'text-[#6E8F64]' : 'text-text-muted'
                      }`}>
                        {weekdayShort}
                      </span>
                      {isToday ? (
                        <div className="w-8 h-8 rounded-full bg-[#6E8F64] text-white font-bold flex items-center justify-center shadow-md shadow-[#6E8F64]/30 mt-0.5 text-sm">
                          {day}
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-text-main mt-0.5">
                          {day}
                        </span>
                      )}
                    </div>

                    {/* Right Column: Clean Minimalist Events or Empty State */}
                    <div className="flex-1 min-w-0">
                      {dayEvents.length === 0 ? (
                        <div 
                          onClick={() => setSelectedDateStr(dateStr)}
                          className="flex items-center min-h-[38px] cursor-pointer"
                        >
                          <span className="text-xs text-text-muted italic hover:text-text-main transition-colors">
                            Keine Termine geplant
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {dayEvents.map((ev, evIdx) => {
                            const isMove = ev.type === 'move';
                            const isViewing = ev.type === 'viewing';
                            const dotColor = isMove ? 'bg-[#6E8F64]' : isViewing ? 'bg-purple-500' : 'bg-amber-500';
                            const hoverColor = isMove ? 'group-hover:text-[#6E8F64]' : isViewing ? 'group-hover:text-purple-400' : 'group-hover:text-amber-400';

                            return (
                              <Fragment key={ev.id}>
                                {evIdx > 0 && <div className="border-t border-dashed border-structure/70 my-1" />}
                                <div 
                                  onClick={() => setSelectedPlannerEvent(ev)}
                                  className="cursor-pointer group active:scale-[0.99] transition-all"
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0 shadow-xs ${ev.isDone ? 'opacity-40' : ''}`} />
                                      <span className={`font-bold text-xs truncate transition-colors ${
                                        ev.isDone ? 'line-through text-text-muted opacity-60' : `text-text-main ${hoverColor}`
                                      }`}>
                                        {ev.title || ev.customerName}
                                      </span>
                                    </div>
                                    <span className="text-[11px] font-bold text-text-muted shrink-0">
                                      {ev.timeStr ? `${ev.timeStr} Uhr` : (isMove ? '08:00 Uhr' : ev.shortLabel)}
                                    </span>
                                  </div>

                                  <div className="pl-4 text-[11px] text-text-muted flex items-center justify-between mt-0.5">
                                    <span className="truncate">
                                      {isMove ? (ev.toAddress || ev.fromAddress || 'Keine Adresse') : (ev.fullAddress || ev.address || 'Keine Adresse')}
                                    </span>
                                    <span className="text-text-muted text-[10px] shrink-0 font-medium ml-2 flex items-center gap-0.5">
                                      {isMove ? (
                                        <span className={ev.isTeamDone ? 'text-[#6E8F64] font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
                                          {ev.isTeamDone 
                                            ? (ev.helpers ? `${ev.helpers}H${ev.vehicles ? ` • ${ev.vehicles} LKW` : ''}` : 'Disponiert ✓')
                                            : 'Dispo offen'}
                                        </span>
                                      ) : isViewing ? (
                                        <span className="text-purple-500 font-semibold">{ev.isVideo ? 'Online' : 'Vor-Ort'}</span>
                                      ) : (
                                        <span>{ev.shortLabel}</span>
                                      )}
                                      <ChevronRightIcon className="w-3 h-3 text-text-muted group-hover:text-text-main transition-colors ml-0.5" />
                                    </span>
                                  </div>
                                </div>
                              </Fragment>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ========================================================================= */}
          {/* DESKTOP/TABLET VIEWS (hidden md:block)                                    */}
          {/* ========================================================================= */}
          <div className="hidden md:block">
            {calendarView === 'agenda' ? (
              /* VIEW 2: TAGES-AGENDA (Desktop) */
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
                                  <div className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-[14px] leading-none select-none">{ev.symbol}</span>
                                  </div>
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
              /* VIEW 1 (DEFAULT): HYBRID SYMBOL CALENDAR GRID (Desktop) */
              <div className="bg-bg-panel border border-structure rounded-2xl sm:rounded-3xl shadow-sm w-full max-w-full overflow-hidden">
                <div className="w-full overflow-x-auto scrollbar-none sm:scrollbar-auto">
                  <div className="min-w-[340px] sm:min-w-0 w-full">
                    {/* Weekday Header */}
                    <div className="grid grid-cols-7 border-b border-structure bg-bg-card/50">
                      {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                        <div 
                          key={day} 
                          className="py-1.5 sm:py-2.5 px-1 sm:px-2 text-center font-bold text-text-muted text-[11px] sm:text-xs uppercase tracking-wider font-headline"
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
                          className="min-h-[58px] sm:min-h-[96px] md:min-h-[115px] p-1 sm:p-2 border-b border-r border-structure/40 bg-structure/10"
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
                            className={`min-h-[58px] sm:min-h-[96px] md:min-h-[118px] p-0.5 sm:p-2 border-b border-r border-structure/70 relative group transition-colors cursor-pointer flex flex-col justify-between ${
                              isToday 
                                ? 'bg-[#6E8F64]/8 ring-1 ring-[#6E8F64]/50 ring-inset' 
                                : 'hover:bg-structure/20 bg-bg-panel'
                            }`}
                          >
                            {/* Day Header: Day Number + Mini Symbol Summary Counters */}
                            <div className="flex items-center justify-between gap-1 mb-1 sm:mb-1.5">
                              <div className="flex items-center gap-1">
                                <span className={`font-headline font-bold text-[11px] sm:text-xs ${
                                  isToday 
                                    ? 'bg-[#6E8F64] text-white w-5 h-5 sm:w-auto sm:h-auto sm:px-2 sm:py-0.5 rounded-full flex items-center justify-center sm:inline-block shadow-xs' 
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

                              {/* Mini Workload Indicators (Clean Heroicons - Desktop/Tablet) */}
                              {filteredEvents.length > 0 && (
                                <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold">
                                  {movesCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-[#6E8F64]/15 text-[#435E3A] dark:text-[#B5D1AC] flex items-center gap-0.5" title={`${movesCount} Umzüge`}>
                                      <TruckIcon className="w-3 h-3 shrink-0" />
                                      <span>{movesCount}</span>
                                    </span>
                                  )}
                                  {viewingsCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 flex items-center gap-0.5" title={`${viewingsCount} Besichtigungen`}>
                                      <HomeIcon className="w-3 h-3 shrink-0" />
                                      <span>{viewingsCount}</span>
                                    </span>
                                  )}
                                  {logisticsCount > 0 && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center gap-0.5" title={`${logisticsCount} Logistik-Aufgaben`}>
                                      <ArchiveBoxIcon className="w-3 h-3 shrink-0" />
                                      <span>{logisticsCount}</span>
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Mobile (< sm): Micro-Badges / Micro-Indicators */}
                            {filteredEvents.length > 0 && (
                              <div className="flex sm:hidden flex-wrap items-center justify-center gap-0.5 my-auto py-0.5">
                                {movesCount > 0 && (
                                  <span 
                                    className="w-5 h-5 rounded-md bg-[#6E8F64]/20 text-[#2D4525] dark:text-[#C5DEC0] flex items-center justify-center text-[10px] font-bold shadow-2xs" 
                                    title={`${movesCount} Umzüge`}
                                  >
                                    {movesCount > 1 ? (
                                      <span>{movesCount}</span>
                                    ) : (
                                      <TruckIcon className="w-3 h-3 shrink-0" />
                                    )}
                                  </span>
                                )}
                                {viewingsCount > 0 && (
                                  <span 
                                    className="w-5 h-5 rounded-md bg-purple-500/20 text-purple-700 dark:text-purple-300 flex items-center justify-center text-[10px] font-bold shadow-2xs" 
                                    title={`${viewingsCount} Besichtigungen`}
                                  >
                                    {viewingsCount > 1 ? (
                                      <span>{viewingsCount}</span>
                                    ) : (
                                      <HomeIcon className="w-3 h-3 shrink-0" />
                                    )}
                                  </span>
                                )}
                                {logisticsCount > 0 && (
                                  <span 
                                    className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center text-[10px] font-bold shadow-2xs" 
                                    title={`${logisticsCount} Logistik`}
                                  >
                                    {logisticsCount > 1 ? (
                                      <span>{logisticsCount}</span>
                                    ) : (
                                      <ArchiveBoxIcon className="w-3 h-3 shrink-0" />
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Desktop/Tablet (sm:): Full 1-Line Symbol Pills (Max 3 visible, rest folded neatly) */}
                            <div className="hidden sm:block space-y-1 flex-1">
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
                                        <span className="material-symbols-outlined text-[12px] leading-none select-none shrink-0">{event.symbol}</span>
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
              </div>
            )}
          </div>
        </>
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
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" 
          onClick={() => setViewingModalEvent(null)}
        >
          <div 
            className="relative bg-bg-panel border border-structure w-full max-w-md max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-3xl flex flex-col gap-4 shadow-xl shadow-black/20" 
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-start border-b border-structure pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#6E8F64]/15 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#6E8F64] text-xl leading-none select-none">
                    {viewingModalEvent.isVideo ? 'videocam' : 'calendar_month'}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-text-main font-headline">
                  {viewingModalEvent.isVideo ? 'Videobesichtigung' : 'Vor-Ort-Besichtigung'}
                </h2>
              </div>
              <button 
                type="button" 
                onClick={() => setViewingModalEvent(null)} 
                className="p-1.5 hover:bg-structure rounded-full transition-colors text-text-muted hover:text-text-main cursor-pointer"
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
                  <div className="text-sm font-semibold text-text-main flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xs text-[#6E8F64] leading-none select-none">schedule</span>
                    </span>
                    <span>{viewingModalEvent.timeStr} Uhr</span>
                  </div>
                </div>
              )}

              {viewingModalEvent.fullAddress && (
                <div>
                  <div className="text-xs text-text-muted uppercase tracking-wider font-headline font-bold mb-1">Besichtigungsadresse</div>
                  <div className="text-sm text-text-main flex items-start gap-2">
                    <span className="w-6 h-6 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPinIcon className="w-3.5 h-3.5 text-primary" />
                    </span>
                    <span>{viewingModalEvent.fullAddress}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2 pt-4 border-t border-structure flex flex-col gap-2">
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

      {/* Mobile Event Details Drawer (Bottom Sheet) */}
      {selectedPlannerEvent && (
        <div 
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200"
          onClick={() => setSelectedPlannerEvent(null)}
        >
          <div 
            className="bg-bg-panel border-t border-structure rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto w-full max-w-lg mx-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag indicator pill */}
            <div className="w-10 h-1 bg-structure rounded-full mx-auto -mt-1 mb-2" />

            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    selectedPlannerEvent.type === 'move' ? 'bg-[#6E8F64]' : selectedPlannerEvent.type === 'viewing' ? 'bg-purple-500' : 'bg-amber-500'
                  }`} />
                  <h3 className="text-base font-bold text-text-main truncate font-headline">
                    {selectedPlannerEvent.customerName || selectedPlannerEvent.title}
                  </h3>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  {selectedPlannerEvent.type === 'move' ? 'Umzugstermin' : selectedPlannerEvent.type === 'viewing' ? 'Besichtigungstermin' : selectedPlannerEvent.shortLabel}
                  {selectedPlannerEvent.timeStr ? ` • ${selectedPlannerEvent.timeStr} Uhr` : ''}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedPlannerEvent(null)}
                className="p-1.5 rounded-full text-text-muted hover:text-text-main hover:bg-structure transition-colors shrink-0 cursor-pointer"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Move Addresses */}
            {selectedPlannerEvent.type === 'move' && (
              <>
                <div className="bg-bg-card rounded-2xl p-3 border border-structure space-y-2.5 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-[#6E8F64]/15 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPinIcon className="w-3.5 h-3.5 text-[#6E8F64]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-text-muted uppercase">Beladestelle (A)</p>
                      {selectedPlannerEvent.fromAddress ? (
                        <p className="font-semibold text-text-main">{selectedPlannerEvent.fromAddress}</p>
                      ) : (
                        <p className="font-normal text-text-muted italic">Keine Adresse hinterlegt</p>
                      )}
                      {selectedPlannerEvent.a_floor && (
                        <p className="text-[11px] text-text-muted">{selectedPlannerEvent.a_floor} {selectedPlannerEvent.a_elevator ? `• ${selectedPlannerEvent.a_elevator}` : ''}</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-structure/60" />

                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPinIcon className="w-3.5 h-3.5 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-text-muted uppercase">Entladestelle (B)</p>
                      {selectedPlannerEvent.toAddress ? (
                        <p className="font-semibold text-text-main">{selectedPlannerEvent.toAddress}</p>
                      ) : (
                        <p className="font-normal text-text-muted italic">Keine Adresse hinterlegt</p>
                      )}
                      {selectedPlannerEvent.b_floor && (
                        <p className="text-[11px] text-text-muted">{selectedPlannerEvent.b_floor} {selectedPlannerEvent.b_elevator ? `• ${selectedPlannerEvent.b_elevator}` : ''}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Team & Logistics Summary */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Team & LKW Card - Clickable to open DispoModal! */}
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedPlannerEvent.dateStr) {
                        setSelectedDateStr(selectedPlannerEvent.dateStr);
                        setSelectedPlannerEvent(null);
                      }
                    }}
                    className="bg-bg-card hover:bg-structure/40 active:scale-[0.98] transition-all rounded-xl p-2.5 border border-structure text-left cursor-pointer group flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] text-text-muted block font-medium">Team & LKW</span>
                      <span className="text-[10px] text-text-muted group-hover:text-text-main flex items-center gap-0.5">
                        <span>Dispo</span>
                        <ChevronRightIcon className="w-3 h-3" />
                      </span>
                    </div>
                    <span className={`font-bold text-xs truncate mt-0.5 block ${
                      selectedPlannerEvent.isTeamDone 
                        ? 'text-[#6E8F64]' 
                        : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {selectedPlannerEvent.dispoLabel || (selectedPlannerEvent.isTeamDone ? 'Disponiert ✓' : 'Dispo offen')}
                    </span>
                  </button>

                  <div className="bg-bg-card rounded-xl p-2.5 border border-structure flex flex-col justify-between">
                    <span className="text-[10px] text-text-muted block font-medium">Status</span>
                    <span className="font-bold text-[#6E8F64] text-xs mt-0.5">
                      {selectedPlannerEvent.isDone ? 'Abgeschlossen' : 'Bestätigt'}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Viewing Details */}
            {selectedPlannerEvent.type === 'viewing' && (
              <div className="bg-bg-card rounded-2xl p-3 border border-structure text-xs space-y-2">
                <div>
                  <p className="text-[10px] font-bold text-text-muted uppercase mb-0.5">Besichtigungsart</p>
                  <p className="font-semibold text-text-main">
                    {selectedPlannerEvent.isVideo ? 'Online via WhatsApp / FaceTime' : 'Vor-Ort-Besichtigung'}
                  </p>
                </div>
                {selectedPlannerEvent.fullAddress && (
                  <div className="border-t border-structure/60 pt-2">
                    <p className="text-[10px] font-bold text-text-muted uppercase mb-0.5">Adresse</p>
                    <p className="font-semibold text-text-main">{selectedPlannerEvent.fullAddress}</p>
                  </div>
                )}
              </div>
            )}

            {/* Logistics Details */}
            {selectedPlannerEvent.category === 'logistics' && (
              <div className="bg-bg-card rounded-2xl p-3 border border-structure text-xs space-y-2">
                <p className="text-[10px] font-bold text-text-muted uppercase mb-0.5">Aufgabe</p>
                <p className="font-semibold text-text-main">{selectedPlannerEvent.title}</p>
                <p className="text-text-muted">{selectedPlannerEvent.address}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-1 space-y-2">
              {selectedPlannerEvent.type === 'move' && selectedPlannerEvent.customerId && (
                <Link
                  href={`/dashboard/customers/${selectedPlannerEvent.customerId}`}
                  className="w-full py-2.5 bg-[#6E8F64] hover:bg-[#5C7A53] text-white rounded-xl font-bold text-xs shadow-md shadow-[#6E8F64]/20 transition-colors flex items-center justify-center gap-2"
                >
                  <span>Auftrag & Kundenakte öffnen</span>
                  <ChevronRightIcon className="w-4 h-4" />
                </Link>
              )}

              {selectedPlannerEvent.type === 'viewing' && selectedPlannerEvent.customerId && (
                <Link
                  href={`/dashboard/customers/${selectedPlannerEvent.customerId}/edit-order/${selectedPlannerEvent.orderId}?step=4`}
                  className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-md shadow-purple-900/20 transition-colors flex items-center justify-center gap-2"
                >
                  <span>Besichtigung starten (Möbelliste)</span>
                  <ChevronRightIcon className="w-4 h-4" />
                </Link>
              )}

              {selectedPlannerEvent.category === 'logistics' && selectedPlannerEvent.ticketId && selectedPlannerEvent.rawOrder && (
                <button
                  type="button"
                  onClick={async () => {
                    if (selectedPlannerEvent.rawOrder && selectedPlannerEvent.ticketId) {
                      await toggleTaskCompletion(selectedPlannerEvent.rawOrder, selectedPlannerEvent.ticketId);
                      setSelectedPlannerEvent(null);
                    }
                  }}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-md shadow-amber-900/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckIcon className="w-4 h-4" />
                  <span>{selectedPlannerEvent.isDone ? 'Als offen markieren' : 'Als erledigt markieren'}</span>
                </button>
              )}

              {/* Secondary Quick Actions: Route (Maps) & Phone */}
              <div className="grid grid-cols-2 gap-2">
                {(selectedPlannerEvent.fromAddress || selectedPlannerEvent.toAddress || selectedPlannerEvent.fullAddress) ? (
                  <a
                    href={
                      selectedPlannerEvent.fromAddress && selectedPlannerEvent.toAddress
                        ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(selectedPlannerEvent.fromAddress)}&destination=${encodeURIComponent(selectedPlannerEvent.toAddress)}`
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlannerEvent.fullAddress || selectedPlannerEvent.toAddress || selectedPlannerEvent.fromAddress)}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 bg-bg-card hover:bg-structure text-text-main border border-structure rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MapPinIcon className="w-4 h-4 text-[#6E8F64]" />
                    <span>Route (Maps)</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="py-2.5 bg-bg-card opacity-50 text-text-muted border border-structure rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5"
                  >
                    <MapPinIcon className="w-4 h-4" />
                    <span>Keine Route</span>
                  </button>
                )}

                {selectedPlannerEvent.phone ? (
                  <a
                    href={`tel:${selectedPlannerEvent.phone}`}
                    className="py-2.5 bg-bg-card hover:bg-structure text-text-main border border-structure rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <PhoneIcon className="w-4 h-4 text-[#6E8F64]" />
                    <span>Anrufen</span>
                  </a>
                ) : (
                  <button
                    disabled
                    className="py-2.5 bg-bg-card opacity-50 text-text-muted border border-structure rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5"
                  >
                    <PhoneIcon className="w-4 h-4" />
                    <span>Keine Tel.</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
