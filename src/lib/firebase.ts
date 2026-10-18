// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Browser-side guards against 1ms OS/V8 clock jitter in Firestore IndexedDB Multi-Tab Persistence
if (typeof window !== "undefined") {
  const win = window as typeof window & {
    __rothirschMonotonicDatePatched?: boolean;
    __rothirschFirestoreLogPatched?: boolean;
  };

  // 1. Ensure Date.now() is monotonically non-decreasing for minor (<5s) OS/NTP/V8 clock jitter
  // Prevents Firestore IndexedDbPersistence from seeing `updateTimeMs > Date.now()` by 1ms
  // and falsely invalidating the primary tab lease.
  if (!win.__rothirschMonotonicDatePatched) {
    win.__rothirschMonotonicDatePatched = true;
    const originalDateNow = Date.now.bind(Date);
    let lastTimestamp = 0;
    Date.now = () => {
      const current = originalDateNow();
      if (current < lastTimestamp && lastTimestamp - current < 5000) {
        return lastTimestamp;
      }
      lastTimestamp = current;
      return current;
    };
  }

  // 2. Downgrade harmless cross-tab Firestore clock-skew console.error messages to console.warn
  // so Next.js Dev Overlay does not treat 1ms multi-tab timestamp drift as an unhandled crash.
  if (!win.__rothirschFirestoreLogPatched) {
    win.__rothirschFirestoreLogPatched = true;
    const originalConsoleError = console.error.bind(console);
    console.error = (...args: unknown[]) => {
      const firstArg = typeof args[0] === "string" ? args[0] : "";
      const secondArg = typeof args[1] === "string" ? args[1] : "";
      if (
        (firstArg.includes("@firebase/firestore") || secondArg.includes("Firestore")) &&
        (firstArg.includes("Detected an update time that is in the future") ||
          secondArg.includes("Detected an update time that is in the future"))
      ) {
        console.warn(...args);
        return;
      }
      originalConsoleError(...args);
    };
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function initFirestoreClient(): Firestore {
  if (typeof window !== "undefined") {
    try {
      return initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      // Already initialized (e.g. during Next.js HMR / Fast Refresh)
      return getFirestore(app);
    }
  }
  return getFirestore(app);
}

export const auth = getAuth(app);
export const db = initFirestoreClient();
export const storage = getStorage(app);

export default app;

