import { isTaskCompleted } from './taskStateController';

export interface LogisticsCheckItem {
  id: string;
  label: string;
  done: boolean;
  type: 'hvz' | 'kartons' | 'moebellift' | 'address' | 'team' | 'signature' | 'protocol' | 'invoice' | 'payment';
  date?: string;
  isAutomated?: boolean;
  missingReason?: string;
  details?: string;
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
  phase: 1 | 2 | 3 | 4;
  phaseLabel: string;
  materialsSummary: {
    standard: number;
    buecher: number;
    kleider: number;
    total: number;
  };
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

  // 4. Calculate materials / box counts from offer
  let standardBoxes = 0;
  let buecherBoxes = 0;
  let kleiderBoxes = 0;
  const countBox = (name: string, qty: number) => {
    const n = (name || '').toLowerCase();
    if (n.includes('bücher') || n.includes('buecher')) buecherBoxes += qty;
    else if (n.includes('kleider')) kleiderBoxes += qty;
    else if (n.includes('karton') || n.includes('box')) standardBoxes += qty;
  };
  if (Array.isArray(order?.services)) {
    order.services.forEach((s: any) => countBox(s.name, s.quantity || 1));
  }
  if (Array.isArray(order?.inventory)) {
    order.inventory.forEach((i: any) => countBox(i.name, i.quantity || 1));
  }
  if (Array.isArray(order?.materials)) {
    order.materials.forEach((m: any) => countBox(m.name || 'Packmittel', m.quantity || 1));
  }
  const totalBoxes = standardBoxes + buecherBoxes + kleiderBoxes;
  const materialsSummary = {
    standard: standardBoxes,
    buecher: buecherBoxes,
    kleider: kleiderBoxes,
    total: totalBoxes
  };

  // 5. Determine Current Phase
  const isSigned = isTaskCompleted(order, 'signature');
  const isDraft = order?.status === 'draft';
  const hasInvoice = Boolean(
    order?.invoiceNumber ||
    order?.status?.startsWith('invoice_') ||
    order?.status === 'completed' ||
    order?.status === 'archived' ||
    (Array.isArray(order?.invoices) && order.invoices.length > 0)
  );
  const isConfirmed = isSigned || order?.status === 'confirmed';

  let phase: 1 | 2 | 3 | 4 = 1;
  let phaseLabel = 'Entwurf';

  if (hasInvoice || order?.status === 'completed' || order?.status?.startsWith('invoice_')) {
    phase = 4;
    phaseLabel = order?.status === 'invoice_paid' ? 'Abgeschlossen & Bezahlt' : 'Abrechnung & Durchführung';
  } else if (isConfirmed) {
    phase = 3;
    phaseLabel = 'Auftrag bestätigt';
  } else if (!isDraft) {
    phase = 2;
    phaseLabel = 'Angebot versendet';
  } else {
    phase = 1;
    phaseLabel = 'Entwurf';
  }

  const isErstellt = !isDraft;
  const angebotLabel = isSigned 
    ? 'Vertrag bestätigt' 
    : isErstellt 
      ? 'Angebot erstellt' 
      : 'Entwurf (Offen)';

  const checklist: LogisticsCheckItem[] = [];

  // =========================================================================
  // PHASES 1 & 2: ENTWURF & VERHANDLUNG
  // (Hier gehören Adressen, Stammdaten, Besichtigung & Unterschrift hin)
  // =========================================================================
  if (phase === 1 || phase === 2) {
    // 1. Address Check: Auszugs- & Einzugsadresse
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

    // 2. Data Verification
    const isDataVerified = isTaskCompleted(order, 'data_verified');
    checklist.push({
      id: 'data_verified',
      label: isDataVerified ? 'Stammdaten & Termin abgeglichen' : 'Stammdaten & Termin abgleichen',
      done: isDataVerified,
      type: 'signature',
      isAutomated: false,
      missingReason: !isDataVerified ? 'Kundendaten wurden noch nicht final bestätigt.' : undefined
    });

    // 3. Besichtigungstermin
    const hasViewing = isTaskCompleted(order, 'viewing_date') || Boolean(meta?.viewingDate || order?.viewingDate);
    checklist.push({
      id: 'viewing_date',
      label: hasViewing ? 'Besichtigungstermin erledigt/geplant' : 'Besichtigung vereinbaren (Optional)',
      done: hasViewing,
      type: 'signature',
      isAutomated: false,
      date: meta?.viewingDate || order?.viewingDate
    });

    // 4. In Phase 1: Angebot kalkulieren
    if (phase === 1) {
      checklist.push({
        id: 'angebot_sent',
        label: 'Angebot kalkulieren und versenden',
        done: false,
        type: 'signature',
        isAutomated: true,
        missingReason: 'Der Auftrag ist noch als Entwurf markiert.'
      });
    }

    // 5. In Phase 2: Digitale Unterschrift / Bestätigung
    if (phase === 2) {
      checklist.push({
        id: 'signature',
        label: isSigned ? 'Auftrag / Vertrag bestätigt' : 'Vertragsbestätigung / Digitale Unterschrift',
        done: isSigned,
        type: 'signature',
        isAutomated: false,
        missingReason: !isSigned ? 'Warten auf Unterschrift des Kunden.' : undefined
      });
    }
  }

  // =========================================================================
  // PHASE 3: BESTÄTIGT / OPERATIVE LOGISTIK-VORBEREITUNG
  // (KEINE Adressen! Keine Besichtigung! Nur operative Vorbereitung für Umzugstag)
  // =========================================================================
  else if (phase === 3) {
    // 1. Umzugskartons / Verpackungsmaterial
    const isBoxesDone = isTaskCompleted(order, 'kartons');
    const needsBoxes = Boolean(
      totalBoxes > 0 ||
      logistics?.boxDeliveryDate ||
      order?.orderMeta?.kartonDeliveryDate ||
      services?.packservice ||
      isBoxesDone
    );
    const boxBreakdown = [
      standardBoxes > 0 ? `${standardBoxes}x Standard` : '',
      buecherBoxes > 0 ? `${buecherBoxes}x Bücher` : '',
      kleiderBoxes > 0 ? `${kleiderBoxes}x Kleider` : ''
    ].filter(Boolean).join(', ');

    const boxLabel = isBoxesDone
      ? (totalBoxes > 0 ? `Kartons geliefert (${totalBoxes} Stk.)` : 'Kartons ausgeliefert')
      : (totalBoxes > 0 ? `Umzugskartons liefern (${totalBoxes} Stk.${boxBreakdown ? `: ${boxBreakdown}` : ''})` : 'Umzugskartons liefern');

    checklist.push({
      id: 'kartons',
      label: boxLabel,
      done: needsBoxes ? isBoxesDone : true,
      type: 'kartons',
      isAutomated: false,
      missingReason: (!isBoxesDone && needsBoxes) ? 'Verpackungsmaterial ist gebucht, aber noch nicht ausgeliefert.' : undefined,
      date: logistics?.boxDeliveryDate || order?.orderMeta?.kartonDeliveryDate,
      details: boxBreakdown || (totalBoxes > 0 ? `${totalBoxes} Kartons` : undefined)
    });

    // 2. HVZ Halteverbotszone
    const hasHVZService = Array.isArray(order?.services) && order.services.some((s: any) => 
      (s.name || '').toLowerCase().includes('halteverbot') || (s.name || '').toLowerCase().includes('hvz')
    );
    const needsHVZ = Boolean(
      logistics?.a_parking || 
      logistics?.b_parking || 
      logistics?.needHVZ || 
      hasHVZService || 
      services?.halteverbot ||
      logistics?.hvzDate ||
      order?.orderMeta?.halteverbotDate ||
      order?.servicesList?.some((s: any) => (s.name || '').toLowerCase().includes('halteverbot'))
    );
    const isHVZDone = isTaskCompleted(order, 'hvz');
    checklist.push({
      id: 'hvz',
      label: isHVZDone 
        ? 'HVZ Halteverbot eingerichtet/beantragt' 
        : needsHVZ 
          ? 'HVZ Halteverbot beantragen (Gebucht)' 
          : 'HVZ Halteverbot einrichten (Optional)',
      done: needsHVZ ? isHVZDone : true,
      type: 'hvz',
      isAutomated: false,
      missingReason: (!isHVZDone && needsHVZ) ? 'Halteverbotszone ist gebucht, aber noch nicht bestätigt.' : undefined,
      date: logistics?.hvzDate || order?.orderMeta?.halteverbotDate
    });

    // 3. Möbellift
    const hasLiftService = Array.isArray(order?.services) && order.services.some((s: any) => 
      (s.name || '').toLowerCase().includes('möbellift') || (s.name || '').toLowerCase().includes('moebellift') || (s.name || '').toLowerCase().includes('lift')
    );
    const floorA = parseInt(logistics?.a_floor || logistics?.from?.floor || '0');
    const floorB = parseInt(logistics?.b_floor || logistics?.to?.floor || '0');
    const highFloorWithoutElevatorA = floorA > 3 && !logistics?.a_elevator && !logistics?.from?.hasElevator;
    const highFloorWithoutElevatorB = floorB > 3 && !logistics?.b_elevator && !logistics?.to?.hasElevator;
    const needsLift = Boolean(
      logistics?.a_furnitureLift || 
      logistics?.b_furnitureLift || 
      logistics?.needLift || 
      hasLiftService || 
      services?.moebellift || 
      order?.orderMeta?.moebelliftDate ||
      logistics?.moebelliftDate ||
      (floorA > 0 && highFloorWithoutElevatorA) || 
      (floorB > 0 && highFloorWithoutElevatorB)
    );

    const isLiftDone = isTaskCompleted(order, 'moebellift');
    if (needsLift || isLiftDone) {
      checklist.push({
        id: 'moebellift',
        label: isLiftDone ? 'Möbellift reserviert' : 'Möbellift reservieren (Erforderlich)',
        done: isLiftDone,
        type: 'moebellift',
        isAutomated: false,
        missingReason: !isLiftDone ? 'Möbellift wird benötigt, ist aber noch nicht reserviert.' : undefined,
        date: order?.orderMeta?.moebelliftDate || logistics?.moebelliftDate
      });
    }
  }

  // =========================================================================
  // PHASE 4: DURCHFÜHRUNG & ABRECHNUNG
  // (KEINE Adressen! Keine Kartons! Nur Protokoll, Rechnung & Zahlung)
  // =========================================================================
  else if (phase === 4) {
    // 1. Übergabeprotokoll
    const isProtocolDone = isTaskCompleted(order, 'protocol') || Boolean(order?.protocols?.length > 0);
    checklist.push({
      id: 'protocol',
      label: isProtocolDone ? 'Übergabeprotokoll erstellt' : 'Übergabeprotokoll erstellen / abnehmen',
      done: isProtocolDone,
      type: 'protocol',
      isAutomated: false,
      missingReason: !isProtocolDone ? 'Noch kein Abnahmeprotokoll für diesen Umzug erfasst.' : undefined
    });

    // 2. Rechnung
    const isInvoiceDone = isTaskCompleted(order, 'invoice') || Boolean(
      order?.invoiceNumber || 
      (Array.isArray(order?.invoices) && order.invoices.length > 0) || 
      order?.status?.startsWith('invoice_')
    );
    checklist.push({
      id: 'invoice',
      label: isInvoiceDone ? `Rechnung ausgestellt (${order?.invoiceNumber || 'Erledigt'})` : 'Schlussrechnung ausstellen',
      done: isInvoiceDone,
      type: 'invoice',
      isAutomated: true,
      missingReason: !isInvoiceDone ? 'Rechnung wurde noch nicht final generiert.' : undefined
    });

    // 3. Zahlung
    const isPaymentDone = isTaskCompleted(order, 'payment') || Boolean(order?.status === 'invoice_paid');
    checklist.push({
      id: 'payment',
      label: isPaymentDone ? 'Zahlung vollständig eingegangen' : 'Zahlung erfassen / offen',
      done: isPaymentDone,
      type: 'payment',
      isAutomated: false,
      missingReason: !isPaymentDone ? 'Zahlung für die Rechnung steht noch aus.' : undefined
    });
  }

  const missingItems = checklist.filter(c => !c.done);
  const isComplete = missingItems.length === 0;

  let statusLabel = isComplete ? 'Logistik bereit' : 'Logistik unvollständig';
  if (phase === 4) {
    statusLabel = isComplete ? 'Auftrag vollständig abgeschlossen' : 'Abrechnung ausstehend';
  } else if (phase === 3) {
    statusLabel = isComplete ? 'Logistik vollständig bereit' : 'Logistik-Vorbereitung ausstehend';
  } else if (phase === 2) {
    statusLabel = isComplete ? 'Vertrag bestätigt' : 'Angebot in Verhandlung';
  } else {
    statusLabel = isComplete ? 'Entwurf vollständig' : 'Entwurf unvollständig';
  }

  return {
    isComplete,
    color: isComplete ? 'emerald' : 'amber',
    borderClass: isComplete ? 'border-l-4 border-l-emerald-500' : 'border-l-4 border-l-orange-500',
    badgeClass: isComplete 
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
      : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20',
    statusLabel,
    missingCount: missingItems.length,
    checklist,
    leadSource,
    routeDisplay,
    movingDateDisplay,
    phase,
    phaseLabel,
    materialsSummary,
    angebotStatus: {
      label: angebotLabel,
      isErstellt,
      isSigned
    }
  };
}
