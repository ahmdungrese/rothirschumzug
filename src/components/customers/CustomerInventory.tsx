"use client";

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { PlusIcon, TrashIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { InventoryPDF } from '@/components/pdf/InventoryPDF';

export function CustomerInventory({ customer }: { customer: any }) {
  const [items, setItems] = useState<{ id: string, name: string, quantity: number }[]>(
    customer.inventory || []
  );
  const [appendInventoryToPDF, setAppendInventoryToPDF] = useState(
    customer.appendInventoryToPDF || false
  );
  
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);

  const saveToFirebase = async (newItems: any[], appendToPdfFlag: boolean) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'customers', customer.id), {
        inventory: newItems,
        appendInventoryToPDF: appendToPdfFlag
      });
    } catch (error) {
      console.error("Error saving inventory", error);
    } finally {
      setIsSaving(false);
    }
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || newQuantity < 1) return;
    const updated = [...items, { id: Date.now().toString(), name: newName.trim(), quantity: newQuantity }];
    setItems(updated);
    setNewName('');
    setNewQuantity(1);
    saveToFirebase(updated, appendInventoryToPDF);
  };

  const removeItem = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    saveToFirebase(updated, appendInventoryToPDF);
  };

  const toggleAppendToPdf = () => {
    const newVal = !appendInventoryToPDF;
    setAppendInventoryToPDF(newVal);
    saveToFirebase(items, newVal);
  };

  return (
    <div className="panel border-t-4 border-t-primary shadow-lg mb-6">
      <div className="flex justify-between items-start mb-4 border-b border-structure pb-3">
        <div>
          <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
            🛋️ Umzugsgut / Inventar-Liste
          </h3>
          <p className="text-xs text-text-muted mt-1">Für Jobcenter, Ämter oder interne Planung.</p>
        </div>
        {isSaving && <span className="text-xs text-text-muted animate-pulse">Speichert...</span>}
      </div>

      <div className="mb-4 flex items-center justify-between bg-bg-dark p-3 rounded-xl border border-structure">
        <span className="text-sm text-text-muted font-medium">Als Seite 5 ans Angebot hängen?</span>
        <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${appendInventoryToPDF ? 'bg-primary shadow-[0_0_8px_rgba(143,22,39,0.5)]' : 'bg-structure'}`} onClick={toggleAppendToPdf}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${appendInventoryToPDF ? 'translate-x-6' : 'translate-x-1'}`} />
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
        {items.length === 0 ? (
          <p className="text-sm text-text-muted italic text-center py-4">Kein Umzugsgut erfasst.</p>
        ) : (
          items.map(item => (
            <div 
              key={item.id} 
              className="flex items-center justify-between p-3 rounded-xl border bg-bg-dark border-structure hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-primary font-bold text-sm bg-primary/10 px-2 py-1 rounded">{item.quantity}x</span>
                <span className="text-white text-sm font-medium">{item.name}</span>
              </div>
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

      <form onSubmit={addItem} className="mt-4 flex gap-2">
        <input 
          type="number" 
          value={newQuantity}
          onChange={(e) => setNewQuantity(parseInt(e.target.value) || 1)}
          className="input-field w-20 text-center"
          min="1"
        />
        <input 
          type="text" 
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Möbelstück (z.B. Sofa)"
          className="input-field flex-1"
        />
        <button type="submit" disabled={!newName.trim()} className="btn-primary px-3 py-2">
          <PlusIcon className="w-5 h-5" />
        </button>
      </form>

      {items.length > 0 && (
        <div className="mt-4 pt-4 border-t border-structure">
          <PDFDownloadLink 
            document={<InventoryPDF customer={customer} items={items} />} 
            fileName={`Inventarliste_${customer.lastName}.pdf`}
            className="w-full btn-secondary justify-center flex items-center gap-2"
          >
            {({ loading }) => (
              <>
                <DocumentArrowDownIcon className="w-5 h-5" />
                {loading ? 'Generiere PDF...' : 'Separat als PDF herunterladen'}
              </>
            )}
          </PDFDownloadLink>
        </div>
      )}
    </div>
  );
}
