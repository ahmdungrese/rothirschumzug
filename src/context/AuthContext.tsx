"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { logActivity } from "@/lib/activityLogger";
import { getCol } from '@/lib/demoMode';

interface UserProfile {
  uid: string;
  email: string | null;
  role: "admin" | "office" | "teamlead";
  displayName: string | null;
  canEditPrices?: boolean;
  canViewPrices?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("demoMode") === "true") {
      const demoUser = { uid: "demo-user-123", email: "demo@rothirsch-app.de", displayName: "Demo Account" } as any;
      setUser(demoUser);
      setProfile({ uid: demoUser.uid, email: demoUser.email, role: "admin", displayName: demoUser.displayName });
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const userDocRef = doc(db, getCol('users'), currentUser.uid);
          
          // Use Promise.race to add a timeout to getDoc so it doesn't hang indefinitely if Firestore is not initialized
          const timeoutPromise = new Promise((resolve) => 
            setTimeout(() => resolve({ _isTimeout: true }), 300)
          );
          
          const docPromise = getDoc(userDocRef);
          docPromise.catch(() => {}); // prevent unhandled rejection if it fails later
          
          const userDocSnap = await Promise.race([
            docPromise,
            timeoutPromise
          ]) as any;
          
          if (userDocSnap && userDocSnap._isTimeout) {
            throw new Error("Firestore timeout");
          }
          
          if (userDocSnap && userDocSnap.exists && userDocSnap.exists()) {
            setProfile(userDocSnap.data() as UserProfile);
          } else {
            // Fallback profile if not explicitly created in Firestore
            setProfile({
              uid: currentUser.uid,
              email: currentUser.email,
              role: "admin", // default role zu admin geändert, damit man nicht ausgesperrt wird
              displayName: currentUser.displayName,
            });
          }
        } catch (error: any) {
          if (error.message !== "Firestore timeout") {
            console.error("Error fetching user profile:", error);
          }
          // Set fallback profile even on error to prevent being locked out
          setProfile({
            uid: currentUser.uid,
            email: currentUser.email,
            role: "admin", // default role zu admin geändert
            displayName: currentUser.displayName,
          });
        }
      } else {
        setProfile(null);
      }
      
      // Log login activity once per session
      if (currentUser && typeof window !== "undefined" && !sessionStorage.getItem("hasLoggedLogin")) {
        sessionStorage.setItem("hasLoggedLogin", "true");
        logActivity(currentUser.uid, currentUser.displayName || currentUser.email || 'Unbekannt', 'LOGIN', 'Erfolgreich angemeldet');
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("demoMode");
      }
      await signOut(auth);
      if (typeof window !== "undefined") {
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
