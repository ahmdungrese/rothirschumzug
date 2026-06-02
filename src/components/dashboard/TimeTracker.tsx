"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { PlayIcon, StopIcon } from '@heroicons/react/24/outline';

export function TimeTracker() {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchActiveSession = async () => {
      try {
        const q = query(
          collection(db, 'time_entries'), 
          where('userId', '==', user.uid),
          where('endTime', '==', null)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setActiveSession({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
        }
      } catch (error) {
        console.error("Error fetching time session", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchActiveSession();
  }, [user]);

  const clockIn = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'time_entries'), {
        userId: user.uid,
        startTime: serverTimestamp(),
        endTime: null,
        totalMinutes: 0
      });
      setActiveSession({ id: docRef.id, startTime: Timestamp.now() });
    } catch (error) {
      console.error("Error clocking in", error);
    } finally {
      setIsLoading(false);
    }
  };

  const clockOut = async () => {
    if (!user || !activeSession) return;
    setIsLoading(true);
    try {
      const now = new Date();
      const start = activeSession.startTime?.toDate() || now;
      const diffMinutes = Math.round((now.getTime() - start.getTime()) / 60000);
      
      await updateDoc(doc(db, 'time_entries', activeSession.id), {
        endTime: serverTimestamp(),
        totalMinutes: diffMinutes
      });
      setActiveSession(null);
    } catch (error) {
      console.error("Error clocking out", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="panel animate-pulse h-32 bg-structure/30"></div>;
  }

  return (
    <div className="panel border-t-4 border-t-blue-500 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-white flex items-center justify-between">
        <span>⏱️ Zeiterfassung</span>
        {activeSession && (
          <span className="text-xs bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full animate-pulse">
            Eingestempelt
          </span>
        )}
      </h2>
      
      <div className="flex gap-4">
        {!activeSession ? (
          <button 
            onClick={clockIn} 
            className="flex-1 btn-primary py-4 text-lg justify-center shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
          >
            <PlayIcon className="w-6 h-6 mr-2" /> Kommen
          </button>
        ) : (
          <button 
            onClick={clockOut} 
            className="flex-1 bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 py-4 rounded-xl text-lg font-semibold flex items-center justify-center shadow-lg shadow-red-500/10 hover:scale-[1.02] transition-transform"
          >
            <StopIcon className="w-6 h-6 mr-2" /> Gehen
          </button>
        )}
      </div>
      
      {activeSession && (
        <p className="text-center text-text-muted mt-4 text-sm">
          Sie haben sich am {new Date(activeSession.startTime?.toMillis() || Date.now()).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr eingestempelt.
        </p>
      )}
    </div>
  );
}
