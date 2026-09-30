import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type ActivityAction = 
  | 'LOGIN' 
  | 'CREATE_CUSTOMER' 
  | 'UPDATE_CUSTOMER' 
  | 'ARCHIVE_CUSTOMER' 
  | 'CREATE_ORDER' 
  | 'UPDATE_ORDER' 
  | 'ARCHIVE_ORDER'
  | 'CREATE_INVOICE'
  | 'CANCEL_INVOICE';

export const logActivity = async (
  userId: string,
  userName: string,
  action: ActivityAction,
  details: string
) => {
  try {
    let cleanName = (userName && userName.trim() !== '' && userName !== 'Unbekannt') ? userName.trim() : 'Mitarbeiter';
    // If it was just 'admin' (lowercase generic), make it readable as Mitarbeiter or keep capitalized if named Admin
    if (cleanName.toLowerCase() === 'admin') {
      cleanName = 'Administrator';
    }
    
    await addDoc(collection(db, 'activity_logs'), {
      userId: userId || 'system',
      userName: cleanName,
      action,
      details,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
};
