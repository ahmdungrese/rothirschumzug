export interface ProtocolCategoryItem {
  id: string;
  name: string;
  text: string;
  isCompletion?: boolean;
  subtitle?: string;
}

export interface ProtocolSnippetItem {
  id?: string;
  label: string;
  text: string;
}

export const MASTER_PROTOCOL_CATEGORIES: ProtocolCategoryItem[] = [
  {
    id: 'cat1',
    name: 'Abnahme ohne Mängel (Abschluss)',
    text: 'Der Kunde bestätigt hiermit ausdrücklich, dass der Umzug und alle vereinbarten Leistungen vollständig, ordnungsgemäß und zu seiner vollsten Zufriedenheit durchgeführt wurden. Es sind keine Mängel oder Schäden an Möbeln, Umzugsgütern oder in den Räumlichkeiten (Treppenhaus, Wände, Böden) entstanden.',
    isCompletion: true,
    subtitle: 'Vollständig & mängelfrei (Phase 4 Abschluss)'
  },
  {
    id: 'cat2',
    name: 'Gefahrenübergang / Haftungsausschluss',
    text: 'Der Kunde bestätigt hiermit, dass der Transport/Umzug auf eigene Gefahr erfolgt (z.B. Engstelle im Treppenhaus / ungeeignete Maße / Demontage durch Kunden). Das Unternehmen übernimmt keine Haftung für entstandene Kratzer, Schäden oder Mängel an den betreffenden Gegenständen oder am Gebäude.',
    isCompletion: false,
    subtitle: 'Treppenhaus-Engstelle / Kundenrisiko'
  },
  {
    id: 'cat3',
    name: 'Mängel- & Schadensfeststellung',
    text: 'Folgende vorbestehende oder während der Arbeiten entstandene Mängel bzw. Schäden wurden vor Ort dokumentiert und vom Kunden bestätigt:\n1. \n2. \n',
    isCompletion: false,
    subtitle: 'Schäden vor Ort dokumentieren'
  },
  {
    id: 'cat4',
    name: 'Zählerstände & Schlüsselübergabe',
    text: 'Dokumentation der Zählerstände und Schlüssel:\nStromzähler: \nGaszähler: \nWasserzähler: \nAlle Schlüssel zur Wohnung vollständig übergeben: [Ja / Nein]',
    isCompletion: false,
    subtitle: 'Strom, Wasser, Gas & Schlüssel'
  },
  {
    id: 'cat5',
    name: 'Besichtigungsprotokoll (Vor-Ort / Video)',
    text: 'Vorab-Besichtigung und Feststellung des Umzugsvolumens sowie der Besonderheiten vor Ort (Stockwerk, Trageweg, Parkzone, Montageaufwand, Küchenzeile).',
    isCompletion: false,
    subtitle: 'Aufnahme vor Auftragserteilung'
  },
  {
    id: 'cat6',
    name: 'Sonstige Vereinbarung & Zusatzarbeiten',
    text: 'Folgende Zusatzvereinbarungen oder Mehrarbeiten wurden vor Ort einvernehmlich zwischen Umzugsleiter und Kunde vereinbart:\n- ',
    isCompletion: false,
    subtitle: 'Individuelle Vereinbarungen vor Ort'
  }
];

export const MASTER_PROTOCOL_SNIPPETS: ProtocolSnippetItem[] = [
  {
    label: 'Treppenhaus Engstelle (Kundenrisiko)',
    text: 'Transport durch enges Treppenhaus auf ausdrücklichen Wunsch des Kunden. Keine Haftung für Kratzer.'
  },
  {
    label: 'Vorbestehende Kratzer dokumentiert',
    text: 'Vorbestehende Beschädigungen (Kratzer/Gebrauchsspuren) bereits vor Verladung am Umzugsgut vorhanden.'
  },
  {
    label: 'Eigenmontage durch Kunden',
    text: 'Möbelmontage / Demontage erfolgt eigenständig durch den Kunden. Keine Haftung für Stabilität oder Folgeschäden.'
  },
  {
    label: 'Wohnungsabnahme mängelfrei',
    text: 'Die Räumlichkeiten der Auszugsadresse wurden besenrein und ohne Schäden an Wänden/Böden übergeben.'
  },
  {
    label: 'Halteverbotszone vorschriftsmäßig',
    text: 'Die Halteverbotszone wurde mit vorschriftsmäßigem zeitlichen Vorlauf ordnungsgemäß beschildert und dokumentiert.'
  },
  {
    label: 'Schlüsselübergabe erfolgt',
    text: 'Sämtliche Wohnungsschlüssel, Briefkastenschlüssel und Kellerschlüssel wurden vollständig übergeben.'
  }
];
