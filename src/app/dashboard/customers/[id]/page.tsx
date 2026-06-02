"use client";
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, collection, query, where, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { PlusIcon, UserCircleIcon, PhoneIcon, MapPinIcon, DocumentTextIcon, XMarkIcon, EnvelopeIcon, StarIcon, CheckCircleIcon, PencilIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { PDFGenerator } from '@/components/pdf/PDFGenerator';
import { SignaturePad } from '@/components/ui/SignaturePad';
import { CustomerChecklist } from '@/components/customers/CustomerChecklist';
import { CustomerInventory } from '@/components/customers/CustomerInventory';

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [pdfType, setPdfType] = useState<'order' | 'employee'>('order');

  useEffect(() => {
    // Fetch Customer
    const docRef = doc(db, 'customers', customerId);
    const unsubCustomer = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setCustomer({ id: docSnap.id, ...docSnap.data() });
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching customer", error);
      setLoading(false);
    });

    // Fetch Orders
    const q = query(collection(db, 'orders'), where('customerId', '==', customerId));
    const unsubOrders = onSnapshot(q, (querySnapshot) => {
      const fetchedOrders = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      fetchedOrders.sort((a: any, b: any) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setOrders(fetchedOrders);
    }, (error) => {
      console.error("Error fetching orders", error);
    });

    return () => {
      unsubCustomer();
      unsubOrders();
    };
  }, [customerId]);

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-t-2 border-primary rounded-full"></div></div>;
  }

  if (!customer) {
    return <div className="text-center p-12 text-red-400">Kunde nicht gefunden.</div>;
  }

  const deleteOrder = async (orderId: string) => {
    if(confirm("Angebot/Auftrag wirklich löschen?")) {
      await deleteDoc(doc(db, 'orders', orderId));
    }
  };

  const handleUpdateOrderStatus = async (order: any, newStatus: string) => {
    try {
      const payload: any = { status: newStatus, updatedAt: serverTimestamp() };
      
      // Automatisierung: Wenn Angebot bestätigt wird, To-Dos generieren
      if (newStatus === 'confirmed') {
        const todos = [];
        if (order.logistics?.noParkingZone) {
          todos.push({ id: 'todo_' + Date.now() + 1, title: 'Halteverbot beantragen', isDone: false });
        }
        if (order.logistics?.furnitureLift) {
          todos.push({ id: 'todo_' + Date.now() + 2, title: 'Möbellift reservieren', isDone: false });
        }
        if (order.services?.some((s: any) => s.name.includes('karton'))) {
          todos.push({ id: 'todo_' + Date.now() + 3, title: 'Umzugskartons ausliefern', isDone: false });
        }
        payload.todos = todos;
        alert("Angebot bestätigt! Zugehörige To-Dos (z.B. Halteverbot) wurden generiert.");
      }
      
      await updateDoc(doc(db, 'orders', order.id), payload);
    } catch (error) {
      console.error("Fehler beim Update des Status", error);
      alert("Ein Fehler ist aufgetreten.");
    }
  };

  const totalRevenue = orders.filter(o => o.status === 'quote').reduce((sum, o) => sum + (o.totals?.gross || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* 360-Degree Header Card */}
      <div className="panel bg-gradient-to-br from-bg-panel to-bg-dark border-l-4 border-l-primary relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 opacity-5 pointer-events-none">
          <UserCircleIcon className="w-64 h-64 -mt-12 -mr-12" />
        </div>

        <div className="flex flex-col md:flex-row items-start gap-6 relative z-10">
          <div className="shrink-0">
            <Image src="/5.png" alt="Customer Profile" width={100} height={100} className="rounded-full border-2 border-structure object-cover bg-bg-dark shadow-lg" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              {customer.firstName} {customer.lastName}
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {customer.phone && (
                <div className="flex items-center gap-2 text-text-muted">
                  <PhoneIcon className="w-5 h-5 text-primary" />
                  <span>{customer.phone}</span>
                  <a href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noreferrer" className="ml-3 bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-xs px-3 py-1 rounded-full font-semibold hover:bg-[#25D366]/20 transition-colors shadow-sm flex items-center gap-1">
                    WhatsApp
                  </a>
                </div>
              )}
              {customer.email && (
                <div className="flex items-center gap-2 text-text-muted">
                  <EnvelopeIcon className="w-5 h-5 text-primary" />
                  <span>{customer.email}</span>
                  <a href={`mailto:${customer.email}`} className="ml-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs px-3 py-1 rounded-full font-semibold hover:bg-blue-500/20 transition-colors shadow-sm flex items-center gap-1">
                    E-Mail schreiben
                  </a>
                </div>
              )}
              {customer.billingAddress?.street && (
                <div className="flex items-center gap-2 text-text-muted">
                  <MapPinIcon className="w-5 h-5 text-primary" />
                  <span>{customer.billingAddress.street}, {customer.billingAddress.city}</span>
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 mt-4 md:mt-0 flex flex-col gap-3">
            <button 
              onClick={() => router.push(`/dashboard/customers/${customerId}/new-order`)}
              className="btn-primary shadow-lg shadow-primary/20 w-full justify-center"
            >
              <PlusIcon className="w-5 h-5" /> Neues Angebot
            </button>
            {customer.phone && (
              <a 
                href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hallo ${customer.firstName}, wir hoffen, Ihr Umzug lief perfekt! Wir würden uns riesig über eine kleine Google-Bewertung freuen. Liebe Grüße vom Rothirsch-Team! \n\n[Hier Google-Link einfügen]`)}`}
                target="_blank" 
                rel="noreferrer"
                className="btn-secondary w-full justify-center border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
              >
                <StarIcon className="w-5 h-5" /> Bewertung anfragen
              </a>
            )}
          </div>
        </div>
      </div>

      {selectedOrder && (
        <div className="panel border-t-4 border-t-primary shadow-2xl relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">
              Dokumenten-Vorschau: {selectedOrder.status === 'draft' ? 'Entwurf' : 'Angebot / Auftrag'}
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex bg-bg-dark rounded-lg p-1 border border-structure">
                <button 
                  onClick={() => setPdfType('order')} 
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${pdfType === 'order' ? 'bg-structure text-white' : 'text-text-muted hover:text-white'}`}
                >
                  Kunden-PDF
                </button>
                <button 
                  onClick={() => setPdfType('employee')} 
                  className={`px-3 py-1 rounded-md text-sm transition-colors ${pdfType === 'employee' ? 'bg-structure text-white' : 'text-text-muted hover:text-white'}`}
                >
                  Mitarbeiter-Laufzettel
                </button>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)} 
                className="p-2 bg-bg-dark text-text-muted hover:text-white rounded-full transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>
          <PDFGenerator order={selectedOrder} customer={customer} type={pdfType} />
          
          {selectedOrder.customerSignature ? (
            <div className="mt-6 panel border border-green-500/30 bg-green-500/5">
              <h3 className="font-semibold text-green-400 mb-2">✅ Dokument wurde digital unterschrieben</h3>
              <p className="text-xs text-text-muted mb-4">Unterschrift vom: {new Date(selectedOrder.signatureDate?.toMillis()).toLocaleString('de-DE')}</p>
              <img src={selectedOrder.customerSignature} alt="Kundenunterschrift" className="bg-white rounded p-2 h-32 object-contain" />
            </div>
          ) : (
            <SignaturePad 
              orderId={selectedOrder.id} 
              onSigned={() => {
                alert("Erfolgreich unterschrieben!");
                setSelectedOrder({...selectedOrder, customerSignature: 'pending'}); // Optimistic update to trigger refresh on close
                // Ideally we refetch the order, but forcing close makes them reopen it to see the sig
              }} 
            />
          )}
        </div>
      )}

      {/* Tabs / Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="panel">
            <h3 className="text-lg font-semibold mb-4 border-b border-structure pb-3 text-text-main flex items-center gap-2">
              📄 Historie (Angebote & Aufträge)
            </h3>
            
            {orders.length === 0 ? (
              <div className="text-center py-12 text-text-muted italic border-2 border-dashed border-structure rounded-xl bg-bg-dark/30">
                Noch keine Dokumente vorhanden.
                <div className="mt-4">
                  <button 
                    onClick={() => router.push(`/dashboard/customers/${customerId}/new-order`)}
                    className="text-primary hover:text-primary-hover font-medium underline underline-offset-4"
                  >
                    Erstes Angebot erstellen
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map(order => (
                  <div key={order.id} className="flex items-center justify-between p-4 rounded-xl border border-structure bg-bg-dark hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${order.status === 'quote' ? 'bg-primary/20 text-primary' : 'bg-structure text-text-muted'}`}>
                        <DocumentTextIcon className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white">
                          {order.status === 'quote' ? 'Angebot' : 'Entwurf'} 
                          {order.orderNumber ? ` #${order.orderNumber}` : ''}
                        </h4>
                        <p className="text-sm text-text-muted">
                          {new Date(order.createdAt?.toMillis() || Date.now()).toLocaleDateString('de-DE')} • {order.services?.length || 0} Leistungen
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Workflow Actions */}
                      <div className="flex flex-wrap items-center gap-2 border-r border-structure pr-4 mr-2">
                        {order.status === 'draft' && (
                          <button onClick={() => handleUpdateOrderStatus(order, 'quote')} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20">
                            Entwurf abschließen
                          </button>
                        )}
                        {order.status === 'quote' && (
                          <button onClick={() => handleUpdateOrderStatus(order, 'confirmed')} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20">
                            <CheckIcon className="w-4 h-4" /> Angebot bestätigt
                          </button>
                        )}
                        {order.status === 'confirmed' && (
                          <button onClick={() => handleUpdateOrderStatus(order, 'completed')} className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20">
                            Umzug abgeschlossen
                          </button>
                        )}
                        {(order.status === 'completed' || order.status === 'invoice_open') && (
                          <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-structure text-text-main">
                            <CheckCircleIcon className="w-4 h-4" /> Finalisiert
                          </span>
                        )}
                      </div>
                      
                      <div className="text-right hidden lg:block">
                        <div className="text-sm text-text-muted">Brutto</div>
                        <div className="font-bold text-white">€ {order.totals?.gross?.toFixed(2) || '0.00'}</div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedOrder(order)}
                          className="btn-secondary text-sm shrink-0"
                        >
                          PDF
                        </button>
                        
                        <button 
                          onClick={() => router.push(`/dashboard/customers/${customerId}/edit-order/${order.id}`)}
                          className="p-2 text-text-muted hover:text-primary transition-colors bg-bg-dark rounded-md border border-structure"
                          title="Bearbeiten"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => deleteOrder(order.id)}
                          className="p-2 text-text-muted hover:text-red-400 transition-colors bg-bg-dark rounded-md border border-structure"
                          title="Löschen"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="panel border-t-4 border-t-structure shadow-lg">
            <h3 className="text-lg font-semibold mb-4 border-b border-structure pb-3 text-text-main">
              💶 Finanzübersicht
            </h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center p-3 bg-bg-dark rounded-lg">
                <span className="text-text-muted">Gesamtumsatz (Angebote):</span>
                <span className="font-semibold text-primary text-base">€ {totalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-bg-dark rounded-lg border border-transparent">
                <span className="text-text-muted">Offene Posten:</span>
                <span className="font-semibold text-text-main text-base">€ 0,00</span>
              </div>
            </div>
          </div>
          
          <CustomerInventory customer={customer} />
          
          <CustomerChecklist customer={customer} />
        </div>
      </div>

    </div>
  );
}
