"use client";
import { useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { OrderPDF } from './OrderPDF';
import { EmployeeSheetPDF } from './EmployeeSheetPDF';
import { InvoicePDF } from './InvoicePDF';
import { ProtocolPDF } from './ProtocolPDF';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';
import { useAuth } from '@/context/AuthContext';

export default function PDFDownloadButtonWrapper({ order, customer, type = 'order', className = '' }: { order: any, customer: any, type?: 'order' | 'employee' | 'invoice' | 'contract' | 'protocol', className?: string }) {
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

  if (!settings) return <button disabled className={`flex items-center justify-center gap-2 opacity-50 ${className}`}><ArrowDownTrayIcon className="w-4 h-4" /> Lade...</button>;

  const getDocument = () => {
    if (type === 'employee') return <EmployeeSheetPDF order={order} customer={customer} employeeName={employeeName} />;
    if (type === 'invoice') return <InvoicePDF order={order} customer={customer} settings={settings} employeeName={employeeName} />;
    if (type === 'contract') return <OrderPDF order={order} customer={customer} settings={settings} isContract={true} employeeName={employeeName} />;
    if (type === 'protocol') return <ProtocolPDF order={order} customer={customer} employeeName={employeeName} />;
    return <OrderPDF order={order} customer={customer} settings={settings} employeeName={employeeName} />;
  };

  const getFileName = () => {
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
    <PDFDownloadLink document={getDocument()} fileName={getFileName()}>
      {/* @ts-ignore */}
      {({ loading }) => (
        <button disabled={loading} className={`flex items-center justify-center gap-2 ${className}`}>
          <ArrowDownTrayIcon className="w-4 h-4" />
          {loading ? 'Generiere PDF...' : 'Als PDF herunterladen'}
        </button>
      )}
    </PDFDownloadLink>
  );
}
