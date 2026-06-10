"use client";
import { useState, useEffect } from 'react';
import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { OrderPDF } from './OrderPDF';
import { EmployeeSheetPDF } from './EmployeeSheetPDF';
import { InvoicePDF } from './InvoicePDF';
import { ProtocolPDF } from './ProtocolPDF';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';
import { useAuth } from '@/context/AuthContext';

export default function PDFViewerWrapper({ order, customer, type = 'order' }: { order: any, customer: any, type?: 'order' | 'employee' | 'invoice' | 'contract' | 'protocol' }) {
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
        // Fallback
        setSettings({ companyName: 'Dein Unternehmen', city: 'Musterstadt' });
      }
    });
  }, []);

  if (!settings) return <div className="p-12 text-center text-text-main">Lade PDF-Ressourcen...</div>;

  const getDocument = () => {
    if (type === 'employee') return <EmployeeSheetPDF order={order} customer={customer} employeeName={employeeName} />;
    if (type === 'invoice') return <InvoicePDF order={order} customer={customer} settings={settings} employeeName={employeeName} />;
    if (type === 'contract') return <OrderPDF order={order} customer={customer} settings={settings} isContract={true} employeeName={employeeName} />;
    if (type === 'protocol') return <ProtocolPDF order={order} customer={customer} employeeName={employeeName} />;
    return <OrderPDF order={order} customer={customer} settings={settings} employeeName={employeeName} />;
  };

  const getFileName = () => {
    // Sichere Daten für den Dateinamen extrahieren
    const customerName = customer?.type === 'firma' ? customer?.lastName : `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
    const safeCustomerName = customerName || 'Kunde';
    
    const company = settings?.companyName || 'Rothirsch Umzüge';
    const address = order?.logistics?.b_street ? `${order.logistics.b_street} ${order.logistics.b_houseNr || ''}`.trim() : 'Unbekannt';
    const orderNum = order?.orderNumber || 'Entwurf';
    
    if (type === 'employee') return `Laufzettel - ${safeCustomerName} - ${address}.pdf`;
    if (type === 'invoice') return `Rechnung ${order?.invoiceNumber || orderNum} - ${company}.pdf`;
    if (type === 'contract') return `Auftragsbestätigung ${order?.contractNumber || orderNum} - ${company}.pdf`;
    if (type === 'protocol') return `Protokoll ${order?.contractNumber || orderNum} - ${safeCustomerName}.pdf`;
    return `Angebot ${orderNum} - ${company} - ${safeCustomerName}.pdf`;
  };

  return (
    <div className="flex flex-col h-full w-full gap-4">
      {/* Universal Download Bar for all document types */}
      <div className="shrink-0 bg-bg-panel border border-structure p-3 rounded-xl flex items-center justify-between shadow-sm">
        <div>
          <h3 className="font-semibold text-text-main">
            {type === 'employee' ? 'Team-Laufzettel herunterladen' : 
             type === 'invoice' ? 'Rechnung herunterladen' : 
             type === 'contract' ? 'Auftragsbestätigung herunterladen' : 
             type === 'protocol' ? 'Protokoll herunterladen' :
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

      <div className="flex-1 min-h-[600px] border border-structure rounded-xl overflow-hidden shadow-2xl relative">
        <PDFViewer width="100%" height="100%" className="border-none">
          {getDocument() as React.ReactElement}
        </PDFViewer>
      </div>
    </div>
  );
}
