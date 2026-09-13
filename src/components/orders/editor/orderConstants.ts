export const STANDARD_SERVICES_A = [
  { id: 'moebelabbau', name: 'Möbelabbau', price: 150, unit: 'pauschal', icon: 'tools_ladder', defaultDesc: 'Fachgerechter Abbau von Schränken, Betten und Regalen.' },
  { id: 'kueche_abbau', name: 'Abbau von Küche', price: 280, unit: 'pauschal', icon: 'countertops', defaultDesc: 'Abbau der Einbauküche inkl. Elektrogeräte und fachgerechte Trennung der Wasseranschlüsse.' },
  { id: 'packservice_ein', name: 'Einpackservice', price: 190, unit: 'pauschal', icon: 'inventory_2', defaultDesc: 'Einpacken des gesamten Hausrats in bereitgestellte Kartons inkl. Polstermaterial.' },
  { id: 'hvz_a', name: 'Halteverbot A', price: 95, unit: 'Zone', icon: 'signpost', defaultDesc: 'Einrichtung einer temporären Halteverbotszone (ca. 15m) an der Beladestelle inkl. behördlicher Genehmigung.' },
  { id: 'endreinigung', name: 'Endreinigung', price: 220, unit: 'pauschal', icon: 'cleaning_services', defaultDesc: 'Besenreine Endreinigung der Auszugsimmobilie.' }
];

export const STANDARD_SERVICES_B = [
  { id: 'moebelaufbau', name: 'Möbelaufbau', price: 180, unit: 'pauschal', icon: 'build', defaultDesc: 'Fachgerechter Aufbau aller Möbel in den Zielräumen.' },
  { id: 'kueche_aufbau', name: 'Aufbau von Küche', price: 320, unit: 'pauschal', icon: 'kitchen', defaultDesc: 'Aufbau der Küchenzeile, Hängeschränke und Montage der Arbeitsplatte.' },
  { id: 'packservice_aus', name: 'Auspackservice', price: 160, unit: 'pauschal', icon: 'unarchive', defaultDesc: 'Auspacken aller Kartons und Platzieren des Inhalts nach Kundenwunsch.' },
  { id: 'bohren', name: 'Bohr- & Dübelarb.', price: 90, unit: 'pauschal', icon: 'handyman', defaultDesc: 'Fachgerechte Montage und Befestigung von Lampen, Spiegeln und Gardinenstangen.' },
  { id: 'hvz_b', name: 'Halteverbot B', price: 95, unit: 'Zone', icon: 'signpost', defaultDesc: 'Einrichtung einer temporären Halteverbotszone (ca. 15m) an der Entladestelle inkl. behördlicher Genehmigung.' },
  { id: 'entsorgung', name: 'Müllentsorgung', price: 120, unit: 'pauschal', icon: 'delete', defaultDesc: 'Fachgerechte Entsorgung von Verpackungsmaterial und Restmüll.' }
];

export const STANDARD_SERVICES_FIXED = [
  { id: 'transport_lkw', name: 'Transport & LKW', price: 0, unit: 'pauschal', icon: 'local_shipping', defaultDesc: 'Bereitstellung von LKW, Fachpersonal und Transport der Güter.' },
  { id: 'basisschutz', name: 'Basisschutz & Versicherung', price: 0, unit: 'pauschal', icon: 'shield', defaultDesc: 'Gesetzliche Grundhaftung und Transportversicherung inklusive.' },
  { id: 'anfahrt', name: 'An- & Abfahrt', price: 0, unit: 'pauschal', icon: 'route', defaultDesc: 'Anfahrt zum Beladeort und Abfahrt vom Entladeort.' }
];

export const QUICK_FURNITURE = [
  { id: 'doppelbett', name: 'Doppelbett', cbm: 2.5, icon: 'single_bed', category: 'Betten', room: 'Schlafzimmer' },
  { id: 'schrank_2', name: 'Schrank (2türig)', cbm: 1.8, icon: 'door_sliding', category: 'Schränke', room: 'Schlafzimmer' },
  { id: 'esstisch', name: 'Esstisch', cbm: 0.9, icon: 'table_restaurant', category: 'Tische', room: 'Küche' },
  { id: 'karton', name: 'Umzugskarton', cbm: 0.15, icon: 'inventory_2', category: 'Kartons', room: 'Allgemein' },
  { id: 'sofa_3', name: '3er Sofa', cbm: 2.2, icon: 'chair', category: 'Sitzmöbel', room: 'Wohnzimmer' },
  { id: 'stuhl', name: 'Stuhl', cbm: 0.2, icon: 'chair_alt', category: 'Sitzmöbel', room: 'Wohnzimmer' },
  { id: 'regal', name: 'Bücherregal', cbm: 0.6, icon: 'shelves', category: 'Regale', room: 'Wohnzimmer' }
];

export const QUICK_ROOMS = [
  { id: 'alle', name: 'Alle', icon: 'apps' },
  { id: 'wohnzimmer', name: 'Wohnzimmer', icon: 'chair' },
  { id: 'schlafzimmer', name: 'Schlafzimmer', icon: 'bed' },
  { id: 'kueche', name: 'Küche', icon: 'countertops' },
  { id: 'kinderzimmer', name: 'Kinderzimmer', icon: 'toys' },
  { id: 'buero', name: 'Büro', icon: 'desk' }
];
