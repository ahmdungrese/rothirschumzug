"use client";
import dynamic from 'next/dynamic';

const PDFDownload = dynamic(() => import('./PDFDownloadButtonWrapper'), {
  ssr: false,
  loading: () => (
    <button disabled className="btn-primary flex items-center justify-center gap-2 px-4 py-2 opacity-50">
      Lade...
    </button>
  )
});

export function PDFDownloadButton({ order, customer, type = 'order', className = 'btn-primary px-4 py-2 rounded-lg text-sm font-bold shadow-sm', iconOnly = false, customIcon = null }: { order: any, customer: any, type?: 'order' | 'employee' | 'invoice' | 'contract' | 'protocol', className?: string, iconOnly?: boolean, customIcon?: React.ReactNode }) {
  return <PDFDownload order={order} customer={customer} type={type} className={className} iconOnly={iconOnly} customIcon={customIcon} />;
}
