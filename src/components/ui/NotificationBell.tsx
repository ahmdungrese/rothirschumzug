"use client";
import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { 
  BellIcon, 
  CalendarDaysIcon,
  CubeIcon,
  TruckIcon,
  UsersIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  DevicePhoneMobileIcon
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { hasFixedService } from '@/lib/serviceKeys';
import { useAuth } from '@/context/AuthContext';
import { 
  showDeviceNotification, 
  requestNotificationPermission, 
  getNotificationPermission,
  NotificationPermissionStatus
} from '@/lib/notificationService';

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
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [permStatus, setPermStatus] = useState<NotificationPermissionStatus>('default');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const userRole = profile?.role || 'admin';
  const userUid = profile?.uid || '';

  // Synchronize browser notification permission state
  useEffect(() => {
    setPermStatus(getNotificationPermission());
  }, []);

  const handleEnableDeviceNotifications = async () => {
    const res = await requestNotificationPermission();
    setPermStatus(res);
  };

  // Load dismissed alerts from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dismissed_alarms');
      if (saved) {
        setDismissedIds(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const dismissAlert = (id: string) => {
    if (!dismissedIds.includes(id)) {
      const next = [...dismissedIds, id];
      setDismissedIds(next);
      try {
        localStorage.setItem('dismissed_alarms', JSON.stringify(next));
      } catch {}
    }
  };

  const handleNotificationClick = (id: string) => {
    dismissAlert(id);
    setIsOpen(false);
  };

  const handleDismissButton = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    dismissAlert(id);
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
    const qOrders = query(collection(db, 'orders'));

    const unsub = onSnapshot(qOrders, (snap) => {
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const newNotifications: any[] = [];
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      orders.forEach((o: any) => {
        if (o.status === 'archived' || o.status === 'rejected' || o.status === 'cancelled') return;

        const customerName = o.customerName || (o.customerData?.firstName ? `${o.customerData.firstName} ${o.customerData.lastName}` : 'Kunde');
        const customerId = o.customerId || o.id;
        const moveDate = parseDateSafely(extractMovingDate(o));
        const daysUntilMove = moveDate ? Math.ceil((moveDate.getTime() - today.getTime()) / (1000 * 3600 * 24)) : null;

        // Is the current logged-in user specifically assigned as Teamleiter?
        const isAssignedToThisLead = Boolean(
          userUid && (
            o.assignedTeamLeadUid === userUid || 
            o.disposition?.assignedTeamLeadUid === userUid
          )
        );

        // --------------------------------------------------------------------
        // ROLE BRANCH A: TEAMLEITER (Feld- und Einsatzleiter)
        // Strictly personal assignments only - 0% invoice, 0% offer, 0% irrelevant noise
        // --------------------------------------------------------------------
        if (userRole === 'teamlead') {
          // If not assigned to this specific Teamleiter, completely ignore!
          if (!isAssignedToThisLead || !moveDate || daysUntilMove === null) {
            return;
          }

          // A1: Umzug ist HEUTE (Einsatztag)
          if (daysUntilMove === 0) {
            newNotifications.push({
              id: `${o.id}-tl-today`,
              type: 'teamlead_active',
              title: 'Umzug heute durchführen',
              message: `Umzug ${customerName}: Dein Einsatz ist heute. Beladung: ${o.logistics?.a_city || 'Auszug'}.`,
              link: `/dashboard/customers/${customerId}`,
              urgency: 'high'
            });
          }

          // A2: Umzug ist MORGEN (Vorbereitungstag)
          else if (daysUntilMove === 1) {
            newNotifications.push({
              id: `${o.id}-tl-tomorrow`,
              type: 'teamlead_prep',
              title: 'Umzug morgen vorbereiten',
              message: `Umzug ${customerName}: Einsatz morgen. Bitte Laufzettel und Team prüfen.`,
              link: `/dashboard/customers/${customerId}`,
              urgency: 'medium'
            });
          }

          // A3: Zuweisung in den nächsten 14 Tagen
          else if (daysUntilMove > 1 && daysUntilMove <= 14) {
            newNotifications.push({
              id: `${o.id}-tl-assigned`,
              type: 'teamlead_assigned',
              title: 'Umzug zugewiesen',
              message: `Du bist als Teamleiter für ${customerName} am ${o.movingDate || o.orderMeta?.movingDateFrom || 'demnächst'} eingeteilt.`,
              link: `/dashboard/customers/${customerId}`,
              urgency: 'medium'
            });
          }

          // A4: Abnahmeprotokoll ausstehend am/nach dem Umzugstag
          const hasProtocol = Boolean(o.signatureProtocol || (o.protocols && o.protocols.length > 0));
          if (daysUntilMove <= 0 && daysUntilMove >= -2 && !hasProtocol) {
            newNotifications.push({
              id: `${o.id}-tl-protocol`,
              type: 'protocol',
              title: 'Abnahmeprotokoll ausstehend',
              message: `Umzug ${customerName}: Bitte Abnahmeprotokoll vor Ort vom Kunden digital gegenzeichnen lassen.`,
              link: `/dashboard/customers/${customerId}`,
              urgency: 'high'
            });
          }

          // Teamleiter processing finished for this order
          return;
        }

        // --------------------------------------------------------------------
        // ROLE BRANCH B & C: ADMIN (sieht alles) & OFFICE / DISPONENT (Büro/Dispo)
        // --------------------------------------------------------------------
        if (moveDate && daysUntilMove !== null) {
          // 1. KARTON-ERINNERUNG (تسليم الكراتين)
          const hasBoxService = 
            hasFixedService(o.services, 'kartons') ||
            o.materials?.some((m: any) => (m.name || '').toLowerCase().includes('karton')) ||
            (Number(o.calcInput?.boxes || 0) > 0) ||
            (Number(o.boxesCount || 0) > 0) ||
            o.checklist?.some((c: any) => (c.text || '').toLowerCase().includes('karton'));
          
          const boxesDelivered = Boolean(
            o.boxesDelivered || 
            o.checklist?.find((c: any) => (c.text || '').toLowerCase().includes('karton'))?.done
          );

          if (hasBoxService && !boxesDelivered && daysUntilMove >= 0 && daysUntilMove <= 21) {
            const timeText = daysUntilMove === 0 ? 'Heute' : daysUntilMove === 1 ? 'Morgen' : `in ${daysUntilMove} Tagen`;
            newNotifications.push({
              id: `${o.id}-boxes`,
              type: 'boxes',
              title: 'Kartons liefern',
              message: `Umzug ${customerName} (${timeText}): Umzugskartons müssen ausgeliefert werden.`,
              link: `/dashboard/customers/${customerId}`,
              urgency: daysUntilMove <= 7 ? 'high' : 'medium'
            });
          }

          // 2. DISPO: MITARBEITER & FAHRZEUGE (قبل النقل بـ 5 أيام)
          if (o.status === 'confirmed' && daysUntilMove >= 0 && daysUntilMove <= 5) {
            const timeText = daysUntilMove === 0 ? 'Heute' : daysUntilMove === 1 ? 'Morgen' : `in ${daysUntilMove} Tagen`;
            const helpers = Number(o.disposition?.helpers || o.helpers || 0);
            const koffer = Number(o.disposition?.koffer35t || 0);
            const lkw = Number(o.disposition?.lkw7t || 0);
            const assignedVehicles = (o.disposition?.vehicles || []).length;
            const hasVehicle = (koffer + lkw + assignedVehicles) > 0;

            if (helpers === 0) {
              newNotifications.push({
                id: `${o.id}-staff`,
                type: 'staff',
                title: 'Personal einteilen',
                message: `Umzug ${customerName} (${timeText}): Noch keine Umzugshelfer zugewiesen.`,
                link: `/dashboard/customers/${customerId}`,
                urgency: 'high'
              });
            }

            if (!hasVehicle) {
              newNotifications.push({
                id: `${o.id}-vehicle`,
                type: 'vehicle',
                title: 'Fahrzeug reservieren',
                message: `Umzug ${customerName} (${timeText}): Noch kein Fahrzeug eingeteilt.`,
                link: `/dashboard/customers/${customerId}`,
                urgency: 'high'
              });
            }
          }

          // 3. RECHNUNG FEHLT (فاتورة ما بعد النقل)
          const daysSinceMove = Math.floor((today.getTime() - moveDate.getTime()) / (1000 * 3600 * 24));
          if (daysSinceMove >= 1 && daysSinceMove <= 30 && !o.invoiceNumber) {
            newNotifications.push({
              id: `${o.id}-invoice`,
              type: 'invoice',
              title: 'Rechnung erstellen',
              message: `Umzug ${customerName} vor ${daysSinceMove === 1 ? '1 Tag' : daysSinceMove + ' Tagen'} abgeschlossen. Rechnung noch offen.`,
              link: `/dashboard/customers/${customerId}`,
              urgency: 'high'
            });
          }
        }

        // 4. BESICHTIGUNGSTERMINE (تنبيه المعاينة)
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
      });

      setNotifications(newNotifications);

      // Trigger Native Device Notifications for new critical tasks if permission granted
      if (typeof window !== 'undefined' && Notification.permission === 'granted') {
        newNotifications.forEach(n => {
          showDeviceNotification({
            id: n.id,
            title: `Rothirsch: ${n.title}`,
            body: n.message,
            url: n.link
          });
        });
      }
    }, (err) => {
      console.warn("NotificationBell orders notice:", err?.message);
    });

    return () => unsub();
  }, [userRole, userUid]);

  const getIconConfig = (type: string) => {
    switch (type) {
      case 'teamlead_active':
        return {
          icon: <TruckIcon className="w-5 h-5 text-primary" />,
          colorClass: 'bg-primary/10 border-primary/20 text-primary'
        };
      case 'teamlead_prep':
        return {
          icon: <CalendarDaysIcon className="w-5 h-5 text-indigo-400" />,
          colorClass: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
        };
      case 'teamlead_assigned':
        return {
          icon: <UsersIcon className="w-5 h-5 text-emerald-400" />,
          colorClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        };
      case 'protocol':
        return {
          icon: <ClipboardDocumentCheckIcon className="w-5 h-5 text-amber-400" />,
          colorClass: 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        };
      case 'boxes':
        return {
          icon: <CubeIcon className="w-5 h-5 text-sky-400" />,
          colorClass: 'bg-sky-500/10 border-sky-500/20 text-sky-400'
        };
      case 'viewing':
        return {
          icon: <CalendarDaysIcon className="w-5 h-5 text-indigo-400" />,
          colorClass: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
        };
      case 'staff':
        return {
          icon: <UsersIcon className="w-5 h-5 text-amber-400" />,
          colorClass: 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        };
      case 'vehicle':
        return {
          icon: <TruckIcon className="w-5 h-5 text-orange-400" />,
          colorClass: 'bg-orange-500/10 border-orange-500/20 text-orange-400'
        };
      case 'invoice':
        return {
          icon: <DocumentTextIcon className="w-5 h-5 text-emerald-400" />,
          colorClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        };
      default:
        return {
          icon: <CubeIcon className="w-5 h-5 text-text-muted" />,
          colorClass: 'bg-structure/40 border-structure text-text-muted'
        };
    }
  };

  const visibleNotifications = notifications.filter(n => !dismissedIds.includes(n.id));

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        id="bell-icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-muted hover:text-text-main hover:bg-structure/40 rounded-xl transition-colors cursor-pointer"
        title="Dispo-Erinnerungen"
      >
        <BellIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        {visibleNotifications.length > 0 && (
          <span className="absolute top-1 right-1 inline-flex rounded-full h-4 min-w-4 px-1 bg-amber-500 text-[10px] items-center justify-center text-white font-bold shadow-xs">
            {visibleNotifications.length > 99 ? '99+' : visibleNotifications.length}
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
                <h3 className="font-bold text-xs sm:text-sm font-headline text-text-main">Dispo-Erinnerungen</h3>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-headline ${
                visibleNotifications.length > 0 
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
                {visibleNotifications.length} {visibleNotifications.length === 1 ? 'Aufgabe' : 'Aufgaben'}
              </span>
            </div>

            {/* Device Notification Status Banner (PWA / Android activation) */}
            {permStatus === 'default' && (
              <div className="px-3.5 py-2.5 bg-primary/5 border-b border-primary/20 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-text-main">
                  <DevicePhoneMobileIcon className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-[11px] leading-tight">Benachrichtigungen auf diesem Gerät erhalten</span>
                </div>
                <button
                  type="button"
                  onClick={handleEnableDeviceNotifications}
                  className="px-2.5 py-1 bg-primary text-white text-[11px] font-bold rounded-lg hover:bg-primary/90 transition-colors shrink-0 cursor-pointer"
                >
                  Aktivieren
                </button>
              </div>
            )}
            
            <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto custom-scrollbar divide-y divide-structure/40">
              {visibleNotifications.length === 0 ? (
                <div className="p-8 text-center text-text-muted flex flex-col items-center">
                  <CheckCircleIcon className="w-10 h-10 text-emerald-500/70 mb-2" />
                  <p className="font-semibold text-text-main text-sm">Alles erledigt</p>
                  <p className="text-xs text-text-muted mt-1">Keine offenen Aufgaben für deine Rolle.</p>
                </div>
              ) : (
                visibleNotifications.map((notif) => {
                  const cfg = getIconConfig(notif.type);
                  return (
                    <div key={notif.id} className="relative group">
                      <Link 
                        href={notif.link}
                        onClick={() => handleNotificationClick(notif.id)}
                        className="block p-3.5 sm:p-4 hover:bg-structure/30 transition-colors cursor-pointer pr-10"
                      >
                        <div className="flex gap-3 items-start">
                          <div className={`mt-0.5 shrink-0 p-2 rounded-xl border ${cfg.colorClass}`}>
                            {cfg.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm font-bold font-headline text-text-main">
                              {notif.title}
                            </h4>
                            <p className="text-xs text-text-muted mt-1 leading-snug break-words group-hover:text-text-main transition-colors">
                              {notif.message}
                            </p>
                          </div>
                        </div>
                      </Link>

                      <button
                        type="button"
                        onClick={(e) => handleDismissButton(e, notif.id)}
                        className="absolute top-3.5 right-3 p-1 rounded-lg text-text-muted/40 hover:text-text-main hover:bg-structure/60 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Diese Erinnerung ausblenden"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Subtle Footer with Permission State Indicator */}
            {permStatus === 'granted' && (
              <div className="px-3 py-1.5 bg-structure/20 border-t border-structure/40 flex items-center justify-center gap-1.5 text-[10px] text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Geräte-Benachrichtigungen aktiv</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
