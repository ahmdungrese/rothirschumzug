"use client";
import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { 
  ClipboardDocumentListIcon, 
  UserPlusIcon, 
  DocumentTextIcon, 
  CheckBadgeIcon, 
  ClockIcon, 
  TrashIcon, 
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  XCircleIcon,
  UserIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import toast from "react-hot-toast";

export function ActivityLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'activity_logs'), orderBy("timestamp", "desc"), limit(200));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleDeleteAll = async () => {
    if (!confirm('Möchtest du wirklich alle Aktivitäten-Logs löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
    setIsDeleting(true);
    try {
      const promises = logs.map(act => deleteDoc(doc(db, 'activity_logs', act.id)));
      await Promise.all(promises);
      toast.success('Alle Logs erfolgreich gelöscht!');
    } catch (e) {
      console.error("Fehler beim Löschen:", e);
      toast.error('Fehler beim Löschen der Logs.');
    } finally {
      setIsDeleting(false);
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE_INVOICE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <DocumentTextIcon className="w-3.5 h-3.5" />
            Rechnung erstellt
          </span>
        );
      case 'CANCEL_INVOICE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            <XCircleIcon className="w-3.5 h-3.5" />
            Rechnung storniert
          </span>
        );
      case 'CREATE_CUSTOMER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <UserPlusIcon className="w-3.5 h-3.5" />
            Kunde neu
          </span>
        );
      case 'UPDATE_CUSTOMER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
            <UserIcon className="w-3.5 h-3.5" />
            Kunde bearbeitet
          </span>
        );
      case 'LOGIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
            <ClockIcon className="w-3.5 h-3.5" />
            Anmeldung
          </span>
        );
      case 'CREATE_ORDER':
      case 'UPDATE_ORDER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <CheckBadgeIcon className="w-3.5 h-3.5" />
            Auftrag / Angebot
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-structure text-text-muted border border-structure">
            <ClipboardDocumentListIcon className="w-3.5 h-3.5" />
            {action}
          </span>
        );
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return 'Gerade eben';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    let relative = '';
    if (diffMins < 1) relative = 'Gerade eben';
    else if (diffMins < 60) relative = `vor ${diffMins} Min.`;
    else if (diffHours < 24) relative = `vor ${diffHours} Std.`;
    else relative = date.toLocaleDateString('de-DE');

    return (
      <div className="flex flex-col">
        <span className="text-text-main font-medium text-xs">{relative}</span>
        <span className="text-[10px] text-text-muted">
          {date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })} • {date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>
    );
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter tab
      if (filterType === 'invoices' && !log.action?.includes('INVOICE')) return false;
      if (filterType === 'customers' && !log.action?.includes('CUSTOMER')) return false;
      if (filterType === 'logins' && log.action !== 'LOGIN') return false;
      if (filterType === 'orders' && !log.action?.includes('ORDER')) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const userName = (log.userName || '').toLowerCase();
        const details = (log.details || '').toLowerCase();
        const action = (log.action || '').toLowerCase();
        return userName.includes(query) || details.includes(query) || action.includes(query);
      }

      return true;
    });
  }, [logs, filterType, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-structure pb-4">
        <div>
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2 font-headline">
            <ShieldCheckIcon className="w-6 h-6 text-primary" />
            Aktivitäts-Logbuch (Audit Trail)
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            Vollständige Protokollierung wichtiger Systemaktivitäten (Rechnungen, Stornierungen, Kunden, Logins).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
            {logs.length} Einträge
          </span>
          {logs.length > 0 && (
            <button
              onClick={handleDeleteAll}
              disabled={isDeleting}
              className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
              title="Alle Logs löschen"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Chips */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'Alle' },
            { id: 'invoices', label: 'Rechnungen & Storno' },
            { id: 'customers', label: 'Kunden' },
            { id: 'orders', label: 'Aufträge' },
            { id: 'logins', label: 'Logins' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterType === tab.id
                  ? 'bg-primary text-white font-semibold shadow-xs'
                  : 'bg-structure/40 text-text-muted hover:bg-structure hover:text-text-main'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <MagnifyingGlassIcon className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Suchen (Mitarbeiter, Details)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9 pr-3 py-1.5 text-xs w-full bg-bg-panel"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-bg-dark border border-structure rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[550px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 bg-bg-panel/95 backdrop-blur-md border-b border-structure z-10">
              <tr className="text-text-muted text-xs uppercase font-headline tracking-wider">
                <th className="p-3.5 font-bold">Zeitpunkt</th>
                <th className="p-3.5 font-bold">Mitarbeiter</th>
                <th className="p-3.5 font-bold">Aktion</th>
                <th className="p-3.5 font-bold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-structure/40">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-10 text-center text-text-muted">
                    <ClipboardDocumentListIcon className="w-10 h-10 text-text-muted/30 mx-auto mb-2" />
                    <p className="font-semibold text-text-main text-sm">Keine Aktivitäten gefunden</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {searchQuery ? 'Versuche andere Suchbegriffe.' : 'Sobald Aktionen im System ausgeführt werden, erscheinen sie hier.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-structure/20 transition-colors text-xs">
                    <td className="p-3.5 whitespace-nowrap min-w-[130px]">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      <div className="font-bold text-text-main flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                          {(log.userName || 'M').charAt(0).toUpperCase()}
                        </div>
                        <span>{log.userName || 'Mitarbeiter'}</span>
                      </div>
                    </td>
                    <td className="p-3.5 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="p-3.5 text-text-main leading-relaxed max-w-md break-words">
                      {log.details || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
