"use client";
import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Cog6ToothIcon, BuildingOfficeIcon, UsersIcon, CurrencyEuroIcon, DocumentTextIcon, CheckIcon, ServerStackIcon } from '@heroicons/react/24/outline';

const TABS = [
  { id: 'basisdaten', name: 'Basisdaten', icon: BuildingOfficeIcon },
  { id: 'ansprechpartner', name: 'CRM & Kontakte', icon: UsersIcon },
  { id: 'immobilien', name: 'Immobilienarten', icon: BuildingOfficeIcon },
  { id: 'leistungen', name: 'Leistungen & Zahlungen', icon: CurrencyEuroIcon },
  { id: 'texte', name: 'Textbausteine & AGB', icon: DocumentTextIcon },
  { id: 'protokolle', name: 'Protokolle & Vorlagen', icon: DocumentTextIcon },
  { id: 'system', name: 'System & Finanzen', icon: ServerStackIcon },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('basisdaten');
  const [settings, setSettings] = useState<any>({
    companyName: 'Dein Unternehmen',
    street: 'Musterstraße 1',
    zip: '12345',
    city: 'Musterstadt',
    phone: '0123 456789',
    email: 'info@dein-unternehmen.de',
    website: 'www.dein-unternehmen.de',
    manager: 'Max Mustermann',
    taxId: 'DE1111111111',
    register: 'Musterstraße 1',
    bankName: 'Musterbank',
    iban: 'DE11 0000 0000 0000 0000 00',
    bic: 'MUSTERBIC',
    contacts: ['Berater 1', 'Berater 2'],
    customerSources: ['Google Suche', 'Check24', 'Empfehlung', 'Eigene Website', 'Kleinanzeigen', 'Direkter Anruf'],
    propertyTypes: ['Haus', 'Wohnung', 'Einfamilienhaus', 'Reihenhaus', 'Büro / Gewerbe', 'Lager / Garage', 'Sonstiges'],
    taxRate: 19,
    dunningFee: 5,
    nextQuoteNumber: 34,
    nextInvoiceNumber: 2,
    quoteValidDays: 14,
    texts: {
      quoteIntro: 'Sehr geehrte Damen und Herren,\nvielen Dank für Ihre Anfrage. Wir freuen uns, Ihnen folgendes Angebot unterbreiten zu dürfen:',
      quoteOutro: 'Alle angegebenen Preise verstehen sich als Bruttopreise und beinhalten die gesetzliche Mehrwertsteuer.\nWir danken Ihnen herzlich für Ihr Vertrauen und die angenehme Zusammenarbeit.',
      quoteGreeting: '„Bei Fragen zögern Sie bitte nicht, uns zu kontaktieren. Wir sind jederzeit für Sie erreichbar.“\n\nMit freundlichen Grüßen\nDein Unternehmen',
      insurance: 'Mit unserer Versicherung ist Ihr Umzugsgut abgesichert. Für diesen Transport deckt unser Unternehmen eine Transportgüterversicherung ein, ohne dass hierfür zusätzliche Kosten entstehen. Bei der Übernahme Ihres Umzugsgutes gilt eine gesetzliche Haftung gem. Paragraph 451g HGB - beschränkt auf einen Zeitwert von €620,00 / cbm.',
      invoiceIntro: 'Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen für unsere erbrachten Leistungen:',
      invoiceOutro: 'Bitte überweisen Sie den Rechnungsbetrag innerhalb von 5 Tagen ohne Abzug auf unser Konto.',
      invoiceGreeting: 'Für etwaige Fragen stehen wir Ihnen selbstverständlich jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\nDein Unternehmen',
      googleReview: 'Wir hoffen, dass alles zu Ihrer Zufriedenheit war, und würden uns über eine positive Bewertung auf Google freuen.',
      dunningIntro: 'Leider konnten wir bis zum heutigen Tag keinen Zahlungseingang für die unten aufgeführte Rechnung feststellen. Sicherlich ist dies nur ein Versehen Ihrerseits.\n\nWir bitten Sie daher, den ausstehenden Betrag innerhalb der nächsten 5 Tage auf unser unten genanntes Konto zu überweisen.',
      agb: 'Allgemeine Geschäftsbedingungen (AGB) – Dein Unternehmen\n\n§1 Geltungsbereich\nDiese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen uns und dem Kunden...'
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
    protocolTypes: ['Gefahrenübergang (Haftungsausschluss)', 'Keine Schäden (Abschluss)', 'Schadensprotokoll', 'Sonstiges'],
    protocolTemplates: [
      'Keine Mängel festgestellt.',
      'Treppenhauswand war bereits zerkratzt.',
      'Kundeneigener Schrank passt nicht durchs Treppenhaus. Transport auf eigene Gefahr, keine Haftung für Kratzer.',
      'Fernseher hat Kratzer im Display.'
    ]
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newContact, setNewContact] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newPropertyType, setNewPropertyType] = useState('');
  const [newProtocolType, setNewProtocolType] = useState('');
  const [newProtocolTemplate, setNewProtocolTemplate] = useState('');

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, 'system', 'settings');
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
        
        // Ensure customerSources exists
        if (!data.customerSources) {
          data.customerSources = ['Google Suche', 'Check24', 'Empfehlung', 'Eigene Website', 'Kleinanzeigen', 'Direkter Anruf'];
        }

        setSettings({ ...settings, ...data });
      }
    };
    fetchSettings();
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await setDoc(doc(db, 'system', 'settings'), settings, { merge: true });
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

  const addProtocolType = () => {
    if (newProtocolType.trim() && !settings.protocolTypes?.includes(newProtocolType.trim())) {
      setSettings({ ...settings, protocolTypes: [...(settings.protocolTypes||[]), newProtocolType.trim()] });
      setNewProtocolType('');
    }
  };

  const removeProtocolType = (pt: string) => {
    setSettings({ ...settings, protocolTypes: settings.protocolTypes.filter((p: string) => p !== pt) });
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
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500">
      <div className="flex justify-between items-center bg-bg-panel border border-structure p-4 rounded-xl shadow-lg">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cog6ToothIcon className="w-7 h-7 text-primary" /> Einstellungen
          </h1>
          <p className="text-sm text-text-muted mt-1">Verwalten Sie hier alle globalen Texte, Vorgaben und Kataloge.</p>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus === 'success' && <span className="text-green-400 text-sm font-semibold animate-in fade-in slide-in-from-right-4">✓ Gespeichert</span>}
          {saveStatus === 'error' && <span className="text-red-400 text-sm font-semibold animate-in fade-in slide-in-from-right-4">Fehler beim Speichern</span>}
          <button onClick={saveSettings} disabled={isSaving} className={`btn-primary py-2 px-6 shadow-lg ${saveStatus === 'success' ? 'bg-green-600 shadow-green-500/30' : 'shadow-primary/30'}`}>
            {isSaving ? 'Speichert...' : <><CheckIcon className="w-5 h-5 mr-1 inline" /> Speichern</>}
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 shrink-0 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-colors ${activeTab === tab.id ? 'bg-primary/10 text-primary border border-primary/30' : 'text-text-muted hover:bg-bg-panel hover:text-white border border-transparent'}`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 panel min-h-[600px]">
          
          {/* TAB: Basisdaten */}
          {activeTab === 'basisdaten' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-white border-b border-structure pb-2 mb-4">Allgemeine Firmendaten</h2>
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

              <h2 className="text-xl font-bold text-white border-b border-structure pb-2 mt-8 mb-4">Rechtliches & Bankverbindung</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Steuernummer / USt-IdNr.</label>
                  <input type="text" value={settings.taxId} onChange={e => handleChange('taxId', e.target.value)} className="input-field w-full" />
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

          {/* TAB: CRM & Kontakte */}
          {activeTab === 'ansprechpartner' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              
              {/* Ansprechpartner */}
              <div>
                <h2 className="text-xl font-bold text-white border-b border-structure pb-2 mb-4">Ansprechpartner verwalten</h2>
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
                      <span className="text-white font-medium">{contact}</span>
                      <button onClick={() => removeContact(contact)} className="text-red-400 hover:bg-red-400/10 p-1 rounded transition-colors">&times;</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kundenquellen */}
              <div className="pt-8">
                <h2 className="text-xl font-bold text-white border-b border-structure pb-2 mb-4">Kundenquellen (Marketing)</h2>
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
                      <span className="text-white font-medium">{source}</span>
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
              <h2 className="text-xl font-bold text-white border-b border-structure pb-2 mb-4">Immobilienarten</h2>
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
                    <span className="text-white font-medium">{pt}</span>
                    <button onClick={() => removePropertyType(pt)} className="text-red-400 hover:bg-red-400/10 p-1 rounded transition-colors">&times;</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: Texte & AGB */}
          {activeTab === 'texte' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-white border-b border-structure pb-2 mb-4">Textbausteine & AGB</h2>
              
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
                  <h3 className="text-lg font-semibold text-primary mb-3">Rechnungen</h3>
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

          {/* TAB: Protokolle */}
          {activeTab === 'protokolle' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="panel border-t-4 border-t-structure">
                  <h2 className="text-xl font-bold mb-4 text-white">Art des Protokolls</h2>
                  <p className="text-sm text-text-muted mb-4">Verwalte hier die Kategorien für deine Protokolle, die im Angebot / Auftrag zur Auswahl stehen.</p>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={newProtocolType} onChange={e => setNewProtocolType(e.target.value)} placeholder="Neue Protokoll-Art..." className="input-field flex-1" onKeyDown={(e) => e.key === 'Enter' && addProtocolType()} />
                    <button onClick={addProtocolType} className="btn-primary py-2 px-4 whitespace-nowrap">Hinzufügen</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(settings.protocolTypes || []).map((pt: string) => (
                      <div key={pt} className="bg-bg-dark border border-structure rounded-full px-3 py-1 flex items-center gap-2">
                        <span className="text-sm">{pt}</span>
                        <button onClick={() => removeProtocolType(pt)} className="text-red-400 hover:text-red-300">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="panel border-t-4 border-t-structure">
                  <h2 className="text-xl font-bold mb-4 text-white">Vorlagen für Beschreibungen (Schadensbeschreibung etc.)</h2>
                  <p className="text-sm text-text-muted mb-4">Hinterlege Standard-Sätze, die du beim Kunden mit einem Klick ins Protokoll einfügen kannst.</p>
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

          {/* TAB: System */}
          {activeTab === 'system' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-white border-b border-structure pb-2 mb-4">System & Finanzen</h2>
              <p className="text-sm text-text-muted mb-4">Globale Parameter für Berechnungen und Steuern.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                  <label className="block text-sm font-medium text-white mb-1">Standard Steuersatz (%)</label>
                  <input type="number" value={settings.taxRate} onChange={e => handleChange('taxRate', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                </div>
                <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                  <label className="block text-sm font-medium text-white mb-1">Mahngebühr pro Stufe (€)</label>
                  <input type="number" value={settings.dunningFee} onChange={e => handleChange('dunningFee', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                </div>
                <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                  <label className="block text-sm font-medium text-white mb-1">Angebotsgültigkeit (Tage)</label>
                  <p className="text-xs text-text-muted mb-2">Angebote sind standardmäßig so viele Tage gültig.</p>
                  <input type="number" value={settings.quoteValidDays} onChange={e => handleChange('quoteValidDays', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                </div>
                <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                  <label className="block text-sm font-medium text-white mb-1">Nächste Angebotsnummer (Start)</label>
                  <p className="text-xs text-text-muted mb-2">Das nächste Angebot beginnt mit dieser Nummer.</p>
                  <input type="number" value={settings.nextQuoteNumber} onChange={e => handleChange('nextQuoteNumber', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                </div>
                <div className="bg-bg-dark p-4 rounded-xl border border-structure">
                  <label className="block text-sm font-medium text-white mb-1">Nächste Rechnungsnummer (Start)</label>
                  <p className="text-xs text-text-muted mb-2">Die nächste Rechnung beginnt mit dieser Nummer.</p>
                  <input type="number" value={settings.nextInvoiceNumber} onChange={e => handleChange('nextInvoiceNumber', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                </div>
              </div>
            </div>
          )}
          
          {/* TAB: Leistungen & Zahlungen */}
          {activeTab === 'leistungen' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-xl font-bold text-white border-b border-structure pb-2 mb-4">Leistungskatalog & Zahlungsarten</h2>
              
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
                          <input type="text" value={cat.category} onChange={e => updateCategoryName(cIdx, e.target.value)} className="bg-transparent border-none text-white text-lg font-bold focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 w-full sm:w-auto" />
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
                    <div className="font-bold text-white text-lg">{pm.name}</div>
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
    </div>
  );
}
