import React from 'react';
import { renderToFile } from '@react-pdf/renderer';
import { OrderPDF } from '../src/components/pdf/OrderPDF';

const dummyOrder = {
  orderNumber: 'ANG-2026-0042',
  documentDate: '2026-09-25',
  billingAddress: {
    salutation: 'Herr',
    firstName: 'Max',
    lastName: 'Mustermann',
    street: 'Königsallee',
    houseNr: '42',
    zip: '44787',
    city: 'Bochum',
  },
  orderMeta: {
    movingDateFrom: '2026-10-15',
    validUntil: '2026-10-10',
  },
  logistics: {
    a_street: 'Musterstraße',
    a_houseNr: '12',
    a_zip: '44787',
    a_city: 'Bochum',
    a_floor: '2. OG',
    a_elevator: false,
    a_distance: 15,
    a_parking: true,
    b_street: 'Zielstraße',
    b_houseNr: '99',
    b_zip: '45127',
    b_city: 'Essen',
    b_floor: '1. OG',
    b_elevator: true,
    b_distance: 10,
  },
  services: [
    { name: 'Umzugstransport (32 m³, 3 Fachkräfte)', unitPrice: 750, quantity: 1, unit: 'Pauschal' },
    { name: 'Möbelmontage & Demontage', unitPrice: 150, quantity: 1, unit: 'Pauschal' },
    { name: 'Halteverbotszone inkl. Genehmigung', unitPrice: 100, quantity: 1, unit: 'Stück' },
  ],
  texts: {
    quoteIntro: 'Sehr geehrter Herr Mustermann,\nvielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes freibleibendes Angebot für Ihren geplanten Umzug:',
    paymentTerms: 'Der Rechnungsbetrag ist am Tag des Umzugs nach Entladung in bar oder per Echtzeit-Überweisung ohne Abzug zahlbar.',
  },
};

const dummySettings = {
  companyName: 'Rothirsch Umzüge & Logistik GmbH',
  street: 'Bochumer Str. 10',
  zip: '44787',
  city: 'Bochum',
  phone: '0234 / 123456',
  email: 'info@rothirsch-umzug.de',
  website: 'www.rothirsch-umzug.de',
  ceo: 'Bashar Al-Rothirsch',
  bankName: 'Sparkasse Bochum',
  iban: 'DE12 4305 0001 0000 1234 56',
  bic: 'WELADED1BOC',
  taxId: '306/5123/4567',
  vatId: 'DE987654321',
};

async function run() {
  const out = 'C:/Users/PC-Bashar/.gemini/antigravity/brain/259db8c0-86b5-4943-837f-1eebdb553a60/scratch/preview-angebot.pdf';
  await renderToFile(<OrderPDF order={dummyOrder} customer={dummyOrder.billingAddress} settings={dummySettings} />, out);
  console.log('Rendered to', out);
}

run();
