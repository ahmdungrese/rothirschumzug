"use client";
import { useState, useEffect } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { OrderPDF } from './OrderPDF';
import { EmployeeSheetPDF } from './EmployeeSheetPDF';
import { InvoicePDF } from './InvoicePDF';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';

export default function PDFViewerWrapper({ order, customer, type = 'order' }: { order: any, customer: any, type?: 'order' | 'employee' | 'invoice' | 'contract' }) {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, getCol('system'), 'settings')).then(docSnap => {
      if(docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        // Fallback
        setSettings({ companyName: 'Dein Unternehmen', city: 'Musterstadt' });
      }
    });
  }, []);

  if (!settings) return <div className="p-12 text-center text-white">Lade PDF-Ressourcen...</div>;

  const getDocument = () => {
    if (type === 'employee') return <EmployeeSheetPDF order={order} customer={customer} />;
    if (type === 'invoice') return <InvoicePDF order={order} customer={customer} settings={settings} />;
    if (type === 'contract') return <OrderPDF order={order} customer={customer} settings={settings} isContract={true} />;
    return <OrderPDF order={order} customer={customer} settings={settings} />;
  };

  const getFileName = () => {
    const lastName = customer?.lastName || 'Kunde';
    const company = settings?.companyName?.replace(/[^a-zA-Z0-9]/g, '_') || 'Rothirsch';
    const address = order?.logistics?.b_street?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unbekannt';
    const orderNum = order?.orderNumber || order?.id?.substring(0,6) || 'Entwurf';
    
    if (type === 'employee') return `${company}_Laufzettel_${lastName}_${address}.pdf`;
    if (type === 'invoice') return `${company}_Rechnung_${order?.invoiceNumber || orderNum}.pdf`;
    if (type === 'contract') return `${company}_Auftragsbestaetigung_${order?.contractNumber || orderNum}.pdf`;
    return `${company}_Angebot_${orderNum}.pdf`;
  };

  return (
    <div className="space-y-4">
      {/* Universal Download Bar for all document types */}
      <div className="bg-bg-panel border border-structure p-3 rounded-xl flex items-center justify-between shadow-sm">
        <div>
          <h3 className="font-semibold text-white">
            {type === 'employee' ? 'Team-Laufzettel herunterladen' : 
             type === 'invoice' ? 'Rechnung herunterladen' : 
             type === 'contract' ? 'Auftragsbestätigung herunterladen' : 
             'Angebot herunterladen'}
          </h3>
          <p className="text-xs text-text-muted">Klicke hier für den sauberen Dateinamen ({getFileName()})</p>
        </div>
        <PDFDownloadLink document={getDocument()} fileName={getFileName()}>
          {/* @ts-ignore */}
          {({ blob, url, loading, error }) => (
            <button disabled={loading} className="btn-primary flex items-center gap-2 px-4 py-2">
              <ArrowDownTrayIcon className="w-4 h-4" />
              {loading ? 'Generiere...' : 'Als PDF speichern'}
            </button>
          )}
        </PDFDownloadLink>
      </div>

      <div className="h-[600px] border border-structure rounded-xl overflow-hidden shadow-2xl relative">
        <PDFViewer width="100%" height="100%" className="border-none">
          {getDocument() as React.ReactElement}
        </PDFViewer>
      </div>
    </div>
  );
}
