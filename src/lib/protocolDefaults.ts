export interface ProtocolSnippetItem {
  id?: string;
  label: string;
  text: string;
}

export interface ProtocolCategoryItem {
  id: string;
  name: string;
  text: string;
  isCompletion?: boolean;
  subtitle?: string;
  snippets?: ProtocolSnippetItem[];
}

export const MASTER_PROTOCOL_CATEGORIES: ProtocolCategoryItem[] = [
  {
    id: 'cat1',
    name: 'Abnahme ohne Mängel (Abschluss)',
    text: 'Der Kunde bestätigt hiermit ausdrücklich, dass der Umzug und alle vereinbarten Leistungen vollständig, ordnungsgemäß und zu seiner vollsten Zufriedenheit durchgeführt wurden. Es sind keine Mängel oder Schäden an Möbeln, Umzugsgütern oder in den Räumlichkeiten (Treppenhaus, Wände, Böden) entstanden.',
    isCompletion: true,
    subtitle: 'Vollständig & mängelfrei (Phase 4 Abschluss)',
    snippets: [
      {
        label: 'Räume & Treppenhaus mängelfrei',
        text: 'Die Räumlichkeiten sowie das Treppenhaus wurden besenrein und ohne Schäden an Wänden oder Böden übergeben.'
      },
      {
        label: 'Möbel vollständig & unbeschädigt',
        text: 'Alle Möbelstücke und Umzugsgüter wurden vollständig, ohne Beschädigungen und am gewünschten Stellplatz entladen.'
      },
      {
        label: 'Montagearbeiten voll funktionstüchtig',
        text: 'Sämtliche vereinbarten Montage- und Anschlussarbeiten wurden wunschgemäß und funktionstüchtig abgeschlossen.'
      },
      {
        label: 'Keine Beanstandungen / Reklamationen',
        text: 'Es bestehen seitens des Kunden keinerlei Beanstandungen, Reklamationen oder offene Punkte.'
      }
    ]
  },
  {
    id: 'cat2',
    name: 'Gefahrenübergang & Kundenrisiko (vor & während Umzug)',
    text: 'Der Kunde bestätigt hiermit ausdrücklich, dass folgende Arbeiten oder Transporte auf seine eigene Gefahr und Verantwortung durchgeführt werden:\n- ',
    isCompletion: false,
    subtitle: 'Regale, Aufzug, Engstellen & Kundenrisiko',
    snippets: [
      {
        label: 'Montage auf Kundenrisiko (Wand/Regal)',
        text: 'Montage/Aufhängung (z.B. Wandregal / Hängeschrank / instabile Bausubstanz) erfolgt auf ausdrücklichen Wunsch und auf eigenes Risiko des Kunden. Keine Haftung für Dübelhalt oder Mauerausbrüche.'
      },
      {
        label: 'Aufzugtransport auf Kundenrisiko (Kühlschrank)',
        text: 'Transport empfindlicher Großgeräte (z.B. Kühlschrank / Gefrierkombi / schwere Möbel) im Personenaufzug erfolgt auf ausdrücklichen Wunsch und Risiko des Auftraggebers bezüglich Maß- oder Gewichtsgrenzen.'
      },
      {
        label: 'Treppenhaus-Engstelle (Kundenrisiko)',
        text: 'Transport durch enges Treppenhaus auf ausdrücklichen Wunsch des Kunden. Keine Haftung für unvermeidbare Schrammen oder Kratzer an Wand oder Möbeln.'
      },
      {
        label: 'Geräte ohne Originalverpackung',
        text: 'Empfindliche Geräte (TV / Elektronik / Glas) ohne herstellerseitige Originalverpackung werden auf ausdrücklichen Kundenwunsch und eigenes Transportrisiko befördert.'
      },
      {
        label: 'Eigenmontage durch Kunden',
        text: 'Möbelmontage / Demontage erfolgt eigenständig durch den Kunden. Keine Haftung für Stabilität, Passgenauigkeit oder Folgeschäden.'
      },
      {
        label: 'Selbst gepackte Kartons',
        text: 'Kartonagen wurden eigenständig durch den Kunden gepackt und verschlossen. Keine Haftung für unzureichend gepolsterten Inhalt oder Bruchschäden.'
      }
    ]
  },
  {
    id: 'cat3',
    name: 'Vorbestehende Schäden (vor Verladung)',
    text: 'Folgende Beschädigungen, Gebrauchsspuren oder Vorbeschädigungen waren bereits vor Beginn der Arbeiten am Umzugsgut oder in den Räumlichkeiten vorhanden und wurden vorab dokumentiert:\n1. \n2. ',
    isCompletion: false,
    subtitle: 'Bereits vor Beginn vorhandene Mängel',
    snippets: [
      {
        label: 'Vorbestehende Kratzer / Dellen',
        text: 'Vorbestehende Beschädigungen (Kratzer, Absplitterungen, Gebrauchsspuren) bereits vor Beginn der Verladung am Möbelstück vorhanden.'
      },
      {
        label: 'Möbelstück vorbeschädigt / geleimt',
        text: 'Möbelstück wies bereits vor Demontage Vorschäden, lose Verbindungen oder Leimstellen auf.'
      },
      {
        label: 'Vorschäden im Treppenhaus',
        text: 'Bereits vor Einzug/Auszug bestehende Kratzer, Putzabrieb oder Flecken im Treppenhaus/Flur fotografisch dokumentiert.'
      },
      {
        label: 'Fotodokumentation vorab erstellt',
        text: 'Der vorgefundene Zustand wurde vor Arbeitsbeginn per Fotodokumentation festgehalten und vom Kunden bestätigt.'
      }
    ]
  },
  {
    id: 'cat4',
    name: 'Mängel- & Schadensfeststellung',
    text: 'Folgende während der Arbeiten entstandene Mängel bzw. Schäden wurden vor Ort dokumentiert und vom Kunden bestätigt:\n1. \n2. \n',
    isCompletion: false,
    subtitle: 'Schäden vor Ort dokumentieren',
    snippets: [
      {
        label: 'Transportschaden aufgenommen',
        text: 'Transportschaden vor Ort festgestellt, im Schadensprotokoll erfasst und fotografisch dokumentiert.'
      },
      {
        label: 'Wandabrieb / Kratzer im Treppenhaus',
        text: 'Leichter Abrieb / Kratzer an Treppenhauswand während des Transports entstanden. Dokumentation beigefügt.'
      },
      {
        label: 'Meldung an Versicherung',
        text: 'Der Schaden wird unverzüglich an die Betriebshaftpflicht- bzw. Transportversicherung zur Prüfung weitergeleitet.'
      },
      {
        label: 'Fotodokumentation angefertigt',
        text: 'Detaillierte Nah- und Übersichtsaufnahmen des Schadens wurden angefertigt und dem Vorgang beigefügt.'
      }
    ]
  },
  {
    id: 'cat5',
    name: 'Zählerstände & Schlüsselübergabe',
    text: 'Dokumentation der Zählerstände und Schlüssel:\nStromzähler: \nGaszähler: \nWasserzähler: \nAlle Schlüssel zur Wohnung vollständig übergeben: [Ja / Nein]',
    isCompletion: false,
    subtitle: 'Strom, Wasser, Gas & Schlüssel',
    snippets: [
      {
        label: 'Zählerstände fotografiert & notiert',
        text: 'Zählerstände für Strom, Gas und Wasser wurden im Beisein des Kunden abgelesen und fotografisch festgehalten.'
      },
      {
        label: 'Schlüssel vollständig übergeben',
        text: 'Sämtliche Wohnungsschlüssel, Briefkastenschlüssel und Kellerschlüssel wurden vollzählig übergeben.'
      },
      {
        label: 'Wohnung besenrein geräumt',
        text: 'Die Räumlichkeiten der Auszugsadresse wurden vollständig geräumt und besenrein übergeben.'
      }
    ]
  },
  {
    id: 'cat6',
    name: 'Besichtigungsprotokoll (Vor-Ort / Video)',
    text: 'Vorab-Besichtigung und Feststellung des Umzugsvolumens sowie der Besonderheiten vor Ort (Stockwerk, Trageweg, Parkzone, Montageaufwand, Küchenzeile).',
    isCompletion: false,
    subtitle: 'Aufnahme vor Auftragserteilung',
    snippets: [
      {
        label: 'Halteverbotszone zwingend erforderlich',
        text: 'Aufgrund der engen Parksituation ist die Einrichtung einer behördlichen Halteverbotszone zwingend erforderlich.'
      },
      {
        label: 'Möbellift erforderlich (enges Treppenhaus)',
        text: 'Einsatz eines Außen-Möbellifts wegen engen Treppenhauses und hoher Etage erforderlich.'
      },
      {
        label: 'Langer Trageweg über 30 Meter',
        text: 'Erhöhter Zeitaufwand aufgrund langen Tragewegs von Hauseingang zum LKW-Stellplatz (über 30 Meter).'
      },
      {
        label: 'Kein Aufzug / enge Zuwegung',
        text: 'Kein Personenaufzug vorhanden. Treppenhaustransport erforderlich.'
      }
    ]
  },
  {
    id: 'cat7',
    name: 'Sonstige Vereinbarung & Zusatzarbeiten',
    text: 'Folgende Zusatzvereinbarungen oder Mehrarbeiten wurden vor Ort einvernehmlich zwischen Umzugsleiter und Kunde vereinbart:\n- ',
    isCompletion: false,
    subtitle: 'Individuelle Vereinbarungen vor Ort',
    snippets: [
      {
        label: 'Zusätzliche Möbel / Mehrvolumen',
        text: 'Zusätzliche, im Ursprungsangebot nicht enthaltene Möbelstücke wurden nach Absprache mitgenommen.'
      },
      {
        label: 'Zusätzlicher Montageaufwand',
        text: 'Zusätzlicher Demontage- bzw. Montageaufwand wurde vor Ort nach Absprache durchgeführt.'
      },
      {
        label: 'Entsorgung / Sperrmüll vor Ort',
        text: 'Mitnahme von Sperrmüll / Altmöbeln zur fachgerechten Entsorgung vereinbart.'
      }
    ]
  }
];

export const MASTER_PROTOCOL_SNIPPETS: ProtocolSnippetItem[] = MASTER_PROTOCOL_CATEGORIES.flatMap(
  (c) => c.snippets || []
);

/**
 * Intelligent selector that returns tailored snippets for a specific category name
 */
export function getSnippetsForCategory(categoryName: string, allSnippetsFallback: ProtocolSnippetItem[] = MASTER_PROTOCOL_SNIPPETS): ProtocolSnippetItem[] {
  if (!categoryName) return allSnippetsFallback.slice(0, 6);
  const lower = categoryName.toLowerCase();

  const directCat = MASTER_PROTOCOL_CATEGORIES.find(c => c.name.toLowerCase() === lower);
  if (directCat && directCat.snippets && directCat.snippets.length > 0) {
    return directCat.snippets;
  }

  if (lower.includes('abschluss') || lower.includes('keine schäden') || lower.includes('ohne mängel') || lower.includes('mängelfrei')) {
    return MASTER_PROTOCOL_CATEGORIES[0].snippets || [];
  }
  if (lower.includes('gefahr') || lower.includes('haftung') || lower.includes('risiko') || lower.includes('regal') || lower.includes('aufzug')) {
    return MASTER_PROTOCOL_CATEGORIES[1].snippets || [];
  }
  if (lower.includes('vorbestehend') || lower.includes('vorschäden') || lower.includes('vor verladung') || lower.includes('vorab')) {
    return MASTER_PROTOCOL_CATEGORIES[2].snippets || [];
  }
  if (lower.includes('schaden') || lower.includes('mängel') || lower.includes('reklamation') || lower.includes('beschädigung')) {
    return MASTER_PROTOCOL_CATEGORIES[3].snippets || [];
  }
  if (lower.includes('zähler') || lower.includes('schlüssel') || lower.includes('strom') || lower.includes('wasser')) {
    return MASTER_PROTOCOL_CATEGORIES[4].snippets || [];
  }
  if (lower.includes('besichtigung')) {
    return MASTER_PROTOCOL_CATEGORIES[5].snippets || [];
  }

  // Fallback to Sonstige Vereinbarung
  return MASTER_PROTOCOL_CATEGORIES[6].snippets || allSnippetsFallback.slice(0, 6);
}
