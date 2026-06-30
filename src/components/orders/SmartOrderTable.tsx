"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  DocumentTextIcon, 
  CalendarDaysIcon, 
  CheckBadgeIcon,
  EllipsisVerticalIcon,
  DocumentCheckIcon,
  TruckIcon,
  BanknotesIcon,
  TrashIcon,
  ReceiptRefundIcon,
  ClipboardDocumentListIcon,
  MapPinIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { StatusBadge } from '@/components/ui/StatusBadge';

// Helper for Source Colors
const getSourceBadgeColor = (source: string) => {
  if (!source) return null;
  const s = source.toLowerCase();
  if (s.includes('check24')) return 'bg-blue-600 text-white border-blue-400';
  if (s.includes('myhammer') || s.includes('my hammer')) return 'bg-orange-500 text-white border-orange-400';
  if (s.includes('google')) return 'bg-green-600 text-white border-green-400';
  if (s.includes('empfehlung')) return 'bg-purple-600 text-white border-purple-400';
  if (s.includes('kleinanzeigen')) return 'bg-green-700 text-white border-green-500';
  return 'bg-structure text-text-muted border-white/10'; // default
};

interface SmartOrderTableProps {
  orders: any[];
  customers: any[];
  onGenerateInvoice?: (order: any) => void;
  onUpdateStatus?: (orderId: string, status: string) => void;
  onDuplicate?: (order: any) => void;
  onDelete?: (order: any) => void;
  onDispo?: (order: any) => void;
  onStorno?: (order: any) => void;
}

export function SmartOrderTable({ 
  orders, 
  customers, 
  onGenerateInvoice, 
  onUpdateStatus, 
  onDuplicate, 
  onDelete,
  onDispo,
  onStorno 
}: SmartOrderTableProps) {
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  if (orders.length === 0) {
    return (
      <div className="glass-panel p-12 text-center rounded-2xl text-text-muted italic border border-white/5 shadow-xl">
        Keine Einträge gefunden.
      </div>
    );
  }

  // Toggle dropdown
  const toggleDropdown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setOpenDropdown(openDropdown === id ? null : id);
  };

  // Close dropdown if clicked outside (simple implementation for row clicks)
  const closeDropdown = () => setOpenDropdown(null);

  return (
    <div className="glass-panel rounded-2xl border border-structure overflow-visible shadow-xl relative z-10">
      <div className="overflow-x-auto custom-scrollbar" onScroll={closeDropdown}>
        <table className="w-full text-left text-sm text-text-main">
          <thead className="bg-bg-dark text-text-muted uppercase text-xs tracking-wider border-b border-structure">
            <tr>
              <th className="px-6 py-4 font-semibold">Kunde / Details</th>
              <th className="px-6 py-4 font-semibold">Nummer</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Summe</th>
              <th className="px-6 py-4 font-semibold text-right">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-structure">
            {orders.map((order) => {
              // Find matching customer
              const customer = customers.find(c => c.id === order.customerId);
              const isCompany = customer?.type === 'firma';
              
              // Intelligent Display Name Fallback
              const displayName = customer 
                ? (isCompany ? (customer.lastName || "Firma") : `${customer.firstName || ''} ${customer.lastName || ''}`.trim())
                : (order.customerName || `ID: ${order.customerId?.slice(0, 8)}...`);

              // Intelligent Total Calculation (Checking both calcInput and totals)
              const grossTotal = order.totals?.gross ?? order.calcInput?.gross ?? 0;
              const paidAmount = (order.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
              const openAmount = Math.max(0, grossTotal - paidAmount);

              const isInvoice = !!order.invoiceNumber;
              const displayNumber = order.invoiceNumber || order.orderNumber || '-';

              const isMovingSoon = order.status === 'confirmed' && order.orderMeta?.movingDateFrom && 
                new Date(order.orderMeta.movingDateFrom).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

              return (
                <tr 
                  key={order.id} 
                  onClick={() => {
                    closeDropdown();
                    router.push(`/dashboard/customers/${order.customerId}`);
                  }}
                  className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                >
                  {/* Kunde / Details */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-text-main">{displayName}</span>
                        {customer?.source && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getSourceBadgeColor(customer.source)} shadow-sm flex items-center gap-1`}>
                            <GlobeAltIcon className="w-3 h-3 opacity-70" />
                            {customer.source}
                          </span>
                        )}
                      </div>
                      
                      {/* From - To Cities */}
                      {(order.logistics?.a_city || order.logistics?.b_city) && (
                        <div className="text-xs font-medium text-text-main flex items-center gap-1.5 opacity-90 bg-white/5 w-fit px-2 py-1 rounded-md border border-white/5">
                          <MapPinIcon className="w-3.5 h-3.5 text-text-muted" />
                          <span className={order.logistics?.a_city ? 'text-text-main' : 'text-text-muted italic'}>
                            {order.logistics?.a_city || 'Unbekannt'}
                          </span>
                          <span className="text-primary font-bold px-1">&rarr;</span>
                          <span className={order.logistics?.b_city ? 'text-text-main' : 'text-text-muted italic'}>
                            {order.logistics?.b_city || 'Unbekannt'}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  
                  {/* Nummer & Datum */}
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-text-main flex items-center gap-2">
                      {isInvoice ? <DocumentTextIcon className="w-4 h-4 text-blue-400" /> : <DocumentTextIcon className="w-4 h-4 text-text-muted" />}
                      {displayNumber}
                    </div>
                    <div className="text-xs text-text-muted mt-1 opacity-80 flex items-center gap-1.5">
                      <CalendarDaysIcon className="w-3.5 h-3.5" />
                      {new Date(order.createdAt?.toMillis?.() || Date.now()).toLocaleDateString('de-DE')}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-start gap-1.5">
                      <StatusBadge status={order.status} payments={order.payments} totals={{ gross: grossTotal }} />
                      {isMovingSoon && (
                        <span className="text-[10px] text-orange-400 flex items-center gap-1 font-bold bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20">
                          <TruckIcon className="w-3 h-3" /> Umzug bald
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Summe */}
                  <td className="px-6 py-4 text-right">
                    <div className="font-bold text-text-main text-base">
                      € {grossTotal.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    {isInvoice && openAmount > 0 && order.status !== 'canceled' && (
                      <div className="text-xs text-red-400 font-bold mt-1">
                        Offen: € {openAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </td>

                  {/* Aktionen (3-Dots Dropdown) */}
                  <td className="px-6 py-4 text-right relative">
                    <button 
                      onClick={(e) => toggleDropdown(e, order.id)}
                      className="p-2 bg-structure/50 hover:bg-primary/20 text-text-muted hover:text-primary rounded-xl transition-all"
                    >
                      <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>
                    
                    {openDropdown === order.id && (
                      <>
                        {/* Invisible backdrop to close dropdown when clicking outside within the row bounds */}
                        <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); closeDropdown(); }}></div>
                        
                        <div className="absolute right-6 top-14 mt-2 w-48 bg-bg-panel border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100">
                          
                          {/* Options based on status */}
                          {order.status === 'quote' && onDispo && (
                            <button onClick={(e) => { e.stopPropagation(); closeDropdown(); onDispo(order); }} className="px-4 py-2 text-left text-xs text-text-main hover:bg-primary/20 hover:text-primary flex items-center gap-2 transition-colors">
                              <TruckIcon className="w-4 h-4" /> Disponieren
                            </button>
                          )}

                          {order.status === 'confirmed' && onGenerateInvoice && (
                            <button onClick={(e) => { e.stopPropagation(); closeDropdown(); onGenerateInvoice(order); }} className="px-4 py-2 text-left text-xs text-emerald-400 hover:bg-emerald-400/10 flex items-center gap-2 transition-colors">
                              <DocumentCheckIcon className="w-4 h-4" /> Rechnung schreiben
                            </button>
                          )}

                          {isInvoice && order.status !== 'canceled' && (
                            <button onClick={(e) => { e.stopPropagation(); closeDropdown(); router.push(`/dashboard/customers/${order.customerId}`); }} className="px-4 py-2 text-left text-xs text-blue-400 hover:bg-blue-400/10 flex items-center gap-2 transition-colors">
                              <BanknotesIcon className="w-4 h-4" /> Zahlungen verwalten
                            </button>
                          )}

                          <button onClick={(e) => { e.stopPropagation(); closeDropdown(); router.push(`/dashboard/customers/${order.customerId}/edit-order/${order.id}`); }} className="px-4 py-2 text-left text-xs text-text-main hover:bg-white/5 flex items-center gap-2 transition-colors">
                            <DocumentTextIcon className="w-4 h-4" /> Bearbeiten
                          </button>

                          <button onClick={(e) => { e.stopPropagation(); closeDropdown(); router.push(`/dashboard/customers/${order.customerId}`); }} className="px-4 py-2 text-left text-xs text-text-main hover:bg-white/5 flex items-center gap-2 transition-colors">
                            <ClipboardDocumentListIcon className="w-4 h-4" /> In Kundenakte öffnen
                          </button>

                          {/* Delete or Storno */}
                          <div className="h-px bg-white/5 my-1 w-full"></div>
                          
                          {['draft', 'archived', 'quote'].includes(order.status) ? (
                            onDelete && (
                              <button onClick={(e) => { e.stopPropagation(); closeDropdown(); onDelete(order); }} className="px-4 py-2 text-left text-xs text-red-500 hover:bg-red-500/10 flex items-center gap-2 transition-colors font-semibold">
                                <TrashIcon className="w-4 h-4" /> Löschen
                              </button>
                            )
                          ) : (
                            onStorno && (
                              <button onClick={(e) => { e.stopPropagation(); closeDropdown(); onStorno(order); }} className="px-4 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors">
                                <ReceiptRefundIcon className="w-4 h-4" /> Stornieren
                              </button>
                            )
                          )}

                        </div>
                      </>
                    )}
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
