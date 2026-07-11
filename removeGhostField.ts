import { adminDb, adminFieldValue } from './src/lib/firebaseAdmin';

async function removeGhostField() {
  await adminDb.doc('system/settings').update({
    nextOfferNumber: adminFieldValue.delete()
  });
  await adminDb.doc('system_demo/settings').update({
    nextOfferNumber: adminFieldValue.delete()
  });
  console.log("Ghost fields removed!");
}

removeGhostField().catch(console.error);
