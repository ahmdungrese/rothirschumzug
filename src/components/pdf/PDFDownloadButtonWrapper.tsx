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

export default function PDFDownloadButtonWrapper({ order, customer, type = 'order', className = '', iconOnly = false, customIcon = null }: { order: any, customer: any, type?: 'order' | 'employee' | 'invoice' | 'contract' | 'protocol', className?: string, iconOnly?: boolean, customIcon?: React.ReactNode }) {
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
        setSettings({ companyName: 'Rothirschumzug', city: 'Bochum' });
      }
    });
  }, []);

  if (!settings) return <button disabled className={`flex items-center justify-center gap-2 opacity-50 ${className}`} title="Lade...">{customIcon || <ArrowDownTrayIcon className="w-4 h-4" />}{!iconOnly && " Lade..."}</button>;

  const getDocument = () => {
    if (type === 'employee') return <EmployeeSheetPDF order={order} customer={customer} employeeName={employeeName} />;
    if (type === 'invoice') return <InvoicePDF order={order} customer={customer} settings={settings} employeeName={employeeName} />;
    if (type === 'contract') return <OrderPDF order={order} customer={customer} settings={settings} isContract={true} employeeName={employeeName} />;
    if (type === 'protocol') return <ProtocolPDF order={order} customer={customer} employeeName={employeeName} />;
    return <OrderPDF order={order} customer={customer} settings={settings} employeeName={employeeName} />;
  };

  const getFileName = () => {
    let customerNameStr = '';
    let companyStr = '';
    
    if (customer?.type === 'firma') {
        companyStr = customer?.lastName || 'Firma';
        customerNameStr = customer?.firstName || '';
    } else {
        customerNameStr = `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim() || 'Kunde';
        companyStr = ''; 
    }
    
    const orderNum = order?.orderNumber || 'Entwurf';
    
    const suffixParts = [];
    if (companyStr) suffixParts.push(companyStr);
    if (customerNameStr) suffixParts.push(customerNameStr);
    const suffix = suffixParts.join(' - ');
    
    const address = order?.logistics?.b_street ? `${order.logistics.b_street} ${order.logistics.b_houseNr || ''}`.trim() : 'Unbekannt';

    if (type === 'employee') return `Laufzettel - ${suffix} - ${address}.pdf`;
    if (type === 'invoice') return `Rechnung ${order?.invoiceNumber || orderNum} - ${suffix}.pdf`;
    if (type === 'contract') return `Auftragsbestätigung ${order?.contractNumber || orderNum} - ${suffix}.pdf`;
    if (type === 'protocol') return `Protokoll ${order?.contractNumber || orderNum} - ${suffix}.pdf`;
    return `Angebot ${orderNum} - ${suffix}.pdf`;
  };

  return (
    <PDFDownloadLink document={getDocument()} fileName={getFileName()}>
      {/* @ts-ignore */}
      {({ loading }) => (
        <button disabled={loading} className={`flex items-center justify-center gap-2 ${className}`} title={loading ? 'Generiere PDF...' : 'Als PDF herunterladen'}>
          {customIcon || <ArrowDownTrayIcon className="w-4 h-4" />}
          {!iconOnly && (loading ? 'Generiere PDF...' : 'Als PDF herunterladen')}
        </button>
      )}
    </PDFDownloadLink>
  );
}
