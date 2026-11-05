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
import { ArchiveCustomerModal } from '@/components/customers/ArchiveCustomerModal';
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
    invoices: any[];
    claims: any[];
  } | null>(null);
  const [isCheckingArchive, setIsCheckingArchive] = useState(false);

  const handleInitiateArchive = async (customer: any) => {
    setIsCheckingArchive(true);
    try {
      // 1. Fetch customer orders
      const qOrders = query(collection(db, 'orders'), where('customerId', '==', customer.id));
      const orderDocs = await getDocs(qOrders);
      const ordersList = orderDocs.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Fetch customer invoices
      const qInvoices = query(collection(db, 'invoices'), where('customerId', '==', customer.id));
      const invDocs = await getDocs(qInvoices);
      const invoicesList = invDocs.docs.map(d => ({ id: d.id, ...d.data() }));

      // 3. Fetch customer claims
      const qClaims = query(collection(db, 'claims'), where('customerId', '==', customer.id));
      const claimDocs = await getDocs(qClaims);
      const claimsList = claimDocs.docs.map(d => ({ id: d.id, ...d.data() }));

      setArchiveTarget({
        customer,
        orders: ordersList,
        invoices: invoicesList,
        claims: claimsList
      });
    } catch (err) {
      console.error("Fehler beim Vorbereiten der Archivierung:", err);
      setArchiveTarget({
        customer,
        orders: customer.allOrders || [],
        invoices: [],
        claims: []
      });
    } finally {
      setIsCheckingArchive(false);
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
                  className={`hover:bg-white/[0.04] transition-colors group ${customer.activeClaim ? 'border-l-4 border-l-rose-500 bg-rose-500/[0.02]' : ''}`}
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base text-text-main hover:text-primary transition-colors">{displayName}</span>
                            {customer.activeClaim && (
                              <span 
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 shrink-0" 
                                title={`Aktive Reklamation: ${customer.activeClaim.status}${customer.activeClaim.description ? ` - ${customer.activeClaim.description}` : ''}`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                <span>Reklamation</span>
                              </span>
                            )}
                          </div>
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
      {isCheckingArchive && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-bg-panel border border-structure p-5 rounded-2xl flex items-center gap-3 shadow-2xl">
            <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-text-main">Prüfe Auftrags- & Rechnungsstatus...</span>
          </div>
        </div>
      )}

      {/* Intelligent Archive Customer Modal */}
      <ArchiveCustomerModal
        isOpen={Boolean(archiveTarget)}
        onClose={() => setArchiveTarget(null)}
        customer={archiveTarget?.customer}
        orders={archiveTarget?.orders}
        invoices={archiveTarget?.invoices}
        claims={archiveTarget?.claims}
        onSuccess={() => {
          setArchiveTarget(null);
          router.refresh();
        }}
      />
    </div>
  );
}
