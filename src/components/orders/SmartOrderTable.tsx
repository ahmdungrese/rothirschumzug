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
  GlobeAltIcon,
  FolderOpenIcon,
  PencilSquareIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PDFDownloadButton } from '@/components/pdf/PDFDownloadButton';
import { calculateOrderTotals, calculateOpenAmount, calculateTotalPaid } from '@/lib/financeHelpers';

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
  if (orders.length === 0) {
    return (
      <div className="glass-panel p-12 text-center rounded-2xl text-text-muted italic border border-white/5 shadow-xl">
        Keine Einträge gefunden.
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl border border-structure overflow-visible shadow-xl relative z-10">
      <div className="overflow-x-auto custom-scrollbar">
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

              // Intelligent Total Calculation
              const grossTotal = calculateOrderTotals(order).gross;
              const totalPaid = calculateTotalPaid(order);
              const isCanceled = order.status === 'canceled' || order.status === 'invoice_cancelled';
              const openAmount = calculateOpenAmount(order);
              const isInvoice = order.type === 'invoice' || order.status?.startsWith('invoice');
              const displayNumber = order.invoiceNumber || order.orderNumber || '-';
              const isMovingSoon = !isInvoice && order.logistics?.movingDate && new Date(order.logistics.movingDate).getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000;

              return (
                <tr 
                  key={order.id} 
                  className="hover:bg-white/[0.04] transition-colors group"
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
                    {isInvoice && openAmount > 0 && !isCanceled && (
                      <div className="text-xs text-red-400 font-bold mt-1">
                        Offen: € {openAmount.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                  </td>

                  {/* Aktionen Grid */}
                  <td className="px-6 py-4">
                    <div className="grid grid-cols-2 gap-1.5 w-fit ml-auto">
                      {/* Kundenakte */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/customers/${order.customerId}`); }}
                        className="p-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors flex justify-center items-center"
                        title="In Kundenakte öffnen"
                      >
                        <FolderOpenIcon className="w-5 h-5" />
                      </button>

                      {/* Bearbeiten */}
                      <button 
                        onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/customers/${order.customerId}/edit-order/${order.id}`); }}
                        className="p-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg transition-colors flex justify-center items-center"
                        title="Bearbeiten"
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                      </button>

                      {/* PDF */}
                      <div onClick={e => e.stopPropagation()} className="w-full h-full flex">
                        <PDFDownloadButton 
                          order={order} 
                          customer={customer} 
                          type={isInvoice ? 'invoice' : (['confirmed', 'completed'].includes(order.status) ? 'contract' : 'order')}
                          iconOnly={true}
                          customIcon={<DocumentArrowDownIcon className="w-5 h-5" />}
                          className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex justify-center items-center w-full"
                        />
                      </div>

                      {/* Delete or Storno (4th action) */}
                      {!isInvoice ? (
                        onDelete && (
                          <button onClick={(e) => { e.stopPropagation(); onDelete(order); }} className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors flex justify-center items-center" title="Löschen">
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        )
                      ) : (
                        onStorno && order.status !== 'canceled' && (
                          <button onClick={(e) => { e.stopPropagation(); onStorno(order); }} className="p-2.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg transition-colors flex justify-center items-center" title="Stornieren">
                            <ReceiptRefundIcon className="w-5 h-5" />
                          </button>
                        )
                      )}
                      
                      {/* Optional 5th action (Contextual) - shown below if applicable */}
                      {order.status === 'quote' && onDispo && (
                        <button onClick={(e) => { e.stopPropagation(); onDispo(order); }} className="p-2.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors flex justify-center items-center col-span-2" title="Disponieren">
                          <TruckIcon className="w-5 h-5" />
                        </button>
                      )}
                      {order.status === 'confirmed' && onGenerateInvoice && (
                        <button onClick={(e) => { e.stopPropagation(); onGenerateInvoice(order); }} className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg transition-colors flex justify-center items-center col-span-2" title="Rechnung schreiben">
                          <DocumentCheckIcon className="w-5 h-5" />
                        </button>
                      )}
                      {isInvoice && order.status !== 'canceled' && (
                        <button onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/customers/${order.customerId}`); }} className="p-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors flex justify-center items-center col-span-2" title="Zahlungen verwalten">
                          <BanknotesIcon className="w-5 h-5" />
                        </button>
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
