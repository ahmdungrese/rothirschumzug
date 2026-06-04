"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { getCol } from '@/lib/demoMode';

export function ActivityLogViewer() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, getCol('activity_logs')), orderBy("timestamp", "desc"), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  return (
    <div className="space-y-4 mt-12">
      <div>
        <h2 className="text-xl font-bold text-white mb-2">Aktivitäts-Logbuch</h2>
        <p className="text-text-muted text-sm">Übersicht der letzten 100 Systemaktivitäten (Logins, Änderungen).</p>
      </div>

      <div className="bg-bg-dark border border-structure rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
        <table className="w-full text-left border-collapse relative">
          <thead className="sticky top-0 bg-structure/90 backdrop-blur-md">
            <tr className="text-text-muted text-sm">
              <th className="p-4 font-medium">Zeitpunkt</th>
              <th className="p-4 font-medium">Mitarbeiter</th>
              <th className="p-4 font-medium">Aktion</th>
              <th className="p-4 font-medium">Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-structure/50 hover:bg-structure/20 text-sm">
                <td className="p-4 text-text-muted">
                  {log.timestamp ? new Date(log.timestamp.toMillis()).toLocaleString('de-DE') : 'Gerade eben'}
                </td>
                <td className="p-4 font-medium text-white">{log.userName}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    log.action === 'LOGIN' ? 'bg-green-500/20 text-green-400' :
                    log.action.includes('ARCHIVE') || log.action.includes('DELETE') ? 'bg-red-500/20 text-red-400' :
                    'bg-blue-500/20 text-blue-400'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="p-4 text-text-muted">{log.details}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-text-muted italic">Keine Aktivitäten gefunden.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
