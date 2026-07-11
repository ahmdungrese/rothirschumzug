const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./serviceAccountKey.json');
try { initializeApp({ credential: cert(serviceAccount) }); } catch (e) {}
const db = getFirestore();

const isExecute = process.argv.includes('--execute');

async function migrate() {
  console.log(`\n=== INVOICE MIGRATION SCRIPT (${isExecute ? 'EXECUTE MODE' : 'DRY RUN'}) ===\n`);
  
  const tenantId = 'ahmdungrese_rothirschumzug';
  const ordersCol = 'orders';
  const invoicesCol = 'invoices';

  console.log(`Reading from: ${ordersCol}`);
  console.log(`Writing to: ${invoicesCol}\n`);

  try {
    const ordersSnapshot = await db.collection(ordersCol).where('type', '==', 'invoice').get();
    
    if (ordersSnapshot.empty) {
      console.log('No invoices found in orders collection.');
      return;
    }

    console.log(`Found ${ordersSnapshot.size} invoice(s) in orders collection to migrate.\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const doc of ordersSnapshot.docs) {
      const data = doc.data();
      const invoiceId = doc.id;
      const invoiceNumber = data.invoiceNumber || 'ENTWURF';
      const status = data.status || 'unknown';
      const isStorno = data.isStorno ? ' (STORNO)' : '';
      const source = data.sourceOrderId ? `[Source: ${data.sourceOrderId}]` : '[NO SOURCE]';

      console.log(`- [${invoiceId}] ${invoiceNumber} | Status: ${status}${isStorno} ${source}`);

      if (isExecute) {
        try {
          await db.runTransaction(async (t) => {
            const invoiceRef = db.collection(invoicesCol).doc(invoiceId);
            const originalRef = db.collection(ordersCol).doc(invoiceId);
            
            const destDoc = await t.get(invoiceRef);
            if (!destDoc.exists) {
              t.set(invoiceRef, data);
            }
            t.delete(originalRef);
          });
          
          console.log(`  -> SUCCESS: Moved ${invoiceId}`);
          successCount++;
        } catch (e) {
          console.error(`  -> ERROR moving ${invoiceId}: ${e.message}`);
          errorCount++;
        }
      }
    }

    console.log('\n=== MIGRATION SUMMARY ===');
    console.log(`Total Found: ${ordersSnapshot.size}`);
    if (isExecute) {
      console.log(`Successfully Moved: ${successCount}`);
      console.log(`Errors: ${errorCount}`);
    } else {
      console.log('\nRun with --execute to perform the actual migration.');
    }
  } catch (e) {
    console.error('Fatal Error:', e);
  }
}

migrate().then(() => process.exit(0)).catch(() => process.exit(1));
