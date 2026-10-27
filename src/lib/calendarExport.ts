import { triggerHaptic } from './haptics';
import toast from 'react-hot-toast';

export interface CalendarEventPayload {
  title: string;
  startDate: string; // YYYY-MM-DD or ISO
  startTime?: string; // HH:mm or e.g. "08:00 - 12:00" or "Ganztägig"
  endDate?: string; // YYYY-MM-DD
  endTime?: string; // HH:mm
  durationHours?: number;
  location?: string;
  description?: string;
  category?: 'Umzug' | 'Besichtigung' | 'Halteverbot' | 'Kartons' | 'Möbellift' | 'Logistik';
  url?: string;
  orderId?: string;
}

/**
 * Escapes characters for iCalendar RFC 5545 compliance
 */
function escapeIcsText(str: string = ''): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Formats a date string (YYYY-MM-DD) into iCalendar DATE format (YYYYMMDD)
 */
function formatDateToIcsDate(dateStr: string): string {
  const clean = dateStr.split('T')[0].replace(/-/g, '');
  return clean;
}

/**
 * Adds one day to a YYYY-MM-DD string for exclusive end dates in all-day events
 */
function addOneDay(dateStr: string): string {
  const d = new Date(dateStr.split('T')[0]);
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Formats date and time into local floating iCalendar format: YYYYMMDDTHHmm00
 */
function formatDateTimeToIcs(dateStr: string, timeStr: string): string {
  const cleanDate = dateStr.split('T')[0].replace(/-/g, '');
  const cleanTime = timeStr.trim().replace(':', '').padEnd(4, '0').slice(0, 4);
  return `${cleanDate}T${cleanTime}00`;
}

/**
 * Generates an RFC 5545 compliant VCALENDAR string for single or multiple events
 */
export function buildIcsContent(events: CalendarEventPayload[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rothirsch Logistics ERP//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];

  const nowIcs = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  events.forEach((ev, idx) => {
    const rawDate = ev.startDate?.split('T')[0];
    if (!rawDate) return;

    const uid = `${ev.orderId || 'event'}-${ev.category || 'task'}-${Date.now()}-${idx}@rothirsch-umzug.de`;
    
    // Check if timed or full-day
    let isAllDay = true;
    let dtStartLine = '';
    let dtEndLine = '';

    const time = (ev.startTime || '').trim();
    const isSpecificTime = time && !time.toLowerCase().includes('ganztägig') && !time.toLowerCase().includes('flexibel');

    if (isSpecificTime) {
      // Check if it's a range like "08:00 - 12:00"
      if (time.includes('-')) {
        const parts = time.split('-').map(p => p.trim());
        const startT = parts[0];
        const endT = parts[1];
        if (startT) {
          isAllDay = false;
          dtStartLine = `DTSTART:${formatDateTimeToIcs(rawDate, startT)}`;
          if (endT) {
            dtEndLine = `DTEND:${formatDateTimeToIcs(ev.endDate || rawDate, endT)}`;
          } else {
            // default 2 hours
            const [h, m] = startT.split(':').map(Number);
            const endHour = String(Math.min(23, (h || 8) + 2)).padStart(2, '0');
            dtEndLine = `DTEND:${formatDateTimeToIcs(ev.endDate || rawDate, `${endHour}:${String(m || 0).padStart(2, '0')}`)}`;
          }
        }
      } else {
        // Single time like "08:00"
        isAllDay = false;
        dtStartLine = `DTSTART:${formatDateTimeToIcs(rawDate, time)}`;
        
        let duration = ev.durationHours || 2;
        if (ev.category === 'Umzug') duration = ev.durationHours || 6;
        if (ev.category === 'Besichtigung') duration = ev.durationHours || 1;

        if (ev.endTime) {
          dtEndLine = `DTEND:${formatDateTimeToIcs(ev.endDate || rawDate, ev.endTime)}`;
        } else {
          const [h, m] = time.split(':').map(Number);
          const endHour = String(Math.min(23, (h || 8) + duration)).padStart(2, '0');
          dtEndLine = `DTEND:${formatDateTimeToIcs(ev.endDate || rawDate, `${endHour}:${String(m || 0).padStart(2, '0')}`)}`;
        }
      }
    }

    if (isAllDay) {
      dtStartLine = `DTSTART;VALUE=DATE:${formatDateToIcsDate(rawDate)}`;
      dtEndLine = `DTEND;VALUE=DATE:${addOneDay(ev.endDate || rawDate)}`;
    }

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${nowIcs}`);
    lines.push(dtStartLine);
    lines.push(dtEndLine);
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);

    if (ev.location) {
      lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    }

    if (ev.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    }

    if (ev.category) {
      lines.push(`CATEGORIES:${escapeIcsText(ev.category)}`);
    }

    if (ev.url) {
      lines.push(`URL;VALUE=URI:${ev.url}`);
    }

    lines.push('STATUS:CONFIRMED');
    lines.push('TRANSP:OPAQUE');
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * Triggers native calendar download / opening of .ics file
 */
export function downloadCalendarEvent(eventData: CalendarEventPayload | CalendarEventPayload[], filename?: string): void {
  try {
    const events = Array.isArray(eventData) ? eventData : [eventData];
    if (events.length === 0) return;

    const icsString = buildIcsContent(events);
    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });

    let finalName = filename;
    if (!finalName) {
      const first = events[0];
      const safeTitle = (first.title || 'Termin')
        .replace(/[^a-zA-Z0-9_\-\u00C0-\u017F]/g, '_')
        .slice(0, 30);
      const safeDate = (first.startDate || '').split('T')[0];
      finalName = `${safeTitle}_${safeDate}.ics`;
    }

    if (!finalName.endsWith('.ics')) {
      finalName += '.ics';
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', finalName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    triggerHaptic('success');
    toast.success('📅 In Kalender eingetragen / Datei bereit!', {
      duration: 3500,
      icon: '📅'
    });
  } catch (err) {
    console.error('Error generating calendar file:', err);
    toast.error('Fehler beim Erstellen des Kalendereintrags');
  }
}

// -------------------------------------------------------------
// Specialized Exporters for Rothirsch Business Entities
// -------------------------------------------------------------

function getOrderAppUrl(orderId: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/dashboard/orders`;
  }
  return 'https://rothirsch-app.web.app/dashboard/orders';
}

/**
 * Formats customer addresses into a clear string
 */
function formatOrderLocation(order: any): string {
  const aStreet = [order.logistics?.a_street, order.logistics?.a_houseNr].filter(Boolean).join(' ');
  const aCity = [order.logistics?.a_zip, order.logistics?.a_city].filter(Boolean).join(' ');
  const fromStr = [aStreet, aCity].filter(Boolean).join(', ');

  const bStreet = [order.logistics?.b_street, order.logistics?.b_houseNr].filter(Boolean).join(' ');
  const bCity = [order.logistics?.b_zip, order.logistics?.b_city].filter(Boolean).join(' ');
  const toStr = [bStreet, bCity].filter(Boolean).join(', ');

  if (fromStr && toStr) {
    return `A: ${fromStr} ➔ B: ${toStr}`;
  }
  return toStr || fromStr || 'Vor Ort';
}

/**
 * 1. Export Moving Date (Umzugstermin)
 */
export function exportOrderMoveToCalendar(order: any): void {
  const moveDate = order.orderMeta?.movingDateFrom || order.movingDate || order.disposition?.movingDate;
  if (!moveDate) {
    toast.error('Kein Umzugstermin für diesen Auftrag hinterlegt.');
    return;
  }

  const custName = order.customerName || 'Kunde';
  const orderNum = order.orderNumber || (order.id ? `#${order.id.slice(0, 6)}` : '');
  const moveTime = order.orderMeta?.movingTimeFrom || order.disposition?.movingTimeStr || '08:00';
  const phone = order.customerPhone || order.phone || '';
  const email = order.customerEmail || '';
  const volume = order.calculatedVolume || order.summary?.totalVolume || order.volume || '';
  const workers = order.disposition?.workers || '';
  const trucks = order.disposition?.trucks || '';

  const descriptionLines = [
    `🚚 UMZUGSAUFTRAG: ${custName}`,
    orderNum ? `Auftrag: ${orderNum}` : '',
    phone ? `📞 Telefon: ${phone}` : '',
    email ? `✉️ E-Mail: ${email}` : '',
    volume ? `📦 Volumen: ca. ${volume} m³` : '',
    workers || trucks ? `👥 Disposition: ${workers ? `${workers} Helfer` : ''}${trucks ? ` • ${trucks} LKW` : ''}` : '',
    order.notes ? `\n📝 Notizen:\n${order.notes}` : '',
    `\n🔗 In Rothirsch öffnen:\n${getOrderAppUrl(order.id)}`
  ].filter(Boolean).join('\n');

  const payload: CalendarEventPayload = {
    title: `🚚 Umzug: ${custName} (${orderNum || 'Auftrag'})`,
    startDate: moveDate,
    startTime: moveTime,
    durationHours: 6,
    location: formatOrderLocation(order),
    description: descriptionLines,
    category: 'Umzug',
    url: getOrderAppUrl(order.id),
    orderId: order.id
  };

  downloadCalendarEvent(payload, `Umzug_${custName}_${moveDate.split('T')[0]}`);
}

/**
 * 2. Export Viewing Date (Besichtigungstermin)
 */
export function exportOrderViewingToCalendar(order: any): void {
  const viewingDate = order.orderMeta?.viewingDate;
  if (!viewingDate) {
    toast.error('Kein Besichtigungstermin hinterlegt.');
    return;
  }

  const custName = order.customerName || 'Kunde';
  const orderNum = order.orderNumber || (order.id ? `#${order.id.slice(0, 6)}` : '');
  const viewingTime = order.orderMeta?.viewingTime || '10:00';
  const viewingType = order.orderMeta?.viewingType === 'online' ? 'Video / Online' : 'Vor-Ort';
  const phone = order.customerPhone || order.phone || '';
  const email = order.customerEmail || '';

  // Address A for viewing
  const aStreet = [order.logistics?.a_street, order.logistics?.a_houseNr].filter(Boolean).join(' ');
  const aCity = [order.logistics?.a_zip, order.logistics?.a_city].filter(Boolean).join(' ');
  const viewingLoc = viewingType === 'Video / Online' ? 'Online / Video-Call' : ([aStreet, aCity].filter(Boolean).join(', ') || 'Vor Ort beim Kunden');

  const descriptionLines = [
    `📋 BESICHTIGUNG: ${custName} (${viewingType})`,
    orderNum ? `Auftrag: ${orderNum}` : '',
    phone ? `📞 Telefon: ${phone}` : '',
    email ? `✉️ E-Mail: ${email}` : '',
    `Art: ${viewingType}`,
    order.notes ? `\n📝 Notizen:\n${order.notes}` : '',
    `\n🔗 In Rothirsch öffnen:\n${getOrderAppUrl(order.id)}`
  ].filter(Boolean).join('\n');

  const payload: CalendarEventPayload = {
    title: `📋 Besichtigung: ${custName} (${viewingType})`,
    startDate: viewingDate,
    startTime: viewingTime,
    durationHours: 1,
    location: viewingLoc,
    description: descriptionLines,
    category: 'Besichtigung',
    url: getOrderAppUrl(order.id),
    orderId: order.id
  };

  downloadCalendarEvent(payload, `Besichtigung_${custName}_${viewingDate.split('T')[0]}`);
}

/**
 * 3. Export Specific Task Schedule (HVZ, Kartons, Lift)
 */
export function exportTaskToCalendar(
  todoId: string, 
  order: any, 
  scheduledDate: string, 
  scheduledTime?: string, 
  locationOpt?: 'a' | 'b' | 'both',
  customExtras?: {
    dateA?: string;
    timeA?: string;
    durationA?: number | string;
    endTimeA?: string;
    dateB?: string;
    timeB?: string;
    durationB?: number | string;
    endTimeB?: string;
  }
): void {
  if (!scheduledDate && !customExtras?.dateA && !customExtras?.dateB) {
    toast.error('Bitte zuerst ein Datum wählen.');
    return;
  }

  const custName = order?.customerName || 'Kunde';
  const orderNum = order?.orderNumber || (order?.id ? `#${order.id.slice(0, 6)}` : '');
  const phone = order?.customerPhone || order?.phone || '';

  const aStreet = [order?.logistics?.a_street, order?.logistics?.a_houseNr].filter(Boolean).join(' ');
  const aCity = [order?.logistics?.a_zip, order?.logistics?.a_city].filter(Boolean).join(' ');
  const addrA = [aStreet, aCity].filter(Boolean).join(', ');

  const bStreet = [order?.logistics?.b_street, order?.logistics?.b_houseNr].filter(Boolean).join(' ');
  const bCity = [order?.logistics?.b_zip, order?.logistics?.b_city].filter(Boolean).join(' ');
  const addrB = [bStreet, bCity].filter(Boolean).join(', ');

  // If both locations are requested and it's a lift or HVZ, export two separate calendar events!
  if (locationOpt === 'both' && (todoId === 'moebellift_buchen' || todoId === 'moebellift' || todoId === 'halteverbot' || todoId === 'hvz')) {
    if (todoId === 'moebellift_buchen' || todoId === 'moebellift') {
      const dateA = customExtras?.dateA || order?.orderMeta?.moebelliftDateA || scheduledDate;
      const timeA = customExtras?.timeA || order?.orderMeta?.moebelliftTimeA || scheduledTime || '09:00';
      const durA = Number(customExtras?.durationA || order?.orderMeta?.moebelliftDurationA || order?.orderMeta?.moebelliftDuration) || 2;
      const endA = customExtras?.endTimeA || order?.orderMeta?.moebelliftEndTimeA;

      const dateB = customExtras?.dateB || order?.orderMeta?.moebelliftDateB || scheduledDate;
      const timeB = customExtras?.timeB || order?.orderMeta?.moebelliftTimeB || '13:00';
      const durB = Number(customExtras?.durationB || order?.orderMeta?.moebelliftDurationB || order?.orderMeta?.moebelliftDuration) || 2;
      const endB = customExtras?.endTimeB || order?.orderMeta?.moebelliftEndTimeB;

      const eventA: CalendarEventPayload = {
        title: `🏗️ Möbellift: ${custName} (Auszug A)`,
        startDate: dateA,
        startTime: timeA,
        durationHours: durA,
        endTime: endA,
        location: `Auszugsort (A): ${addrA || 'Adresse A'}`,
        description: `Möbellift-Einsatz am Auszugsort (A)\nKunde: ${custName}\nAuftrag: ${orderNum}\nTelefon: ${phone}\nOrt: ${addrA}\n${getOrderAppUrl(order?.id)}`,
        category: 'Möbellift',
        url: getOrderAppUrl(order?.id),
        orderId: order?.id
      };

      const eventB: CalendarEventPayload = {
        title: `🏗️ Möbellift: ${custName} (Einzug B)`,
        startDate: dateB,
        startTime: timeB,
        durationHours: durB,
        endTime: endB,
        location: `Einzugsort (B): ${addrB || 'Adresse B'}`,
        description: `Möbellift-Einsatz am Einzugsort (B)\nKunde: ${custName}\nAuftrag: ${orderNum}\nTelefon: ${phone}\nOrt: ${addrB}\n${getOrderAppUrl(order?.id)}`,
        category: 'Möbellift',
        url: getOrderAppUrl(order?.id),
        orderId: order?.id
      };

      downloadCalendarEvent([eventA, eventB], `Moebellift_${custName}_Beide_Orte_${(dateA || '').split('T')[0]}`);
      return;
    }

    if (todoId === 'halteverbot' || todoId === 'hvz') {
      const dateA = customExtras?.dateA || order?.orderMeta?.halteverbotDateA || scheduledDate;
      const timeA = customExtras?.timeA || order?.orderMeta?.halteverbotTimeA || scheduledTime || '08:00';

      const dateB = customExtras?.dateB || order?.orderMeta?.halteverbotDateB || scheduledDate;
      const timeB = customExtras?.timeB || order?.orderMeta?.halteverbotTimeB || scheduledTime || '08:00';

      const eventA: CalendarEventPayload = {
        title: `⛔ Halteverbot (Auszug A): ${custName}`,
        startDate: dateA,
        startTime: timeA,
        durationHours: 2,
        location: `Auszugsort (A): ${addrA || 'Adresse A'}`,
        description: `Halteverbotszone am Auszugsort (A)\nKunde: ${custName}\nAuftrag: ${orderNum}\nTelefon: ${phone}\nOrt: ${addrA}\n${getOrderAppUrl(order?.id)}`,
        category: 'Halteverbot',
        url: getOrderAppUrl(order?.id),
        orderId: order?.id
      };

      const eventB: CalendarEventPayload = {
        title: `⛔ Halteverbot (Einzug B): ${custName}`,
        startDate: dateB,
        startTime: timeB,
        durationHours: 2,
        location: `Einzugsort (B): ${addrB || 'Adresse B'}`,
        description: `Halteverbotszone am Einzugsort (B)\nKunde: ${custName}\nAuftrag: ${orderNum}\nTelefon: ${phone}\nOrt: ${addrB}\n${getOrderAppUrl(order?.id)}`,
        category: 'Halteverbot',
        url: getOrderAppUrl(order?.id),
        orderId: order?.id
      };

      downloadCalendarEvent([eventA, eventB], `Halteverbot_${custName}_Beide_Orte_${(dateA || '').split('T')[0]}`);
      return;
    }
  }

  let title = '';
  let category: CalendarEventPayload['category'] = 'Logistik';
  let defaultDuration = 2;
  let loc = '';

  if (locationOpt === 'b') {
    loc = `Zielort (B): ${addrB}`;
  } else if (locationOpt === 'both') {
    loc = `Auszug: ${addrA} | Einzug: ${addrB}`;
  } else {
    loc = `Auszugsort (A): ${addrA || addrB || 'Vor Ort'}`;
  }

  switch (todoId) {
    case 'halteverbot':
    case 'hvz':
      title = `⛔ Halteverbot einrichten: ${custName}`;
      category = 'Halteverbot';
      defaultDuration = 2;
      break;
    case 'kartons_liefern':
      title = `📦 Kartonlieferung: ${custName}`;
      category = 'Kartons';
      defaultDuration = 2;
      break;
    case 'moebellift_buchen':
    case 'moebellift':
      title = `🏗️ Möbellift-Einsatz: ${custName}`;
      category = 'Möbellift';
      defaultDuration = Number(customExtras?.durationA || customExtras?.durationB || order?.orderMeta?.moebelliftDuration) || 3;
      break;
    case 'viewing_requested':
    case 'viewing_date':
      title = `📋 Besichtigung: ${custName}`;
      category = 'Besichtigung';
      defaultDuration = 1;
      break;
    default:
      title = `🚚 Logistik: ${custName} (${todoId})`;
      category = 'Logistik';
  }

  const descriptionLines = [
    title,
    orderNum ? `Auftrag: ${orderNum}` : '',
    phone ? `📞 Telefon: ${phone}` : '',
    loc ? `📍 Einsatzort: ${loc}` : '',
    `\n🔗 In Rothirsch öffnen:\n${getOrderAppUrl(order?.id)}`
  ].filter(Boolean).join('\n');

  const payload: CalendarEventPayload = {
    title: `${title} (${orderNum || 'Auftrag'})`,
    startDate: scheduledDate,
    startTime: scheduledTime || '09:00',
    durationHours: defaultDuration,
    location: loc,
    description: descriptionLines,
    category,
    url: getOrderAppUrl(order?.id),
    orderId: order?.id
  };

  downloadCalendarEvent(payload, `${category}_${custName}_${scheduledDate.split('T')[0]}`);
}

/**
 * 4. Export all confirmed moves/tasks for a given day (e.g. from DispoModal)
 */
export function exportEntireDayToCalendar(dateStr: string, orders: any[]): void {
  const dayOrders = orders.filter(o => {
    const isConfirmed = !['draft', 'quote'].includes(o.status);
    const moveDate = o.orderMeta?.movingDateFrom || o.movingDate || o.disposition?.movingDate;
    return moveDate?.split('T')[0] === dateStr && isConfirmed;
  });

  if (dayOrders.length === 0) {
    toast.error('Keine bestätigten Umzüge an diesem Tag vorhanden.');
    return;
  }

  const events: CalendarEventPayload[] = dayOrders.map(o => {
    const custName = o.customerName || 'Kunde';
    const orderNum = o.orderNumber || (o.id ? `#${o.id.slice(0, 6)}` : '');
    const moveTime = o.orderMeta?.movingTimeFrom || o.disposition?.movingTimeStr || '08:00';
    const phone = o.customerPhone || o.phone || '';
    const volume = o.calculatedVolume || o.summary?.totalVolume || o.volume || '';

    return {
      title: `🚚 Umzug: ${custName} (${orderNum})`,
      startDate: dateStr,
      startTime: moveTime,
      durationHours: 6,
      location: formatOrderLocation(o),
      description: `Umzug ${custName}\nAuftrag: ${orderNum}\nTelefon: ${phone}\nVolumen: ca. ${volume} m³\n${getOrderAppUrl(o.id)}`,
      category: 'Umzug',
      url: getOrderAppUrl(o.id),
      orderId: o.id
    };
  });

  downloadCalendarEvent(events, `Rothirsch_Tagesplan_${dateStr}`);
}
