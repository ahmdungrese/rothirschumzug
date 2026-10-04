"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlusIcon, TrashIcon, CalculatorIcon, DocumentTextIcon, EyeIcon, EyeSlashIcon, CheckCircleIcon, TruckIcon, MapPinIcon, ExclamationTriangleIcon, StarIcon, BuildingOffice2Icon, HomeIcon, BriefcaseIcon, BuildingLibraryIcon, ArchiveBoxIcon, WrenchIcon, SparklesIcon, PlusCircleIcon, TagIcon, ArrowsUpDownIcon, NoSymbolIcon, ArrowUpTrayIcon, MagnifyingGlassIcon, ShoppingCartIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { useAuth } from '@/context/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { calculateRoute } from '@/lib/routeCalculator';
import { changeOrderStatus } from '@/lib/orderStateMachine';
import { calculateOrderTotals } from '@/lib/financeHelpers';
import { InventoryWizardModal, ROOM_TYPES } from './InventoryWizardModal';
import { FLOOR_OPTIONS } from '@/lib/constants';
import { withDbTimeout, formatFriendlyError } from '@/lib/networkWatchdog';
import { modalManager } from '@/lib/modalManager';

const getPropertyIcon = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('wohnung')) return <BuildingOffice2Icon className="w-6 h-6 mb-1" />;
  if (t.includes('haus')) return <HomeIcon className="w-6 h-6 mb-1" />;
  if (t.includes('büro') || t.includes('buero')) return <BriefcaseIcon className="w-6 h-6 mb-1" />;
  return <BuildingLibraryIcon className="w-6 h-6 mb-1" />;
};

const getCategoryIcon = (category: string) => {
  const c = (category || '').toLowerCase();
  if (c.includes('transport') || c.includes('grundlagen')) return <TruckIcon className="w-5 h-5" />;
  if (c.includes('verpack') || c.includes('karton') || c.includes('material')) return <ArchiveBoxIcon className="w-5 h-5" />;
  if (c.includes('montage') || c.includes('aufbau') || c.includes('abbau')) return <WrenchIcon className="w-5 h-5" />;
  if (c.includes('entsorgung') || c.includes('sperrmüll')) return <TrashIcon className="w-5 h-5" />;
  if (c.includes('reinigung') || c.includes('putz')) return <SparklesIcon className="w-5 h-5" />;
  if (c.includes('zuschlag') || c.includes('sonstig')) return <PlusCircleIcon className="w-5 h-5" />;
  return <TagIcon className="w-5 h-5" />;
};

const STANDARD_SERVICES_A = [
  { id: 'kartonlieferung', name: 'Kartonlieferung vorab', price: 65, unit: 'pauschal', icon: 'inventory_2', defaultDesc: 'Anlieferung von Umzugskartons und Packmaterial vor dem Umzugstermin.' },
  { id: 'moebelabbau', name: 'Möbelabbau', price: 150, unit: 'pauschal', icon: 'tools_ladder', defaultDesc: 'Fachgerechter Abbau von Schränken, Betten und Regalen.' },
  { id: 'kueche_abbau', name: 'Abbau von Küche', price: 280, unit: 'pauschal', icon: 'countertops', defaultDesc: 'Abbau der Einbauküche inkl. Elektrogeräte und fachgerechte Trennung der Wasseranschlüsse.' },
  { id: 'packservice_ein', name: 'Einpackservice', price: 190, unit: 'pauschal', icon: 'inventory_2', defaultDesc: 'Einpacken des gesamten Hausrats in bereitgestellte Kartons inkl. Polstermaterial.' },
  { id: 'hvz_a', name: 'Halteverbot A', price: 95, unit: 'Zone', icon: 'signpost', defaultDesc: 'Einrichtung einer temporären Halteverbotszone (ca. 15m) an der Beladestelle inkl. behördlicher Genehmigung.' },
  { id: 'endreinigung', name: 'Endreinigung', price: 220, unit: 'pauschal', icon: 'cleaning_services', defaultDesc: 'Besenreine Endreinigung der Auszugsimmobilie.' }
];

const STANDARD_SERVICES_B = [
  { id: 'moebelaufbau', name: 'Möbelaufbau', price: 180, unit: 'pauschal', icon: 'build', defaultDesc: 'Fachgerechter Aufbau aller Möbel in den Zielräumen.' },
  { id: 'kueche_aufbau', name: 'Aufbau von Küche', price: 320, unit: 'pauschal', icon: 'kitchen', defaultDesc: 'Aufbau der Küchenzeile, Hängeschränke und Montage der Arbeitsplatte.' },
  { id: 'packservice_aus', name: 'Auspackservice', price: 160, unit: 'pauschal', icon: 'unarchive', defaultDesc: 'Auspacken aller Kartons und Platzieren des Inhalts nach Kundenwunsch.' },
  { id: 'bohren', name: 'Bohr- & Dübelarb.', price: 90, unit: 'pauschal', icon: 'handyman', defaultDesc: 'Fachgerechte Montage und Befestigung von Lampen, Spiegeln und Gardinenstangen.' },
  { id: 'hvz_b', name: 'Halteverbot B', price: 95, unit: 'Zone', icon: 'signpost', defaultDesc: 'Einrichtung einer temporären Halteverbotszone (ca. 15m) an der Entladestelle inkl. behördlicher Genehmigung.' },
  { id: 'entsorgung', name: 'Müllentsorgung', price: 120, unit: 'pauschal', icon: 'delete', defaultDesc: 'Fachgerechte Entsorgung von Verpackungsmaterial und Restmüll.' }
];

export const getServiceIcon = (name: string, fallback = 'design_services'): string => {
  const n = (name || '').toLowerCase();
  if (n.includes('lkw') || n.includes('transporter') || n.includes('transport')) return 'local_shipping';
  if (n.includes('kraftstoff') || n.includes('fahrzeugkosten') || n.includes('benzin') || n.includes('diesel')) return 'local_gas_station';
  if (n.includes('personal') || n.includes('helfer') || n.includes('träger') || n.includes('traeger') || n.includes('fahrer')) return 'groups';
  if (n.includes('auspack')) return 'unarchive';
  if (n.includes('karton') || n.includes('packen') || n.includes('packservice') || n.includes('packmittel')) return 'inventory_2';
  if (n.includes('keller')) return 'delete_sweep';
  if (n.includes('garage')) return 'garage';
  if (n.includes('entsorg') || n.includes('müll') || n.includes('muell') || n.includes('räumung') || n.includes('raeumung')) return 'delete_sweep';
  if (n.includes('küche') || n.includes('kueche') || n.includes('arbeitsplatte')) return 'countertops';
  if (n.includes('lift') || n.includes('aufzug')) return 'elevator';
  if (n.includes('lager') || n.includes('einlagerung')) return 'warehouse';
  if (n.includes('versicherung') || n.includes('schutz') || n.includes('haftung')) return 'shield';
  if (n.includes('lampe') || n.includes('leuchte') || n.includes('licht')) return 'lightbulb';
  if (n.includes('decke') || n.includes('folie')) return 'layers';
  if (n.includes('demontage') || n.includes('abbau')) return 'tools_ladder';
  if (n.includes('montage') || n.includes('aufbau') || n.includes('bohr') || n.includes('dübel') || n.includes('duebel')) return 'build';
  if (n.includes('halteverbot') || n.includes('hvz') || n.includes('zone')) return 'signpost';
  if (n.includes('reinigung') || n.includes('putzen')) return 'cleaning_services';
  if (n.includes('anfahrt') || n.includes('abfahrt') || n.includes('route')) return 'route';
  return fallback;
};

const DEFAULT_ALLGEMEIN_SERVICES = [
  { id: 'trans_all', name: 'Transport inkl. Be- und Entladung, Umzugspersonal & Fahrzeugkosten', price: 0, unit: 'Pauschal', icon: 'local_shipping', defaultDesc: 'Bereitstellung von LKW, Fachpersonal und vollständige Be- und Entladung.' },
  { id: 'ein_auspack_all', name: 'Ein- und Auspackservice (inkl. Kartons & Schutzmaterial)', price: 0, unit: 'Pauschal', icon: 'inventory_2', defaultDesc: 'Fachgerechtes Ein- und Auspacken des gesamten Umzugsguts inkl. Schutzmaterial.' },
  { id: 'kartons_bereit', name: 'Kartons bereitstellen', price: 0, unit: 'Stk', icon: 'inventory_2', defaultDesc: 'Bereitstellung stabiler Umzugskartons vorab.' },
  { id: 'arbeitsplatte', name: 'Arbeitsplatte anpassen', price: 0, unit: 'Stk', icon: 'carpenter', defaultDesc: 'Fachgerechter Zuschnitt und Anpassung der Küchenarbeitsplatte.' },
  { id: 'kueche_komplett', name: 'Küchenauf- und abbau (inkl. Anpassung der Arbeitsplatte)', price: 0, unit: 'Pauschal', icon: 'countertops', defaultDesc: 'Fachgerechter Küchenauf- und abbau inklusive Anpassung der Arbeitsplatte.' },
  { id: 'trans_be_ent', name: 'Transport inkl. Be- und Entladung', price: 0, unit: 'Pauschal', icon: 'local_shipping', defaultDesc: 'Reiner Transport inkl. Be- und Entladung am Umzugstag.' },
  { id: 'personal_std', name: 'Umzugspersonal (Fahrer + Umzugshelfer)', price: 0, unit: 'Std', icon: 'groups', defaultDesc: 'Bereitstellung von erfahrenem Fachpersonal nach Aufwand.' },
  { id: 'fahrzeug_kraftstoff', name: 'Fahrzeugkosten (Kraftstoff)', price: 0, unit: 'Pauschal', icon: 'local_gas_station', defaultDesc: 'Kraftstoff- und Fahrzeugpauschale.' },
  { id: 'versicherung_basic', name: 'Versicherung Basic', price: 0, unit: 'Pauschal', icon: 'shield', defaultDesc: 'Gesetzliche Grundhaftung und Transportversicherung inklusive.' },
  { id: 'moebellift', name: 'Möbellift', price: 0, unit: 'Std', icon: 'elevator', defaultDesc: 'Einsatz eines Außenaufzugs für Etagenumzüge.' },
  { id: 'einlagerung', name: 'Einlagerung', price: 0, unit: 'm³', icon: 'warehouse', defaultDesc: 'Sichere und trockene Einlagerung des Umzugsguts.' },
  { id: 'kellerraeumung', name: 'Kellerräumung', price: 0, unit: 'Pauschal', icon: 'delete_sweep', defaultDesc: 'Besenreine Räumung und Entrümpelung des Kellerabteils.' },
  { id: 'garagenraeumung', name: 'Garagenräumung', price: 0, unit: 'Pauschal', icon: 'garage', defaultDesc: 'Besenreine Räumung und Entrümpelung der Garage.' },
  { id: 'lampen_montieren', name: 'Deckenlampen montieren', price: 0, unit: 'Stk', icon: 'lightbulb', defaultDesc: 'Fachgerechte Demontage und Montage von Deckenlampen.' },
  { id: 'einpacken_decken', name: 'Einpacken der Möbel mit Decken und Schutzfolien', price: 0, unit: 'Std', icon: 'layers', defaultDesc: 'Umfassender Möbelschutz mit Umzugsdecken und Stretchfolien.' }
];

export interface CatalogItem {
  id: string;
  name: string;
  cbm: number;
  icon: string;
}

export interface RoomCatalogEntry {
  id: string;
  name: string;
  icon: string;
  items: CatalogItem[];
}

export const FURNITURE_CBM_MAP: Record<string, number> = {
  // Wohnzimmer
  'sofa 2er': 1.5,
  'sofa (2-sitzer)': 1.5,
  '2er sofa': 1.5,
  'sofa 3er': 2.2,
  'sofa (3-sitzer)': 2.2,
  '3er sofa': 2.2,
  'ecksofa': 3.5,
  'schlafcouch': 2.0,
  'sessel': 0.8,
  'ohrensessel': 1.0,
  'couchtisch': 0.4,
  'beistelltisch': 0.2,
  'tv-board': 0.6,
  'tv-board / lowboard': 0.6,
  'lowboard': 0.6,
  'highboard': 1.2,
  'sideboard': 1.0,
  'wohnwand': 2.8,
  'bücherregal': 0.7,
  'wandregal': 0.3,
  'vitrine': 1.0,
  'teppich': 0.2,
  'stehlampe': 0.15,
  'deckenlampe': 0.1,
  'fernseher (tv)': 0.2,
  'fernseher': 0.2,
  'tv': 0.2,
  'hocker': 0.15,
  'sitzsack': 0.3,
  'klavier/flügel': 2.5,
  'klavier': 2.5,

  // Schlafzimmer
  'bett (doppel)': 2.5,
  'doppelbett': 2.5,
  'bett (einzel)': 1.5,
  'einzelbett': 1.5,
  'boxspringbett': 3.0,
  'hochbett': 2.0,
  'etagenbett': 2.2,
  'wasserbett': 2.5,
  'kinderbett': 1.0,
  'kleiderschrank (1-türig)': 1.0,
  'kleiderschrank (2-türig)': 1.8,
  'schrank (2türig)': 1.8,
  'kleiderschrank (3-türig)': 2.5,
  'schrank (3türig)': 2.5,
  'kleiderschrank (4-türig)': 3.2,
  'schrank (4türig)': 3.2,
  'schwebetürenschrank': 3.0,
  'nachttisch': 0.2,
  'kommode': 0.8,
  'schminktisch': 0.8,
  'spiegel (groß)': 0.2,
  'spiegel': 0.15,
  'matratze': 0.5,
  'matratze extra': 0.5,
  'bettkasten': 0.6,

  // Küche & Esszimmer
  'einbauküche': 1.0,
  'einbauküche (lfm)': 1.0,
  'einbauküche (laufmeter)': 1.0,
  'küchenunterschrank': 0.5,
  'küchenhängeschrank': 0.3,
  'küchenhochschrank': 1.0,
  'apothekerschrank': 0.8,
  'spülenschrank': 0.6,
  'esstisch': 0.9,
  'ausziehtisch': 1.2,
  'küchentisch': 0.7,
  'stuhl': 0.2,
  'küchenstuhl': 0.2,
  'armlehnstuhl': 0.3,
  'barhocker': 0.2,
  'sitzbank': 0.6,
  'eckbank': 1.2,
  'kühlschrank': 0.8,
  'kühl-gefrierkombination': 1.2,
  'gefrierschrank': 0.8,
  'spülmaschine': 0.6,
  'herd': 0.6,
  'backofen': 0.6,
  'herd / backofen': 0.6,
  'mikrowelle': 0.1,
  'kaffeevollautomat': 0.1,
  'dunstabzugshaube': 0.2,
  'mülleimer': 0.1,
  'servierwagen': 0.3,

  // Bad
  'waschbeckenunterschrank': 0.3,
  'spiegelschrank': 0.3,
  'bad-hochschrank': 0.6,
  'badschrank': 0.4,
  'waschmaschine': 0.6,
  'wäschetrockner': 0.6,
  'trockner': 0.6,
  'wäschekorb': 0.15,
  'badhocker': 0.1,

  // Büro
  'schreibtisch': 0.9,
  'eckschreibtisch': 1.5,
  'stehschreibtisch': 1.0,
  'kinderschreibtisch': 0.7,
  'bürostuhl': 0.3,
  'bürostuhl / chefsessel': 0.35,
  'chefsessel': 0.4,
  'besucherstuhl': 0.2,
  'aktenschrank (hoch)': 1.2,
  'aktenschrank (niedrig)': 0.6,
  'rollcontainer': 0.2,
  'aktenregal': 0.7,
  'akten- / bücherregal': 0.7,
  'whiteboard': 0.2,
  'pinnwand': 0.1,
  'monitor & pc': 0.15,
  'monitor': 0.1,
  'computer': 0.15,
  'drucker / kopierer': 0.2,
  'drucker': 0.2,
  'aktenvernichter': 0.1,
  'tresor/safe': 0.4,

  // Flur & Garderobe
  'garderobe': 0.8,
  'garderobenpaneel': 0.3,
  'schuhschrank': 0.4,
  'schuhkipper': 0.3,
  'konsolentisch': 0.3,
  'schirmständer': 0.1,
  'schlüsselkasten': 0.05,
  'ganzkörperspiegel': 0.2,

  // Kinderzimmer
  'wickelkommode': 0.9,
  'kinderstuhl': 0.15,
  'spielzeugregal': 0.5,
  'spielzeugkiste': 0.3,
  'hochbett / etagenbett': 2.2,

  // Keller, Garage & Garten
  'schwerlastregal': 0.8,
  'holzregal': 0.6,
  'werkbank': 1.0,
  'werkbank / tisch': 1.0,
  'werkzeugschrank': 0.8,
  'werkzeugkasten': 0.1,
  'fahrrad': 0.5,
  'fahrrad / e-bike': 0.5,
  'e-bike': 0.6,
  'motorroller': 1.2,
  'autoreifen (4er satz)': 0.5,
  'autoreifen (satz)': 0.5,
  'reifen (satz)': 0.5,
  'ski/snowboard': 0.2,
  'reisekoffer (groß)': 0.2,
  'koffer (groß)': 0.2,
  'koffer': 0.15,
  'rasenmäher': 0.6,
  'schubkarre': 0.4,
  'leiter': 0.2,
  'leiter / steighilfe': 0.2,
  'staubsauger': 0.15,
  'bügelbrett': 0.1,
  'wäscheständer': 0.1,
  'gartentisch': 0.8,
  'gartenstuhl': 0.2,
  'sonnenliege': 0.5,
  'sonnenschirm': 0.15,
  'sonnenschirm mit ständer': 0.2,
  'grill (klein)': 0.3,
  'grill (gas / kohle)': 0.6,
  'grill (gas/kohle)': 0.6,
  'lounge-sofa': 2.0,
  'lounge-möbel': 2.0,
  'lounge-tisch': 0.5,
  'strandkorb': 1.8,
  'große pflanze / kübel': 0.4,

  // Kartons & Material
  'umzugskarton': 0.15,
  'karton': 0.15,
  'kleiderbox': 0.4,
  'kleiderbox (spedition)': 0.4,
  'bücherkarton': 0.1,
  'bücherkarton (schwer)': 0.1,
  'gläserkarton': 0.15,
  'bild': 0.1,
  'pflanze groß': 0.4,
  'pflanze klein': 0.1,
  'pflanze': 0.2
};

export const ROOM_CATALOG: RoomCatalogEntry[] = [
  {
    id: 'wohnzimmer',
    name: 'Wohnzimmer',
    icon: 'chair',
    items: [
      { id: 'w_sofa3', name: 'Sofa (3-Sitzer)', cbm: 2.2, icon: 'chair' },
      { id: 'w_sofa2', name: 'Sofa (2-Sitzer)', cbm: 1.5, icon: 'chair' },
      { id: 'w_ecksofa', name: 'Ecksofa', cbm: 3.5, icon: 'weekend' },
      { id: 'w_sessel', name: 'Sessel', cbm: 0.8, icon: 'armchair' },
      { id: 'w_couchtisch', name: 'Couchtisch', cbm: 0.4, icon: 'table_restaurant' },
      { id: 'w_tvboard', name: 'TV-Board / Lowboard', cbm: 0.6, icon: 'tv' },
      { id: 'w_tv', name: 'Fernseher (TV)', cbm: 0.2, icon: 'desktop_windows' },
      { id: 'w_wohnwand', name: 'Wohnwand', cbm: 2.8, icon: 'shelves' },
      { id: 'w_buecherregal', name: 'Bücherregal', cbm: 0.7, icon: 'shelves' },
      { id: 'w_vitrine', name: 'Vitrine', cbm: 1.0, icon: 'door_sliding' },
      { id: 'w_teppich', name: 'Teppich', cbm: 0.2, icon: 'texture' },
      { id: 'w_karton', name: 'Umzugskarton', cbm: 0.15, icon: 'inventory_2' }
    ]
  },
  {
    id: 'schlafzimmer',
    name: 'Schlafzimmer',
    icon: 'bed',
    items: [
      { id: 'sz_doppelbett', name: 'Doppelbett', cbm: 2.5, icon: 'single_bed' },
      { id: 'sz_boxspring', name: 'Boxspringbett', cbm: 3.0, icon: 'bed' },
      { id: 'sz_einzelbett', name: 'Bett (Einzel)', cbm: 1.5, icon: 'single_bed' },
      { id: 'sz_schrank2', name: 'Kleiderschrank (2-türig)', cbm: 1.8, icon: 'door_sliding' },
      { id: 'sz_schrank3', name: 'Kleiderschrank (3-türig)', cbm: 2.5, icon: 'door_sliding' },
      { id: 'sz_schrank4', name: 'Kleiderschrank (4-türig)', cbm: 3.2, icon: 'door_sliding' },
      { id: 'sz_schwebetuer', name: 'Schwebetürenschrank', cbm: 3.0, icon: 'door_sliding' },
      { id: 'sz_nacht', name: 'Nachttisch', cbm: 0.2, icon: 'table_restaurant' },
      { id: 'sz_kommode', name: 'Kommode', cbm: 0.8, icon: 'table_restaurant' },
      { id: 'sz_matratze', name: 'Matratze extra', cbm: 0.5, icon: 'bed' },
      { id: 'sz_spiegel', name: 'Spiegel (groß)', cbm: 0.2, icon: 'photo' },
      { id: 'sz_kleiderbox', name: 'Kleiderbox (Spedition)', cbm: 0.4, icon: 'archive' },
      { id: 'sz_karton', name: 'Umzugskarton', cbm: 0.15, icon: 'inventory_2' }
    ]
  },
  {
    id: 'kueche',
    name: 'Küche',
    icon: 'countertops',
    items: [
      { id: 'k_kueche', name: 'Einbauküche (Lfm)', cbm: 1.0, icon: 'countertops' },
      { id: 'k_esstisch', name: 'Esstisch', cbm: 0.9, icon: 'table_restaurant' },
      { id: 'k_stuhl', name: 'Küchenstuhl', cbm: 0.2, icon: 'chair_alt' },
      { id: 'k_kuehlschrank', name: 'Kühlschrank', cbm: 0.8, icon: 'kitchen' },
      { id: 'k_kuehlkombi', name: 'Kühl-Gefrierkombination', cbm: 1.2, icon: 'kitchen' },
      { id: 'k_gefrierschrank', name: 'Gefrierschrank', cbm: 0.8, icon: 'kitchen' },
      { id: 'k_spuelmaschine', name: 'Spülmaschine', cbm: 0.6, icon: 'dishwasher_gen' },
      { id: 'k_herd', name: 'Herd / Backofen', cbm: 0.6, icon: 'oven_gen' },
      { id: 'k_mikrowelle', name: 'Mikrowelle', cbm: 0.1, icon: 'microwave' },
      { id: 'k_unterschrank', name: 'Küchenunterschrank', cbm: 0.5, icon: 'door_sliding' },
      { id: 'k_haengeschrank', name: 'Küchenhängeschrank', cbm: 0.3, icon: 'shelves' },
      { id: 'k_glaeserkarton', name: 'Gläserkarton', cbm: 0.15, icon: 'archive' },
      { id: 'k_karton', name: 'Umzugskarton', cbm: 0.15, icon: 'inventory_2' }
    ]
  },
  {
    id: 'bad',
    name: 'Badezimmer',
    icon: 'bathtub',
    items: [
      { id: 'b_waschmaschine', name: 'Waschmaschine', cbm: 0.6, icon: 'local_laundry_service' },
      { id: 'b_trockner', name: 'Wäschetrockner', cbm: 0.6, icon: 'dry' },
      { id: 'b_waschtisch', name: 'Waschbeckenunterschrank', cbm: 0.3, icon: 'table_restaurant' },
      { id: 'b_spiegelschrank', name: 'Spiegelschrank', cbm: 0.3, icon: 'photo' },
      { id: 'b_hochschrank', name: 'Bad-Hochschrank', cbm: 0.6, icon: 'door_sliding' },
      { id: 'b_waeschekorb', name: 'Wäschekorb', cbm: 0.15, icon: 'shopping_basket' },
      { id: 'b_karton', name: 'Umzugskarton', cbm: 0.15, icon: 'inventory_2' }
    ]
  },
  {
    id: 'kinderzimmer',
    name: 'Kinderzimmer',
    icon: 'toys',
    items: [
      { id: 'kz_bett', name: 'Kinderbett', cbm: 1.0, icon: 'single_bed' },
      { id: 'kz_hochbett', name: 'Hochbett / Etagenbett', cbm: 2.2, icon: 'bed' },
      { id: 'kz_schreibtisch', name: 'Kinderschreibtisch', cbm: 0.7, icon: 'desk' },
      { id: 'kz_stuhl', name: 'Kinderstuhl', cbm: 0.15, icon: 'chair_alt' },
      { id: 'kz_schrank', name: 'Kleiderschrank (2-türig)', cbm: 1.8, icon: 'door_sliding' },
      { id: 'kz_regal', name: 'Spielzeugregal', cbm: 0.5, icon: 'shelves' },
      { id: 'kz_kiste', name: 'Spielzeugkiste', cbm: 0.3, icon: 'toys' },
      { id: 'kz_karton', name: 'Umzugskarton', cbm: 0.15, icon: 'inventory_2' }
    ]
  },
  {
    id: 'buero',
    name: 'Büro / Arbeitszimmer',
    icon: 'desk',
    items: [
      { id: 'bu_schreibtisch', name: 'Schreibtisch', cbm: 0.9, icon: 'desk' },
      { id: 'bu_eckschreibtisch', name: 'Eckschreibtisch', cbm: 1.5, icon: 'desk' },
      { id: 'bu_stuhl', name: 'Bürostuhl / Chefsessel', cbm: 0.35, icon: 'chair' },
      { id: 'bu_rollcontainer', name: 'Rollcontainer', cbm: 0.2, icon: 'inbox' },
      { id: 'bu_aktenschrank', name: 'Aktenschrank (hoch)', cbm: 1.2, icon: 'door_sliding' },
      { id: 'bu_regal', name: 'Akten- / Bücherregal', cbm: 0.7, icon: 'shelves' },
      { id: 'bu_pc', name: 'Monitor & PC', cbm: 0.15, icon: 'desktop_windows' },
      { id: 'bu_drucker', name: 'Drucker / Kopierer', cbm: 0.2, icon: 'print' },
      { id: 'bu_buecherkarton', name: 'Bücherkarton (schwer)', cbm: 0.1, icon: 'menu_book' },
      { id: 'bu_karton', name: 'Umzugskarton', cbm: 0.15, icon: 'inventory_2' }
    ]
  },
  {
    id: 'flur',
    name: 'Flur / Diele',
    icon: 'meeting_room',
    items: [
      { id: 'fl_garderobe', name: 'Garderobe', cbm: 0.8, icon: 'checkroom' },
      { id: 'fl_schuhschrank', name: 'Schuhschrank', cbm: 0.4, icon: 'door_sliding' },
      { id: 'fl_kommode', name: 'Kommode / Sideboard', cbm: 0.6, icon: 'table_restaurant' },
      { id: 'fl_spiegel', name: 'Ganzkörperspiegel', cbm: 0.2, icon: 'photo' },
      { id: 'fl_bank', name: 'Sitzbank', cbm: 0.4, icon: 'chair' },
      { id: 'fl_karton', name: 'Umzugskarton', cbm: 0.15, icon: 'inventory_2' }
    ]
  },
  {
    id: 'keller',
    name: 'Keller / Abstellraum',
    icon: 'warehouse',
    items: [
      { id: 'kl_regal', name: 'Schwerlastregal', cbm: 0.8, icon: 'shelves' },
      { id: 'kl_werkbank', name: 'Werkbank / Tisch', cbm: 1.0, icon: 'handyman' },
      { id: 'kl_fahrrad', name: 'Fahrrad / E-Bike', cbm: 0.5, icon: 'directions_bike' },
      { id: 'kl_reifen', name: 'Autoreifen (4er Satz)', cbm: 0.5, icon: 'tire_repair' },
      { id: 'kl_koffer', name: 'Reisekoffer (groß)', cbm: 0.2, icon: 'luggage' },
      { id: 'kl_leiter', name: 'Leiter / Steighilfe', cbm: 0.2, icon: 'stairs' },
      { id: 'kl_karton', name: 'Umzugskarton', cbm: 0.15, icon: 'inventory_2' }
    ]
  },
  {
    id: 'balkon',
    name: 'Balkon / Garten',
    icon: 'deck',
    items: [
      { id: 'bg_tisch', name: 'Gartentisch', cbm: 0.8, icon: 'table_restaurant' },
      { id: 'bg_stuhl', name: 'Gartenstuhl', cbm: 0.2, icon: 'chair_alt' },
      { id: 'bg_liege', name: 'Sonnenliege', cbm: 0.5, icon: 'weekend' },
      { id: 'bg_schirm', name: 'Sonnenschirm mit Ständer', cbm: 0.2, icon: 'umbrella' },
      { id: 'bg_grill', name: 'Grill (Gas / Kohle)', cbm: 0.6, icon: 'outdoor_grill' },
      { id: 'bg_lounge', name: 'Lounge-Möbel', cbm: 2.0, icon: 'deck' },
      { id: 'bg_pflanze', name: 'Große Pflanze / Kübel', cbm: 0.4, icon: 'potted_plant' }
    ]
  }
];

export const QUICK_ROOMS = ROOM_CATALOG.map(r => ({ id: r.id, name: r.name, icon: r.icon }));

export const QUICK_FURNITURE = ROOM_CATALOG.flatMap(r => r.items.map(it => ({ ...it, room: r.name, category: r.name })));

export function OrderEditor({ orderId }: { orderId?: string }) {
  const params = useParams();
  const [loadedCustomerId, setLoadedCustomerId] = useState<string>('');
  const urlCustomerId = (params.id && params.id !== 'undefined') ? (params.id as string) : loadedCustomerId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const isInvoice = searchParams?.get('type') === 'invoice';
  const { profile } = useAuth();
  const canEditPrices = profile?.role === 'admin' ? true : profile?.canEditPrices ?? true;
  const canViewPrices = profile?.role === 'admin' ? true : profile?.canViewPrices ?? true;
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [orderStatus, setOrderStatus] = useState('draft');
  const stepParam = searchParams?.get('step');
  const modeParam = searchParams?.get('mode');
  const initialStep = (stepParam === 'inventory' || stepParam === '4' || modeParam === 'inspection') ? 4 : (stepParam ? parseInt(stepParam, 10) || 1 : 1);
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [unlockedByAdmin, setUnlockedByAdmin] = useState(false);
  const isContractLocked = (orderStatus === 'confirmed' || orderStatus === 'completed') && !unlockedByAdmin;

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const goToStep = (stepNum: number) => {
    setCurrentStep(stepNum);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleStepBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => Math.max(1, prev - 1));
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleSafeCancel = () => {
    const isDirty = Boolean(
      customerDataRef.current.lastName?.trim() ||
      customerDataRef.current.phone?.trim() ||
      customerDataRef.current.street?.trim() ||
      inventoryRef.current.length > 0 ||
      servicesRef.current.length > 0
    );

    if (isDirty) {
      const confirmLeave = window.confirm(
        "Möchten Sie die Bearbeitung wirklich abbrechen? Nicht gespeicherte Änderungen gehen verloren."
      );
      if (!confirmLeave) return;
    }

    if (urlCustomerId) {
      router.push(`/dashboard/customers/${urlCustomerId}`);
    } else {
      if (typeof window !== 'undefined' && document.referrer && document.referrer.includes(window.location.origin)) {
        router.back();
      } else {
        router.push('/dashboard');
      }
    }
  };

  // 1. Kundeninformationen
  const [customerData, setCustomerData] = useState({
    type: 'privat', // 'privat' | 'firma'
    firstName: '',
    lastName: '',
    salutation: '',
    email: '',
    phone: '',
    source: '',
    street: '',
    houseNr: '',
    zip: '',
    city: ''
  });

  const [orderMeta, setOrderMeta] = useState<any>({
    movingDateFrom: '',
    movingDateTo: '',
    movingTimeFrom: '',
    estimatedDuration: '',
    validUntil: '',
    manager: '',
    paymentMethod: '',
    viewingDate: '',
    viewingTime: '',
    hvzMethod: 'selbst',
    hvzMethodA: 'selbst',
    hvzMethodB: 'selbst',
    hvzLocation: 'a',
    halteverbotDate: '',
    halteverbotTime: '',
    halteverbotDateA: '',
    halteverbotTimeA: '',
    halteverbotDateB: '',
    halteverbotTimeB: '',
    hvzSameAsA: false,
    kartonDeliveryDate: '',
    kartonDeliveryTime: '',
    moebelliftDate: '',
    moebelliftTime: '',
    moebelliftDuration: '3'
  });

  // 2. Adressen
  const [logistics, setLogistics] = useState<any>({
    a_street: '', a_houseNr: '', a_zip: '', a_city: '', a_floor: 'Erdgeschoss', a_distance: 0, a_type: '', a_elevator: false, a_parking: false, a_furnitureLift: false,
    b_street: '', b_houseNr: '', b_zip: '', b_city: '', b_floor: 'Erdgeschoss', b_distance: 0, b_type: '', b_elevator: false, b_parking: false, b_furnitureLift: false,
    hvzDateA: '', hvzTimeA: '', hvzDateB: '', hvzTimeB: '', hvzSameAsA: false
  });

  // 3. Leistungen
  const [isFlatRate, setIsFlatRate] = useState(true);
  const [flatRateNet, setFlatRateNet] = useState(0);
  const [services, setServices] = useState<{ id: string, name: string, quantity: number, unitPrice: number, unit: string, note?: string, location?: 'a' | 'b' | 'both' }[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [activeCategoryTab, setActiveCategoryTab] = useState('Alle');
  const [invoicedWarning, setInvoicedWarning] = useState<string | null>(null);
  
  // 4. MwSt Rechner
  const [calcInput, setCalcInput] = useState({ gross: 0, net: 0, tax: 0 });

  // 5. Inventarliste
  const [inventory, setInventory] = useState<{ id: string, name: string, quantity: number, note: string, showNoteInPdf?: boolean, room?: string, disassembly?: number, assembly?: number, disconnection?: number, connection?: number }[]>([]);
  const [appendInventoryToPDF, setAppendInventoryToPDF] = useState(false);
  const [isInventoryWizardOpen, setIsInventoryWizardOpen] = useState(false);
  const [initialWizardRoom, setInitialWizardRoom] = useState<string | null>(null);
  
  // 6. Dokumententexte
  const [texts, setTexts] = useState({
    quoteIntro: '',
    paymentTerms: '',
    quoteOutro: ''
  });

  // 7. Route & Entfernung
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number, durationMinutes: number } | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  // 8. Checkliste
  const [checklist, setChecklist] = useState<{ id: string, text: string, done: boolean }[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

  // 9. Fuhrpark & Volumen (Schnell-Auswahl: Standard 3.5t Transporter) & Externe Signatur
  const [truckChoice, setTruckChoice] = useState<'1_transporter' | '1_lkw' | '2_lkw' | 'custom'>('1_transporter');
  const [estimatedCbm, setEstimatedCbm] = useState<number>(18);
  const [isManuallySigned, setIsManuallySigned] = useState<boolean>(false);
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  const [selectedRoomTab, setSelectedRoomTab] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [customItemCbm, setCustomItemCbm] = useState('0.5');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [showFullCatalog, setShowFullCatalog] = useState(true);
  const [showBisDate, setShowBisDate] = useState(false);

  const customerDataRef = useRef(customerData);
  customerDataRef.current = customerData;
  const inventoryRef = useRef(inventory);
  inventoryRef.current = inventory;
  const servicesRef = useRef(services);
  servicesRef.current = services;

  // Intercept mobile hardware back button / swipe-back gesture
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (e: PopStateEvent) => {
      // If modalManager is handling a modal or a silent history rollback, ignore this popstate
      if (modalManager.isHandlingModal()) {
        return;
      }

      if (currentStepRef.current > 1) {
        setCurrentStep(prev => Math.max(1, prev - 1));
      } else {
        const isDirty = Boolean(
          customerDataRef.current.lastName?.trim() ||
          customerDataRef.current.phone?.trim() ||
          customerDataRef.current.street?.trim() ||
          inventoryRef.current.length > 0 ||
          servicesRef.current.length > 0
        );
        if (isDirty) {
          const confirmLeave = window.confirm(
            "Möchten Sie die Bearbeitung wirklich verlassen? Nicht gespeicherte Änderungen gehen verloren."
          );
          if (!confirmLeave) {
            window.history.pushState({ orderStep: 1 }, '');
            return;
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Auto-save draft locally to prevent loss on unexpected reload or exit
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasData = Boolean(
      customerData.lastName?.trim() ||
      customerData.phone?.trim() ||
      customerData.street?.trim() ||
      inventory.length > 0 ||
      services.length > 0
    );
    if (!hasData) return;

    const draftKey = `rothirsch_order_draft_${orderId || 'new'}`;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          customerData,
          orderMeta,
          logistics,
          inventory,
          services,
          savedAt: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        }));
      } catch {}
    }, 1500);

    return () => clearTimeout(timer);
  }, [customerData, orderMeta, logistics, inventory, services, orderId]);

  useEffect(() => {
    if (orderMeta.movingDateTo) {
      setShowBisDate(true);
    }
  }, [orderMeta.movingDateTo]);
  // Helper to toggle standard/catalog service in Step 3
  const toggleStandardService = (srv: { id?: string; name: string; price?: number; defaultPrice?: number; unit?: string; defaultDesc?: string; description?: string }) => {
    const srvName = (srv.name || '').trim();
    const existing = services.find(s => (srv.id && s.id === srv.id) || (s.name || '').trim().toLowerCase() === srvName.toLowerCase());
    if (existing) {
      setServices(prev => prev.filter(s => s.id !== existing.id));
      if (srv.id === 'hvz_a' || srvName.toLowerCase().includes('halteverbot a')) setLogistics((l: any) => ({ ...l, a_parking: false }));
      if (srv.id === 'hvz_b' || srvName.toLowerCase().includes('halteverbot b')) setLogistics((l: any) => ({ ...l, b_parking: false }));
    } else {
      setServices(prev => [...prev, {
        id: srv.id || (Date.now().toString() + Math.random().toString(36).substring(2, 6)),
        name: srvName,
        quantity: 1,
        unitPrice: srv.price ?? srv.defaultPrice ?? 0,
        unit: srv.unit || 'pauschal',
        note: srv.defaultDesc || srv.description || '',
        location: 'both'
      }]);
      if (srv.id === 'hvz_a' || srvName.toLowerCase().includes('halteverbot a')) setLogistics((l: any) => ({ ...l, a_parking: true }));
      if (srv.id === 'hvz_b' || srvName.toLowerCase().includes('halteverbot b')) setLogistics((l: any) => ({ ...l, b_parking: true }));
    }
  };

  const isStandardServiceSelected = (srvId?: string, srvName?: string) => {
    const targetName = (srvName || srvId || '').trim().toLowerCase();
    return services.some(s => (srvId && s.id === srvId) || (s.name || '').trim().toLowerCase() === targetName);
  };

  const getServiceQuantity = (srvId?: string, srvName?: string) => {
    const targetName = (srvName || srvId || '').trim().toLowerCase();
    return services.find(s => (srvId && s.id === srvId) || (s.name || '').trim().toLowerCase() === targetName)?.quantity || 0;
  };

  const allgemeinServices = useMemo(() => {
    const fromSettings = settings?.catalog?.find((c: any) => (c.category || '').trim().toLowerCase() === 'allgemein')?.items;
    if (fromSettings && Array.isArray(fromSettings) && fromSettings.length > 0) {
      return fromSettings.map((item: any, idx: number) => ({
        id: item.id || `allg_${idx}`,
        name: item.name,
        price: item.price ?? item.defaultPrice ?? 0,
        unit: item.unit || 'Pauschal',
        icon: item.icon || getServiceIcon(item.name),
        defaultDesc: item.description || item.defaultDesc || ''
      }));
    }
    return DEFAULT_ALLGEMEIN_SERVICES;
  }, [settings?.catalog]);

  const otherCatalogCategories = useMemo(() => {
    if (!settings?.catalog || !Array.isArray(settings.catalog)) {
      return ['Küchenservice', 'Kartonservice', 'Möbelservice'];
    }
    const cats = settings.catalog
      .map((c: any) => c.category)
      .filter((c: string) => c && c.trim().toLowerCase() !== 'allgemein');
    return cats.length > 0 ? cats : ['Küchenservice', 'Kartonservice', 'Möbelservice'];
  }, [settings?.catalog]);

  const otherCatalogItems = useMemo(() => {
    if (!settings?.catalog || !Array.isArray(settings.catalog)) {
      return [
        { category: 'Küchenservice', name: 'Aufbauen Von Küche', price: 0, unit: 'Std' },
        { category: 'Küchenservice', name: 'Abbauen Von Küche', price: 0, unit: 'Std' },
        { category: 'Kartonservice', name: 'Einpackservice', price: 0, unit: 'Stk' },
        { category: 'Kartonservice', name: 'Auspackservice', price: 0, unit: 'Stk' },
        { category: 'Kartonservice', name: 'Ein- und Auspacken', price: 0, unit: 'Stk' },
        { category: 'Möbelservice', name: 'Montieren Von Möbel', price: 0, unit: 'Std' },
        { category: 'Möbelservice', name: 'Demontieren Von Möbel', price: 0, unit: 'Std' },
        { category: 'Möbelservice', name: 'Demontage und Montage von Möbel', price: 0, unit: 'Std' },
        { category: 'Möbelservice', name: 'Möbelmontage & -demontage (inkl. Schutzverpackung)', price: 0, unit: 'Std' }
      ];
    }
    return settings.catalog
      .filter((cat: any) => (cat.category || '').trim().toLowerCase() !== 'allgemein')
      .flatMap((cat: any) =>
        (cat.items || []).map((item: any) => ({
          ...item,
          category: cat.category,
          icon: item.icon || getServiceIcon(item.name)
        }))
      );
  }, [settings?.catalog]);

  const filteredOtherCatalogItems = useMemo(() => {
    return otherCatalogItems.filter((item: any) => {
      const matchesSearch = !catalogSearch.trim() || 
        (item.name || '').toLowerCase().includes(catalogSearch.toLowerCase()) ||
        (item.category || '').toLowerCase().includes(catalogSearch.toLowerCase());
      const matchesCat = activeCategoryTab === 'Alle' || item.category === activeCategoryTab;
      return matchesSearch && matchesCat;
    });
  }, [otherCatalogItems, activeCategoryTab, catalogSearch]);

  // Helper for quick furniture items in Step 4
  const getFurnitureCount = (name: string, room?: string) => {
    const targetRoom = room || selectedRoomTab;
    const item = inventory.find(i => 
      (i.name||'').toLowerCase() === (name||'').toLowerCase() && 
      (i.room || 'Wohnzimmer').toLowerCase() === targetRoom.toLowerCase()
    );
    return item ? item.quantity : 0;
  };

  const updateFurnitureCount = (fItem: { name: string; cbm?: number; icon?: string }, room: string, delta: number) => {
    const targetRoom = room || selectedRoomTab || 'Wohnzimmer';
    const existingIdx = inventory.findIndex(i => 
      (i.name||'').toLowerCase() === (fItem.name||'').toLowerCase() && 
      (i.room || 'Wohnzimmer').toLowerCase() === targetRoom.toLowerCase()
    );
    if (existingIdx >= 0) {
      const newQty = inventory[existingIdx].quantity + delta;
      if (newQty <= 0) {
        setInventory(prev => prev.filter((_, idx) => idx !== existingIdx));
      } else {
        setInventory(prev => prev.map((item, idx) => idx === existingIdx ? { ...item, quantity: newQty } : item));
      }
    } else if (delta > 0) {
      setInventory(prev => [...prev, {
        id: Date.now().toString() + Math.random(),
        name: fItem.name,
        quantity: delta,
        note: '',
        room: targetRoom,
        cbm: fItem.cbm
      }]);
    }
  };

  const handleAddCustomFurniture = (room: string) => {
    if (!customItemName.trim()) return;
    const cbmVal = parseFloat(customItemCbm) || 0.5;
    const targetRoom = room || selectedRoomTab || 'Wohnzimmer';
    const existingIdx = inventory.findIndex(i => 
      (i.name||'').toLowerCase() === customItemName.trim().toLowerCase() && 
      (i.room || 'Wohnzimmer').toLowerCase() === targetRoom.toLowerCase()
    );
    if (existingIdx >= 0) {
      setInventory(prev => prev.map((item, idx) => idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setInventory(prev => [...prev, {
        id: Date.now().toString() + Math.random(),
        name: customItemName.trim(),
        quantity: 1,
        note: '',
        room: targetRoom,
        cbm: cbmVal
      }]);
    }
    setCustomItemName('');
    setIsAddingCustom(false);
  };

  const totalFurniturePieces = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);

  const getItemCbm = (name: string, fallback?: number) => {
    if (fallback !== undefined && fallback > 0) return fallback;
    const n = (name || '').toLowerCase().trim();
    if (FURNITURE_CBM_MAP[n] !== undefined) return FURNITURE_CBM_MAP[n];
    for (const [key, val] of Object.entries(FURNITURE_CBM_MAP)) {
      if (n === key || n.includes(key) || key.includes(n)) return val;
    }
    return 0.25;
  };

  const calculateQuickCbm = () => {
    let sum = 0;
    inventory.forEach(item => {
      const cbm = (item as any).cbm !== undefined && (item as any).cbm > 0 ? (item as any).cbm : getItemCbm(item.name);
      sum += (item.quantity || 0) * cbm;
    });
    return sum > 0 ? Number(sum.toFixed(2)) : (estimatedCbm || 0);
  };

  const totalConfiguredRoomsCount = Object.values(roomCounts).reduce((sum, c) => sum + (c || 0), 0);

  const availableRoomTabs = useMemo(() => {
    const list: { id: string; name: string; baseCategory: string; icon: string }[] = [];
    
    // 1. Configured rooms from roomCounts
    Object.entries(roomCounts).forEach(([rId, count]) => {
      if (count <= 0) return;
      const cat = ROOM_CATALOG.find(r => r.id === rId || r.name.toLowerCase() === rId.toLowerCase())
        || ROOM_CATALOG.find(r => r.name.toLowerCase().includes(rId.toLowerCase()))
        || { id: rId, name: rId.charAt(0).toUpperCase() + rId.slice(1), icon: 'meeting_room' };
      
      if (count === 1) {
        list.push({ id: `${rId}-1`, name: cat.name, baseCategory: cat.name, icon: cat.icon });
      } else {
        for (let i = 1; i <= count; i++) {
          list.push({ id: `${rId}-${i}`, name: `${cat.name} ${i}`, baseCategory: cat.name, icon: cat.icon });
        }
      }
    });

    // 2. Also include any rooms already present in inventory items that aren't in list yet
    inventory.forEach(item => {
      if (item.room && !list.some(r => r.name.toLowerCase() === item.room?.toLowerCase())) {
        const match = item.room.match(/^(.*?)( \d+)?$/);
        const baseName = match ? match[1] : item.room;
        const cat = ROOM_CATALOG.find(r => r.name.toLowerCase() === baseName.toLowerCase());
        list.push({
          id: `inv-${item.room}`,
          name: item.room,
          baseCategory: cat ? cat.name : baseName,
          icon: cat ? cat.icon : 'meeting_room'
        });
      }
    });

    // Only return the rooms that were actually configured or added to inventory
    return list;
  }, [roomCounts, inventory]);

  useEffect(() => {
    if (availableRoomTabs.length > 0) {
      if (!selectedRoomTab || !availableRoomTabs.some((r: any) => r.name.toLowerCase() === selectedRoomTab.toLowerCase())) {
        setSelectedRoomTab(availableRoomTabs[0].name);
      }
    } else {
      setSelectedRoomTab('');
    }
  }, [availableRoomTabs, selectedRoomTab]);

  const handleCalculateRoute = async () => {
    const addressA = `${logistics.a_street || ''} ${logistics.a_houseNr || ''}, ${logistics.a_zip || ''} ${logistics.a_city || ''}`.trim();
    const addressB = `${logistics.b_street || ''} ${logistics.b_houseNr || ''}, ${logistics.b_zip || ''} ${logistics.b_city || ''}`.trim();

    if (addressA.length > 5 && addressB.length > 5) {
      setIsCalculatingRoute(true);
      setRouteError(null);
      try {
        const res = await calculateRoute(addressA, addressB);
        if (res) {
          setRouteInfo(res);
          setRouteError(null);
        } else {
          setRouteInfo(null);
          setRouteError("Route konnte nicht berechnet werden. Bitte überprüfe die Adressen.");
        }
      } catch (err) {
        setRouteInfo(null);
        setRouteError("Fehler bei der API-Anfrage.");
      } finally {
        setIsCalculatingRoute(false);
      }
    } else {
      setRouteError("Bitte gib zuerst vollständige Adressen ein.");
    }
  };

  const INVENTORY_CATALOG = ['Umzugskarton', 'Kleiderbox', 'Bücherkarton', 'Sofa 2er', 'Sofa 3er', 'Ecksofa', 'Sessel', 'Couchtisch', 'Esstisch', 'Stuhl', 'Bett (Einzel)', 'Bett (Doppel)', 'Nachttisch', 'Kleiderschrank (2-türig)', 'Kleiderschrank (3-türig)', 'Kommode', 'Sideboard', 'Regal', 'Schreibtisch', 'Waschmaschine', 'Trockner', 'Spülmaschine', 'Kühlschrank', 'Gefrierschrank', 'Fahrrad', 'Spiegel', 'Lampe', 'Teppich'];

  useEffect(() => {
    // Lade globale Settings
    getDoc(doc(db, 'system', 'settings')).then((docSnap) => {
      if(docSnap.exists()) {
        const s = docSnap.data();
        setSettings(s);
        // Defaults aus Settings setzen, wenn neues Angebot
        if (!orderId) {
          const days = parseInt(s.quoteValidDays) || 14;
          const validDate = new Date();
          validDate.setDate(validDate.getDate() + days);
          
          setOrderMeta((prev: any) => ({ 
            ...prev, 
            manager: s.contacts?.[0] || '', 
            paymentMethod: s.paymentMethods?.[0]?.name || '',
            validUntil: validDate.toISOString().split('T')[0]
          }));
          setTexts({
            quoteIntro: s.texts?.quoteIntro || '',
            paymentTerms: s.paymentMethods?.[0]?.textQuote || '',
            quoteOutro: s.texts?.quoteGreeting || ''
          });
        }
      } else {
        // Fallback falls noch keine Settings gespeichert wurden
        setSettings({
          contacts: [],
          paymentMethods: [],
          propertyTypes: ['Wohnung', 'Haus', 'Büro'],
          catalog: []
        });
      }
    }).catch((err) => {
      console.error("Fehler beim Laden der Einstellungen", err);
      setSettings({ catalog: [], paymentMethods: [] }); // Notfall-Fallback
    });

    if (orderId) {
      getDoc(doc(db, 'orders', orderId)).then(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.customerId && data.customerId !== 'undefined') {
            setLoadedCustomerId(data.customerId);
          }
          if (data.invoiceNumber || data.status?.startsWith('invoice_') || (data.invoiceHistory && data.invoiceHistory.length > 0)) {
            setInvoicedWarning(data.invoiceNumber || 'Rechnung vorhanden');
          }
          setOrderStatus(data.status || 'draft');
          setOrderMeta((prev: any) => ({
            ...prev,
            ...(data.orderMeta || {}),
            movingDateFrom: data.orderMeta?.movingDateFrom || data.movingDate || '',
            movingDateTo: data.orderMeta?.movingDateTo || '',
            validUntil: data.orderMeta?.validUntil || '',
            manager: data.orderMeta?.manager || '',
            paymentMethod: data.orderMeta?.paymentMethod || '',
            viewingDate: data.orderMeta?.viewingDate || data.viewingDate || '',
            viewingTime: data.orderMeta?.viewingTime || data.logistics?.viewingTime || '',
            hvzMethod: data.orderMeta?.hvzMethod || data.logistics?.hvzMethod || 'selbst',
            hvzMethodA: data.orderMeta?.hvzMethodA || data.orderMeta?.hvzMethod || data.logistics?.hvzMethodA || data.logistics?.hvzMethod || 'selbst',
            hvzMethodB: data.orderMeta?.hvzMethodB || data.logistics?.hvzMethodB || 'selbst',
            hvzLocation: data.orderMeta?.hvzLocation || data.logistics?.hvzLocation || (data.logistics?.a_parking && data.logistics?.b_parking ? 'both' : data.logistics?.b_parking ? 'b' : 'a'),
            halteverbotDate: data.orderMeta?.halteverbotDate || data.logistics?.hvzDate || '',
            halteverbotTime: data.orderMeta?.halteverbotTime || data.logistics?.hvzTime || '',
            halteverbotDateA: data.orderMeta?.halteverbotDateA || data.orderMeta?.halteverbotDate || data.logistics?.hvzDateA || data.logistics?.hvzDate || '',
            halteverbotTimeA: data.orderMeta?.halteverbotTimeA || data.orderMeta?.halteverbotTime || data.logistics?.hvzTimeA || data.logistics?.hvzTime || '',
            halteverbotDateB: data.orderMeta?.halteverbotDateB || data.logistics?.hvzDateB || '',
            halteverbotTimeB: data.orderMeta?.halteverbotTimeB || data.logistics?.hvzTimeB || '',
            hvzSameAsA: Boolean(data.orderMeta?.hvzSameAsA ?? data.logistics?.hvzSameAsA),
            kartonDeliveryDate: data.orderMeta?.kartonDeliveryDate || data.logistics?.boxDeliveryDate || '',
            kartonDeliveryTime: data.orderMeta?.kartonDeliveryTime || data.logistics?.boxDeliveryTime || '',
            moebelliftDate: data.orderMeta?.moebelliftDate || data.logistics?.moebelliftDate || '',
            moebelliftTime: data.orderMeta?.moebelliftTime || data.logistics?.moebelliftTime || ''
          }));
          setLogistics((prev: any) => ({
            ...prev,
            ...(data.logistics || {}),
            a_street: data.logistics?.a_street || data.logistics?.from?.street || '',
            a_houseNr: data.logistics?.a_houseNr || data.logistics?.from?.houseNumber || '',
            a_zip: data.logistics?.a_zip || data.logistics?.from?.postalCode || '',
            a_city: data.logistics?.a_city || data.logistics?.from?.city || '',
            a_floor: data.logistics?.a_floor || data.logistics?.from?.floor || 'Erdgeschoss',
            a_distance: data.logistics?.a_distance || 0,
            a_type: data.logistics?.a_type || '',
            a_elevator: data.logistics?.a_elevator || false,
            a_parking: data.logistics?.a_parking || false,
            a_furnitureLift: data.logistics?.a_furnitureLift || false,
            b_street: data.logistics?.b_street || data.logistics?.to?.street || '',
            b_houseNr: data.logistics?.b_houseNr || data.logistics?.to?.houseNumber || '',
            b_zip: data.logistics?.b_zip || data.logistics?.to?.postalCode || '',
            b_city: data.logistics?.b_city || data.logistics?.to?.city || '',
            b_floor: data.logistics?.b_floor || data.logistics?.to?.floor || 'Erdgeschoss',
            b_distance: data.logistics?.b_distance || 0,
            b_type: data.logistics?.b_type || '',
            b_elevator: data.logistics?.b_elevator || false,
            b_parking: data.logistics?.b_parking || false,
            b_furnitureLift: data.logistics?.b_furnitureLift || false,
            hvzDateA: data.logistics?.hvzDateA || data.logistics?.hvzDate || data.orderMeta?.halteverbotDateA || data.orderMeta?.halteverbotDate || '',
            hvzTimeA: data.logistics?.hvzTimeA || data.logistics?.hvzTime || data.orderMeta?.halteverbotTimeA || data.orderMeta?.halteverbotTime || '',
            hvzDateB: data.logistics?.hvzDateB || data.orderMeta?.halteverbotDateB || '',
            hvzTimeB: data.logistics?.hvzTimeB || data.orderMeta?.halteverbotTimeB || '',
            hvzSameAsA: Boolean(data.logistics?.hvzSameAsA ?? data.orderMeta?.hvzSameAsA),
          }));
          setIsFlatRate(data.isFlatRate !== undefined ? data.isFlatRate : true);
          setFlatRateNet(data.flatRateNet || 0);
          setServices((data.services || []).map((s: any) => ({
            ...s,
            note: s.note || s.description || '',
            location: s.location || 'both'
          })));
          setInventory(data.inventory || []);
          setAppendInventoryToPDF(data.appendInventoryToPDF || false);
          setChecklist(data.checklist || []);
          setTexts(data.texts || {});
          if (data.truckChoice) setTruckChoice(data.truckChoice);
          if (data.estimatedCbm) setEstimatedCbm(data.estimatedCbm);
          if (data.isManuallySigned) setIsManuallySigned(data.isManuallySigned);
          if (data.roomCounts) {
            setRoomCounts(data.roomCounts);
          } else if (data.orderMeta?.roomCounts) {
            setRoomCounts(data.orderMeta.roomCounts);
          } else if (data.inventory && data.inventory.length > 0) {
            const counts: Record<string, number> = {};
            const uniqueRooms = new Set<string>(data.inventory.filter((i: any) => i.room).map((i: any) => i.room as string));
            uniqueRooms.forEach((roomName: string) => {
              const match = roomName.match(/^(.*?)( \d+)?$/);
              const baseType = match ? match[1] : roomName;
              const roomObj = ROOM_TYPES.find(r => r.name.toLowerCase() === baseType.toLowerCase())
                || ROOM_CATALOG.find(r => r.name.toLowerCase() === baseType.toLowerCase());
              if (roomObj) {
                counts[roomObj.id] = (counts[roomObj.id] || 0) + 1;
              }
            });
            setRoomCounts(counts);
          }
          
          if (data.billingAddress) {
            setCustomerData(prev => ({
              ...prev,
              type: data.billingAddress.type || 'privat',
              salutation: data.billingAddress.salutation || '',
              firstName: data.billingAddress.firstName || '',
              lastName: data.billingAddress.lastName || '',
              street: data.billingAddress.street || '',
              houseNr: data.billingAddress.houseNr || '',
              zip: data.billingAddress.zip || '',
              city: data.billingAddress.city || '',
              email: data.billingAddress.email || '',
              phone: data.billingAddress.phone || '',
              source: data.billingAddress.source || ''
            }));
          }
        }
      });
    }

    if (urlCustomerId) {
      getDoc(doc(db, 'customers', urlCustomerId)).then(docSnap => {
        if (docSnap.exists()) {
          const c = docSnap.data();
          setCustomerData(prev => ({
            // PRIORITIZE CUSTOMER PROFILE: The customer document is the single source of truth.
            // If it exists in the customer profile, it overwrites the old snapshot from the order.
            type: c.type || prev.type || 'privat',
            salutation: c.salutation || prev.salutation || '',
            firstName: c.firstName || prev.firstName || '',
            lastName: c.lastName || prev.lastName || '',
            email: c.email || prev.email || '',
            phone: c.phone || prev.phone || '',
            source: c.source || prev.source || '',
            street: c.street || prev.street || '',
            houseNr: c.houseNr || prev.houseNr || '',
            zip: c.zip || prev.zip || '',
            city: c.city || prev.city || ''
          }));
        }
      });
    }
  }, [orderId, urlCustomerId]);

  useEffect(() => {
    const stepParam = searchParams?.get('step');
    if (stepParam) {
      setCurrentStep(parseInt(stepParam));
    }
  }, [searchParams]);

  useEffect(() => {
    const highlightParam = searchParams?.get('highlight');
    if (highlightParam) {
      setTimeout(() => {
        const el = document.getElementById(`highlight-${highlightParam}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          let isComplete = false;
          if (highlightParam === 'addressA') isComplete = !!(logistics.a_street && logistics.a_houseNr && logistics.a_zip && logistics.a_city);
          else if (highlightParam === 'addressB') isComplete = !!(logistics.b_street && logistics.b_houseNr && logistics.b_zip && logistics.b_city);
          else if (highlightParam === 'movingDate') isComplete = !!orderMeta.movingDateFrom;
          else if (highlightParam === 'viewingDate') isComplete = !!orderMeta.viewingDate;
          else if (highlightParam === 'floorA') isComplete = !!logistics.a_floor;
          else if (highlightParam === 'floorB') isComplete = !!logistics.b_floor;

          if (!isComplete) {
            el.classList.add('highlight-pulse', 'border');
            setTimeout(() => el.classList.remove('highlight-pulse', 'border'), 3600);
            
            // Auto Focus
            const focusMap: any = {
              'addressA': !logistics.a_street ? 'a_street' : !logistics.a_houseNr ? 'a_houseNr' : !logistics.a_zip ? 'a_zip' : 'a_city',
              'addressB': !logistics.b_street ? 'b_street' : !logistics.b_houseNr ? 'b_houseNr' : !logistics.b_zip ? 'b_zip' : 'b_city',
              'movingDate': 'movingDateFrom',
              'viewingDate': 'viewingDate',
              'floorA': 'a_floor',
              'floorB': 'b_floor'
            };
            const targetId = focusMap[highlightParam];
            if (targetId) document.getElementById(`input-${targetId}`)?.focus();
          }
        }
      }, 500); // Wait for render and optional tab switch
    }
  }, [searchParams, currentStep]);


  const copyCustomerAddress = (target: 'a' | 'b') => {
    if (customerData.street || customerData.zip) {
      setLogistics((prev: any) => ({
        ...prev,
        [`${target}_street`]: customerData.street,
        [`${target}_houseNr`]: customerData.houseNr,
        [`${target}_zip`]: customerData.zip,
        [`${target}_city`]: customerData.city
      }));
      toast.success("Adresse übernommen!");
    } else {
      toast.error("Für diesen Kunden ist noch keine Adresse hinterlegt.");
    }
  };

  const loadStandardTexts = () => {
    if (!settings) return;
    const pm = settings.paymentMethods?.find((p:any) => p.name === orderMeta.paymentMethod) || settings.paymentMethods?.[0];
    setTexts({
      quoteIntro: settings.texts?.quoteIntro || '',
      paymentTerms: pm?.textQuote || '',
      quoteOutro: settings.texts?.quoteGreeting || ''
    });
  };

  const calculateTotal = () => {
    return calculateOrderTotals({
      isFlatRate,
      flatRateNet,
      services,
      calcInput: null // Force recalculation from services/flatRate
    });
  };
  const totals = calculateTotal();
  const customerName = customerData.type === 'firma' ? customerData.lastName : `${customerData.firstName} ${customerData.lastName}`.trim();
  const customerEmail = customerData.email;
  const customerPhone = customerData.phone;

  const handleCalcInput = (field: 'gross' | 'net', val: string) => {
    const num = parseFloat(val) || 0;
    if (field === 'gross') {
      setCalcInput({ gross: num, net: num / 1.19, tax: num - (num / 1.19) });
    } else {
      setCalcInput({ gross: num * 1.19, net: num, tax: num * 0.19 });
    }
  };

  const addInventoryItem = (name: string = '') => {
    if (name === '') {
      setInventory([...inventory, { id: Date.now().toString(), name: '', quantity: 1, note: '', showNoteInPdf: true }]);
      return;
    }
    const existing = inventory.find(i => i.name === name);
    if (existing) {
      setInventory(inventory.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setInventory([...inventory, { id: Date.now().toString(), name, quantity: 1, note: '', showNoteInPdf: true }]);
    }
  };

  const addServiceFromCatalog = (service: any) => {
    setServices(prev => {
      const existing = prev.find(s => s.name === service.name);
      if (existing) {
        return prev.map(s => s.name === service.name ? { ...s, quantity: s.quantity + 1 } : s);
      }
      return [...prev, { id: Date.now().toString() + Math.random(), name: service.name, quantity: 1, unitPrice: service.price || service.defaultPrice || 0, unit: service.unit || 'Stk' }];
    });
  };

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [showNoServicesModal, setShowNoServicesModal] = useState(false);
  const [pendingQuoteAction, setPendingQuoteAction] = useState<(() => void) | null>(null);

  const hasServices = (isFlatRate && flatRateNet > 0) || (services && services.length > 0);

  const handleQuoteActionWithCheck = (action: () => void) => {
    if (!hasServices) {
      setPendingQuoteAction(() => action);
      setShowNoServicesModal(true);
      return;
    }
    action();
  };

  const saveOrder = async (status: 'draft' | 'quote' | 'invoice_open', generateQuote: boolean = false) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Speichern fehlgeschlagen: Du bist offline!', { duration: 5000 });
      setErrorMessage('Kein Internet! Bitte warte auf eine Verbindung.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    if (!urlCustomerId && (!customerData.lastName)) {
      toast.error("Bitte mindestens Nachname/Firmenname ausfüllen!");
      setErrorMessage("Bitte mindestens Nachname/Firmenname ausfüllen!");
      setTimeout(() => setErrorMessage(''), 4000);
      return;
    }
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      let finalCustomerId = urlCustomerId;
      const cleanCreatorName = profile?.displayName || profile?.email?.split('@')[0] || 'Team';
      if (!finalCustomerId) {
        const cRef = await addDoc(collection(db, 'customers'), { 
          ...customerData, 
          createdAt: serverTimestamp(),
          createdBy: cleanCreatorName 
        });
        finalCustomerId = cRef.id;
        await logActivity(profile?.uid || 'unknown', cleanCreatorName, 'CREATE_CUSTOMER', `Kunde ${customerData.lastName} im Angebots-Editor angelegt`);
      }
      
      // Update the main customer profile so that salutation and other details are persisted for future orders
      if (finalCustomerId) {
        await updateDoc(doc(db, 'customers', finalCustomerId), {
          salutation: customerData.salutation || '',
          firstName: customerData.firstName || '',
          lastName: customerData.lastName || '',
          email: customerData.email || '',
          phone: customerData.phone || '',
          street: customerData.street || '',
          houseNr: customerData.houseNr || '',
          zip: customerData.zip || '',
          city: customerData.city || '',
          type: customerData.type || 'privat',
          source: customerData.source || ''
        });
      }

      let finalStatus: string = status;
      // Prevent downgrading the order status to draft when simply saving.
      // If generateQuote is true, status is already passed as 'quote' or changed later.
      // If it's an invoice, status is 'invoice_open'.
      if (orderId && orderStatus && orderStatus !== 'draft' && status === 'draft') {
        finalStatus = orderStatus as any;
      }

      const finalOrderMeta = {
        ...orderMeta,
        halteverbotDate: orderMeta.halteverbotDateA || orderMeta.halteverbotDate || logistics.hvzDateA || logistics.hvzDate || '',
        halteverbotTime: orderMeta.halteverbotTimeA || orderMeta.halteverbotTime || logistics.hvzTimeA || logistics.hvzTime || '',
        roomCounts
      };
      const finalLogistics = {
        ...logistics,
        hvzDate: logistics.hvzDateA || logistics.hvzDate || finalOrderMeta.halteverbotDate || '',
        hvzTime: logistics.hvzTimeA || logistics.hvzTime || finalOrderMeta.halteverbotTime || ''
      };

      const payload = {
        customerId: finalCustomerId,
        customerName: customerData.type === 'firma' ? customerData.lastName : `${customerData.firstName} ${customerData.lastName}`.trim(),
        billingAddress: {
          firstName: customerData.firstName || '',
          lastName: customerData.lastName || '',
          salutation: customerData.salutation || '',
          street: customerData.street || '',
          houseNr: customerData.houseNr || '',
          zip: customerData.zip || '',
          city: customerData.city || '',
          email: customerData.email || '',
          phone: customerData.phone || '',
          type: customerData.type || 'privat'
        },
        customerSource: customerData.source || 'Direktanfrage',
        status: finalStatus,
        orderMeta: finalOrderMeta,
        logistics: finalLogistics,
        viewingDate: finalOrderMeta.viewingDate || '', // Expose on root level for calendar
        isFlatRate,
        flatRateNet,
        services,
        inventory,
        roomCounts,
        appendInventoryToPDF,
        checklist,
        texts,
        totals,
        truckChoice,
        estimatedCbm,
        isManuallySigned,
        updatedAt: serverTimestamp(),
        updatedBy: cleanCreatorName
      };

      await withDbTimeout((async () => {
        if (orderId) {
          await updateDoc(doc(db, 'orders', orderId), payload);
          await logActivity(profile?.uid || 'unknown', cleanCreatorName, 'UPDATE_ORDER', `Angebot/Auftrag aktualisiert für Kunde ${payload.customerName}`);
          
          if (generateQuote || finalStatus === 'quote' || finalStatus === 'confirmed') {
            try {
              await changeOrderStatus(orderId, (finalStatus === 'draft' ? 'quote' : finalStatus) as any, { userId: profile?.uid });
            } catch (err: any) {
              console.error("Fehler bei der Angebotsstatus-Aktualisierung:", err);
            }
          }
        } else {
          const docRef = await addDoc(collection(db, 'orders'), { 
            ...payload, 
            createdAt: serverTimestamp(),
            createdBy: cleanCreatorName 
          });
          await logActivity(profile?.uid || 'unknown', cleanCreatorName, 'CREATE_ORDER', `Angebot erstellt für Kunde ${payload.customerName}`);
          
          if (generateQuote || finalStatus === 'quote' || finalStatus === 'confirmed') {
            try {
              await changeOrderStatus(docRef.id, (finalStatus === 'draft' ? 'quote' : finalStatus) as any, { userId: profile?.uid });
            } catch (err: any) {
              console.error("Fehler bei der Angebotsstatus-Aktualisierung:", err);
            }
          }
        }
      })(), { operationName: 'Angebot/Auftrag speichern', timeoutMs: 35000 });

      setSaveStatus('success');
      toast.success(orderId ? "Änderungen erfolgreich gespeichert!" : "Neues Angebot erfolgreich erstellt!");
      router.push(`/dashboard/customers/${finalCustomerId}`);
    } catch (e: any) {
      console.error("OrderEditor save error:", e); 
      const friendlyMsg = formatFriendlyError(e, 'Speichern des Angebots');
      toast.error(friendlyMsg, { duration: 6000 });
      setErrorMessage(friendlyMsg);
      setSaveStatus('error');
      setTimeout(() => { setErrorMessage(''); setSaveStatus('idle'); }, 6000);
    } finally {
      setIsSaving(false);
    }
  };

  const validateAndSetStep = (targetStep: number) => {
    // If going backwards, directly go to step without exiting page
    if (targetStep < currentStep) {
      goToStep(targetStep);
      return;
    }

    // Step 1 Validation: Customer Data
    if (currentStep === 1 || targetStep > 1) {
      if (!urlCustomerId && !customerData.lastName?.trim()) {
        const errorMsg = customerData.type === 'firma' 
          ? "Bitte Firmenname im Schritt '1. Kunde' ausfüllen!" 
          : "Bitte Nachname im Schritt '1. Kunde' ausfüllen!";
        toast.error(errorMsg);
        setErrorMessage(errorMsg);
        setTimeout(() => setErrorMessage(''), 4000);
        setCurrentStep(1);
        return;
      }
    }

    // Step 2 (Logistik) is non-blocking: Addresses can be completed later in Cockpit if needed.

    goToStep(targetStep);
  };

  if (!settings) return <div className="p-12 text-center text-text-main">Lade Einstellungen...</div>;

  const date = orderMeta?.movingDateFrom || "";
  const time = (orderMeta as any)?.movingTimeFrom || "";
  const calculatedDuration = (orderMeta as any)?.estimatedDuration || "";
  const fromAddress = [logistics.a_street, logistics.a_houseNr, logistics.a_zip, logistics.a_city].filter(Boolean).join(' ');
  const toAddress = [logistics.b_street, logistics.b_houseNr, logistics.b_zip, logistics.b_city].filter(Boolean).join(' ');
  const fromFloor = logistics.a_floor;
  const toFloor = logistics.b_floor;
  const hasElevatorA = logistics.a_elevator;
  const hasElevatorB = logistics.b_elevator;
  const distanceKm = routeInfo?.distanceKm || logistics.a_distance || 0;
  const distanceDuration = routeInfo ? `${Math.floor(routeInfo.durationMinutes / 60)}h ${routeInfo.durationMinutes % 60}m` : '';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-48">
      <div className="flex justify-between items-center bg-bg-panel border border-structure p-4 rounded-xl shadow-lg mt-6">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-2">
            {isInvoice ? 'Neue Rechnung' : (orderId ? 'Angebot bearbeiten' : 'Neues Angebot')}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {isInvoice ? 'Erstellen Sie eine direkte Rechnung.' : 'Erstellen Sie ein detailliertes Umzugsangebot.'}
          </p>
        </div>
      </div>
      {/* Invoiced Warning Banner */}
      {invoicedWarning && (
        <div className="mb-6 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3">
          <span className="material-symbols-outlined text-blue-400 text-2xl shrink-0 mt-0.5">receipt_long</span>
          <div>
            <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">
              Angebot wurde bereits abgerechnet ({invoicedWarning})
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Achtung: Nachträgliche Änderungen am Angebot aktualisieren eine bereits erstellte Rechnung ({invoicedWarning}) nicht automatisch!
            </p>
          </div>
        </div>
      )}

      {/* Contract Locked Warning Banner */}
      {isContractLocked && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-500 text-2xl shrink-0">lock</span>
            <div>
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                Vertrag ist bestätigt & geschützt
              </p>
              <p className="text-xs text-text-muted">
                Dieser Auftrag wurde bereits verbindlich bestätigt. Änderungen wirken sich auf den bestehenden Vertrag aus.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUnlockedByAdmin(!unlockedByAdmin)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold border border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-white transition-all shrink-0"
          >
            {unlockedByAdmin ? 'Wieder sperren' : 'Zur Bearbeitung entsperren'}
          </button>
        </div>
      )}

      {/* Stepper Navigation matching Mockups */}
      <div className="mb-10 py-2">
        <div className="flex items-center justify-between w-full max-w-4xl mx-auto px-4">
          {[
            { step: 1, label: '1. Kunde', icon: 'person' },
            { step: 2, label: '2. Logistik', icon: 'local_shipping' },
            { step: 3, label: '3. Leistungen', icon: 'construction' },
            { step: 4, label: '4. Inventar', icon: 'inventory_2' },
            { step: 5, label: '5. Abschluss', icon: 'task_alt' },
          ].map((s, idx) => (
            <React.Fragment key={s.step}>
              <div 
                onClick={() => validateAndSetStep(s.step)}
                className="flex flex-col items-center cursor-pointer group select-none"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  currentStep === s.step
                    ? 'bg-[#D91E2A] text-white shadow-lg shadow-[#D91E2A]/30 ring-4 ring-white dark:ring-slate-800 z-10 scale-105'
                    : currentStep > s.step
                      ? 'bg-emerald-600 text-white z-10 ring-4 ring-white dark:ring-slate-800 shadow-sm'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 z-10 ring-4 ring-white dark:ring-slate-800'
                }`}>
                  <span className="material-symbols-outlined text-xl">
                    {currentStep > s.step ? 'check' : s.icon}
                  </span>
                </div>
                <span className={`mt-2 text-xs font-bold font-display uppercase tracking-tight transition-colors ${
                  currentStep === s.step 
                    ? 'text-[#D91E2A] dark:text-red-400' 
                    : currentStep > s.step
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {s.label}
                </span>
              </div>
              {idx < 4 && (
                <div className={`flex-1 h-0.5 -mt-6 -mx-2 transition-all ${
                  currentStep > s.step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                }`}></div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>


      {currentStep === 1 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* 1. Kundeninformationen */}
      <section className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-primary shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-text-main border-b border-structure pb-2">Kundeninformationen</h2>
        {!urlCustomerId && (
          <div className="mb-4 text-xs text-text-muted bg-white/[0.02] p-3 rounded-lg border border-structure">
            Der Kunde wird beim Speichern automatisch angelegt. Die Adresse wird aus der Beladeadresse übernommen.
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="col-span-1 md:grid-cols-2 lg:col-span-4 flex gap-4">
            <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="radio" checked={customerData.type === 'privat'} onChange={() => setCustomerData({...customerData, type:'privat'})} className="accent-primary" /> Privatperson</label>
            <label className="flex items-center gap-2 text-text-main cursor-pointer"><input type="radio" checked={customerData.type === 'firma'} onChange={() => setCustomerData({...customerData, type:'firma'})} className="accent-primary" /> Firma / Geschäftlich</label>
          </div>
          {customerData.type === 'privat' ? (
              <>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Anrede</label>
                  <select value={customerData.salutation || ''} onChange={e => setCustomerData({...customerData, salutation: e.target.value})} className="input-field w-full">
                    <option value="">Keine</option>
                    <option value="Herr">Herr</option>
                    <option value="Frau">Frau</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Vorname</label>
                  <input type="text" value={customerData.firstName} onChange={e => setCustomerData({...customerData, firstName: e.target.value})} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Nachname *</label>
                  <input type="text" value={customerData.lastName} onChange={e => setCustomerData({...customerData, lastName: e.target.value})} className="input-field w-full" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Firmenname *</label>
                  <input type="text" value={customerData.lastName} onChange={e => setCustomerData({...customerData, lastName: e.target.value})} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">Ansprechpartner (Vor- & Nachname)</label>
                  <input type="text" value={customerData.firstName} onChange={e => setCustomerData({...customerData, firstName: e.target.value})} className="input-field w-full" />
                </div>
              </>
            )}
          <div>
            <label className="block text-xs text-text-muted mb-1">E-Mail Adresse</label>
            <input type="email" value={customerData.email} onChange={e => setCustomerData({...customerData, email: e.target.value})} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Telefonnummer</label>
            <input type="text" value={customerData.phone} onChange={e => setCustomerData({...customerData, phone: e.target.value})} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Kundenquelle</label>
            <select value={customerData.source} onChange={e => setCustomerData({...customerData, source: e.target.value})} className="input-field w-full">
              <option value="">Auswählen...</option>
              {settings.customerSources?.map((s:string) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          {/* Adress-Block (Aufgeteilt) */}
          <div className="col-span-1 md:col-span-2 lg:col-span-4 mt-2 border-t border-structure pt-4">
            <h3 className="text-sm font-semibold text-text-main mb-3">Hauptadresse des Kunden</h3>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3">
                <label className="block text-xs text-text-muted mb-1">Straße</label>
                <input type="text" value={customerData.street} onChange={e => setCustomerData({...customerData, street: e.target.value})} className="input-field w-full" />
              </div>
              <div className="col-span-1">
                <label className="block text-xs text-text-muted mb-1">Haus-Nr.</label>
                <input type="text" value={customerData.houseNr} onChange={e => setCustomerData({...customerData, houseNr: e.target.value})} className="input-field w-full" />
              </div>
              <div className="col-span-1">
                <label className="block text-xs text-text-muted mb-1">PLZ</label>
                <input type="text" value={customerData.zip} onChange={async (e) => {
                  const val = e.target.value;
                  setCustomerData(prev => ({...prev, zip: val}));
                  if (val.length === 5) {
                    try {
                      const res = await fetch(`https://api.zippopotam.us/de/${val}`);
                      if (res.ok) {
                        const data = await res.json();
                        if (data.places && data.places.length > 0) {
                          setCustomerData(prev => ({...prev, zip: val, city: data.places[0]['place name']}));
                        }
                      }
                    } catch(err) {}
                  }
                }} className="input-field w-full" />
              </div>
              <div className="col-span-3">
                <label className="block text-xs text-text-muted mb-1">Ort</label>
                <input type="text" value={customerData.city} onChange={e => setCustomerData({...customerData, city: e.target.value})} className="input-field w-full" />
              </div>
            </div>
          </div>

          <div id="highlight-movingDate" className="rounded-xl transition-all">
            <label className="flex justify-between items-center text-xs text-text-muted mb-1">
              <span>Umzugsdatum (von)</span>
              <button 
                type="button" 
                onClick={() => {
                  if (showBisDate) {
                    setOrderMeta({ ...orderMeta, movingDateTo: '' });
                  }
                  setShowBisDate(!showBisDate);
                }} 
                className="text-primary hover:opacity-70 transition-opacity flex items-center gap-1"
              >
                {showBisDate ? (
                  <>Ohne "bis" <span className="text-[10px]">▲</span></>
                ) : (
                  <>+ "bis" <span className="text-[10px]">▼</span></>
                )}
              </button>
            </label>
            <input id="input-movingDateFrom" type="date" value={orderMeta.movingDateFrom} onChange={e => setOrderMeta({...orderMeta, movingDateFrom: e.target.value})} className="input-field w-full" />
            
            {showBisDate && (
              <div className="mt-3 animate-fade-in">
                <label className="block text-xs text-text-muted mb-1">Umzugsdatum (bis)</label>
                <input type="date" value={orderMeta.movingDateTo} onChange={e => setOrderMeta({...orderMeta, movingDateTo: e.target.value})} className="input-field w-full" />
              </div>
            )}
          </div>
          <div id="highlight-viewingDate" className="rounded-xl transition-all space-y-2">
            <label className="flex items-center justify-between text-xs text-text-muted mb-1">
              <span>Besichtigungstermin (Datum & Uhrzeit)</span>
              {orderMeta.viewingDate !== 'erledigt_fotos' ? (
                <button
                  type="button"
                  onClick={() => setOrderMeta({ ...orderMeta, viewingDate: 'erledigt_fotos', viewingTime: '' })}
                  className="text-primary hover:opacity-70 transition-opacity underline text-[11px] font-bold"
                >
                  Durch Fotos erledigt
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setOrderMeta({ ...orderMeta, viewingDate: '', viewingTime: '' })}
                  className="text-text-muted hover:text-primary transition-colors underline text-[11px]"
                >
                  Termin wählen
                </button>
              )}
            </label>

            {orderMeta.viewingDate === 'erledigt_fotos' ? (
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
                <span>✓ Erledigt durch Fotos / Inventarliste</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  id="input-viewingDate"
                  type="date"
                  value={['requested', 'erledigt_fotos'].includes(orderMeta.viewingDate) ? '' : (orderMeta.viewingDate || '').split('T')[0]}
                  onChange={e => {
                    const newDate = e.target.value;
                    const timeMatch = (orderMeta.viewingTime || '').match(/(\d{2}:\d{2})/);
                    const isoTime = timeMatch ? timeMatch[1] : ((orderMeta.viewingDate || '').includes('T') ? (orderMeta.viewingDate || '').split('T')[1]?.slice(0, 5) : '');
                    const combined = newDate ? (isoTime ? `${newDate}T${isoTime}` : newDate) : '';
                    setOrderMeta({ ...orderMeta, viewingDate: combined, viewingDateOnly: newDate });
                  }}
                  className="input-field w-full text-xs"
                />
                <select
                  value={orderMeta.viewingTime || ((orderMeta.viewingDate || '').includes('T') ? (orderMeta.viewingDate || '').split('T')[1]?.slice(0, 5) : '')}
                  onChange={e => {
                    const newTime = e.target.value;
                    const datePart = ['requested', 'erledigt_fotos'].includes(orderMeta.viewingDate) ? '' : (orderMeta.viewingDate || '').split('T')[0];
                    const timeMatch = newTime.match(/(\d{2}:\d{2})/);
                    const isoTime = timeMatch ? timeMatch[1] : '';
                    const combined = datePart ? (isoTime ? `${datePart}T${isoTime}` : datePart) : '';
                    setOrderMeta({ ...orderMeta, viewingTime: newTime, viewingDate: combined });
                  }}
                  className="input-field w-full text-xs"
                >
                  <option value="">Uhrzeit / Zeitfenster...</option>
                  <option value="08:00 - 12:00">08:00 - 12:00 (Vormittag)</option>
                  <option value="10:00 - 14:00">10:00 - 14:00 (Mittag)</option>
                  <option value="13:00 - 17:00">13:00 - 17:00 (Nachmittag)</option>
                  <option value="09:00">09:00 Uhr</option>
                  <option value="10:00">10:00 Uhr</option>
                  <option value="11:00">11:00 Uhr</option>
                  <option value="12:00">12:00 Uhr</option>
                  <option value="14:00">14:00 Uhr</option>
                  <option value="15:00">15:00 Uhr</option>
                  <option value="16:00">16:00 Uhr</option>
                  <option value="17:00">17:00 Uhr</option>
                  <option value="18:00">18:00 Uhr</option>
                  <option value="Ganztägig">Ganztägig (Flexibel)</option>
                </select>
              </div>
            )}
            {orderMeta.viewingDate === 'requested' && (
              <p className="text-xs font-bold text-orange-400 mt-1">Kunde hat Besichtigung angefragt!</p>
            )}
            <p className="text-[10px] text-text-muted mt-1">Synchronisiert automatisch mit Kundenakte, Cockpit & Kalender.</p>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Gültig bis</label>
            <input type="date" value={orderMeta.validUntil} onChange={e => setOrderMeta({...orderMeta, validUntil: e.target.value})} className="input-field w-full" />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Ansprechpartner (Berater)</label>
            <select value={orderMeta.manager} onChange={e => setOrderMeta({...orderMeta, manager: e.target.value})} className="input-field w-full">
              <option value="">Wählen...</option>
              {settings.contacts?.map((c:string) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Zahlungsmethode</label>
            <select value={orderMeta.paymentMethod} onChange={e => {
              setOrderMeta({...orderMeta, paymentMethod: e.target.value});
              const pm = settings.paymentMethods?.find((p:any) => p.name === e.target.value);
              if (pm) setTexts(t => ({...t, paymentTerms: pm.textQuote}));
            }} className="input-field w-full">
              {settings.paymentMethods?.map((pm:any) => <option key={pm.name} value={pm.name}>{pm.name}</option>)}
            </select>
          </div>

        </div>
      </section>

      
        </div>
      )}

      {currentStep === 2 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* 2. Adressen (A -> B) */}
      <div className="flex flex-col gap-4 mb-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-bold text-text-main flex items-center gap-2">Logistik & Route</h2>
          <div className="flex flex-wrap gap-2">
            <button 
              type="button"
              onClick={handleCalculateRoute}
              disabled={isCalculatingRoute}
              className="btn-primary py-1.5 px-3 text-sm flex items-center gap-2 shadow-lg"
            >
              <TruckIcon className="w-4 h-4" /> {isCalculatingRoute ? "Berechne..." : "Route direkt berechnen"}
            </button>
            <a 
              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${logistics.a_street || ''} ${logistics.a_houseNr || ''}, ${logistics.a_zip || ''} ${logistics.a_city || ''}`)}&destination=${encodeURIComponent(`${logistics.b_street || ''} ${logistics.b_houseNr || ''}, ${logistics.b_zip || ''} ${logistics.b_city || ''}`)}`}
              target="_blank" 
              rel="noreferrer" 
              className="btn-secondary py-1.5 px-3 text-sm flex items-center gap-2 border-primary/50 text-primary hover:bg-primary/10 shadow-lg"
              title="Google Maps Routenplanung öffnen"
            >
              <MapPinIcon className="w-4 h-4" /> Auf Maps öffnen
            </a>
          </div>
        </div>
        
        {/* Direkte Entfernungsberechnung */}
        {(isCalculatingRoute || routeInfo || routeError) && (
          <div className={`border rounded-lg p-3 flex items-center justify-between text-sm animate-in fade-in duration-300 ${routeError ? 'bg-red-500/10 border-red-500/30' : 'bg-primary/10 border-primary/30'}`}>
            <div className="flex items-center gap-3">
              <TruckIcon className="w-6 h-6 text-text-muted" />
              <div>
                <span className="text-text-muted">Direkte Strecke: </span>
                {isCalculatingRoute ? (
                  <span className="text-primary font-medium animate-pulse">Berechne Route...</span>
                ) : routeError ? (
                  <span className="text-red-400 font-medium">{routeError}</span>
                ) : routeInfo ? (
                  <span className="text-primary font-bold">{routeInfo.distanceKm} km <span className="text-text-muted font-normal">(Fahrzeit: ca. {Math.floor(routeInfo.durationMinutes/60)}h {routeInfo.durationMinutes%60}min)</span></span>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Etagen Datalist (Wird für beide Inputs genutzt) */}
        <datalist id="floors">
          <option value="Erdgeschoss" />
          <option value="Hochparterre" />
          <option value="1. OG" />
          <option value="2. OG" />
          <option value="3. OG" />
          <option value="4. OG" />
          <option value="5. OG" />
          <option value="6. OG" />
          <option value="7. OG" />
          <option value="8. OG" />
          <option value="9. OG" />
          <option value="10. OG" />
          <option value="Dachgeschoss" />
        </datalist>

        <div id="highlight-addressA" className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-structure shadow-lg transition-all">
          <div className="flex justify-between items-center mb-4 border-b border-structure pb-2">
            <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
              Beladeadresse (A)
              {!!(logistics.a_street && logistics.a_houseNr && logistics.a_zip && logistics.a_city) && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
            </h2>
            <button onClick={() => copyCustomerAddress('a')} className="text-xs btn-secondary py-1 px-2">Kundenadresse übernehmen</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Straße</label><input id="input-a_street" type="text" value={logistics.a_street} onChange={e => setLogistics({...logistics, a_street: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1"><label className="block text-xs text-text-muted mb-1">Haus-Nr.</label><input id="input-a_houseNr" type="text" value={logistics.a_houseNr} onChange={e => setLogistics({...logistics, a_houseNr: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1">
              <label className="block text-xs text-text-muted mb-1">PLZ</label>
              <input id="input-a_zip" type="text" value={logistics.a_zip} onChange={async (e) => {
                  const val = e.target.value;
                  setLogistics((prev: any) => ({...prev, a_zip: val}));
                  if (val.length === 5) {
                    try {
                      const res = await fetch(`https://api.zippopotam.us/de/${val}`);
                      if (res.ok) {
                        const data = await res.json();
                        if (data.places && data.places.length > 0) {
                          setLogistics((prev: any) => ({...prev, a_zip: val, a_city: data.places[0]['place name']}));
                        }
                      }
                    } catch(err) {}
                  }
                }} className="input-field w-full" />
            </div>
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Ort</label><input id="input-a_city" type="text" value={logistics.a_city} onChange={e => setLogistics({...logistics, a_city: e.target.value})} className="input-field w-full" /></div>
            
            <div id="highlight-floorA" className="col-span-2 transition-all rounded-lg">
              <label className="block text-xs text-text-muted mb-1">Etage</label>
              <select
                id="input-a_floor"
                value={logistics.a_floor || 'Erdgeschoss'}
                onChange={e => setLogistics({...logistics, a_floor: e.target.value})}
                className="input-field w-full"
              >
                {FLOOR_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-text-muted mb-1">Laufweg (m)</label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                value={logistics.a_distance === 0 ? '' : logistics.a_distance}
                onChange={e => setLogistics({...logistics, a_distance: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                className="input-field w-full"
                placeholder="Unter 10 Meter"
              />
            </div>
            
            <div className="col-span-4">
              <label className="block text-xs text-text-muted mb-2">Immobilienart</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {settings.propertyTypes?.map((pt:string) => (
                  <button 
                    key={pt} 
                    type="button" 
                    onClick={() => setLogistics({...logistics, a_type: pt})} 
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.a_type === pt ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-black/20 text-text-muted hover:border-white/30 hover:bg-black/40'}`}
                  >
                    {getPropertyIcon(pt)}
                    <span className="text-xs font-medium">{pt}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="col-span-4 mt-2 space-y-3">
              <label className="block text-xs text-text-muted mb-2">Besonderheiten (Auszug A)</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button" 
                  onClick={() => setLogistics({...logistics, a_elevator: !logistics.a_elevator})} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.a_elevator ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <ArrowsUpDownIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Aufzug</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    const nextA = !logistics.a_parking;
                    const nextLoc = nextA && logistics.b_parking ? 'both' : nextA ? 'a' : logistics.b_parking ? 'b' : 'a';
                    setLogistics({...logistics, a_parking: nextA, hvzLocation: nextLoc});
                    setOrderMeta({...orderMeta, hvzLocation: nextLoc});
                  }} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.a_parking ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <NoSymbolIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Halteverbot</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setLogistics({...logistics, a_furnitureLift: !logistics.a_furnitureLift})} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.a_furnitureLift ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <ArrowUpTrayIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Möbellift</span>
                </button>
              </div>

              {/* Inline HVZ Configuration when Halteverbot A is active */}
              {logistics.a_parking && (
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/30 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <NoSymbolIcon className="w-4 h-4" />
                      <span>Halteverbotszone (Auszug A) planen</span>
                    </span>
                    {orderMeta.movingDateFrom && (
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(orderMeta.movingDateFrom.split('T')[0]);
                          d.setDate(d.getDate() - 4);
                          const dStr = d.toISOString().split('T')[0];
                          setOrderMeta((prev: any) => ({ ...prev, halteverbotDateA: dStr, halteverbotDate: dStr }));
                          setLogistics((prev: any) => ({ ...prev, hvzDateA: dStr, hvzDate: dStr }));
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/15 text-primary hover:bg-primary hover:text-white transition-colors"
                      >
                        4 Tage vor Umzug setzen
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOrderMeta((prev: any) => ({ ...prev, hvzMethodA: 'selbst', hvzMethod: 'selbst' }));
                        setLogistics((prev: any) => ({ ...prev, hvzMethodA: 'selbst', hvzMethod: 'selbst' }));
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        (orderMeta.hvzMethodA || orderMeta.hvzMethod || 'selbst') === 'selbst'
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-bg-panel border-structure text-text-muted hover:text-text-main'
                      }`}
                    >
                      <TruckIcon className="w-4 h-4" />
                      <span>Selbst aufstellen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderMeta((prev: any) => ({ ...prev, hvzMethodA: 'extern', hvzMethod: 'extern' }));
                        setLogistics((prev: any) => ({ ...prev, hvzMethodA: 'extern', hvzMethod: 'extern' }));
                      }}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        (orderMeta.hvzMethodA || orderMeta.hvzMethod) === 'extern'
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-bg-panel border-structure text-text-muted hover:text-text-main'
                      }`}
                    >
                      <BuildingOffice2Icon className="w-4 h-4" />
                      <span>Externe Firma</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Aufstelldatum (A)</label>
                      <input
                        type="date"
                        value={orderMeta.halteverbotDateA || orderMeta.halteverbotDate || logistics.hvzDateA || logistics.hvzDate || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setOrderMeta((prev: any) => ({ ...prev, halteverbotDateA: val, halteverbotDate: val }));
                          setLogistics((prev: any) => ({ ...prev, hvzDateA: val, hvzDate: val }));
                        }}
                        className="input-field w-full text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Uhrzeit / Zeitfenster (A)</label>
                      <select
                        value={orderMeta.halteverbotTimeA || orderMeta.halteverbotTime || logistics.hvzTimeA || logistics.hvzTime || ''}
                        onChange={e => {
                          const val = e.target.value;
                          setOrderMeta((prev: any) => ({ ...prev, halteverbotTimeA: val, halteverbotTime: val }));
                          setLogistics((prev: any) => ({ ...prev, hvzTimeA: val, hvzTime: val }));
                        }}
                        className="input-field w-full text-xs"
                      >
                        <option value="">Zeitfenster wählen...</option>
                        <option value="08:00 - 12:00">08:00 - 12:00 (Vormittag)</option>
                        <option value="10:00 - 14:00">10:00 - 14:00 (Mittag)</option>
                        <option value="13:00 - 17:00">13:00 - 17:00 (Nachmittag)</option>
                        <option value="Ganztägig">Ganztägig (Flexibel)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div id="highlight-addressB" className="glass-panel p-6 rounded-2xl shadow-xl border-t-4 border-t-structure shadow-lg transition-all">
          <div className="flex justify-between items-center mb-4 border-b border-structure pb-2">
            <h2 className="text-xl font-bold text-text-main flex items-center gap-2">
              Entladeadresse (B)
              {!!(logistics.b_street && logistics.b_houseNr && logistics.b_zip && logistics.b_city) && <CheckCircleIcon className="w-5 h-5 text-green-500" />}
            </h2>
            <button onClick={() => copyCustomerAddress('b')} className="text-xs btn-secondary py-1 px-2">Kundenadresse übernehmen</button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Straße</label><input id="input-b_street" type="text" value={logistics.b_street} onChange={e => setLogistics({...logistics, b_street: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1"><label className="block text-xs text-text-muted mb-1">Haus-Nr.</label><input id="input-b_houseNr" type="text" value={logistics.b_houseNr} onChange={e => setLogistics({...logistics, b_houseNr: e.target.value})} className="input-field w-full" /></div>
            <div className="col-span-1">
              <label className="block text-xs text-text-muted mb-1">PLZ</label>
              <input id="input-b_zip" type="text" value={logistics.b_zip} onChange={async (e) => {
                  const val = e.target.value;
                  setLogistics((prev: any) => ({...prev, b_zip: val}));
                  if (val.length === 5) {
                    try {
                      const res = await fetch(`https://api.zippopotam.us/de/${val}`);
                      if (res.ok) {
                        const data = await res.json();
                        if (data.places && data.places.length > 0) {
                          setLogistics((prev: any) => ({...prev, b_zip: val, b_city: data.places[0]['place name']}));
                        }
                      }
                    } catch(err) {}
                  }
                }} className="input-field w-full" />
            </div>
            <div className="col-span-3"><label className="block text-xs text-text-muted mb-1">Ort</label><input id="input-b_city" type="text" value={logistics.b_city} onChange={e => setLogistics({...logistics, b_city: e.target.value})} className="input-field w-full" /></div>
            
            <div id="highlight-floorB" className="col-span-2 transition-all rounded-lg">
              <label className="block text-xs text-text-muted mb-1">Etage</label>
              <select
                id="input-b_floor"
                value={logistics.b_floor || 'Erdgeschoss'}
                onChange={e => setLogistics({...logistics, b_floor: e.target.value})}
                className="input-field w-full"
              >
                {FLOOR_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-text-muted mb-1">Laufweg (m)</label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="0"
                value={logistics.b_distance === 0 ? '' : logistics.b_distance}
                onChange={e => setLogistics({...logistics, b_distance: e.target.value === '' ? 0 : parseInt(e.target.value) || 0})}
                className="input-field w-full"
                placeholder="Unter 10 Meter"
              />
            </div>
            
            <div className="col-span-4">
              <label className="block text-xs text-text-muted mb-2">Immobilienart</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {settings.propertyTypes?.map((pt:string) => (
                  <button 
                    key={pt} 
                    type="button" 
                    onClick={() => setLogistics({...logistics, b_type: pt})} 
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.b_type === pt ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-black/20 text-text-muted hover:border-white/30 hover:bg-black/40'}`}
                  >
                    {getPropertyIcon(pt)}
                    <span className="text-xs font-medium">{pt}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="col-span-4 mt-2 space-y-3">
              <label className="block text-xs text-text-muted mb-2">Besonderheiten (Einzug B)</label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  type="button" 
                  onClick={() => setLogistics({...logistics, b_elevator: !logistics.b_elevator})} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.b_elevator ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <ArrowsUpDownIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Aufzug</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    const nextB = !logistics.b_parking;
                    const nextLoc = logistics.a_parking && nextB ? 'both' : nextB ? 'b' : logistics.a_parking ? 'a' : 'b';
                    setLogistics({...logistics, b_parking: nextB, hvzLocation: nextLoc});
                    setOrderMeta({...orderMeta, hvzLocation: nextLoc});
                  }} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.b_parking ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <NoSymbolIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Halteverbot</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setLogistics({...logistics, b_furnitureLift: !logistics.b_furnitureLift})} 
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${logistics.b_furnitureLift ? 'border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20' : 'border-structure bg-bg-dark text-text-muted hover:border-text-muted/30 hover:bg-bg-panel'}`}
                >
                  <ArrowUpTrayIcon className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Möbellift</span>
                </button>
              </div>

              {/* Inline HVZ Configuration when Halteverbot B is active */}
              {logistics.b_parking && (
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/30 space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <NoSymbolIcon className="w-4 h-4" />
                      <span>Halteverbotszone (Einzug B) planen</span>
                    </span>
                    {orderMeta.movingDateFrom && (
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(orderMeta.movingDateFrom.split('T')[0]);
                          d.setDate(d.getDate() - 4);
                          const dStr = d.toISOString().split('T')[0];
                          setOrderMeta((prev: any) => ({ ...prev, halteverbotDateB: dStr }));
                          setLogistics((prev: any) => ({ ...prev, hvzDateB: dStr }));
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/15 text-primary hover:bg-primary hover:text-white transition-colors"
                      >
                        4 Tage vor Umzug setzen
                      </button>
                    )}
                  </div>

                  {/* Sync with A Checkbox */}
                  {logistics.a_parking && (
                    <label className="flex items-center gap-2 p-2 rounded-lg bg-bg-dark/80 border border-structure cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(orderMeta.hvzSameAsA)}
                        onChange={e => {
                          const isSame = e.target.checked;
                          setOrderMeta((prev: any) => ({
                            ...prev,
                            hvzSameAsA: isSame,
                            halteverbotDateB: isSame ? (prev.halteverbotDateA || prev.halteverbotDate) : prev.halteverbotDateB,
                            halteverbotTimeB: isSame ? (prev.halteverbotTimeA || prev.halteverbotTime) : prev.halteverbotTimeB,
                            hvzMethodB: isSame ? (prev.hvzMethodA || prev.hvzMethod) : prev.hvzMethodB
                          }));
                          setLogistics((prev: any) => ({
                            ...prev,
                            hvzSameAsA: isSame,
                            hvzDateB: isSame ? (prev.hvzDateA || prev.hvzDate) : prev.hvzDateB,
                            hvzTimeB: isSame ? (prev.hvzTimeA || prev.hvzTime) : prev.hvzTimeB
                          }));
                        }}
                        className="accent-primary w-4 h-4"
                      />
                      <span className="font-semibold text-text-main">Gleicher Termin wie Beladestelle (A)</span>
                    </label>
                  )}

                  {!orderMeta.hvzSameAsA && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setOrderMeta((prev: any) => ({ ...prev, hvzMethodB: 'selbst' }));
                            setLogistics((prev: any) => ({ ...prev, hvzMethodB: 'selbst' }));
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            (orderMeta.hvzMethodB || 'selbst') === 'selbst'
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-bg-panel border-structure text-text-muted hover:text-text-main'
                          }`}
                        >
                          <TruckIcon className="w-4 h-4" />
                          <span>Selbst aufstellen</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOrderMeta((prev: any) => ({ ...prev, hvzMethodB: 'extern' }));
                            setLogistics((prev: any) => ({ ...prev, hvzMethodB: 'extern' }));
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                            orderMeta.hvzMethodB === 'extern'
                              ? 'bg-primary text-white border-primary shadow-xs'
                              : 'bg-bg-panel border-structure text-text-muted hover:text-text-main'
                          }`}
                        >
                          <BuildingOffice2Icon className="w-4 h-4" />
                          <span>Externe Firma</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Aufstelldatum (B)</label>
                          <input
                            type="date"
                            value={orderMeta.halteverbotDateB || logistics.hvzDateB || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setOrderMeta((prev: any) => ({ ...prev, halteverbotDateB: val }));
                              setLogistics((prev: any) => ({ ...prev, hvzDateB: val }));
                            }}
                            className="input-field w-full text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-text-muted font-bold uppercase mb-1">Uhrzeit / Zeitfenster (B)</label>
                          <select
                            value={orderMeta.halteverbotTimeB || logistics.hvzTimeB || ''}
                            onChange={e => {
                              const val = e.target.value;
                              setOrderMeta((prev: any) => ({ ...prev, halteverbotTimeB: val }));
                              setLogistics((prev: any) => ({ ...prev, hvzTimeB: val }));
                            }}
                            className="input-field w-full text-xs"
                          >
                            <option value="">Zeitfenster wählen...</option>
                            <option value="08:00 - 12:00">08:00 - 12:00 (Vormittag)</option>
                            <option value="10:00 - 14:00">10:00 - 14:00 (Mittag)</option>
                            <option value="13:00 - 17:00">13:00 - 17:00 (Nachmittag)</option>
                            <option value="Ganztägig">Ganztägig (Flexibel)</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Routen-Details (from Mockups) */}
        <section className="col-span-1 lg:col-span-2 glass-panel p-6 md:p-8 rounded-2xl shadow-xl border border-structure">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-2xl">map</span>
              </div>
              <div>
                <h3 className="text-xl font-headline font-bold text-text-main">Routen-Details</h3>
                <p className="text-xs text-text-muted font-display uppercase tracking-widest font-bold">Distanz &amp; Logistik-Check</p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-right">
                <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Distanz</span>
                <span className="text-2xl font-headline font-extrabold text-[#D91E2A] dark:text-red-400">
                  {routeInfo ? `${routeInfo.distanceKm} km` : '— km'}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] font-bold text-text-muted uppercase tracking-widest">Dauer (LKW)</span>
                <span className="text-2xl font-headline font-extrabold text-sky-600 dark:text-sky-400">
                  {routeInfo ? `~${Math.floor(routeInfo.durationMinutes / 60)}:${(routeInfo.durationMinutes % 60).toString().padStart(2, '0')} h` : '— h'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-structure">
            <button 
              type="button"
              onClick={handleCalculateRoute}
              disabled={isCalculatingRoute}
              className="py-2.5 px-6 bg-primary text-white text-xs font-bold rounded-full hover:brightness-110 transition-all flex items-center gap-2 shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-base">directions_car</span>
              {isCalculatingRoute ? "Berechne Route..." : "Strecke & Fahrzeit berechnen"}
            </button>
            <a 
              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(`${logistics.a_street || ''} ${logistics.a_houseNr || ''}, ${logistics.a_zip || ''} ${logistics.a_city || ''}`)}&destination=${encodeURIComponent(`${logistics.b_street || ''} ${logistics.b_houseNr || ''}, ${logistics.b_zip || ''} ${logistics.b_city || ''}`)}`}
              target="_blank" 
              rel="noreferrer" 
              className="py-2.5 px-6 bg-slate-100 dark:bg-slate-800 text-text-main text-xs font-bold rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2 border border-structure"
            >
              <span className="material-symbols-outlined text-base">open_in_new</span>
              Auf Google Maps öffnen
            </a>
            {routeError && (
              <span className="text-xs text-red-500 font-medium pl-2">{routeError}</span>
            )}
          </div>
        </section>
      </section>

      
        </div>
      )}

      {currentStep === 3 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-structure pb-4">
            <div>
              <h2 className="text-2xl font-headline font-bold text-text-main flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_task</span>
                Leistungen &amp; Finanzen
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Dienstleistungsauswahl nach Belade- und Entladestelle sowie Kostenkalkulation.
              </p>
            </div>
            <label className={`flex items-center gap-2 bg-white/[0.03] px-3.5 py-2 rounded-xl border border-structure shadow-sm ${!canEditPrices ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
              <input 
                type="checkbox" 
                checked={isFlatRate} 
                onChange={e => setIsFlatRate(e.target.checked)} 
                disabled={!canEditPrices} 
                className="accent-primary w-4 h-4 rounded" 
              />
              <span className="text-xs font-bold text-text-main">Pauschalangebot (Festpreis)</span>
            </label>
          </div>

          <div className="grid grid-cols-12 gap-8">
            {/* Left: Quick Service Selection A vs B */}
            <div className="col-span-12 lg:col-span-7 flex flex-col gap-6">
              <div className="bg-bg-card rounded-2xl p-6 border border-structure shadow-md">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-headline font-bold flex items-center gap-2 text-text-main">
                    <span className="material-symbols-outlined text-primary">touch_app</span>
                    Leistungsauswahl (Schnell-Auswahl)
                  </h3>
                  <span className="bg-primary/10 text-primary text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                    Belade- vs. Entladestelle
                  </span>
                </div>

                {/* Standard-Leistungen Picker (Typische Umzugsleistungen - Allgemein) */}
                <div className="mb-6 bg-bg-dark/40 rounded-2xl border border-structure/60 shadow-sm p-4 sm:p-5 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-structure/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl">view_list</span>
                      <span className="text-sm font-headline font-bold text-text-main">
                        Typische Umzugsleistungen
                      </span>
                    </div>
                    <span className="self-start sm:self-auto text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Allgemein ({allgemeinServices.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    {allgemeinServices.map((svc: any, idx: number) => {
                      const isSelected = isStandardServiceSelected(svc.id, svc.name);
                      const qty = getServiceQuantity(svc.id, svc.name);
                      const icon = svc.icon || getServiceIcon(svc.name);
                      return (
                        <button
                          key={svc.id || svc.name || idx}
                          type="button"
                          onClick={() => toggleStandardService(svc)}
                          className={`group relative flex items-start justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/40 font-bold'
                              : 'border-structure/80 bg-white/[0.02] text-text-main hover:bg-white/[0.05] hover:border-structure'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 pr-2">
                            <span className={`material-symbols-outlined text-lg shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-text-muted group-hover:text-text-main'} transition-colors`}>
                              {icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-semibold leading-snug line-clamp-2 block break-words">
                                {svc.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {((svc.price || svc.defaultPrice || 0) > 0 || svc.unit) && (
                                  <span className="text-[10px] text-text-muted font-normal">
                                    {(svc.price || svc.defaultPrice || 0) > 0 ? `${(svc.price || svc.defaultPrice).toFixed(2)} € ` : ''}
                                    {svc.unit ? `(${svc.unit})` : ''}
                                  </span>
                                )}
                                {isSelected && qty > 1 && (
                                  <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded font-bold">
                                    {qty}x
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={`material-symbols-outlined text-lg shrink-0 ${isSelected ? 'text-primary' : 'text-text-muted/50 group-hover:text-text-muted'} transition-colors`}>
                            {isSelected ? 'check_circle' : 'add_circle'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weitere Katalog-Leistungen (Vor Belade- und Entladestelle) */}
                <div className="mb-6 bg-bg-dark/40 rounded-2xl border border-structure/60 shadow-sm p-4 sm:p-5 flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-structure/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl">menu_book</span>
                      <div>
                        <span className="text-sm font-headline font-bold text-text-main block">
                          Weitere Katalog-Leistungen
                        </span>
                        <span className="text-[10px] text-text-muted">
                          Zusatzservices, Küchen-, Karton- & Möbelservice
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <span className="text-[10px] text-text-muted bg-white/[0.04] border border-structure/50 px-2 py-0.5 rounded-full font-medium">
                        {filteredOtherCatalogItems.length} Positionen
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowFullCatalog(!showFullCatalog)}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {showFullCatalog ? 'expand_less' : 'expand_more'}
                        </span>
                        <span>{showFullCatalog ? 'Einklappen' : 'Katalog öffnen'}</span>
                      </button>
                    </div>
                  </div>

                  {showFullCatalog && (
                    <div className="space-y-3.5 animate-in fade-in duration-200">
                      {/* Search Bar */}
                      <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input 
                          type="text" 
                          placeholder="Weitere Leistungen suchen (z.B. Aufbau Küche, Montage, Kartons)..." 
                          value={catalogSearch} 
                          onChange={e => setCatalogSearch(e.target.value)} 
                          className="input-field w-full pl-9 pr-8 py-2 rounded-xl bg-black/20 text-xs shadow-inner" 
                        />
                        {catalogSearch && (
                          <button
                            type="button"
                            onClick={() => setCatalogSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-white"
                          >
                            <XMarkIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Category Filter Tabs */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                        <button 
                          type="button"
                          onClick={() => setActiveCategoryTab('Alle')} 
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${activeCategoryTab === 'Alle' ? 'bg-primary text-white shadow-xs' : 'bg-structure/50 text-text-muted hover:bg-structure hover:text-text-main'}`}
                        >
                          Alle weiteren
                        </button>
                        {otherCatalogCategories.map((catName: string) => (
                          <button 
                            key={catName} 
                            type="button"
                            onClick={() => setActiveCategoryTab(catName)} 
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${activeCategoryTab === catName ? 'bg-primary text-white shadow-xs' : 'bg-structure/50 text-text-muted hover:bg-structure hover:text-text-main'}`}
                          >
                            {catName}
                          </button>
                        ))}
                      </div>

                      {/* Items Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {filteredOtherCatalogItems.length === 0 ? (
                          <div className="col-span-full py-6 text-center text-xs text-text-muted italic">
                            Keine weiteren Leistungen gefunden.
                          </div>
                        ) : (
                          filteredOtherCatalogItems.map((item: any, idx: number) => {
                            const isSelected = isStandardServiceSelected(item.id || item.name, item.name);
                            const qty = getServiceQuantity(item.id || item.name, item.name);
                            const icon = item.icon || getServiceIcon(item.name);
                            return (
                              <button 
                                key={item.id || item.name || idx} 
                                type="button"
                                onClick={() => toggleStandardService(item)} 
                                className={`group flex items-start justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/40 font-bold'
                                    : 'border-structure/80 bg-white/[0.02] text-text-main hover:bg-white/[0.05] hover:border-structure'
                                }`}
                              >
                                <div className="flex items-start gap-2.5 min-w-0 pr-2">
                                  <span className={`material-symbols-outlined text-base shrink-0 mt-0.5 ${isSelected ? 'text-primary' : 'text-text-muted group-hover:text-text-main'} transition-colors`}>
                                    {icon}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <span className="text-xs font-semibold leading-snug line-clamp-2 block break-words">
                                      {item.name}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-text-muted font-normal">
                                        {!isFlatRate && (item.price || item.defaultPrice || 0) > 0 
                                          ? `${(item.price || item.defaultPrice).toFixed(2)} €` 
                                          : 'Katalog'}
                                        {item.unit ? ` / ${item.unit}` : ''}
                                      </span>
                                      {isSelected && qty > 1 && (
                                        <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded font-bold">
                                          {qty}x
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className={`material-symbols-outlined text-base shrink-0 ${isSelected ? 'text-primary' : 'text-text-muted/50 group-hover:text-text-muted'}`}>
                                  {isSelected ? 'check_circle' : 'add_circle'}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Beladestelle (A) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-structure/50">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                        A
                      </span>
                      <h4 className="font-headline font-bold text-xs uppercase tracking-wider text-text-main">
                        Beladestelle
                      </h4>
                    </div>
                    <div className="flex flex-col gap-2">
                      {STANDARD_SERVICES_A.map((svc) => {
                        const isSelected = isStandardServiceSelected(svc.id, svc.name);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => toggleStandardService(svc)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30 font-bold'
                                : 'border-structure/80 bg-white/[0.02] text-text-main hover:bg-white/[0.05] hover:border-structure'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-primary' : 'text-text-muted'}`}>
                                {svc.icon}
                              </span>
                              <span className="text-xs font-semibold">{svc.name}</span>
                            </div>
                            <span className={`material-symbols-outlined text-base ${isSelected ? 'text-primary' : 'text-text-muted/60'}`}>
                              {isSelected ? 'check_circle' : 'add_circle'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Entladestelle (B) */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-structure/50">
                      <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                        B
                      </span>
                      <h4 className="font-headline font-bold text-xs uppercase tracking-wider text-text-main">
                        Entladestelle
                      </h4>
                    </div>
                    <div className="flex flex-col gap-2">
                      {STANDARD_SERVICES_B.map((svc) => {
                        const isSelected = isStandardServiceSelected(svc.id, svc.name);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => toggleStandardService(svc)}
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left cursor-pointer ${
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/30 font-bold'
                                : 'border-structure/80 bg-white/[0.02] text-text-main hover:bg-white/[0.05] hover:border-structure'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-primary' : 'text-text-muted'}`}>
                                {svc.icon}
                              </span>
                              <span className="text-xs font-semibold">{svc.name}</span>
                            </div>
                            <span className={`material-symbols-outlined text-base ${isSelected ? 'text-primary' : 'text-text-muted/60'}`}>
                              {isSelected ? 'check_circle' : 'add_circle'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* System Tip */}
                <div className="mt-6 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-amber-300 flex items-start gap-3">
                  <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">info</span>
                  <div className="text-xs leading-relaxed">
                    <p className="font-headline font-bold">Tipp vom System</p>
                    <p className="opacity-90">
                      Halteverbotszonen für A und B werden bei Auswahl automatisch auf die Mitarbeiter-Laufzettel und die Fristen-Erinnerung gesetzt.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Preiskalkulation & Total Summary Card */}
            <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
              {/* Preiskalkulation Table */}
              <div className="bg-bg-card rounded-2xl border border-structure shadow-md overflow-hidden flex flex-col">
                <div className="px-5 py-3.5 bg-white/[0.03] flex items-center justify-between border-b border-structure">
                  <h3 className="text-sm font-headline font-bold flex items-center gap-2 text-text-main">
                    <span className="material-symbols-outlined text-blue-400 text-lg">calculate</span>
                    Preiskalkulation
                  </h3>
                  <span className="text-[11px] font-bold text-text-muted bg-structure/50 px-2 py-0.5 rounded-full">
                    {services.length} Positionen
                  </span>
                </div>

                <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-structure/40">
                  {services.length === 0 ? (
                    <div className="p-8 text-center text-text-muted text-xs">
                      Keine Leistungen gewählt. Klicken Sie links auf Leistungen zum Hinzufügen.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-white/[0.01] text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-structure/40">
                          <th className="p-2.5 pl-4">Service</th>
                          <th className="p-2.5 text-center w-24">Menge</th>
                          <th className="p-2.5 pr-4 text-right w-24">Summe</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-structure/30">
                        {services.map((svc, idx) => (
                          <tr key={svc.id} className="hover:bg-white/[0.02] transition-colors group align-top">
                            <td className="p-2.5 pl-4 flex flex-col gap-1.5">
                              <input
                                type="text"
                                value={svc.name}
                                onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                                className="bg-transparent font-medium text-text-main w-full focus:outline-none focus:bg-black/20 rounded px-1"
                              />
                              <textarea
                                value={svc.note || ''}
                                onChange={e => setServices(prev => prev.map((s, i) => i === idx ? { ...s, note: e.target.value } : s))}
                                placeholder="Optionale Beschreibung (erscheint im Angebot)..."
                                className="text-[10px] text-text-muted bg-black/10 focus:bg-black/20 focus:outline-none rounded px-2 py-1 w-full resize-y min-h-[36px]"
                                rows={1}
                              />
                              <div className="flex items-center gap-1.5 pt-0.5">
                                <span className="text-[10px] font-bold text-text-muted uppercase">Ort:</span>
                                <div className="inline-flex rounded-lg p-0.5 bg-structure/40 border border-white/5">
                                  <button
                                    type="button"
                                    onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, location: 'a' } : s))}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                      svc.location === 'a' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
                                    }`}
                                  >
                                    A (Beladung)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, location: 'b' } : s))}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                      svc.location === 'b' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
                                    }`}
                                  >
                                    B (Entladung)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, location: 'both' } : s))}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                                      !svc.location || svc.location === 'both' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text-main'
                                    }`}
                                  >
                                    Beide
                                  </button>
                                </div>
                              </div>
                            </td>
                            <td className="p-2.5 text-center pt-3">
                              <div className="inline-flex items-center gap-1 bg-structure/40 rounded-lg px-1.5 py-0.5">
                                <button 
                                  type="button"
                                  onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: Math.max(0, s.quantity - 1) } : s))} 
                                  className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-white font-bold"
                                >
                                  -
                                </button>
                                <span className="font-bold w-6 text-center text-text-main">{svc.quantity}</span>
                                <button 
                                  type="button"
                                  onClick={() => setServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: s.quantity + 1 } : s))} 
                                  className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-white font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-2.5 pr-4 text-right font-bold text-text-main">
                              {!isFlatRate && canViewPrices ? `${(svc.quantity * svc.unitPrice).toFixed(2)} €` : '—'}
                            </td>
                            <td className="pr-2 text-right">
                              <button
                                type="button"
                                onClick={() => setServices(services.filter(s => s.id !== svc.id))}
                                className="text-text-muted hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="p-3 border-t border-structure/50 bg-white/[0.01]">
                  <button
                    type="button"
                    onClick={() => setServices([...services, { id: Date.now().toString(), name: 'Individuelle Leistung', quantity: 1, unitPrice: 0, unit: 'Pauschal' }])}
                    className="w-full py-2 border border-dashed border-structure rounded-xl text-primary hover:bg-primary/5 transition-colors flex items-center justify-center gap-1.5 text-xs font-semibold"
                  >
                    <PlusIcon className="w-4 h-4" /> Eigene Leistung hinzufügen
                  </button>
                </div>
              </div>

              {/* Red-Bordered BRUTTO GESAMT Summary Card */}
              <div className="relative overflow-hidden bg-bg-card border-2 border-primary/60 rounded-2xl shadow-xl p-6">
                <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex flex-col gap-4 relative z-10">
                  {isFlatRate && (
                    <div className="mb-2">
                      <label className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1 block">
                        Pauschalabrechnung (Netto)
                      </label>
                      <div className="relative">
                        <input 
                          type="number" 
                          value={flatRateNet} 
                          onChange={e => setFlatRateNet(parseFloat(e.target.value)||0)} 
                          disabled={!canEditPrices} 
                          className="input-field w-full text-right font-bold text-base pr-8 py-2" 
                          placeholder="0.00" 
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-text-muted text-sm">€</span>
                      </div>
                    </div>
                  )}

                  {canViewPrices ? (
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-dashed border-structure/60 pb-1.5">
                        <span className="text-text-muted font-medium">Netto Summe</span>
                        <span className="text-text-main font-bold">{totals.net.toFixed(2)} €</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-dashed border-structure/60 pb-1.5">
                        <span className="text-text-muted font-medium">USt. (19%)</span>
                        <span className="text-text-main font-bold">{totals.tax.toFixed(2)} €</span>
                      </div>
                      <div className="flex flex-col gap-0.5 pt-2">
                        <span className="text-[10px] font-extrabold text-primary uppercase tracking-[0.2em]">
                          BRUTTO GESAMT
                        </span>
                        <span className="text-4xl font-headline font-black text-primary tracking-tight">
                          {totals.gross.toFixed(2)} €
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-text-muted text-xs italic py-2">
                      Preise ausgeblendet
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleQuoteActionWithCheck(() => saveOrder('draft', true))}
                      disabled={isSaving}
                      className={`w-full py-3 rounded-xl font-headline font-bold text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        !hasServices
                          ? 'bg-slate-700/80 hover:bg-slate-700 text-slate-200 border border-amber-500/40 shadow-none'
                          : 'bg-primary text-white shadow-primary/20 hover:brightness-110'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">description</span>
                      <span>Angebot Erstellen</span>
                      {!hasServices && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 lowercase font-normal">
                          0 leistungen
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveOrder('draft', false)}
                      disabled={isSaving}
                      className="w-full py-2 bg-white/[0.04] text-text-main border border-structure/60 rounded-xl font-bold text-xs hover:bg-white/[0.08] transition-all"
                    >
                      Zwischenspeichern
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-structure pb-4">
            <div>
              <h2 className="text-2xl font-headline font-bold text-text-main flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">inventory_2</span>
                Inventar &amp; Ladevolumen
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Raumbasierte Schnell-Erfassung von Möbeln &amp; Kartons mit automatischer $m^3$- und LKW-Kalkulation.
              </p>
            </div>
            <label className="flex items-center gap-2 bg-white/[0.03] px-3.5 py-2 rounded-xl border border-structure shadow-sm cursor-pointer">
              <input 
                type="checkbox" 
                checked={appendInventoryToPDF} 
                onChange={e => setAppendInventoryToPDF(e.target.checked)} 
                className="accent-primary w-4 h-4 rounded" 
              />
              <span className="text-xs font-bold text-text-main">Inventarliste an PDF-Angebot anhängen</span>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Auszugsort -> Raum-Auswahl -> Möbel-Katalog */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Section 1: 1. Auszugsort & Raum-Konfiguration */}
              <div className="bg-bg-card rounded-2xl p-5 border border-structure shadow-md relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                      <span className="material-symbols-outlined text-2xl">location_on</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                          Auszugsort (Beladestelle A)
                        </span>
                        {logistics.a_type && (
                          <span className="text-[11px] text-text-muted font-medium">
                            • {logistics.a_type}
                          </span>
                        )}
                        {logistics.a_floor && (
                          <span className="text-[11px] text-text-muted font-medium">
                            • {logistics.a_floor}
                          </span>
                        )}
                        {logistics.a_elevator && (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            Aufzug
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-headline font-bold text-text-main mt-1">
                        {logistics.a_street 
                          ? `${logistics.a_street} ${logistics.a_houseNr || ''}, ${logistics.a_zip || ''} ${logistics.a_city || ''}`.trim() 
                          : 'Beladestelle (Auszugsadresse A)'}
                      </h3>
                      <p className="text-xs text-text-muted mt-0.5">
                        Definieren Sie als ersten Schritt die Anzahl der Zimmer für diesen Auszugsort.
                      </p>
                    </div>
                  </div>

                  {/* Button: Detaillierter Assistent */}
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setInitialWizardRoom(null);
                        setIsInventoryWizardOpen(true);
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-primary text-white font-headline font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">tune</span>
                      <span>Detaillierter Assistent</span>
                    </button>
                  </div>
                </div>

                {/* Konfigurierte Räume Badges */}
                <div className="mt-4 pt-3.5 border-t border-structure/60 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-text-muted mr-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-primary">meeting_room</span>
                    Zimmer am Auszugsort:
                  </span>
                  {totalConfiguredRoomsCount > 0 ? (
                    <>
                      {Object.entries(roomCounts).filter(([_, c]) => c > 0).map(([rId, count]) => {
                        const roomObj = ROOM_TYPES.find(r => r.id === rId) || ROOM_CATALOG.find(r => r.id === rId);
                        const rName = roomObj?.name || rId;
                        return (
                          <span
                            key={rId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-structure text-xs font-semibold text-text-main"
                          >
                            <span className="font-extrabold text-primary">{count}x</span>
                            <span>{rName}</span>
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setInitialWizardRoom(null);
                          setIsInventoryWizardOpen(true);
                        }}
                        className="text-xs text-primary hover:underline font-bold ml-1.5 flex items-center gap-0.5"
                      >
                        <span className="material-symbols-outlined text-xs">edit</span>
                        Zimmer anpassen
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-text-muted italic">
                      Noch keine Räume ausgewählt. Klicken Sie auf <strong>„Detaillierter Assistent“</strong>, um die Zimmer der Auszugsadresse festzulegen.
                    </span>
                  )}
                </div>
              </div>

              {/* Section 2: 2. Raum-Auswahl (Raumauswahl) */}
              <div className="bg-bg-card rounded-2xl p-5 border border-structure shadow-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-headline font-bold text-text-main flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">door_front</span>
                    2. Raum-Auswahl
                  </h3>
                  {selectedRoomTab && (
                    <span className="text-xs text-text-muted">
                      Ausgewählt: <strong className="text-primary">{selectedRoomTab}</strong>
                    </span>
                  )}
                </div>

                {availableRoomTabs.length > 0 ? (
                  <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar">
                    {availableRoomTabs.map((room: any) => {
                      const isSelected = selectedRoomTab.toLowerCase() === room.name.toLowerCase();
                      const itemsInRoom = inventory.filter(i => (i.room || '').toLowerCase() === room.name.toLowerCase()).reduce((sum, i) => sum + i.quantity, 0);
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => setSelectedRoomTab(room.name)}
                          className={`flex-shrink-0 px-4 py-3 rounded-xl border transition-all flex flex-col items-center gap-1.5 min-w-[95px] ${
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25 scale-[1.02]'
                              : 'bg-white/[0.02] border-structure/80 text-text-main hover:border-structure hover:bg-white/[0.05]'
                          }`}
                        >
                          <span className={`material-symbols-outlined text-xl ${isSelected ? 'text-white' : 'text-text-muted'}`}>
                            {room.icon}
                          </span>
                          <span className="text-xs font-bold whitespace-nowrap">{room.name}</span>
                          {itemsInRoom > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${isSelected ? 'bg-white/20 text-white' : 'bg-primary/20 text-primary'}`}>
                              {itemsInRoom} Stk.
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-7 px-4 rounded-xl border border-dashed border-structure/80 bg-white/[0.01]">
                    <span className="material-symbols-outlined text-3xl text-text-muted mb-2">meeting_room</span>
                    <p className="text-xs font-bold text-text-main">Noch keine Räume für den Auszugsort festgelegt</p>
                    <p className="text-[11px] text-text-muted mt-1 max-w-sm mx-auto mb-3">
                      Legen Sie zuerst über <strong>„Detaillierter Assistent“</strong> die Räume Ihrer Auszugsadresse fest. Es werden ausschließlich die von Ihnen ausgewählten Räume angezeigt.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setInitialWizardRoom(null);
                        setIsInventoryWizardOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">tune</span>
                      <span>Räume jetzt auswählen</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Section 3: Möbel-Katalog mit Zählern (nur sichtbar wenn Raum gewählt) */}
              {availableRoomTabs.length > 0 && selectedRoomTab ? (
                <div className="bg-bg-card rounded-2xl p-5 border border-structure shadow-md space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-headline font-bold text-text-main flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">chair</span>
                      3. Möbel &amp; Umzugsgut für {selectedRoomTab}
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Gegenstände für diesen Raum auswählen. Mengen werden direkt addiert.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setInitialWizardRoom(null); setIsInventoryWizardOpen(true); }}
                    className="text-primary text-xs font-bold flex items-center gap-1 hover:underline px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    Detaillierter Assistent
                  </button>
                </div>

                {(() => {
                  const activeTabObj = availableRoomTabs.find((t: any) => t.name.toLowerCase() === selectedRoomTab.toLowerCase()) || availableRoomTabs[0];
                  const baseCatName = activeTabObj?.baseCategory || selectedRoomTab;
                  const activeRoomData = ROOM_CATALOG.find(r => 
                    r.name.toLowerCase() === baseCatName.toLowerCase() ||
                    baseCatName.toLowerCase().includes(r.name.toLowerCase()) ||
                    r.name.toLowerCase().includes(baseCatName.toLowerCase())
                  ) || ROOM_CATALOG[0];

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {activeRoomData.items.map(item => {
                        const count = getFurnitureCount(item.name, selectedRoomTab);
                        const isPicked = count > 0;
                        return (
                          <div
                            key={item.id}
                            className={`p-3 rounded-xl border transition-all flex flex-col items-center text-center relative ${
                              isPicked
                                ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                                : 'border-structure/80 bg-white/[0.02] hover:border-structure hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className={`w-11 h-11 rounded-full mb-2 flex items-center justify-center transition-colors ${
                              isPicked ? 'bg-primary/20 text-primary' : 'bg-structure/50 text-text-muted'
                            }`}>
                              <span className="material-symbols-outlined text-2xl">{item.icon}</span>
                            </div>
                            <p className="font-bold text-xs text-text-main mb-0.5 line-clamp-1">{item.name}</p>
                            <p className="text-[10px] text-text-muted mb-2.5 font-medium">~{item.cbm} m³</p>

                            <div className="flex items-center gap-2 w-full justify-between px-2 bg-structure/40 rounded-lg py-1 border border-white/5 mt-auto">
                              <button
                                type="button"
                                onClick={() => updateFurnitureCount(item, selectedRoomTab, -1)}
                                disabled={count === 0}
                                className="w-7 h-7 rounded-md bg-white/[0.05] hover:bg-white/10 text-text-main flex items-center justify-center font-bold text-sm disabled:opacity-30 transition-colors"
                              >
                                -
                              </button>
                              <span className={`font-black text-xs ${isPicked ? 'text-primary' : 'text-text-muted'}`}>
                                {count}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateFurnitureCount(item, selectedRoomTab, 1)}
                                className="w-7 h-7 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-sm"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Inline Custom Item Card */}
                      <div className="p-3 rounded-xl border border-dashed border-structure/90 bg-white/[0.02] flex flex-col justify-between min-h-[140px]">
                        {!isAddingCustom ? (
                          <button
                            type="button"
                            onClick={() => setIsAddingCustom(true)}
                            className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-text-muted hover:text-primary transition-colors group p-2 text-center"
                          >
                            <span className="material-symbols-outlined text-3xl group-hover:scale-110 transition-transform text-primary">add_circle</span>
                            <span className="text-xs font-bold text-text-main">+ Eigener Gegenstand</span>
                            <span className="text-[10px] text-text-muted leading-tight">Zu {selectedRoomTab}</span>
                          </button>
                        ) : (
                          <div className="space-y-2 flex flex-col justify-between h-full">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-text-main">Möbelstück</span>
                                <button 
                                  type="button" 
                                  onClick={() => { setIsAddingCustom(false); setCustomItemName(''); }}
                                  className="text-text-muted hover:text-red-400 text-xs px-1"
                                >
                                  ✕
                                </button>
                              </div>
                              <input
                                type="text"
                                value={customItemName}
                                onChange={e => setCustomItemName(e.target.value)}
                                placeholder="z.B. Schminktisch"
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-structure bg-bg-card text-text-main focus:border-primary mb-1.5"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCustomFurniture(selectedRoomTab);
                                  }
                                }}
                              />
                              <div className="flex items-center justify-between gap-1 text-[11px] text-text-muted">
                                <span>m³:</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0.1"
                                  value={customItemCbm}
                                  onChange={e => setCustomItemCbm(e.target.value)}
                                  className="w-16 text-xs px-1.5 py-0.5 rounded border border-structure bg-bg-card text-text-main text-center"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddCustomFurniture(selectedRoomTab)}
                              disabled={!customItemName.trim()}
                              className="w-full py-1.5 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-40 hover:brightness-110 transition-all shadow-sm"
                            >
                              Hinzufügen
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
              ) : null}

              {/* Section 3: Erfasste Gegenstände Übersicht */}
              {inventory.length > 0 && (
                <div className="bg-bg-card rounded-2xl p-5 border border-structure shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-headline font-bold text-text-main flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary">checklist</span>
                      Erfasstes Umzugsgut ({inventory.reduce((sum, i) => sum + i.quantity, 0)} Teile)
                    </h3>
                    <button
                      type="button"
                      onClick={() => setInventory([])}
                      className="text-[11px] text-red-400 hover:underline"
                    >
                      Alle leeren
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-structure/40 text-xs">
                    {inventory.map(item => (
                      <div key={item.id} className="py-2 px-1 flex items-center justify-between hover:bg-white/[0.02]">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-text-muted bg-structure/50 px-2 py-0.5 rounded">
                            {item.room || 'Allgemein'}
                          </span>
                          <span className="font-semibold text-text-main">{item.name}</span>
                          {(item.disassembly || item.assembly) && (
                            <span className="text-[10px] text-amber-400">
                              {[item.disassembly && 'Abbau', item.assembly && 'Aufbau'].filter(Boolean).join(' & ')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-primary">{item.quantity}x</span>
                          <button
                            type="button"
                            onClick={() => setInventory(inventory.filter(i => i.id !== item.id))}
                            className="text-text-muted hover:text-red-400 p-1"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section 4: Mitarbeiter-Checkliste */}
              <div className="bg-bg-card rounded-2xl p-5 border border-structure shadow-md">
                <div className="flex items-center justify-between mb-3 border-b border-structure pb-2">
                  <div>
                    <h3 className="text-sm font-headline font-bold text-text-main flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-400">assignment</span>
                      Mitarbeiter-Laufzettel &amp; Checkliste
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5">
                      Wird automatisch auf dem Einsatzplan für die Umzugshelfer gedruckt.
                    </p>
                  </div>
                </div>
                <div className="space-y-2 mb-3">
                  {checklist.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border bg-white/[0.02] border-structure/80 text-xs">
                      <button
                        type="button"
                        onClick={() => setChecklist(checklist.map(c => c.id === item.id ? { ...c, done: !c.done } : c))}
                        className="flex items-center gap-2.5 flex-1 text-left"
                      >
                        {item.done ? (
                          <CheckCircleIconSolid className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <CheckCircleIcon className="w-4 h-4 text-text-muted shrink-0" />
                        )}
                        <span className={`font-medium transition-all ${item.done ? 'text-text-muted line-through' : 'text-text-main'}`}>
                          {item.text}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChecklist(checklist.filter(c => c.id !== item.id))}
                        className="text-text-muted hover:text-red-400 p-1"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 relative">
                  <input
                    type="text"
                    value={newChecklistItem}
                    onChange={e => setNewChecklistItem(e.target.value)}
                    placeholder="Neuer Punkt (z.B. Klaviertragegurt bereitlegen)..."
                    className="input-field w-full pr-10 text-xs py-2"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newChecklistItem.trim()) {
                          setChecklist([...checklist, { id: Date.now().toString(), text: newChecklistItem.trim(), done: false }]);
                          setNewChecklistItem('');
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newChecklistItem.trim()) {
                        setChecklist([...checklist, { id: Date.now().toString(), text: newChecklistItem.trim(), done: false }]);
                        setNewChecklistItem('');
                      }
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary hover:text-primary-hover"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Live Summary, Loading Bar & Vehicle Selector */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-bg-card p-6 rounded-2xl border border-structure shadow-xl sticky top-24 space-y-6">
                <h3 className="text-base font-headline font-bold flex items-center gap-2 text-text-main border-b border-structure pb-3">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  Volumen &amp; LKW-Kalkulation
                </h3>

                {/* Key Metrics */}
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center border-b border-structure/40 pb-2">
                    <span className="text-text-muted">Erfasste Gegenstände</span>
                    <span className="font-bold text-text-main">{totalFurniturePieces} Stück</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-structure/40 pb-2">
                    <span className="text-text-muted">Empfohlene Fahrzeugklasse</span>
                    <span className="font-bold text-primary">
                      {calculateQuickCbm() <= 20
                        ? '1x Sprinter 3.5t (Standard)'
                        : calculateQuickCbm() <= 38
                          ? '1x 3.5t (2 Touren) oder 1x 7.5t LKW'
                          : '2x Fahrzeuge (LKW + Sprinter)'}
                    </span>
                  </div>
                </div>

                {/* Visual Loading Bar */}
                <div>
                  {(() => {
                    const activeCbm = calculateQuickCbm() > 0 ? calculateQuickCbm() : estimatedCbm || 0;
                    const maxCap = truckChoice === '1_transporter' ? 20 : truckChoice === '1_lkw' ? 35 : 65;
                    const pct = Math.min(100, Math.round((activeCbm / maxCap) * 100));
                    return (
                      <div>
                        <div className="flex justify-between items-end mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                            Ladekapazität ({truckChoice === '1_transporter' ? '3.5t Sprinter (Standard)' : truckChoice === '1_lkw' ? '7.5t LKW' : truckChoice === '2_lkw' ? '2x Fahrzeuge' : 'Manuell'})
                          </span>
                          <span className="text-xs font-bold text-primary">{pct}%</span>
                        </div>
                        <div className="h-3.5 bg-structure/50 rounded-full overflow-hidden flex border border-white/5">
                          <div
                            className="bg-primary h-full transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                          <div
                            className="bg-blue-400/30 h-full border-l border-white/20 transition-all duration-300"
                            style={{ width: `${Math.min(100 - pct, 15)}%` }}
                          />
                        </div>
                        <div className="flex gap-4 mt-2 text-[10px] text-text-muted">
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary" /> Inventar ({activeCbm.toFixed(1)} m³)
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-400/50" /> Puffer (+15%)
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Total Volumen Highlight Box */}
                <div className="p-5 bg-primary/10 rounded-2xl border border-primary/30 text-center shadow-inner">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-primary mb-1">
                    Total Ladevolumen (m³)
                  </p>
                  <p className="text-5xl font-headline font-black text-primary tracking-tight">
                    {(calculateQuickCbm() > 0 ? calculateQuickCbm() : estimatedCbm || 0).toFixed(2)}
                  </p>
                  <p className="text-[11px] font-medium text-text-muted mt-1">
                    + {(((calculateQuickCbm() > 0 ? calculateQuickCbm() : estimatedCbm || 0) * 0.15)).toFixed(2)} m³ Sicherheitspuffer
                  </p>
                </div>

                {/* Schnell-Auswahl Fuhrpark */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-2">
                    Fahrzeugkategorie wählen
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: '1_transporter', label: '3.5t Sprinter (Standard)', desc: 'bis ~20 m³' },
                      { id: '1_lkw', label: '7.5t LKW', desc: '~35 m³' },
                      { id: '2_lkw', label: '2x Fahrzeuge', desc: '~60 m³' },
                      { id: 'custom', label: 'Manuell', desc: 'Individuell' },
                    ].map(truck => (
                      <button
                        key={truck.id}
                        type="button"
                        onClick={() => setTruckChoice(truck.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          truckChoice === truck.id
                            ? 'border-primary bg-primary/15 text-primary font-bold shadow-sm'
                            : 'border-structure/80 bg-white/[0.02] text-text-muted hover:border-structure'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight">{truck.label}</div>
                        <div className="text-[10px] text-text-muted mt-0.5">{truck.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Next Step Controls */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-structure/60">
                  <button
                    type="button"
                    onClick={() => validateAndSetStep(5)}
                    className="w-full py-3.5 bg-primary text-white font-headline font-bold rounded-xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all text-xs uppercase tracking-wider"
                  >
                    <span>Weiter zu Schritt 5: Abschluss</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => saveOrder('draft', false)}
                    disabled={isSaving}
                    className="w-full py-2.5 bg-white/[0.03] text-text-muted hover:text-text-main border border-structure/60 rounded-xl font-bold text-xs hover:bg-white/[0.06] transition-all"
                  >
                    Entwurf speichern
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentStep === 5 && (
        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
          {/* Bento Grid Content */}
          <div className="grid grid-cols-12 gap-8">
            {/* Left Column: Kerndaten Bento Card */}
            <div className="col-span-12 lg:col-span-7 space-y-6">
              <div className="bg-bg-card rounded-2xl p-6 md:p-8 border border-structure shadow-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary" />
                <h3 className="text-lg font-headline font-bold text-text-main mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">analytics</span>
                  Zusammenfassung der Kerndaten
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-6">
                  {/* Kunde */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">Kunde</p>
                    <p className="text-base font-bold text-text-main">{customerName || 'Neukunde'}</p>
                    <p className="text-xs text-text-muted">{customerEmail || 'Keine E-Mail angegeben'}</p>
                    <p className="text-xs text-text-muted">{customerPhone || 'Keine Telefonnummer'}</p>
                  </div>

                  {/* Termin */}
                  <div>
                    <p className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-1">Umzugstermin</p>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-lg">calendar_today</span>
                      <p className="text-base font-bold text-text-main">
                        {date ? new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Datum offen'}
                      </p>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      Beginn: {time || '08:00'} Uhr | Geschätzte Dauer: ~{calculatedDuration || 6}h
                    </p>
                  </div>

                  {/* Route & Logistik */}
                  <div className="col-span-1 sm:col-span-2 pt-4 border-t border-structure/60">
                    <p className="text-[10px] uppercase font-bold text-text-muted tracking-wider mb-3">Route &amp; Logistik</p>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center pt-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                          <div className="w-0.5 h-8 bg-structure" />
                          <div className="w-2.5 h-2.5 rounded-full border-2 border-primary" />
                        </div>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-bold text-text-main">{fromAddress || 'Beladestelle nicht erfasst'}</p>
                            <p className="text-[11px] text-text-muted">
                              Auszug: {fromFloor || 'EG'}, {hasElevatorA ? 'mit Fahrstuhl' : 'kein Fahrstuhl'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-text-main">{toAddress || 'Entladestelle nicht erfasst'}</p>
                            <p className="text-[11px] text-text-muted">
                              Einzug: {toFloor || 'EG'}, {hasElevatorB ? 'mit Fahrstuhl' : 'kein Fahrstuhl'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {distanceKm ? (
                        <div className="bg-white/[0.03] border border-structure rounded-xl p-3 text-center sm:min-w-[110px] shrink-0 self-start">
                          <p className="text-[10px] font-bold text-text-muted uppercase">Distanz</p>
                          <p className="text-base font-headline font-bold text-primary">{distanceKm} km</p>
                          {distanceDuration && (
                            <p className="text-[10px] text-text-muted mt-0.5">~{distanceDuration}</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Gesamtpreis Box */}
                  <div className="col-span-1 sm:col-span-2 pt-5 border-t border-structure/60 bg-primary/10 -mx-6 md:-mx-8 -mb-6 md:-mb-8 px-6 md:px-8 py-5 rounded-b-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                          Voraussichtlicher Gesamtpreis (Brutto)
                        </p>
                        <p className="text-xs text-text-muted">
                          Inkl. 19% MwSt. ({totals.tax.toFixed(2)} €), Haftung &amp; Transportversicherung
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-3xl sm:text-4xl font-headline font-black text-primary tracking-tight">
                          {totals.gross.toFixed(2)} €
                        </p>
                        <p className="text-[10px] font-bold text-text-muted uppercase">
                          Netto: {totals.net.toFixed(2)} €
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plausibilität Bestätigung Banner */}
              <div className="bg-white/[0.02] rounded-2xl p-5 border border-structure shadow-sm flex items-center justify-between gap-4">
                <div className="flex gap-3.5 items-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <span className="material-symbols-outlined text-2xl">verified</span>
                  </div>
                  <div>
                    <h4 className="text-text-main font-headline font-bold text-sm">Angebot ist abschlussbereit</h4>
                    <p className="text-text-muted text-xs">Alle Logistik- und Tarifangaben sind vollständig hinterlegt.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => saveOrder('draft', false)}
                  disabled={isSaving}
                  className="bg-primary/15 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0"
                >
                  Entwurf sichern
                </button>
              </div>

              {/* Manuelle / Externe Vertragsbestätigung Toggle */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircleIconSolid className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-emerald-400 block">
                      Bereits unterschrieben / bestätigt (WhatsApp oder Ausdruck)
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Setzt den Status sofort auf "Bestätigt" ohne digitalen Signatur-Link.
                    </span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isManuallySigned}
                    onChange={(e) => setIsManuallySigned(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Right Column: Dokumenten-Vorschau & Texte */}
            <div className="col-span-12 lg:col-span-5 space-y-6">
              <div className="bg-bg-card rounded-2xl p-6 border border-structure shadow-md flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-headline font-bold text-text-main flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">preview</span>
                    Dokumenten-Vorschau
                  </h3>
                  <div className="flex gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => handleQuoteActionWithCheck(() => window.print())} 
                      className="p-1.5 bg-white/[0.04] hover:bg-white/10 rounded-lg border border-structure text-text-muted hover:text-white transition-colors cursor-pointer"
                      title="Drucken / PDF erzeugen"
                    >
                      <span className="material-symbols-outlined text-base">print</span>
                    </button>
                  </div>
                </div>

                {/* Simulated PDF Preview Paper */}
                <div 
                  onClick={() => handleQuoteActionWithCheck(() => window.print())}
                  className="flex-grow bg-white/[0.03] rounded-xl border border-dashed border-structure/80 p-6 flex flex-col justify-between cursor-pointer group hover:border-primary/50 transition-colors min-h-[260px] relative overflow-hidden"
                >
                  <div className="flex justify-between items-start border-b border-structure/40 pb-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Rothirsch Logistics</span>
                      <p className="text-xs font-bold text-text-main mt-0.5">Umzugsangebot</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-symbols-outlined text-base">local_shipping</span>
                    </div>
                  </div>

                  <div className="space-y-2 py-4 text-[11px] text-text-muted">
                    <div className="flex justify-between">
                      <span>Kunde:</span>
                      <span className="font-semibold text-text-main">{customerName || 'Herr/Frau Kunde'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Umzugsdatum:</span>
                      <span className="font-semibold text-text-main">{date || 'Termin offen'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Positionen:</span>
                      <span className="font-semibold text-text-main">{services.length} Einzelleistungen</span>
                    </div>
                    <div className="flex justify-between border-t border-structure/30 pt-2 font-bold text-text-main">
                      <span>Gesamt:</span>
                      <span className="text-primary">{totals.gross.toFixed(2)} €</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-structure/40 flex items-center justify-between text-[10px] text-text-muted">
                    <span>Rechtsgültiges Firmenangebot</span>
                    <span className="text-primary font-bold group-hover:underline flex items-center gap-1">
                      Klicken zum Drucken
                      <span className="material-symbols-outlined text-xs">north_east</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 text-xs">
                  <span className="material-symbols-outlined text-primary text-xl">description</span>
                  <div className="flex-grow min-w-0">
                    <p className="font-bold text-text-main truncate">
                      Angebot_{customerName ? customerName.replace(/\s+/g, '_') : 'Rothirsch'}_{new Date().getFullYear()}.pdf
                    </p>
                    <p className="text-[10px] text-text-muted">
                      Generiert &amp; druckbereit • Automatische Signaturzeile enthalten
                    </p>
                  </div>
                </div>

                {/* Collapsible Document Texts & Conditions */}
                <details className="mt-4 pt-4 border-t border-structure/50 group">
                  <summary className="text-xs font-bold text-text-muted hover:text-text-main cursor-pointer flex items-center justify-between">
                    <span>Dokumententexte &amp; Zahlungsbedingungen anpassen</span>
                    <span className="material-symbols-outlined text-sm group-open:rotate-180 transition-transform">expand_more</span>
                  </summary>
                  <div className="space-y-3 pt-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Einleitungstext</label>
                        <button type="button" onClick={loadStandardTexts} className="text-[10px] text-primary hover:underline">Standard laden</button>
                      </div>
                      <textarea
                        value={texts.quoteIntro}
                        onChange={e => setTexts({...texts, quoteIntro: e.target.value})}
                        className="input-field w-full h-16 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Zahlungsbedingungen</label>
                      <textarea
                        value={texts.paymentTerms}
                        onChange={e => setTexts({...texts, paymentTerms: e.target.value})}
                        className="input-field w-full h-14 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">Schlusshinweise</label>
                      <textarea
                        value={texts.quoteOutro}
                        onChange={e => setTexts({...texts, quoteOutro: e.target.value})}
                        className="input-field w-full h-16 text-xs"
                      />
                    </div>
                  </div>
                </details>
              </div>
            </div>

            {/* Section 3: 3 Large Action Cards */}
            <div className="col-span-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Action 1: Save */}
                <button
                  type="button"
                  onClick={() => handleQuoteActionWithCheck(() => saveOrder(isInvoice ? 'invoice_open' : 'quote', true))}
                  disabled={isSaving}
                  className={`group flex flex-col items-center justify-center gap-3 p-6 bg-bg-card rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95 text-center cursor-pointer ${
                    !hasServices ? 'border-amber-500/40 hover:border-amber-500' : 'border-structure hover:border-primary'
                  }`}
                >
                  <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-primary group-hover:text-white transition-colors relative">
                    <span className="material-symbols-outlined text-2xl">save</span>
                    {!hasServices && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center" title="0 Leistungen">
                        !
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-headline font-bold text-sm text-text-main flex items-center justify-center gap-1.5">
                      <span>Angebot speichern</span>
                      {!hasServices && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-normal">
                          0 Leistungen
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">In der Datenbank archivieren</p>
                  </div>
                </button>

                {/* Action 2: Download / Print */}
                <button
                  type="button"
                  onClick={() => handleQuoteActionWithCheck(() => window.print())}
                  className={`group flex flex-col items-center justify-center gap-3 p-6 bg-bg-card rounded-2xl border transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95 text-center cursor-pointer ${
                    !hasServices ? 'border-amber-500/40 hover:border-amber-500' : 'border-structure hover:border-primary'
                  }`}
                >
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-primary group-hover:text-white transition-colors relative">
                    <span className="material-symbols-outlined text-2xl">download</span>
                    {!hasServices && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-black text-[9px] font-bold flex items-center justify-center" title="0 Leistungen">
                        !
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="font-headline font-bold text-sm text-text-main flex items-center justify-center gap-1.5">
                      <span>PDF herunterladen</span>
                      {!hasServices && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-normal">
                          0 Leistungen
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">Lokal drucken oder als PDF sichern</p>
                  </div>
                </button>

                {/* Action 3: Email */}
                <button
                  type="button"
                  onClick={() => handleQuoteActionWithCheck(() => {
                    const subject = encodeURIComponent(`Ihr Umzugsangebot von Rothirsch - ${customerName || ''}`);
                    const body = encodeURIComponent(`Guten Tag ${customerName || ''},\n\nanbei erhalten Sie das Angebot für Ihren bevorstehenden Umzug.\nGesamtbetrag: ${totals.gross.toFixed(2)} €.\n\nMit freundlichen Grüßen\nIhr Rothirsch Team`);
                    window.location.href = `mailto:${customerEmail || ''}?subject=${subject}&body=${body}`;
                  })}
                  className="group flex flex-col items-center justify-center gap-3 p-6 bg-primary/10 rounded-2xl border border-primary/30 hover:border-primary transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95 text-center cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                    <span className="material-symbols-outlined text-2xl">alternate_email</span>
                  </div>
                  <div>
                    <p className="font-headline font-bold text-sm text-primary">E-Mail an Kunden</p>
                    <p className="text-xs text-text-muted mt-0.5">Angebot direkt versenden</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Docked Material Action Bar (Mobile & Desktop Ergonomic) */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-[70] bg-bg-panel/98 backdrop-blur-xl border-t border-structure shadow-[0_-8px_30px_rgba(0,0,0,0.35)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-all">
        {errorMessage && (
          <div className="max-w-7xl mx-auto mb-2">
            <span className="text-red-400 text-xs font-semibold bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20 block text-center">
              {errorMessage}
            </span>
          </div>
        )}

        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* LEFT: Zurück or Abbrechen */}
          <div className="flex items-center gap-2 shrink-0">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleStepBack}
                disabled={isSaving}
                className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold font-headline bg-structure/50 hover:bg-structure text-text-main transition-all flex items-center gap-1.5 border border-structure active:scale-95 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>Zurück</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSafeCancel}
                disabled={isSaving}
                className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold font-headline text-text-muted hover:text-text-main transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                <span className="hidden xs:inline">Abbrechen</span>
              </button>
            )}
          </div>

          {/* CENTER: Step Indicator & Quick Save */}
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-[11px] font-bold font-headline uppercase tracking-wider text-text-muted px-2.5 py-1 rounded-full bg-structure/40 border border-structure hidden xs:inline-block">
              Schritt {currentStep}/5
            </span>

            <button
              type="button"
              onClick={() => saveOrder(isInvoice ? 'invoice_open' : 'draft', false)}
              disabled={isSaving}
              className="px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold font-headline bg-structure/40 hover:bg-structure text-text-main transition-all flex items-center gap-1.5 border border-structure cursor-pointer active:scale-95"
              title="Als Entwurf zwischenspeichern"
            >
              {isSaving ? (
                <span className="w-3.5 h-3.5 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-sm text-primary">save</span>
              )}
              <span className="hidden sm:inline">{isSaving ? 'Speichert...' : 'Entwurf speichern'}</span>
              <span className="sm:hidden">{isSaving ? '...' : 'Speichern'}</span>
            </button>
          </div>

          {/* RIGHT: Weiter or Buchen (Primary Action) */}
          <div className="flex items-center gap-2 shrink-0">
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() => validateAndSetStep(currentStep + 1)}
                disabled={isSaving}
                className="btn-primary px-4 sm:px-6 py-2 rounded-xl text-xs font-bold font-headline flex items-center gap-1.5 shadow-md shadow-primary/30 active:scale-95 transition-all cursor-pointer"
              >
                <span>Weiter</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleQuoteActionWithCheck(() => saveOrder('confirmed' as any, true))}
                disabled={isSaving}
                className="bg-primary hover:brightness-110 text-white px-5 sm:px-7 py-2.5 rounded-xl font-headline font-black text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 shadow-xl shadow-primary/40 active:scale-95 transition-all cursor-pointer"
              >
                {isSaving ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-base">check_circle</span>
                )}
                <span>Umzug buchen</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Keine Leistungen Warnung vor Angebotserstellung */}
      {showNoServicesModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-panel border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center justify-center mx-auto shadow-inner">
              <span className="material-symbols-outlined text-3xl">receipt_long</span>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-headline font-bold text-text-main">
                Keine Leistungen erfasst
              </h3>
              <p className="text-xs font-semibold text-amber-400">
                لم تقم بإضافة أي خدمات بعد (0,00 €)
              </p>
              <p className="text-xs text-text-muted leading-relaxed pt-1">
                Es wurden bisher noch keine Einzelleistungen oder Pauschalbeträge hinterlegt. Möchten Sie jetzt Leistungen auswählen oder das Angebot trotzdem ohne Leistungen erstellen?
              </p>
            </div>

            <div className="bg-black/25 rounded-xl p-3.5 border border-structure/60 text-left text-xs space-y-1.5">
              <div className="flex justify-between text-text-muted">
                <span>Leistungen:</span>
                <span className="font-bold text-amber-400">0 Positionen</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Gesamtbetrag:</span>
                <span className="font-bold text-text-main">0,00 €</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowNoServicesModal(false);
                  setPendingQuoteAction(null);
                  validateAndSetStep(3); // Go to step 3 (Leistungen)
                }}
                className="btn-primary py-3 px-4 rounded-xl text-xs font-bold font-headline flex items-center justify-center gap-2 shadow-lg shadow-primary/25 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                <span>Leistungen hinzufügen (Schritt 3) / إضافة خدمات</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowNoServicesModal(false);
                  if (pendingQuoteAction) {
                    const act = pendingQuoteAction;
                    setPendingQuoteAction(null);
                    act();
                  }
                }}
                className="py-2.5 px-4 rounded-xl text-xs font-bold text-text-muted hover:text-text-main bg-white/[0.04] hover:bg-white/[0.08] border border-structure transition cursor-pointer"
              >
                Trotzdem erstellen / المتابعة والإنشاء رغم ذلك
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowNoServicesModal(false);
                  setPendingQuoteAction(null);
                }}
                className="text-[11px] text-text-muted hover:text-text-main underline pt-1 cursor-pointer"
              >
                Abbrechen / إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <InventoryWizardModal 
        isOpen={isInventoryWizardOpen}
        onClose={() => {
          setIsInventoryWizardOpen(false);
          // Small timeout to prevent UI flicker while modal closes
          setTimeout(() => setInitialWizardRoom(null), 300);
        }}
        inventory={inventory}
        setInventory={setInventory}
        initialRoomId={initialWizardRoom}
        roomCounts={roomCounts}
        onSaveRoomCounts={(counts) => setRoomCounts(counts)}
        auszugsortTitle={
          logistics.a_street 
            ? `${logistics.a_street} ${logistics.a_houseNr || ''}, ${logistics.a_city || ''}`.trim()
            : 'Beladestelle A'
        }
      />
    </div>
  );
}
