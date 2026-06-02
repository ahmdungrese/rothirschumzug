import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCRwSkKcHttBnDWbWfBz8w2QDYx7WepveI",
  authDomain: "rotthirsch-app.firebaseapp.com",
  projectId: "rotthirsch-app",
  storageBucket: "rotthirsch-app.firebasestorage.app",
  messagingSenderId: "778553890286",
  appId: "1:778553890286:web:cf4668de40888d41886aff"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  try {
    const servicesSnap = await getDocs(collection(db, 'services'));
    
    for (const d of servicesSnap.docs) {
      const name = d.data().name;
      let category = "Sonstiges";
      if (name.includes("Umzugskartons") || name.includes("Kleiderboxen")) {
        category = "📦 Packmaterial";
      } else if (name.includes("Halteverbot") || name.includes("Möbellift")) {
        category = "🚚 Logistik & Fahrzeuge";
      } else if (name.includes("Montage") || name.includes("Packservice")) {
        category = "🛠️ Montage & Service";
      }
      
      await updateDoc(doc(db, 'services', d.id), { category });
    }
    console.log("Migration complete.");
  } catch (error) {
    console.error("Error migrating", error);
  }
  process.exit(0);
}

run();
