import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { ArchiveBoxArrowDownIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from '../pdf/InvoicePDF';
import { useAuth } from '@/context/AuthContext';

export function MonthlyExportPanel() {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
  });
  const [isExporting, setIsExporting] = useState(false);
  const { profile } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchRangeData = async () => {
    const settingsDoc = await getDoc(doc(db, 'system', 'settings'));
    const settings = settingsDoc.exists() ? settingsDoc.data() : { companyName: 'Umzugsunternehmen' };

    const q = query(collection(db, 'orders'));
    const snapshot = await getDocs(q);
    const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filteredOrders = allOrders.filter(order => {
      if (!['completed', 'invoice_open', 'invoice_overdue', 'invoice_paid'].includes(order.status)) return false;
      if (!order.invoiceNumber) return false;

      const dateVal = order.invoiceDate || order.createdAt;
      if (!dateVal) return false;
      
      const date = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
      return date >= start && date <= end;
    });

    return { filteredOrders, settings };
  };

  const generateCSV = (orders: any[]) => {
    const headers = ['Rechnungsnummer', 'Datum', 'Kunde', 'Netto', 'MwSt', 'Brutto', 'Status'];
    const rows = orders.map(order => {
      const date = order.invoiceDate ? 
        (order.invoiceDate.toDate ? order.invoiceDate.toDate() : new Date(order.invoiceDate)) : 
        (order.createdAt?.toDate ? order.createdAt.toDate() : new Date());

      const net = order.totals?.net || 0;
      const tax = order.totals?.tax || 0;
      const gross = order.totals?.gross || 0;
      const name = order.customer?.type === 'firma' ? order.customer?.lastName : `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim();

      return [
        order.invoiceNumber,
        date.toLocaleDateString('de-DE'),
        `"${name || order.customerName || 'Unbekannt'}"`,
        net.toFixed(2).replace('.', ','),
        tax.toFixed(2).replace('.', ','),
        gross.toFixed(2).replace('.', ','),
        order.status
      ].join(';');
    });

    return [headers.join(';'), ...rows].join('\n');
  };

  const handleExportCSV = async () => {
    if (!startDate || !endDate) return toast.error("Bitte Zeitraum auswählen.");
    setIsExporting(true);
    const toastId = toast.loading('Sammle Rechnungsdaten...');

    try {
      const { filteredOrders } = await fetchRangeData();
      
      if (filteredOrders.length === 0) {
        toast.error(`Keine Rechnungen im Zeitraum gefunden.`, { id: toastId });
        setIsExporting(false);
        return;
      }

      const csvContent = generateCSV(filteredOrders);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `Rechnungen_${startDate}_bis_${endDate}.csv`);
      
      toast.success(`${filteredOrders.length} Rechnungen exportiert!`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Fehler beim CSV Export.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportZIP = async () => {
    if (!startDate || !endDate) return toast.error("Bitte Zeitraum auswählen.");
    setIsExporting(true);
    const toastId = toast.loading('Sammle Daten und generiere PDFs (dies kann einen Moment dauern)...');

    try {
      const { filteredOrders, settings } = await fetchRangeData();
      
      if (filteredOrders.length === 0) {
        toast.error(`Keine Rechnungen im Zeitraum gefunden.`, { id: toastId });
        setIsExporting(false);
        return;
      }

      const zip = new JSZip();
      const csvContent = generateCSV(filteredOrders);
      zip.file(`Rechnungsuebersicht_${startDate}_bis_${endDate}.csv`, '\ufeff' + csvContent);

      const managerName = profile?.displayName || profile?.email || 'Mitarbeiter';
      
      let count = 0;
      for (const order of filteredOrders) {
        count++;
        toast.loading(`Generiere PDF ${count} von ${filteredOrders.length}...`, { id: toastId });
        
        const customerData = order.customer || {
          firstName: order.customerName?.split(' ')[0] || '',
          lastName: order.customerName?.split(' ').slice(1).join(' ') || order.customerName,
          type: 'privat'
        };

        const pdfComponent = <InvoicePDF order={order} customer={customerData} settings={settings} employeeName={managerName} />;
        
        const asPdf = pdf(pdfComponent);
        const blob = await asPdf.toBlob();
        
        let company = settings.companyName || 'Rothirsch';
        company = company.replace(/[^a-z0-9]/gi, '_');
        const fileName = `Rechnung_${order.invoiceNumber}_${company}.pdf`;
        
        zip.file(`Rechnungen/${fileName}`, blob);
      }

      toast.loading('Packe ZIP-Archiv...', { id: toastId });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `Rechnungen_Export_${startDate}_bis_${endDate}.zip`);

      toast.success(`Download komplett! (${filteredOrders.length} Rechnungen)`, { id: toastId });

    } catch (error) {
      console.error(error);
      toast.error('Kritischer Fehler beim ZIP Export.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-bg-panel border border-structure rounded-xl shadow-xl mb-6 mt-8 overflow-hidden">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-structure/20 transition-colors text-left"
      >
        <div className="flex-1">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <ArchiveBoxArrowDownIcon className="w-6 h-6 text-primary" />
            Rechnungen herunterladen
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Lade eine Übersicht und alle PDFs der Rechnungen in einem bestimmten Zeitraum herunter.
          </p>
        </div>
        <div className="flex-shrink-0 ml-4">
          <span className="text-sm font-medium text-primary">
            {isExpanded ? 'Zuklappen' : 'Öffnen'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="p-6 pt-0 border-t border-structure/50 bg-bg-panel/50 animate-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col sm:flex-row gap-4 items-center w-full p-4 bg-bg-dark border border-structure rounded-lg mt-4">
            
            <div className="flex items-center gap-4 flex-1">
              <div className="flex flex-col flex-1">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Von</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                  className="input-field w-full max-w-[200px]"
                  disabled={isExporting}
                />
              </div>
              <div className="flex flex-col flex-1">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Bis</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                  className="input-field w-full max-w-[200px]"
                  disabled={isExporting}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button 
                onClick={handleExportZIP} 
                disabled={isExporting}
                className="btn-primary flex items-center justify-center gap-2 text-sm w-full sm:w-auto px-6"
              >
                <ArchiveBoxArrowDownIcon className="w-4 h-4" />
                ZIP inkl. PDFs laden
              </button>
              <button 
                onClick={handleExportCSV} 
                disabled={isExporting}
                className="btn-secondary flex items-center justify-center gap-2 text-sm w-full sm:w-auto px-4"
              >
                <DocumentArrowDownIcon className="w-4 h-4" />
                Nur CSV-Tabelle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
