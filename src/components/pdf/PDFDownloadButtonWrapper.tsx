"use client";
import { useState, useEffect } from 'react';
import { PDFDownloadLink, BlobProvider } from '@react-pdf/renderer';
import { ArrowDownTrayIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { OrderPDF } from './OrderPDF';
import { EmployeeSheetPDF } from './EmployeeSheetPDF';
import { InvoicePDF } from './InvoicePDF';
import { ProtocolPDF } from './ProtocolPDF';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

export default function PDFDownloadButtonWrapper({ 
  order, 
  customer, 
  type = 'order', 
  className = '', 
  iconOnly = false, 
  customIcon = null,
  openInNewTab = false
}: { 
  order: any, 
  customer: any, 
  type?: 'order' | 'employee' | 'invoice' | 'contract' | 'protocol', 
  className?: string, 
  iconOnly?: boolean, 
  customIcon?: React.ReactNode,
  openInNewTab?: boolean
}) {
  const [settings, setSettings] = useState<any>(null);
  const { profile } = useAuth();
  
  const isTeamLead = profile?.role === 'teamlead' || profile?.canViewPrices === false;
  const resolvedType = isTeamLead && type !== 'protocol' ? 'employee' : type;

  const candidates = [
    order?.orderMeta?.contactPerson,
    order?.contactPerson,
    customer?.contactPerson,
    settings?.contacts?.[0],
    settings?.manager,
    profile?.displayName,
  ];
  const employeeName = candidates.find(c => typeof c === 'string' && c.trim().length > 0 && !c.includes('@'))?.trim() || 'Tarek Lababidi';

  useEffect(() => {
    getDoc(doc(db, 'system', 'settings')).then(docSnap => {
      if(docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setSettings({ companyName: 'Rothirsch Umzug', city: 'Bochum', street: 'Haydnstr. 16', zip: '44805', email: 'info@rothirsch-umzug.de' });
      }
    });
  }, []);

  if (!settings) {
    return (
      <button disabled className={`flex items-center justify-center gap-2 opacity-50 ${className}`} title="Lade...">
        {customIcon || (openInNewTab ? <ArrowTopRightOnSquareIcon className="w-4 h-4" /> : <ArrowDownTrayIcon className="w-4 h-4" />)}
        {!iconOnly && " Lade..."}
      </button>
    );
  }

  const getDocument = () => {
    if (resolvedType === 'employee') return <EmployeeSheetPDF order={order} customer={customer} employeeName={employeeName} settings={settings} />;
    if (resolvedType === 'invoice') return <InvoicePDF order={order} customer={customer} settings={settings} employeeName={employeeName} />;
    if (resolvedType === 'contract') return <OrderPDF order={order} customer={customer} settings={settings} isContract={true} employeeName={employeeName} />;
    if (resolvedType === 'protocol') return <ProtocolPDF order={order} customer={customer} employeeName={employeeName} settings={settings} />;
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

    if (resolvedType === 'employee') return `Laufzettel - ${suffix} - ${address}.pdf`;
    if (resolvedType === 'invoice') {
      const isKorr = Boolean(order?.isKorrektur || order?.isCorrection);
      const isStorno = Boolean(order?.isStorno);
      const prefix = isStorno ? 'Stornorechnung' : (isKorr ? 'Korrekturrechnung' : 'Rechnung');
      return `${prefix} ${order?.invoiceNumber || orderNum} - ${suffix}.pdf`;
    }
    if (resolvedType === 'contract') return `Auftragsbestätigung ${order?.contractNumber || orderNum} - ${suffix}.pdf`;
    if (resolvedType === 'protocol') return `Protokoll ${order?.contractNumber || orderNum} - ${suffix}.pdf`;
    return `Angebot ${orderNum} - ${suffix}.pdf`;
  };

  if (openInNewTab) {
    return (
      <BlobProvider document={getDocument()}>
        {/* @ts-ignore */}
        {({ url, loading }) => (
          <a
            href={url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (loading || !url) e.preventDefault();
            }}
            className={`flex items-center justify-center gap-1.5 cursor-pointer ${loading ? 'opacity-50 pointer-events-none' : ''} ${className}`}
            title="In neuem Tab / Vollbild öffnen"
          >
            {customIcon || <ArrowTopRightOnSquareIcon className="w-4 h-4" />}
            {!iconOnly && (loading ? 'Lade...' : 'Neuer Tab')}
          </a>
        )}
      </BlobProvider>
    );
  }

  return (
    <PDFDownloadLink
      document={getDocument()}
      fileName={getFileName()}
      className={`flex items-center justify-center gap-2 ${className}`}
      title="Als PDF herunterladen"
    >
      {/* @ts-ignore */}
      {({ loading }) => (
        <>
          {customIcon || <ArrowDownTrayIcon className="w-4 h-4" />}
          {!iconOnly && (loading ? 'Generiere PDF...' : 'Als PDF herunterladen')}
        </>
      )}
    </PDFDownloadLink>
  );
}
