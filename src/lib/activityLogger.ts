import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';

export type ActivityAction = 'LOGIN' | 'CREATE_CUSTOMER' | 'UPDATE_CUSTOMER' | 'ARCHIVE_CUSTOMER' | 'CREATE_ORDER' | 'UPDATE_ORDER' | 'ARCHIVE_ORDER';

export const logActivity = async (
  userId: string,
  userName: string,
  action: ActivityAction,
  details: string
) => {
  try {
    await addDoc(collection(db, getCol('activity_logs')), {
      userId,
      userName: userName || 'Unbekannt',
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
