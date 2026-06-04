"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, where, getDoc, doc } from 'firebase/firestore';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { DispoModal } from './DispoModal';
import { getCol } from '@/lib/demoMode';

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [orders, setOrders] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  useEffect(() => {
    // Fetch all confirmed or completed orders that have a movingDate
    const q = query(
      collection(db, getCol('orders')),
      where('status', 'in', ['confirmed', 'completed', 'invoice_open', 'invoice_overdue', 'invoice_paid'])
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(fetched);
      setLoading(false);
    });

    // Fetch Settings for vehicles and employees
    getDoc(doc(db, getCol('system'), 'settings')).then(docSnap => {
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

  const monthNames = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: firstDay }, (_, i) => i);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-panel border border-structure p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <CalendarDaysIcon className="w-8 h-8 text-primary" /> Einsatzplanung
          </h1>
          <p className="text-text-muted mt-1">Verwalten Sie hier alle operativen Umzüge und Termine.</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="p-2 hover:bg-structure rounded-full transition-colors text-white">
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-white w-48 text-center">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-structure rounded-full transition-colors text-white">
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="panel min-h-[600px] p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-7 border-b border-structure bg-bg-dark">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
                <div key={day} className="p-4 text-center font-bold text-text-muted text-sm uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 auto-rows-fr">
              {blanksArray.map(b => (
                <div key={`blank-${b}`} className="min-h-[120px] p-2 border-b border-r border-structure/30 bg-bg-dark/30"></div>
              ))}
              
              {daysArray.map(day => {
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                // Find events for this day
                const dayEvents: any[] = [];
                
                orders.forEach(o => {
                  const effectiveMovingDate = o.movingDate || o.disposition?.movingDate;
                  if (effectiveMovingDate) {
                    const movingDateStr = effectiveMovingDate.split('T')[0];
                    const movingDateObj = new Date(movingDateStr);
                    
                    // 1. Umzugstag
                    if (movingDateStr === dateStr) {
                      dayEvents.push({
                        id: o.id + '_move',
                        type: 'move',
                        title: 'Umzug: ' + o.customerName,
                        address: o.logistics?.loadingAddress?.split(',')[0] || 'Keine Adresse',
                        color: 'bg-orange-500/20 border-orange-500/30 text-orange-400 hover:bg-orange-500/30',
                        orderId: o.id,
                        customerId: o.customerId
                      });
                    }

                    // 2. Halteverbot (4 Tage vorher)
                    if (o.logistics?.noParkingZone) {
                      const hvDate = new Date(movingDateObj);
                      hvDate.setDate(hvDate.getDate() - 4);
                      const hvDateStr = `${hvDate.getFullYear()}-${String(hvDate.getMonth() + 1).padStart(2, '0')}-${String(hvDate.getDate()).padStart(2, '0')}`;
                      if (hvDateStr === dateStr) {
                        dayEvents.push({
                          id: o.id + '_hv',
                          type: 'parking',
                          title: 'Halteverbot aufstellen',
                          address: o.customerName,
                          color: 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30',
                          orderId: o.id,
                          customerId: o.customerId
                        });
                      }
                    }

                    // 3. Karton-Lieferung (14 Tage vorher)
                    if (o.services?.some((s: any) => s.name.toLowerCase().includes('karton'))) {
                      const boxDate = new Date(movingDateObj);
                      boxDate.setDate(boxDate.getDate() - 14);
                      const boxDateStr = `${boxDate.getFullYear()}-${String(boxDate.getMonth() + 1).padStart(2, '0')}-${String(boxDate.getDate()).padStart(2, '0')}`;
                      if (boxDateStr === dateStr) {
                        dayEvents.push({
                          id: o.id + '_box',
                          type: 'boxes',
                          title: 'Kartons liefern',
                          address: o.customerName,
                          color: 'bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30',
                          orderId: o.id,
                          customerId: o.customerId
                        });
                      }
                    }
                  }

                  // 4. Besichtigungstermine
                  if (o.viewingDate && o.viewingDate.split('T')[0] === dateStr) {
                    dayEvents.push({
                      id: o.id + '_view',
                      type: 'viewing',
                      title: 'Besichtigung',
                      address: o.customerName,
                      color: 'bg-primary/20 border-primary/30 text-primary hover:bg-primary/30',
                      orderId: o.id,
                      customerId: o.customerId
                    });
                  }
                });

                const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
                
                return (
                  <div 
                    key={`day-${day}`} 
                    onClick={() => setSelectedDateStr(dateStr)}
                    className={`min-h-[120px] p-2 border-b border-r border-structure/30 relative group hover:bg-structure/10 transition-colors cursor-pointer ${isToday ? 'bg-primary/5' : ''}`}
                  >
                    <div className={`text-right font-semibold text-sm mb-2 ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                      {isToday && <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded mr-2 uppercase tracking-wider">Heute</span>}
                      {day}
                    </div>
                    
                    <div className="space-y-1">
                      {dayEvents.map(event => (
                        <Link 
                          key={event.id} 
                          href={event.type === 'move' ? `/dashboard/orders` : `/dashboard/customers/${event.customerId}`}
                          className={`block border p-1.5 rounded text-xs transition-colors ${event.color}`}
                        >
                          <div className="font-bold truncate">{event.title}</div>
                          <div className="opacity-80 truncate mt-0.5">{event.address}</div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {selectedDateStr && (
        <DispoModal 
          dateStr={selectedDateStr} 
          orders={orders} 
          settings={settings} 
          onClose={() => setSelectedDateStr(null)} 
        />
      )}
    </div>
  );
}
