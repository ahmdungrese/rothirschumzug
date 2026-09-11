export interface LogisticsCheckItem {
  id: string;
  label: string;
  done: boolean;
  type: 'hvz' | 'kartons' | 'moebellift' | 'address' | 'team' | 'signature';
  date?: string;
  isAutomated?: boolean;
  missingReason?: string;
}

export interface OrderLogisticsEvaluation {
  isComplete: boolean;
  color: 'emerald' | 'amber';
  borderClass: string;
  badgeClass: string;
  statusLabel: string;
  missingCount: number;
  checklist: LogisticsCheckItem[];
  leadSource: string;
  routeDisplay: string;
  movingDateDisplay: string;
  angebotStatus: {
    label: string;
    isErstellt: boolean;
    isSigned: boolean;
  };
}

export function evaluateOrderLogistics(order: any, customer?: any): OrderLogisticsEvaluation {
  const meta = order?.orderMeta || {};
  const logistics = order?.logistics || {};
  const services = order?.services || {};
  const cust = customer || order?.customer || {};

  // 1. Lead Source
  const leadSource = cust?.source || meta?.source || order?.source || 'Direkt';

  // 2. Route Display
  const fromCity = logistics?.a_city || logistics?.from?.city || logistics?.auszug?.city || meta?.fromCity || 'Start';
  const toCity = logistics?.b_city || logistics?.to?.city || logistics?.einzug?.city || meta?.toCity || 'Ziel';
  const routeDisplay = `${fromCity} ➔ ${toCity}`;

  // 3. Moving Date
  const movingDateRaw = meta?.movingDateFrom || order?.movingDate || logistics?.movingDate;
  let movingDateDisplay = 'Kein Datum';
  if (movingDateRaw) {
    try {
      const d = new Date(movingDateRaw);
      movingDateDisplay = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      movingDateDisplay = String(movingDateRaw);
    }
  }

  // 4. Angebot & Signatur Status
  const isSigned = order?.status === 'confirmed' || !!(order?.signatures?.customer || order?.isManuallySigned || order?.contractSigned);
  const isErstellt = order?.status !== 'draft';
  const angebotLabel = isSigned 
    ? 'Vertrag bestätigt' 
    : isErstellt 
      ? 'Angebot erstellt' 
      : 'Entwurf (Offen)';

  // 5. Checklist Items
  const checklist: LogisticsCheckItem[] = [];

  // Address Check: Check both OrderEditor standard fields (a_street/a_city, b_street/b_city) and mock/legacy fields
  const hasFrom = !!(logistics?.a_street || logistics?.a_city || logistics?.from?.street || logistics?.from?.address || logistics?.auszug?.street);
  const hasTo = !!(logistics?.b_street || logistics?.b_city || logistics?.to?.street || logistics?.to?.address || logistics?.einzug?.street);
  const isAddressDone = hasFrom && hasTo;
  checklist.push({
    id: 'address',
    label: isAddressDone ? 'Adressen vollständig (A & B)' : 'Adressen unvollständig (Start & Ziel)',
    done: isAddressDone,
    type: 'address',
    isAutomated: true,
    missingReason: !hasFrom && !hasTo 
      ? 'Auszugs- und Einzugsadresse fehlen im Auftragsformular.' 
      : !hasFrom 
        ? 'Auszugsadresse (Start) fehlt im Auftragsformular.' 
        : 'Einzugsadresse (Ziel) fehlt im Auftragsformular.'
  });

  const hasLogisticsData = hasFrom || hasTo;
  const isDraft = order?.status === 'draft';

  // 1. HVZ Check (Halteverbotszone) - BEDARFSGESTEUERT: Nur anzeigen, wenn tatsächlich gebucht / benötigt
  const hasHVZService = Array.isArray(order?.services) && order.services.some((s: any) => 
    (s.name || '').toLowerCase().includes('halteverbot') || (s.name || '').toLowerCase().includes('hvz')
  );
  const needsHVZ = isSigned && Boolean(
    logistics?.a_parking || 
    logistics?.b_parking || 
    logistics?.needHVZ || 
    hasHVZService || 
    services?.halteverbot ||
    order?.servicesList?.some((s: any) => (s.name || '').toLowerCase().includes('halteverbot'))
  );

  if (needsHVZ) {
    const isHVZDone = Boolean(logistics?.hvzConfirmed || logistics?.hvzStatus === 'confirmed' || logistics?.hvzDate || order?.checklistDone?.hvz);
    checklist.push({
      id: 'hvz',
      label: isHVZDone ? 'HVZ Halteverbot beantragt' : 'HVZ Halteverbot erforderlich (Ausstehend)',
      done: isHVZDone,
      type: 'hvz',
      isAutomated: false,
      missingReason: !isHVZDone ? 'Halteverbotszone wurde gebucht, ist aber noch nicht beantragt oder bestätigt.' : undefined,
      date: logistics?.hvzDate
    });
  }

  // 2. Kartons Check (Verpackungsmaterial) - BEDARFSGESTEUERT: Nur anzeigen, wenn Kartons / Material gebucht
  const hasBoxService = Array.isArray(order?.services) && order.services.some((s: any) => 
    (s.name || '').toLowerCase().includes('karton') || (s.name || '').toLowerCase().includes('verpack') || (s.name || '').toLowerCase().includes('pack')
  );
  const hasMaterials = Array.isArray(order?.materials) && order.materials.length > 0;
  const needsBoxes = isSigned && Boolean(hasBoxService || hasMaterials || services?.kartons);

  if (needsBoxes) {
    const isBoxesDone = Boolean(logistics?.boxesDelivered || order?.checklistDone?.kartons || logistics?.boxDeliveryDate);
    checklist.push({
      id: 'kartons',
      label: isBoxesDone ? 'Kartons ausgeliefert' : 'Kartons / Material gebucht (Ausstehend)',
      done: isBoxesDone,
      type: 'kartons',
      isAutomated: false,
      missingReason: !isBoxesDone ? 'Verpackungsmaterial ist gebucht, aber noch nicht ausgeliefert.' : undefined,
      date: logistics?.boxDeliveryDate || order?.orderMeta?.kartonDeliveryDate
    });
  }

  // 3. Möbellift Check - BEDARFSGESTEUERT: Nur anzeigen, wenn Möbellift gebucht oder hohe Etage ohne Aufzug
  const hasFloorInfo = Boolean(logistics?.a_floor || logistics?.b_floor || logistics?.from?.floor || logistics?.to?.floor);
  const hasLiftService = Array.isArray(order?.services) && order.services.some((s: any) => 
    (s.name || '').toLowerCase().includes('möbellift') || (s.name || '').toLowerCase().includes('moebellift') || (s.name || '').toLowerCase().includes('lift')
  );
  const floorA = parseInt(logistics?.a_floor || logistics?.from?.floor || '0');
  const floorB = parseInt(logistics?.b_floor || logistics?.to?.floor || '0');
  const highFloorWithoutElevatorA = floorA > 3 && !logistics?.a_elevator && !logistics?.from?.hasElevator;
  const highFloorWithoutElevatorB = floorB > 3 && !logistics?.b_elevator && !logistics?.to?.hasElevator;

  const needsLift = isSigned && Boolean(
    logistics?.a_furnitureLift || 
    logistics?.b_furnitureLift || 
    logistics?.needLift || 
    hasLiftService || 
    services?.moebellift || 
    (hasFloorInfo && (highFloorWithoutElevatorA || highFloorWithoutElevatorB))
  );

  if (needsLift) {
    const isLiftDone = Boolean(logistics?.liftReserved || order?.checklistDone?.moebellift);
    checklist.push({
      id: 'moebellift',
      label: isLiftDone ? 'Möbellift reserviert' : 'Möbellift erforderlich (Nicht reserviert)',
      done: isLiftDone,
      type: 'moebellift',
      isAutomated: false,
      missingReason: !isLiftDone ? 'Ein Möbellift wird benötigt (hohe Etage oder gebucht), ist aber noch nicht reserviert.' : undefined
    });
  }

  // Signatur / Bestätigung Check (Aktionierbar: Häkchen setzen/entfernen steuert den Status)
  checklist.push({
    id: 'signature',
    label: isSigned ? 'Auftrag / Angebot bestätigt' : 'Auftrag / Vertrag unbestätigt',
    done: isSigned,
    type: 'signature',
    isAutomated: false,
    missingReason: !isSigned ? 'Das Angebot liegt beim Kunden oder ist noch in Verhandlung und wurde noch nicht bestätigt.' : undefined
  });

  const missingItems = checklist.filter(c => !c.done);
  const isComplete = missingItems.length === 0;

  return {
    isComplete,
    color: isComplete ? 'emerald' : 'amber',
    borderClass: isComplete ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-orange-500',
    badgeClass: isComplete 
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
    statusLabel: isComplete ? 'Logistik bereit' : 'Logistik unvollständig',
    missingCount: missingItems.length,
    checklist,
    leadSource,
    routeDisplay,
    movingDateDisplay,
    angebotStatus: {
      label: angebotLabel,
      isErstellt,
      isSigned
    }
  };
}
