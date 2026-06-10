export type SystemTicket = {
  id: string;
  title: string;
  phase: 1 | 2 | 3;
  type: 'warning' | 'action' | 'info';
  done: boolean;
  actionLink?: string;
};

export function generateTickets(order: any, customer: any): SystemTicket[] {
  const tickets: SystemTicket[] = [];
  const status = order.status || 'draft';
  const states = order.ticketStates || {}; // e.g. { "missing_date": true }

  const addTicket = (id: string, title: string, phase: 1|2|3, type: 'warning'|'action'|'info', actionLink?: string) => {
    tickets.push({
      id,
      title,
      phase,
      type,
      done: !!states[id],
      actionLink
    });
  };

  // Hilfsfunktionen für Erkennung
  const hasServiceLike = (keywords: string[]) => {
    if (!order.services || !Array.isArray(order.services)) return false;
    return order.services.some((s: any) => 
      keywords.some(kw => s.name.toLowerCase().includes(kw.toLowerCase()))
    );
  };

  // === Phase 1: Vor Bestätigung (draft, quote) ===
  if (status === 'draft' || status === 'quote') {
    if (!order.orderMeta?.movingDateFrom && !order.orderMeta?.movingDateTo) {
      addTicket('missing_date', 'Umzugsdatum fehlt (Kunde hat kein Datum genannt)', 1, 'warning', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`);
    }
    
    if (!order.logistics?.b_city && !order.logistics?.b_street) {
      addTicket('missing_destination', 'Entladeadresse fehlt (Zielort nicht bekannt)', 1, 'warning', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`);
    }

    const hasPhone = (order.billingAddress?.phone) || (customer?.phone);
    if (!hasPhone) {
      addTicket('missing_phone', 'Telefonnummer des Kunden fehlt', 1, 'warning', `/dashboard/customers/${order.customerId}`);
    }

    if (order.orderMeta?.viewingDate === 'requested') {
      addTicket('viewing_requested', 'Kunde wünscht einen Besichtigungstermin', 1, 'action', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`);
    }
  }

  // === Phase 2: Nach Bestätigung (confirmed) ===
  if (status === 'confirmed') {
    if (hasServiceLike(['karton', 'box', 'kartons'])) {
      addTicket('kartons_liefern', 'Umzugskartons besorgen & an Kunden liefern', 2, 'action', `/dashboard/calendar`);
    }

    if (hasServiceLike(['küche', 'kueche', 'einbau', 'montage'])) {
      addTicket('einbau_service', 'Einbauservice / Handwerker (Küche/Montage) einplanen', 2, 'action', `/dashboard/calendar`);
    }

    if (hasServiceLike(['einpack', 'auspack', 'packservice', 'einräum', 'ausräum'])) {
      addTicket('pack_service', 'Packservice Team einplanen (Ein-/Auspacken)', 2, 'action', `/dashboard/calendar`);
    }

    if (order.logistics?.a_parking || order.logistics?.b_parking) {
      addTicket('halteverbot', 'Halteverbotszone beantragen & Schilder aufstellen', 2, 'action', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`);
    }

    // Always for confirmed
    if (!order.disposition?.assignedVehicles?.length || !order.disposition?.assignedEmployees?.length) {
      addTicket('dispo_missing', 'Disposition: Mitarbeiter & Fahrzeuge im Kalender zuweisen', 2, 'warning', `/dashboard/calendar`);
    }

    // Manuelle Checklisten-Punkte durch * in Leistungen
    if (order.services && Array.isArray(order.services)) {
      order.services.forEach((s: any, index: number) => {
        if (s.name && s.name.includes('*')) {
          const cleanName = s.name.replace(/\*/g, '').trim();
          addTicket(`manual_star_${index}`, `Manuelle Aufgabe: ${cleanName}`, 2, 'action');
        }
      });
    }
  }

  // === Phase 3: Nach Umzug (completed, invoice_*) ===
  if (status === 'completed' || status === 'invoice_open' || status === 'invoice_paid') {
    if (status === 'completed') {
      addTicket('invoice_missing', 'Umzug beendet: Rechnung muss noch erstellt werden!', 3, 'warning', `/dashboard/customers/${order.customerId}/edit-order/${order.id}`);
    }

    if (status === 'invoice_open' || status === 'invoice_overdue') {
      addTicket('payment_check', 'Zahlungseingang prüfen (Rechnung ist noch offen)', 3, 'action', `/dashboard/customers/${order.customerId}`);
    }

    // Unabhängig davon, ob bezahlt oder nicht, nach dem Umzug Bewertung anfragen
    if (status !== 'invoice_cancelled') {
      addTicket('review_requested', 'Kunden-Anfrage zur Bewertung schicken', 3, 'info', `/dashboard/customers/${order.customerId}`);
    }
  }

  return tickets;
}
