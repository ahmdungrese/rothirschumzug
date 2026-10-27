"use client";
import { useState, useEffect } from 'react';
import { PDFViewer, pdf } from '@react-pdf/renderer';
import { ArrowTopRightOnSquareIcon, ArrowDownTrayIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { OrderPDF } from './OrderPDF';
import { EmployeeSheetPDF } from './EmployeeSheetPDF';
import { InvoicePDF } from './InvoicePDF';
import { ProtocolPDF } from './ProtocolPDF';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';

export default function InlinePDFViewerWrapper({ order, customer, type = 'order', forceLiveQuote = false }: { order: any, customer: any, type?: 'order' | 'employee' | 'invoice' | 'contract' | 'protocol', forceLiveQuote?: boolean }) {
  const [settings, setSettings] = useState<any>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileBlobUrl, setMobileBlobUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { profile } = useAuth();

  const isTeamLead = profile?.role === 'teamlead' || profile?.canViewPrices === false;
  const resolvedType = isTeamLead && type !== 'protocol' ? 'employee' : type;

  useEffect(() => {
    const checkMobile = () => {
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      const isSmall = window.innerWidth < 1024;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile((isTouch && isSmall) || isMobileUA);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
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

  const getDocument = () => {
    if (resolvedType === 'employee') return <EmployeeSheetPDF order={order} customer={customer} employeeName={employeeName} settings={settings} />;
    if (resolvedType === 'invoice') return <InvoicePDF order={order} customer={customer} settings={settings} employeeName={employeeName} />;
    if (resolvedType === 'contract') return <OrderPDF order={order} customer={customer} settings={settings} isContract={true} employeeName={employeeName} />;
    if (resolvedType === 'protocol') return <ProtocolPDF order={order} customer={customer} employeeName={employeeName} settings={settings} />;
    
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

  const getDocTitle = () => {
    if (resolvedType === 'invoice') return (order?.isKorrektur || order?.isCorrection) ? 'Korrekturrechnung' : order?.isStorno ? 'Stornorechnung' : 'Rechnung';
    if (resolvedType === 'employee') return 'Mitarbeiter-Laufzettel';
    if (resolvedType === 'protocol') return 'Übergabeprotokoll';
    if (resolvedType === 'contract') return 'Auftragsbestätigung';
    return 'Angebot';
  };

  const getDocNumber = () => {
    if (resolvedType === 'invoice') return order?.invoiceNumber || (order?.orderNumber ? `R-${order.orderNumber}` : '#RECHNUNG');
    return order?.orderNumber || (order?.id ? `#${order.id.slice(-5).toUpperCase()}` : '#DOKUMENT');
  };

  // Generate blob for mobile / touch devices
  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (isMobile && settings) {
      setIsGenerating(true);
      try {
        const docElement = getDocument();
        pdf(docElement).toBlob().then(blob => {
          if (!active) return;
          createdUrl = URL.createObjectURL(blob);
          setMobileBlobUrl(createdUrl);
          setIsGenerating(false);
        }).catch(err => {
          console.error("Error generating mobile PDF blob:", err);
          if (active) setIsGenerating(false);
        });
      } catch (err) {
        console.error("Error creating PDF doc:", err);
        setIsGenerating(false);
      }
    }

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [isMobile, settings, order, customer, type]);

  if (!settings) return <div className="animate-pulse p-8 flex justify-center text-gray-400">Lade PDF Vorschau...</div>;

  // On mobile & tablet: render high-performance touch-optimized native viewer launcher
  if (isMobile) {
    return (
      <div className="w-full max-w-sm sm:max-w-md mx-auto my-auto p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-4 animate-in fade-in duration-200">
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#6E8F64]/10 text-[#6E8F64] mx-auto flex items-center justify-center">
          <DocumentTextIcon className="w-8 h-8" />
        </div>

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E8F64] bg-[#6E8F64]/10 px-2.5 py-0.5 rounded-full inline-block mb-1.5 font-headline">
            Mobilgeräte-Vorschau
          </span>
          <h3 className="text-base sm:text-lg font-bold font-headline text-slate-900 dark:text-white">
            {getDocTitle()} {getDocNumber()}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Für {customer?.firstName || ''} {customer?.lastName || customer?.company || 'Kunde'}
          </p>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
          Tippe auf den Button unten, um das Dokument direkt im nativen PDF-Viewer deines Geräts (mit Touch-Zoom, WhatsApp-Teilen & Drucken) zu öffnen.
        </p>

        {isGenerating ? (
          <div className="py-4 flex flex-col items-center gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            <span className="text-xs text-slate-400">PDF wird für Smartphone aufbereitet...</span>
          </div>
        ) : mobileBlobUrl ? (
          <div className="space-y-2.5 pt-1">
            <a
              href={mobileBlobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3.5 px-5 rounded-2xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              <span>Vollbild PDF öffnen (Nativer Betrachter)</span>
            </a>

            <a
              href={mobileBlobUrl}
              download={`${getDocTitle()} ${getDocNumber()}.pdf`}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span>PDF-Datei herunterladen</span>
            </a>
          </div>
        ) : (
          <div className="text-xs text-amber-600">PDF konnte nicht geladen werden. Bitte erneut versuchen.</div>
        )}
      </div>
    );
  }

  // On desktop: render full native iframe viewer
  return (
    <div className="w-full h-full min-h-[800px] bg-white rounded-xl overflow-hidden shadow-xl border border-structure flex flex-col">
      <PDFViewer width="100%" height="100%" className="border-none flex-1">
        {getDocument()}
      </PDFViewer>
    </div>
  );
}
