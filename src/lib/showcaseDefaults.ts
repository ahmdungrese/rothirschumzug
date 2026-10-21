export interface ShowcaseServiceItem {
  id: string;
  name: string;
  icon: string;
  enabled: boolean;
}

export interface ShowcaseConfig {
  title?: string;
  subtitle?: string;
  disclaimer?: string;
  services?: ShowcaseServiceItem[];
}

export const AVAILABLE_SHOWCASE_ICONS = [
  { id: 'transport', label: 'Transport / LKW', iconName: 'local_shipping' },
  { id: 'kitchen', label: 'Küche / Montage', iconName: 'countertops' },
  { id: 'furniture', label: 'Möbel / Schrank', iconName: 'chair' },
  { id: 'packing', label: 'Kartons / Material', iconName: 'inventory_2' },
  { id: 'hvz', label: 'Halteverbot (HVZ)', iconName: 'block' },
  { id: 'lift', label: 'Möbellift / Aufzug', iconName: 'elevator' },
  { id: 'light', label: 'Lampen / Elektro', iconName: 'lightbulb' },
  { id: 'storage', label: 'Lagerung / Keller', iconName: 'warehouse' },
  { id: 'cleaning', label: 'Reinigung / Endreinigung', iconName: 'cleaning_services' },
  { id: 'disposal', label: 'Entrümpelung / Müll', iconName: 'delete_sweep' },
  { id: 'piano', label: 'Klavier / Schwergut', iconName: 'piano' },
  { id: 'painting', label: 'Malerarbeiten', iconName: 'format_paint' },
  { id: 'sanitary', label: 'Sanitär / Wasser', iconName: 'faucet' },
  { id: 'general', label: 'Allgemein / Stern', iconName: 'star' },
];

export const DEFAULT_SHOWCASE_SERVICES: ShowcaseServiceItem[] = [
  { id: 'transport', name: 'Nah- & Fernumzug', icon: 'transport', enabled: true },
  { id: 'kitchen', name: 'Küchenmontage', icon: 'kitchen', enabled: true },
  { id: 'furniture', name: 'Möbel-Aufbau', icon: 'furniture', enabled: true },
  { id: 'packing', name: 'Packservice & Boxen', icon: 'packing', enabled: true },
  { id: 'hvz', name: 'Halteverbote (HVZ)', icon: 'hvz', enabled: true },
  { id: 'lift', name: 'Möbel-Außenlift', icon: 'lift', enabled: true },
  { id: 'light', name: 'Lampenmontage', icon: 'light', enabled: true },
  { id: 'storage', name: 'Einlagerung & Keller', icon: 'storage', enabled: true },
  { id: 'cleaning', name: 'Endreinigung', icon: 'cleaning', enabled: false },
  { id: 'disposal', name: 'Müll & Entrümpelung', icon: 'disposal', enabled: false },
  { id: 'piano', name: 'Klaviertransport', icon: 'piano', enabled: false },
  { id: 'painting', name: 'Malerarbeiten', icon: 'painting', enabled: false },
];

export const DEFAULT_SHOWCASE_TEXTS = {
  title: 'Unser erweitertes Full-Service Angebot auf Wunsch',
  subtitle: 'Jederzeit flexibel zubuchbar • Sprechen Sie uns gerne an',
  disclaimer: '* Hinweis: Der vertragliche Leistungsumfang Ihres Umzugs richtet sich verbindlich nach den auf Seite 1 aufgeführten Positionen. Die oben genannten Zusatzleistungen können jederzeit auf Wunsch hinzugebucht werden.',
};
