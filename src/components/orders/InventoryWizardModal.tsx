"use client";

import { useState, useMemo, useEffect } from "react";
import { 
  XMarkIcon, 
  PlusIcon, 
  MinusIcon,
  HomeIcon,
  BriefcaseIcon,
  MoonIcon,
  SparklesIcon,
  ArchiveBoxIcon,
  SunIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TvIcon,
  CakeIcon,
  MapIcon,
  FireIcon,
  PuzzlePieceIcon,
  BuildingStorefrontIcon,
  TableCellsIcon,
  Squares2X2Icon,
  LightBulbIcon,
  ComputerDesktopIcon,
  PhotoIcon,
  CubeIcon,
  BoltIcon,
  WrenchIcon,
  RectangleGroupIcon
} from "@heroicons/react/24/outline";

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  note: string;
  room?: string; // Optional for backwards compatibility
  showNoteInPdf?: boolean;
  disassembly?: number;
  assembly?: number;
  connection?: number;
  disconnection?: number;
}

export const ROOM_TYPES = [
  { id: 'wohnzimmer', name: 'Wohnzimmer', icon: TvIcon },
  { id: 'esszimmer', name: 'Esszimmer', icon: CakeIcon },
  { id: 'flur', name: 'Flur', icon: MapIcon },
  { id: 'schlafzimmer', name: 'Schlafzimmer', icon: MoonIcon },
  { id: 'badezimmer', name: 'Badezimmer', icon: SparklesIcon },
  { id: 'kueche', name: 'Küche', icon: FireIcon },
  { id: 'kinderzimmer', name: 'Kinderzimmer', icon: PuzzlePieceIcon },
  { id: 'gaestezimmer', name: 'Gästezimmer', icon: HomeIcon },
  { id: 'buero', name: 'Büro', icon: BriefcaseIcon },
  { id: 'terrasse', name: 'Terrasse', icon: SunIcon },
  { id: 'balkon', name: 'Balkon', icon: SunIcon },
  { id: 'garten', name: 'Garten', icon: SunIcon },
  { id: 'kammer', name: 'Kammer', icon: ArchiveBoxIcon },
  { id: 'garage', name: 'Garage', icon: BuildingStorefrontIcon },
  { id: 'wc', name: 'WC', icon: SparklesIcon },
  { id: 'keller', name: 'Keller', icon: ArchiveBoxIcon },
  { id: 'waschkeller', name: 'Waschkeller', icon: BoltIcon },
  { id: 'dachboden', name: 'Dachboden', icon: ArchiveBoxIcon },
  { id: 'hobby', name: 'Hobby', icon: PuzzlePieceIcon },
  { id: 'wintergarten', name: 'Wintergarten', icon: SunIcon },
  { id: 'allg_raum', name: 'Allg. Raum', icon: HomeIcon },
];

export const getFurnitureIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('sofa') || n.includes('couch') || n.includes('sessel') || n.includes('sitz') || n.includes('stuhl') || n.includes('bank') || n.includes('hocker')) return RectangleGroupIcon;
  if (n.includes('tisch') || n.includes('board') || n.includes('kommode')) return TableCellsIcon;
  if (n.includes('bett') || n.includes('matratze')) return MoonIcon;
  if (n.includes('schrank') || n.includes('regal') || n.includes('vitrine') || n.includes('garderobe')) return Squares2X2Icon;
  if (n.includes('lampe') || n.includes('leuchte') || n.includes('kronleuchter')) return LightBulbIcon;
  if (n.includes('tv') || n.includes('fernseher') || n.includes('monitor') || n.includes('computer') || n.includes('drucker')) return ComputerDesktopIcon;
  if (n.includes('küche') || n.includes('herd') || n.includes('ofen') || n.includes('mikrowelle') || n.includes('kühlschrank') || n.includes('spüle') || n.includes('kaffee')) return FireIcon;
  if (n.includes('waschmaschine') || n.includes('trockner')) return BoltIcon;
  if (n.includes('bild') || n.includes('spiegel')) return PhotoIcon;
  if (n.includes('pflanze') || n.includes('garten') || n.includes('sonne')) return SunIcon;
  if (n.includes('karton') || n.includes('box') || n.includes('kiste') || n.includes('koffer')) return ArchiveBoxIcon;
  if (n.includes('werk') || n.includes('maschine') || n.includes('rad') || n.includes('mäher')) return WrenchIcon;
  return CubeIcon;
};

export interface InventoryWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: InventoryItem[];
  setInventory: (items: InventoryItem[]) => void;
  initialRoomId?: string | null;
}

const POPULAR_FURNITURE: Record<string, string[]> = {
  'wohnzimmer': ['Sofa (2-Sitzer)', 'Sofa (3-Sitzer)', 'Ecksofa', 'Schlafcouch', 'Sessel', 'Ohrensessel', 'Couchtisch', 'Beistelltisch', 'TV-Board', 'Lowboard', 'Highboard', 'Sideboard', 'Wohnwand', 'Bücherregal', 'Wandregal', 'Vitrine', 'Teppich', 'Stehlampe', 'Deckenlampe', 'Bilder/Spiegel', 'Pflanze groß', 'Pflanze klein', 'Klavier/Flügel', 'Sitzsack', 'Hocker'],
  'schlafzimmer': ['Bett (Einzel)', 'Bett (Doppel)', 'Boxspringbett', 'Hochbett', 'Wasserbett', 'Kleiderschrank (1-türig)', 'Kleiderschrank (2-türig)', 'Kleiderschrank (3-türig)', 'Kleiderschrank (4-türig)', 'Schwebetürenschrank', 'Nachttisch', 'Kommode', 'Sideboard', 'Schminktisch', 'Spiegel (groß)', 'Stuhl', 'Sessel', 'Teppich', 'Herrendiener', 'Matratze', 'Bettkasten'],
  'kueche': ['Einbauküche (Laufmeter)', 'Küchenunterschrank', 'Küchenhängeschrank', 'Hochschrank', 'Apothekerschrank', 'Spülenschrank', 'Küchentisch', 'Esstisch', 'Küchenstuhl', 'Barhocker', 'Kühlschrank', 'Kühl-Gefrierkombination', 'Gefrierschrank', 'Spülmaschine', 'Herd', 'Backofen', 'Mikrowelle', 'Kaffeevollautomat', 'Mülleimer', 'Regal', 'Servierwagen', 'Dunstabzugshaube'],
  'badezimmer': ['Waschbeckenunterschrank', 'Spiegelschrank', 'Bad-Hochschrank', 'Hängeschrank', 'Regal', 'Waschmaschine', 'Trockner', 'Wäschekorb', 'Handtuchhalter (stehend)', 'Badhocker', 'Personenwaage'],
  'buero': ['Schreibtisch', 'Eckschreibtisch', 'Stehschreibtisch', 'Bürostuhl', 'Chefsessel', 'Besucherstuhl', 'Aktenschrank (hoch)', 'Aktenschrank (niedrig)', 'Rollcontainer', 'Bücherregal', 'Wandregal', 'Whiteboard', 'Pinnwand', 'Monitor', 'Computer', 'Drucker/Kopierer', 'Aktenvernichter', 'Papierkorb', 'Tresor/Safe', 'Lampe'],
  'esszimmer': ['Esstisch', 'Ausziehtisch', 'Stuhl', 'Armlehnstuhl', 'Sitzbank', 'Eckbank', 'Vitrine', 'Sideboard', 'Highboard', 'Servierwagen', 'Teppich', 'Deckenlampe', 'Bilder/Spiegel'],
  'flur': ['Garderobe', 'Garderobenpaneel', 'Schuhschrank', 'Schuhkipper', 'Kommode', 'Konsolentisch', 'Spiegel (groß)', 'Sitzbank', 'Schirmständer', 'Schlüsselkasten', 'Teppich/Läufer'],
  'kinderzimmer': ['Bett (Einzel)', 'Hochbett', 'Etagenbett', 'Kinderbett/Gitterbett', 'Wickelkommode', 'Schreibtisch', 'Kinderstuhl', 'Kleiderschrank', 'Spielzeugregal', 'Spielzeugkiste', 'Sitzsack', 'Teppich'],
  'gaestezimmer': ['Bett (Einzel)', 'Bett (Doppel)', 'Schlafcouch', 'Kleiderschrank', 'Nachttisch', 'Kommode', 'Schreibtisch', 'Stuhl', 'Kofferablage', 'Sessel'],
  'balkon': ['Gartentisch', 'Klapptisch', 'Gartenstuhl', 'Klappstuhl', 'Sonnenliege', 'Sonnenschirm', 'Sonnenschirmständer', 'Pflanzkübel', 'Grill (klein)'],
  'terrasse': ['Gartentisch (groß)', 'Gartenstuhl', 'Sonnenliege', 'Sonnenschirm', 'Sonnenschirmständer', 'Pflanzkübel', 'Grill (Gas/Kohle)', 'Lounge-Sofa', 'Lounge-Tisch', 'Strandkorb', 'Feuerschale'],
  'garten': ['Gartentisch', 'Gartenstuhl', 'Sonnenliege', 'Sonnenschirm', 'Grill (Gas/Kohle)', 'Lounge-Möbel', 'Gartengeräte', 'Rasenmäher', 'Schubkarre', 'Regenfass', 'Hollywoodschaukel'],
  'keller': ['Schwerlastregal', 'Holzregal', 'Schrank', 'Werkbank', 'Werkzeugschrank', 'Fahrrad', 'E-Bike', 'Autoreifen (Satz)', 'Ski/Snowboard', 'Koffer (groß)', 'Karton', 'Werkzeugkoffer', 'Schlitten'],
  'garage': ['Schwerlastregal', 'Schrank', 'Werkbank', 'Fahrrad', 'E-Bike', 'Motorroller', 'Autoreifen (Satz)', 'Dachbox', 'Werkzeug', 'Gartengeräte', 'Rasenmäher'],
  'kammer': ['Regal', 'Schrank', 'Leiter', 'Staubsauger', 'Bügelbrett', 'Wäscheständer', 'Putzutensilien', 'Karton'],
  'dachboden': ['Regal', 'Schrank', 'Koffer (groß)', 'Karton', 'Ski/Snowboard', 'Weihnachtsdeko (Kiste)'],
  'waschkeller': ['Waschmaschine', 'Trockner', 'Wäscheständer', 'Wäschekorb', 'Bügelbrett', 'Regal'],
  'hobby': ['Billardtisch', 'Tischtennisplatte', 'Fitnessgerät (Ergometer/Laufband)', 'Hantelbank', 'Klavier', 'Nähmaschinentisch', 'Schreibtisch', 'Regal', 'Sofa'],
  'wintergarten': ['Lounge-Sofa', 'Lounge-Tisch', 'Sessel', 'Pflanze groß', 'Pflanzkübel', 'Teppich', 'Stehlampe']
};

const DEFAULT_FURNITURE = ['Umzugskarton', 'Kleiderbox', 'Bücherkarton', 'Gläserkarton', 'Tisch', 'Stuhl', 'Regal', 'Schrank', 'Kommode', 'Lampe', 'Teppich', 'Pflanze', 'Bild', 'Spiegel'];

const getAvailableServices = (name: string): ('assembly' | 'connection')[] => {
  const n = name.toLowerCase();
  
  if (n.includes('waschmaschine') || n.includes('spülmaschine') || n.includes('herd') || n.includes('backofen') || 
      n.includes('kühlschrank') || n.includes('lampe') || n.includes('trockner') || n.includes('tv') || 
      n.includes('monitor') || n.includes('computer') || n.includes('kaffeevollautomat') || n.includes('drucker') || n.includes('kopierer') || n.includes('dunstabzugshaube')) {
    return ['connection'];
  }
  
  if (n.includes('karton') || n.includes('box') || n.match(/\b(stuhl|stühle)\b/) || n.includes('teppich') || 
      n.includes('pflanze') || n.includes('spiegel') || n.includes('bild') || n.includes('papierkorb') || 
      n.includes('wäschekorb') || n.includes('mülleimer') || n.includes('koffer') || n.includes('geräte') ||
      n.includes('sonnenschirm') || n.includes('hocker') || n.includes('sitzsack') || n.includes('matratze') || 
      n.includes('leiter') || n.includes('staubsauger') || n.includes('putzutensilien') || n.includes('weihnachtsdeko') ||
      n.includes('bügelbrett') || n.includes('wäscheständer') || n.includes('reifen') || n.includes('fahrrad') ||
      n.includes('e-bike') || n.includes('motorroller') || n.includes('schlitten') || n.includes('rasenmäher') || n.includes('schubkarre')) {
    return [];
  }
  
  return ['assembly'];
};

export function InventoryWizardModal({ isOpen, onClose, inventory, setInventory, initialRoomId }: InventoryWizardModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [roomCounts, setRoomCounts] = useState<Record<string, number>>({});
  
  const [localInventory, setLocalInventory] = useState<InventoryItem[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      setLocalInventory(JSON.parse(JSON.stringify(inventory)));
      
      const counts: Record<string, number> = {};
      const uniqueRooms = new Set(inventory.filter(i => i.room).map(i => i.room as string));
      uniqueRooms.forEach(roomName => {
         const match = roomName.match(/^(.*?)( \d+)?$/);
         if (match) {
           const baseType = match[1];
           const roomObj = ROOM_TYPES.find(r => r.name === baseType);
           if (roomObj) {
              counts[roomObj.id] = (counts[roomObj.id] || 0) + 1;
           }
         }
      });
      
      if (initialRoomId) {
        if (!counts[initialRoomId]) {
          counts[initialRoomId] = 1;
        }
        setRoomCounts(counts);
        setActiveRoomId(`${initialRoomId}-1`);
        setStep(2);
      } else {
        setRoomCounts(counts);
        setStep(1);
      }
    }
  }, [isOpen, inventory, initialRoomId]);

  const activeRooms = useMemo(() => {
    const rooms: { id: string, name: string, typeId: string }[] = [];
    ROOM_TYPES.forEach(roomType => {
      const count = roomCounts[roomType.id] || 0;
      if (count === 1) {
        rooms.push({ id: `${roomType.id}-1`, name: roomType.name, typeId: roomType.id });
      } else if (count > 1) {
        for (let i = 1; i <= count; i++) {
          rooms.push({ id: `${roomType.id}-${i}`, name: `${roomType.name} ${i}`, typeId: roomType.id });
        }
      }
    });
    return rooms;
  }, [roomCounts]);

  useEffect(() => {
    if (step === 2 && !activeRoomId && activeRooms.length > 0) {
      setActiveRoomId(activeRooms[0].id);
    }
    // Handle case where active room is removed
    if (step === 2 && activeRoomId && !activeRooms.find(r => r.id === activeRoomId)) {
       setActiveRoomId(activeRooms.length > 0 ? activeRooms[0].id : null);
    }
  }, [step, activeRooms, activeRoomId]);

  const activeRoomObj = activeRooms.find(r => r.id === activeRoomId);
  
  const popularItems = useMemo(() => {
    if (!activeRoomObj) return DEFAULT_FURNITURE;
    return POPULAR_FURNITURE[activeRoomObj.typeId] || DEFAULT_FURNITURE;
  }, [activeRoomObj]);

  if (!isOpen) return null;

  const handleRoomCountChange = (roomId: string, delta: number) => {
    setRoomCounts(prev => {
      const current = prev[roomId] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [roomId]: next };
    });
  };

  const handleApply = () => {
    const activeRoomNames = activeRooms.map(r => r.name);
    const filteredInventory = localInventory.filter(item => 
      !item.room || activeRoomNames.includes(item.room)
    );
    setInventory(filteredInventory);
    onClose();
  };

  const filteredPopularItems = popularItems.filter(item => item.toLowerCase().includes(searchQuery.toLowerCase()));

  const itemsInActiveRoom = localInventory.filter(item => item.room === activeRoomObj?.name);

  const addItemToRoom = (itemName: string) => {
    if (!activeRoomObj) return;
    const existing = localInventory.find(i => i.room === activeRoomObj.name && i.name === itemName);
    if (existing) {
      setLocalInventory(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setLocalInventory(prev => [...prev, {
        id: Date.now().toString() + Math.random().toString(),
        name: itemName,
        quantity: 1,
        note: '',
        room: activeRoomObj.name,
        showNoteInPdf: true
      }]);
    }
  };

  const updateItemQuantity = (id: string, delta: number) => {
    setLocalInventory(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { 
          ...item, 
          quantity: newQuantity,
          disassembly: item.disassembly ? newQuantity : 0,
          assembly: item.assembly ? newQuantity : 0,
          connection: item.connection ? newQuantity : 0,
          disconnection: item.disconnection ? newQuantity : 0
        };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const toggleService = (id: string, serviceType: 'disassembly' | 'assembly' | 'connection' | 'disconnection') => {
    setLocalInventory(prev => prev.map(item => {
      if (item.id === id) {
        const isSelected = (item[serviceType] || 0) > 0;
        return { ...item, [serviceType]: isSelected ? 0 : item.quantity };
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setLocalInventory(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-bg-panel w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl border border-structure flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-structure bg-bg-dark shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-text-main">
            {step === 1 ? 'Wählen Sie die Räume Ihrer Auszugsadresse' : 'Inventar hinzufügen'}
          </h2>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-red-400 transition-colors rounded-lg hover:bg-white/5">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative bg-bg-panel">
          {step === 1 && (
            <div className="p-4 sm:p-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {ROOM_TYPES.map(room => {
                const count = roomCounts[room.id] || 0;
                const Icon = room.icon;
                const isSelected = count > 0;
                
                return (
                  <div 
                    key={room.id}
                    className={`flex flex-col border rounded-xl overflow-hidden transition-all duration-200 ${isSelected ? 'border-primary shadow-lg shadow-primary/10' : 'border-structure hover:border-text-muted/30'}`}
                  >
                    <button 
                      className={`flex-1 flex flex-col items-center justify-center p-6 gap-3 transition-colors ${isSelected ? 'bg-primary/20 text-primary' : 'bg-bg-dark text-text-muted hover:bg-white/5'}`}
                      onClick={() => {
                        if (count === 0) handleRoomCountChange(room.id, 1);
                      }}
                    >
                      <Icon className="w-8 h-8" />
                      <span className="text-sm font-semibold text-center">{room.name}</span>
                    </button>
                    
                    {isSelected && (
                      <div className="flex items-center justify-between px-3 py-2 bg-[#33412a] border-t border-primary/20">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRoomCountChange(room.id, -1); }}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-text-main hover:bg-red-500/50 hover:text-white transition-colors"
                        >
                          <MinusIcon className="w-4 h-4 font-bold text-red-400" />
                        </button>
                        <span className="font-bold text-white">{count}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRoomCountChange(room.id, 1); }}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-text-main hover:bg-green-500/50 hover:text-white transition-colors"
                        >
                          <PlusIcon className="w-4 h-4 font-bold text-green-400" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col h-full">
              {/* Room Tabs */}
              <div className="flex overflow-x-auto custom-scrollbar border-b border-structure bg-bg-dark p-2 gap-2 shrink-0">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center p-3 rounded-lg border border-structure text-text-muted hover:bg-white/5 hover:text-text-main transition-colors mr-2 shrink-0"
                  title="Räume anpassen"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
                {activeRooms.map(room => {
                  const isActive = room.id === activeRoomId;
                  const roomType = ROOM_TYPES.find(r => r.id === room.typeId);
                  const Icon = roomType?.icon || HomeIcon;
                  return (
                    <button
                      key={room.id}
                      onClick={() => setActiveRoomId(room.id)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all border ${isActive ? 'bg-[#33412a] text-white border-primary shadow-lg' : 'bg-transparent text-text-muted border-structure hover:bg-white/5 hover:text-text-main'}`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-semibold text-sm">{room.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Items Area */}
              <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                
                {/* Left Panel: Popular Items */}
                <div className="w-full md:w-1/2 lg:w-5/12 border-b md:border-b-0 md:border-r border-structure flex flex-col bg-bg-panel overflow-hidden">
                  <div className="p-4 border-b border-structure bg-bg-panel z-10 shrink-0">
                    <div className="relative">
                      <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input 
                        type="text"
                        placeholder={`${activeRoomObj?.name || 'Raum'} durchsuchen...`}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-bg-dark border border-structure rounded-lg pl-10 pr-4 py-2.5 text-sm text-text-main focus:border-primary focus:outline-none transition-colors"
                      />
                      {searchQuery && (
                         <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main">
                            <XMarkIcon className="w-4 h-4" />
                         </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-structure"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-3 bg-bg-panel text-xs font-medium text-primary uppercase tracking-wider">
                          Beliebte Möbel {activeRoomObj?.name}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {filteredPopularItems.map((item, idx) => {
                        const ItemIcon = getFurnitureIcon(item);
                        return (
                          <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-structure hover:border-primary/50 bg-bg-dark transition-colors group cursor-pointer" onClick={() => addItemToRoom(item)}>
                            <div className="flex items-center gap-3">
                              <ItemIcon className="w-5 h-5 text-text-muted opacity-50" />
                              <span className="text-sm font-medium text-text-main">{item}</span>
                            </div>
                            <button className="text-primary w-8 h-8 rounded-full flex items-center justify-center border border-primary/20 group-hover:bg-primary/20 transition-colors">
                              <PlusIcon className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                      {searchQuery.trim() !== '' && !popularItems.some(i => i.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                        <div className="flex items-center justify-between p-3 rounded-xl border border-dashed border-primary hover:bg-primary/5 transition-colors group cursor-pointer mt-4" onClick={() => { addItemToRoom(searchQuery.trim()); setSearchQuery(''); }}>
                          <div className="flex items-center gap-3">
                            <PlusIcon className="w-5 h-5 text-primary" />
                            <span className="text-sm font-medium text-primary">"{searchQuery.trim()}" als eigenes Möbelstück hinzufügen</span>
                          </div>
                          <button className="text-primary w-8 h-8 rounded-full flex items-center justify-center bg-primary/20">
                            <PlusIcon className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Panel: Added Items */}
                <div className="w-full md:w-1/2 lg:w-7/12 flex flex-col bg-bg-dark overflow-hidden">
                  <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-structure"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-3 bg-bg-dark text-sm font-bold text-text-main">
                          Hinzugefügte Möbel {activeRoomObj?.name} ({itemsInActiveRoom.reduce((acc, i) => acc + i.quantity, 0)})
                        </span>
                      </div>
                    </div>

                    {itemsInActiveRoom.length === 0 ? (
                      <div className="p-6 border border-structure bg-primary/5 rounded-xl border-dashed">
                        <p className="text-sm text-text-muted text-center flex items-center justify-center gap-2">
                          <ChevronLeftIcon className="w-5 h-5" />
                          Bitte klicken Sie alle Gegenstände an, die transportiert werden sollen.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {itemsInActiveRoom.map(item => {
                          const availableServices = getAvailableServices(item.name);
                          return (
                            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl bg-bg-panel border border-structure shadow-sm gap-3">
                              <div className="flex flex-col gap-2">
                                 <div className="flex items-center gap-3">
                                    {(() => {
                                      const ItemIcon = getFurnitureIcon(item.name);
                                      return <ItemIcon className="w-5 h-5 text-text-muted opacity-50 shrink-0" />;
                                    })()}
                                    <span className="text-sm font-medium text-text-main">{item.name}</span>
                                 </div>
                                 {availableServices.length > 0 && (
                                   <div className="flex flex-wrap items-center gap-2 pl-8">
                                      {availableServices.includes('assembly') && (
                                        <>
                                          <button 
                                            onClick={() => toggleService(item.id, 'disassembly')}
                                            className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${item.disassembly ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-transparent border-structure text-text-muted hover:border-primary/50'}`}
                                          >
                                            Abbau
                                          </button>
                                          <button 
                                            onClick={() => toggleService(item.id, 'assembly')}
                                            className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${item.assembly ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-transparent border-structure text-text-muted hover:border-primary/50'}`}
                                          >
                                            Aufbau
                                          </button>
                                        </>
                                      )}
                                      {availableServices.includes('connection') && (
                                        <>
                                          <button 
                                            onClick={() => toggleService(item.id, 'disconnection')}
                                            className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${item.disconnection ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-transparent border-structure text-text-muted hover:border-primary/50'}`}
                                          >
                                            Abklemmen
                                          </button>
                                          <button 
                                            onClick={() => toggleService(item.id, 'connection')}
                                            className={`px-2 py-1 text-[10px] font-medium rounded border transition-colors ${item.connection ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-transparent border-structure text-text-muted hover:border-primary/50'}`}
                                          >
                                            Anschluss
                                          </button>
                                        </>
                                      )}
                                   </div>
                                 )}
                              </div>
                              <div className="flex items-center gap-4 self-end sm:self-auto shrink-0">
                                <div className="flex items-center justify-center gap-2 bg-bg-dark rounded-lg p-1 border border-structure">
                                  <button type="button" onClick={() => updateItemQuantity(item.id, -1)} className="w-7 h-7 flex items-center justify-center hover:bg-white/10 text-text-muted hover:text-white rounded transition-colors font-bold"><MinusIcon className="w-4 h-4" /></button>
                                  <span className="w-8 text-center text-text-main font-semibold text-sm">{item.quantity}</span>
                                  <button type="button" onClick={() => updateItemQuantity(item.id, 1)} className="w-7 h-7 flex items-center justify-center hover:bg-white/10 text-text-muted hover:text-white rounded transition-colors font-bold"><PlusIcon className="w-4 h-4" /></button>
                                </div>
                                <button onClick={() => removeItem(item.id)} className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                                  <XMarkIcon className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-structure bg-bg-panel flex justify-between items-center shrink-0">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="btn-secondary text-sm px-4 py-2 border-structure text-text-muted">Abbrechen</button>
              <button 
                onClick={() => setStep(2)} 
                disabled={activeRooms.length === 0}
                className="btn-primary text-sm px-6 py-2 shadow-lg disabled:opacity-50 flex items-center gap-2"
              >
                Weiter <ChevronRightIcon className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="btn-secondary text-sm px-4 py-2 flex items-center gap-2 border-structure text-text-muted">
                <ChevronLeftIcon className="w-4 h-4" /> Zurück zu Räumen
              </button>
              <button onClick={handleApply} className="btn-primary text-sm px-6 py-2 shadow-lg bg-[#33412a] hover:bg-[#3d4d32] border border-primary/50 text-white">
                Speichern & Übernehmen
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
