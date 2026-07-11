"use client";
import { useState, useMemo } from 'react';
import { 
  QuestionMarkCircleIcon, 
  MagnifyingGlassIcon, 
  XMarkIcon,
  HomeIcon,
  CalendarDaysIcon,
  UsersIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ShieldExclamationIcon,
  Cog6ToothIcon,
  Bars3Icon,
  PlusIcon,
  SunIcon,
  MoonIcon,
  ArrowRightOnRectangleIcon,
  ArrowUturnLeftIcon,
  TrashIcon,
  BellIcon,
  TruckIcon
} from '@heroicons/react/24/outline';

interface ManualItem {
  name: string;
  action: string;
  category: string;
  details: string;
  icon: any;
}

const categories = [
  { id: 'all', name: 'Alle Tasten/Buttons', icon: QuestionMarkCircleIcon },
  { id: 'general', name: 'Header & Navigation', icon: Bars3Icon },
  { id: 'dashboard', name: 'Zentrale Disposition', icon: HomeIcon },
  { id: 'calendar', name: 'Einsatzplanung (Kalender)', icon: CalendarDaysIcon },
  { id: 'customers', name: 'Kunden-Center & Profil', icon: UsersIcon },
  { id: 'orders', name: 'Angebotserstellung (Wizard)', icon: DocumentTextIcon },
  { id: 'finances', name: 'Finanzen & Rechnungen', icon: BanknotesIcon },
  { id: 'claims', name: 'Reklamationen (Schäden)', icon: ShieldExclamationIcon },
  { id: 'settings', name: 'Einstellungen & Archiv', icon: Cog6ToothIcon },
];

const manualItems: ManualItem[] = [
  // --- Header & Navigation ---
  {
    name: "Menü-Schaltfläche (Burgermenü)",
    category: "general",
    action: "Öffnet oder schließt die mobile Navigationsleiste auf Smartphones und Tablets.",
    details: "Nur auf Mobilgeräten sichtbar. Steuert die Sichtbarkeit der Sidebar-Links.",
    icon: Bars3Icon
  },
  {
    name: "„Neues Angebot“-Schaltfläche (`+ Neues Angebot`)",
    category: "general",
    action: "Leitet den Benutzer direkt zum mehrstufigen Angebotserstellungs-Assistenten (Wizard) weiter.",
    details: "Im Header und in den Kundenlisten verfügbar. Startet die Neukunden- und Projektanlage.",
    icon: PlusIcon
  },
  {
    name: "Anti-Vergess-System (Glocken-Symbol)",
    category: "general",
    action: "Öffnet ein Dropdown-Menü mit automatischen, dringlichkeitsbasierten Alarmen.",
    details: "Alarme für abgelaufene Angebote, fehlende Rechnungen nach Umzügen, fehlende Helfer, fehlende Fahrzeuge oder nicht bestellte Halteverbotszonen.",
    icon: BellIcon
  },
  {
    name: "Design-Umschalter (Sonne / Mond)",
    category: "general",
    action: "Wechselt das visuelle Erscheinungsbild der App in Echtzeit zwischen Hellem und Dunklem Design.",
    details: "Passt die gesamte Farbstruktur (Light Mode / Dark Mode) augenblicklich an.",
    icon: SunIcon
  },
  {
    name: "Abmelden-Schaltfläche (Tür-mit-Pfeil-Symbol)",
    category: "general",
    action: "Meldet den aktuellen Benutzer sicher vom Firebase-Konto ab und leitet ihn zum Login-Bildschirm zurück.",
    details: "Beendet die aktive Sitzung und schützt das System vor unbefugtem Zugriff.",
    icon: ArrowRightOnRectangleIcon
  },

  // --- Dashboard (Zentrale Disposition) ---
  {
    name: "Tab-Schaltfläche „Kunden-Status“",
    category: "dashboard",
    action: "Aktiviert die Kanban-Ansicht der Kunden-Pipeline auf dem Dashboard.",
    details: "Zeigt alle Aufträge aufgeteilt in Entwürfe, Angebote, bestätigte Umzüge und Abrechnung.",
    icon: HomeIcon
  },
  {
    name: "Tab-Schaltfläche „Logistik-Aufgaben & To-Dos“",
    category: "dashboard",
    action: "Wechselt zur logistischen To-Do-Liste (z.B. Kartonlieferung, Halteverbote).",
    details: "Zeigt einen Live-Zähler mit der Anzahl der noch offenen Logistik-Aufgaben an.",
    icon: BellIcon
  },
  {
    name: "Kanban-Karte (Drag & Drop)",
    category: "dashboard",
    action: "Verschieben einer Karte in eine andere Spalte ändert automatisch den Auftragsstatus in der Datenbank.",
    details: "Ändert den Status beispielsweise von 'Entwurf' zu 'Angebot erstellt' oder 'Bestätigt'.",
    icon: TruckIcon
  },
  {
    name: "Klick auf Kanban-Karte",
    category: "dashboard",
    action: "Öffnet ein Schnell-Popup-Modal mit detaillierten Teilaufgaben und Terminen dieses Kunden.",
    details: "Ermöglicht schnelles Arbeiten ohne Verlassen des Dashboards.",
    icon: HomeIcon
  },
  {
    name: "Schaltfläche „Erledigen / Erledigt“ (Häkchen-Knopf)",
    category: "dashboard",
    action: "Markiert eine logistische Aufgabe manuell als erledigt.",
    details: "Bereits erledigte Aufgaben werden grün dargestellt und sind ausgegraut.",
    icon: HomeIcon
  },
  {
    name: "Schaltfläche „Los“ (To-Do Popup)",
    category: "dashboard",
    action: "Springt direkt zum entsprechenden Formular oder Dokument, das für diese Aufgabe benötigt wird.",
    details: "Abkürzung zum Schreiben von Angeboten, Buchen von Möbelliften etc.",
    icon: PlusIcon
  },
  {
    name: "Schaltfläche „Zum Kunden“ (To-Do Popup)",
    category: "dashboard",
    action: "Öffnet das vollständige Kundenprofil.",
    details: "Leitet direkt auf die Detailseite des Kunden weiter.",
    icon: UsersIcon
  },

  // --- Kalender ---
  {
    name: "Pfeil-Schaltflächen (Links `<` / Rechts `>`)",
    category: "calendar",
    action: "Navigiert im Kalender einen Monat zurück oder vor.",
    details: "Aktualisiert die Monatsübersicht der geplanten Einsätze.",
    icon: CalendarDaysIcon
  },
  {
    name: "Kalender Event: Orange (Umzug)",
    category: "calendar",
    action: "Zeigt einen bestätigten Umzugstermin an. Ein Klick öffnet das Dispositions-Modal.",
    details: "Zur schnellen visuellen Erfassung aller operativen Haupttermine.",
    icon: TruckIcon
  },
  {
    name: "Kalender Event: Blau (Halteverbot)",
    category: "calendar",
    action: "Zeigt das Datum an, an dem die Halteverbotszone eingerichtet sein muss.",
    details: "Soll: 7 Tage vor dem Umzug oder am Tag der Zusage bei Kurzfristigkeit.",
    icon: CalendarDaysIcon
  },
  {
    name: "Kalender Event: Gelb (Kartons)",
    category: "calendar",
    action: "Zeigt das Lieferdatum für Umzugskartons beim Kunden.",
    details: "Soll: 10 Tage vor dem Umzug oder nach Absprache.",
    icon: CalendarDaysIcon
  },
  {
    name: "Kalender Event: Lila (Möbellift)",
    category: "calendar",
    action: "Zeigt die Reservierung und den Einsatzzeitraum eines Möbellifts an.",
    details: "Wichtig für die Fahrzeugdisposition.",
    icon: TruckIcon
  },
  {
    name: "Kalender Event: Grün (Besichtigung)",
    category: "calendar",
    action: "Zeigt ein geplantes Vor-Ort- oder Video-Besichtigungsgespräch beim Kunden.",
    details: "Hilft bei der rechtzeitigen Angebotserstellung.",
    icon: CalendarDaysIcon
  },
  {
    name: "Dispo-Modal „Speichern“-Schaltfläche",
    category: "calendar",
    action: "Sichert die Zuteilung von Fahrzeugen (LKWs) und Mitarbeitern (Teamleiter, Helfer).",
    details: "Aktualisiert die Datenbank und trägt die Namen der Mitarbeiter im Kalender ein.",
    icon: TruckIcon
  },

  // --- Kunden-Center & Profile ---
  {
    name: "Eingabefeld „Suche“",
    category: "customers",
    action: "Filtert Kundenlisten in Echtzeit nach Name, Stadt oder Telefonnummer.",
    details: "Erfordert kein Absenden; filtert sofort während der Eingabe (Zero-Cost Firebase-Query).",
    icon: MagnifyingGlassIcon
  },
  {
    name: "Schaltfläche „X“ (im Suchfeld)",
    category: "customers",
    action: "Löscht den aktuellen Suchbegriff und zeigt wieder alle Kunden an.",
    details: "Ermöglicht das schnelle Zurücksetzen von Filtern.",
    icon: XMarkIcon
  },
  {
    name: "Stift-Symbol („Kundendaten bearbeiten“)",
    category: "customers",
    action: "Schaltet die Kundenstammdaten (Adresse, E-Mail, Telefon) auf der Profilseite zum Bearbeiten frei.",
    details: "Aktiviert Eingabefelder.",
    icon: UsersIcon
  },
  {
    name: "Schaltfläche „Speichern“ (Stammdaten-Modus)",
    category: "customers",
    action: "Speichert die geänderten Kundenstammdaten dauerhaft in der Firebase-Datenbank.",
    details: "Aktualisiert die Kontaktdaten in allen verknüpften Aufträgen.",
    icon: UsersIcon
  },
  {
    name: "Schaltfläche „Neue freie Rechnung“ (Dokument-Plus)",
    category: "customers",
    action: "Erstellt eine manuelle Rechnung, die an kein Umzugsprojekt gekoppelt ist.",
    details: "Ideal für Zusatzverkäufe (z.B. Kartons, Verpackungsmaterial oder Entsorgungen).",
    icon: PlusIcon
  },
  {
    name: "Chevron-Schaltflächen (Auf-/Zuklappen)",
    category: "customers",
    action: "Blendet Details eines Angebots oder einer Rechnung in der Kundenhistorie ein bzw. aus.",
    details: "Hält die Kundenprofilseite übersichtlich und kompakt.",
    icon: QuestionMarkCircleIcon
  },
  {
    name: "Zahnrad-Schaltfläche (Aktions-Dropdown)",
    category: "customers",
    action: "Öffnet das Funktionsmenü des ausgewählten Auftrags (Bearbeiten, Signatur, Dispo, Rechnung, Storno).",
    details: "Der zentrale Einstiegspunkt für alle Aktionen an einem Auftrag.",
    icon: Cog6ToothIcon
  },
  {
    name: "Aktion „Digitale Signatur“ (im Dropdown)",
    category: "customers",
    action: "Öffnet das Unterschriftenfeld für den Kunden zur sofortigen Freigabe.",
    details: "Der Kunde kann mit dem Finger oder der Maus direkt auf dem Bildschirm unterschreiben.",
    icon: UsersIcon
  },
  {
    name: "Aktion „Rechnung generieren“ (im Dropdown)",
    category: "customers",
    action: "Erstellt einen bearbeitbaren Rechnungsentwurf basierend auf den Auftragsdaten.",
    details: "Leitet direkt zur Rechnungs-Vorbereitungsseite weiter.",
    icon: BanknotesIcon
  },
  {
    name: "Aktion „Rechnung stornieren“ (im Dropdown)",
    category: "customers",
    action: "Storniert die ausgestellte Rechnung und erzeugt einen Stornobeleg (Gutschrift).",
    details: "Rechnungen mit Nummern dürfen aus gesetzlichen Gründen nicht gelöscht, sondern nur storniert werden.",
    icon: TrashIcon
  },
  {
    name: "Aktion „Zahlung verwalten“ (im Dropdown)",
    category: "customers",
    action: "Öffnet den Zahlungs-Manager zum Verbuchen von Anzahlungen, Barzahlungen oder Überweisungen.",
    details: "Ermöglicht auch die Verrechnung von Storno-Guthaben.",
    icon: BanknotesIcon
  },
  {
    name: "Aktion „Auftrag löschen“ (im Dropdown)",
    category: "customers",
    action: "Entfernt den Auftrag dauerhaft aus der Datenbank.",
    details: "Nur möglich, wenn noch keine Rechnungen für den Auftrag ausgestellt wurden.",
    icon: TrashIcon
  },

  // --- Angebotserstellung (Wizard) ---
  {
    name: "Stepper-Navigationspunkte (Schritt 1 - 5)",
    category: "orders",
    action: "Erlaubt das direkte Springen zu den verschiedenen Abschnitten der Angebotserstellung.",
    details: "1. Kunde & Termine, 2. Logistik & Route, 3. Leistungen & Finanzen, 4. Inventar & Checkliste, 5. Abschluss & Dokumente.",
    icon: DocumentTextIcon
  },
  {
    name: "Schaltfläche „Route berechnen“ (Schritt 2)",
    category: "orders",
    action: "Berechnet automatisch die Fahrstrecke (km) und Fahrtzeit (Minuten) zwischen Auszugs- und Einzugsadresse.",
    details: "Nutzt eine Schnittstelle zur präzisen Ermittlung der Fahrtstrecke.",
    icon: TruckIcon
  },
  {
    name: "Schalter „Pauschalpreis“ (Schritt 3)",
    category: "orders",
    action: "Deaktiviert den Stundentarif und ermöglicht die Eingabe eines fixen Gesamtpreises.",
    details: "Nützlich für Festpreis-Angebote.",
    icon: DocumentTextIcon
  },
  {
    name: "Schaltfläche „Leistung hinzufügen“ (Schritt 3)",
    category: "orders",
    action: "Fügt eine zusätzliche Serviceleistung (z. B. Montage, Küchenabbau) aus dem Stammkatalog hinzu.",
    details: "Berechnet den Gesamtpreis automatisch neu.",
    icon: PlusIcon
  },
  {
    name: "Schaltfläche „Inventar-Assistent öffnen“ (Schritt 4)",
    category: "orders",
    action: "Öffnet das visuelle Tool zur Klick-Erfassung von Möbeln pro Zimmer.",
    details: "Ermöglicht die bequeme Eingabe von Umzugskartons, Tischen, Betten zur Ladevolumen-Ermittlung (cbm).",
    icon: DocumentTextIcon
  },
  {
    name: "Schaltfläche „Speichern“ (Schritt 5)",
    category: "orders",
    action: "Sichert alle eingegebenen Daten und erzeugt das Angebot mit einer fortlaufenden Angebotsnummer.",
    details: "Schließt den Erstellungsprozess ab.",
    icon: DocumentTextIcon
  },

  // --- Finanzen ---
  {
    name: "Tab-Schaltflächen „Offen“ / „Alle Rechnungen“",
    category: "finances",
    action: "Filtert die Rechnungsliste nach unbezahlten (offenen) oder allen Belegen.",
    details: "Bietet schnellen Überblick über ausstehende Forderungen.",
    icon: BanknotesIcon
  },
  {
    name: "Abrechnungsmonat-Wähler (DATEV-Panel)",
    category: "finances",
    action: "Auswahl des Exportmonats für den Steuerberater.",
    details: "Filtert alle im gewählten Monat ausgestellten Rechnungen.",
    icon: CalendarDaysIcon
  },
  {
    name: "Schaltfläche „ZIP inkl. PDFs laden“ (DATEV-Panel)",
    category: "finances",
    action: "Erstellt PDFs aller Rechnungen des Monats und packt diese mit einer CSV-Datei in ein ZIP-Archiv.",
    details: "Kompletter Monatsabschluss zum direkten Weiterleiten an die Buchhaltung/DATEV.",
    icon: BanknotesIcon
  },
  {
    name: "Schaltfläche „Zahlung verbuchen“ (Zahlungs-Modal)",
    category: "finances",
    action: "Sichert die eingetragene Zahlung (Bar, Überweisung, PayPal, EC-Karte oder Guthaben) für eine Rechnung.",
    details: "Ändert bei vollständiger Bezahlung den Rechnungsstatus automatisch auf 'Bezahlt'.",
    icon: PlusIcon
  },
  {
    name: "Mülleimer-Symbol (Zahlungs-Modal)",
    category: "finances",
    action: "Storniert eine verbuchte Zahlung aus der Historie einer Rechnung.",
    details: "Erhöht den offenen Betrag wieder entsprechend.",
    icon: TrashIcon
  },

  // --- Reklamationen ---
  {
    name: "Status-Auswahl (Reklamationskarte)",
    category: "claims",
    action: "Ändert den Status der Reklamation (Neu Gemeldet, In Bearbeitung, An Versicherung, Erledigt).",
    details: "Verschiebt den Schadensfall auf dem Schadensboard.",
    icon: ShieldExclamationIcon
  },

  // --- Einstellungen & Archiv ---
  {
    name: "Schaltfläche „Restore“ (Archiv)",
    category: "settings",
    action: "Stellt einen archivierten Kunden oder einen gelöschten Auftrag wieder her.",
    details: "Der Datensatz erscheint wieder in den aktiven Listen des Systems.",
    icon: ArrowUturnLeftIcon
  },
  {
    name: "Schaltfläche „Löschen“ (Archiv - Mülleimer)",
    category: "settings",
    action: "Löscht den archivierten Datensatz endgültig und unwiderruflich aus der Datenbank.",
    details: "Dieser Vorgang kann niemals rückgängig gemacht werden.",
    icon: TrashIcon
  },
  {
    name: "Schaltfläche „Hinzufügen“ (Einstellungen)",
    category: "settings",
    action: "Speichert neue Optionen (Fahrzeuge, Mitarbeiter, Marketingquellen, etc.) in den Voreinstellungen.",
    details: "Macht die neuen Optionen in Dropdowns der App verfügbar.",
    icon: PlusIcon
  },
  {
    name: "Schaltfläche „System zurücksetzen“ (Einstellungen)",
    category: "settings",
    action: "Öffnet das Sicherheits-Löschfeld der App (Sicherheitsbegriff: LÖSCHEN).",
    details: "Löscht alle Datenbankinhalte (Kunden, Aufträge, Rechnungen) für Demozwecke.",
    icon: TrashIcon
  }
];

export default function ManualPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredItems = useMemo(() => {
    return manualItems.filter(item => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.details.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 relative">
      {/* Background Graphic */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center z-[-1] overflow-hidden">
        <img src="/login-logo.png" alt="" className="w-full max-w-[800px] object-contain blur-[2px]" />
      </div>

      {/* Header Panel */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-center z-10 relative">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-main flex items-center gap-3">
            <QuestionMarkCircleIcon className="w-8 h-8 text-primary" />
            Interaktives Manualbuch
          </h1>
          <p className="text-text-muted mt-1">Hier findest du die kurze Erklärung für jede Schaltfläche („Taste“) und Interaktion in der App.</p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-[350px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-text-muted" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 w-full"
            placeholder="Nach Tasten oder Funktionen suchen..."
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text-main"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Categories Grid Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {categories.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold transition-all text-left shadow-sm ${
                isActive 
                  ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' 
                  : 'bg-bg-panel border-structure text-text-muted hover:bg-structure hover:text-text-main'
              }`}
            >
              <cat.icon className="w-4 h-4 shrink-0" />
              <span>{cat.name}</span>
            </button>
          );
        })}
      </div>

      {/* Manual Items Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredItems.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl text-text-muted italic border border-white/5 md:col-span-2">
            Keine Schaltflächen oder Funktionen für diese Auswahl gefunden.
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <div key={idx} className="glass-panel p-6 flex gap-4 items-start hover:border-primary/50 transition-all group hover:-translate-y-0.5 duration-300">
              <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <item.icon className="w-6 h-6" />
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="font-bold text-text-main text-base group-hover:text-primary transition-colors">{item.name}</h3>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white/5 border border-white/5 text-text-muted shrink-0">
                    {categories.find(c => c.id === item.category)?.name.split(' ')[0]}
                  </span>
                </div>
                <p className="text-sm font-semibold text-text-main leading-relaxed">{item.action}</p>
                {item.details && (
                  <p className="text-xs text-text-muted leading-relaxed border-t border-structure/50 pt-2 mt-2">{item.details}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div className="panel border-t-2 border-t-primary/20 flex flex-col md:flex-row items-center justify-between gap-4">
        <span className="text-xs text-text-muted font-medium">Tipp: Du kannst das Manualbuch auch als Text-Dokument im Projektordner unter <code className="bg-white/5 px-1.5 py-0.5 rounded text-primary">Manualbuch.md</code> einsehen.</span>
        <a 
          href="/dashboard"
          className="text-xs font-bold text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
        >
          Zurück zur Disposition &rarr;
        </a>
      </div>
    </div>
  );
}
