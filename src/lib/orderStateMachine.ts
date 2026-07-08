import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, serverTimestamp, increment, deleteField } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';
import { generateTickets } from '@/lib/ticketEngine';

export type AllowedStatus = 
  | 'draft' 
  | 'quote' 
  | 'confirmed' 
  | 'completed' 
  | 'invoice_open' 
  | 'invoice_paid' 
  | 'invoice_overdue' 
  | 'invoice_cancelled' 
  | 'archived' 
  | 'canceled' 
  | 'rejected';

interface TransitionContext {
  userId?: string;
  userName?: string;
  customerType?: 'privat' | 'firma';
  expectedVersion?: number; // For explicit optimistic locking from UI if needed
  reason?: string; // For rollbacks/stornos
  additionalData?: any; // For updating ticketStates or other fields atomically
}

// Transition table defining allowed forward and backward moves
export const ALLOWED_TRANSITIONS: Record<AllowedStatus, AllowedStatus[]> = {
  'draft': ['quote', 'confirmed', 'archived', 'rejected'],
  'quote': ['draft', 'confirmed', 'archived', 'rejected'],
  'confirmed': ['completed', 'canceled', 'archived'], // Backward to quote is BLOCKED
  'completed': ['confirmed', 'invoice_open', 'archived'],
  'invoice_open': ['invoice_paid', 'invoice_overdue', 'invoice_cancelled', 'archived', 'completed'], // Backward to completed allowed for Storno
  'invoice_paid': ['archived', 'completed'], // Storno allowed
  'invoice_overdue': ['invoice_paid', 'invoice_cancelled', 'completed'], // Storno allowed
  'invoice_cancelled': ['archived', 'completed'],
  'archived': [],
  'canceled': ['archived'],
  'rejected': ['archived'],
};

export async function changeOrderStatus(
  orderId: string,
  targetStatus: AllowedStatus,
  context?: TransitionContext
) {
  const orderRef = doc(db, getCol('orders'), orderId);

  return await runTransaction(db, async (transaction) => {
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists()) {
      throw new Error("Auftrag nicht gefunden.");
    }
    
    const order = { id: orderDoc.id, ...orderDoc.data() } as any;
    const currentStatus = (order.status || 'draft') as AllowedStatus;
    const currentVersion = order.version || 0;

    // 1. Optimistic Locking Check
    if (context?.expectedVersion !== undefined && currentVersion !== context.expectedVersion) {
      throw new Error("Dieser Auftrag wurde gerade von jemand anderem geändert. Bitte neu laden.");
    }

    // 2. Check Allowed Transitions
    if (currentStatus === targetStatus) {
      if (context?.additionalData && Object.keys(context.additionalData).length > 0) {
        const updatePayload: any = {
          ...context.additionalData,
          updatedAt: serverTimestamp(),
          version: increment(1)
        };
        transaction.update(orderRef, updatePayload);
        return { ...order, ...context.additionalData, version: currentVersion + 1 };
      }
      return order; // No-op
    }
    
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(`Ungültiger Statusübergang von '${currentStatus}' zu '${targetStatus}'.`);
    }

    const updatePayload: any = {
      ...context?.additionalData,
      status: targetStatus,
      updatedAt: serverTimestamp(),
      version: increment(1)
    };

    // 3. Fetch Customer for Ticket Evaluation (if needed for validation)
    let customer = null;
    if (order.customerId) {
      const custDoc = await transaction.get(doc(db, getCol('customers'), order.customerId));
      if (custDoc.exists()) customer = { id: custDoc.id, ...custDoc.data() };
    }

    const tickets = generateTickets(order, customer);

    // 4. Point of No Return (Zone 1 -> Zone 2)
    if (targetStatus === 'confirmed') {
      // Validate Minimum Requirements
      const hasMovingDate = !!(order.orderMeta?.movingDateFrom || order.orderMeta?.movingDateTo);
      const hasBothAddresses = !!(order.logistics?.a_city || order.logistics?.a_street) && !!(order.logistics?.b_city || order.logistics?.b_street);
      const hasSignatureOrExternal = !!order.signatureOrder || !!order.externallyConfirmed;

      if (!hasMovingDate) throw new Error("Umzugsdatum fehlt. Bitte Datum angeben.");
      if (!hasBothAddresses) throw new Error("Beide Adressen (Belade- und Entladeadresse) müssen vorhanden sein.");
      if (!hasSignatureOrExternal) throw new Error("Digitale Unterschrift oder externe Bestätigung fehlt.");

      // Create confirmedSnapshot (but NO contractNumber)
      if (currentStatus === 'draft' || currentStatus === 'quote') {
        updatePayload.confirmedSnapshot = {
          capturedAt: new Date().toISOString(),
          totalPrice: order.price || 0,
          services: order.services || [],
        };
      }
    }

    // 5. Strict Zone (Zone 2) - Enforce Mandatory Tasks
    if (targetStatus === 'completed') {
      // Check if all mandatory tasks for Phase 4 are done
      const phase4Tickets = tickets.filter(t => t.phase === 4 && (t.type === 'action' || t.type === 'warning'));
      const incompletePhase4 = phase4Tickets.filter(t => !t.done);
      
      if (incompletePhase4.length > 0) {
        throw new Error(`Nicht alle Pflichtaufgaben erledigt. Offen: ${incompletePhase4.map(t => t.title).join(', ')}`);
      }
      
      // Specifically check Abnahmeprotokoll
      if (!order.signatureProtocol && (!order.protocols || order.protocols.length === 0)) {
        throw new Error("Abnahmeprotokoll fehlt.");
      }
    }

    // 6. Rollback & Archive Logistics
    if (currentStatus === 'completed' && targetStatus === 'confirmed') {
      // Backward completed -> confirmed: No need to archive protocols here as they are kept.
    }

    if (targetStatus === 'canceled' && currentStatus === 'confirmed') {
      // Storno of a confirmed order (contractNumber and disposition stay intact for documentation)
      updatePayload.canceledAt = serverTimestamp();
      updatePayload.canceledReason = context?.reason || 'Kein Grund angegeben';
    }

    // 7. Invoice Number Generation
    if ((targetStatus === 'invoice_open' || targetStatus === 'invoice_paid') && !order.invoiceNumber) {
      const settingsRef = doc(db, getCol('system'), 'settings');
      const settingsDoc = await transaction.get(settingsRef);
      let nextInvoiceNumber = 1000;
      if (settingsDoc.exists() && settingsDoc.data().nextInvoiceNumber) {
        nextInvoiceNumber = settingsDoc.data().nextInvoiceNumber;
      }
      transaction.update(settingsRef, { nextInvoiceNumber: increment(1) });
      updatePayload.invoiceNumber = `RE-${new Date().getFullYear()}-${nextInvoiceNumber.toString().padStart(3, '0')}`;
      updatePayload.invoiceDate = new Date().toISOString();
    }

    // 8. Order Number Generation
    if (['quote', 'confirmed', 'completed'].includes(targetStatus) && !order.orderNumber && !updatePayload.orderNumber) {
      const settingsRef = doc(db, getCol('system'), 'settings');
      const settingsDoc = await transaction.get(settingsRef);
      let nextQuoteNumber = 1000;
      if (settingsDoc.exists() && settingsDoc.data().nextQuoteNumber) {
        nextQuoteNumber = settingsDoc.data().nextQuoteNumber;
      }
      transaction.update(settingsRef, { nextQuoteNumber: increment(1) });
      updatePayload.orderNumber = `ANG-${new Date().getFullYear()}-${nextQuoteNumber.toString().padStart(3, '0')}`;
    }

    // Execute the write
    transaction.update(orderRef, updatePayload);

    return { ...order, ...updatePayload, version: currentVersion + 1 };
  });
}

/**
 * Manually generates a contract for confirmed orders
 */
export async function generateContract(orderId: string, context?: TransitionContext) {
  return await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, getCol('orders'), orderId);
    const orderDoc = await transaction.get(orderRef);
    if (!orderDoc.exists()) throw new Error("Auftrag nicht gefunden.");
    
    const order = orderDoc.data();
    if (order.status !== 'confirmed' && order.status !== 'completed') {
      throw new Error("Vertrag kann nur in bestätigten Aufträgen erstellt werden.");
    }
    if (order.contractNumber) {
      throw new Error("Auftrag hat bereits eine Vertragsnummer.");
    }

    // Generate contract number transactionally
    const settingsRef = doc(db, getCol('system'), 'settings');
    const settingsDoc = await transaction.get(settingsRef);
    let nextContractNumber = 1000;
    if (settingsDoc.exists() && settingsDoc.data().nextOrderNumber) {
      nextContractNumber = settingsDoc.data().nextOrderNumber;
    }

    transaction.update(settingsRef, { nextOrderNumber: increment(1) });
    transaction.update(orderRef, { 
      contractNumber: nextContractNumber.toString(),
      contractGeneratedAt: serverTimestamp(),
      contractGeneratedBy: context?.userName || context?.userId || 'System',
      version: increment(1)
    });

    return nextContractNumber.toString();
  });
}
