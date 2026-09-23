"use client";
import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ClipboardDocumentListIcon, UserPlusIcon, DocumentTextIcon, CheckBadgeIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline';


export function ActivityFeed() {
  const [isOpen, setIsOpen] = useState(false);
  const [activities, setActivities] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    const q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActivities(logs);
    });

    return () => unsub();
  }, []);

  const handleDeleteAll = async () => {
    if (!confirm('Möchtest du wirklich alle Aktivitäten löschen?')) return;
    try {
      const promises = activities.map(act => deleteDoc(doc(db, 'activity_logs', act.id)));
      await Promise.all(promises);
    } catch (e) {
      console.error("Fehler beim Löschen:", e);
    }
  };

  const getIcon = (action: string) => {
    switch (action) {
      case 'LOGIN': return <ClockIcon className="w-4 h-4 text-blue-400" />;
      case 'CREATE_CUSTOMER': return <UserPlusIcon className="w-4 h-4 text-emerald-400" />;
      case 'CREATE_ORDER': return <DocumentTextIcon className="w-4 h-4 text-orange-400" />;
      case 'UPDATE_ORDER': return <CheckBadgeIcon className="w-4 h-4 text-purple-400" />;
      default: return <ClipboardDocumentListIcon className="w-4 h-4 text-text-muted" />;
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Gerade eben';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays === 1) return 'Gestern';
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-muted hover:text-text-main hover:bg-structure/40 rounded-xl transition-colors cursor-pointer"
        title="Aktivitäten-Verlauf (Audit)"
      >
        <ClipboardDocumentListIcon className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {isOpen && (
        <>
          {/* Mobile Backdrop Overlay - Identical to Dispo-Warnungen */}
          <div 
            onClick={() => setIsOpen(false)} 
            className="fixed inset-0 bg-black/60 z-40 sm:hidden backdrop-blur-xs animate-in fade-in duration-200" 
          />

          {/* Activity Menu Container - Identical structure & positioning as Dispo-Warnungen */}
          <div className="fixed inset-x-3 top-16 sm:inset-auto sm:right-0 sm:mt-2 sm:absolute w-auto sm:w-96 max-w-[calc(100vw-24px)] bg-bg-panel border border-structure shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-3.5 bg-bg-panel border-b border-structure flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ClipboardDocumentListIcon className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-xs sm:text-sm font-headline text-text-main">Aktivitäten (Audit)</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20 font-headline">
                  {activities.length} Logs
                </span>
                {activities.length > 0 && (
                  <button 
                    onClick={handleDeleteAll}
                    className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
                    title="Alle Aktivitäten löschen"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="max-h-[70vh] sm:max-h-96 overflow-y-auto custom-scrollbar divide-y divide-structure">
              {activities.length === 0 ? (
                <div className="p-8 text-center text-text-muted flex flex-col items-center">
                  <ClipboardDocumentListIcon className="w-10 h-10 text-text-muted/40 mb-2" />
                  <p className="font-semibold text-text-main text-sm">Noch keine Aktivitäten</p>
                  <p className="text-xs text-text-muted mt-1">Systemereignisse und Änderungen werden hier protokolliert.</p>
                </div>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="block p-3.5 sm:p-4 hover:bg-structure/20 transition-colors">
                    <div className="flex gap-3 items-start">
                      <div className="mt-0.5 shrink-0 p-1.5 rounded-xl bg-structure/40">
                        {getIcon(act.action)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs sm:text-sm font-bold font-headline text-text-main truncate">
                            {act.userName || 'System'}
                          </h4>
                          <span className="text-[10px] text-text-muted shrink-0 whitespace-nowrap">
                            {formatTime(act.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5 leading-snug break-words">
                          {act.details}
                        </p>
                      </div>
                    </div>
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
