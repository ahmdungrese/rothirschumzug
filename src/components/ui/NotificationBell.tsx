"use client";
import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { BellIcon, ExclamationCircleIcon, ShieldExclamationIcon, TruckIcon, UsersIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

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
    // Wir holen alle bestätigten Aufträge
    const q = query(collection(db, 'orders'), where('status', '==', 'confirmed'));
    const unsub = onSnapshot(q, (snap) => {
      const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const newNotifications: any[] = [];
      const now = new Date();
      now.setHours(0,0,0,0);
      
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(now.getDate() + 7);

      orders.forEach((o: any) => {
        if (!o.movingDate) return;

        // Parse movingDate (DD.MM.YYYY oder YYYY-MM-DD)
        let moveDate = new Date();
        if (o.movingDate.includes('.')) {
          const parts = o.movingDate.split('.');
          moveDate = new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
        } else {
          moveDate = new Date(o.movingDate);
        }

        // Wenn der Umzug in den nächsten 7 Tagen ist
        if (moveDate >= now && moveDate <= sevenDaysFromNow) {
          const daysLeft = Math.floor((moveDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
          const timeText = daysLeft === 0 ? 'Heute' : daysLeft === 1 ? 'Morgen' : `in ${daysLeft} Tagen`;
          const customerName = o.customerName || 'Unbekannt';

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
        }
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
      default: return <ExclamationCircleIcon className={`w-5 h-5 ${color}`} />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-muted hover:text-white hover:bg-structure/30 rounded-lg transition-colors"
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
            <h3 className="font-semibold text-white">Dispo-Warnungen (Anti-Vergess)</h3>
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
