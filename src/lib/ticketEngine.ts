export type SystemTicket = {
  id: string;
  title: string;
  phase: 1 | 2 | 3;
  type: 'warning' | 'action' | 'info';
  done: boolean;
  actionLink?: string;
  kanbanCategory?: 'kartons' | 'halteverbot' | 'moebellift' | 'rechnung' | 'general';
  dueDateStatus?: 'neutral' | 'due' | 'overdue';
  dueDateText?: string;
  orderId?: string;
  customerName?: string;
  systemEvaluated?: boolean;
};

export function generateTickets(order: any, customer: any): SystemTicket[] {
  const tickets: SystemTicket[] = [];
  const status = order.status || 'draft';
  const states = order.ticketStates || {}; 

  // Helper to calculate due status based on a specific date (e.g. custom delivery date)
  const calculateTargetDateStatus = (targetDateStr: string | null | undefined): { status: 'neutral'|'due'|'overdue', text: string } | null => {
    if (!targetDateStr) return null;
    try {
      const targetDate = new Date(targetDateStr);
      const now = new Date();
      targetDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);
      
      const diffTime = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return { status: 'overdue', text: 'ÜBERFÄLLIG' };
      if (diffDays <= 2) return { status: 'due', text: `FÄLLIG IN ${diffDays} TAGEN` };
      return { status: 'neutral', text: '' };
    } catch (e) {
      return null;
    }
  };

  // Helper to calculate due status relative to move date
  const calculateDueDateStatus = (daysToMove: number | null, dueThreshold: number, overdueThreshold: number): { status: 'neutral'|'due'|'overdue', text: string } => {
    if (daysToMove === null) return { status: 'neutral', text: '' };
    if (daysToMove <= overdueThreshold) return { status: 'overdue', text: 'ÜBERFÄLLIG' };
    if (daysToMove <= dueThreshold) return { status: 'due', text: `FÄLLIG IN ${daysToMove} TAGEN` };
    return { status: 'neutral', text: '' };
  };

  let daysToMove: number | null = null;
  if (order.orderMeta?.movingDateFrom) {
    const moveDate = new Date(order.orderMeta.movingDateFrom);
    const now = new Date();
    const diffTime = moveDate.getTime() - now.getTime();
    daysToMove = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const addTicket = (
    id: string, 
    title: string, 
    phase: 1|2|3, 
    type: 'warning'|'action'|'info', 
    kanbanCategory: 'kartons' | 'halteverbot' | 'moebellift' | 'rechnung' | 'general' = 'general',
    actionLink?: string,
    dueStatus?: { status: 'neutral'|'due'|'overdue', text: string },
    systemDone?: boolean
  ) => {
    const isSystemEvaluated = systemDone !== undefined;
    tickets.push({
      id,
      title,
      phase,
      type,
      done: isSystemEvaluated ? (systemDone || !!states[id]) : !!states[id],
      actionLink,
      kanbanCategory,
      dueDateStatus: dueStatus?.status || 'neutral',
      dueDateText: dueStatus?.text || '',
      orderId: order.id,
      customerName: order.customerName || 'Unbekannt',
      systemEvaluated: isSystemEvaluated
    });
  };

  const hasServiceLike = (keywords: string[]) => {
    if (!order.services || !Array.isArray(order.services)) return false;
    return order.services.some((s: any) => 
      keywords.some(kw => s.name.toLowerCase().includes(kw.toLowerCase()))
    );
  };

  // === Phase 1: Vor Bestätigung (draft, quote) ===
  if (status === 'draft' || status === 'quote') {
    // Phase 1 Overdue Check: 3 days after creation of customer
    let isPhase1Overdue = false;
    if (customer?.createdAt) {
      const createdDate = customer.createdAt?.seconds ? new Date(customer.createdAt.seconds * 1000) : new Date(customer.createdAt);
      const now = new Date();
      const diffTime = now.getTime() - createdDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays >= 3) {
        isPhase1Overdue = true;
      }
    }

    const hasDate = !!(order.orderMeta?.movingDateFrom || order.orderMeta?.movingDateTo);
    const dateDueStatus = isPhase1Overdue && !hasDate ? { status: 'overdue' as const, text: 'ÜBERFÄLLIG' } : undefined;
    addTicket('missing_date', 'Umzugsdatum fehlt (Kunde hat kein Datum genannt)', 1, 'warning', 'general', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`, dateDueStatus, hasDate);
    
    const hasDestination = !!(order.logistics?.b_city || order.logistics?.b_street);
    const destDueStatus = isPhase1Overdue && !hasDestination ? { status: 'overdue' as const, text: 'ÜBERFÄLLIG' } : undefined;
    addTicket('missing_destination', 'Entladeadresse fehlt (Zielort nicht bekannt)', 1, 'warning', 'general', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`, destDueStatus, hasDestination);

    const hasPhone = !!(order.billingAddress?.phone || customer?.phone);
    const phoneDueStatus = isPhase1Overdue && !hasPhone ? { status: 'overdue' as const, text: 'ÜBERFÄLLIG' } : undefined;
    addTicket('missing_phone', 'Telefonnummer des Kunden fehlt', 1, 'warning', 'general', `/dashboard/customers/${order.customerId}`, phoneDueStatus, hasPhone);

    if (order.orderMeta?.viewingDate === 'requested' || states['viewing_requested']) {
       const isViewingDone = order.orderMeta?.viewingDate !== 'requested' && !!order.orderMeta?.viewingDate;
       const customViewingStatus = calculateTargetDateStatus(order.orderMeta?.viewingDate);
       addTicket('viewing_requested', 'Kunde wünscht einen Besichtigungstermin', 1, 'action', 'general', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`, customViewingStatus || undefined, isViewingDone);
    }
  }

  // === Phase 2: Nach Bestätigung (confirmed) ===
  if (status === 'confirmed') {
    if (hasServiceLike(['karton', 'box', 'kartons'])) {
      // Check for custom carton delivery date first, else calculate relative (due: 28 days before, overdue: 23 days before)
      const customKartonStatus = calculateTargetDateStatus(order.orderMeta?.kartonDeliveryDate);
      const relativeKartonStatus = calculateDueDateStatus(daysToMove, 28, 23);
      addTicket('kartons_liefern', 'Umzugskartons besorgen & an Kunden liefern', 2, 'action', 'kartons', undefined, customKartonStatus || relativeKartonStatus);
    }

    if (hasServiceLike(['küche', 'kueche', 'einbau', 'montage'])) {
      addTicket('einbau_service', 'Einbauservice / Handwerker (Küche/Montage) einplanen', 2, 'action', 'general');
    }

    if (hasServiceLike(['einpack', 'auspack', 'packservice', 'einräum', 'ausräum'])) {
      addTicket('pack_service', 'Packservice Team einplanen (Ein-/Auspacken)', 2, 'action', 'general');
    }

    if (order.logistics?.a_parking || order.logistics?.b_parking || hasServiceLike(['halteverbot'])) {
      // Check for custom HV date first, else relative (overdue: 7 days before)
      const customHvStatus = calculateTargetDateStatus(order.orderMeta?.halteverbotDate);
      const relativeHvStatus = calculateDueDateStatus(daysToMove, 7, 7);
      addTicket('halteverbot', 'Halteverbotszone beantragen & Schilder aufstellen', 2, 'action', 'halteverbot', undefined, customHvStatus || relativeHvStatus);
    }

    if (hasServiceLike(['lift', 'möbellift', 'aufzug'])) {
      // Check for custom Lift date, else relative (overdue: 3 days before)
      const customLiftStatus = calculateTargetDateStatus(order.orderMeta?.moebelliftDate);
      const relativeLiftStatus = calculateDueDateStatus(daysToMove, 3, 3);
      addTicket('moebellift_buchen', 'Möbellift extern buchen / reservieren', 2, 'action', 'moebellift', undefined, customLiftStatus || relativeLiftStatus);
    }

    // Always for confirmed
    const hasDispo = !!(order.disposition?.assignedVehicles?.length && order.disposition?.assignedEmployees?.length);
    addTicket('dispo_missing', 'Disposition: Mitarbeiter & Fahrzeuge im Kalender zuweisen', 2, 'warning', 'general', `/dashboard/calendar`, undefined, hasDispo);

    // Manuelle Checklisten-Punkte durch * in Leistungen
    if (order.services && Array.isArray(order.services)) {
      order.services.forEach((s: any, index: number) => {
        if (s.name && s.name.includes('*')) {
          const cleanName = s.name.replace(/\*/g, '').trim();
          addTicket(`manual_star_${index}`, `Manuelle Aufgabe: ${cleanName}`, 2, 'action', 'general');
        }
      });
    }
  }

  // === Phase 3: Nach Umzug (completed, invoice_*) ===
  if (status === 'completed' || status === 'invoice_open' || status === 'invoice_paid') {
    if (status === 'completed') {
      // Invoice: overdue if daysToMove is <= -5 (5 days after move)
      let dueStatus = calculateDueDateStatus(daysToMove, -1, -5);
      addTicket('invoice_missing', 'Rechnung erstellen (Umzug beendet)', 3, 'warning', 'rechnung', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`, dueStatus);
    }

    if (status === 'invoice_open' || status === 'invoice_overdue') {
      addTicket('payment_check', 'Zahlungseingang prüfen (Rechnung ist noch offen)', 3, 'action', 'rechnung', `/dashboard/customers/${order.customerId}`);
    }

    if (status !== 'invoice_cancelled') {
      addTicket('review_requested', 'Kunden-Anfrage zur Bewertung schicken', 3, 'info', 'general', `/dashboard/customers/${order.customerId}`);
    }
  }

  return tickets;
}
