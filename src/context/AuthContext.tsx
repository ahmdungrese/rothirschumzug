"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

interface UserProfile {
  uid: string;
  email: string | null;
  role: "admin" | "employee";
  displayName: string | null;
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          
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
              role: "employee", // default role
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
            role: "employee",
            displayName: currentUser.displayName,
          });
        }
      } else {
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
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
