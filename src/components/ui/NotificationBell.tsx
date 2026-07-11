"use client";
import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BellIcon, ExclamationCircleIcon, ShieldExclamationIcon, TruckIcon, UsersIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { getCol } from '@/lib/demoMode';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Schließen bei Klick außerhalb
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Wir holen Angebote, bestätigte und abgeschlossene Aufträge
    const q = query(collection(db, getCol('orders')), where('status', 'in', ['quote', 'confirmed', 'completed']));
    const unsub = onSnapshot(q, (snap) => {
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const newNotifications: any[] = [];
      const now = new Date();
      now.setHours(0,0,0,0);
      
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(now.getDate() + 7);

      orders.forEach((o: any) => {
        const customerName = o.customerName || 'Unbekannt';

        // --- ALARM: Abgelaufene Angebote (Nachfassen) ---
        if (o.status === 'quote' && o.orderMeta?.validUntil) {
          const validDate = new Date(o.orderMeta.validUntil);
          const diffDays = Math.floor((validDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
          
          if (diffDays <= 2) {
            newNotifications.push({
              id: `${o.id}-quote`,
              type: 'warning',
              title: diffDays < 0 ? 'Angebot abgelaufen!' : 'Angebot läuft ab',
              message: `Angebot für ${customerName} ${diffDays < 0 ? 'ist abgelaufen' : 'läuft in ' + diffDays + ' Tagen ab'}. Nachfassen!`,
              link: `/dashboard/customers/${o.customerId}`,
              urgency: diffDays < 0 ? 'high' : 'medium'
            });
          }
        }

        // --- ALARM: Fehlende Rechnung ---
        if (o.status === 'completed' && !o.invoiceNumber) {
          newNotifications.push({
            id: `${o.id}-invoice`,
            type: 'invoice',
            title: 'Rechnung fehlt!',
            message: `Umzug ${customerName} ist fertig, aber es gibt noch keine Rechnung!`,
            link: `/dashboard/customers/${o.customerId}`,
            urgency: 'high'
          });
        }

        // If there's no moving date, we skip the remaining alarms because they depend on movingDate
        if (!o.movingDate) return;

        // Parse movingDate (DD.MM.YYYY oder YYYY-MM-DD)
        let moveDate = new Date();
        if (o.movingDate.includes('.')) {
          const parts = o.movingDate.split('.');
          moveDate = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
        } else {
          moveDate = new Date(o.movingDate);
        }


        // --- ALARMS FOR CONFIRMED MOVES ---
        if (o.status === 'confirmed') {
          const daysLeft = Math.floor((moveDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
          const timeText = daysLeft === 0 ? 'Heute' : daysLeft === 1 ? 'Morgen' : `in ${daysLeft} Tagen`;
          
          // Karton-Alarm (< 28 Tage)
          const needsBoxes = o.services?.some((s: any) => s.name.toLowerCase().includes('karton'));
          const boxesDelivered = o.checklist?.find((c:any) => c.text.includes('Umzugskartons'))?.done;
          
          if (needsBoxes && !boxesDelivered && daysLeft <= 28 && daysLeft >= 0) {
            newNotifications.push({
              id: `${o.id}-boxes`,
              type: 'boxes',
              title: 'Kartons liefern',
              message: `Umzug ${customerName} (${timeText}): Kartons wurden noch nicht geliefert!`,
              link: `/dashboard/customers/${o.customerId}`,
              urgency: daysLeft <= 10 ? 'high' : 'medium'
            });
          }

          // Wenn der Umzug in den nächsten 7 Tagen ist oder bereits in der Vergangenheit liegt (und noch auf confirmed steht)
          if (moveDate <= sevenDaysFromNow) {
            // 1. Personal-Check
          if (!o.disposition || !o.disposition.helpers || o.disposition.helpers === 0) {
            newNotifications.push({
              id: `${o.id}-staff`,
              type: 'staff',
              title: 'Mitarbeiter fehlen',
              message: `Umzug ${customerName} (${timeText}): Keine Helfer eingeteilt!`,
              link: `/dashboard/customers/${o.customerId}`,
              urgency: daysLeft <= 2 ? 'high' : 'medium'
            });
          }

          // 2. Fahrzeug-Check
          const koffer = o.disposition?.koffer35t || 0;
          const lkw = o.disposition?.lkw7t || 0;
          if (koffer === 0 && lkw === 0) {
            newNotifications.push({
              id: `${o.id}-vehicle`,
              type: 'vehicle',
              title: 'Fahrzeug fehlt',
              message: `Umzug ${customerName} (${timeText}): Kein Fahrzeug reserviert!`,
              link: `/dashboard/customers/${o.customerId}`,
              urgency: daysLeft <= 2 ? 'high' : 'medium'
            });
          }

          // 3. Halteverbot-Check (Wenn gebucht, aber noch nicht bestätigt/bestellt)
          if (o.logistics?.noParkingZone && !o.logistics?.noParkingZoneConfirmed) {
            newNotifications.push({
              id: `${o.id}-parking`,
              type: 'parking',
              title: 'Halteverbot nicht bestellt',
              message: `Umzug ${customerName} (${timeText}): Halteverbot muss bei der Stadt beantragt werden!`,
              link: `/dashboard/customers/${o.customerId}`,
              urgency: 'high'
            });
          }
          } // End if moveDate within 7 days
        } // End if confirmed
      });

      // Nach Dringlichkeit sortieren (High zuerst)
      newNotifications.sort((a, b) => (a.urgency === 'high' ? -1 : 1));
      setNotifications(newNotifications);
    });

    return () => unsub();
  }, []);

  const getIcon = (type: string, urgency: string) => {
    const color = urgency === 'high' ? 'text-red-500' : 'text-orange-400';
    switch (type) {
      case 'staff': return <UsersIcon className={`w-5 h-5 ${color}`} />;
      case 'vehicle': return <TruckIcon className={`w-5 h-5 ${color}`} />;
      case 'parking': return <ShieldExclamationIcon className={`w-5 h-5 ${color}`} />;
      case 'boxes': return <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>;
      case 'invoice': return <svg className={`w-5 h-5 ${color}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
      default: return <ExclamationCircleIcon className={`w-5 h-5 ${color}`} />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        id="bell-icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-muted hover:text-text-main hover:bg-structure/30 rounded-lg transition-colors"
      >
        <BellIcon className="w-6 h-6" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] items-center justify-center text-white font-bold">
              {notifications.length}
            </span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-bg-panel border border-structure shadow-2xl rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-bg-dark border-b border-structure flex justify-between items-center">
            <h3 className="font-semibold text-text-main">Dispo-Warnungen (Anti-Vergess)</h3>
            <span className="text-xs bg-structure text-text-muted px-2 py-1 rounded-md">{notifications.length}</span>
          </div>
          
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-text-muted flex flex-col items-center">
                <CheckCircleIcon className="w-10 h-10 text-green-500/50 mb-2" />
                <p>Alles im grünen Bereich!</p>
                <p className="text-xs mt-1">Die nächsten 7 Tage sind perfekt disponiert.</p>
              </div>
            ) : (
              <div className="divide-y divide-structure/50">
                {notifications.map((notif) => (
                  <Link 
                    key={notif.id}
                    href={notif.link}
                    onClick={() => setIsOpen(false)}
                    className={`block p-4 hover:bg-structure/20 transition-colors ${notif.urgency === 'high' ? 'bg-red-900/10' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0">
                        {getIcon(notif.type, notif.urgency)}
                      </div>
                      <div>
                        <h4 className={`text-sm font-semibold ${notif.urgency === 'high' ? 'text-red-400' : 'text-orange-400'}`}>
                          {notif.title}
                        </h4>
                        <p className="text-xs text-text-muted mt-1 leading-snug">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CheckCircleIcon(props: any) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
