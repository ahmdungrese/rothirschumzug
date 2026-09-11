import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserCircleIcon as UserCircleSolid, BuildingOfficeIcon as BuildingSolid } from '@heroicons/react/24/solid';
import { DocumentTextIcon, CheckBadgeIcon, ArrowRightIcon, PlusIcon, EnvelopeIcon, PhoneIcon, ClipboardDocumentListIcon, FolderOpenIcon, PencilSquareIcon, DocumentArrowDownIcon, EllipsisVerticalIcon, CalendarDaysIcon } from '@heroicons/react/24/solid';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';

function RowActions({ customer, latestOrder, btnUrl }: { customer: any; latestOrder: any; btnUrl: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const toggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position the dropdown below the button, aligned to the right edge
      setCoords({ x: rect.right - 224, y: rect.bottom + 8 }); // 224px is w-56
    }
    setIsOpen(!isOpen);
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

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={toggleDropdown}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-text-muted hover:text-text-main transition-colors"
      >
        <EllipsisVerticalIcon className="w-6 h-6" />
      </button>

      {isOpen && (
        <div 
          ref={dropdownRef}
          style={{ position: 'fixed', top: coords.y, left: coords.x }}
          className="w-56 rounded-xl shadow-2xl bg-bg-panel ring-1 ring-black ring-opacity-5 z-[9999] border border-structure py-2 animate-in fade-in zoom-in-95 duration-100"
        >
          <Link 
            href={btnUrl} 
            onClick={() => setIsOpen(false)}
            className="group flex items-center px-4 py-2 text-sm text-text-main hover:bg-white/5"
          >
            <PencilSquareIcon className="mr-3 h-5 w-5 text-orange-400" aria-hidden="true" />
            Bearbeiten / Neu
          </Link>

          {latestOrder ? (
            <div className="group flex items-center px-4 py-2 text-sm text-text-main hover:bg-white/5 cursor-pointer">
              <div className="mr-3 h-5 w-5 flex items-center justify-center text-red-400">
                <PDFDownloadButton 
                  order={latestOrder} 
                  customer={customer} 
                  type={latestOrder.invoiceNumber ? 'invoice' : (['confirmed', 'completed'].includes(latestOrder.status) ? 'contract' : 'order')}
                  iconOnly={true}
                  customIcon={<DocumentArrowDownIcon className="w-5 h-5 shrink-0" />}
                  className=""
                />
              </div>
              <span className="pointer-events-none">PDF Download</span>
            </div>
          ) : (
            <div className="group flex items-center px-4 py-2 text-sm text-text-muted opacity-50 cursor-not-allowed">
              <DocumentArrowDownIcon className="mr-3 h-5 w-5" aria-hidden="true" />
              PDF Download
            </div>
          )}

          {latestOrder ? (
            <div className="group flex items-center px-4 py-2 text-sm text-text-main hover:bg-white/5 cursor-pointer">
              <div className="mr-3 h-5 w-5 flex items-center justify-center text-emerald-400">
                <PDFDownloadButton 
                  order={latestOrder} 
                  customer={customer} 
                  type="protocol"
                  iconOnly={true}
                  customIcon={<ClipboardDocumentListIcon className="w-5 h-5 shrink-0" />}
                  className=""
                />
              </div>
              <span className="pointer-events-none">Übergabeprotokoll</span>
            </div>
          ) : (
            <div className="group flex items-center px-4 py-2 text-sm text-text-muted opacity-50 cursor-not-allowed">
              <ClipboardDocumentListIcon className="mr-3 h-5 w-5" aria-hidden="true" />
              Übergabeprotokoll
            </div>
          )}
        </div>
      )}
    </>
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
              <th className="px-6 py-4 font-semibold">Kunde</th>
              <th className="px-6 py-4 font-semibold">Kontakt</th>
              <th className="px-6 py-4 font-semibold">Letzter Auftrag</th>
              <th className="px-6 py-4 font-semibold">Umzugsdatum</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Aktionen</th>
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
                    statusBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                    btnText = "Akte öffnen";
                    btnIcon = <CheckBadgeIcon className="w-4 h-4" />;
                    btnUrl = `/dashboard/customers/${customer.id}`;
                    btnStyle = "bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20";
                    break;
                  case 'completed':
                    statusText = "Umzug abgeschlossen";
                    statusBadge = "bg-green-500/10 text-green-400 border-green-500/20";
                    btnText = "Rechnung schreiben";
                    btnIcon = <DocumentTextIcon className="w-4 h-4" />;
                    btnUrl = `/dashboard/customers/${customer.id}/new-order?type=invoice`;
                    btnStyle = "btn-secondary text-green-400 border-green-500/30 hover:bg-green-500/10";
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
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/customers/${customer.id}`} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                      {isCompany ? (
                        <div className="bg-primary/20 p-2.5 rounded-xl text-primary shrink-0 shadow-inner">
                          <BuildingSolid className="w-5 h-5" />
                        </div>
                      ) : (
                        <div className="bg-black/10 dark:bg-white/5 p-2.5 rounded-xl text-text-muted group-hover:text-text-main transition-colors shrink-0 shadow-inner">
                          <UserCircleSolid className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-base text-text-main hover:text-primary transition-colors">{displayName}</div>
                        {isCompany && customer.firstName && (
                          <div className="text-sm text-text-muted mb-1">{customer.firstName}</div>
                        )}
                        {customer.source && (
                          <div className={`mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border inline-block ${getSourceBadgeStyle(customer.source)}`}>
                            {customer.source}
                          </div>
                        )}
                      </div>
                    </Link>
                  </td>
                  
                  <td className="px-6 py-4">
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
                  
                  <td className="px-6 py-4">
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
                  
                  <td className="px-6 py-4">
                    {(() => {
                      const movingDateRaw = latestOrder?.orderMeta?.movingDateFrom || latestOrder?.movingDate || latestOrder?.logistics?.movingDate;
                      if (!movingDateRaw) return <span className="text-sm text-text-muted italic opacity-50">-</span>;
                      try {
                        return (
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-text-main">
                            <CalendarDaysIcon className="w-4 h-4 text-primary" />
                            {new Date(movingDateRaw).toLocaleDateString('de-DE')}
                          </div>
                        );
                      } catch {
                        return <span className="text-sm text-text-muted">{movingDateRaw}</span>;
                      }
                    })()}
                  </td>
                  
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${statusBadge} inline-flex whitespace-nowrap`}>
                      {statusText}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    <RowActions customer={customer} latestOrder={latestOrder} btnUrl={btnUrl} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
