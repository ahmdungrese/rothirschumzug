"use client";
import { useState, useEffect, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { ClipboardDocumentListIcon, UserPlusIcon, DocumentTextIcon, CheckBadgeIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline';
import { getCol } from '@/lib/demoMode';

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
    const q = query(collection(db, getCol('activity_logs')), orderBy('timestamp', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setActivities(logs);
    });

    return () => unsub();
  }, []);

  const handleDeleteAll = async () => {
    if (!confirm('Möchtest du wirklich alle Aktivitäten löschen?')) return;
    try {
      const promises = activities.map(act => deleteDoc(doc(db, getCol('activity_logs'), act.id)));
      await Promise.all(promises);
    } catch (e) {
      console.error("Fehler beim Löschen:", e);
    }
  };

  const getIcon = (action: string) => {
    switch (action) {
      case 'LOGIN': return <ClockIcon className="w-5 h-5 text-blue-400" />;
      case 'CREATE_CUSTOMER': return <UserPlusIcon className="w-5 h-5 text-emerald-400" />;
      case 'CREATE_ORDER': return <DocumentTextIcon className="w-5 h-5 text-orange-400" />;
      case 'UPDATE_ORDER': return <CheckBadgeIcon className="w-5 h-5 text-purple-400" />;
      default: return <ClipboardDocumentListIcon className="w-5 h-5 text-text-muted" />;
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
        className="relative p-2 text-text-muted hover:text-text-main hover:bg-structure/30 rounded-lg transition-colors"
        title="Aktivitäten-Verlauf (Audit)"
      >
        <ClipboardDocumentListIcon className="w-6 h-6" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-bg-dark/95 backdrop-blur-xl border border-structure shadow-2xl rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 bg-bg-dark border-b border-structure flex justify-between items-center">
            <h3 className="font-semibold text-text-main">Aktivitäten (Audit)</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-structure text-text-muted px-2 py-1 rounded-md">{activities.length} Logs</span>
              {activities.length > 0 && (
                <button 
                  onClick={handleDeleteAll}
                  className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                  title="Alle Aktivitäten löschen"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {activities.length === 0 ? (
              <div className="p-6 text-center text-text-muted flex flex-col items-center">
                <ClipboardDocumentListIcon className="w-10 h-10 text-text-muted/30 mb-2" />
                <p>Noch keine Aktivitäten.</p>
              </div>
            ) : (
              <div className="divide-y divide-structure/50">
                {activities.map((act) => (
                  <div key={act.id} className="block p-3 hover:bg-structure/20 transition-colors">
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0">
                        {getIcon(act.action)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-bold text-text-main truncate pr-2">
                            {act.userName || 'System'}
                          </span>
                          <span className="text-[10px] text-text-muted whitespace-nowrap">
                            {formatTime(act.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5 leading-snug">
                          {act.details}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
