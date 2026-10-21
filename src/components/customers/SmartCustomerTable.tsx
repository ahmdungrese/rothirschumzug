import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserCircleIcon as UserCircleSolid, BuildingOfficeIcon as BuildingSolid } from '@heroicons/react/24/solid';
import { 
  DocumentTextIcon, 
  CheckBadgeIcon, 
  ArrowRightIcon, 
  PlusIcon, 
  EnvelopeIcon, 
  PhoneIcon, 
  ClipboardDocumentListIcon, 
  FolderOpenIcon, 
  PencilSquareIcon, 
  DocumentArrowDownIcon, 
  EllipsisVerticalIcon, 
  CalendarDaysIcon,
  ArchiveBoxIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';

function RowActions({ 
  customer, 
  latestOrder, 
  btnUrl,
  onArchive
}: { 
  customer: any; 
  latestOrder: any; 
  btnUrl: string;
  onArchive: (customer: any) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuWidth = 224; // w-56
      const menuHeight = 200;
      const x = Math.max(12, rect.right - menuWidth);
      const spaceBelow = window.innerHeight - rect.bottom;
      const y = spaceBelow < menuHeight ? Math.max(10, rect.top - menuHeight - 6) : rect.bottom + 6;
      setCoords({ x, y });
    }
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && 
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    function handleScroll() {
      if (isOpen) setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen]);

  const custPdfType = latestOrder?.invoiceNumber 
    ? 'invoice' 
    : (['confirmed', 'completed'].includes(latestOrder?.status) ? 'contract' : 'order');

  return (
    <div className="relative inline-block text-left">
      <button 
        ref={buttonRef}
        type="button"
        onClick={toggleDropdown}
        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors inline-flex items-center justify-center cursor-pointer border border-slate-200/80 dark:border-slate-700 shadow-2xs"
        title="Aktionen"
      >
        <EllipsisVerticalIcon className="w-4 h-4" />
      </button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.y, left: coords.x }}
          className="w-56 rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 py-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100 dark:divide-slate-800 text-left"
        >
          {/* 1. Bearbeiten / Neu */}
          <div className="py-1">
            <Link 
              href={btnUrl} 
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <PencilSquareIcon className="w-4 h-4 mr-2.5 text-blue-500 shrink-0" aria-hidden="true" />
              <span>Bearbeiten / Neu</span>
            </Link>
          </div>

          {/* 2. PDF Download & Übergabeprotokoll */}
          <div className="py-1">
            {latestOrder ? (
              <div 
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
              >
                <div className="mr-2.5 flex items-center text-[#6E8F64]">
                  <PDFDownloadButton 
                    order={latestOrder} 
                    customer={customer} 
                    type={custPdfType}
                    iconOnly={true}
                    customIcon={<DocumentArrowDownIcon className="w-4 h-4 shrink-0" />}
                    className=""
                  />
                </div>
                <span className="pointer-events-none">PDF Download</span>
              </div>
            ) : (
              <div className="w-full flex items-center px-3.5 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 opacity-50 cursor-not-allowed text-left">
                <DocumentArrowDownIcon className="w-4 h-4 mr-2.5 shrink-0" aria-hidden="true" />
                <span>PDF Download</span>
              </div>
            )}

            {latestOrder ? (
              <div 
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-left"
              >
                <div className="mr-2.5 flex items-center text-emerald-500">
                  <PDFDownloadButton 
                    order={latestOrder} 
                    customer={customer} 
                    type="protocol"
                    iconOnly={true}
                    customIcon={<ClipboardDocumentListIcon className="w-4 h-4 shrink-0" />}
                    className=""
                  />
                </div>
                <span className="pointer-events-none">Übergabeprotokoll</span>
              </div>
            ) : (
              <div className="w-full flex items-center px-3.5 py-2 text-xs font-medium text-slate-400 dark:text-slate-500 opacity-50 cursor-not-allowed text-left">
                <ClipboardDocumentListIcon className="w-4 h-4 mr-2.5 shrink-0" aria-hidden="true" />
                <span>Übergabeprotokoll</span>
              </div>
            )}
          </div>

          {/* 3. Kunde archivieren (بمثابة حذف) */}
          <div className="py-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onArchive(customer);
              }}
              className="w-full flex items-center px-3.5 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors text-left cursor-pointer"
            >
              <ArchiveBoxIcon className="w-4 h-4 mr-2.5 text-red-500 shrink-0" aria-hidden="true" />
              <span>Kunde archivieren</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function getSourceBadgeStyle(source?: string) {
  if (!source) return "hidden";
  const s = source.toLowerCase();
  if (s.includes('check24')) return "bg-[#063B82] text-white border-blue-400/50 shadow-sm"; // Official Check24 blue
  if (s.includes('myhammer')) return "bg-[#F37021] text-white border-orange-400/50 shadow-sm"; // Official MyHammer orange
  if (s.includes('google')) return "bg-white text-gray-800 border-gray-200 shadow-sm";
  if (s.includes('empfehlung')) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (s.includes('facebook') || s.includes('meta')) return "bg-[#1877F2] text-white border-blue-400/50 shadow-sm";
  if (s.includes('instagram')) return "bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white border-pink-400/50 shadow-sm";
  if (s.includes('website') || s.includes('homepage')) return "bg-primary/20 text-primary border-primary/30";
  // Default
  return "bg-white/5 text-text-muted border-white/10";
}

export function SmartCustomerTable({ customers }: { customers: any[] }) {
  const router = useRouter();
  const { profile } = useAuth();
  const [archiveTarget, setArchiveTarget] = useState<{
    customer: any;
    orders: any[];
    activeInvoices: Array<{
      id: string | null;
      invoiceNumber: string;
      invoiceDate?: string;
      total?: number;
      sourceOrderId?: string | null;
    }>;
  } | null>(null);
  const [isCheckingInvoices, setIsCheckingInvoices] = useState(false);
  const [isProcessingArchive, setIsProcessingArchive] = useState(false);

  const handleInitiateArchive = async (customer: any) => {
    setIsCheckingInvoices(true);
    try {
      // 1. Fetch all customer orders directly from Firestore
      const qOrders = query(collection(db, 'orders'), where('customerId', '==', customer.id));
      const orderDocs = await getDocs(qOrders);
      const ordersList = orderDocs.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fetch all customer invoices from Firestore
      const qInvoices = query(collection(db, 'invoices'), where('customerId', '==', customer.id));
      const invDocs = await getDocs(qInvoices);
      const invoicesList = invDocs.docs.map(d => ({ id: d.id, ...d.data() }));

      // 3. Collect active (non-cancelled, non-storno) invoices
      const activeMap = new Map<string, any>();

      invoicesList.forEach((inv: any) => {
        const isCancelled = Boolean(inv.isStorno || inv.isCanceled || inv.status === 'invoice_cancelled' || inv.status === 'canceled');
        const num = inv.invoiceNumber || inv.activeInvoiceNumber;
        if (!isCancelled && num) {
          activeMap.set(num, {
            id: inv.id,
            invoiceNumber: num,
            invoiceDate: inv.invoiceDate || (inv.createdAt?.toDate ? inv.createdAt.toDate().toISOString() : ''),
            total: inv.totals?.gross || inv.calcInput?.gross || 0,
            sourceOrderId: inv.sourceOrderId || inv.orderId || null
          });
        }
      });

      ordersList.forEach((ord: any) => {
        const isCancelled = Boolean(ord.isStorno || ord.invoiceCancelled || ord.status === 'invoice_cancelled' || ord.status === 'canceled');
        const num = ord.invoiceNumber || ord.activeInvoiceNumber;
        if (!isCancelled && num && !activeMap.has(num)) {
          activeMap.set(num, {
            id: null,
            invoiceNumber: num,
            invoiceDate: ord.invoiceDate || (ord.createdAt?.toDate ? ord.createdAt.toDate().toISOString() : ''),
            total: ord.totals?.gross || ord.calcInput?.gross || ord.flatRateNet || 0,
            sourceOrderId: ord.id
          });
        }
      });

      const activeInvs = Array.from(activeMap.values());

      setArchiveTarget({
        customer,
        orders: ordersList,
        activeInvoices: activeInvs
      });
    } catch (err) {
      console.error("Fehler beim Prüfen von Kundenrechnungen:", err);
      setArchiveTarget({
        customer,
        orders: customer.allOrders || [],
        activeInvoices: []
      });
    } finally {
      setIsCheckingInvoices(false);
    }
  };

  const handleExecuteArchive = async (withStorno: boolean) => {
    if (!archiveTarget) return;
    setIsProcessingArchive(true);
    const { customer, orders, activeInvoices } = archiveTarget;
    const custName = customer.type === 'firma'
      ? (customer.company || customer.lastName || 'Firma')
      : `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Kunde';

    try {
      const batch = writeBatch(db);

      // 1. If withStorno: generate GoBD Storno documents for each active invoice
      if (withStorno && activeInvoices.length > 0) {
        for (const inv of activeInvoices) {
          const invNum = inv.invoiceNumber;
          const stornoNumber = `ST-${invNum.replace(/^(RE-|R-|ST-)/i, '')}`;

          // Create new Storno document in 'invoices'
          const stornoDocRef = doc(collection(db, 'invoices'));
          batch.set(stornoDocRef, {
            type: 'invoice',
            isStorno: true,
            stornoFor: invNum,
            invoiceNumber: stornoNumber,
            invoiceDate: new Date().toISOString(),
            customerId: customer.id,
            customerName: custName,
            sourceOrderId: inv.sourceOrderId || null,
            status: 'invoice_cancelled',
            isCanceled: true,
            stornoReason: 'Kunde im Kundencenter archiviert',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Mark original invoice doc if exists
          if (inv.id) {
            const origInvRef = doc(db, 'invoices', inv.id);
            batch.update(origInvRef, {
              status: 'invoice_cancelled',
              isCanceled: true,
              stornoReason: 'Kunde im Kundencenter archiviert',
              stornoDocumentNumber: stornoNumber,
              updatedAt: serverTimestamp()
            });
          }
        }
      }

      // 2. Cascade archive to all customer orders
      for (const ord of orders) {
        const ordRef = doc(db, 'orders', ord.id);
        const updatePayload: any = {
          status: 'archived',
          isArchived: true,
          archivedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        if (withStorno) {
          updatePayload.invoiceCancelled = true;
        }
        batch.update(ordRef, updatePayload);
      }

      // 3. Mark customer as archived
      const custRef = doc(db, 'customers', customer.id);
      batch.update(custRef, {
        isArchived: true,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Commit atomic write
      await batch.commit();

      // Log Activity
      logActivity(
        profile?.uid || 'system',
        profile?.displayName || profile?.email || 'Mitarbeiter',
        withStorno ? 'CANCEL_INVOICE' : 'ARCHIVE_CUSTOMER',
        withStorno 
          ? `Kunde "${custName}" archiviert. ${activeInvoices.length} Rechnung(en) storniert, ${orders.length} Auftrag/Aufträge archiviert.`
          : `Kunde "${custName}" und ${orders.length} Auftrag/Aufträge archiviert.`
      );

      if (withStorno && activeInvoices.length > 0) {
        toast.success(`Kunde "${custName}" archiviert. ${activeInvoices.length} Rechnung(en) wurden ordnungsgemäß storniert.`);
      } else {
        toast.success(`Kunde "${custName}" und ${orders.length} Auftrag/Aufträge erfolgreich archiviert.`);
      }
    } catch (err) {
      console.error("Fehler beim Archivieren:", err);
      toast.error("Fehler beim Archivieren des Kunden.");
    } finally {
      setIsProcessingArchive(false);
      setArchiveTarget(null);
    }
  };

  if (customers.length === 0) {
    return (
      <div className="glass-panel p-12 text-center rounded-2xl text-text-muted italic border border-white/5">
        Keine Kunden gefunden.
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-structure overflow-hidden shadow-xl">
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left text-sm text-text-main">
          <thead className="bg-bg-dark text-text-muted uppercase text-xs tracking-wider border-b border-structure">
            <tr>
              <th className="px-4 lg:px-6 py-3.5 font-semibold">Kunde</th>
              <th className="hidden xl:table-cell px-4 lg:px-6 py-3.5 font-semibold">Kontakt</th>
              <th className="px-3 lg:px-6 py-3.5 font-semibold">Letzter Auftrag</th>
              <th className="px-3 lg:px-6 py-3.5 font-semibold">Umzugsdatum</th>
              <th className="px-3 lg:px-6 py-3.5 font-semibold">Status</th>
              <th className="px-3 lg:px-6 py-3.5 font-semibold text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-structure">
            {customers.map((customer) => {
              const latestOrder = customer.latestOrder;
              const isCompany = customer.type === 'firma';
              const displayName = isCompany 
                ? (customer.lastName || "Unbekannte Firma") 
                : `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || "Unbekannter Kunde";

              let statusText = "Keine Aufträge";
              let statusBadge = "bg-black/20 text-text-muted border-white/5";
              let btnText = "Neues Angebot";
              let btnIcon = <PlusIcon className="w-4 h-4" />;
              let btnUrl = `/dashboard/customers/${customer.id}/new-order`;
              let btnStyle = "btn-primary";

              if (latestOrder) {
                switch (latestOrder.status) {
                  case 'draft':
                    statusText = "Entwurf offen";
                    statusBadge = "bg-orange-500/10 text-orange-400 border-orange-500/20";
                    btnText = "Angebot fertigstellen";
                    btnIcon = <DocumentTextIcon className="w-4 h-4" />;
                    btnUrl = `/dashboard/customers/${customer.id}/edit-order/${latestOrder.id}`;
                    btnStyle = "bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20";
                    break;
                  case 'quote':
                    statusText = "Wartet auf Antwort";
                    statusBadge = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                    btnText = "Angebot öffnen";
                    btnIcon = <ArrowRightIcon className="w-4 h-4" />;
                    btnUrl = `/dashboard/customers/${customer.id}/edit-order/${latestOrder.id}`;
                    btnStyle = "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20";
                    break;
                  case 'clarification':
                    statusText = "In Klärung";
                    statusBadge = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                    btnText = "Klärung bearbeiten";
                    btnIcon = <DocumentTextIcon className="w-4 h-4" />;
                    btnUrl = `/dashboard/customers/${customer.id}/edit-order/${latestOrder.id}`;
                    btnStyle = "bg-purple-500 hover:bg-purple-600 text-white shadow-lg shadow-purple-500/20";
                    break;
                  case 'confirmed':
                    statusText = "Auftrag bestätigt";
                    statusBadge = "bg-[#6E8F64]/15 text-[#4A6642] dark:text-[#A8C69F] border-[#6E8F64]/30";
                    btnText = "Akte öffnen";
                    btnIcon = <CheckBadgeIcon className="w-4 h-4" />;
                    btnUrl = `/dashboard/customers/${customer.id}`;
                    btnStyle = "bg-[#6E8F64] hover:bg-[#5C7A53] text-white shadow-sm shadow-[#6E8F64]/20";
                    break;
                  case 'completed':
                    statusText = "Umzug abgeschlossen";
                    statusBadge = "bg-[#6E8F64]/15 text-[#4A6642] dark:text-[#A8C69F] border-[#6E8F64]/30";
                    btnText = "Rechnung schreiben";
                    btnIcon = <DocumentTextIcon className="w-4 h-4" />;
                    btnUrl = `/dashboard/customers/${customer.id}/new-order?type=invoice`;
                    btnStyle = "btn-secondary text-[#6E8F64] border-[#6E8F64]/35 hover:bg-[#6E8F64]/10";
                    break;
                  case 'invoice_open':
                  case 'invoice_overdue':
                    const isOverdue = latestOrder.status === 'invoice_overdue';
                    statusText = isOverdue ? "Rechnung überfällig!" : "Rechnung offen";
                    statusBadge = isOverdue 
                      ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse font-bold" 
                      : "bg-red-500/10 text-red-400 border-red-500/20";
                    btnText = "Zahlung prüfen";
                    btnIcon = <DocumentTextIcon className="w-4 h-4" />;
                    btnUrl = `/dashboard/customers/${customer.id}`;
                    btnStyle = isOverdue 
                      ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                      : "btn-secondary text-red-400 border-red-500/30 hover:bg-red-500/10";
                    break;
                  case 'invoice_paid':
                    statusText = "Abgeschlossen";
                    statusBadge = "bg-white/5 text-text-muted border-white/5";
                    btnText = "Neues Angebot";
                    btnIcon = <PlusIcon className="w-4 h-4" />;
                    btnUrl = `/dashboard/customers/${customer.id}/new-order`;
                    btnStyle = "btn-secondary";
                    break;
                  default:
                    statusText = "Inaktiv";
                    break;
                }
              }

              return (
                <tr 
                  key={customer.id} 
                  className="hover:bg-white/[0.04] transition-colors group"
                >
                  <td className="px-4 lg:px-6 py-4">
                    <div className="flex items-start gap-3">
                      <Link 
                        href={`/dashboard/customers/${customer.id}`} 
                        className="shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                      >
                        {isCompany ? (
                          <div className="bg-primary/20 p-2.5 rounded-xl text-primary shrink-0 shadow-inner">
                            <BuildingSolid className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="bg-black/10 dark:bg-white/5 p-2.5 rounded-xl text-text-muted group-hover:text-text-main transition-colors shrink-0 shadow-inner">
                            <UserCircleSolid className="w-5 h-5" />
                          </div>
                        )}
                      </Link>

                      <div className="min-w-0">
                        <Link 
                          href={`/dashboard/customers/${customer.id}`}
                          className="block cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          <div className="font-bold text-base text-text-main hover:text-primary transition-colors">{displayName}</div>
                          {isCompany && customer.firstName && (
                            <div className="text-sm text-text-muted mb-1">{customer.firstName}</div>
                          )}
                          {customer.source && (
                            <div className={`mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border inline-block ${getSourceBadgeStyle(customer.source)}`}>
                              {customer.source}
                            </div>
                          )}
                        </Link>

                        {/* Smart Condensed Quick Contact for Tablets (< xl) - Separate from Link */}
                        <div className="flex xl:hidden items-center gap-1.5 mt-2 flex-wrap">
                          {customer.phone && (
                            <a 
                              href={`tel:${customer.phone}`} 
                              title={`Anrufen: ${customer.phone}`}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors cursor-pointer border border-primary/20 shrink-0"
                            >
                              <PhoneIcon className="w-3 h-3" />
                              <span className="text-[11px] font-mono">{customer.phone}</span>
                            </a>
                          )}
                          {customer.email && (
                            <a 
                              href={`mailto:${customer.email}`} 
                              title={`E-Mail senden: ${customer.email}`}
                              className="inline-flex items-center justify-center p-1 rounded-md bg-slate-200/60 dark:bg-slate-800 hover:bg-primary hover:text-white text-text-muted transition-colors cursor-pointer shrink-0"
                            >
                              <EnvelopeIcon className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="hidden xl:table-cell px-4 lg:px-6 py-4">
                    <div className="flex flex-col gap-1 text-sm text-text-muted">
                      {customer.phone && (
                        <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                          <PhoneIcon className="w-3.5 h-3.5" /> {customer.phone}
                        </a>
                      )}
                      {customer.email && (
                        <a href={`mailto:${customer.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                          <EnvelopeIcon className="w-3.5 h-3.5" /> {customer.email}
                        </a>
                      )}
                      {!customer.phone && !customer.email && <span className="italic opacity-50">Keine Daten</span>}
                    </div>
                  </td>
                  
                  <td className="px-3 lg:px-6 py-4">
                    {latestOrder?.logistics?.a_city && latestOrder?.logistics?.b_city ? (
                      <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-2.5 py-1.5 rounded-md border border-primary/20 w-fit">
                        <span className="font-semibold">{latestOrder.logistics.a_city}</span>
                        <ArrowRightIcon className="w-3 h-3 shrink-0" />
                        <span className="font-semibold">{latestOrder.logistics.b_city}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-text-muted italic opacity-50">Kein Auftrag</span>
                    )}
                  </td>
                  
                  <td className="px-3 lg:px-6 py-4">
                    {(() => {
                      const movingDateRaw = latestOrder?.orderMeta?.movingDateFrom || latestOrder?.movingDate || latestOrder?.logistics?.movingDate;
                      if (!movingDateRaw) return <span className="text-sm text-text-muted italic opacity-50">-</span>;
                      try {
                        const d = new Date(movingDateRaw);
                        if (isNaN(d.getTime())) return <span className="text-sm text-text-muted">{movingDateRaw}</span>;
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const target = new Date(d);
                        target.setHours(0, 0, 0, 0);
                        const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        let pill = null;
                        if (diffDays === 0) pill = <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-[#6E8F64] text-white">Heute</span>;
                        else if (diffDays === 1) pill = <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-orange-500 text-white">Morgen</span>;
                        else if (diffDays > 1 && diffDays <= 7) pill = <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300">in {diffDays} Tg.</span>;

                        return (
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-text-main flex-wrap">
                            <CalendarDaysIcon className="w-4 h-4 text-primary shrink-0" />
                            <span>{d.toLocaleDateString('de-DE')}</span>
                            {pill}
                          </div>
                        );
                      } catch {
                        return <span className="text-sm text-text-muted">{movingDateRaw}</span>;
                      }
                    })()}
                  </td>
                  
                  <td className="px-3 lg:px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${statusBadge} inline-flex whitespace-nowrap`}>
                      {statusText}
                    </span>
                  </td>
                  
                  <td className="px-3 lg:px-6 py-4 text-right">
                    <RowActions 
                      customer={customer} 
                      latestOrder={latestOrder} 
                      btnUrl={btnUrl} 
                      onArchive={(c) => handleInitiateArchive(c)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Checking invoices loading state */}
      {isCheckingInvoices && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-bg-panel border border-structure p-5 rounded-2xl flex items-center gap-3 shadow-2xl">
            <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-text-main">Prüfe Auftrags- & Rechnungsstatus...</span>
          </div>
        </div>
      )}

      {/* 1. GoBD Invoice Warning Modal (When active invoices exist) */}
      {archiveTarget && archiveTarget.activeInvoices.length > 0 && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-panel border-2 border-amber-500/50 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-amber-500/15 via-red-500/10 to-transparent border-b border-amber-500/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30 shadow-inner">
                  <ShieldExclamationIcon className="w-7 h-7" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-extrabold uppercase tracking-wider mb-1">
                    <span>GoBD-Schutz aktiv</span>
                  </div>
                  <h3 className="text-lg font-bold text-text-main font-headline">
                    Aktive Rechnung(en) vorhanden
                  </h3>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-muted leading-relaxed">
                Der Kunde <strong className="text-text-main">
                  {archiveTarget.customer.type === 'firma'
                    ? (archiveTarget.customer.company || archiveTarget.customer.lastName || 'Firma')
                    : `${archiveTarget.customer.firstName || ''} ${archiveTarget.customer.lastName || ''}`.trim() || 'Kunde'}
                </strong> besitzt ausgestellte Rechnungen. Nach deutschem Steuerrecht (<span className="text-amber-400 font-medium">GoBD / § 14b UStG</span>) dürfen Kunden mit aktiven Rechnungen nicht ohne Stornierung gelöscht oder archiviert werden.
              </p>

              {/* Invoices List */}
              <div className="rounded-2xl border border-structure bg-bg-dark/80 p-3 space-y-2 max-h-48 overflow-y-auto">
                <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block">
                  Betroffene Rechnungen ({archiveTarget.activeInvoices.length}):
                </span>
                {archiveTarget.activeInvoices.map((inv, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">{inv.invoiceNumber}</span>
                      {inv.invoiceDate && (
                        <span className="text-text-muted text-[11px]">
                          ({new Date(inv.invoiceDate).toLocaleDateString('de-DE')})
                        </span>
                      )}
                    </div>
                    {inv.total !== undefined && inv.total > 0 && (
                      <span className="font-bold text-text-main">
                        {inv.total.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
                ⚠️ <strong>Hinweis zur Archivierung:</strong> Beim Bestätigen wird für jede Rechnung automatisch ein offizieller <strong>Storno-Beleg (ST-XXXX)</strong> generiert, alle Aufträge werden storniert und der Kunde wird archiviert. Aus Logistik und Kalender wird der Kunde mitsamt aller Aufgaben vollständig entfernt.
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-bg-dark border-t border-structure flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isProcessingArchive}
                onClick={() => setArchiveTarget(null)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-structure text-xs font-bold text-text-muted hover:text-text-main hover:bg-white/5 transition-all cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                type="button"
                disabled={isProcessingArchive}
                onClick={() => handleExecuteArchive(true)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isProcessingArchive ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Wird storniert & archiviert...</span>
                  </>
                ) : (
                  <span>Rechnungen stornieren & alles archivieren</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Standard Confirm Archive Modal (When NO active invoices exist) */}
      {archiveTarget && archiveTarget.activeInvoices.length === 0 && (
        <ConfirmModal
          isOpen={Boolean(archiveTarget)}
          title="Kunde & Aufträge archivieren"
          message={`Möchten Sie den Kunden "${archiveTarget.customer.type === 'firma' ? (archiveTarget.customer.company || archiveTarget.customer.lastName || 'Firma') : `${archiveTarget.customer.firstName || ''} ${archiveTarget.customer.lastName || ''}`.trim() || 'Kunde'}" und alle zugehörigen Aufträge wirklich archivieren? Der Kunde und alle Aufträge werden aus den aktiven Ansichten (Dispo, Logistik & Kalender) entfernt.`}
          confirmText={isProcessingArchive ? "Wird archiviert..." : "Archivieren"}
          cancelText="Abbrechen"
          isDestructive={true}
          onConfirm={() => handleExecuteArchive(false)}
          onCancel={() => setArchiveTarget(null)}
        />
      )}
    </div>
  );
}
