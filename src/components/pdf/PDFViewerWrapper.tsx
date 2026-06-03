"use client";
import { useState, useEffect } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import { OrderPDF } from './OrderPDF';
import { EmployeeSheetPDF } from './EmployeeSheetPDF';
import { InvoicePDF } from './InvoicePDF';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function PDFViewerWrapper({ order, customer, type = 'order' }: { order: any, customer: any, type?: 'order' | 'employee' | 'invoice' }) {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, 'system', 'settings')).then(docSnap => {
      if(docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        // Fallback
        setSettings({ companyName: 'Dein Unternehmen', city: 'Musterstadt' });
      }
    });
  }, []);

  if (!settings) return <div className="p-12 text-center text-white">Lade PDF-Ressourcen...</div>;

  return (
    <div className="w-full h-[800px] rounded-xl overflow-hidden shadow-xl border border-structure">
      <PDFViewer width="100%" height="100%">
        {type === 'employee' ? <EmployeeSheetPDF order={order} customer={customer} /> : 
         type === 'invoice' ? <InvoicePDF order={order} customer={customer} settings={settings} /> :
         <OrderPDF order={order} customer={customer} settings={settings} />}
      </PDFViewer>
    </div>
  );
}
