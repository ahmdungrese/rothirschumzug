/**
 * Feste Kernleistungen.
 * Erkennung: 1) service.key  2) service.id (auch alte IDs)  3) bekannter Altname.
 * Es wird nichts in der Datenbank umgeschrieben; alte Aufträge werden nur beim LESEN abgebildet.
 */

export type FixedServiceKey = 'transport' | 'kartons' | 'moebellift' | 'hvz';
export const FIXED_KEYS: FixedServiceKey[] = ['transport', 'kartons', 'moebellift', 'hvz'];

type ServiceLike = { id?: string; name?: string; key?: string } | null | undefined;

export const DEFAULT_HVZ_PRICE = 250;

export const FIXED_SERVICES: Record<FixedServiceKey, {
  id: string; name: string; unit: string; icon: string; desc: string;
}> = {
  transport: {
    id: 'trans_basis',
    name: 'Transport inkl. Be- und Entladung (Personal & LKW)',
    unit: 'Pauschal',
    icon: 'local_shipping',
    desc: 'Bereitstellung von Fachpersonal, LKW und vollständige Be- und Entladung am Umzugstag.',
  },
  kartons: {
    id: 'kartonlieferung',
    name: 'Kartonlieferung vorab',
    unit: 'Pauschal',
    icon: 'inventory_2',
    desc: 'Anlieferung von Umzugskartons und Packmaterial vor dem Umzugstermin.',
  },
  moebellift: {
    id: 'moebellift',
    name: 'Möbellift',
    unit: 'Std',
    icon: 'elevator',
    desc: 'Einsatz eines Außenaufzugs für Etagenumzüge.',
  },
  hvz: {
    id: 'hvz',
    name: 'Halteverbotszone (HVZ)',
    unit: 'Pauschal',
    icon: 'signpost',
    desc: 'Einrichtung einer temporären Halteverbotszone inkl. behördlicher Genehmigung.',
  },
};

export type FixedDef = {
  key: FixedServiceKey; id: string; name: string; unit: string; icon: string; desc: string; price: number;
};

const toPrice = (v: any): number => {
  const n = typeof v === 'number' ? v : (v === '' || v === null || v === undefined ? NaN : Number(v));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

/** Definition der vier festen Leistungen = Standardwerte + settings.fixedServices (+ alter Wert fixedPrices.hvz). */
export function resolveFixedDefs(settings: any): Record<FixedServiceKey, FixedDef> {
  const out = {} as Record<FixedServiceKey, FixedDef>;
  for (const key of FIXED_KEYS) {
    const base = FIXED_SERVICES[key];
    const o = settings?.fixedServices?.[key] || {};
    let price = toPrice(o.price);
    if (Number.isNaN(price) && key === 'hvz') price = toPrice(settings?.fixedPrices?.hvz);
    if (Number.isNaN(price)) price = key === 'hvz' ? DEFAULT_HVZ_PRICE : 0;
    out[key] = {
      key,
      id: base.id,
      name: (typeof o.name === 'string' && o.name.trim()) ? o.name.trim() : base.name,
      unit: (typeof o.unit === 'string' && o.unit.trim()) ? o.unit.trim() : base.unit,
      icon: base.icon,
      desc: (typeof o.desc === 'string' && o.desc.trim()) ? o.desc : base.desc,
      price,
    };
  }
  return out;
}

/** IDs, die zu einem festen Schlüssel gehören (inkl. alter IDs). */
const IDS: Record<FixedServiceKey, string[]> = {
  transport: ['trans_basis', 'trans_be_ent', 'trans_all'],
  kartons: ['kartonlieferung', 'kartons_bereit'],
  moebellift: ['moebellift'],
  hvz: ['hvz', 'hvz_a', 'hvz_b'],
};

const norm = (s?: string) => (s || '').trim().toLowerCase();
const isKey = (k: any): k is FixedServiceKey => FIXED_KEYS.includes(k);

/** Ein-/Auspackservices mit "Karton" im Namen sind KEINE Kartonlieferung. */
const PACK_SERVICE_HINTS = ['einpack', 'auspack', 'packservice', 'packen', 'ein- und auspack'];

export function getFixedKey(service: ServiceLike): FixedServiceKey | null {
  if (!service) return null;
  if (isKey(service.key)) return service.key;
  const id = service.id || '';
  for (const key of FIXED_KEYS) {
    if (IDS[key].includes(id)) return key;
  }
  const n = norm(service.name);
  if (!n) return null;
  if (n.startsWith('transport inkl. be-') || n.includes('transport inkl') || n === 'transport') return 'transport';
  if (n.includes('möbellift') || n.includes('moebellift')) return 'moebellift';
  if (n.startsWith('halteverbot')) return 'hvz';
  if (n.includes('karton') && !PACK_SERVICE_HINTS.some(h => n.includes(h))) return 'kartons';
  return null;
}

export function hasFixedService(services: ServiceLike[] | undefined | null, key: FixedServiceKey): boolean {
  return Array.isArray(services) && services.some(s => getFixedKey(s) === key);
}

/** Alle Leistungen sind für Disponenten frei entfernbar. */
export const isRemovalLocked = (_service: ServiceLike) => false;

/** Paired Services Definitions (Intelligente Logistik-Paare zwischen Belade- und Entladestelle) */
export interface PairedDefinition {
  pairKey: 'kueche' | 'moebel' | 'lampen' | 'packen';
  combinedName: string;
  combinedId: string;
  combinedDesc: string;
  combinedUnit: string;
  combinedPrice: number;
  partAName: string;
  partAId: string;
  partADesc: string;
  partAUnit: string;
  partAPrice: number;
  partBName: string;
  partBId: string;
  partBDesc: string;
  partBUnit: string;
  partBPrice: number;
}

export const PAIRED_DEFINITIONS: Record<string, PairedDefinition> = {
  kueche: {
    pairKey: 'kueche',
    combinedName: 'Abbau und Aufbau von Küche',
    combinedId: 'kueche_komplett',
    combinedDesc: 'Fachgerechter Abbau an der Beladestelle und Wiederaufbau der Küche an der Entladestelle.',
    combinedUnit: 'Pauschal',
    combinedPrice: 600,
    partAName: 'Abbau von Küche',
    partAId: 'kueche_abbau',
    partADesc: 'Abbau der Einbauküche inkl. Elektrogeräte und fachgerechte Trennung der Wasseranschlüsse.',
    partAUnit: 'Pauschal',
    partAPrice: 280,
    partBName: 'Aufbau von Küche',
    partBId: 'kueche_aufbau',
    partBDesc: 'Aufbau der Küchenzeile, Hängeschränke und Montage der Arbeitsplatte.',
    partBUnit: 'Pauschal',
    partBPrice: 320,
  },
  moebel: {
    pairKey: 'moebel',
    combinedName: 'Demontage und Montage von Möbeln',
    combinedId: 'moebel_komplett',
    combinedDesc: 'Fachgerechte Demontage am Auszugsort und Remontage aller Möbel am Einzugsort.',
    combinedUnit: 'Pauschal',
    combinedPrice: 330,
    partAName: 'Möbelabbau',
    partAId: 'moebelabbau',
    partADesc: 'Fachgerechter Abbau von Schränken, Betten und Regalen.',
    partAUnit: 'Pauschal',
    partAPrice: 150,
    partBName: 'Möbelaufbau',
    partBId: 'moebelaufbau',
    partBDesc: 'Fachgerechter Aufbau aller Möbel in den Zielräumen.',
    partBUnit: 'Pauschal',
    partBPrice: 180,
  },
  lampen: {
    pairKey: 'lampen',
    combinedName: 'Deckenlampen demontieren und montieren',
    combinedId: 'lampen_komplett',
    combinedDesc: 'Fachgerechte Demontage der Deckenlampen am Auszugsort und fachgerechte Montage am Einzugsort.',
    combinedUnit: 'Stk',
    combinedPrice: 90,
    partAName: 'Deckenlampen demontieren',
    partAId: 'lampen_demontieren',
    partADesc: 'Fachgerechte Demontage und Sicherung aller Deckenlampen.',
    partAUnit: 'Stk',
    partAPrice: 45,
    partBName: 'Deckenlampen montieren',
    partBId: 'lampen_montieren',
    partBDesc: 'Fachgerechte Montage und Befestigung von Deckenlampen.',
    partBUnit: 'Stk',
    partBPrice: 45,
  },
  packen: {
    pairKey: 'packen',
    combinedName: 'Ein- und Auspackservice (inkl. Pack- & Schutzmaterial)',
    combinedId: 'packservice_komplett',
    combinedDesc: 'Komplettservice: Fachgerechtes Einpacken des Hausrats vorab und Auspacken am Zielort.',
    combinedUnit: 'Pauschal',
    combinedPrice: 350,
    partAName: 'Einpackservice',
    partAId: 'packservice_ein',
    partADesc: 'Einpacken des gesamten Hausrats in bereitgestellte Kartons inkl. Polstermaterial.',
    partAUnit: 'Pauschal',
    partAPrice: 190,
    partBName: 'Auspackservice',
    partBId: 'packservice_aus',
    partBDesc: 'Auspacken aller Kartons und Platzieren des Inhalts nach Kundenwunsch.',
    partBUnit: 'Pauschal',
    partBPrice: 160,
  },
};

export function getPairedRole(service: ServiceLike): { pairKey: 'kueche' | 'moebel' | 'lampen' | 'packen'; role: 'a' | 'b' | 'combined' } | null {
  if (!service) return null;
  const id = (service.id || '').trim().toLowerCase();
  const n = norm(service.name);

  // Kueche
  if (id === 'kueche_komplett' || n.includes('abbau und aufbau') || n.includes('küchenabbau und -aufbau') || n.includes('küchenauf- und abbau')) {
    return { pairKey: 'kueche', role: 'combined' };
  }
  if (id === 'kueche_abbau' || (n.includes('küche') && (n.includes('abbau') || n.includes('demontage')))) {
    return { pairKey: 'kueche', role: 'a' };
  }
  if (id === 'kueche_aufbau' || (n.includes('küche') && (n.includes('aufbau') || n.includes('montage')))) {
    return { pairKey: 'kueche', role: 'b' };
  }

  // Moebel
  if (id === 'moebel_komplett' || n.includes('demontage und montage') || (n.includes('möbel') && n.includes('abbau und aufbau'))) {
    return { pairKey: 'moebel', role: 'combined' };
  }
  if (id === 'moebelabbau' || id === 'moebel_abbau' || (n.includes('möbel') && (n.includes('abbau') || n.includes('demontage')))) {
    return { pairKey: 'moebel', role: 'a' };
  }
  if (id === 'moebelaufbau' || id === 'moebel_aufbau' || (n.includes('möbel') && (n.includes('aufbau') || n.includes('montage')))) {
    return { pairKey: 'moebel', role: 'b' };
  }

  // Lampen
  if (id === 'lampen_komplett' || (n.includes('lampen') && (n.includes('demontieren und montieren') || n.includes('abbau und aufbau')))) {
    return { pairKey: 'lampen', role: 'combined' };
  }
  if (id === 'lampen_demontieren' || (n.includes('lampen') && (n.includes('demont') || n.includes('abbau')))) {
    return { pairKey: 'lampen', role: 'a' };
  }
  if (id === 'lampen_montieren' || (n.includes('lampen') && (n.includes('mont') || n.includes('aufbau')))) {
    return { pairKey: 'lampen', role: 'b' };
  }

  // Packen
  if (id === 'packservice_komplett' || id === 'ein_auspack_all' || n.includes('ein- und auspack')) {
    return { pairKey: 'packen', role: 'combined' };
  }
  if (id === 'packservice_ein' || (n.includes('einpack') && !n.includes('auspack'))) {
    return { pairKey: 'packen', role: 'a' };
  }
  if (id === 'packservice_aus' || (n.includes('auspack') && !n.includes('einpack'))) {
    return { pairKey: 'packen', role: 'b' };
  }

  return null;
}

/** HVZ-Preis (beide Adressen). */
export function getHvzPrice(settings: any): number {
  return resolveFixedDefs(settings).hvz.price;
}

/** Zwei Adressen = voller Preis, eine = die Hälfte, keine = 0. */
export function hvzAutoPrice(count: number, basePrice: number): number {
  if (count >= 2) return Math.round(basePrice * 100) / 100;
  if (count === 1) return Math.round((basePrice / 2) * 100) / 100;
  return 0;
}

export type EditorService = {
  id: string; key?: FixedServiceKey; name: string; quantity: number; unitPrice: number; unit: string;
  note?: string; location?: 'a' | 'b' | 'both'; showPriceInFlatRate?: boolean; isIncluded?: boolean;
};

/** Eine feste Leistung als Positionszeile. */
export function fixedLine(def: FixedDef, extra?: Partial<EditorService>): EditorService {
  return {
    id: def.id,
    key: def.key,
    name: def.name,
    quantity: 1,
    unitPrice: def.price,
    unit: def.unit,
    note: def.desc,
    location: 'both',
    ...extra,
  };
}

const hvzNote = (a: boolean, b: boolean) =>
  a && b
    ? 'Einrichtung temporärer Halteverbotszonen an Be- und Entladestelle inkl. behördlicher Genehmigung.'
    : a
      ? 'Einrichtung einer temporären Halteverbotszone an der Beladestelle inkl. behördlicher Genehmigung.'
      : 'Einrichtung einer temporären Halteverbotszone an der Entladestelle inkl. behördlicher Genehmigung.';

const legacyHvzLine = (id: 'hvz_a' | 'hvz_b'): EditorService => ({
  id,
  name: id === 'hvz_a' ? 'Halteverbot A' : 'Halteverbot B',
  quantity: 1,
  unitPrice: 95,
  unit: 'Zone',
  note: id === 'hvz_a'
    ? 'Einrichtung einer temporären Halteverbotszone (ca. 15m) an der Beladestelle inkl. behördlicher Genehmigung.'
    : 'Einrichtung einer temporären Halteverbotszone (ca. 15m) an der Entladestelle inkl. behördlicher Genehmigung.',
  location: 'both',
});

/**
 * HVZ-Position passend zu den Adress-Schaltern.
 * - Alte Aufträge mit hvz_a/hvz_b-Zeilen behalten ihr altes Verhalten (95 € je Zone).
 * - Ein manuell geänderter Preis wird nicht überschrieben.
 */
export function applyHvzToServices(
  prev: EditorService[],
  prevA: boolean, prevB: boolean,
  nextA: boolean, nextB: boolean,
  def: FixedDef,
): EditorService[] {
  if (prev.some(s => s.id === 'hvz_a' || s.id === 'hvz_b')) {
    let out = prev;
    if (prevA && !nextA) out = out.filter(s => s.id !== 'hvz_a');
    if (prevB && !nextB) out = out.filter(s => s.id !== 'hvz_b');
    if (!prevA && nextA && !out.some(s => s.id === 'hvz_a')) out = [...out, legacyHvzLine('hvz_a')];
    if (!prevB && nextB && !out.some(s => s.id === 'hvz_b')) out = [...out, legacyHvzLine('hvz_b')];
    return out;
  }

  const prevCount = (prevA ? 1 : 0) + (prevB ? 1 : 0);
  const nextCount = (nextA ? 1 : 0) + (nextB ? 1 : 0);
  const existing = prev.find(s => getFixedKey(s) === 'hvz');

  if (nextCount === 0) return existing ? prev.filter(s => s !== existing) : prev;

  const location: 'a' | 'b' | 'both' = nextA && nextB ? 'both' : nextA ? 'a' : 'b';

  if (!existing) {
    return [...prev, fixedLine(def, {
      unitPrice: hvzAutoPrice(nextCount, def.price),
      note: hvzNote(nextA, nextB),
      location,
    })];
  }

  const wasAuto = existing.unitPrice === hvzAutoPrice(prevCount, def.price);
  return prev.map(s => s === existing ? {
    ...s,
    key: 'hvz' as FixedServiceKey,
    unitPrice: wasAuto ? hvzAutoPrice(nextCount, def.price) : s.unitPrice,
    note: hvzNote(nextA, nextB),
    location,
  } : s);
}

/** Möbellift-Position passend zu den Lift-Schaltern (Schritt 2). Bestehende Position bleibt (Preis/Menge nicht überschreiben). */
export function applyLiftToServices(
  prev: EditorService[],
  nextA: boolean, nextB: boolean,
  def: FixedDef,
  hours: number | string,
): EditorService[] {
  const existing = prev.find(s => getFixedKey(s) === 'moebellift');
  if (!nextA && !nextB) return existing ? prev.filter(s => s !== existing) : prev;
  const location: 'a' | 'b' | 'both' = nextA && nextB ? 'both' : nextA ? 'a' : 'b';
  if (existing) return prev.map(s => s === existing ? { ...s, key: 'moebellift' as FixedServiceKey, location } : s);
  const qty = Math.max(1, Number(hours) || 3);
  return [...prev, fixedLine(def, { quantity: qty, location })];
}

/** Basisleistung Transport in neue Angebote einfügen, falls sie fehlt (nur neue Angebote), und Duplikate bereinigen. */
export function ensureTransportService(prev: EditorService[], settings: any): EditorService[] {
  const isTrans = (s: EditorService) => getFixedKey(s) === 'transport' || s.id === 'trans_be_ent' || (s.name || '').toLowerCase().includes('transport inkl');
  const existingCount = prev.filter(isTrans).length;
  if (existingCount === 1) return prev;
  if (existingCount > 1) {
    // Keep only the first transport item to eliminate duplicates!
    let kept = false;
    return prev.filter(s => {
      if (!isTrans(s)) return true;
      if (!kept) {
        kept = true;
        return true;
      }
      return false;
    });
  }
  const def = resolveFixedDefs(settings).transport;
  let price = def.price;
  if (!price) {
    const fromCatalog = (settings?.catalog || [])
      .flatMap((c: any) => c?.items || [])
      .find((it: any) => getFixedKey({ name: it?.name }) === 'transport');
    price = Number(fromCatalog?.price) || 0;
  }
  return [fixedLine(def, { unitPrice: price }), ...prev];
}
