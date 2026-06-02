"use client";

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { CheckCircleIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

export function CustomerChecklist({ customer }: { customer: any }) {
  const [items, setItems] = useState<{ id: string, text: string, done: boolean }[]>(
    customer.checklist || [
      { id: '1', text: 'Halteverbotszone beantragt', done: false },
      { id: '2', text: 'Umzugskartons geliefert', done: false }
    ]
  );
  const [newItemText, setNewItemText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const saveToFirebase = async (newItems: any[]) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'customers', customer.id), {
        checklist: newItems
      });
    } catch (error) {
      console.error("Error saving checklist", error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleItem = (id: string) => {
    const updated = items.map(item => item.id === id ? { ...item, done: !item.done } : item);
    setItems(updated);
    saveToFirebase(updated);
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    const updated = [...items, { id: Date.now().toString(), text: newItemText.trim(), done: false }];
    setItems(updated);
    setNewItemText('');
    saveToFirebase(updated);
  };

  const removeItem = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    saveToFirebase(updated);
  };

  return (
    <div className="panel border-t-4 border-t-primary shadow-lg">
      <div className="flex justify-between items-center mb-4 border-b border-structure pb-3">
        <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
          📋 Mitarbeiter-Checkliste
        </h3>
        {isSaving && <span className="text-xs text-text-muted animate-pulse">Speichert...</span>}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
        {items.length === 0 ? (
          <p className="text-sm text-text-muted italic text-center py-4">Keine Punkte vorhanden.</p>
        ) : (
          items.map(item => (
            <div 
              key={item.id} 
              className={`flex items-center justify-between p-3 rounded-xl border transition-all ${item.done ? 'bg-primary/5 border-primary/20' : 'bg-bg-dark border-structure hover:border-primary/50'}`}
            >
              <button 
                onClick={() => toggleItem(item.id)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                {item.done ? (
                  <CheckCircleIconSolid className="w-6 h-6 text-primary shrink-0" />
                ) : (
                  <CheckCircleIcon className="w-6 h-6 text-text-muted shrink-0" />
                )}
                <span className={`text-sm font-medium transition-all ${item.done ? 'text-text-muted line-through' : 'text-white'}`}>
                  {item.text}
                </span>
              </button>
              <button 
                onClick={() => removeItem(item.id)}
                className="text-text-muted hover:text-red-400 p-1 rounded-lg hover:bg-red-400/10 transition-all opacity-50 hover:opacity-100"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <form onSubmit={addItem} className="mt-4 relative">
        <input 
          type="text" 
          value={newItemText}
          onChange={(e) => setNewItemText(e.target.value)}
          placeholder="Neuer Punkt (z.B. Schlüsselübergabe)"
          className="input-field pr-10 text-sm"
        />
        <button type="submit" disabled={!newItemText.trim()} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary hover:text-primary-hover disabled:opacity-50 transition-colors">
          <PlusIcon className="w-5 h-5" />
        </button>
      </form>
      <p className="text-xs text-text-muted mt-3 italic text-center">
        Diese Liste taucht automatisch auf dem Mitarbeiter-Laufzettel (PDF) auf.
      </p>
    </div>
  );
}
