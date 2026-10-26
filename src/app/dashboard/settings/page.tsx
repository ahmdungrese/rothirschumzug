"use client";
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Cog6ToothIcon, BuildingOfficeIcon, UsersIcon, CurrencyEuroIcon, DocumentTextIcon, CheckIcon, ServerStackIcon, TruckIcon, CalendarIcon, LinkIcon, EnvelopeIcon, ExclamationTriangleIcon, CreditCardIcon, ListBulletIcon, HashtagIcon, ClipboardDocumentListIcon, PlusIcon, TrashIcon, ArrowPathIcon, ShieldCheckIcon, StarIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { TeamAccessManager } from '@/components/settings/TeamAccessManager';
import { ActivityLogViewer } from '@/components/settings/ActivityLogViewer';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { ResetDatabaseModal } from '@/components/settings/ResetDatabaseModal';
import { FIXED_KEYS, FIXED_SERVICES, resolveFixedDefs, type FixedServiceKey } from '@/lib/serviceKeys';
import { ShowcaseServiceItem, DEFAULT_SHOWCASE_SERVICES, DEFAULT_SHOWCASE_TEXTS, AVAILABLE_SHOWCASE_ICONS } from '@/lib/showcaseDefaults';
import { MASTER_COMMUNICATION_TEMPLATES } from '@/lib/communicationDefaults';
import { MASTER_PROTOCOL_CATEGORIES, MASTER_PROTOCOL_SNIPPETS } from '@/lib/protocolDefaults';
import { MASTER_SYSTEM_TEXTS } from '@/lib/textDefaults';
import { MASTER_PAYMENT_METHODS } from '@/lib/paymentDefaults';
import { downloadCalendarEvent } from '@/lib/calendarExport';

const TABS = [
  { id: 'basisdaten', name: 'Basisdaten', icon: BuildingOfficeIcon },
  { id: 'nummern', name: 'Nummernkreise', icon: HashtagIcon },
  { id: 'ressourcen', name: 'Team & Zugänge', icon: UsersIcon },
  { id: 'ansprechpartner', name: 'CRM & Kontakte', icon: UsersIcon },
  { id: 'immobilien', name: 'Immobilienarten', icon: BuildingOfficeIcon },
  { id: 'leistungen', name: 'Leistungskatalog', icon: ListBulletIcon },
  { id: 'zahlungsarten', name: 'Zahlungsarten', icon: CreditCardIcon },
  { id: 'texte', name: 'Textbausteine & AGB', icon: DocumentTextIcon },
  { id: 'vorlagen', name: 'Nachrichten-Vorlagen', icon: DocumentTextIcon },
  { id: 'protokolle', name: 'Protokolle & Vorlagen', icon: DocumentTextIcon },
  { id: 'system', name: 'System & Steuern', icon: ServerStackIcon },
  { id: 'audit', name: 'Aktivitäts-Logbuch (Audit)', icon: ClipboardDocumentListIcon },
  { id: 'integration', name: 'E-Mail (IONOS) & Kalender', icon: EnvelopeIcon },
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState('basisdaten');
  const [showResetModal, setShowResetModal] = useState(false);

  // PIN Protection State for System & Steuern: Standardmäßig immer gesperrt (false). Bei jedem Page-Reload wieder gesperrt.
  const [isSystemUnlocked, setIsSystemUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Erkennung für lokale Entwicklungsumgebung: System & Steuern wird nur lokal (localhost / run dev) angezeigt
  const [isLocalDev, setIsLocalDev] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isLocal = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1' || 
                      window.location.hostname.startsWith('192.168.');
      setIsLocalDev(isLocal);
    }
  }, []);

  const visibleTabs = TABS.filter(tab => {
    if (tab.id === 'system' && !isLocalDev) {
      return false; // Online auf Vercel / Produktion vollständig verbergen!
    }
    return true;
  });

  // Sofortige automatische Sperre beim Wechseln des Tabs & Umleitung falls online
  useEffect(() => {
    if (activeTab === 'system' && !isLocalDev) {
      setActiveTab('basisdaten');
    }
    if (activeTab !== 'system') {
      setIsSystemUnlocked(false);
      setPinInput('');
    }
  }, [activeTab, isLocalDev]);

  const handleUnlockSystem = async () => {
    const trimmedPin = pinInput.trim();
    if (!trimmedPin || isVerifyingPin) return;
    
    setIsVerifyingPin(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        toast.error('Keine aktive Benutzersitzung. Bitte laden Sie die Seite neu.');
        setIsVerifyingPin(false);
        return;
      }

      const idToken = await user.getIdToken();
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${idToken}` 
        },
        body: JSON.stringify({ pin: trimmedPin, scope: 'system' })
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (res.ok && data?.valid) {
        setIsSystemUnlocked(true);
        setPinInput('');
        toast.success('Systembereich erfolgreich entsperrt!');
      } else {
        const errorMsg = data?.error || (res.status === 403 ? 'Zugriff verweigert: Falscher PIN oder keine Admin-Rechte.' : 'Falscher PIN!');
        toast.error(errorMsg);
      }
    } catch (err: any) {
      console.error('PIN verification error:', err);
      toast.error('Server nicht erreichbar oder Netzwerkfehler bei der PIN-Prüfung.');
    } finally {
      setIsVerifyingPin(false);
    }
  };
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
    kartonPrices: {
      s: 2.50,
      m: 3.20,
      l: 3.80,
      xl: 4.50,
      buecher: 3.00,
      kleider: 12.00,
    },
    showcaseServices: DEFAULT_SHOWCASE_SERVICES,
    showcaseTexts: DEFAULT_SHOWCASE_TEXTS,
    taxRate: 19,
    dunningFee: 5,
    nextQuoteNumber: 1771,
    nextInvoiceNumber: 1771,
    nextOrderNumber: 1,
    quoteValidDays: 14,
    employees: ['Ali', 'Thomas', 'Klaus', 'Mustafa'],
    vehicles: ['LKW 7,5t (Eigener)', 'Sixt Koffer 3,5t (A)', 'Sixt Koffer 3,5t (B)'],
    texts: {
      ...MASTER_SYSTEM_TEXTS
    },
    paymentMethods: [
      ...MASTER_PAYMENT_METHODS
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
          { name: 'Einpacken der Möbel mit Decken und Schutzfolien', price: 0, unit: 'Std' }
        ]
      },
      {
        category: 'Beladestelle (A)',
        items: [
          { name: 'Kartonlieferung vorab', price: 65, unit: 'Pauschal' },
          { name: 'Möbelabbau', price: 150, unit: 'Pauschal' },
          { name: 'Abbau von Küche', price: 280, unit: 'Pauschal' },
          { name: 'Einpackservice', price: 190, unit: 'Pauschal' },
          { name: 'Halteverbot A', price: 95, unit: 'Zone' },
          { name: 'Endreinigung', price: 220, unit: 'Pauschal' }
        ]
      },
      {
        category: 'Entladestelle (B)',
        items: [
          { name: 'Möbelaufbau', price: 180, unit: 'Pauschal' },
          { name: 'Aufbau von Küche', price: 320, unit: 'Pauschal' },
          { name: 'Auspackservice', price: 160, unit: 'Pauschal' },
          { name: 'Bohr- & Dübelarb.', price: 90, unit: 'Pauschal' },
          { name: 'Halteverbot B', price: 95, unit: 'Zone' },
          { name: 'Müllentsorgung', price: 120, unit: 'Pauschal' }
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
    protocolCategories: MASTER_PROTOCOL_CATEGORIES,
    protocolTemplates: MASTER_PROTOCOL_SNIPPETS.map(s => s.text),
    communicationTemplates: MASTER_COMMUNICATION_TEMPLATES,
    smtpHost: 'smtp.ionos.de',
    smtpPort: '465',
    smtpUser: 'info@rothirsch-umzug.de',
    smtpPass: '',
    fromName: 'Rothirsch Umzüge',
    smtpBccSelf: true,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [newContact, setNewContact] = useState('');
  const [newSource, setNewSource] = useState('');
  const [newPropertyType, setNewPropertyType] = useState('');
  const [newProtocolCategoryName, setNewProtocolCategoryName] = useState('');
  const [newProtocolCategoryText, setNewProtocolCategoryText] = useState('');
  const [newProtocolTemplate, setNewProtocolTemplate] = useState('');
  const [newEmployee, setNewEmployee] = useState('');
  const [newVehicle, setNewVehicle] = useState('');
  const [isInvoiceNumberUnlocked, setIsInvoiceNumberUnlocked] = useState(false);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

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
      
      // Ensure arrays and new fields exist
      if (!data.customerSources) data.customerSources = ['Google Suche', 'Check24', 'Empfehlung', 'Eigene Website', 'Kleinanzeigen', 'Direkter Anruf'];
      if (!data.employees) data.employees = ['Ali', 'Thomas', 'Klaus', 'Mustafa'];
      if (!data.vehicles) data.vehicles = ['LKW 7,5t (Eigener)', 'Sixt Koffer 3,5t (A)', 'Sixt Koffer 3,5t (B)'];
      if (data.nextQuoteNumber === undefined || data.nextQuoteNumber === null || data.nextQuoteNumber < 1771) data.nextQuoteNumber = 1771;
      if (data.nextInvoiceNumber === undefined || data.nextInvoiceNumber === null || data.nextInvoiceNumber < 1771) data.nextInvoiceNumber = 1771;
      if (data.nextOrderNumber === undefined) data.nextOrderNumber = 1;
      if (!data.texts.orderIntro) {
        data.texts.orderIntro = 'Sehr geehrte Damen und Herren,\nvielen Dank für Ihre Unterschrift. Hiermit bestätigen wir Ihren Auftrag verbindlich.';
        data.texts.orderOutro = 'Wir freuen uns auf den gemeinsamen Umzug und garantieren Ihnen einen reibungslosen Ablauf.';
        data.texts.orderGreeting = 'Mit freundlichen Grüßen\nRothirsch Umzüge';
      }

      // Smart Merge texts: ensure master standard texts exist with user customizations preserved
      data.texts = {
        ...MASTER_SYSTEM_TEXTS,
        ...(data.texts || {})
      };

      // Smart Merge payment methods: ensure standard methods exist and at least one has isDefault
      if (!Array.isArray(data.paymentMethods) || data.paymentMethods.length === 0) {
        data.paymentMethods = MASTER_PAYMENT_METHODS.map(pm => ({ ...pm }));
      } else {
        const hasDefault = data.paymentMethods.some((pm: any) => pm.isDefault);
        if (!hasDefault && data.paymentMethods[0]) {
          data.paymentMethods[0].isDefault = true;
        }
      }

      // Smart Merge communicationTemplates: ensure all 17 master templates exist with user customizations preserved
      const existingComm = Array.isArray(data.communicationTemplates) ? data.communicationTemplates : [];
      const commMap = new Map<string, any>();
      MASTER_COMMUNICATION_TEMPLATES.forEach(t => commMap.set(t.id, t));
      existingComm.forEach((t: any) => {
        if (t && t.id) {
          const base = commMap.get(t.id) || {};
          commMap.set(t.id, { ...base, ...t });
        } else if (t && t.name) {
          const cid = `custom_${t.name.replace(/\s+/g, '_').toLowerCase()}`;
          commMap.set(cid, { id: cid, ...t });
        }
      });
      data.communicationTemplates = Array.from(commMap.values());

      // Smart Merge protocol categories: ensure all 6 master categories exist
      const existingProto = Array.isArray(data.protocolCategories) ? data.protocolCategories : [];
      const protoMap = new Map<string, any>();
      MASTER_PROTOCOL_CATEGORIES.forEach(c => protoMap.set(c.id, c));
      existingProto.forEach((c: any) => {
        if (c && c.id) {
          const base = protoMap.get(c.id) || {};
          protoMap.set(c.id, { ...base, ...c });
        } else if (c && c.name) {
          const cid = `custom_${c.name.replace(/\s+/g, '_').toLowerCase()}`;
          protoMap.set(cid, { id: cid, ...c });
        }
      });
      data.protocolCategories = Array.from(protoMap.values());

      if (!data.protocolTemplates || data.protocolTemplates.length === 0) {
        data.protocolTemplates = MASTER_PROTOCOL_SNIPPETS.map(s => s.text);
      }

      // Fallback for showcase services & texts
      if (!data.showcaseServices || data.showcaseServices.length === 0) {
        data.showcaseServices = DEFAULT_SHOWCASE_SERVICES;
      }
      if (!data.showcaseTexts) {
        data.showcaseTexts = DEFAULT_SHOWCASE_TEXTS;
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
      // 1. Zähler-Schutz: Höchste verwendete Nummern abfragen (aus orders UND invoices)
      const { collection, getDocs } = await import('firebase/firestore');
      const [ordersSnap, invoicesSnap] = await Promise.all([
        getDocs(collection(db, 'orders')),
        getDocs(collection(db, 'invoices'))
      ]);
      
      let maxQuote = 0;
      let maxInvoice = 0;

      ordersSnap.forEach(doc => {
        const d = doc.data();
        if (d.orderNumber && typeof d.orderNumber === 'string') {
          // Format: AN-1771 or ANG-2026-006 -> extract number
          const parts = d.orderNumber.split('-');
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxQuote) maxQuote = num;
        }
        if (d.invoiceNumber && typeof d.invoiceNumber === 'string') {
          // Format: R-1771 or RE-2026-011 -> extract number
          const parts = d.invoiceNumber.split('-');
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxInvoice) maxInvoice = num;
        }
      });

      invoicesSnap.forEach(doc => {
        const d = doc.data();
        if (d.invoiceNumber && typeof d.invoiceNumber === 'string') {
          const parts = d.invoiceNumber.split('-');
          const num = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(num) && num > maxInvoice) maxInvoice = num;
        }
      });

      if (settings.nextQuoteNumber < 1) {
        toast.error('Die Startnummer für Angebote muss mindestens 1 betragen.');
        setSaveStatus('error');
        setIsSaving(false);
        return;
      }
      if (settings.nextInvoiceNumber < 1) {
        toast.error('Die Startnummer für Rechnungen muss mindestens 1 betragen.');
        setSaveStatus('error');
        setIsSaving(false);
        return;
      }

      // Zombie-Feld "nextOfferNumber" sowie Plaintext-Passwörter für den Client-Save bereinigen
      const settingsToSave = { ...settings };
      delete settingsToSave.nextOfferNumber;
      delete settingsToSave.smtpPass;
      delete settingsToSave.smtpPassword;

      try {
        await setDoc(doc(db, 'system', 'settings'), settingsToSave, { merge: true });
        const { deleteField } = await import('firebase/firestore');
        await updateDoc(doc(db, 'system', 'settings'), { nextOfferNumber: deleteField() }).catch(() => {});
      } catch (clientErr: any) {
        console.warn("Client setDoc fehlgeschlagen oder Berechtigung verweigert, nutze Server-API Fallback:", clientErr?.message);
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/admin/save-settings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ settings })
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || clientErr.message);
        }
      }

      setSaveStatus('success');
      toast.success("Startnummern und Einstellungen erfolgreich gespeichert!");
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error: any) {
      console.error("Fehler beim Speichern", error);
      toast.error(error.message || "Fehler beim Speichern.");
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!settings.smtpPass) {
      toast.error('Bitte gib zuerst dein IONOS E-Mail-Passwort ein.');
      return;
    }

    setIsTestingEmail(true);
    const toastId = toast.loading('Sende Test-E-Mail über IONOS...');

    try {
      const formData = new FormData();
      formData.append('isTest', 'true');
      formData.append('smtpHost', settings.smtpHost || 'smtp.ionos.de');
      formData.append('smtpPort', String(settings.smtpPort || '465'));
      formData.append('smtpUser', settings.smtpUser || 'info@rothirsch-umzug.de');
      formData.append('smtpPass', settings.smtpPass || '');
      formData.append('fromName', settings.fromName || settings.companyName || 'Rothirsch Umzüge');

      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken || ''}`
        },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || '✅ Test-E-Mail erfolgreich! Prüfe dein Outlook-Postfach.', { id: toastId, duration: 6000 });
      } else {
        toast.error(`Fehler: ${data.error || 'Verbindung fehlgeschlagen'}`, { id: toastId, duration: 7000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'Netzwerkfehler beim Senden.', { id: toastId });
    } finally {
      setIsTestingEmail(false);
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
    setSettings({ 
      ...settings, 
      protocolCategories: MASTER_PROTOCOL_CATEGORIES,
      protocolTemplates: MASTER_PROTOCOL_SNIPPETS.map(s => s.text)
    });
    toast.success("Alle 6 Standard-Protokolle & Textbausteine geladen! Bitte oben auf Speichern klicken.");
  };

  const loadSampleTexts = () => {
    setSettings((prev: any) => ({
      ...prev,
      texts: {
        ...(prev.texts || {}),
        ...MASTER_SYSTEM_TEXTS
      }
    }));
    toast.success("Standard-Texte & AGB erfolgreich geladen! Bitte oben auf Speichern klicken.");
  };

  const loadSamplePaymentMethods = () => {
    setSettings((prev: any) => ({
      ...prev,
      paymentMethods: MASTER_PAYMENT_METHODS.map(pm => ({ ...pm }))
    }));
    toast.success("Standard-Zahlungsarten (Überweisung, Barzahlung, Echtzeit) geladen! Bitte oben auf Speichern klicken.");
  };

  const setDefaultPaymentMethod = (indexToDefault: number) => {
    const currentPms = settings.paymentMethods || [];
    if (!currentPms[indexToDefault]) return;

    const targetPm = { ...currentPms[indexToDefault], isDefault: true };
    const otherPms = currentPms
      .filter((_: any, i: number) => i !== indexToDefault)
      .map((p: any) => ({ ...p, isDefault: false }));

    const reorderedPms = [targetPm, ...otherPms];
    handleChange('paymentMethods', reorderedPms);
    toast.success(`"${targetPm.name}" als Standard-Zahlungsart festgelegt!`);
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

  const toggleShowcaseService = (idx: number) => {
    const list = [...(settings.showcaseServices || DEFAULT_SHOWCASE_SERVICES)];
    list[idx] = { ...list[idx], enabled: !list[idx].enabled };
    setSettings({ ...settings, showcaseServices: list });
  };

  const updateShowcaseService = (idx: number, field: string, value: any) => {
    const list = [...(settings.showcaseServices || DEFAULT_SHOWCASE_SERVICES)];
    list[idx] = { ...list[idx], [field]: value };
    setSettings({ ...settings, showcaseServices: list });
  };

  const addShowcaseService = () => {
    const list = [...(settings.showcaseServices || DEFAULT_SHOWCASE_SERVICES)];
    list.push({
      id: `custom_${Date.now()}`,
      name: 'Neuer Werbeservice',
      icon: 'general',
      enabled: true,
    });
    setSettings({ ...settings, showcaseServices: list });
  };

  const removeShowcaseService = (idx: number) => {
    const list = [...(settings.showcaseServices || DEFAULT_SHOWCASE_SERVICES)];
    list.splice(idx, 1);
    setSettings({ ...settings, showcaseServices: list });
  };

  const resetShowcaseServices = () => {
    if (confirm('Möchten Sie die Liste der Werbeservices wirklich auf den Standard zurücksetzen?')) {
      setSettings({
        ...settings,
        showcaseServices: DEFAULT_SHOWCASE_SERVICES,
        showcaseTexts: DEFAULT_SHOWCASE_TEXTS,
      });
      toast.success('Werbeservices auf Standard zurückgesetzt');
    }
  };

  if (profile && profile.role !== 'admin') {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px] p-6 text-center">
        <div className="max-w-md bg-bg-panel border border-structure rounded-3xl p-8 space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto">
            <Cog6ToothIcon className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-text-main">Keine Berechtigung / غير مصرح بالدخول</h2>
          <p className="text-xs text-text-muted leading-relaxed">
            Dieser Bereich ist ausschließlich für Administratoren zugänglich.
          </p>
          <button
            onClick={() => { window.location.href = '/dashboard'; }}
            className="btn-primary py-2 px-6 text-xs font-bold"
          >
            Zum Dashboard / العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

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
          {visibleTabs.map(tab => (
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

          {/* TAB: Nummernkreise & Zähler */}
          {activeTab === 'nummern' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="border-b border-structure pb-4 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
                    <HashtagIcon className="w-6 h-6 text-primary" />
                    Nummernkreise & Startnummern
                  </h2>
                  <p className="text-sm text-text-muted mt-0.5">
                    Hier kannst du die Startnummern für Angebote und Rechnungen frei wählen und anpassen. Die Nummern werden automatisch fortlaufend hochgezählt.
                  </p>
                </div>
                <button 
                  onClick={saveSettings} 
                  disabled={isSaving} 
                  className="btn-primary py-2 px-5 text-sm shadow-md cursor-pointer"
                >
                  {isSaving ? 'Speichert...' : 'Startnummern speichern'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Angebotsnummern (AN-...) */}
                <div className="bg-bg-dark p-6 rounded-2xl border border-structure space-y-4 shadow-sm hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-lg font-headline">
                        AN
                      </div>
                      <div>
                        <h3 className="font-bold text-text-main text-base">Angebote (Angebotsnummer)</h3>
                        <p className="text-xs text-text-muted">Format: AN-[Nummer]</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                      Vorschau: AN-{settings.nextQuoteNumber ?? 1}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">
                      Nächste Angebotsnummer (Startwert)
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      value={settings.nextQuoteNumber ?? 1} 
                      onChange={e => handleChange('nextQuoteNumber', Math.max(1, parseInt(e.target.value, 10) || 1))} 
                      className="input-field w-full bg-bg-panel text-xl font-bold font-mono py-2.5" 
                    />
                    <p className="text-xs text-text-muted mt-2">
                      Das nächste erstellte Angebot erhält die Nummer <strong className="text-text-main font-mono">AN-{settings.nextQuoteNumber ?? 1}</strong>.
                    </p>
                  </div>
                </div>

                {/* 2. Rechnungsnummern (R-...) - Geschützt und nur lesbar */}
                <div className="bg-bg-dark p-6 rounded-2xl border border-structure space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-slate-500/10 text-slate-400 flex items-center justify-center font-bold text-lg font-headline">
                        R
                      </div>
                      <div>
                        <h3 className="font-bold text-text-main text-base">Rechnungen (Rechnungsnummer)</h3>
                        <p className="text-xs text-text-muted">Format: R-[Nummer]</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20 font-mono">
                      Vorschau: R-{settings.nextInvoiceNumber ?? 1}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">
                      Nächste Rechnungsnummer (Aktueller Stand)
                    </label>
                    <input 
                      type="number" 
                      disabled
                      readOnly
                      value={settings.nextInvoiceNumber ?? 1} 
                      className="input-field w-full bg-structure/40 border border-structure text-text-muted/70 cursor-not-allowed text-xl font-bold font-mono py-2.5 select-none" 
                    />
                  </div>
                </div>

                {/* 3. Auftragsbestätigung (Vertragsnummer) */}
                <div className="bg-bg-dark p-6 rounded-2xl border border-structure space-y-4 shadow-sm md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-lg font-headline">
                        #
                      </div>
                      <div>
                        <h3 className="font-bold text-text-main text-base">Auftragsbestätigungen (Vertragsnummer)</h3>
                        <p className="text-xs text-text-muted">Interne fortlaufende Auftragsnummer bei Vertragsabschluss</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono">
                      Vorschau: AU-{settings.nextOrderNumber || 1}
                    </span>
                  </div>

                  <div className="max-w-md">
                    <label className="block text-xs font-semibold text-text-muted uppercase mb-1.5">
                      Nächste Auftragsnummer (Startwert)
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      value={settings.nextOrderNumber || 1} 
                      onChange={e => handleChange('nextOrderNumber', Math.max(1, parseInt(e.target.value, 10) || 1))} 
                      className="input-field w-full bg-bg-panel text-xl font-bold font-mono py-2.5" 
                    />
                  </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-structure pb-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-text-main">Textbausteine & AGB</h2>
                  <p className="text-sm text-text-muted">Standard-Texte für Angebote (Seite 1 & 2), Auftragsbestätigungen, Rechnungen und AGB verwalten.</p>
                </div>
                <button
                  type="button"
                  onClick={loadSampleTexts}
                  className="btn-secondary py-2 px-3.5 text-xs font-bold rounded-xl flex items-center gap-1.5 self-start sm:self-auto cursor-pointer shadow-xs hover:border-primary/50 transition-all"
                  title="Standard-Texte und AGBs mit 1-Klick auf Werkseinstellungen zurücksetzen"
                >
                  <ArrowPathIcon className="w-4 h-4 text-primary" />
                  <span>Standard laden</span>
                </button>
              </div>
              
              <div className="space-y-6">
                {/* 1. Angebot Seite 1 */}
                <div className="bg-bg-dark border border-structure p-5 md:p-6 rounded-2xl space-y-4 shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-structure/60 pb-3">
                    <DocumentTextIcon className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-base font-bold text-text-main">Angebot (Seite 1 – Begrüßung & Begleittext)</h3>
                      <p className="text-xs text-text-muted">Erscheint auf Seite 1 des Angebots vor und nach der Positionskalkulation.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Einleitungstext (Vor den Leistungen)</label>
                      <textarea 
                        value={settings.texts.quoteIntro || ''} 
                        onChange={e => handleChange('quoteIntro', e.target.value, 'texts')} 
                        className="input-field w-full h-24 text-xs font-sans" 
                        placeholder="Sehr geehrte Damen und Herren..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Abschluss-Gruß & Höflichkeitsformel</label>
                      <textarea 
                        value={settings.texts.quoteGreeting || ''} 
                        onChange={e => handleChange('quoteGreeting', e.target.value, 'texts')} 
                        className="input-field w-full h-24 text-xs font-sans" 
                        placeholder="Wir würden uns freuen..."
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Angebot Seite 2: Rechtliche Bestätigung & Versicherung */}
                <div className="bg-bg-dark border border-structure p-5 md:p-6 rounded-2xl space-y-5 shadow-2xs">
                  <div className="flex items-center gap-2 border-b border-structure/60 pb-3">
                    <ShieldCheckIcon className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="text-base font-bold text-text-main">Angebot (Seite 2 – Verbindliche Beauftragung & Versicherungsschutz)</h3>
                      <p className="text-xs text-text-muted">Texte und Titel auf Seite 2, die über dem Kunden-Unterschriftenfeld gedruckt werden.</p>
                    </div>
                  </div>

                  {/* Versicherungsschutz */}
                  <div className="bg-bg-panel/70 p-4 rounded-xl border border-structure/50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                      <label className="text-xs font-bold text-text-main">Titel für Versicherung:</label>
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={settings.texts.insuranceTitle || 'Versicherungsschutz'}
                          onChange={e => handleChange('insuranceTitle', e.target.value, 'texts')}
                          className="input-field w-full text-xs font-bold text-text-main"
                          placeholder="z.B. Versicherungsschutz"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Textinhalt (Haftung & Transportgüterversicherung gem. § 451g HGB):</label>
                      <textarea 
                        value={settings.texts.insurance || ''} 
                        onChange={e => handleChange('insurance', e.target.value, 'texts')} 
                        className="input-field w-full h-24 text-xs font-sans" 
                      />
                    </div>
                  </div>

                  {/* Verbindliche Beauftragung */}
                  <div className="bg-bg-panel/70 p-4 rounded-xl border border-structure/50 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                      <label className="text-xs font-bold text-text-main">Titel für Beauftragung:</label>
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={settings.texts.quoteBindingTitle || 'Verbindliche Beauftragung'}
                          onChange={e => handleChange('quoteBindingTitle', e.target.value, 'texts')}
                          className="input-field w-full text-xs font-bold text-text-main"
                          placeholder="z.B. Verbindliche Beauftragung"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-muted mb-1">Textinhalt (Bestätigungstext direkt über der Unterschrift):</label>
                      <textarea 
                        value={settings.texts.quoteOutro || ''} 
                        onChange={e => handleChange('quoteOutro', e.target.value, 'texts')} 
                        className="input-field w-full h-24 text-xs font-sans" 
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Auftragsbestätigungen */}
                <div className="bg-bg-dark border border-structure p-5 md:p-6 rounded-2xl space-y-4 shadow-2xs">
                  <h3 className="text-base font-bold text-text-main border-b border-structure/60 pb-3">Auftragsbestätigungen</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Einleitungstext</label>
                      <textarea value={settings.texts.orderIntro || ''} onChange={e => handleChange('orderIntro', e.target.value, 'texts')} className="input-field w-full h-16 text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Schlusstext / Hinweise</label>
                      <textarea value={settings.texts.orderOutro || ''} onChange={e => handleChange('orderOutro', e.target.value, 'texts')} className="input-field w-full h-16 text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Abschluss-Gruß</label>
                      <textarea value={settings.texts.orderGreeting || ''} onChange={e => handleChange('orderGreeting', e.target.value, 'texts')} className="input-field w-full h-20 text-xs" />
                    </div>
                  </div>
                </div>

                {/* 4. Rechnungen & Mahnwesen */}
                <div className="bg-bg-dark border border-structure p-5 md:p-6 rounded-2xl space-y-4 shadow-2xs">
                  <h3 className="text-base font-bold text-text-main border-b border-structure/60 pb-3">Rechnungen & Mahnwesen</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Einleitungstext</label>
                      <textarea value={settings.texts.invoiceIntro || ''} onChange={e => handleChange('invoiceIntro', e.target.value, 'texts')} className="input-field w-full h-16 text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Schlusstext / Überweisungshinweis</label>
                      <textarea value={settings.texts.invoiceOutro || ''} onChange={e => handleChange('invoiceOutro', e.target.value, 'texts')} className="input-field w-full h-16 text-xs" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Abschluss-Gruß</label>
                      <textarea value={settings.texts.invoiceGreeting || ''} onChange={e => handleChange('invoiceGreeting', e.target.value, 'texts')} className="input-field w-full h-20 text-xs" />
                    </div>
                  </div>
                </div>

                {/* 5. AGB */}
                <div className="bg-bg-dark border border-structure p-5 md:p-6 rounded-2xl space-y-4 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-structure/60 pb-3">
                    <h3 className="text-base font-bold text-text-main">Allgemeine Geschäftsbedingungen (AGB)</h3>
                    <span className="text-xs text-text-muted">Wird auf Seite 3 des Angebots als 2-spaltige AGB gedruckt</span>
                  </div>
                  <div>
                    <textarea 
                      value={settings.texts.agb || ''} 
                      onChange={e => handleChange('agb', e.target.value, 'texts')} 
                      className="input-field w-full h-96 text-xs font-mono leading-relaxed" 
                    />
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
                      if (confirm('Möchten Sie alle 17 Standard-Nachrichtenvorlagen synchronisieren? Ihre Anpassungen bleiben erhalten.')) {
                        const currentTemplates = settings.communicationTemplates || [];
                        const commMap = new Map<string, any>();
                        MASTER_COMMUNICATION_TEMPLATES.forEach(t => commMap.set(t.id, t));
                        currentTemplates.forEach((t: any) => {
                          if (t && t.id && !t.id.endsWith('_default')) {
                            const base = commMap.get(t.id) || {};
                            commMap.set(t.id, { ...base, ...t });
                          } else if (t && t.name) {
                            const cid = `custom_${t.name.replace(/\s+/g, '_').toLowerCase()}`;
                            commMap.set(cid, { id: cid, ...t });
                          }
                        });
                        handleChange('communicationTemplates', Array.from(commMap.values()));
                        toast.success("Alle 17 Standard-Nachrichtenvorlagen geladen! Bitte oben auf Speichern klicken.");
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
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                          {tpl.category || 'Allgemein'}
                        </span>
                        <h3 className="font-bold text-text-main truncate">{tpl.name}</h3>
                      </div>
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Vorlagen-Name (intern)</label>
                          <input 
                            type="text" 
                            value={tpl.name || ''} 
                            onChange={e => {
                              const newTemplates = [...settings.communicationTemplates];
                              newTemplates[idx].name = e.target.value;
                              handleChange('communicationTemplates', newTemplates);
                            }} 
                            className="input-field w-full text-sm" 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-text-muted uppercase mb-1">Kategorie / Phase</label>
                          <input 
                            type="text" 
                            value={tpl.category || ''} 
                            onChange={e => {
                              const newTemplates = [...settings.communicationTemplates];
                              newTemplates[idx].category = e.target.value;
                              handleChange('communicationTemplates', newTemplates);
                            }} 
                            placeholder="z.B. Erstkontakt, Angebot, Logistik"
                            className="input-field w-full text-sm" 
                          />
                        </div>
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

          {/* TAB: Integration (E-Mail IONOS & Kalender) */}
          {activeTab === 'integration' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
              
              {/* SECTION 1: IONOS E-MAIL (SMTP) */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-structure pb-3">
                  <div>
                    <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
                      <EnvelopeIcon className="w-6 h-6 text-primary" />
                      <span>IONOS E-Mail-Postfach (SMTP)</span>
                    </h2>
                    <p className="text-sm text-text-muted mt-1">
                      Angebote und Rechnungen direkt als PDF-Anhang über dein offizielles Firmen-Postfach <strong>info@rothirsch-umzug.de</strong> versenden.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {settings.smtpPass ? (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckIcon className="w-4 h-4" />
                        <span>Aktiv konfiguriert</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1.5">
                        <ExclamationTriangleIcon className="w-4 h-4" />
                        <span>Passwort fehlt</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-bg-dark border border-structure p-6 rounded-2xl space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    
                    {/* Server Host */}
                    <div>
                      <label className="block text-xs font-bold text-text-main mb-1.5">
                        Postausgangsserver (SMTP Host)
                      </label>
                      <input
                        type="text"
                        value={settings.smtpHost || 'smtp.ionos.de'}
                        onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                        className="w-full bg-bg-card border border-structure rounded-xl px-3.5 py-2.5 text-sm text-text-main font-mono focus:border-primary focus:outline-none"
                        placeholder="smtp.ionos.de"
                      />
                      <span className="text-[11px] text-text-muted mt-1 block">Standard bei IONOS: smtp.ionos.de</span>
                    </div>

                    {/* Port */}
                    <div>
                      <label className="block text-xs font-bold text-text-main mb-1.5">
                        Port &amp; Verschlüsselung
                      </label>
                      <input
                        type="text"
                        value={settings.smtpPort || '465'}
                        onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                        className="w-full bg-bg-card border border-structure rounded-xl px-3.5 py-2.5 text-sm text-text-main font-mono focus:border-primary focus:outline-none"
                        placeholder="465"
                      />
                      <span className="text-[11px] text-text-muted mt-1 block">Port 465 (SSL/TLS) oder 587 (STARTTLS)</span>
                    </div>

                    {/* Absendername */}
                    <div>
                      <label className="block text-xs font-bold text-text-main mb-1.5">
                        Absendername (Anzeigename)
                      </label>
                      <input
                        type="text"
                        value={settings.fromName || settings.companyName || 'Rothirsch Umzüge'}
                        onChange={(e) => setSettings({ ...settings, fromName: e.target.value })}
                        className="w-full bg-bg-card border border-structure rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:border-primary focus:outline-none"
                        placeholder="Rothirsch Umzüge"
                      />
                      <span className="text-[11px] text-text-muted mt-1 block">Wird dem Kunden als Absender angezeigt</span>
                    </div>

                    {/* Benutzername (E-Mail) */}
                    <div>
                      <label className="block text-xs font-bold text-text-main mb-1.5">
                        Benutzername (Deine IONOS E-Mail)
                      </label>
                      <input
                        type="email"
                        value={settings.smtpUser || 'info@rothirsch-umzug.de'}
                        onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                        className="w-full bg-bg-card border border-structure rounded-xl px-3.5 py-2.5 text-sm text-text-main font-mono focus:border-primary focus:outline-none"
                        placeholder="info@rothirsch-umzug.de"
                      />
                    </div>

                    {/* Passwort */}
                    <div className="relative">
                      <label className="block text-xs font-bold text-text-main mb-1.5">
                        IONOS E-Mail-Passwort
                      </label>
                      <div className="relative">
                        <input
                          type={showSmtpPassword ? 'text' : 'password'}
                          value={settings.smtpPass || ''}
                          onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                          className="w-full bg-bg-card border border-structure rounded-xl px-3.5 py-2.5 pr-10 text-sm text-text-main focus:border-primary focus:outline-none"
                          placeholder="Passwort aus dem IONOS Control Panel"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-main cursor-pointer"
                          title={showSmtpPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
                        >
                          {showSmtpPassword ? (
                            <EyeSlashIcon className="w-5 h-5" />
                          ) : (
                            <EyeIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <span className="text-[11px] text-text-muted mt-1 block">Wird sicher in der Datenbank verschlüsselt gespeichert</span>
                    </div>

                    {/* BCC Option */}
                    <div className="flex flex-col justify-center">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none mt-2 p-3 rounded-xl bg-bg-card border border-structure/60 hover:border-primary/40 transition-colors">
                        <input
                          type="checkbox"
                          checked={settings.smtpBccSelf !== false}
                          onChange={(e) => setSettings({ ...settings, smtpBccSelf: e.target.checked })}
                          className="w-4 h-4 rounded mt-0.5 text-primary accent-primary cursor-pointer"
                        />
                        <div>
                          <span className="text-xs font-bold text-text-main block">
                            Kopie an mich selbst (BCC)
                          </span>
                          <span className="text-[11px] text-text-muted block leading-tight mt-0.5">
                            Garantiert, dass jede gesendete E-Mail sofort in deinem Outlook-Postfach auf dem Smartphone sichtbar ist.
                          </span>
                        </div>
                      </label>
                    </div>

                  </div>

                  {/* Actions Row */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-structure">
                    <p className="text-xs text-text-muted">
                      💡 <strong>Tipp:</strong> Klicke auf „Test-E-Mail senden“, um die Zugangsdaten sofort zu prüfen.
                    </p>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleTestEmail}
                        disabled={isTestingEmail || !settings.smtpPass}
                        className="btn-secondary w-full sm:w-auto py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 border-primary/40 text-primary hover:bg-primary/10 disabled:opacity-50 cursor-pointer"
                      >
                        <EnvelopeIcon className="w-4 h-4" />
                        <span>{isTestingEmail ? 'Prüfe Verbindung...' : '✉️ Test-E-Mail senden'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={saveSettings}
                        disabled={isSaving}
                        className="btn-primary w-full sm:w-auto py-2.5 px-5 text-xs font-bold flex items-center justify-center gap-2 shadow-md cursor-pointer"
                      >
                        <CheckIcon className="w-4 h-4" />
                        <span>{isSaving ? 'Speichern...' : 'E-Mail-Einstellungen sichern'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: KALENDER */}
              <div className="pt-6 border-t border-structure">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-bg-dark border border-structure p-5 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-text-main">Kalender</h3>
                      <p className="text-xs text-text-muted">Universal 1-Klick Kalendersynchronisation (.ics) für Outlook, Samsung & Smartphone</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      downloadCalendarEvent({
                        title: '🚚 Test-Umzug: Max Mustermann (#AU-TEST-001)',
                        startDate: new Date().toISOString().split('T')[0],
                        startTime: '08:00',
                        durationHours: 6,
                        location: 'A: Haydnstr. 16, 44805 Bochum ➔ B: Hauptstr. 10, 44787 Bochum',
                        description: 'Test-Kalendereintrag aus der Rothirsch App.\nTelefon: +49 177 4652154\nVolumen: 35 m³\nDisposition: 3 Helfer • 1 LKW (3,5t)',
                        category: 'Umzug'
                      }, 'Test_Umzug_Rothirsch');
                    }}
                    className="btn-primary flex items-center justify-center gap-2 py-2.5 px-5 text-xs font-bold rounded-xl shadow-md cursor-pointer shrink-0"
                  >
                    <CalendarIcon className="w-4 h-4" />
                    <span>Test-Termin in Kalender eintragen</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Audit */}
          {activeTab === 'audit' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <ActivityLogViewer />
            </div>
          )}

          {/* TAB: System */}
          {activeTab === 'system' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-structure pb-2 mb-2 gap-2">
                <div>
                  <h2 className="text-xl font-bold text-text-main">System & Steuern</h2>
                  <p className="text-sm text-text-muted">Globale Berechnungsfaktoren, Steuern, Nummernkreise und Systemverwaltung.</p>
                </div>
                {isSystemUnlocked && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsSystemUnlocked(false);
                      toast.success('Systembereich wieder gesperrt.');
                    }}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 text-text-muted hover:text-red-400 border-structure shrink-0 self-start sm:self-auto cursor-pointer"
                  >
                    <span>🔒</span>
                    <span>Bereich jetzt sperren</span>
                  </button>
                )}
              </div>

              {!isSystemUnlocked ? (
                <div className="bg-bg-dark border border-red-500/30 p-8 rounded-xl max-w-md mx-auto mt-12 text-center shadow-lg shadow-red-500/10">
                  <ServerStackIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-text-main mb-2">Geschützter Bereich</h3>
                  <p className="text-sm text-text-muted mb-6">Bitte gib deinen 4-stelligen Admin-PIN ein, um Steuersätze und Nummernkreise zu bearbeiten.</p>
                  <div className="flex gap-2 justify-center">
                    <input 
                      type="password" 
                      value={pinInput}
                      disabled={isVerifyingPin}
                      onChange={e => setPinInput(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Enter') {
                          await handleUnlockSystem();
                        }
                      }}
                      className="input-field text-center w-32 tracking-widest font-mono text-xl disabled:opacity-50" 
                      maxLength={4} 
                      placeholder="****"
                      autoFocus
                    />
                    <button 
                      onClick={handleUnlockSystem} 
                      disabled={isVerifyingPin || !pinInput.trim()}
                      className="btn-primary disabled:opacity-50 flex items-center gap-2"
                    >
                      {isVerifyingPin ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Prüfe...</span>
                        </>
                      ) : (
                        'Entsperren'
                      )}
                    </button>
                  </div>
                  {isLocalDev && (
                    <p className="text-[11px] text-text-muted mt-4">
                      Hinweis (Lokaler Dev-Modus): PIN ist <code className="bg-bg-panel px-1.5 py-0.5 rounded text-primary font-mono font-bold">7770</code>
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* SEKTION 1: Steuern & Zahlungsbedingungen */}
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-3">Steuern & Zahlungskonditionen</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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
                        <input type="number" value={settings.quoteValidDays} onChange={e => handleChange('quoteValidDays', Number(e.target.value))} className="input-field w-full bg-bg-panel" />
                      </div>
                    </div>
                  </div>

                  {/* SEKTION 2: Nummernkreise (Startwerte) */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Nummernkreise & Belegnummern</h3>
                        <p className="text-xs text-text-muted">Hier kannst du festlegen, mit welcher Startnummer neue Angebote, Aufträge und Rechnungen beginnen sollen (z.B. bei Systemwechsel).</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* ANGEBOTSNUMMER */}
                      <div className="bg-bg-dark p-4 rounded-xl border border-structure flex flex-col justify-between">
                        <div>
                          <label className="block text-sm font-medium text-text-main mb-1">Nächste Angebotsnummer (Start)</label>
                          <p className="text-xs text-text-muted mb-2">Das nächste erstellte Angebot beginnt mit dieser Nummer.</p>
                          <input 
                            type="number" 
                            min="1"
                            value={settings.nextQuoteNumber ?? 1} 
                            onChange={e => handleChange('nextQuoteNumber', Math.max(1, parseInt(e.target.value, 10) || 1))} 
                            className="input-field w-full bg-bg-panel font-mono text-base font-semibold" 
                          />
                        </div>
                        <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-500 flex items-start gap-1.5">
                          <span className="text-xs">⚠️</span>
                          <span>Änderungen an der Startnummer werden erst nach Klick auf <strong>„Speichern“</strong> oben rechts wirksam.</span>
                        </div>
                      </div>

                      {/* AUFTRAGSNUMMER */}
                      <div className="bg-bg-dark p-4 rounded-xl border border-structure flex flex-col justify-between">
                        <div>
                          <label className="block text-sm font-medium text-text-main mb-1">Nächste Auftragsnummer (Start)</label>
                          <p className="text-xs text-text-muted mb-2">Der nächste bestätigte Auftrag beginnt mit dieser Nummer.</p>
                          <input 
                            type="number" 
                            min="1"
                            value={settings.nextOrderNumber || 1} 
                            onChange={e => handleChange('nextOrderNumber', Math.max(1, parseInt(e.target.value, 10) || 1))} 
                            className="input-field w-full bg-bg-panel font-mono text-base font-semibold" 
                          />
                        </div>
                        <p className="text-[11px] text-text-muted mt-3">
                          Wird bei Bestätigung eines Angebots zum Auftrag automatisch hochgezählt.
                        </p>
                      </div>

                      {/* RECHNUNGSNUMMER (GESCHÜTZT MIT FREISCHALTUNG) */}
                      <div className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        isInvoiceNumberUnlocked 
                          ? 'bg-bg-dark border-primary/50 shadow-md shadow-primary/5' 
                          : 'bg-bg-dark/70 border-structure'
                      }`}>
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-sm font-medium text-text-main flex items-center gap-1.5">
                              <span>Nächste Rechnungsnummer</span>
                              {!isInvoiceNumberUnlocked && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-structure text-text-muted border border-structure font-normal">
                                  🔒 Geschützt
                                </span>
                              )}
                            </label>
                            <button
                              type="button"
                              onClick={() => setIsInvoiceNumberUnlocked(prev => !prev)}
                              className="text-xs text-primary hover:underline font-medium"
                            >
                              {isInvoiceNumberUnlocked ? '✓ Sperren' : '✏️ Anpassen'}
                            </button>
                          </div>
                          <p className="text-xs text-text-muted mb-2">
                            {isInvoiceNumberUnlocked 
                              ? 'Freigeschaltet: Gib deine gewünschte Start-Rechnungsnummer ein (z.B. 41 oder 56).' 
                              : 'Gegen versehentliches Ändern gesperrt. Klicke „Anpassen“ zum Bearbeiten.'}
                          </p>
                          <input 
                            type="number" 
                            min="1"
                            disabled={!isInvoiceNumberUnlocked}
                            value={settings.nextInvoiceNumber ?? 1} 
                            onChange={e => handleChange('nextInvoiceNumber', Math.max(1, parseInt(e.target.value, 10) || 1))} 
                            className={`input-field w-full font-mono text-base font-semibold ${
                              !isInvoiceNumberUnlocked 
                                ? 'bg-bg-panel/40 border-dashed text-text-muted cursor-not-allowed opacity-75' 
                                : 'bg-bg-panel border-primary ring-1 ring-primary/40'
                            }`} 
                          />
                        </div>

                        {isInvoiceNumberUnlocked ? (
                          <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-500 flex items-start gap-1.5">
                            <span className="text-xs">⚠️</span>
                            <span>Startnummer angepasst: Bitte unbedingt oben rechts auf <strong>„Speichern“</strong> klicken.</span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-text-muted mt-3">
                            Klicke oben auf <span className="text-primary font-medium">„Anpassen“</span>, falls du z.B. bei Rechnung 41 oder 56 starten möchtest.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* DEVELOPER BEREICH */}
                  {profile?.role === 'admin' && (
                    <div className="mt-8 border-t border-red-500/20 pt-6">
                      <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                        <h3 className="text-lg font-bold text-red-400 mb-2 flex items-center gap-2">
                          <ExclamationTriangleIcon className="w-5 h-5" />
                          Entwickler-Bereich
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
          
          {/* TAB: Leistungskatalog */}
          {activeTab === 'leistungen' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center border-b border-structure pb-2 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-text-main">Leistungskatalog</h2>
                  <p className="text-sm text-text-muted">Verwalte Kategorien, Standard-Services und Preise für Angebote.</p>
                </div>
                <button onClick={addCategory} className="btn-secondary text-xs py-2 px-3 flex items-center gap-1">
                  + Neue Kategorie
                </button>
              </div>

              {/* Standardpreise für Umzugskartons & Packmaterial */}
              <div className="bg-bg-dark border border-structure p-5 rounded-2xl space-y-4 shadow-sm">
                <div className="flex items-center gap-2.5 border-b border-structure/70 pb-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-text-main text-base">Standardpreise: Umzugskartons & Packmaterial</h3>
                    <p className="text-xs text-text-muted">Diese Standard-Stückpreise (Netto) werden beim Hinzufügen von Umzugskartons im Angebot-Editor vorausgefüllt.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-1">
                  {[
                    { key: 's', label: 'Umzugskarton S', sub: 'Klein (Bücher / Schwergut)', def: 2.50 },
                    { key: 'm', label: 'Umzugskarton M', sub: 'Standard (Allzweck)', def: 3.20 },
                    { key: 'l', label: 'Umzugskarton L', sub: 'Groß (Geschirr / Wäsche)', def: 3.80 },
                    { key: 'xl', label: 'Umzugskarton XL', sub: 'Extra groß (Leichtes Volumen)', def: 4.50 },
                    { key: 'buecher', label: 'Bücherkarton', sub: 'Verstärkter Doppelboden', def: 3.00 },
                    { key: 'kleider', label: 'Kleiderkarton', sub: 'Inkl. Metall-Kleiderstange', def: 12.00 },
                  ].map(k => (
                    <div key={k.key} className="bg-bg-panel p-3.5 rounded-xl border border-structure/60 space-y-2 hover:border-amber-500/40 transition-colors">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-text-main">{k.label}</span>
                        <span className="text-[10px] text-text-muted font-medium bg-white/[0.04] px-1.5 py-0.5 rounded">pro Stk.</span>
                      </div>
                      <p className="text-[10px] text-text-muted line-clamp-1">{k.sub}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="number"
                          step="0.10"
                          min="0"
                          value={settings.kartonPrices?.[k.key] ?? k.def}
                          onChange={e => {
                            const val = parseFloat(e.target.value) || 0;
                            setSettings((prev: any) => ({
                              ...prev,
                              kartonPrices: {
                                ...(prev.kartonPrices || {}),
                                [k.key]: val
                              }
                            }));
                          }}
                          className="input-field text-sm font-bold w-full text-right font-mono"
                        />
                        <span className="text-text-muted text-sm font-semibold">€</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Werbeblock & Service-Portfolio für Angebote (Seite 2) */}
              <div className="bg-bg-dark border border-structure p-5 rounded-2xl space-y-5 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-structure/70 pb-3 gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <span className="material-symbols-outlined text-xl">featured_seasonal_and_gifts</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-text-main text-base">Werbeblock & Service-Portfolio für Angebote (Seite 2)</h3>
                      <p className="text-xs text-text-muted">
                        Wählen Sie aus, welche Zusatzleistungen als dezente Badges auf Seite 2 Ihrer Angebote angezeigt werden sollen.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetShowcaseServices}
                      className="text-xs text-text-muted hover:text-text-main hover:underline px-2 py-1 cursor-pointer"
                      title="Auf Standard-Leistungen zurücksetzen"
                    >
                      Standard wiederherstellen
                    </button>
                    <button
                      type="button"
                      onClick={addShowcaseService}
                      className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      + Service hinzufügen
                    </button>
                  </div>
                </div>

                {/* Header, Subtitle & Disclaimer Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-bg-panel p-3.5 rounded-xl border border-structure/50">
                  <div>
                    <label className="text-[11px] font-bold text-text-muted block mb-1">Überschrift des Werbeblocks</label>
                    <input
                      type="text"
                      value={settings.showcaseTexts?.title ?? DEFAULT_SHOWCASE_TEXTS.title}
                      onChange={e => setSettings((prev: any) => ({
                        ...prev,
                        showcaseTexts: { ...(prev.showcaseTexts || {}), title: e.target.value }
                      }))}
                      className="input-field text-xs w-full font-semibold"
                      placeholder="Unser erweitertes Full-Service Angebot auf Wunsch"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-text-muted block mb-1">Untertitel / Hinweis</label>
                    <input
                      type="text"
                      value={settings.showcaseTexts?.subtitle ?? DEFAULT_SHOWCASE_TEXTS.subtitle}
                      onChange={e => setSettings((prev: any) => ({
                        ...prev,
                        showcaseTexts: { ...(prev.showcaseTexts || {}), subtitle: e.target.value }
                      }))}
                      className="input-field text-xs w-full"
                      placeholder="Jederzeit flexibel zubuchbar • Sprechen Sie uns gerne an"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-[11px] font-bold text-text-muted block mb-1">Vertraglicher Disclaimer (Fußnote zum Schutz vor Missverständnissen)</label>
                    <input
                      type="text"
                      value={settings.showcaseTexts?.disclaimer ?? DEFAULT_SHOWCASE_TEXTS.disclaimer}
                      onChange={e => setSettings((prev: any) => ({
                        ...prev,
                        showcaseTexts: { ...(prev.showcaseTexts || {}), disclaimer: e.target.value }
                      }))}
                      className="input-field text-xs w-full text-text-muted italic"
                      placeholder="* Hinweis: Der vertragliche Leistungsumfang..."
                    />
                  </div>
                </div>

                {/* Services List with Toggles, Icon Selectors and Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {(settings.showcaseServices || DEFAULT_SHOWCASE_SERVICES).map((srv: ShowcaseServiceItem, idx: number) => {
                    const isEnabled = srv.enabled !== false;
                    const currentIconMeta = AVAILABLE_SHOWCASE_ICONS.find(i => i.id === srv.icon) || AVAILABLE_SHOWCASE_ICONS[0];

                    return (
                      <div
                        key={srv.id || idx}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all ${
                          isEnabled
                            ? 'bg-bg-panel border-primary/30 shadow-sm'
                            : 'bg-bg-panel/40 border-structure/40 opacity-60'
                        }`}
                      >
                        {/* Toggle Button */}
                        <button
                          type="button"
                          onClick={() => toggleShowcaseService(idx)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                            isEnabled ? 'bg-primary text-white' : 'bg-white/5 text-text-muted border border-structure'
                          }`}
                          title={isEnabled ? 'Aktiv (Wird im Angebot angezeigt)' : 'Deaktiviert (Ausgeblendet)'}
                        >
                          <span className="material-symbols-outlined text-base">
                            {isEnabled ? 'check' : 'close'}
                          </span>
                        </button>

                        {/* Icon Picker */}
                        <div className="relative shrink-0 w-8 h-8">
                          <select
                            value={srv.icon}
                            onChange={e => updateShowcaseService(idx, 'icon', e.target.value)}
                            className="w-full h-full rounded-lg bg-bg-dark border border-structure text-transparent appearance-none cursor-pointer p-0"
                            title="Symbol auswählen"
                          >
                            {AVAILABLE_SHOWCASE_ICONS.map(ic => (
                              <option key={ic.id} value={ic.id} className="text-text-main bg-bg-panel">
                                {ic.label}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined text-sm">
                              {currentIconMeta.iconName}
                            </span>
                          </div>
                        </div>

                        {/* Service Name Input */}
                        <input
                          type="text"
                          value={srv.name}
                          onChange={e => updateShowcaseService(idx, 'name', e.target.value)}
                          className="input-field text-xs flex-1 py-1 px-2 font-medium"
                          placeholder="Service-Bezeichnung"
                        />

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => removeShowcaseService(idx)}
                          className="text-text-muted hover:text-red-400 p-1 rounded transition-colors text-base leading-none cursor-pointer"
                          title="Service entfernen"
                        >
                          &times;
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 text-xs text-text-muted bg-white/[0.02] p-2.5 rounded-lg border border-structure/40">
                  <span className="material-symbols-outlined text-sm text-primary">info</span>
                  <span>
                    <strong>Tipp:</strong> Im Angebot-Editor (Schritt 5) können Sie für einzelne Angebote bei Bedarf Services mit einem Klick abwählen oder hinzufügen (z. B. <em>Endreinigung</em> zuschalten oder <em>Küchenmontage</em> für Kunden ohne Küche deaktivieren).
                  </span>
                </div>
              </div>
              
              {/* Feste Kernleistungen Block */}
              {(() => {
                const fixedDefs = resolveFixedDefs(settings);
                return (
                  <div className="bg-bg-dark border border-structure p-5 rounded-2xl shadow-sm space-y-4">
                    <div className="border-b border-structure/60 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">verified</span>
                        <h3 className="text-base font-bold text-text-main">Feste Kernleistungen</h3>
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        Diese vier Leistungen erkennt das Programm an einem festen internen Schlüssel. Du kannst Name, Preis, Einheit und Beschreibung frei ändern.
                      </p>
                    </div>

                    <div className="space-y-3">
                      {FIXED_KEYS.map(key => {
                        const def = fixedDefs[key];
                        const cur = settings.fixedServices?.[key] || {};
                        const priceVal = cur.price !== undefined ? cur.price : (key === 'hvz' && settings.fixedPrices?.hvz !== undefined ? settings.fixedPrices.hvz : def.price);
                        return (
                          <div key={key} className="p-3.5 rounded-xl bg-bg-panel border border-structure/50 space-y-2">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="material-symbols-outlined text-primary text-lg shrink-0">{def.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <label className="text-[10px] uppercase font-bold text-text-muted block">
                                    Name ({key}) {key === 'hvz' && <span className="text-primary font-normal">· Preis für beide Adressen (bei einer Adresse die Hälfte)</span>}
                                  </label>
                                  <input
                                    type="text"
                                    value={cur.name !== undefined ? cur.name : def.name}
                                    onChange={e => setSettings({
                                      ...settings,
                                      fixedServices: {
                                        ...(settings.fixedServices || {}),
                                        [key]: { ...(settings.fixedServices?.[key] || {}), name: e.target.value }
                                      }
                                    })}
                                    className="input-field text-xs font-bold w-full py-1 mt-0.5"
                                    placeholder={def.name}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    value={priceVal === '' ? '' : priceVal}
                                    onChange={e => {
                                      const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                      setSettings({
                                        ...settings,
                                        fixedServices: {
                                          ...(settings.fixedServices || {}),
                                          [key]: { ...(settings.fixedServices?.[key] || {}), price: val }
                                        }
                                      });
                                    }}
                                    className="input-field text-xs w-24 text-right py-1"
                                    placeholder="0.00"
                                  />
                                  <span className="text-text-muted text-xs">€</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={cur.unit !== undefined ? cur.unit : def.unit}
                                    onChange={e => setSettings({
                                      ...settings,
                                      fixedServices: {
                                        ...(settings.fixedServices || {}),
                                        [key]: { ...(settings.fixedServices?.[key] || {}), unit: e.target.value }
                                      }
                                    })}
                                    className="input-field text-xs w-20 text-center py-1"
                                    placeholder="Einheit"
                                  />
                                </div>
                              </div>
                            </div>
                            <div>
                              <input
                                type="text"
                                value={cur.desc !== undefined ? cur.desc : def.desc}
                                onChange={e => setSettings({
                                  ...settings,
                                  fixedServices: {
                                    ...(settings.fixedServices || {}),
                                    [key]: { ...(settings.fixedServices?.[key] || {}), desc: e.target.value }
                                  }
                                })}
                                className="input-field text-xs text-text-muted w-full py-1"
                                placeholder="Beschreibung / Hinweistext..."
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
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
          )}

          {/* TAB: Zahlungsarten */}
          {activeTab === 'zahlungsarten' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-structure pb-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-text-main">Zahlungsarten</h2>
                  <p className="text-sm text-text-muted">Texte, Fälligkeiten und Standard-Zahlungsart für neue Angebote & Rechnungen verwalten.</p>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  <button
                    type="button"
                    onClick={loadSamplePaymentMethods}
                    className="btn-secondary py-2 px-3.5 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs hover:border-primary/50 transition-all"
                    title="Standard-Zahlungsarten (Überweisung, Barzahlung, Echtzeit-Überweisung) wiederherstellen"
                  >
                    <ArrowPathIcon className="w-4 h-4 text-primary" />
                    <span>Standard laden</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const newPms = [
                        ...(settings.paymentMethods || []),
                        {
                          name: 'Neue Zahlungsart',
                          textQuote: 'Wir bitten Sie höflich, den Rechnungsbetrag nach Abschluss des Umzugs zu begleichen.',
                          textInvoice: 'Der Rechnungsbetrag ist ohne Abzug fällig. Vielen Dank für Ihre Zahlung!',
                          shortText: 'Individuell',
                          dueDays: 0,
                          isDefault: false
                        }
                      ];
                      handleChange('paymentMethods', newPms);
                      toast.success('Neue Zahlungsart hinzugefügt!');
                    }}
                    className="btn-primary py-2 px-4 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>+ Neue Zahlungsart</span>
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {(settings.paymentMethods || []).map((pm: any, idx: number) => (
                  <div key={idx} className="bg-bg-dark border border-structure p-4 md:p-6 rounded-xl space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-structure/60 pb-3 gap-3 flex-wrap">
                      <div className="font-bold text-text-main text-lg flex items-center gap-2 flex-1 min-w-[240px]">
                        <CreditCardIcon className="w-5 h-5 text-primary shrink-0" />
                        <input
                          type="text"
                          value={pm.name}
                          onChange={e => {
                            const newPms = [...settings.paymentMethods];
                            newPms[idx] = { ...newPms[idx], name: e.target.value };
                            handleChange('paymentMethods', newPms);
                          }}
                          className="font-bold text-text-main text-base bg-transparent border-b border-dashed border-structure focus:border-primary outline-none px-1 py-0.5 w-full max-w-sm"
                          placeholder="Name der Zahlungsart..."
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {pm.isDefault || idx === 0 ? (
                          <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1 shadow-2xs">
                            <StarIcon className="w-3.5 h-3.5 fill-emerald-500 text-emerald-500" />
                            <span>Standard</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDefaultPaymentMethod(idx)}
                            className="text-xs px-3 py-1 rounded-full bg-slate-100 hover:bg-amber-500/15 dark:bg-slate-800 text-slate-600 hover:text-amber-700 dark:text-slate-300 dark:hover:text-amber-300 border border-slate-200 dark:border-slate-700 hover:border-amber-500/30 transition-all flex items-center gap-1 cursor-pointer font-semibold shadow-2xs"
                            title="Diese Zahlungsart als Standard für neue Angebote und Rechnungen festlegen"
                          >
                            <StarIcon className="w-3.5 h-3.5 text-amber-500" />
                            <span>Als Standard festlegen</span>
                          </button>
                        )}
                        {settings.paymentMethods.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Zahlungsart "${pm.name}" wirklich löschen?`)) {
                                const newPms = settings.paymentMethods.filter((_: any, i: number) => i !== idx);
                                if (pm.isDefault && newPms[0]) {
                                  newPms[0].isDefault = true;
                                }
                                handleChange('paymentMethods', newPms);
                                toast.success(`Zahlungsart "${pm.name}" entfernt.`);
                              }
                            }}
                            className="p-1.5 text-text-muted hover:text-red-500 rounded-lg hover:bg-structure/40 transition-colors cursor-pointer"
                            title="Zahlungsart löschen"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1.5">Text für Angebot (Quote)</label>
                        <textarea 
                          value={pm.textQuote} 
                          onChange={e => {
                            const newPms = [...settings.paymentMethods];
                            newPms[idx] = { ...newPms[idx], textQuote: e.target.value };
                            handleChange('paymentMethods', newPms);
                          }}
                          className="input-field w-full h-24 text-xs bg-bg-panel focus:bg-bg-dark transition-colors" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1.5">Text für Rechnung (Invoice)</label>
                        <textarea 
                          value={pm.textInvoice} 
                          onChange={e => {
                            const newPms = [...settings.paymentMethods];
                            newPms[idx] = { ...newPms[idx], textInvoice: e.target.value };
                            handleChange('paymentMethods', newPms);
                          }}
                          className="input-field w-full h-24 text-xs bg-bg-panel focus:bg-bg-dark transition-colors" 
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-structure/40">
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Zahlungsziel (Kurztext)</label>
                        <input 
                          type="text" 
                          value={pm.shortText} 
                          onChange={e => {
                            const newPms = [...settings.paymentMethods];
                            newPms[idx] = { ...newPms[idx], shortText: e.target.value };
                            handleChange('paymentMethods', newPms);
                          }}
                          className="input-field text-sm w-full bg-bg-panel" 
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-text-muted mb-1">Tage bis Fälligkeit</label>
                        <input 
                          type="number" 
                          value={pm.dueDays} 
                          onChange={e => {
                            const newPms = [...settings.paymentMethods];
                            newPms[idx] = { ...newPms[idx], dueDays: parseInt(e.target.value, 10) || 0 };
                            handleChange('paymentMethods', newPms);
                          }}
                          className="input-field text-sm w-full bg-bg-panel" 
                        />
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
