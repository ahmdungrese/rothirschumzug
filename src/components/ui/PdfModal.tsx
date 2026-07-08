import { XMarkIcon } from '@heroicons/react/24/outline';
import { InlinePDFViewer } from '@/components/pdf/InlinePDFViewer';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';
import { useAuth } from '@/context/AuthContext';
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';

interface PdfModalProps {
  order: any;
  customer: any;
  type: 'order' | 'contract' | 'employee' | 'invoice' | 'protocol';
  onClose: () => void;
  forceLiveQuote?: boolean;
}

export function PdfModal({ order, customer, type, onClose, forceLiveQuote = false }: PdfModalProps) {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    getDoc(doc(db, getCol('system'), 'settings')).then(docSnap => {
      if(docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setSettings({ companyName: 'Dein Unternehmen' });
      }
    });
  }, []);

  if (!order || !customer) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-bg-dark/95 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-structure bg-bg-panel shadow-md shrink-0">
        <h2 className="text-xl font-bold text-text-main flex items-center gap-3">
          Dokumenten Ansicht
          <span className="text-sm font-normal text-text-muted bg-white/5 px-2 py-1 rounded">
            {type === 'invoice' ? 'Rechnung' : type === 'protocol' ? 'Protokoll' : 'Angebot/Auftrag'}
          </span>
        </h2>
        <div className="flex items-center gap-4">
          <PDFDownloadButton 
            order={order} 
            customer={customer} 
            type={type} 
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-colors" 
          />
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-text-muted hover:text-white transition-colors border border-structure bg-bg-dark"
            title="Schließen"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-black/20 custom-scrollbar">
        <div className="w-full h-full flex items-start justify-center pb-12">
          {settings ? (
            <InlinePDFViewer 
              order={order} 
              customer={customer} 
              type={type}
              forceLiveQuote={forceLiveQuote}
            />
          ) : (
            <div className="text-text-muted animate-pulse mt-20">Lade Vorschau...</div>
          )}
        </div>
      </div>
    </div>
  );
}
