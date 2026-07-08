"use client";
import { useState, useEffect } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { OrderPDF } from './OrderPDF';
import { EmployeeSheetPDF } from './EmployeeSheetPDF';
import { InvoicePDF } from './InvoicePDF';
import { ProtocolPDF } from './ProtocolPDF';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';
import { useAuth } from '@/context/AuthContext';

export default function InlinePDFViewerWrapper({ order, customer, type = 'order', forceLiveQuote = false }: { order: any, customer: any, type?: 'order' | 'employee' | 'invoice' | 'contract' | 'protocol', forceLiveQuote?: boolean }) {
  const [settings, setSettings] = useState<any>(null);
  const { profile } = useAuth();
  
  let employeeName = profile?.displayName || settings?.manager;
  if (!employeeName && profile?.email) {
    const namePart = profile.email.split('@')[0];
    employeeName = namePart.split(/[\.\-_]/).map((part: string) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }
  employeeName = employeeName || 'Rothirsch Team';

  useEffect(() => {
    getDoc(doc(db, getCol('system'), 'settings')).then(docSnap => {
      if(docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setSettings({ companyName: 'Dein Unternehmen', city: 'Musterstadt' });
      }
    });
  }, []);

  if (!settings) return <div className="animate-pulse p-8 flex justify-center text-gray-400">Lade PDF Vorschau...</div>;

  const getDocument = () => {
    if (type === 'employee') return <EmployeeSheetPDF order={order} customer={customer} employeeName={employeeName} />;
    if (type === 'invoice') return <InvoicePDF order={order} customer={customer} settings={settings} employeeName={employeeName} />;
    if (type === 'contract') return <OrderPDF order={order} customer={customer} settings={settings} isContract={true} employeeName={employeeName} />;
    if (type === 'protocol') return <ProtocolPDF order={order} customer={customer} employeeName={employeeName} />;
    
    // For 'order', use confirmedSnapshot if it exists and order is no longer in draft/quote, UNLESS forceLiveQuote is true
    const isPastQuote = ['confirmed', 'completed', 'invoice_open', 'invoice_paid', 'invoice_overdue', 'invoice_cancelled'].includes(order.status);
    const useSnapshot = isPastQuote && order.confirmedSnapshot && !forceLiveQuote;
    const orderData = useSnapshot ? order.confirmedSnapshot : order;
    
    // Add a flag if it's past quote but missing snapshot AND not forcing live quote
    if (isPastQuote && !order.confirmedSnapshot && !forceLiveQuote) {
      orderData._missingSnapshotWarning = true;
    }

    return <OrderPDF order={orderData} customer={customer} settings={settings} employeeName={employeeName} />;
  };

  return (
    <div className="w-full h-full min-h-[800px] bg-white rounded-xl overflow-hidden shadow-xl border border-structure flex flex-col">
      <PDFViewer width="100%" height="100%" className="border-none flex-1">
        {getDocument()}
      </PDFViewer>
    </div>
  );
}
