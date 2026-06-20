import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';
import { toast } from 'react-hot-toast';
import { ArchiveBoxArrowDownIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from '../pdf/InvoicePDF';
import { useAuth } from '@/context/AuthContext';

export function MonthlyExportPanel() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isExporting, setIsExporting] = useState(false);
  const { profile } = useAuth();

  const fetchMonthData = async () => {
    // 1. Hole Einstellungen (für PDF Generierung)
    const settingsDoc = await getDoc(doc(db, getCol('system'), 'settings'));
    const settings = settingsDoc.exists() ? settingsDoc.data() : { companyName: 'Umzugsunternehmen' };

    // 2. Hole Aufträge
    const q = query(collection(db, getCol('orders')));
    const snapshot = await getDocs(q);
    const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

    // 3. Filtere nach Monat & Rechnungs-Status
    const [year, month] = selectedMonth.split('-');
    
    const filteredOrders = allOrders.filter(order => {
      // Nur echte Rechnungen (abgeschlossen oder Rechnung gestellt)
      if (!['completed', 'invoice_open', 'invoice_overdue', 'invoice_paid'].includes(order.status)) return false;
      if (!order.invoiceNumber) return false;

      // Datum prüfen (bevorzuge Rechnungsdatum, ansonsten Erstelldatum)
      const dateVal = order.invoiceDate || order.createdAt;
      if (!dateVal) return false;
      
      const date = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
      const orderYear = date.getFullYear();
      const orderMonth = date.getMonth() + 1;

      return orderYear === parseInt(year) && orderMonth === parseInt(month);
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
    if (!selectedMonth) return toast.error("Bitte Monat auswählen.");
    setIsExporting(true);
    const toastId = toast.loading('Sammle Rechnungsdaten...');

    try {
      const { filteredOrders } = await fetchMonthData();
      
      if (filteredOrders.length === 0) {
        toast.error(`Keine Rechnungen im ${selectedMonth} gefunden.`, { id: toastId });
        setIsExporting(false);
        return;
      }

      const csvContent = generateCSV(filteredOrders);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // \ufeff for Excel UTF-8 BOM
      saveAs(blob, `Rechnungen_${selectedMonth}.csv`);
      
      toast.success(`${filteredOrders.length} Rechnungen exportiert!`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Fehler beim CSV Export.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportZIP = async () => {
    if (!selectedMonth) return toast.error("Bitte Monat auswählen.");
    setIsExporting(true);
    const toastId = toast.loading('Sammle Daten und generiere PDFs (dies kann einen Moment dauern)...');

    try {
      const { filteredOrders, settings } = await fetchMonthData();
      
      if (filteredOrders.length === 0) {
        toast.error(`Keine Rechnungen im ${selectedMonth} gefunden.`, { id: toastId });
        setIsExporting(false);
        return;
      }

      const zip = new JSZip();

      // 1. Füge CSV hinzu
      const csvContent = generateCSV(filteredOrders);
      zip.file(`Rechnungsuebersicht_${selectedMonth}.csv`, '\ufeff' + csvContent);

      // 2. Generiere alle PDFs und füge sie hinzu
      const managerName = profile?.displayName || profile?.email || 'Mitarbeiter';
      
      let count = 0;
      for (const order of filteredOrders) {
        count++;
        toast.loading(`Generiere PDF ${count} von ${filteredOrders.length}...`, { id: toastId });
        
        // Use either order.customer or construct from order if missing
        const customerData = order.customer || {
          firstName: order.customerName?.split(' ')[0] || '',
          lastName: order.customerName?.split(' ').slice(1).join(' ') || order.customerName,
          type: 'privat'
        };

        const pdfComponent = <InvoicePDF order={order} customer={customerData} settings={settings} employeeName={managerName} />;
        
        const asPdf = pdf(pdfComponent);
        const blob = await asPdf.toBlob();
        
        // Sanitize filename
        let company = settings.companyName || 'Rothirsch';
        company = company.replace(/[^a-z0-9]/gi, '_');
        const fileName = `Rechnung_${order.invoiceNumber}_${company}.pdf`;
        
        zip.file(`Rechnungen/${fileName}`, blob);
      }

      toast.loading('Packe ZIP-Archiv...', { id: toastId });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `Monatsabschluss_${selectedMonth}.zip`);

      toast.success(`Abschluss komplett! (${filteredOrders.length} Rechnungen)`, { id: toastId });

    } catch (error) {
      console.error(error);
      toast.error('Kritischer Fehler beim ZIP Export.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-bg-panel border border-structure rounded-xl shadow-xl mb-6 mt-8 overflow-hidden">
      {/* Header / Clickable Toggle */}
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-6 hover:bg-structure/20 transition-colors text-left"
      >
        <div className="flex-1">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
            <ArchiveBoxArrowDownIcon className="w-6 h-6 text-primary" />
            Monatsabschluss / DATEV-Export
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Lade eine Übersicht aller Rechnungen eines Monats für den Steuerberater herunter.
          </p>
        </div>
        <div className="flex-shrink-0 ml-4">
          <span className="text-sm font-medium text-primary">
            {isExpanded ? 'Zuklappen' : 'Öffnen'}
          </span>
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-6 pt-0 border-t border-structure/50 bg-bg-panel/50 animate-in slide-in-from-top-2 duration-300">
          <div className="flex flex-col sm:flex-row gap-4 items-center w-full p-4 bg-bg-dark border border-structure rounded-lg mt-4">
            <div className="flex flex-col flex-1">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">Abrechnungsmonat</label>
              <input 
                type="month" 
                value={selectedMonth} 
                onChange={e => setSelectedMonth(e.target.value)} 
                className="input-field w-full max-w-[200px]"
                disabled={isExporting}
              />
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
