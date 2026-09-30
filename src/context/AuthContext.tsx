"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { logActivity } from "@/lib/activityLogger";

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
    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Vorherigen Dokument-Listener beenden, falls vorhanden
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);

        // Echtzeit-Listener: Sofortiger Abruf aus lokalem Cache & Server, ganz ohne Race-Condition
        unsubscribeDoc = onSnapshot(userDocRef, (userDocSnap) => {
          if (userDocSnap.exists()) {
            const data = userDocSnap.data() as UserProfile;
            setProfile(data);

            // Login-Aktivität genau einmal pro Sitzung mit echtem Namen loggen
            if (typeof window !== "undefined" && !sessionStorage.getItem("hasLoggedLogin")) {
              sessionStorage.setItem("hasLoggedLogin", "true");
              const cleanLoginName = data.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Mitarbeiter');
              logActivity(currentUser.uid, cleanLoginName, 'LOGIN', 'Erfolgreich am System angemeldet');
            }
          } else {
            console.warn("Benutzer existiert in Auth, hat aber kein Profil in users-Collection.");
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Fehler beim Abruf des Benutzerprofils:", error);
          setProfile(null);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const logout = async () => {
    try {
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
