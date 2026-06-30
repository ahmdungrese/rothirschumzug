import Link from 'next/link';
import { UserCircleIcon, BuildingOfficeIcon, DocumentTextIcon, CheckBadgeIcon, ClipboardDocumentListIcon, CalendarIcon, ArrowRightIcon, PlusIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';
import { getSourceBadgeStyle } from './SmartCustomerTable';

export function SmartCustomerCard({ customer, latestOrder }: { customer: any, latestOrder: any }) {
  const router = useRouter();
  
  // Default State (No order)
  let statusText = "Keine Aufträge";
  let statusBadge = "bg-black/20 text-text-muted border-white/5";
  let btnText = "Neues Angebot";
  let btnIcon = <PlusIcon className="w-4 h-4" />;
  let btnAction = () => router.push(`/dashboard/customers/${customer.id}/new-order`);
  let btnStyle = "btn-primary w-full justify-center text-sm py-2";

  if (latestOrder) {
    switch (latestOrder.status) {
      case 'draft':
        statusText = "Entwurf offen";
        statusBadge = "bg-orange-500/10 text-orange-400 border-orange-500/20";
        btnText = "Angebot fertigstellen";
        btnIcon = <DocumentTextIcon className="w-4 h-4" />;
        btnAction = () => router.push(`/dashboard/customers/${customer.id}/edit-order/${latestOrder.id}`);
        btnStyle = "bg-orange-500 hover:bg-orange-600 text-white w-full rounded-lg font-bold flex items-center justify-center gap-2 text-sm py-2 transition-colors shadow-lg shadow-orange-500/20";
        break;
      case 'quote':
        statusText = "Wartet auf Antwort";
        statusBadge = "bg-blue-500/10 text-blue-400 border-blue-500/20";
        btnText = "Angebot öffnen";
        btnIcon = <ArrowRightIcon className="w-4 h-4" />;
        btnAction = () => router.push(`/dashboard/customers/${customer.id}/edit-order/${latestOrder.id}`);
        btnStyle = "bg-blue-500 hover:bg-blue-600 text-white w-full rounded-lg font-bold flex items-center justify-center gap-2 text-sm py-2 transition-colors shadow-lg shadow-blue-500/20";
        break;
      case 'clarification':
        statusText = "In Klärung";
        statusBadge = "bg-purple-500/10 text-purple-400 border-purple-500/20";
        btnText = "Klärung bearbeiten";
        btnIcon = <DocumentTextIcon className="w-4 h-4" />;
        btnAction = () => router.push(`/dashboard/customers/${customer.id}/edit-order/${latestOrder.id}`);
        btnStyle = "bg-purple-500 hover:bg-purple-600 text-white w-full rounded-lg font-bold flex items-center justify-center gap-2 text-sm py-2 transition-colors shadow-lg shadow-purple-500/20";
        break;
      case 'confirmed':
        statusText = "Auftrag bestätigt";
        statusBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        btnText = "Akte öffnen";
        btnIcon = <CheckBadgeIcon className="w-4 h-4" />;
        btnAction = () => router.push(`/dashboard/customers/${customer.id}`);
        btnStyle = "bg-emerald-500 hover:bg-emerald-600 text-white w-full rounded-lg font-bold flex items-center justify-center gap-2 text-sm py-2 transition-colors shadow-lg shadow-emerald-500/20";
        break;
      case 'completed':
        statusText = "Umzug abgeschlossen";
        statusBadge = "bg-green-500/10 text-green-400 border-green-500/20";
        btnText = "Rechnung schreiben";
        btnIcon = <DocumentTextIcon className="w-4 h-4" />;
        btnAction = () => router.push(`/dashboard/customers/${customer.id}/new-order?type=invoice`);
        btnStyle = "btn-secondary w-full justify-center text-sm py-2 text-green-400 border-green-500/30 hover:bg-green-500/10";
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
        btnAction = () => router.push(`/dashboard/customers/${customer.id}`);
        btnStyle = isOverdue 
          ? "bg-red-500 hover:bg-red-600 text-white w-full rounded-lg font-bold flex items-center justify-center gap-2 text-sm py-2 transition-colors shadow-lg shadow-red-500/20"
          : "btn-secondary w-full justify-center text-sm py-2 text-red-400 border-red-500/30 hover:bg-red-500/10";
        break;
      case 'invoice_paid':
        statusText = "Abgeschlossen";
        statusBadge = "bg-white/5 text-text-muted border-white/5";
        btnText = "Neues Angebot";
        btnIcon = <PlusIcon className="w-4 h-4" />;
        btnAction = () => router.push(`/dashboard/customers/${customer.id}/new-order`);
        btnStyle = "btn-secondary w-full justify-center text-sm py-2";
        break;
      default:
        statusText = "Inaktiv";
        break;
    }
  }

  // Fallback for missing names
  const displayName = customer.type === 'firma' 
    ? (customer.lastName || "Unbekannte Firma") 
    : `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || "Unbekannter Kunde";

  return (
    <div 
      onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
      className="glass-panel p-5 rounded-2xl flex flex-col h-full border border-white/5 hover:border-white/10 transition-all hover:bg-white/[0.04] shadow-xl group cursor-pointer"
    >
      
      {/* Header: Type and Status */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2">
          {customer.type === 'firma' ? (
            <div className="bg-primary/20 p-2 rounded-lg text-primary">
              <BuildingOfficeIcon className="w-5 h-5" />
            </div>
          ) : (
            <div className="bg-white/5 p-2 rounded-lg text-text-muted group-hover:text-text-main transition-colors">
              <UserCircleIcon className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className={`px-3 py-1 rounded-full text-xs border ${statusBadge}`}>
          {statusText}
        </div>
      </div>

      {/* Customer Info */}
      <div className="flex-1">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-lg font-bold text-text-main leading-tight line-clamp-1" title={displayName}>
            {displayName}
          </h3>
          {customer.source && (
            <div className={`shrink-0 ml-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getSourceBadgeStyle(customer.source)}`}>
              {customer.source}
            </div>
          )}
        </div>
        
        {customer.type === 'firma' && customer.firstName && (
          <p className="text-sm text-text-muted mb-2">Ansprechpartner: {customer.firstName}</p>
        )}

        <div className="space-y-1.5 mt-3">
          {latestOrder?.logistics?.a_city && latestOrder?.logistics?.b_city && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 px-2 py-1.5 rounded-md mb-2 border border-primary/20">
              <span className="font-semibold truncate">{latestOrder.logistics.a_city}</span>
              <ArrowRightIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="font-semibold truncate">{latestOrder.logistics.b_city}</span>
            </div>
          )}

          {customer.phone && (
            <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors">
              <PhoneIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">{customer.phone}</span>
            </a>
          )}
          {customer.email && (
            <a href={`mailto:${customer.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-2 text-sm text-text-muted hover:text-primary transition-colors">
              <EnvelopeIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">{customer.email}</span>
            </a>
          )}
          {!customer.phone && !customer.email && !latestOrder?.logistics && (
            <p className="text-sm text-text-muted italic opacity-50">Keine weiteren Daten</p>
          )}
        </div>
      </div>

      {/* Action Area */}
      <div className="mt-5 pt-4 border-t border-white/5 flex flex-col gap-3">
        <button onClick={(e) => { e.stopPropagation(); btnAction(); }} className={`${btnStyle} py-3 sm:py-2 text-base sm:text-sm shadow-md`}>
          {btnIcon} {btnText}
        </button>

        {/* Quick Links */}
        {latestOrder && (
          <div className="flex flex-wrap gap-2 justify-center" onClick={e => e.stopPropagation()}>
            <Link 
              href={`/dashboard/customers/${customer.id}?action=view-pdf&orderId=${latestOrder.id}`} 
              className="flex-1 min-w-[100px] py-2.5 sm:py-1.5 px-2 bg-black/20 hover:bg-black/40 text-text-muted hover:text-primary rounded-md text-sm sm:text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              title="Angebot/Rechnung als PDF ansehen"
            >
              <DocumentTextIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> PDF
            </Link>
            <Link 
              href={`/dashboard/customers/${customer.id}?action=view-protocol&orderId=${latestOrder.id}`} 
              className="flex-1 min-w-[100px] py-2.5 sm:py-1.5 px-2 bg-black/20 hover:bg-black/40 text-text-muted hover:text-primary rounded-md text-sm sm:text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              title="Abnahmeprotokoll"
            >
              <ClipboardDocumentListIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" /> Protokoll
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
