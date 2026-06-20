"use client";
import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { XMarkIcon, TruckIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { getCol } from '@/lib/demoMode';

export function DispoModal({ order, onClose, onSuccess }: { order: any, onClose: () => void, onSuccess?: () => void }) {
  const [movingDate, setMovingDate] = useState('');
  const [movingTime, setMovingTime] = useState('');
  const [helpers, setHelpers] = useState(2);
  const [koffer35t, setKoffer35t] = useState(1);
  const [lkw7t, setLkw7t] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Pre-fill from order disposition if it exists
    if (order.disposition) {
      if (order.disposition.movingDate) {
        // Handle old single datetime-local string
        const parts = order.disposition.movingDate.split('T');
        setMovingDate(parts[0] || '');
        setMovingTime(parts[1] || '');
      } else {
        if (order.disposition.movingDateStr) setMovingDate(order.disposition.movingDateStr);
        if (order.disposition.movingTimeStr) setMovingTime(order.disposition.movingTimeStr);
      }
      if (order.disposition.helpers !== undefined) setHelpers(order.disposition.helpers);
      if (order.disposition.koffer35t !== undefined) setKoffer35t(order.disposition.koffer35t);
      if (order.disposition.lkw7t !== undefined) setLkw7t(order.disposition.lkw7t);
    } else {
      // Pre-fill from orderMeta
      if (order.orderMeta?.movingDateFrom) {
        // Usually movingDateFrom is a date string like '2026-08-15'
        setMovingDate(order.orderMeta.movingDateFrom);
      } else if (order.orderMeta?.movingDateTo) {
        setMovingDate(order.orderMeta.movingDateTo);
      }
      setMovingTime('08:00'); // Default start time
    }
  }, [order]);

  const generateTodos = (currentHelpers: number, currentKoffer: number, currentLkw: number) => {
    const todos = order.todos || [];
    
    // Halteverbot
    if (order.logistics?.noParkingZone && !todos.some((t:any) => t.title === 'Halteverbot beantragen')) {
      todos.push({ id: 'todo_' + Date.now() + 1, title: 'Halteverbot beantragen', isDone: false });
    }
    // Möbellift
    if (order.logistics?.furnitureLift && !todos.some((t:any) => t.title === 'Möbellift reservieren')) {
      todos.push({ id: 'todo_' + Date.now() + 2, title: 'Möbellift reservieren', isDone: false });
    }
    // Kartons
    if (order.services?.some((s: any) => s.name.toLowerCase().includes('karton')) && !todos.some((t:any) => t.title === 'Umzugskartons ausliefern')) {
      todos.push({ id: 'todo_' + Date.now() + 3, title: 'Umzugskartons ausliefern', isDone: false });
    }
    // Fahrzeuge
    if ((currentKoffer > 0 || currentLkw > 0) && !todos.some((t:any) => t.title.includes('Fahrzeug mieten'))) {
      todos.push({ id: 'todo_' + Date.now() + 4, title: `Fahrzeug mieten (${currentKoffer}x 3,5t | ${currentLkw}x 7,5t)`, isDone: false });
    }
    // Mitarbeiter
    if (currentHelpers > 0 && !todos.some((t:any) => t.title === 'Mitarbeiter einteilen')) {
      todos.push({ id: 'todo_' + Date.now() + 5, title: 'Mitarbeiter einteilen', isDone: false });
    }
    
    return todos;
  };

  const confirmAndDispatch = async () => {
    if (!movingDate) {
      toast.error('Bitte ein Datum auswählen.');
      return;
    }
    
    setIsSaving(true);
    try {
      const dispoData = {
        movingDate: movingDate && movingTime ? `${movingDate}T${movingTime}` : movingDate, // Backwards compatibility
        movingDateStr: movingDate,
        movingTimeStr: movingTime,
        helpers,
        koffer35t,
        lkw7t
      };

      const todos = generateTodos(helpers, koffer35t, lkw7t);

      await updateDoc(doc(db, getCol('orders'), order.id), {
        status: 'confirmed',
        disposition: dispoData,
        todos: todos
      });
      
      toast.success("Auftrag erfolgreich disponiert und bestätigt!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Fehler bei der Disposition.");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmOnly = async () => {
    setIsSaving(true);
    try {
      // Wenn wir nur bestätigen, übernehmen wir trotzdem die System-Todos (ohne Helfer/Auto spezifische Todos)
      const todos = generateTodos(0, 0, 0); 
      
      await updateDoc(doc(db, getCol('orders'), order.id), {
        status: 'confirmed',
        todos: todos
      });
      
      toast.success("Auftrag bestätigt (Ressourcen können später im Kalender geplant werden)!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Fehler beim Bestätigen.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-bg-panel border border-structure rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-structure flex justify-between items-center bg-bg-dark shrink-0">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <TruckIcon className="w-6 h-6 text-primary" /> Grob-Disposition
          </h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main rounded-full transition-colors">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          <p className="text-sm text-text-muted">
            Der Kunde hat das Angebot angenommen! Du kannst jetzt direkt die Kapazitäten für diesen Umzug eintragen, oder ihn einfach bestätigen und die Planung später im Kalender nachholen.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Umzugsdatum</label>
              <input 
                type="date" 
                value={movingDate}
                onChange={(e) => setMovingDate(e.target.value)}
                className="input-field py-2 px-3 w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">Uhrzeit</label>
              <input 
                type="time" 
                value={movingTime}
                onChange={(e) => setMovingTime(e.target.value)}
                className="input-field py-2 px-3 w-full"
              />
            </div>
          </div>
          <p className="text-xs text-primary mt-1 italic -mt-4">Dieser Termin wird rot im Kalender blockiert.</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 border border-structure rounded-xl bg-bg-dark">
              <label className="block text-sm font-medium text-text-muted mb-2">Umzugshelfer</label>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setHelpers(Math.max(0, helpers - 1))} className="btn-secondary py-1 px-3 text-lg">-</button>
                <span className="font-bold text-xl w-8 text-center">{helpers}</span>
                <button type="button" onClick={() => setHelpers(helpers + 1)} className="btn-secondary py-1 px-3 text-lg">+</button>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-text-muted">Benötigte Fahrzeuge</h3>
            <div className="flex items-center justify-between p-3 border border-structure rounded-xl bg-bg-dark">
              <span className="font-medium text-sm">Koffer 3,5 Tonnen</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setKoffer35t(Math.max(0, koffer35t - 1))} className="btn-secondary py-0.5 px-2">-</button>
                <span className="font-bold w-4 text-center">{koffer35t}</span>
                <button type="button" onClick={() => setKoffer35t(koffer35t + 1)} className="btn-secondary py-0.5 px-2">+</button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 border border-structure rounded-xl bg-bg-dark">
              <span className="font-medium text-sm">LKW 7,5 Tonnen</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setLkw7t(Math.max(0, lkw7t - 1))} className="btn-secondary py-0.5 px-2">-</button>
                <span className="font-bold w-4 text-center">{lkw7t}</span>
                <button type="button" onClick={() => setLkw7t(lkw7t + 1)} className="btn-secondary py-0.5 px-2">+</button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-structure bg-bg-dark flex flex-col sm:flex-row justify-between gap-3 shrink-0">
          <button onClick={onClose} className="btn-secondary border-structure/50 hover:bg-structure/30">Abbrechen</button>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={confirmOnly} disabled={isSaving} className="btn-secondary bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 text-sm">
              Nur Bestätigen (Planung später)
            </button>
            <button onClick={confirmAndDispatch} disabled={isSaving} className="btn-primary text-sm">
              {isSaving ? 'Speichert...' : 'Bestätigen & Planen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
