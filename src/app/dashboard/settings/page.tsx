"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Cog6ToothIcon, BuildingOfficeIcon, UsersIcon, CurrencyEuroIcon, DocumentTextIcon, CheckIcon, ServerStackIcon, TruckIcon, CalendarIcon, LinkIcon, EnvelopeIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { TeamAccessManager } from '@/components/settings/TeamAccessManager';
import { ActivityLogViewer } from '@/components/settings/ActivityLogViewer';
import { getCol } from '@/lib/demoMode';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { ResetDatabaseModal } from '@/components/settings/ResetDatabaseModal';

const TABS = [
  { id: 'basisdaten', name: 'Basisdaten', icon: BuildingOfficeIcon },
  { id: 'ressourcen', name: 'Team & Zugänge', icon: UsersIcon },
  { id: 'ansprechpartner', name: 'CRM & Kontakte', icon: UsersIcon },
  { id: 'immobilien', name: 'Immobilienarten', icon: BuildingOfficeIcon },
  { id: 'leistungen', name: 'Leistungen & Zahlungen', icon: CurrencyEuroIcon },
  { id: 'texte', name: 'Textbausteine & AGB', icon: DocumentTextIcon },
  { id: 'vorlagen', name: 'Nachrichten-Vorlagen', icon: DocumentTextIcon },
  { id: 'protokolle', name: 'Protokolle & Vorlagen', icon: DocumentTextIcon },
  { id: 'system', name: 'System & Finanzen', icon: ServerStackIcon },
  { id: 'integration', name: 'Kalender & APIs', icon: CalendarIcon },
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('basisdaten');
  const [showResetModal, setShowResetModal] = useState(false);
  const [settings, setSettings] = useState<any>({
    companyName: 'Rothirschumzug',
    street: 'Haydnstr. 16',
    zip: '44805',
    city: 'Bochum',
    phone: '+49 1774652154',
    email: 'info@Rothirsch-umzug.de',
    website: 'www.Rothirsch-umzug.de',
    manager: 'Tarek Lababidi',
    taxId: 'DE369077991',
    taxNumber: '350/5143/3272',
    register: '',
    bankName: 'Sparkasse Bochum',
    iban: 'DE51 4305 0001 0033 4371 12',
    bic: 'WELADED1B0C',
    contacts: ['Tarek Lababidi'],
    customerSources: ['Google Suche', 'Check24', 'Empfehlung', 'Eigene Website', 'Kleinanzeigen', 'Direkter Anruf'],
    propertyTypes: ['Haus', 'Wohnung', 'Einfamilienhaus', 'Reihenhaus', 'Büro / Gewerbe', 'Lager / Garage', 'Sonstiges'],
    taxRate: 19,
    dunningFee: 5,
    nextInvoiceNumber: 2,
    nextOrderNumber: 1,
    quoteValidDays: 14,
    employees: ['Ali', 'Thomas', 'Klaus', 'Mustafa'],
    vehicles: ['LKW 7,5t (Eigener)', 'Sixt Koffer 3,5t (A)', 'Sixt Koffer 3,5t (B)'],
    texts: {
      quoteIntro: 'Sehr geehrte Damen und Herren,\nvielen Dank für Ihre Anfrage. Wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen:',
      quoteOutro: 'Alle angegebenen Preise verstehen sich als Bruttopreise und beinhalten die gesetzliche Mehrwertsteuer.\nWir danken Ihnen herzlich für Ihr Vertrauen und die angenehme Zusammenarbeit.',
      quoteGreeting: '„Bei Fragen zögern Sie bitte nicht, uns zu kontaktieren. Wir sind jederzeit für Sie erreichbar.“\n\nMit freundlichen Grüßen\nRothirschumzug',
      orderIntro: 'Sehr geehrte Damen und Herren,\nvielen Dank für Ihre Unterschrift. Hiermit bestätigen wir Ihren Auftrag verbindlich.',
      orderOutro: 'Wir freuen uns auf den gemeinsamen Umzug und garantieren Ihnen einen reibungslosen Ablauf.',
      orderGreeting: 'Mit freundlichen Grüßen\nRothirschumzug',
      insurance: 'Mit unserer Versicherung ist Ihr Umzugsgut abgesichert. Für diesen Transport deckt unser Unternehmen eine Transportgüterversicherung ein, ohne dass hierfür zusätzliche Kosten entstehen. Bei der Übernahme Ihres Umzugsgutes gilt eine gesetzliche Haftung gem. Paragraph 451g HGB - beschränkt auf einen Zeitwert von €620,00 / cbm.',
      invoiceIntro: 'Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen für unsere erbrachten Leistungen:',
      invoiceOutro: 'Bitte überweisen Sie den Rechnungsbetrag innerhalb von 5 Tagen ohne Abzug auf unser Konto.',
      invoiceGreeting: 'Für etwaige Fragen stehen wir Ihnen selbstverständlich jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\nRothirschumzug',
      googleReview: 'Wir hoffen, dass alles zu Ihrer Zufriedenheit war, und würden uns über eine positive Bewertung auf Google freuen.',
      dunningIntro: 'Leider konnten wir bis zum heutigen Tag keinen Zahlungseingang für die unten aufgeführte Rechnung feststellen. Sicherlich ist dies nur ein Versehen Ihrerseits.\n\nWir bitten Sie daher, den ausstehenden Betrag innerhalb der nächsten 5 Tage auf unser unten genanntes Konto zu überweisen.',
      agb: 'Allgemeine Geschäftsbedingungen (AGB) – Rothirschumzug\n\n§1 Geltungsbereich\nDiese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen uns und dem Kunden...'
    },
    paymentMethods: [
      { name: 'Überweisung', textQuote: 'Wir bitten Sie höflich, den Rechnungsbetrag innerhalb von 5 Tagen nach Abschluss des Umzugs per Überweisung zu begleichen.', textInvoice: 'Bitte überweisen Sie den Rechnungsbetrag innerhalb von 5 Tagen ohne Abzug auf unser Konto.', shortText: '5 Tagen', dueDays: 5 },
      { name: 'Barzahlung', textQuote: 'Wir bitten Sie höflich, den Rechnungsbetrag unmittelbar nach Abschluss des Umzugs in bar zu begleichen.', textInvoice: 'Der Rechnungsbetrag wurde in bar bezahlt. Vielen Dank für Ihre Zahlung!', shortText: 'Am Umzugstag', dueDays: 0 },
      { name: 'Überweisung Echtzeit', textQuote: 'Wir bitten Sie höflich, den Rechnungsbetrag unmittelbar nach Abschluss des Umzugs per Echtzeitüberweisung zu begleichen.', textInvoice: 'Der Rechnungsbetrag wurde per Banküberweisung bezahlt. Vielen Dank für Ihre Zahlung!', shortText: 'Sofort', dueDays: 0 }
    ],
    catalog: [
      {
        category: 'Allgemein',
        items: [
          { name: 'Transport inkl. Be- und Entladung, Umzugspersonal & Fahrzeugkosten', price: 0, unit: 'Pauschal' },
          { name: 'Ein- und Auspackservice (inkl. Kartons & Schutzmaterial)', price: 0, unit: 'Pauschal' },
          { name: 'Kartons bereitstellen', price: 0, unit: 'Stk' },
          { name: 'Arbeitsplatte anpassen', price: 0, unit: 'Stk' },
          { name: 'Küchenauf- und abbau (inkl. Anpassung der Arbeitsplatte)', price: 0, unit: 'Pauschal' },
          { name: 'Transport inkl. Be- und Entladung', price: 0, unit: 'Pauschal' },
          { name: 'Umzugspersonal (Fahrer + Umzugshelfer)', price: 0, unit: 'Std' },
          { name: 'Fahrzeugkosten (Kraftstoff)', price: 0, unit: 'Pauschal' },
          { name: 'Versicherung Basic', price: 0, unit: 'Pauschal' },
          { name: 'Möbellift', price: 0, unit: 'Std' },
          { name: 'Einlagerung', price: 0, unit: 'm³' },
          { name: 'Kellerräumung', price: 0, unit: 'Pauschal' },
          { name: 'Garagenräumung', price: 0, unit: 'Pauschal' },
          { name: 'Deckenlampen montieren', price: 0, unit: 'Stk' },
          { name: 'Einpacken der Möbel mit Decken und Schutzfolien', price: 0, unit: 'Std' },
          { name: 'Neue Leistung', price: 0, unit: 'Std' }
        ]
      },
      {
        category: 'Küchenservice',
        items: [
          { name: 'Aufbauen Von Küche', price: 0, unit: 'Std' },
          { name: 'Abbauen Von Küche', price: 0, unit: 'Std' }
        ]
      },
      {
        category: 'Kartonservice',
        items: [
          { name: 'Einpackservice', price: 0, unit: 'Stk' },
          { name: 'Auspackservice', price: 0, unit: 'Stk' },
          { name: 'Ein- und Auspacken', price: 0, unit: 'Stk' }
        ]
      },
      {
        category: 'Möbelservice',
        items: [
          { name: 'Montieren Von Möbel', price: 0, unit: 'Std' },
          { name: 'Demontieren Von Möbel', price: 0, unit: 'Std' },
          { name: 'Demontage und Montage von Möbel', price: 0, unit: 'Std' },
          { name: 'Möbelmontage & -demontage (inkl. Schutzverpackung)', price: 0, unit: 'Std' }
        ]
      }
    ],
    protocolCategories: [
      { id: 'cat1', name: 'Gefahrenübergang (Haftungsausschluss)', text: 'Der Kunde bestätigt hiermit, dass der Transport/Umzug auf eigene Gefahr erfolgt. Das Unternehmen übernimmt keine Haftung für entstandene Kratzer, Schäden oder Mängel an den betreffenden Gegenständen oder am Gebäude.' },
      { id: 'cat2', name: 'Keine Schäden (Abschluss-Protokoll)', text: 'Der Kunde bestätigt hiermit ausdrücklich, dass der Umzug und alle vereinbarten Leistungen vollständig und zu seiner vollsten Zufriedenheit durchgeführt wurden. Es sind keine Schäden an Möbeln, dem Inventar oder in den Räumlichkeiten (Treppenhaus, Wände, Böden etc.) entstanden.' },
      { id: 'cat3', name: 'Schadensprotokoll', text: 'Folgende Vorschäden / Schäden wurden vor oder während den Arbeiten dokumentiert:\n1. \n2. \n' }
    ],
    protocolTemplates: [
      'Keine Mängel festgestellt.',
      'Treppenhauswand war bereits zerkratzt.',
      'Kundeneigener Schrank passt nicht durchs Treppenhaus. Transport auf eigene Gefahr, keine Haftung für Kratzer.',
      'Fernseher hat Kratzer im Display.'
    ],
    communicationTemplates: [
      {
        id: 't1',
        name: 'Erstkontakt (Bilder oder Liste erhalten)',
        subject: 'Angebot für Ihren Umzug',
        body: 'Hallo,\n\nvielen Dank für Ihr Interesse an unserem Service und für die Übersendung der Bilder.\n\nGerne erstellen wir Ihnen ein individuelles Angebot mit Festpreis und lassen Ihnen dieses zeitnah zukommen.\n\nSollten Sie vorab noch weitere Fragen haben, stehen wir Ihnen selbstverständlich jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\nadmin@rothirsch-umzug.de\nRothirsch Umzüge\n\nKontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de'
      },
      {
        id: 't2',
        name: 'Erstkontakt (Keine Bilder oder Liste)',
        subject: 'Ihre Umzugsanfrage',
        body: 'Hallo,\n\nvielen Dank für Ihr Interesse an unserem Service. Gerne erstellen für Sie ein Angebot mit einem festen Preis. Teilen Sie uns bitte Bilder oder eine Liste mit den gewünschten Leistungen mit. Sie können uns auch gerne Ihre Telefonnummer mitteilen oder uns jederzeit anrufen, um Ihren Umzug zu besprechen.\n\nMit freundlichen Grüßen\nadmin@rothirsch-umzug.de\nRothirsch Umzüge\n\nKontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de'
      },
      {
        id: 't3',
        name: 'Angebot schicken',
        subject: 'Ihr Umzugsangebot',
        body: 'Sehr geehrte Damen und Herren,\n\nanbei sende ich Ihnen unser Angebot für Ihren bevorstehenden Umzug. Bitte überprüfen Sie die angehängte Datei für die detaillierten Informationen und Konditionen. Das Angebot wurde gemäß Ihren Anforderungen erstellt und beinhaltet alle gewünschten Leistungen.\n\nBei Rothirsch Umzüge legen wir großen Wert auf den Schutz Ihrer Möbel. Daher werden wir alle Möbelstücke sorgfältig mit Umzugsdecken und hochwertigen Schutzmaterialien schützen, um sicherzustellen, dass sie während des Transports optimal geschützt sind.\n\nIch möchte klarstellen, dass es sich bei unserem Angebot um einen Festpreis handelt. Das bedeutet, dass die vereinbarte Summe die endgültigen Kosten für Ihren Umzug abdeckt. Sie können darauf vertrauen, dass es keine unerwarteten zusätzlichen Gebühren gibt.\n\nWenn Sie mit dem Angebot zufrieden sind, bitten wir Sie um eine schriftliche Bestätigung, damit wir den Umzug entsprechend planen können. Bitte beachten Sie, dass die Termine vorbehaltlich der Verfügbarkeit sind und wir eine rechtzeitige Bestätigung benötigen, um Ihren Umzugstermin zu sichern.\n\nSollten Sie weitere Fragen haben oder Anpassungen am Angebot wünschen, stehe ich Ihnen gerne zur Verfügung. Sie können mich telefonisch oder per E-Mail kontaktieren.\n\nVielen Dank für Ihr Interesse an unseren Umzugsservices. Wir freuen uns darauf, Ihnen bei Ihrem Umzug behilflich zu sein.\n\nMit freundlichen Grüßen\nadmin@rothirsch-umzug.de\nRothirsch Umzüge\n\nKontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de'
      },
      {
        id: 't4',
        name: 'Nachfrage zu Ihrem Umzugsangebot',
        subject: 'Nachfrage zu Ihrem Umzugsangebot',
        body: 'Hallo,\n\nich wollte mich erkundigen, ob Sie bereits eine Entscheidung zu unserem Angebot getroffen haben. Der gewünschte Termin ist aktuell noch verfügbar – allerdings erhalten wir viele Anfragen, sodass eine zeitnahe Rückmeldung wichtig für die Reservierung ist.\n\nSollten noch Fragen offen sein oder Sie Anpassungen wünschen, können wir das gerne telefonisch besprechen. Uns ist wichtig, dass der Ablauf für Sie so reibungslos und angenehm wie möglich verläuft.\n\nGeben Sie uns einfach kurz Bescheid.\n\nVielen Dank im Voraus – wir würden uns freuen, Sie bei Ihrem Umzug unterstützen zu dürfen!\n\nMit freundlichen Grüßen\nadmin@rothirsch-umzug.de\nRothirsch Umzüge\n\nKontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de'
      },
      {
        id: 't5',
        name: 'Aktualisiertes Angebot schicken',
        subject: 'Ihr aktualisiertes Umzugsangebot',
        body: '{{Kunde_Anrede}},\n\nvielen Dank für Ihre Rückmeldung. Anbei erhalten Sie Ihr aktualisiertes Angebot, in dem wir Ihre Änderungswünsche berücksichtigt haben.\n\nFalls Sie noch weitere Fragen haben oder weitere Anpassungen benötigen, stehen wir Ihnen jederzeit gern zur Verfügung.\n\nMit freundlichen Grüßen\nadmin@rothirsch-umzug.de\nRothirsch Umzüge\n\nKontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de'
      },
      {
        id: 't6',
        name: 'Absage',
        subject: 'Schade, dass es nicht geklappt hat',
        body: 'Hallo,\n\nes ist schade zu hören, dass Sie sich für einen anderen Anbieter entschieden haben. Wir wünschen Ihnen dennoch viel Erfolg und einen reibungslosen Umzug.\n\nSollten Sie in Zukunft erneut Unterstützung benötigen, stehen wir Ihnen jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\nadmin@rothirsch-umzug.de\nRothirsch Umzüge\n\nKontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de'
      },
      {
        id: 't7',
        name: 'Bestätigung',
        subject: 'Auftragsbestätigung für Ihren Umzug',
        body: 'Hallo,\n\nvielen Dank für Ihr Vertrauen und die Bestätigung. Hiermit bestätigen wir Ihnen den Umzugstermin am {{Umzugsdatum}}.\n\nWir freuen uns auf die Zusammenarbeit und darauf, Ihnen den Weg in Ihr neues Zuhause zu erleichtern.\n\nMit freundlichen Grüßen\nadmin@rothirsch-umzug.de\nRothirsch Umzüge\n\nKontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de'
      },
      {
        id: 't8',
        name: 'Zeit des Umzugs (Wann trifft das Team ein?)',
        subject: 'Ihre Umzugs-Uhrzeit',
        body: 'Hallo,\n\nvielen Dank für Ihre Nachricht. Unser Team wird voraussichtlich zwischen 8:30 und 09:30 Uhr bei Ihnen eintreffen.\n\nMit freundlichen Grüßen\nadmin@rothirsch-umzug.de\nRothirsch Umzüge\n\nKontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de'
      },
      {
        id: 't9',
        name: 'Rechnung schicken',
        subject: 'Ihre Rechnung',
        body: 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie die Rechnung für die von uns erbrachten Dienstleistungen. Bitte nehmen Sie sich einen Moment Zeit, um diese zu überprüfen. Sollten Sie Fragen oder Anmerkungen haben, stehe ich Ihnen selbstverständlich gerne zur Verfügung.\n\nWir möchten uns bei Ihnen für Ihr Vertrauen bedanken und hoffen, dass Sie mit unseren Leistungen zufrieden sind. Falls ja, würden wir uns sehr über eine Bewertung auf Google oder Check24 freuen – oder auf beiden Plattformen. Ihr Feedback ist uns äußerst wichtig und hilft uns, unseren Service kontinuierlich zu verbessern.\n\nVielen Dank für Ihre Unterstützung und Ihr Vertrauen in unsere Arbeit.\n\nMit freundlichen Grüßen\nadmin@rothirsch-umzug.de\nRothirsch Umzüge\n\nKontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de'
      },
      {
        id: 't10',
        name: 'Neue Feature / Bewertung',
        subject: 'Vielen Dank für Ihre Bewertung',
        body: 'Hallo {{Kunde_Name}},\n\nvielen Dank für Ihre großartige Bewertung! Wir freuen uns wirklich sehr über Ihr positives Feedback und es ist schön zu hören, dass alles nach Ihren Wünschen gelaufen ist und Sie zufrieden sind. Es ist immer toll, mit so angenehmen Kunden wie Ihnen zusammenzuarbeiten.\n\nViele Grüße!\nadmin@rothirsch-umzug.de\nRothirsch Umzüge\n\nKontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de'
      }
    ]
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newContact, setNewContact] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newPropertyType, setNewPropertyType] = useState('');
  const [newProtocolCategoryName, setNewProtocolCategoryName] = useState('');
  const [newProtocolCategoryText, setNewProtocolCategoryText] = useState('');
  const [newProtocolTemplate, setNewProtocolTemplate] = useState('');
  const [newEmployee, setNewEmployee] = useState('');
  const [newVehicle, setNewVehicle] = useState('');
  
  // PIN Protection State
  const [isSystemUnlocked, setIsSystemUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  const fetchSettings = async () => {
    const docRef = doc(db, getCol('system'), 'settings');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      let data = docSnap.data();
      // AUTO-FIX: Falls in der Datenbank noch die alten "Premium"-Daten stecken, überschreiben wir sie sofort mit den echten Rothirsch-Daten
      if (data.companyName === 'Premium Umzüge' || data.companyName === 'Dein Unternehmen') {
        data.companyName = 'Rothirsch Umzüge';
        data.email = 'info@rothirsch-umzug.de';
        data.phone = '+49 177 4652154';
        data.street = 'Grillostr. 70';
        data.zip = '44799';
        data.city = 'Bochum';
        
        if (data.texts?.quoteGreeting) data.texts.quoteGreeting = data.texts.quoteGreeting.replace('Premium Umzüge', 'Rothirsch Umzüge');
        if (data.texts?.insurance) data.texts.insurance = data.texts.insurance.replace('Premium Umzüge', 'Rothirsch Umzüge');
        if (data.texts?.invoiceGreeting) data.texts.invoiceGreeting = data.texts.invoiceGreeting.replace('Premium Umzüge', 'Rothirsch Umzüge');
        if (data.texts?.agb) data.texts.agb = data.texts.agb.replace(/Premium Umzüge/g, 'Rothirsch Umzüge');
        
        await setDoc(docRef, data, { merge: true });
      }
      
      // Ensure arrays and new fields exist
      if (!data.customerSources) data.customerSources = ['Google Suche', 'Check24', 'Empfehlung', 'Eigene Website', 'Kleinanzeigen', 'Direkter Anruf'];
      if (!data.employees) data.employees = ['Ali', 'Thomas', 'Klaus', 'Mustafa'];
      if (!data.vehicles) data.vehicles = ['LKW 7,5t (Eigener)', 'Sixt Koffer 3,5t (A)', 'Sixt Koffer 3,5t (B)'];
      if (data.nextOrderNumber === undefined) data.nextOrderNumber = 1;
      if (!data.texts.orderIntro) {
        data.texts.orderIntro = 'Sehr geehrte Damen und Herren,\nvielen Dank für Ihre Unterschrift. Hiermit bestätigen wir Ihren Auftrag verbindlich.';
        data.texts.orderOutro = 'Wir freuen uns auf den gemeinsamen Umzug und garantieren Ihnen einen reibungslosen Ablauf.';
        data.texts.orderGreeting = 'Mit freundlichen Grüßen\nRothirsch Umzüge';
      }

      // Merge communicationTemplates if missing
      if (!data.communicationTemplates || data.communicationTemplates.length === 0) {
        data.communicationTemplates = settings.communicationTemplates;
      } else {
        // AUTO-FIX: Update existing templates to new formatting
        let updated = false;
        data.communicationTemplates = data.communicationTemplates.map((t: any) => {
          let newBody = t.body;
          if (newBody.includes('[Mitarbeiter]')) {
            newBody = newBody.replace(/\[Mitarbeiter\]/g, 'admin@rothirsch-umzug.de');
            updated = true;
          }
          if (newBody.includes('Kontaktdaten: Telefon: +49 1590 6603011 E-Mail: info@rothirsch-umzug.de Webseite: www.rothirsch-umzug.de')) {
            newBody = newBody.replace('Kontaktdaten: Telefon: +49 1590 6603011 E-Mail: info@rothirsch-umzug.de Webseite: www.rothirsch-umzug.de', 'Kontaktdaten:\nTelefon: +49 1590 6603011\nE-Mail: info@rothirsch-umzug.de\nWebseite: www.rothirsch-umzug.de');
            updated = true;
          }
          if (t.id === 't7' && t.body.includes('[Datum]')) {
            newBody = newBody.replace('das unterzeichnete Angebot', 'die Bestätigung');
            newBody = newBody.replace(/\[Datum\]/g, '{{Umzugsdatum}}');
            updated = true;
          }
          if (t.body.includes('[Name]')) {
             newBody = newBody.replace(/\[Name\]/g, '{{Kunde_Name}}');
             updated = true;
          }
          if (t.id === 't5') {
            if (newBody.includes('Sehr geehrte(r) {{Kunde_Name}}')) {
              newBody = newBody.replace('Sehr geehrte(r) {{Kunde_Name}}', '{{Kunde_Anrede}}');
              updated = true;
            }
            if (newBody.includes('Anbei senden wir Ihnen das überarbeitete Angebot sowie die angepasste Umzugsliste, die Ihren Änderungswünschen entspricht.')) {
              newBody = newBody.replace('Anbei senden wir Ihnen das überarbeitete Angebot sowie die angepasste Umzugsliste, die Ihren Änderungswünschen entspricht.', 'Anbei erhalten Sie Ihr aktualisiertes Angebot, in dem wir Ihre Änderungswünsche berücksichtigt haben.');
              updated = true;
            }
          }
          return { ...t, body: newBody };
        });
        if (updated) {
          await setDoc(docRef, { communicationTemplates: data.communicationTemplates }, { merge: true });
        }
      }
      
      // Migration for protocol categories
      if (!data.protocolCategories || data.protocolCategories.length === 0) {
        data.protocolCategories = [
          { id: 'cat1', name: 'Gefahrenübergang (Haftungsausschluss)', text: 'Der Kunde bestätigt hiermit, dass der Transport/Umzug auf eigene Gefahr erfolgt. Das Unternehmen übernimmt keine Haftung für entstandene Kratzer, Schäden oder Mängel an den betreffenden Gegenständen oder am Gebäude.' },
          { id: 'cat2', name: 'Keine Schäden (Abschluss-Protokoll)', text: 'Der Kunde bestätigt hiermit ausdrücklich, dass der Umzug und alle vereinbarten Leistungen vollständig und zu seiner vollsten Zufriedenheit durchgeführt wurden. Es sind keine Schäden an Möbeln, dem Inventar oder in den Räumlichkeiten (Treppenhaus, Wände, Böden etc.) entstanden.' },
          { id: 'cat3', name: 'Schadensprotokoll', text: 'Folgende Vorschäden / Schäden wurden vor oder während den Arbeiten dokumentiert:\n1. \n2. \n' }
        ];
      }

      setSettings((prev: any) => ({ ...prev, ...data }));
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleResetSuccess = () => {
    // Wird nach erfolgreichem DB-Reset aufgerufen
    fetchSettings();
  };

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      // 1. Zähler-Schutz: Höchste verwendete Nummern abfragen
      const { collection, getDocs } = await import('firebase/firestore');
      const ordersSnap = await getDocs(collection(db, getCol('orders')));
      
      let maxQuote = 0;
      let maxInvoice = 0;

      ordersSnap.forEach(doc => {
        const d = doc.data();
        if (d.orderNumber && typeof d.orderNumber === 'string') {
          // Format: ANG-2026-006 -> extract 6
          const parts = d.orderNumber.split('-');
          if (parts.length === 3) {
            const num = parseInt(parts[2], 10);
            if (!isNaN(num) && num > maxQuote) maxQuote = num;
          }
        }
        if (d.invoiceNumber && typeof d.invoiceNumber === 'string') {
          // Format: RE-2026-011 -> extract 11
          const parts = d.invoiceNumber.split('-');
          if (parts.length === 3) {
            const num = parseInt(parts[2], 10);
            if (!isNaN(num) && num > maxInvoice) maxInvoice = num;
          }
        }
      });

      if (settings.nextQuoteNumber <= maxQuote) {
        alert(`Fehler: Es existiert bereits ein Angebot mit der Nummer ANG-${new Date().getFullYear()}-${maxQuote.toString().padStart(3, '0')}. Der Zähler für Angebote darf nicht unter ${maxQuote + 1} gesetzt werden.`);
        setSaveStatus('error');
        setIsSaving(false);
        return;
      }
      if (settings.nextInvoiceNumber <= maxInvoice) {
        alert(`Fehler: Es existiert bereits eine Rechnung mit der Nummer RE-${new Date().getFullYear()}-${maxInvoice.toString().padStart(3, '0')}. Der Zähler für Rechnungen darf nicht unter ${maxInvoice + 1} gesetzt werden.`);
        setSaveStatus('error');
        setIsSaving(false);
        return;
      }

      // Zombie-Feld "nextOfferNumber" entfernen, falls es noch im State hängt
      const settingsToSave = { ...settings };
      delete settingsToSave.nextOfferNumber;

      await setDoc(doc(db, getCol('system'), 'settings'), settingsToSave, { merge: true });
      // Um es in der DB explizit zu löschen:
      const { deleteField } = await import('firebase/firestore');
      await updateDoc(doc(db, getCol('system'), 'settings'), { nextOfferNumber: deleteField() }).catch(() => {});

      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Fehler beim Speichern", error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: string, value: any, nestedPath?: string) => {
    if (nestedPath) {
      setSettings((prev: any) => ({
        ...prev,
        [nestedPath]: {
          ...prev[nestedPath],
          [field]: value
        }
      }));
    } else {
      setSettings((prev: any) => ({ ...prev, [field]: value }));
    }
  };

  const addContact = () => {
    if (newContact.trim() && !settings.contacts.includes(newContact.trim())) {
      setSettings({ ...settings, contacts: [...settings.contacts, newContact.trim()] });
      setNewContact('');
    }
  };

  const removeContact = (contact: string) => {
    setSettings({ ...settings, contacts: settings.contacts.filter((c: string) => c !== contact) });
  };

  const addSource = () => {
    if (newSource.trim() && !settings.customerSources?.includes(newSource.trim())) {
      setSettings({ ...settings, customerSources: [...(settings.customerSources||[]), newSource.trim()] });
      setNewSource('');
    }
  };

  const removeSource = (source: string) => {
    setSettings({ ...settings, customerSources: settings.customerSources.filter((s: string) => s !== source) });
  };

  const addPropertyType = () => {
    if (newPropertyType.trim() && !settings.propertyTypes.includes(newPropertyType.trim())) {
      setSettings({ ...settings, propertyTypes: [...settings.propertyTypes, newPropertyType.trim()] });
      setNewPropertyType('');
    }
  };

  const removePropertyType = (pt: string) => {
    setSettings({ ...settings, propertyTypes: settings.propertyTypes.filter((p: string) => p !== pt) });
  };

  const addProtocolCategory = () => {
    if (newProtocolCategoryName.trim()) {
      const newCategory = {
        id: 'cat_' + Date.now(),
        name: newProtocolCategoryName.trim(),
        text: newProtocolCategoryText.trim()
      };
      setSettings({ ...settings, protocolCategories: [...(settings.protocolCategories||[]), newCategory] });
      setNewProtocolCategoryName('');
      setNewProtocolCategoryText('');
    }
  };

  const removeProtocolCategory = (id: string) => {
    setSettings({ ...settings, protocolCategories: settings.protocolCategories.filter((c: any) => c.id !== id) });
  };

  const updateProtocolCategory = (id: string, field: string, value: string) => {
    setSettings({ 
      ...settings, 
      protocolCategories: settings.protocolCategories.map((c: any) => c.id === id ? { ...c, [field]: value } : c)
    });
  };

  const addProtocolTemplate = () => {
    if (newProtocolTemplate.trim() && !settings.protocolTemplates?.includes(newProtocolTemplate.trim())) {
      setSettings({ ...settings, protocolTemplates: [...(settings.protocolTemplates||[]), newProtocolTemplate.trim()] });
      setNewProtocolTemplate('');
    }
  };

  const removeProtocolTemplate = (pt: string) => {
    setSettings({ ...settings, protocolTemplates: settings.protocolTemplates.filter((p: string) => p !== pt) });
  };

  const loadSampleProtocolCategories = () => {
    const samples = [
      { id: 'cat1', name: 'Gefahrenübergang (Haftungsausschluss)', text: 'Der Kunde bestätigt hiermit, dass der Transport/Umzug auf eigene Gefahr erfolgt. Das Unternehmen übernimmt keine Haftung für entstandene Kratzer, Schäden oder Mängel an den betreffenden Gegenständen oder am Gebäude.' },
      { id: 'cat2', name: 'Keine Schäden (Abschluss-Protokoll)', text: 'Der Kunde bestätigt hiermit ausdrücklich, dass der Umzug und alle vereinbarten Leistungen vollständig und zu seiner vollsten Zufriedenheit durchgeführt wurden. Es sind keine Schäden an Möbeln, dem Inventar oder in den Räumlichkeiten (Treppenhaus, Wände, Böden etc.) entstanden.' },
      { id: 'cat3', name: 'Schadensprotokoll', text: 'Folgende Vorschäden / Schäden wurden vor oder während den Arbeiten dokumentiert:\n1. \n2. \n' }
    ];
    setSettings({ ...settings, protocolCategories: samples });
    toast.success("Standard-Kategorien geladen! Bitte oben auf Speichern klicken.");
  };

  const addEmployee = () => {
    if (newEmployee.trim() && !settings.employees?.includes(newEmployee.trim())) {
      setSettings({ ...settings, employees: [...(settings.employees||[]), newEmployee.trim()] });
      setNewEmployee('');
    }
  };

  const removeEmployee = (emp: string) => {
    setSettings({ ...settings, employees: settings.employees.filter((e: string) => e !== emp) });
  };

  const addVehicle = () => {
    if (newVehicle.trim() && !settings.vehicles?.includes(newVehicle.trim())) {
      setSettings({ ...settings, vehicles: [...(settings.vehicles||[]), newVehicle.trim()] });
      setNewVehicle('');
    }
  };

  const removeVehicle = (veh: string) => {
    setSettings({ ...settings, vehicles: settings.vehicles.filter((v: string) => v !== veh) });
  };

  const updateCatalogItem = (cIdx: number, iIdx: number, field: string, value: any) => {
    const newCatalog = [...settings.catalog];
    newCatalog[cIdx].items[iIdx][field] = value;
    setSettings({ ...settings, catalog: newCatalog });
  };

  const updateCategoryName = (cIdx: number, value: string) => {
    const newCatalog = [...settings.catalog];
    newCatalog[cIdx].category = value;
    setSettings({ ...settings, catalog: newCatalog });
  };

  const removeCategory = (cIdx: number) => {
    const newCatalog = [...settings.catalog];
    newCatalog.splice(cIdx, 1);
    setSettings({ ...settings, catalog: newCatalog });
  };

  const addCatalogItem = (cIdx: number) => {
    const newCatalog = [...settings.catalog];
    newCatalog[cIdx].items.push({ name: 'Neue Leistung', price: 0, unit: 'Stk' });
    setSettings({ ...settings, catalog: newCatalog });
  };

  const removeCatalogItem = (cIdx: number, iIdx: number) => {
    const newCatalog = [...settings.catalog];
    newCatalog[cIdx].items.splice(iIdx, 1);
    setSettings({ ...settings, catalog: newCatalog });
  };

  const addCategory = () => {
    // Fügt die neue Kategorie GANZ OBEN in die Liste ein, damit man sie sofort sieht
    setSettings({ ...settings, catalog: [{ category: 'Neue Kategorie', items: [] }, ...settings.catalog] });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 md:space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-panel border border-structure p-4 rounded-xl shadow-lg">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-text-main flex items-center gap-2">
            <Cog6ToothIcon className="w-6 h-6 md:w-7 md:h-7 text-primary" /> Einstellungen
          </h1>
          <p className="text-xs md:text-sm text-text-muted mt-1">Verwalten Sie hier alle globalen Texte, Vorgaben und Kataloge.</p>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          {saveStatus === 'success' && <span className="text-green-400 text-sm font-semibold animate-in fade-in flex items-center gap-1"><CheckIcon className="w-4 h-4" /> Gespeichert</span>}
          {saveStatus === 'error' && <span className="text-red-400 text-sm font-semibold animate-in fade-in">Fehler beim Speichern</span>}
          <button onClick={saveSettings} disabled={isSaving} className={`btn-primary py-2 px-6 shadow-lg w-full md:w-auto ${saveStatus === 'success' ? 'bg-green-600 shadow-green-500/30' : 'shadow-primary/30'}`}>
            {isSaving ? 'Speichert...' : <><CheckIcon className="w-5 h-5 mr-1 inline" /> Speichern</>}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 shrink-0 flex flex-row md:flex-col overflow-x-auto md:overflow-visible gap-2 md:gap-0 md:space-y-1 pb-2 md:pb-0 custom-scrollbar">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-3 py-2 md:px-4 md:py-3 rounded-lg text-left text-sm md:text-base font-medium transition-colors ${activeTab === tab.id ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-muted hover:bg-bg-panel hover:text-text-main border border-transparent'}`}
            >
              <tab.icon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="whitespace-nowrap">{tab.name}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 panel min-h-[600px]">
          
          {/* TAB: Basisdaten */}
          {activeTab === 'basisdaten' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mb-4">Allgemeine Firmendaten</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Firmenname</label>
                  <input type="text" value={settings.companyName} onChange={e => handleChange('companyName', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Geschäftsführer</label>
                  <input type="text" value={settings.manager} onChange={e => handleChange('manager', e.target.value)} className="input-field w-full" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-text-muted mb-1">Straße & Hausnr.</label>
                  <input type="text" value={settings.street} onChange={e => handleChange('street', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">PLZ</label>
                  <input type="text" value={settings.zip} onChange={e => handleChange('zip', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Ort</label>
                  <input type="text" value={settings.city} onChange={e => handleChange('city', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Telefon</label>
                  <input type="text" value={settings.phone} onChange={e => handleChange('phone', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">E-Mail</label>
                  <input type="text" value={settings.email} onChange={e => handleChange('email', e.target.value)} className="input-field w-full" />
                </div>
              </div>

              <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mt-8 mb-4">Rechtliches & Bankverbindung</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Steuernummer</label>
                  <input type="text" value={settings.taxNumber || ''} onChange={e => handleChange('taxNumber', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">USt-IdNr.</label>
                  <input type="text" value={settings.taxId || ''} onChange={e => handleChange('taxId', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Handelsregister</label>
                  <input type="text" value={settings.register} onChange={e => handleChange('register', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Bankname</label>
                  <input type="text" value={settings.bankName} onChange={e => handleChange('bankName', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">IBAN</label>
                  <input type="text" value={settings.iban} onChange={e => handleChange('iban', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">BIC</label>
                  <input type="text" value={settings.bic} onChange={e => handleChange('bic', e.target.value)} className="input-field w-full" />
                </div>
              </div>
            </div>
          )}

          {/* TAB: Ressourcen (Team & Zugänge) */}
          {activeTab === 'ressourcen' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              
              {/* Neuer TeamAccessManager inkl. Firebase Auth */}
              <div className="panel border-t-4 border-t-structure">
                <TeamAccessManager />
              </div>

              {/* Aktivitäts-Logbuch */}
              <div className="panel border-t-4 border-t-structure">
                <ActivityLogViewer />
              </div>

              {/* Fuhrpark */}
              <div className="panel border-t-4 border-t-structure">
                <h2 className="text-xl font-bold mb-4 text-text-main">Dein Fuhrpark (Fahrzeuge)</h2>
                <p className="text-sm text-text-muted mb-4">Erfasse hier deine Fahrzeuge (z.B. "Sixt Sprinter" oder "Eigener 7,5t"). Diese werden im Planer zugewiesen.</p>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newVehicle} onChange={e => setNewVehicle(e.target.value)} placeholder="Fahrzeugname / Kennzeichen..." className="input-field flex-1" onKeyDown={(e) => e.key === 'Enter' && addVehicle()} />
                  <button onClick={addVehicle} className="btn-primary py-2 px-4 whitespace-nowrap">Hinzufügen</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(settings.vehicles || []).map((veh: string) => (
                    <div key={veh} className="bg-bg-dark border border-structure rounded-full px-3 py-1 flex items-center gap-2">
                      <span className="text-sm">{veh}</span>
                      <button onClick={() => removeVehicle(veh)} className="text-red-400 hover:text-red-300">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: CRM & Kontakte */}
          {activeTab === 'ansprechpartner' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              
              {/* Ansprechpartner */}
              <div>
                <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mb-4">Ansprechpartner verwalten</h2>
                <p className="text-sm text-text-muted mb-4">Diese Namen erscheinen in der Auswahl für Angebote (Dein Team).</p>
                
                <div className="flex gap-2 mb-6">
                  <input 
                    type="text" 
                    value={newContact} 
                    onChange={e => setNewContact(e.target.value)} 
                    placeholder="Name eingeben (z.B. Max Mustermann)" 
                    className="input-field flex-1"
                    onKeyDown={e => e.key === 'Enter' && addContact()}
                  />
                  <button onClick={addContact} className="btn-secondary">Hinzufügen</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {settings.contacts.map((contact: string, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-bg-dark border border-structure rounded-lg">
                      <span className="text-text-main font-medium">{contact}</span>
                      <button onClick={() => removeContact(contact)} className="text-red-400 hover:bg-red-400/10 p-1 rounded transition-colors">&times;</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kundenquellen */}
              <div className="pt-8">
                <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mb-4">Kundenquellen (Marketing)</h2>
                <p className="text-sm text-text-muted mb-4">Woher kommen Ihre Kunden? (Check24, Google, Empfehlung etc.)</p>
                
                <div className="flex gap-2 mb-6">
                  <input 
                    type="text" 
                    value={newSource} 
                    onChange={e => setNewSource(e.target.value)} 
                    placeholder="Neue Quelle eingeben (z.B. Facebook)" 
                    className="input-field flex-1"
                    onKeyDown={e => e.key === 'Enter' && addSource()}
                  />
                  <button onClick={addSource} className="btn-secondary">Hinzufügen</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {settings.customerSources?.map((source: string, idx: number) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-bg-dark border border-structure rounded-lg">
                      <span className="text-text-main font-medium">{source}</span>
                      <button onClick={() => removeSource(source)} className="text-red-400 hover:bg-red-400/10 p-1 rounded transition-colors">&times;</button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB: Immobilienarten */}
          {activeTab === 'immobilien' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mb-4">Immobilienarten</h2>
              <p className="text-sm text-text-muted mb-4">Verwalten Sie die Liste der Immobilienarten für Be- und Entladestellen.</p>
              
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  value={newPropertyType} 
                  onChange={e => setNewPropertyType(e.target.value)} 
                  placeholder="Neue Immobilienart hinzufügen..." 
                  className="input-field flex-1"
                  onKeyDown={e => e.key === 'Enter' && addPropertyType()}
                />
                <button onClick={addPropertyType} className="btn-secondary">Hinzufügen</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {settings.propertyTypes.map((pt: string, idx: number) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-bg-dark border border-structure rounded-lg">
                    <span className="text-text-main font-medium">{pt}</span>
                    <button onClick={() => removePropertyType(pt)} className="text-red-400 hover:bg-red-400/10 p-1 rounded transition-colors">&times;</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Texte & AGB */}
          {activeTab === 'texte' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mb-4">Textbausteine & AGB</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-primary mb-3">Angebote</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Einleitungstext</label>
                      <textarea value={settings.texts.quoteIntro} onChange={e => handleChange('quoteIntro', e.target.value, 'texts')} className="input-field w-full h-24" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Schlusstext / Hinweise</label>
                      <textarea value={settings.texts.quoteOutro} onChange={e => handleChange('quoteOutro', e.target.value, 'texts')} className="input-field w-full h-24" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Abschluss-Gruß</label>
                      <textarea value={settings.texts.quoteGreeting} onChange={e => handleChange('quoteGreeting', e.target.value, 'texts')} className="input-field w-full h-32" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Versicherungsschutz (Immer am Ende)</label>
                      <textarea value={settings.texts.insurance} onChange={e => handleChange('insurance', e.target.value, 'texts')} className="input-field w-full h-32" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-primary mb-3 mt-8">Auftragsbestätigungen</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Einleitungstext</label>
                      <textarea value={settings.texts.orderIntro} onChange={e => handleChange('orderIntro', e.target.value, 'texts')} className="input-field w-full h-16" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Schlusstext / Hinweise</label>
                      <textarea value={settings.texts.orderOutro} onChange={e => handleChange('orderOutro', e.target.value, 'texts')} className="input-field w-full h-16" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Abschluss-Gruß</label>
                      <textarea value={settings.texts.orderGreeting} onChange={e => handleChange('orderGreeting', e.target.value, 'texts')} className="input-field w-full h-24" />
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-primary mb-3 mt-8">Rechnungen</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Einleitungstext</label>
                      <textarea value={settings.texts.invoiceIntro} onChange={e => handleChange('invoiceIntro', e.target.value, 'texts')} className="input-field w-full h-16" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Schlusstext / Hinweise</label>
                      <textarea value={settings.texts.invoiceOutro} onChange={e => handleChange('invoiceOutro', e.target.value, 'texts')} className="input-field w-full h-16" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-muted mb-1">Abschluss-Gruß</label>
                      <textarea value={settings.texts.invoiceGreeting} onChange={e => handleChange('invoiceGreeting', e.target.value, 'texts')} className="input-field w-full h-24" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-primary mb-3">Allgemeine Bedingungen (AGB)</h3>
                  <div>
                    <textarea value={settings.texts.agb} onChange={e => handleChange('agb', e.target.value, 'texts')} className="input-field w-full h-96 text-xs font-mono" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Vorlagen (Smarte Kommunikation) */}
          {activeTab === 'vorlagen' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mb-4">Smarte Nachrichten-Vorlagen</h2>
              <div className="flex flex-col gap-4 mb-6">
                <p className="text-sm text-text-muted">Hier pflegst du die Vorlagen für das Kommunikations-Center in der Kundenakte. Nutze die folgenden Platzhalter, die beim Senden automatisch durch echte Daten ersetzt werden:</p>
                <div className="flex flex-wrap gap-2">
                  {['{{Kunde_Anrede}}', '{{Kunde_Name}}', '{{Kunde_Nachname}}', '{{Umzugsdatum}}', '{{Angebot_Summe}}', '{{Sachbearbeiter}}'].map(variable => (
                    <span key={variable} className="text-xs bg-structure/50 border border-structure text-text-main px-2 py-1 rounded cursor-default select-all hover:bg-structure transition-colors">
                      {variable}
                    </span>
                  ))}
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      const newId = `t${Date.now()}`;
                      const newTpl = { id: newId, name: 'Neue Vorlage', subject: '', body: '' };
                      handleChange('communicationTemplates', [...(settings.communicationTemplates || []), newTpl]);
                    }}
                    className="btn-primary py-2 px-4"
                  >
                    + Neue Vorlage erstellen
                  </button>
                  <button 
                    onClick={() => {
                      if(confirm('Möchtest du die Standard-Vorlagen laden? Bereits vorhandene Standard-Vorlagen werden nicht doppelt hinzugefügt.')) {
                        const defaults = [
                          {
                            id: 't1_default',
                            name: 'Erstkontakt (Bilder oder Liste erhalten)',
                            subject: 'Angebot für Ihren Umzug',
                            body: '{{Kunde_Anrede}},\n\nvielen Dank für Ihr Interesse an unserem Service und für die Übersendung der Bilder.\n\nGerne erstellen wir Ihnen ein individuelles Angebot mit Festpreis und lassen Ihnen dieses zeitnah zukommen.\n\nSollten Sie vorab noch weitere Fragen haben, stehen wir Ihnen selbstverständlich jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge\n\nKontaktdaten: Telefon: +49 1590 6603011 E-Mail: info@rothirsch-umzug.de Webseite: www.rothirsch-umzug.de'
                          },
                          {
                            id: 't2_default',
                            name: 'Erstkontakt (Keine Bilder oder Liste)',
                            subject: 'Ihre Umzugsanfrage',
                            body: '{{Kunde_Anrede}},\n\nvielen Dank für Ihr Interesse an unserem Service. Gerne erstellen wir für Sie ein Angebot mit einem festen Preis. Teilen Sie uns bitte Bilder oder eine Liste mit den gewünschten Leistungen mit. Sie können uns auch gerne Ihre Telefonnummer mitteilen oder uns jederzeit anrufen, um Ihren Umzug zu besprechen.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge\n\nKontaktdaten: Telefon: +49 1590 6603011 E-Mail: info@rothirsch-umzug.de Webseite: www.rothirsch-umzug.de'
                          },
                          {
                            id: 't3_default',
                            name: 'Angebot schicken',
                            subject: 'Ihr Umzugsangebot',
                            body: '{{Kunde_Anrede}},\n\nanbei sende ich Ihnen unser Angebot für Ihren bevorstehenden Umzug. Bitte überprüfen Sie die angehängte Datei für die detaillierten Informationen und Konditionen. Das Angebot wurde gemäß Ihren Anforderungen erstellt und beinhaltet alle gewünschten Leistungen.\n\nBei Rothirsch Umzüge legen wir großen Wert auf den Schutz Ihrer Möbel. Daher werden wir alle Möbelstücke sorgfältig mit Umzugsdecken und hochwertigen Schutzmaterialien schützen, um sicherzustellen, dass sie während des Transports optimal geschützt sind.\n\nIch möchte klarstellen, dass es sich bei unserem Angebot in Höhe von {{Angebot_Summe}} um einen Festpreis handelt. Das bedeutet, dass die vereinbarte Summe die endgültigen Kosten für Ihren Umzug abdeckt. Sie können darauf vertrauen, dass es keine unerwarteten zusätzlichen Gebühren gibt.\n\nWenn Sie mit dem Angebot zufrieden sind, bitten wir Sie um eine schriftliche Bestätigung, damit wir den Umzug entsprechend planen können. Bitte beachten Sie, dass die Termine vorbehaltlich der Verfügbarkeit sind und wir eine rechtzeitige Bestätigung benötigen, um Ihren Umzugstermin am {{Umzugsdatum}} zu sichern.\n\nSollten Sie weitere Fragen haben oder Anpassungen am Angebot wünschen, stehe ich Ihnen gerne zur Verfügung. Sie können mich telefonisch oder per E-Mail kontaktieren.\n\nVielen Dank für Ihr Interesse an unseren Umzugsservices. Wir freuen uns darauf, Ihnen bei Ihrem Umzug behilflich zu sein.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
                          },
                          {
                            id: 't4_default',
                            name: 'Nachfrage zu Ihrem Umzugsangebot',
                            subject: 'Nachfrage zu Ihrem Umzugsangebot',
                            body: '{{Kunde_Anrede}},\n\nich wollte mich erkundigen, ob Sie bereits eine Entscheidung zu unserem Angebot getroffen haben. Der gewünschte Termin ({{Umzugsdatum}}) ist aktuell noch verfügbar – allerdings erhalten wir viele Anfragen, sodass eine zeitnahe Rückmeldung wichtig für die Reservierung ist.\n\nSollten noch Fragen offen sein oder Sie Anpassungen wünschen, können wir das gerne telefonisch besprechen. Uns ist wichtig, dass der Ablauf für Sie so reibungslos und angenehm wie möglich verläuft.\n\nGeben Sie uns einfach kurz Bescheid.\n\nVielen Dank im Voraus – wir würden uns freuen, Sie bei Ihrem Umzug unterstützen zu dürfen!\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
                          },
                          {
                            id: 't5_default',
                            name: 'Rechnung schicken',
                            subject: 'Ihre Rechnung zum Umzug',
                            body: '{{Kunde_Anrede}},\n\nvielen Dank nochmals für Ihren Auftrag und das entgegengebrachte Vertrauen!\n\nAnbei erhalten Sie die Rechnung zu Ihrem Umzug am {{Umzugsdatum}} über den Betrag von {{Angebot_Summe}}.\n\nWir hoffen, Sie sind in Ihrem neuen Zuhause gut angekommen und waren mit unserem Service rundum zufrieden. \n\nSollten Sie Rückfragen zur Rechnung haben, können Sie sich jederzeit gerne an uns wenden.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
                          }
                        ];
                        
                        const currentTemplates = settings.communicationTemplates || [];
                        const newTemplates = [...currentTemplates];
                        
                        defaults.forEach(defTpl => {
                          // Falls es schon eine Vorlage mit dieser ID gibt, einen neuen Timestamp anfügen, 
                          // damit die ID immer unique ist. Oder besser: Nur hinzufügen, wenn sie noch nicht existiert.
                          if (!currentTemplates.some((t: any) => t.id === defTpl.id)) {
                            newTemplates.push(defTpl);
                          } else {
                            // Wenn sie schon existiert (weil der User sie vielleicht behalten will), 
                            // fügen wir sie trotzdem nochmal hinzu aber mit neuer ID, falls der User das wollte.
                            // Noch besser: Wir fügen sie mit unique ID hinzu.
                            newTemplates.push({
                              ...defTpl,
                              id: `${defTpl.id}_${Date.now()}`
                            });
                          }
                        });
                        
                        handleChange('communicationTemplates', newTemplates);
                      }
                    }}
                    className="btn-secondary py-2 px-4"
                  >
                    Standard-Vorlagen laden
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(settings.communicationTemplates || []).map((tpl: any, idx: number) => (
                  <div key={`${tpl.id || 'tpl'}-${idx}`} className="panel border-t-4 border-t-primary shadow-lg flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-bold text-text-main flex-1">{tpl.name}</h3>
                      <button 
                        onClick={() => {
                          if (confirm('Vorlage wirklich löschen?')) {
                            const newTemplates = settings.communicationTemplates.filter((t: any) => t.id !== tpl.id);
                            handleChange('communicationTemplates', newTemplates);
                          }
                        }}
                        className="text-red-400 hover:text-red-300 ml-2"
                        title="Löschen"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Vorlagen-Name (intern)</label>
                        <input 
                          type="text" 
                          value={tpl.name} 
                          onChange={e => {
                            const newTemplates = [...settings.communicationTemplates];
                            newTemplates[idx].name = e.target.value;
                            handleChange('communicationTemplates', newTemplates);
                          }} 
                          className="input-field w-full text-sm" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Betreff (Für E-Mail)</label>
                        <input 
                          type="text" 
                          value={tpl.subject} 
                          onChange={e => {
                            const newTemplates = [...settings.communicationTemplates];
                            newTemplates[idx].subject = e.target.value;
                            handleChange('communicationTemplates', newTemplates);
                          }} 
                          className="input-field w-full text-sm" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Nachrichtentext (WhatsApp & E-Mail)</label>
                        <textarea 
                          value={tpl.body} 
                          onChange={e => {
                            const newTemplates = [...settings.communicationTemplates];
                            newTemplates[idx].body = e.target.value;
                            handleChange('communicationTemplates', newTemplates);
                          }} 
                          className="input-field w-full h-48 text-xs font-mono whitespace-pre-wrap" 
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Protokolle */}
          {activeTab === 'protokolle' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="panel border-t-4 border-t-structure">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-text-main">Protokoll-Kategorien & Standardtexte</h2>
                    <button onClick={loadSampleProtocolCategories} className="text-xs btn-secondary py-1 px-3">Standard-Texte laden</button>
                  </div>
                  <p className="text-sm text-text-muted mb-6">Verwalte hier die Standard-Situationen für deine Protokolle (z.B. "Gefahrenübergang" oder "Schadensprotokoll") und den jeweils zugehörigen Standardtext.</p>
                  
                  {/* Neue Kategorie hinzufügen */}
                  <div className="bg-bg-dark border border-structure rounded-xl p-4 mb-6">
                    <h3 className="font-semibold text-sm mb-3">Neue Kategorie hinzufügen</h3>
                    <div className="space-y-3">
                      <input 
                        type="text" 
                        value={newProtocolCategoryName} 
                        onChange={e => setNewProtocolCategoryName(e.target.value)} 
                        placeholder="Name der Kategorie (z.B. Gefahrenübergang)" 
                        className="input-field w-full" 
                      />
                      <textarea
                        value={newProtocolCategoryText}
                        onChange={e => setNewProtocolCategoryText(e.target.value)}
                        placeholder="Hier den Standard-Text eingeben..."
                        className="input-field w-full h-24"
                      />
                      <div className="flex justify-end">
                        <button onClick={addProtocolCategory} className="btn-primary py-2 px-6">Hinzufügen</button>
                      </div>
                    </div>
                  </div>

                  {/* Bestehende Kategorien */}
                  <div className="space-y-4">
                    {(settings.protocolCategories || []).map((cat: any) => (
                      <div key={cat.id} className="bg-bg-dark border border-structure rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-4">
                          <input 
                            type="text" 
                            value={cat.name}
                            onChange={(e) => updateProtocolCategory(cat.id, 'name', e.target.value)}
                            className="input-field font-semibold bg-transparent border-none px-0 py-1 focus:bg-bg-panel focus:px-3 focus:border-structure w-full"
                          />
                          <button onClick={() => removeProtocolCategory(cat.id)} className="text-red-400 hover:text-red-300 text-sm font-medium whitespace-nowrap px-2 py-1">Löschen</button>
                        </div>
                        <textarea
                          value={cat.text}
                          onChange={(e) => updateProtocolCategory(cat.id, 'text', e.target.value)}
                          className="input-field w-full h-32 text-sm text-text-muted bg-bg-panel/50 focus:bg-bg-panel"
                          placeholder="Standard-Text..."
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vorlagen für Beschreibungen (Schnell-Auswahl) */}
                <div className="panel border-t-4 border-t-structure">
                  <h2 className="text-xl font-bold mb-4 text-text-main">Schnell-Sätze (Vorlagen)</h2>
                  <p className="text-sm text-text-muted mb-4">Hier verwaltest du Textbausteine, die du beim Kunden mit nur einem Klick zur aktuellen Beschreibung hinzufügen kannst (z.B. spezielle Kratzer oder Ausnahmen).</p>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={newProtocolTemplate} onChange={e => setNewProtocolTemplate(e.target.value)} placeholder="Neuer Standard-Satz..." className="input-field flex-1" onKeyDown={(e) => e.key === 'Enter' && addProtocolTemplate()} />
                    <button onClick={addProtocolTemplate} className="btn-primary py-2 px-4 whitespace-nowrap">Hinzufügen</button>
                  </div>
                  <div className="space-y-2">
                    {(settings.protocolTemplates || []).map((pt: string) => (
                      <div key={pt} className="bg-bg-dark border border-structure rounded-lg px-4 py-3 flex items-center justify-between">
                        <span className="text-sm">{pt}</span>
                        <button onClick={() => removeProtocolTemplate(pt)} className="text-red-400 hover:text-red-300 text-xl leading-none">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
          )}

          {/* TAB: Integration (Kalender & APIs) */}
          {activeTab === 'integration' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mb-4">Kalender-Integration (Echtzeit-Sync)</h2>
              <p className="text-sm text-text-muted mb-6">
                Verknüpfe hier dein Microsoft Outlook oder Google Calendar Konto. Sobald ein Termin (Besichtigung/Umzug) in der App gespeichert wird, taucht er automatisch in Echtzeit in deinem Kalender auf.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Outlook Box */}
                <div className="bg-bg-dark border border-structure p-6 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <CalendarIcon className="w-24 h-24 text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold text-text-main mb-2">Microsoft Outlook</h3>
                  <p className="text-sm text-text-muted mb-6 relative z-10">
                    Synchronisiert Termine direkt über die Microsoft Graph API in dein Outlook-Konto (Office 365 oder privat).
                  </p>
                  
                  <div className="space-y-4 relative z-10">
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase mb-1">Azure Client-ID</label>
                      <input type="text" placeholder="z.B. 8a2c...-..." className="input-field w-full bg-bg-panel" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase mb-1">Azure Client-Secret</label>
                      <input type="password" placeholder="Dein geheimer Schlüssel" className="input-field w-full bg-bg-panel" />
                    </div>
                    <button className="btn-secondary w-full flex items-center justify-center gap-2 border-blue-500/50 text-blue-400 hover:bg-blue-500/10">
                      <LinkIcon className="w-5 h-5" /> Mit Outlook verknüpfen
                    </button>
                  </div>

                  <div className="mt-6 pt-4 border-t border-structure relative z-10">
                    <details className="text-sm">
                      <summary className="text-primary font-medium cursor-pointer hover:underline">Einrichtungshilfe (Azure)</summary>
                      <ul className="list-disc list-inside mt-2 text-text-muted space-y-1 text-xs">
                        <li>Gehe ins <a href="https://portal.azure.com" target="_blank" className="text-blue-400 hover:underline">Azure Portal</a> (App Registrations)</li>
                        <li>Erstelle eine "Neue Registrierung"</li>
                        <li>Wähle "Beliebige Kontotypen (inkl. privat)"</li>
                        <li>Umleitungs-URI (Web): <code>http://localhost:3000/api/calendar/auth/microsoft/callback</code></li>
                        <li>Füge unter "API-Berechtigungen" <code>Calendars.ReadWrite</code> und <code>offline_access</code> (Microsoft Graph) hinzu.</li>
                        <li>Generiere ein Client-Secret unter "Zertifikate & Geheimnisse".</li>
                      </ul>
                    </details>
                  </div>
                </div>

                {/* Google Box */}
                <div className="bg-bg-dark border border-structure p-6 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <CalendarIcon className="w-24 h-24 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-text-main mb-2">Google Calendar</h3>
                  <p className="text-sm text-text-muted mb-6 relative z-10">
                    Synchronisiert Termine direkt über die Google Calendar API in dein Google Workspace oder privates Google Konto.
                  </p>
                  
                  <div className="space-y-4 relative z-10">
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase mb-1">Google Client-ID</label>
                      <input type="text" placeholder="z.B. 123...apps.googleusercontent.com" className="input-field w-full bg-bg-panel" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase mb-1">Google Client-Secret</label>
                      <input type="password" placeholder="Dein geheimer Schlüssel" className="input-field w-full bg-bg-panel" />
                    </div>
                    <button className="btn-secondary w-full flex items-center justify-center gap-2 border-red-500/50 text-red-400 hover:bg-red-500/10">
                      <LinkIcon className="w-5 h-5" /> Mit Google verknüpfen
                    </button>
                  </div>

                  <div className="mt-6 pt-4 border-t border-structure relative z-10">
                    <details className="text-sm">
                      <summary className="text-primary font-medium cursor-pointer hover:underline">Einrichtungshilfe (Google)</summary>
                      <ul className="list-disc list-inside mt-2 text-text-muted space-y-1 text-xs">
                        <li>Gehe in die <a href="https://console.cloud.google.com" target="_blank" className="text-blue-400 hover:underline">Google Cloud Console</a></li>
                        <li>Aktiviere die "Google Calendar API"</li>
                        <li>Richte den "OAuth-Zustimmungsbildschirm" (Extern) ein</li>
                        <li>Erstelle unter "Anmeldedaten" eine OAuth-Client-ID (Webanwendung)</li>
                        <li>Autorisierte Weiterleitungs-URIs: <code>http://localhost:3000/api/calendar/auth/google/callback</code></li>
                      </ul>
                    </details>
                  </div>
                </div>

              </div>

              {/* E-Mail / SMTP Box */}
              <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mb-4 mt-8">E-Mail Versand (SMTP)</h2>
              <p className="text-sm text-text-muted mb-6">
                Damit die App in deinem Namen E-Mails (z.B. Angebote, Rechnungen) direkt an Kunden senden kann, benötigt sie Zugang zu deinem Postausgangsserver (z.B. Ionos).
              </p>

              <div className="bg-bg-dark border border-structure p-6 rounded-xl relative overflow-hidden group max-w-3xl">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <EnvelopeIcon className="w-24 h-24 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-text-main mb-6 relative z-10">Ionos / Webmail Zugangsdaten</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">Absender Name</label>
                    <input type="text" value={settings.companyName || ''} onChange={e => handleChange('companyName', e.target.value)} placeholder="z.B. Rothirsch Umzüge" className="input-field w-full bg-bg-panel" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">SMTP Server (Host)</label>
                    <input type="text" value={settings.smtpHost || 'smtp.ionos.de'} onChange={e => handleChange('smtpHost', e.target.value)} placeholder="z.B. smtp.ionos.de" className="input-field w-full bg-bg-panel" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">SMTP Port</label>
                    <input type="number" value={settings.smtpPort || 465} onChange={e => handleChange('smtpPort', Number(e.target.value))} placeholder="465" className="input-field w-full bg-bg-panel" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">E-Mail Adresse (Benutzername)</label>
                    <input type="email" value={settings.smtpUser || ''} onChange={e => handleChange('smtpUser', e.target.value)} placeholder="info@rothirsch-umzug.de" className="input-field w-full bg-bg-panel" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">E-Mail Passwort</label>
                    <input type="password" value={settings.smtpPass || ''} onChange={e => handleChange('smtpPass', e.target.value)} placeholder="Dein E-Mail Passwort" className="input-field w-full bg-bg-panel" />
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-4 relative z-10 italic">
                  Hinweis: Das Passwort wird verschlüsselt gespeichert. Bei Ionos ist der Standard-Port für SSL 465.
                </p>
              </div>

            </div>
          )}

          {/* TAB: System */}
          {activeTab === 'system' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mb-4">System & Finanzen</h2>
              <p className="text-sm text-text-muted mb-4">Globale Parameter für Berechnungen, Steuern und Nummernkreise.</p>
              
              {!isSystemUnlocked ? (
                <div className="bg-bg-dark border border-red-500/30 p-8 rounded-xl max-w-md mx-auto mt-12 text-center shadow-lg shadow-red-500/10">
                  <ServerStackIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-text-main mb-2">Geschützter Bereich</h3>
                  <p className="text-sm text-text-muted mb-6">Bitte gib deinen 4-stelligen Admin-PIN ein, um Steuersätze und Nummernkreise zu bearbeiten.</p>
                  <div className="flex gap-2 justify-center">
                    <input 
                      type="password" 
                      value={pinInput}
                      onChange={e => setPinInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && pinInput === '7770') setIsSystemUnlocked(true);
                      }}
                      className="input-field text-center w-32 tracking-widest font-mono text-xl" 
                      maxLength={4} 
                      placeholder="****"
                      autoFocus
                    />
                    <button 
                      onClick={() => {
                        if (pinInput === '7770') setIsSystemUnlocked(true);
                        else alert('Falsche PIN!');
                      }} 
                      className="btn-primary"
                    >
                      Entsperren
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                      <label className="block text-sm font-medium text-text-main mb-1">Standard Steuersatz (%)</label>
                      <input type="number" value={settings.taxRate} onChange={e => handleChange('taxRate', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                    </div>
                    <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                      <label className="block text-sm font-medium text-text-main mb-1">Mahngebühr pro Stufe (€)</label>
                      <input type="number" value={settings.dunningFee} onChange={e => handleChange('dunningFee', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                    </div>
                    <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                      <label className="block text-sm font-medium text-text-main mb-1">Angebotsgültigkeit (Tage)</label>
                      <p className="text-xs text-text-muted mb-2">Angebote sind standardmäßig so viele Tage gültig.</p>
                      <input type="number" value={settings.quoteValidDays} onChange={e => handleChange('quoteValidDays', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                    </div>
                    <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                      <label className="block text-sm font-medium text-text-main mb-1">Nächste Angebotsnummer (Start)</label>
                      <p className="text-xs text-text-muted mb-2">Das nächste Angebot beginnt mit dieser Nummer.</p>
                      <input type="number" value={settings.nextQuoteNumber} onChange={e => handleChange('nextQuoteNumber', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                    </div>
                    <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                      <label className="block text-sm font-medium text-text-main mb-1">Nächste Auftragsnummer (Start)</label>
                      <p className="text-xs text-text-muted mb-2">Der nächste bestätigte Auftrag beginnt mit dieser Nummer.</p>
                      <input type="number" value={settings.nextOrderNumber || 1} onChange={e => handleChange('nextOrderNumber', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                    </div>
                    <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                      <label className="block text-sm font-medium text-text-main mb-1">Nächste Rechnungsnummer (Start)</label>
                      <p className="text-xs text-text-muted mb-2">Die nächste Rechnung beginnt mit dieser Nummer.</p>
                      <input type="number" value={settings.nextInvoiceNumber} onChange={e => handleChange('nextInvoiceNumber', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                    </div>
                  </div>

                  {/* DEVELOPER BEREICH */}
                  {profile?.role === 'admin' && (
                    <div className="mt-12 border-t border-red-500/20 pt-8">
                      <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                        <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
                          <ExclamationTriangleIcon className="w-5 h-5" />
                          ⚠️ Entwickler-Bereich
                        </h3>
                        <p className="text-sm text-text-muted mb-6 max-w-2xl">
                          Löscht unwiderruflich alle Kunden, Aufträge und Rechnungen. Nur für die Testphase. Nummernkreise werden auf 1 zurückgesetzt.
                        </p>
                        <button 
                          onClick={() => setShowResetModal(true)}
                          className="btn-primary bg-red-600 hover:bg-red-700 text-white border-none"
                        >
                          Datenbank komplett zurücksetzen
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* TAB: Leistungen & Zahlungen */}
          {activeTab === 'leistungen' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-text-main border-b border-structure pb-2 mb-4">Leistungskatalog & Zahlungsarten</h2>
              
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-primary">Leistungskatalog</h3>
                  <button onClick={addCategory} className="text-xs btn-secondary py-1 px-3">Neue Kategorie</button>
                </div>
                <div className="space-y-6">
                  {settings.catalog.map((cat: any, cIdx: number) => (
                    <div key={cIdx} className="bg-bg-dark border border-structure p-4 rounded-xl">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-structure pb-2 mb-3 gap-2">
                        <div className="flex-1 w-full sm:w-auto flex items-center gap-2">
                          <span className="text-text-muted text-sm font-bold">Kategorie:</span>
                          <input type="text" value={cat.category} onChange={e => updateCategoryName(cIdx, e.target.value)} className="bg-transparent border-none text-text-main text-lg font-bold focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 w-full sm:w-auto" />
                        </div>
                        <div className="flex items-center gap-4">
                          <button onClick={() => addCatalogItem(cIdx)} className="text-primary hover:underline text-xs">+ Element hinzufügen</button>
                          <button onClick={() => removeCategory(cIdx)} className="text-red-400 hover:text-red-300 text-xs hover:underline">Kategorie löschen</button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {cat.items.map((item: any, iIdx: number) => (
                          <div key={iIdx} className="flex flex-col md:flex-row justify-between items-start md:items-center bg-bg-panel p-2 rounded border border-structure/50 gap-2">
                            <input type="text" value={item.name} onChange={e => updateCatalogItem(cIdx, iIdx, 'name', e.target.value)} className="input-field text-sm flex-1 w-full" placeholder="Bezeichnung" />
                            <div className="flex items-center gap-2 w-full md:w-auto">
                              <input type="number" value={item.price} onChange={e => updateCatalogItem(cIdx, iIdx, 'price', parseFloat(e.target.value)||0)} className="input-field text-sm w-24 text-right" placeholder="Preis €" />
                              <span className="text-text-muted text-sm">€</span>
                              <input type="text" value={item.unit} onChange={e => updateCatalogItem(cIdx, iIdx, 'unit', e.target.value)} className="input-field text-sm w-20 text-center" placeholder="Einheit" />
                              <button onClick={() => removeCatalogItem(cIdx, iIdx)} className="text-red-400 hover:bg-red-400/20 p-2 rounded transition-colors">&times;</button>
                            </div>
                          </div>
                        ))}
                        {cat.items.length === 0 && <p className="text-xs text-text-muted italic py-2">Keine Leistungen in dieser Kategorie.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="space-y-6 mt-8">
                <h3 className="text-lg font-semibold text-primary border-t border-structure pt-6">Zahlungsarten</h3>
                {settings.paymentMethods.map((pm: any, idx: number) => (
                  <div key={idx} className="bg-bg-dark border border-structure p-4 rounded-xl space-y-3">
                    <div className="font-bold text-text-main text-lg">{pm.name}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Text für Angebot</label>
                        <textarea value={pm.textQuote} readOnly className="input-field w-full h-20 text-xs bg-bg-panel opacity-80" />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Text für Rechnung</label>
                        <textarea value={pm.textInvoice} readOnly className="input-field w-full h-20 text-xs bg-bg-panel opacity-80" />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Zahlungsziel (Kurztext)</label>
                        <input type="text" value={pm.shortText} readOnly className="input-field text-sm bg-bg-panel opacity-80" />
                      </div>
                      <div>
                        <label className="block text-xs text-text-muted mb-1">Tage bis Fälligkeit</label>
                        <input type="number" value={pm.dueDays} readOnly className="input-field text-sm bg-bg-panel opacity-80" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
      {/* Modals */}
      {showResetModal && <ResetDatabaseModal onClose={() => setShowResetModal(false)} />}
    </div>
  );
}
