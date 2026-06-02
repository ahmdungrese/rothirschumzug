"use client";
import { PDFViewer } from '@react-pdf/renderer';
import { OrderPDF } from './OrderPDF';
import { EmployeeSheetPDF } from './EmployeeSheetPDF';

export default function PDFViewerWrapper({ order, customer, type = 'order' }: { order: any, customer: any, type?: 'order' | 'employee' }) {
  return (
    <div className="w-full h-[800px] rounded-xl overflow-hidden shadow-xl border border-structure">
      <PDFViewer width="100%" height="100%">
        {type === 'order' ? <OrderPDF order={order} customer={customer} /> : <EmployeeSheetPDF order={order} customer={customer} />}
      </PDFViewer>
    </div>
  );
}
