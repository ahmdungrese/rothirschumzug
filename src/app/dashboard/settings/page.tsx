"use client";
import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { PlusIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

export default function SettingsPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'services'), (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setServices(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching services", error);
      setLoading(false);
    });

    return () => unsubscribe();
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
    } catch (error) {
      console.error("Error adding service", error);
    }
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm("Leistung wirklich löschen?")) return;
    try {
      await deleteDoc(doc(db, 'services', id));
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
        
        {services.length === 0 && (
          <button 
            onClick={async () => {
              if(!confirm("Datenbank mit Testdaten (Kunde + Leistungen) befüllen?")) return;
              try {
                const stdServices = [
                  { name: "Umzugskartons (Kauf)", defaultPrice: 2.50 },
                  { name: "Umzugskartons (Miete)", defaultPrice: 1.00 },
                  { name: "Kleiderboxen", defaultPrice: 15.00 },
                  { name: "Halteverbotszone (Einrichtung)", defaultPrice: 85.00 },
                  { name: "Möbellift inkl. Bediener (pro Std)", defaultPrice: 75.00 },
                  { name: "Möbelmontage (Stundensatz)", defaultPrice: 35.00 },
                  { name: "Packservice (Stundensatz)", defaultPrice: 30.00 },
                ];
                for (const s of stdServices) {
                  await addDoc(collection(db, 'services'), { ...s, createdAt: serverTimestamp() });
                }
                const customerRef = await addDoc(collection(db, 'customers'), {
                  firstName: "Max", lastName: "Mustermann", email: "max.mustermann@example.com", phone: "+49 151 12345678",
                  billingAddress: { street: "Musterstraße 1", zip: "44787", city: "Bochum" },
                  createdAt: serverTimestamp(), updatedAt: serverTimestamp()
                });
                await addDoc(collection(db, 'orders'), {
                  customerId: customerRef.id, status: "quote", totals: { net: 1000, tax: 190, gross: 1190 },
                  createdAt: serverTimestamp(), updatedAt: serverTimestamp()
                });
                alert("Datenbank erfolgreich befüllt!");
              } catch (e: any) { alert("Fehler: " + e.message); }
            }}
            className="mt-4 bg-blue-500/20 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-500/30 transition"
          >
            🚀 Demo-Daten (Leistungen & Kunde) generieren
          </button>
        )}
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
