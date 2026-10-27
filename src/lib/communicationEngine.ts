import { MASTER_COMMUNICATION_TEMPLATES, CommunicationTemplate } from './communicationDefaults';

export interface FormatOptions {
  customer?: any;
  order?: any;
  userProfile?: any;
  taskType?: 'lift' | 'hvz' | 'karton' | 'viewing' | 'unterwegs' | string;
  scheduleDetails?: {
    location?: 'a' | 'b' | 'both';
    date?: string;
    time?: string;
    dateA?: string;
    timeA?: string;
    durationA?: string;
    endTimeA?: string;
    dateB?: string;
    timeB?: string;
    durationB?: string;
    endTimeB?: string;
    addressA?: string;
    addressB?: string;
    viewingType?: string;
  };
}

/**
 * Format dynamic appointment details (Termin_Details) based on task type and parameters
 */
export function buildScheduleDetailsText(options: FormatOptions): string {
  const { taskType, scheduleDetails, order } = options;
  if (!scheduleDetails) return '';

  const loc = scheduleDetails.location || 'a';
  const fDate = (d?: string) => {
    if (!d) return 'Termin folgt';
    try {
      return new Date(d).toLocaleDateString('de-DE');
    } catch {
      return d;
    }
  };

  const addrA = scheduleDetails.addressA || order?.logistics?.a_street || 'Auszugsadresse';
  const addrB = scheduleDetails.addressB || order?.logistics?.b_street || 'Einzugsadresse';

  if (taskType === 'lift') {
    if (loc === 'both') {
      const durA = scheduleDetails.durationA || '2';
      const durB = scheduleDetails.durationB || '2';
      return (
        `🏢 Auszugsort (A): am ${fDate(scheduleDetails.dateA)} um ca. ${scheduleDetails.timeA || '09:00'} Uhr (${durA} Std. bis ca. ${scheduleDetails.endTimeA || ''} Uhr)\n` +
        `🏠 Einzugsort (B): am ${fDate(scheduleDetails.dateB)} um ca. ${scheduleDetails.timeB || '13:00'} Uhr (${durB} Std. bis ca. ${scheduleDetails.endTimeB || ''} Uhr)`
      );
    } else if (loc === 'b') {
      const durB = scheduleDetails.durationB || '2';
      return `🏠 Einzugsort (B): am ${fDate(scheduleDetails.dateB)} um ca. ${scheduleDetails.timeB || '13:00'} Uhr (${durB} Std. bis ca. ${scheduleDetails.endTimeB || ''} Uhr) [${addrB}]`;
    } else {
      const durA = scheduleDetails.durationA || '2';
      return `🏢 Auszugsort (A): am ${fDate(scheduleDetails.dateA)} um ca. ${scheduleDetails.timeA || '09:00'} Uhr (${durA} Std. bis ca. ${scheduleDetails.endTimeA || ''} Uhr) [${addrA}]`;
    }
  }

  if (taskType === 'hvz') {
    if (loc === 'both') {
      return (
        `🏢 Auszugsort (A): Aufbau am ${fDate(scheduleDetails.dateA)}${scheduleDetails.timeA ? ` um ca. ${scheduleDetails.timeA} Uhr` : ''}\n` +
        `🏠 Einzugsort (B): Aufbau am ${fDate(scheduleDetails.dateB)}${scheduleDetails.timeB ? ` um ca. ${scheduleDetails.timeB} Uhr` : ''}`
      );
    } else if (loc === 'b') {
      return `🏠 Einzugsort (B): Aufbau am ${fDate(scheduleDetails.dateB)}${scheduleDetails.timeB ? ` um ca. ${scheduleDetails.timeB} Uhr` : ''} [${addrB}]`;
    } else {
      return `🏢 Auszugsort (A): Aufbau am ${fDate(scheduleDetails.dateA)}${scheduleDetails.timeA ? ` um ca. ${scheduleDetails.timeA} Uhr` : ''} [${addrA}]`;
    }
  }

  if (taskType === 'karton') {
    const timeStr = scheduleDetails.time ? ` im Zeitfenster ca. ${scheduleDetails.time} Uhr` : '';
    return `📦 Liefertermin: am ${fDate(scheduleDetails.date)}${timeStr}`;
  }

  if (taskType === 'viewing') {
    const timeStr = scheduleDetails.time ? ` um ca. ${scheduleDetails.time} Uhr` : '';
    const typeStr = scheduleDetails.viewingType === 'online' ? ' (Video-Besichtigung)' : ' (Vor-Ort-Besichtigung)';
    return `🗓️ Termin${typeStr}: am ${fDate(scheduleDetails.date)}${timeStr}`;
  }

  if (taskType === 'unterwegs') {
    return scheduleDetails.time ? ` um ${scheduleDetails.time} Uhr` : '';
  }

  // Generic fallback
  const d = scheduleDetails.date || scheduleDetails.dateA || '';
  const t = scheduleDetails.time || scheduleDetails.timeA || '';
  return `🗓️ Termin: am ${fDate(d)}${t ? ` um ca. ${t} Uhr` : ''}`;
}

/**
 * Robust format function that replaces all placeholders and guards essential context
 */
export function formatCommunicationMessage(templateBody: string, options: FormatOptions): string {
  let text = templateBody || '';
  const { customer, order, userProfile, scheduleDetails, taskType } = options;

  // 1. Customer Name & Salutation
  const custObj = customer || order?.customer || order?.billingAddress || {};
  const lastName = (custObj?.lastName || '').trim();
  const firstName = (custObj?.firstName || '').trim();
  const cName = custObj?.type === 'firma'
    ? lastName || 'Firma'
    : `${firstName} ${lastName}`.trim() || lastName || 'Kunde';

  const salutationRaw = (custObj?.salutation || order?.orderMeta?.salutation || '').toLowerCase();
  let formalAnrede = 'Sehr geehrte Damen und Herren';
  if (custObj?.type !== 'firma' && lastName) {
    if (salutationRaw.includes('herr')) {
      formalAnrede = `Sehr geehrter Herr ${lastName}`;
    } else if (salutationRaw.includes('frau')) {
      formalAnrede = `Sehr geehrte Frau ${lastName}`;
    } else {
      formalAnrede = `Guten Tag ${cName}`;
    }
  }

  // 2. Moving Date
  const rawMoveDate = order?.orderMeta?.movingDateFrom || order?.movingDate || order?.logistics?.movingDate;
  let moveDate = 'vereinbartem Datum';
  if (rawMoveDate) {
    try {
      moveDate = new Date(rawMoveDate).toLocaleDateString('de-DE');
    } catch {
      moveDate = String(rawMoveDate);
    }
  }

  // 3. Totals
  const totalGross = order?.totals?.gross
    ? `${Number(order.totals.gross).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : order?.price
    ? `${Number(order.price).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
    : 'wie vereinbart';

  // 4. Order & Invoice Numbers
  const orderNum = order?.orderNumber || order?.id || '';
  const invNum = order?.invoiceNumber || 'liegt bei';

  // 5. Employee / Sachbearbeiter
  let employee = 'Rothirsch Umzüge';
  if (userProfile?.displayName && !userProfile.displayName.includes('@')) {
    employee = userProfile.displayName.trim();
  } else if (userProfile?.name && !userProfile.name.includes('@')) {
    employee = userProfile.name.trim();
  } else if (order?.disposition?.assignedTeamLeadName) {
    employee = order.disposition.assignedTeamLeadName;
  }

  // 6. Dynamic Schedule Details
  const scheduleDetailsText = buildScheduleDetailsText(options);

  // Address A and B
  const addressA = [order?.logistics?.a_street, order?.logistics?.a_city].filter(Boolean).join(', ') || 'Auszugsadresse';
  const addressB = [order?.logistics?.b_street, order?.logistics?.b_city].filter(Boolean).join(', ') || 'Einzugsadresse';

  // --- REPLACEMENTS (Case-insensitive & flexible regexes) ---

  // Salutation & Names
  text = text.replace(/\{\{Kunde_Anrede\}\}/gi, formalAnrede);
  text = text.replace(/\[Anrede\]/gi, formalAnrede);
  text = text.replace(/\{\{Anrede\}\}/gi, formalAnrede);

  text = text.replace(/\{\{Kunde_Name\}\}/gi, cName);
  text = text.replace(/\[Name\]/gi, cName);
  text = text.replace(/\{\{Name\}\}/gi, cName);

  text = text.replace(/\{\{Kunde_Nachname\}\}/gi, lastName || cName);
  text = text.replace(/\[Nachname\]/gi, lastName || cName);
  text = text.replace(/\{\{Nachname\}\}/gi, lastName || cName);

  // Moving Date
  text = text.replace(/\{\{Umzugsdatum\}\}/gi, moveDate);
  text = text.replace(/\[Datum\]/gi, moveDate);
  text = text.replace(/\{\{Datum\}\}/gi, moveDate);

  // Schedule Details (Dates/Times for Lift, HVZ, Boxes, Viewing)
  const hasScheduleTag = /\{\{Termin_Details\}\}|\[Termin\]|\{\{Termin\}\}|\{\{Details\}\}/i.test(text);
  if (hasScheduleTag) {
    text = text.replace(/\{\{Termin_Details\}\}/gi, scheduleDetailsText);
    text = text.replace(/\[Termin\]/gi, scheduleDetailsText);
    text = text.replace(/\{\{Termin\}\}/gi, scheduleDetailsText);
    text = text.replace(/\{\{Details\}\}/gi, scheduleDetailsText);
  }

  // Totals & Numbers
  text = text.replace(/\{\{Angebot_Summe\}\}/gi, totalGross);
  text = text.replace(/\[Summe\]/gi, totalGross);
  text = text.replace(/\{\{Summe\}\}/gi, totalGross);

  text = text.replace(/\{\{Auftragsnummer\}\}/gi, orderNum);
  text = text.replace(/\[Auftrag\]/gi, orderNum);
  text = text.replace(/\{\{Auftrag\}\}/gi, orderNum);

  text = text.replace(/\{\{Rechnungsnummer\}\}/gi, invNum);
  text = text.replace(/\[Rechnung\]/gi, invNum);
  text = text.replace(/\{\{Rechnung\}\}/gi, invNum);

  // Employee
  text = text.replace(/\{\{Sachbearbeiter\}\}/gi, employee);
  text = text.replace(/\[Mitarbeiter\]/gi, employee);
  text = text.replace(/\{\{Mitarbeiter\}\}/gi, employee);

  // Addresses
  text = text.replace(/\{\{Auszug_Adresse\}\}/gi, addressA);
  text = text.replace(/\{\{Einzug_Adresse\}\}/gi, addressB);

  // --- CONTEXT GUARD & INTELLIGENT PROTECTION ---
  // If this is an operational task (e.g. lift, hvz, karton, viewing) and the user rewrote the template
  // in Settings without {{Termin_Details}}, protect the context by injecting the schedule safely:
  if (scheduleDetailsText && !hasScheduleTag && taskType && taskType !== 'unterwegs') {
    // Check if the text already contains a date; if not, inject the schedule before the greeting closing or at the end
    if (!text.includes(scheduleDetailsText)) {
      if (text.includes('Mit freundlichen Grüßen') || text.includes('Viele Grüße')) {
        text = text.replace(
          /(Mit freundlichen Grüßen|Viele Grüße)/i,
          `Hier sind die vereinbarten Einsatzzeiten:\n\n${scheduleDetailsText}\n\n$1`
        );
      } else {
        text = `${text.trim()}\n\n${scheduleDetailsText}`;
      }
    }
  }

  // Ensure greeting if completely missing
  const hasGreeting = /^(Sehr geehrte|Guten Tag|Hallo|Liebe|Moin|Hi )/i.test(text.trim());
  if (!hasGreeting && text.trim().length > 0 && !taskType?.includes('unterwegs')) {
    text = `${formalAnrede},\n\n${text.trim()}`;
  }

  return text;
}

/**
 * Retrieve a template from Firestore settings or fallback to Master defaults
 */
export function getCommunicationTemplate(
  settings: any,
  templateId: string,
  fallbackMasterId?: string
): CommunicationTemplate | undefined {
  const customTemplates: CommunicationTemplate[] = settings?.communicationTemplates || [];
  
  // 1. Look in user's saved templates
  const userTpl = customTemplates.find(t => t.id === templateId);
  if (userTpl && userTpl.body?.trim()) return userTpl;

  // 2. Look by fallback ID in user's templates
  if (fallbackMasterId) {
    const userFallback = customTemplates.find(t => t.id === fallbackMasterId);
    if (userFallback && userFallback.body?.trim()) return userFallback;
  }

  // 3. Fallback to Master templates
  const masterTpl = MASTER_COMMUNICATION_TEMPLATES.find(t => t.id === templateId);
  if (masterTpl) return masterTpl;

  if (fallbackMasterId) {
    return MASTER_COMMUNICATION_TEMPLATES.find(t => t.id === fallbackMasterId);
  }

  return undefined;
}
