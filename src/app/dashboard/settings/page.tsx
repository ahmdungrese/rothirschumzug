"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { PlusIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const fetchServices = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'services'));
      const fetched = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(fetched);
    } catch (error) {
      console.error("Error fetching services", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPrice) return;
    
    try {
      await addDoc(collection(db, 'services'), {
        name: newName,
        defaultPrice: parseFloat(newPrice),
        createdAt: new Date()
      });
      setNewName("");
      setNewPrice("");
      fetchServices();
    } catch (error) {
      console.error("Error adding service", error);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Leistung wirklich löschen?")) return;
    try {
      await deleteDoc(doc(db, 'services', id));
      fetchServices();
    } catch (error) {
      console.error("Error deleting service", error);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Einstellungen</h1>
        <p className="text-text-muted mt-1">Verwalten Sie hier die Standardwerte für das System.</p>
      </div>

      <div className="panel border-t-4 border-t-primary shadow-xl">
        <h2 className="text-xl font-bold mb-6 text-white border-b border-structure pb-4">Standard-Leistungen (Matrix)</h2>
        
        <form onSubmit={handleAddService} className="flex flex-col sm:flex-row gap-4 mb-8 bg-bg-dark p-4 rounded-xl border border-structure">
          <div className="flex-1">
            <label className="block text-xs text-text-muted mb-1">Leistungs-Bezeichnung</label>
            <input 
              type="text" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              placeholder="z. B. Umzugskartons (Kauf)" 
              className="input-field"
              required 
            />
          </div>
          <div className="w-full sm:w-32">
            <label className="block text-xs text-text-muted mb-1">Standard-Preis (€)</label>
            <input 
              type="number" 
              value={newPrice} 
              onChange={(e) => setNewPrice(e.target.value)} 
              placeholder="0.00" 
              className="input-field"
              min="0" step="0.01"
              required 
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full sm:w-auto">
              <PlusIcon className="w-5 h-5" /> Hinzufügen
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-xl border border-structure">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-dark text-text-muted text-sm border-b border-structure">
                <th className="p-4 font-medium">Bezeichnung</th>
                <th className="p-4 font-medium w-32 text-right">Einzelpreis</th>
                <th className="p-4 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-text-muted italic">Keine Leistungen hinterlegt.</td>
                </tr>
              ) : (
                services.map((item) => (
                  <tr key={item.id} className="border-b border-structure/50 hover:bg-structure/20 transition-colors group">
                    <td className="p-4 text-white font-medium">{item.name}</td>
                    <td className="p-4 text-right">€ {item.defaultPrice.toFixed(2)}</td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDeleteService(item.id)} 
                        className="text-text-muted hover:text-red-400 p-2 rounded-lg hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
