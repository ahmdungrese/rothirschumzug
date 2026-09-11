import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type ActivityAction = 'LOGIN' | 'CREATE_CUSTOMER' | 'UPDATE_CUSTOMER' | 'ARCHIVE_CUSTOMER' | 'CREATE_ORDER' | 'UPDATE_ORDER' | 'ARCHIVE_ORDER';

export const logActivity = async (
  userId: string,
  userName: string,
  action: ActivityAction,
  details: string
) => {
  try {
    const cleanName = (userName && userName !== 'Unbekannt') ? userName : 'Mitarbeiter';
    await addDoc(collection(db, 'activity_logs'), {
      userId,
      userName: cleanName,
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
