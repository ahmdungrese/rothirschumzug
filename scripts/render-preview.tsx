import React from 'react';
import ReactPDF from '@react-pdf/renderer';
import path from 'path';
import { OrderPDF } from '../src/components/pdf/OrderPDF';

const sampleCustomer = {
  firstName: 'Max',
  lastName: 'Mustermann',
  salutation: 'Herr',
  type: 'privat',
  phone: '+49 170 1234567',
  street: 'Musterstraße 12',
  zip: '44799',
  city: 'Bochum',
};

const sampleSettings = {
  companyName: 'Rothirsch Umzug',
  street: 'Haydnstr. 16',
  zip: '44805',
  city: 'Bochum',
  phone: '+49 1774652154',
  email: 'info@Rothirsch-umzug.de',
  website: 'www.Rothirsch-umzug.de',
  manager: 'Tarek Lababidi',
  taxId: 'DE369077991',
  taxNumber: '350/5143/3272',
  bankName: 'Sparkasse Bochum',
  iban: 'DE51 4305 0001 0033 4371 12',
  bic: 'WELADED1B0C',
};

const sampleOrder = {
  orderNumber: 'ANG-2026-001',
  documentDate: new Date().toISOString(),
  orderMeta: {
    movingDateFrom: '2026-10-15',
    validUntil: '2026-10-01',
    paymentMethod: 'Überweisung',
    manager: 'Tarek Lababidi',
  },
  logistics: {
    a_street: 'Kaiserstr. 5',
    a_zip: '44787',
    a_city: 'Bochum',
    b_street: 'Goethestr. 20',
    b_zip: '44791',
    b_city: 'Bochum',
  },
  services: [
    { name: 'Transport pauschal inkl. LKW & Team', quantity: 1, unit: 'Pauschal', unitPrice: 850 },
    { name: 'Möbelmontage & -demontage', quantity: 4, unit: 'Std', unitPrice: 45 },
  ],
};

async function run() {
  const outPath = 'C:\\Users\\PC-Bashar\\.gemini\\antigravity\\brain\\259db8c0-86b5-4943-837f-1eebdb553a60\\scratch\\preview-angebot.pdf';
  await ReactPDF.renderToFile(
    <OrderPDF order={sampleOrder} customer={sampleCustomer} settings={sampleSettings} employeeName="Tarek Lababidi" />,
    outPath
  );
  console.log('Rendered to:', outPath);
}
run();
