// src/lib/notificationService.ts
// Native Android & Browser Notification Engine for Rothirsch ERP
// Strict Zero-Emoji policy, 2D app-native design, and role-aware de-duplication

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface DeviceNotificationPayload {
  id: string;
  title: string;
  body: string;
  tag?: string;
  url?: string;
  icon?: string;
  silent?: boolean;
}

const STORAGE_KEY_NOTIFIED = 'rothirsch_notified_alarms';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermissionStatus {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission as NotificationPermissionStatus;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (!isNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission as NotificationPermissionStatus;
  } catch (err) {
    console.warn('Fehler beim Anfordern der Benachrichtigungs-Berechtigung:', err);
    return 'denied';
  }
}

export function hasAlreadyNotified(id: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFIED);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    return Array.isArray(list) && list.includes(id);
  } catch {
    return false;
  }
}

export function markAsNotified(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFIED);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(id)) {
      list.push(id);
      // Keep list bounded to last 200 notified alerts to prevent unlimited growth
      const trimmed = list.slice(-200);
      localStorage.setItem(STORAGE_KEY_NOTIFIED, JSON.stringify(trimmed));
    }
  } catch {}
}

export async function showDeviceNotification(payload: DeviceNotificationPayload): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  // De-duplication check: Avoid buzzing phone repeatedly for the same alert
  if (hasAlreadyNotified(payload.id)) {
    return false;
  }

  const notificationOptions = {
    body: payload.body,
    icon: payload.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || payload.id,
    silent: payload.silent ?? false,
    vibrate: [150, 80, 150],
    data: {
      url: payload.url || '/dashboard',
      id: payload.id
    }
  };

  try {
    // 1. Preferred method on Android PWA: ServiceWorker Registration
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && 'showNotification' in registration) {
          await registration.showNotification(payload.title, notificationOptions);
          markAsNotified(payload.id);
          return true;
        }
      } catch (swErr) {
        console.warn('ServiceWorker showNotification nicht verfügbar, verwende Fallback:', swErr);
      }
    }

    // 2. Standard Native Browser Notification Fallback
    const n = new Notification(payload.title, notificationOptions);
    n.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (payload.url) {
        window.location.href = payload.url;
      }
      n.close();
    };
    markAsNotified(payload.id);
    return true;
  } catch (err) {
    console.error('Fehler beim Anzeigen der Benachrichtigung:', err);
    return false;
  }
}
