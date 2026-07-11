import { adminDb } from './src/lib/firebaseAdmin';

async function test() {
  const snap = await adminDb.collection('users').get();
  console.log("Found", snap.size, "users in adminDb");
  snap.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
  });
}

test().catch(console.error);
