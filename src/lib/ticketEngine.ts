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

  // Helper to calculate due status
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
    // difference in days
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
      done: isSystemEvaluated ? systemDone : !!states[id],
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
    const hasDate = !!(order.orderMeta?.movingDateFrom || order.orderMeta?.movingDateTo);
    addTicket('missing_date', 'Umzugsdatum fehlt (Kunde hat kein Datum genannt)', 1, 'warning', 'general', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`, undefined, hasDate);
    
    const hasDestination = !!(order.logistics?.b_city || order.logistics?.b_street);
    addTicket('missing_destination', 'Entladeadresse fehlt (Zielort nicht bekannt)', 1, 'warning', 'general', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`, undefined, hasDestination);

    const hasPhone = !!(order.billingAddress?.phone || customer?.phone);
    addTicket('missing_phone', 'Telefonnummer des Kunden fehlt', 1, 'warning', 'general', `/dashboard/customers/${order.customerId}`, undefined, hasPhone);

    const viewingDone = order.orderMeta?.viewingDate !== 'requested' && !!order.orderMeta?.viewingDate;
    // We only show viewing requested task if it was ever requested. If not requested, we don't show it. 
    // Wait, previously it was only added if 'requested'. Now we always show it if 'requested' or if it was requested and is now done.
    // Actually, if it's 'requested', done = false. If it's a real date, done = true. But we don't know if it WAS requested.
    // Let's just keep the old logic for viewing_requested but pass systemDone.
    if (order.orderMeta?.viewingDate === 'requested' || states['viewing_requested']) {
       const isViewingDone = order.orderMeta?.viewingDate !== 'requested' && !!order.orderMeta?.viewingDate;
       addTicket('viewing_requested', 'Kunde wünscht einen Besichtigungstermin', 1, 'action', 'general', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`, undefined, isViewingDone);
    }
  }

  // === Phase 2: Nach Bestätigung (confirmed) ===
  if (status === 'confirmed') {
    if (hasServiceLike(['karton', 'box', 'kartons'])) {
      // Kartons: fällig 14-8 Tage vor, überfällig <= 7 Tage vor
      const dueStatus = calculateDueDateStatus(daysToMove, 14, 7);
      addTicket('kartons_liefern', 'Umzugskartons besorgen & an Kunden liefern', 2, 'action', 'kartons', undefined, dueStatus);
    }

    if (hasServiceLike(['küche', 'kueche', 'einbau', 'montage'])) {
      addTicket('einbau_service', 'Einbauservice / Handwerker (Küche/Montage) einplanen', 2, 'action', 'general');
    }

    if (hasServiceLike(['einpack', 'auspack', 'packservice', 'einräum', 'ausräum'])) {
      addTicket('pack_service', 'Packservice Team einplanen (Ein-/Auspacken)', 2, 'action', 'general');
    }

    if (order.logistics?.a_parking || order.logistics?.b_parking || hasServiceLike(['halteverbot'])) {
      // Halteverbot: fällig 21-15 Tage vor, überfällig <= 14 Tage vor
      const dueStatus = calculateDueDateStatus(daysToMove, 21, 14);
      addTicket('halteverbot', 'Halteverbotszone beantragen & Schilder aufstellen', 2, 'action', 'halteverbot', undefined, dueStatus);
    }

    if (hasServiceLike(['lift', 'möbellift', 'aufzug'])) {
      // Möbellift: fällig 14-8 Tage vor, überfällig <= 7 Tage vor
      const dueStatus = calculateDueDateStatus(daysToMove, 14, 7);
      addTicket('moebellift_buchen', 'Möbellift extern buchen / reservieren', 2, 'action', 'moebellift', undefined, dueStatus);
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
      // Rechnung erstellen: fällig 1 Tag nach Umzug (-1 Tage), überfällig <= -3 Tage
      // daysToMove is negative if move is in the past. e.g. move was yesterday -> daysToMove = -1.
      let dueStatus: { status: 'neutral' | 'due' | 'overdue', text: string } = { status: 'neutral', text: '' };
      if (daysToMove !== null) {
        if (daysToMove <= -3) {
          dueStatus = { status: 'overdue', text: 'ÜBERFÄLLIG' };
        } else if (daysToMove <= -1) {
          dueStatus = { status: 'due', text: 'FÄLLIG' };
        }
      }
      addTicket('invoice_missing', 'Rechnung erstellen (Umzug beendet)', 3, 'warning', 'rechnung', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`, dueStatus);
    }

    if (status === 'invoice_open' || status === 'invoice_overdue') {
      addTicket('payment_check', 'Zahlungseingang prüfen (Rechnung ist noch offen)', 3, 'action', 'rechnung', `/dashboard/customers/${order.customerId}`);
    }

    // Unabhängig davon, ob bezahlt oder nicht, nach dem Umzug Bewertung anfragen
    if (status !== 'invoice_cancelled') {
      addTicket('review_requested', 'Kunden-Anfrage zur Bewertung schicken', 3, 'info', 'general', `/dashboard/customers/${order.customerId}`);
    }
  }

  return tickets;
}
