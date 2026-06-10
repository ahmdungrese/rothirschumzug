"use client";
import dynamic from 'next/dynamic';

const PDFViewer = dynamic(() => import('./PDFViewerWrapper'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[800px] rounded-xl border border-structure bg-bg-dark flex flex-col items-center justify-center">
      <div className="animate-spin h-12 w-12 border-t-2 border-b-2 border-primary rounded-full mb-4"></div>
      <p className="text-text-muted">PDF-Dokumentenengine wird geladen...</p>
    </div>
  )
});

export function PDFGenerator({ order, customer, type = 'order' }: { order: any, customer: any, type?: 'order' | 'employee' | 'invoice' | 'contract' | 'protocol' }) {
  return <PDFViewer order={order} customer={customer} type={type} />;
}
