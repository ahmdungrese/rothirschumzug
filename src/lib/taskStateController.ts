import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
        viewingVal === 'erledigt_fotos' ||
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
        order.signatures?.customer ||
        order.isManuallySigned ||
        order.contractSigned
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
      if (extras?.notes) updates['orderMeta.kartonNotes'] = extras.notes;
      break;

    case 'hvz':
    case 'halteverbot':
      updates['orderMeta.halteverbotDate'] = dateStr;
      updates['orderMeta.halteverbotTime'] = timeStr;
      updates['logistics.hvzDate'] = dateStr;
      if (extras?.location) {
        updates['orderMeta.hvzLocation'] = extras.location;
        updates['logistics.hvzLocation'] = extras.location;
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
      if (extras?.duration) updates['orderMeta.moebelliftDuration'] = extras.duration;
      if (extras?.endTime) updates['orderMeta.moebelliftEndTime'] = extras.endTime;
      if (extras?.location) {
        updates['orderMeta.moebelliftLocation'] = extras.location;
        updates['logistics.moebelliftLocation'] = extras.location;
      }
      if (extras?.notes) updates['orderMeta.moebelliftNotes'] = extras.notes;
      break;

    case 'viewing_date':
    case 'viewing_requested':
      const combined = timeStr ? `${dateStr}T${timeStr}` : dateStr;
      updates['orderMeta.viewingDate'] = combined;
      updates['viewingDate'] = combined;
      updates['orderMeta.viewingTime'] = timeStr;
      if (extras?.notes) updates['orderMeta.viewingNotes'] = extras.notes;
      break;

    default:
      updates[`orderMeta.${taskId}Date`] = dateStr;
      updates[`orderMeta.${taskId}Time`] = timeStr;
      break;
  }

  await updateDoc(orderRef, updates);
}
