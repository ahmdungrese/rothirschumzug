import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { calculateOpenAmount } from './financeHelpers';
import { hasFixedService } from './serviceKeys';

/**
 * Task mappings across different historical and UI representations:
 * - ticketId in ticketEngine / Calendar / DispoModal: 'halteverbot', 'kartons_liefern', 'moebellift_buchen', 'viewing_requested'
 * - checklistId in KanbanOrderCard / CustomerPremiumProfile: 'hvz', 'kartons', 'moebellift', 'viewing_date', 'signature', 'data_verified'
 */

export interface TaskStateUpdateResult {
  success: boolean;
  newState: boolean;
  message?: string;
}

/**
 * Evaluates whether a given task is considered completed on an order,
 * taking into account all historical and current database representations.
 */
export function isTaskCompleted(order: any, taskId: string): boolean {
  if (!order) return false;

  const ticketStates = order.ticketStates || {};
  const checklistDone = order.checklistDone || {};
  const logistics = order.logistics || {};
  const meta = order.orderMeta || {};

  switch (taskId) {
    case 'hvz':
    case 'halteverbot':
      return Boolean(
        ticketStates.halteverbot ||
        checklistDone.hvz ||
        checklistDone.halteverbot ||
        logistics.hvzConfirmed ||
        logistics.hvzStatus === 'confirmed' ||
        order.logisticsState?.hvz_aufgestellt
      );

    case 'kartons':
    case 'kartons_liefern':
      return Boolean(
        ticketStates.kartons_liefern ||
        checklistDone.kartons ||
        checklistDone.kartons_liefern ||
        logistics.boxesDelivered ||
        order.logisticsState?.kartons_geliefert
      );

    case 'moebellift':
    case 'moebellift_buchen':
      return Boolean(
        ticketStates.moebellift_buchen ||
        checklistDone.moebellift ||
        checklistDone.moebellift_buchen ||
        logistics.liftReserved ||
        logistics.liftStatus === 'confirmed'
      );

    case 'viewing_date':
    case 'viewing_requested':
      const viewingVal = meta.viewingDate || order.viewingDate;
      return Boolean(
        ticketStates.viewing_requested ||
        checklistDone.viewing_requested ||
        checklistDone.viewing_date ||
        viewingVal === 'erledigt_fotos' ||
        order.status === 'confirmed' ||
        order.status === 'completed' ||
        order.status?.startsWith('invoice_') ||
        order.status === 'archived' ||
        order.checklistDone?.dataVerified
      );

    case 'data_verified':
      return Boolean(checklistDone.dataVerified || ticketStates.data_verified);

    case 'signature':
    case 'angebot_confirmed':
      return Boolean(
        order.status === 'confirmed' ||
        order.status === 'completed' ||
        (order.status && order.status.startsWith('invoice_')) ||
        order.signatureOrder ||
        order.signatureAGB ||
        order.signatures?.customer ||
        checklistDone.signature ||
        checklistDone.angebot_confirmed ||
        ticketStates.signature ||
        order.isManuallySigned ||
        order.contractSigned
      );

    case 'team':
    case 'team_assigned':
      if (checklistDone.team !== undefined) return Boolean(checklistDone.team);
      if (checklistDone.team_assigned !== undefined) return Boolean(checklistDone.team_assigned);
      return Boolean(
        ticketStates.team ||
        ticketStates.team_assigned ||
        order.teamAssigned ||
        (Array.isArray(order.assignedEmployees) && order.assignedEmployees.length > 0) ||
        (Array.isArray(order.team) && order.team.length > 0) ||
        (order.disposition && (Number(order.disposition.helpers) > 0 || Number(order.disposition.koffer35t) > 0 || Number(order.disposition.lkw7t) > 0))
      );

    case 'protocol':
      if (checklistDone.protocol !== undefined) return Boolean(checklistDone.protocol);
      return Boolean(
        ticketStates.protocol ||
        order.signatureProtocol ||
        (Array.isArray(order.protocols) && order.protocols.length > 0) ||
        order.status === 'completed' ||
        order.status === 'invoice_paid' ||
        order.status === 'archived'
      );

    case 'invoice':
      if (checklistDone.invoice !== undefined) return Boolean(checklistDone.invoice);
      return Boolean(
        ticketStates.invoice ||
        Boolean(order.invoiceNumber) ||
        (Array.isArray(order.invoices) && order.invoices.length > 0) ||
        order.status?.startsWith('invoice_')
      );

    case 'payment':
      if (checklistDone.payment !== undefined) return Boolean(checklistDone.payment);
      return Boolean(
        ticketStates.payment ||
        order.status === 'invoice_paid' ||
        calculateOpenAmount(order) <= 0.01 ||
        (order.totals?.gross > 0 && ((order.totals?.gross || 0) - (order.totalPaid || 0) <= 0))
      );

    default:
      // For generic or manual checklist items
      if (taskId.startsWith('manual_')) {
        const realId = taskId.replace('manual_', '');
        if (order.checklist && Array.isArray(order.checklist)) {
          const item = order.checklist.find((c: any, i: number) => c.id === realId || String(i) === realId);
          return !!item?.done;
        }
      }
      return Boolean(ticketStates[taskId] || checklistDone[taskId]);
  }
}

/**
 * Unified central function to toggle or set task completion state.
 * Atomically updates all redundant flags so Dashboard, Customer Profile,
 * Logistics, and Calendar stay 100% in sync in real time.
 */
export async function toggleTaskCompletion(
  order: any,
  taskId: string,
  targetState?: boolean
): Promise<TaskStateUpdateResult> {
  if (!order || !order.id) {
    throw new Error('Order or Order ID is missing');
  }

  const currentDone = isTaskCompleted(order, taskId);
  const nextDone = targetState !== undefined ? targetState : !currentDone;
  const updates: Record<string, any> = {
    updatedAt: serverTimestamp()
  };

  const orderRef = doc(db, 'orders', order.id);

  // Normalize taskId and build multi-field atomic update
  switch (taskId) {
    case 'hvz':
    case 'halteverbot':
      updates['ticketStates.halteverbot'] = nextDone;
      updates['checklistDone.hvz'] = nextDone;
      updates['checklistDone.halteverbot'] = nextDone;
      updates['logistics.hvzConfirmed'] = nextDone;
      updates['logistics.hvzStatus'] = nextDone ? 'confirmed' : 'pending';
      updates['logisticsState.hvz_aufgestellt'] = nextDone;
      break;

    case 'kartons':
    case 'kartons_liefern':
      updates['ticketStates.kartons_liefern'] = nextDone;
      updates['checklistDone.kartons'] = nextDone;
      updates['checklistDone.kartons_liefern'] = nextDone;
      updates['logistics.boxesDelivered'] = nextDone;
      updates['logisticsState.kartons_geliefert'] = nextDone;
      break;

    case 'moebellift':
    case 'moebellift_buchen':
      updates['ticketStates.moebellift_buchen'] = nextDone;
      updates['checklistDone.moebellift'] = nextDone;
      updates['checklistDone.moebellift_buchen'] = nextDone;
      updates['logistics.liftReserved'] = nextDone;
      updates['logistics.liftStatus'] = nextDone ? 'confirmed' : 'pending';
      break;

    case 'viewing_date':
    case 'viewing_requested':
      updates['ticketStates.viewing_requested'] = nextDone;
      updates['checklistDone.viewing_requested'] = nextDone;
      break;

    case 'data_verified':
      updates['checklistDone.dataVerified'] = nextDone;
      updates['ticketStates.data_verified'] = nextDone;
      break;

    case 'signature':
    case 'angebot_confirmed':
      updates['status'] = nextDone ? 'confirmed' : 'quote';
      updates['isManuallySigned'] = nextDone;
      updates['contractSigned'] = nextDone;
      updates['checklistDone.signature'] = nextDone;
      updates['ticketStates.signature'] = nextDone;
      break;

    case 'team':
    case 'team_assigned':
      updates['checklistDone.team'] = nextDone;
      updates['teamAssigned'] = nextDone;
      break;

    case 'protocol':
      updates['checklistDone.protocol'] = nextDone;
      updates['ticketStates.protocol'] = nextDone;
      break;

    case 'invoice':
      updates['checklistDone.invoice'] = nextDone;
      updates['ticketStates.invoice'] = nextDone;
      break;

    case 'payment':
      updates['checklistDone.payment'] = nextDone;
      updates['ticketStates.payment'] = nextDone;
      break;

    default:
      if (taskId.startsWith('manual_')) {
        const realId = taskId.replace('manual_', '');
        if (order.checklist && Array.isArray(order.checklist)) {
          const updatedChecklist = order.checklist.map((item: any, i: number) =>
            (item.id === realId || String(i) === realId) ? { ...item, done: nextDone } : item
          );
          updates['checklist'] = updatedChecklist;
        }
      } else {
        updates[`ticketStates.${taskId}`] = nextDone;
        updates[`checklistDone.${taskId}`] = nextDone;
      }
      break;
  }

  await updateDoc(orderRef, updates);

  if ((taskId === 'signature' || taskId === 'angebot_confirmed') && nextDone && !order.orderNumber) {
    try {
      const { ensureOrderNumber } = await import('@/lib/orderStateMachine');
      await ensureOrderNumber(order.id);
    } catch (err) {
      console.error("Fehler beim Erzeugen der Angebotsnummer in toggleTaskCompletion:", err);
    }
  }

  return {
    success: true,
    newState: nextDone
  };
}

export interface TaskScheduleExtras {
  duration?: string;
  durationHours?: number;
  endTime?: string;
  location?: 'a' | 'b' | 'both';
  method?: 'selbst' | 'extern';
  notes?: string;
  viewingType?: string;
  dateA?: string;
  timeA?: string;
  durationA?: string;
  endTimeA?: string;
  dateB?: string;
  timeB?: string;
  durationB?: string;
  endTimeB?: string;
}

/**
 * Unified schedule updater for logistics dates and times.
 * Synchronizes orderMeta and logistics objects atomically.
 */
export async function updateTaskSchedule(
  orderId: string,
  taskId: string,
  dateStr: string,
  timeStr: string = '',
  extras?: TaskScheduleExtras
): Promise<void> {
  const orderRef = doc(db, 'orders', orderId);
  const updates: Record<string, any> = {
    updatedAt: serverTimestamp()
  };

  switch (taskId) {
    case 'kartons':
    case 'kartons_liefern':
      updates['orderMeta.kartonDeliveryDate'] = dateStr;
      updates['orderMeta.kartonDeliveryTime'] = timeStr;
      updates['logistics.boxDeliveryDate'] = dateStr;
      updates['logistics.boxDeliveryTime'] = timeStr;
      if (extras?.notes) updates['orderMeta.kartonNotes'] = extras.notes;
      break;

    case 'hvz':
    case 'halteverbot':
      updates['orderMeta.halteverbotDate'] = dateStr;
      updates['orderMeta.halteverbotTime'] = timeStr;
      updates['logistics.hvzDate'] = dateStr;
      updates['logistics.hvzTime'] = timeStr;
      updates['logistics.hvzStatus'] = 'planned';
      if (extras?.location) {
        updates['orderMeta.hvzLocation'] = extras.location;
        updates['logistics.hvzLocation'] = extras.location;
        if (extras.location === 'a') {
          updates['logistics.a_parking'] = true;
          if (extras.dateA) {
            updates['orderMeta.halteverbotDateA'] = extras.dateA;
            updates['logistics.hvzDateA'] = extras.dateA;
          }
          if (extras.timeA) {
            updates['orderMeta.halteverbotTimeA'] = extras.timeA;
            updates['logistics.hvzTimeA'] = extras.timeA;
          }
        } else if (extras.location === 'b') {
          updates['logistics.b_parking'] = true;
          if (extras.dateB) {
            updates['orderMeta.halteverbotDateB'] = extras.dateB;
            updates['logistics.hvzDateB'] = extras.dateB;
          }
          if (extras.timeB) {
            updates['orderMeta.halteverbotTimeB'] = extras.timeB;
            updates['logistics.hvzTimeB'] = extras.timeB;
          }
        } else if (extras.location === 'both') {
          updates['logistics.a_parking'] = true;
          updates['logistics.b_parking'] = true;
          if (extras.dateA) {
            updates['orderMeta.halteverbotDateA'] = extras.dateA;
            updates['logistics.hvzDateA'] = extras.dateA;
          }
          if (extras.timeA) {
            updates['orderMeta.halteverbotTimeA'] = extras.timeA;
            updates['logistics.hvzTimeA'] = extras.timeA;
          }
          if (extras.dateB) {
            updates['orderMeta.halteverbotDateB'] = extras.dateB;
            updates['logistics.hvzDateB'] = extras.dateB;
          }
          if (extras.timeB) {
            updates['orderMeta.halteverbotTimeB'] = extras.timeB;
            updates['logistics.hvzTimeB'] = extras.timeB;
          }
        }
      }
      if (extras?.method) {
        updates['orderMeta.hvzMethod'] = extras.method;
        updates['logistics.hvzMethod'] = extras.method;
      }
      if (extras?.notes) updates['orderMeta.hvzNotes'] = extras.notes;
      break;

    case 'moebellift':
    case 'moebellift_buchen':
      updates['orderMeta.moebelliftDate'] = dateStr;
      updates['orderMeta.moebelliftTime'] = timeStr;
      updates['logistics.moebelliftDate'] = dateStr;
      updates['logistics.moebelliftTime'] = timeStr;
      updates['logistics.liftStatus'] = 'planned';
      if (extras?.duration) updates['orderMeta.moebelliftDuration'] = extras.duration;
      if (extras?.endTime) updates['orderMeta.moebelliftEndTime'] = extras.endTime;
      if (extras?.location) {
        updates['orderMeta.moebelliftLocation'] = extras.location;
        updates['logistics.moebelliftLocation'] = extras.location;
        if (extras.location === 'a') {
          updates['logistics.a_furnitureLift'] = true;
          if (extras.dateA) {
            updates['orderMeta.moebelliftDateA'] = extras.dateA;
            updates['logistics.moebelliftDateA'] = extras.dateA;
          }
          if (extras.timeA) {
            updates['orderMeta.moebelliftTimeA'] = extras.timeA;
            updates['logistics.moebelliftTimeA'] = extras.timeA;
          }
          if (extras.durationA) {
            updates['orderMeta.moebelliftDurationA'] = extras.durationA;
            updates['logistics.moebelliftDurationA'] = extras.durationA;
          }
          if (extras.endTimeA) {
            updates['orderMeta.moebelliftEndTimeA'] = extras.endTimeA;
            updates['logistics.moebelliftEndTimeA'] = extras.endTimeA;
          }
        } else if (extras.location === 'b') {
          updates['logistics.b_furnitureLift'] = true;
          if (extras.dateB) {
            updates['orderMeta.moebelliftDateB'] = extras.dateB;
            updates['logistics.moebelliftDateB'] = extras.dateB;
          }
          if (extras.timeB) {
            updates['orderMeta.moebelliftTimeB'] = extras.timeB;
            updates['logistics.moebelliftTimeB'] = extras.timeB;
          }
          if (extras.durationB) {
            updates['orderMeta.moebelliftDurationB'] = extras.durationB;
            updates['logistics.moebelliftDurationB'] = extras.durationB;
          }
          if (extras.endTimeB) {
            updates['orderMeta.moebelliftEndTimeB'] = extras.endTimeB;
            updates['logistics.moebelliftEndTimeB'] = extras.endTimeB;
          }
        } else if (extras.location === 'both') {
          updates['logistics.a_furnitureLift'] = true;
          updates['logistics.b_furnitureLift'] = true;
          if (extras.dateA) {
            updates['orderMeta.moebelliftDateA'] = extras.dateA;
            updates['logistics.moebelliftDateA'] = extras.dateA;
          }
          if (extras.timeA) {
            updates['orderMeta.moebelliftTimeA'] = extras.timeA;
            updates['logistics.moebelliftTimeA'] = extras.timeA;
          }
          if (extras.durationA) {
            updates['orderMeta.moebelliftDurationA'] = extras.durationA;
            updates['logistics.moebelliftDurationA'] = extras.durationA;
          }
          if (extras.endTimeA) {
            updates['orderMeta.moebelliftEndTimeA'] = extras.endTimeA;
            updates['logistics.moebelliftEndTimeA'] = extras.endTimeA;
          }
          if (extras.dateB) {
            updates['orderMeta.moebelliftDateB'] = extras.dateB;
            updates['logistics.moebelliftDateB'] = extras.dateB;
          }
          if (extras.timeB) {
            updates['orderMeta.moebelliftTimeB'] = extras.timeB;
            updates['logistics.moebelliftTimeB'] = extras.timeB;
          }
          if (extras.durationB) {
            updates['orderMeta.moebelliftDurationB'] = extras.durationB;
            updates['logistics.moebelliftDurationB'] = extras.durationB;
          }
          if (extras.endTimeB) {
            updates['orderMeta.moebelliftEndTimeB'] = extras.endTimeB;
            updates['logistics.moebelliftEndTimeB'] = extras.endTimeB;
          }
        }
      }
      if (extras?.notes) updates['orderMeta.moebelliftNotes'] = extras.notes;
      break;

    case 'viewing_date':
    case 'viewing_requested': {
      // Extract valid HH:mm if timeStr is a window like "08:00 - 12:00" so datetime-local inputs never break
      const timeMatch = (timeStr || '').match(/(\d{2}:\d{2})/);
      const cleanIsoTime = timeMatch ? timeMatch[1] : '';
      const combined = cleanIsoTime ? `${dateStr}T${cleanIsoTime}` : dateStr;
      updates['orderMeta.viewingDate'] = combined;
      updates['orderMeta.viewingDateOnly'] = dateStr;
      updates['viewingDate'] = combined;
      updates['orderMeta.viewingTime'] = timeStr;
      updates['logistics.viewingDate'] = combined;
      updates['logistics.viewingTime'] = timeStr;
      if (extras?.viewingType) {
        updates['orderMeta.viewingType'] = extras.viewingType;
        updates['logistics.viewingType'] = extras.viewingType;
        updates['viewingType'] = extras.viewingType;
      }
      if (extras?.notes) updates['orderMeta.viewingNotes'] = extras.notes;
      break;
    }

    default:
      updates[`orderMeta.${taskId}Date`] = dateStr;
      updates[`orderMeta.${taskId}Time`] = timeStr;
      break;
  }

  await updateDoc(orderRef, updates);
}

/**
 * Safely marks pre-move operational preparation tasks as completed when a move
 * is completed or invoiced, WITHOUT deleting or overwriting any dates, times,
 * notes, disposition, or historical records.
 */
export async function autoCompletePreMoveTasks(orderId: string): Promise<void> {
  if (!orderId) return;
  const orderRef = doc(db, 'orders', orderId);

  try {
    const snap = await getDoc(orderRef);
    if (!snap.exists()) return;
    const order = snap.data();

    const updates: Record<string, any> = {
      updatedAt: serverTimestamp(),
      // 1. Viewing task (Besichtigungstermin erledigt)
      'ticketStates.viewing_requested': true,
      'checklistDone.viewing_requested': true,
      'checklistDone.viewing_date': true,
    };

    // 2. Halteverbot: nur wenn tatsächlich gebucht/geplant
    const hasHvz = Boolean(
      order.logistics?.a_parking || 
      order.logistics?.b_parking || 
      order.logistics?.needHVZ || 
      hasFixedService(order.services, 'hvz') || 
      order.services?.halteverbot || 
      order.orderMeta?.halteverbotDate || 
      order.logistics?.hvzDate
    );
    if (hasHvz) {
      updates['ticketStates.halteverbot'] = true;
      updates['checklistDone.hvz'] = true;
      updates['checklistDone.halteverbot'] = true;
      updates['logistics.hvzConfirmed'] = true;
      updates['logistics.hvzStatus'] = 'confirmed';
      updates['logisticsState.hvz_aufgestellt'] = true;
    }

    // 3. Karton-Lieferung: nur wenn tatsächlich gebucht/geplant
    const hasKartons = Boolean(
      hasFixedService(order.services, 'kartons') || 
      order.orderMeta?.kartonDeliveryDate || 
      order.logistics?.boxDeliveryDate ||
      (Array.isArray(order.logistics?.materials) && order.logistics.materials.some((m: any) => (Number(m.quantity) || Number(m.count) || 0) > 0)) ||
      Number(order.orderMeta?.boxesCount || order.logistics?.boxesCount || 0) > 0
    );
    if (hasKartons) {
      updates['ticketStates.kartons_liefern'] = true;
      updates['checklistDone.kartons'] = true;
      updates['checklistDone.kartons_liefern'] = true;
      updates['logistics.boxesDelivered'] = true;
      updates['logisticsState.kartons_geliefert'] = true;
    }

    // 4. Möbellift: nur wenn tatsächlich gebucht/geplant
    const hasLift = Boolean(
      order.logistics?.a_furnitureLift || 
      order.logistics?.b_furnitureLift || 
      order.logistics?.needLift || 
      hasFixedService(order.services, 'moebellift') || 
      order.services?.moebellift || 
      order.orderMeta?.moebelliftDate || 
      order.logistics?.moebelliftDate
    );
    if (hasLift) {
      updates['ticketStates.moebellift_buchen'] = true;
      updates['checklistDone.moebellift'] = true;
      updates['checklistDone.moebellift_buchen'] = true;
      updates['logistics.liftReserved'] = true;
      updates['logistics.liftStatus'] = 'confirmed';
    }

    // 5. Team disposition
    updates['checklistDone.team'] = true;
    updates['teamAssigned'] = true;

    await updateDoc(orderRef, updates);
  } catch (err) {
    console.error('Error auto-completing pre-move tasks for order', orderId, err);
  }
}
