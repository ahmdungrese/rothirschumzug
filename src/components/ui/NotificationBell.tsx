"use client";
import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { 
  BellIcon, 
  ExclamationCircleIcon, 
  ExclamationTriangleIcon,
  TruckIcon, 
  UsersIcon, 
  CalendarDaysIcon,
  DocumentTextIcon,
  CubeIcon,
  UserMinusIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';

function extractMovingDate(o: any): string | null {
  if (!o) return null;
  return (
    o.orderMeta?.movingDateFrom ||
    o.orderMeta?.movingDateTo ||
    o.movingDate ||
    o.logistics?.movingDate ||
    o.movingDateFrom ||
    null
  );
}

function parseDateSafely(dateStr?: string | null): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // Handle DD.MM.YYYY
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length >= 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
        const d = new Date(year, month, day);
        d.setHours(0, 0, 0, 0);
        return isNaN(d.getTime()) ? null : d;
      }
    }
  }

  // Handle YYYY-MM-DD or ISO
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null;
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load dismissed alerts from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dismissed_alarms');
      if (saved) {
        setDismissedIds(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const handleDismiss = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try {
      localStorage.setItem('dismissed_alarms', JSON.stringify(next));
    } catch {}
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // 1. Listen to orders
    const qOrders = query(collection(db, 'orders'));
    // 2. Listen to customers
    const qCustomers = query(collection(db, 'customers'));

    let currentOrders: any[] = [];
    let currentCustomers: any[] = [];

    const recomputeAlarms = () => {
      const newNotifications: any[] = [];
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // --------------------------------------------------------------------
      // A. ORDER-BASED ALERTS
      // --------------------------------------------------------------------
      currentOrders.forEach((o: any) => {
        if (o.status === 'archived' || o.status === 'rejected' || o.status === 'cancelled') return;

        const customerName = o.customerName || (o.customerData?.firstName ? `${o.customerData.firstName} ${o.customerData.lastName}` : 'Kunde');
        const customerId = o.customerId || o.id;
        const moveDate = parseDateSafely(extractMovingDate(o));

        // --- 1. BESICHTIGUNGSTERMINE (تنبيه المعاينة قبل بساعة) ---
        const viewDateStr = o.orderMeta?.viewingDate || o.viewingDate;
        if (viewDateStr && !o.viewingDone && !o.checklist?.find((c: any) => c.text?.toLowerCase()?.includes('besichtigung'))?.done) {
          const timeStr = o.orderMeta?.viewingTime || o.viewingTime || (viewDateStr.includes('T') ? viewDateStr.split('T')[1].substring(0, 5) : '09:00');
          let apptDate: Date | null = null;

          if (viewDateStr.includes('T')) {
            apptDate = new Date(viewDateStr);
          } else if (viewDateStr.includes('.')) {
            const parts = viewDateStr.split('.');
            const [hour, min] = timeStr.split(':').map((n: string) => parseInt(n, 10) || 0);
            apptDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]), hour || 9, min || 0);
          } else {
            const [hour, min] = timeStr.split(':').map((n: string) => parseInt(n, 10) || 0);
            const base = new Date(viewDateStr);
            if (!isNaN(base.getTime())) {
              base.setHours(hour || 9, min || 0, 0, 0);
              apptDate = base;
            }
          }

          if (apptDate && !isNaN(apptDate.getTime())) {
            const diffMinutes = Math.floor((apptDate.getTime() - now.getTime()) / (1000 * 60));
            // Trigger if within 90 minutes before up to 45 minutes after appointment start
            if (diffMinutes >= -45 && diffMinutes <= 90) {
              const isVideo = (o.orderMeta?.viewingType || '').toLowerCase().includes('video');
              const timeLabel = diffMinutes <= 0 ? 'Jetzt fällig' : `in ${diffMinutes} Min.`;
              newNotifications.push({
                id: `${o.id}-viewing`,
                type: 'viewing',
                title: 'Besichtigung in Kürze',
                message: `${isVideo ? 'Videocall' : 'Vor-Ort-Besichtigung'} für ${customerName} (${timeLabel} um ${timeStr} Uhr).`,
                link: `/dashboard/customers/${customerId}`,
                urgency: 'high'
              });
            }
          }
        }

        // --- 2. KARTON-ALARM (تسليم الكراتين قبل 3 أسابيع / 21 يوماً) ---
        if (moveDate) {
          const daysUntilMove = Math.ceil((moveDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
          const hasBoxService = o.services?.some((s: any) => (s.name || '').toLowerCase().includes('karton')) 
            || (Number(o.calcInput?.boxes || 0) > 0)
            || (Number(o.boxesCount || 0) > 0)
            || o.checklist?.some((c: any) => (c.text || '').toLowerCase().includes('karton'));
          
          const boxesDelivered = Boolean(
            o.boxesDelivered || 
            o.checklist?.find((c: any) => (c.text || '').toLowerCase().includes('karton'))?.done
          );

          if (hasBoxService && !boxesDelivered && daysUntilMove >= 0 && daysUntilMove <= 21) {
            const timeText = daysUntilMove === 0 ? 'Heute!' : daysUntilMove === 1 ? 'Morgen' : `in ${daysUntilMove} Tagen`;
            newNotifications.push({
              id: `${o.id}-boxes`,
              type: 'boxes',
              title: 'Kartons liefern',
              message: `Umzug ${customerName} (${timeText}): Umzugskartons müssen ausgeliefert werden!`,
              link: `/dashboard/customers/${customerId}`,
              urgency: daysUntilMove <= 7 ? 'high' : 'medium'
            });
          }

          // --- 3. DISPO-PRÜFUNG BEI AUFTRAGSBESTÄTIGUNG (3 bis 5 Tage vor Umzug) ---
          if (o.status === 'confirmed' && daysUntilMove >= 0 && daysUntilMove <= 5) {
            const timeText = daysUntilMove === 0 ? 'Heute!' : daysUntilMove === 1 ? 'Morgen' : `in ${daysUntilMove} Tagen`;
            const helpers = Number(o.disposition?.helpers || o.helpers || 0);
            const koffer = Number(o.disposition?.koffer35t || 0);
            const lkw = Number(o.disposition?.lkw7t || 0);
            const assignedVehicles = (o.disposition?.vehicles || []).length;
            const hasVehicle = (koffer + lkw + assignedVehicles) > 0;

            if (helpers === 0 && !hasVehicle) {
              newNotifications.push({
                id: `${o.id}-dispo-both`,
                type: 'dispo',
                title: 'Dispo-Alarm (Helfer & Fahrzeug fehlen)',
                message: `Umzug ${customerName} (${timeText}): Weder Helfer noch Fahrzeuge eingeteilt!`,
                link: `/dashboard/customers/${customerId}`,
                urgency: 'high'
              });
            } else if (helpers === 0) {
              newNotifications.push({
                id: `${o.id}-staff`,
                type: 'staff',
                title: 'Personal fehlt (Dispo)',
                message: `Umzug ${customerName} (${timeText}): Keine Umzugshelfer eingeteilt!`,
                link: `/dashboard/customers/${customerId}`,
                urgency: daysUntilMove <= 2 ? 'high' : 'medium'
              });
            } else if (!hasVehicle) {
              newNotifications.push({
                id: `${o.id}-vehicle`,
                type: 'vehicle',
                title: 'Fahrzeug fehlt (Dispo)',
                message: `Umzug ${customerName} (${timeText}): Kein Umzugsfahrzeug reserviert!`,
                link: `/dashboard/customers/${customerId}`,
                urgency: daysUntilMove <= 2 ? 'high' : 'medium'
              });
            }
          }

          // --- 4. RECHNUNG FEHLT NACH UMZUG (فاتورة ما بعد النقل بيوم) ---
          const daysSinceMove = Math.floor((today.getTime() - moveDate.getTime()) / (1000 * 3600 * 24));
          if (daysSinceMove >= 1 && daysSinceMove <= 30 && !o.invoiceNumber) {
            newNotifications.push({
              id: `${o.id}-invoice-missing`,
              type: 'invoice',
              title: 'Rechnung fehlt nach Umzug',
              message: `Umzug ${customerName} vor ${daysSinceMove === 1 ? '1 Tag' : daysSinceMove + ' Tagen'} abgeschlossen. Bitte Rechnung erstellen!`,
              link: `/dashboard/customers/${customerId}`,
              urgency: 'high'
            });
          }
        }
      });

      // --------------------------------------------------------------------
      // B. CUSTOMER-BASED ALERTS: KUNDE OHNE UMZUGSDATUM SEIT 10 TAGEN
      // --------------------------------------------------------------------
      currentCustomers.forEach((cust: any) => {
        if (cust.isArchived) return;

        // Check if customer has an active order with movingDate or is already confirmed/completed
        const custOrders = currentOrders.filter(o => o.customerId === cust.id);
        const hasValidMoveDate = Boolean(
          cust.movingDate || 
          cust.movingDateFrom || 
          cust.orderMeta?.movingDateFrom ||
          custOrders.some(o => {
            if (o.status === 'cancelled' || o.status === 'rejected' || o.status === 'archived') return false;
            const mDate = extractMovingDate(o);
            if (mDate) return true;
            // If already confirmed, completed, or invoiced, moving date is not missing
            if (o.status === 'confirmed' || o.status === 'completed' || o.status === 'invoice_open' || o.status === 'paid' || Boolean(o.invoiceNumber)) {
              return true;
            }
            return false;
          })
        );

        if (!hasValidMoveDate) {
          const createdDate = cust.createdAt?.toDate ? cust.createdAt.toDate() : (cust.createdAt ? new Date(cust.createdAt) : null);
          if (createdDate && !isNaN(createdDate.getTime())) {
            const daysInactive = Math.floor((today.getTime() - createdDate.getTime()) / (1000 * 3600 * 24));
            if (daysInactive >= 10 && daysInactive <= 90) {
              const custFullName = `${cust.firstName || ''} ${cust.lastName || 'Kunde'}`.trim();
              newNotifications.push({
                id: `${cust.id}-no-movedate`,
                type: 'stagnant',
                title: 'Kunde ohne Umzugsdatum',
                message: `Kunde ${custFullName} ist seit ${daysInactive} Tagen im System ohne Umzugsdatum. Bitte nachfassen!`,
                link: `/dashboard/customers/${cust.id}`,
                urgency: daysInactive >= 21 ? 'high' : 'medium'
              });
            }
          }
        }
      });

      // Sort: High urgency first, then newer
      newNotifications.sort((a, b) => (a.urgency === 'high' ? -1 : 1));
      setNotifications(newNotifications);
    };

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      currentOrders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeAlarms();
    });

    const unsubCustomers = onSnapshot(qCustomers, (snap) => {
      currentCustomers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recomputeAlarms();
    });

    // Recalculate every 60 seconds (for viewing countdowns)
    const interval = setInterval(recomputeAlarms, 60000);

    return () => {
      unsubOrders();
      unsubCustomers();
      clearInterval(interval);
    };
  }, []);

  const getIcon = (type: string, urgency: string) => {
    const isHigh = urgency === 'high';
    const color = isHigh ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400';
    switch (type) {
      case 'boxes':
        return <CubeIcon className={`w-5 h-5 ${color}`} />;
      case 'viewing':
        return <CalendarDaysIcon className={`w-5 h-5 ${color}`} />;
      case 'stagnant':
        return <UserMinusIcon className={`w-5 h-5 ${color}`} />;
      case 'dispo':
        return <ExclamationTriangleIcon className={`w-5 h-5 ${color}`} />;
      case 'staff':
        return <UsersIcon className={`w-5 h-5 ${color}`} />;
      case 'vehicle':
        return <TruckIcon className={`w-5 h-5 ${color}`} />;
      case 'invoice':
        return <DocumentTextIcon className={`w-5 h-5 ${color}`} />;
      default:
        return <ExclamationCircleIcon className={`w-5 h-5 ${color}`} />;
    }
  };

  const visibleNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        id="bell-icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-muted hover:text-text-main hover:bg-structure/40 rounded-xl transition-colors cursor-pointer"
        title="Dispo-Warnungen & Anti-Vergess System"
      >
        <BellIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        {visibleNotifications.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-[10px] items-center justify-center text-white font-bold">
              {visibleNotifications.length > 99 ? '99+' : visibleNotifications.length}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile Backdrop Overlay */}
          <div 
            onClick={() => setIsOpen(false)} 
            className="fixed inset-0 bg-black/60 z-40 sm:hidden backdrop-blur-xs animate-in fade-in duration-200" 
          />

          {/* Notification Menu Container */}
          <div className="fixed inset-x-3 top-16 sm:inset-auto sm:right-0 sm:mt-2 sm:absolute w-auto sm:w-96 max-w-[calc(100vw-24px)] bg-bg-panel border border-structure shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3.5 bg-bg-panel border-b border-structure flex justify-between items-center">
              <div className="flex items-center gap-2">
                <BellIcon className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-xs sm:text-sm font-headline text-text-main">Dispo-Warnungen (Anti-Vergess)</h3>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-headline ${
                visibleNotifications.length > 0 
                  ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
                {visibleNotifications.length} {visibleNotifications.length === 1 ? 'Alarm' : 'Alarme'}
              </span>
            </div>
            
            <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto custom-scrollbar divide-y divide-structure/40">
              {visibleNotifications.length === 0 ? (
                <div className="p-8 text-center text-text-muted flex flex-col items-center">
                  <CheckCircleIcon className="w-10 h-10 text-emerald-500/70 mb-2" />
                  <p className="font-semibold text-text-main text-sm">Alles im grünen Bereich!</p>
                  <p className="text-xs text-text-muted mt-1">Keine offenen Alarme oder vergessenen Vorgänge.</p>
                </div>
              ) : (
                visibleNotifications.map((notif) => (
                  <div key={notif.id} className="relative group">
                    <Link 
                      href={notif.link}
                      onClick={() => setIsOpen(false)}
                      className={`block p-3.5 sm:p-4 hover:bg-structure/30 transition-colors cursor-pointer pr-10 ${
                        notif.urgency === 'high' ? 'bg-red-500/5 hover:bg-red-500/10' : ''
                      }`}
                    >
                      <div className="flex gap-3 items-start">
                        <div className={`mt-0.5 shrink-0 p-2 rounded-xl border ${
                          notif.urgency === 'high'
                            ? 'bg-red-500/10 border-red-500/20'
                            : 'bg-amber-500/10 border-amber-500/20'
                        }`}>
                          {getIcon(notif.type, notif.urgency)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h4 className={`text-xs sm:text-sm font-bold font-headline truncate ${
                              notif.urgency === 'high' ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'
                            }`}>
                              {notif.title}
                            </h4>
                            {notif.urgency === 'high' && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-red-500/20 text-red-400 shrink-0">
                                Dringend
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-text-muted mt-1 leading-snug break-words group-hover:text-text-main transition-colors">
                            {notif.message}
                          </p>
                        </div>
                      </div>
                    </Link>

                    {/* Subtle Dismiss (X) button */}
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(e, notif.id)}
                      className="absolute top-3.5 right-3 p-1 rounded-lg text-text-muted/50 hover:text-text-main hover:bg-structure/60 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Warnung ausblenden"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
