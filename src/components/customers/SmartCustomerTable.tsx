import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserCircleIcon as UserCircleSolid, BuildingOfficeIcon as BuildingSolid } from '@heroicons/react/24/solid';
import { DocumentTextIcon, CheckBadgeIcon, ArrowRightIcon, PlusIcon, EnvelopeIcon, PhoneIcon, ClipboardDocumentListIcon, FolderOpenIcon, PencilSquareIcon, DocumentArrowDownIcon } from '@heroicons/react/24/solid';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';

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
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Aktion</th>
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
                    <div className="flex items-center gap-3">
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
                        <div className="font-bold text-base text-text-main">{displayName}</div>
                        {isCompany && customer.firstName && (
                          <div className="text-sm text-text-muted mb-1">{customer.firstName}</div>
                        )}
                        {customer.source && (
                          <div className={`mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border inline-block ${getSourceBadgeStyle(customer.source)}`}>
                            {customer.source}
                          </div>
                        )}
                      </div>
                    </div>
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
                    <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${statusBadge} inline-flex whitespace-nowrap`}>
                      {statusText}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 min-w-max ml-auto">
                      <Link 
                        href={`/dashboard/customers/${customer.id}`} 
                        className="w-10 h-10 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 rounded-lg transition-colors flex items-center justify-center shrink-0"
                        title="Kundenakte öffnen"
                      >
                        <FolderOpenIcon className="w-5 h-5 shrink-0" />
                      </Link>

                      <Link 
                        href={btnUrl} 
                        className="w-10 h-10 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 rounded-lg transition-colors flex items-center justify-center shrink-0"
                        title="Bearbeiten / Neuer Auftrag"
                      >
                        <PencilSquareIcon className="w-5 h-5 shrink-0" />
                      </Link>

                      {latestOrder ? (
                        <div onClick={e => e.stopPropagation()} className="w-10 h-10 shrink-0 [&>div]:w-full [&>div]:h-full [&_a]:w-full [&_a]:h-full [&_a]:flex" title="Auftrag/Rechnung als PDF herunterladen">
                          <PDFDownloadButton 
                            order={latestOrder} 
                            customer={customer} 
                            type={latestOrder.invoiceNumber ? 'invoice' : (['confirmed', 'completed'].includes(latestOrder.status) ? 'contract' : 'order')}
                            iconOnly={true}
                            customIcon={<DocumentArrowDownIcon className="w-5 h-5 shrink-0" />}
                            className="w-full h-full bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg transition-colors flex items-center justify-center"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-white/5 text-white/20 rounded-lg flex items-center justify-center cursor-not-allowed shrink-0" title="Kein Auftrag vorhanden">
                          <DocumentArrowDownIcon className="w-5 h-5 shrink-0" />
                        </div>
                      )}

                      {latestOrder ? (
                        <div onClick={e => e.stopPropagation()} className="w-10 h-10 shrink-0 [&>div]:w-full [&>div]:h-full [&_a]:w-full [&_a]:h-full [&_a]:flex" title="Protokoll als PDF herunterladen">
                          <PDFDownloadButton 
                            order={latestOrder} 
                            customer={customer} 
                            type="protocol"
                            iconOnly={true}
                            customIcon={<ClipboardDocumentListIcon className="w-5 h-5 shrink-0" />}
                            className="w-full h-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-lg transition-colors flex items-center justify-center"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 bg-white/5 text-white/20 rounded-lg flex items-center justify-center cursor-not-allowed shrink-0" title="Kein Auftrag vorhanden">
                          <ClipboardDocumentListIcon className="w-5 h-5 shrink-0" />
                        </div>
                      )}
                    </div>
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
