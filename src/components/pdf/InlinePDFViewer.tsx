"use client";
import dynamic from 'next/dynamic';

const PDFViewerWrapped = dynamic(() => import('./InlinePDFViewerWrapper'), {
  ssr: false,
  loading: () => (
    <div className="w-full min-h-[800px] flex items-center justify-center bg-gray-50 border border-gray-200 rounded-xl">
      <div className="animate-pulse text-gray-500 font-medium">Lade PDF Vorschau...</div>
    </div>
  )
});

export function InlinePDFViewer({ order, customer, type = 'order', forceLiveQuote = false }: { order: any, customer: any, type?: 'order' | 'employee' | 'invoice' | 'contract' | 'protocol', forceLiveQuote?: boolean }) {
  return <PDFViewerWrapped order={order} customer={customer} type={type} forceLiveQuote={forceLiveQuote} />;
}
