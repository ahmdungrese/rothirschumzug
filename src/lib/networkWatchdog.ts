/**
 * Network and Database Watchdog Utility for Rothirsch Umzug App
 * Monitors Firestore latency, detects deadlocks, and dispatches timeout warnings.
 */

export class DatabaseTimeoutError extends Error {
  constructor(message: string = 'Zeitüberschreitung bei der Datenbankverbindung / انتهت مهلة الاتصال بقاعدة البيانات') {
    super(message);
    this.name = 'DatabaseTimeoutError';
  }
}

/**
 * Wraps any asynchronous promise (e.g. Firestore getDoc, addDoc, updateDoc) with latency monitoring.
 * - After warnAfterMs (default 12s): Dispatches a latency event to notify NetworkMonitor.
 * - After timeoutMs (default 40s): Rejects with DatabaseTimeoutError to prevent infinite hanging.
 */
export async function withDbTimeout<T>(
  promise: Promise<T>,
  options: {
    timeoutMs?: number;
    warnAfterMs?: number;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    timeoutMs = 40000,
    warnAfterMs = 12000,
    operationName = 'Datenbankoperation'
  } = options;

  let warningTimer: any = null;
  let timeoutTimer: any = null;

  if (typeof window !== 'undefined') {
    // 1. Warning timer after 12 seconds
    warningTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('rothirsch_db_timeout', {
        detail: { operationName, elapsedMs: warnAfterMs }
      }));
    }, warnAfterMs);
  }

  // 2. Hard timeout promise after timeoutMs (40 seconds max)
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      reject(new DatabaseTimeoutError(
        `Zeitüberschreitung (${Math.round(timeoutMs / 1000)}s) bei ${operationName}. Keine Antwort vom Server. Bitte Internetverbindung prüfen. / انتهت مهلة الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.`
      ));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (warningTimer) clearTimeout(warningTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }
}

/**
 * Formats Firebase or network errors into clear, bilingual, human-readable explanations.
 */
export function formatFriendlyError(error: any, contextDescription: string = 'Vorgang'): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Keine Internetverbindung / لا يوجد اتصال بالإنترنت. Bitte prüfen Sie Ihre WLAN- oder Mobilfunkverbindung.';
  }

  if (error instanceof DatabaseTimeoutError || error?.name === 'DatabaseTimeoutError') {
    return error.message;
  }

  const code = error?.code || '';
  const msg = error?.message || String(error || '');

  if (code === 'permission-denied' || msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
    return 'Keine Berechtigung / لا تملك صلاحية كافية. Ihr Benutzerkonto hat keine Schreibrechte für diesen Vorgang.';
  }

  if (code === 'unavailable' || msg.includes('unavailable') || msg.includes('network-request-failed')) {
    return 'Verbindungsproblem / مشكلة في الاتصال بالخادم. Der Cloud-Dienst ist momentan nicht erreichbar.';
  }

  if (code === 'resource-exhausted') {
    return 'Server-Limit erreicht / تم تجاوز حد الطلبات في الخادم. Bitte versuchen Sie es in Kürze erneut.';
  }

  if (msg.includes('Nachname') || msg.includes('Pflichtfeld')) {
    return msg;
  }

  return `Fehler bei ${contextDescription}: ${msg}`;
}
