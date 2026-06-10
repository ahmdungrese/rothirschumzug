import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';

export async function POST() {
  try {
    const prefix = 'demo_';
    
    // Clear existing demo collections
    const collectionsToClear = ['orders', 'customers', 'users', 'activity_logs', 'claims'];
    
    for (const colName of collectionsToClear) {
      const snap = await getDocs(collection(db, `${prefix}${colName}`));
      for (const d of snap.docs) {
        await deleteDoc(doc(db, `${prefix}${colName}`, d.id));
      }
    }

    // Recreate demo users so login roles are preserved
    await setDoc(doc(db, `${prefix}users`, 'demo-admin'), {
      uid: 'demo-admin', displayName: 'System Admin', email: 'admin@rothirsch-umzug.de', loginId: 'admin@rothirsch-umzug.de', role: 'admin', createdAt: serverTimestamp()
    });
    await setDoc(doc(db, `${prefix}users`, 'demo-office'), {
      uid: 'demo-office', displayName: 'Lisa (Büro)', email: 'lisa@rothirsch-umzug.de', loginId: 'lisa@rothirsch-umzug.de', role: 'office', createdAt: serverTimestamp()
    });
    await setDoc(doc(db, `${prefix}users`, 'demo-teamlead'), {
      uid: 'demo-teamlead', displayName: 'Thomas (Teamleiter)', email: 'thomas@rothirsch-umzug.de', loginId: 'thomas@rothirsch-umzug.de', role: 'teamlead', createdAt: serverTimestamp()
    });

    return NextResponse.json({ success: true, message: "Demo Database completely cleared." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
