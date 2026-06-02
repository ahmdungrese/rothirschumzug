import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";

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
    if (!servicesSnap.empty) {
      console.log("Already seeded.");
      process.exit(0);
    }

    const services = [
      { name: "Umzugskartons (Kauf)", defaultPrice: 2.50, category: "📦 Packmaterial" },
      { name: "Umzugskartons (Miete)", defaultPrice: 1.00, category: "📦 Packmaterial" },
      { name: "Kleiderboxen", defaultPrice: 15.00, category: "📦 Packmaterial" },
      { name: "Halteverbotszone (Einrichtung)", defaultPrice: 85.00, category: "🚚 Logistik & Fahrzeuge" },
      { name: "Möbellift inkl. Bediener (pro Std)", defaultPrice: 75.00, category: "🚚 Logistik & Fahrzeuge" },
      { name: "Möbelmontage (Stundensatz)", defaultPrice: 35.00, category: "🛠️ Montage & Service" },
      { name: "Packservice (Stundensatz)", defaultPrice: 30.00, category: "🛠️ Montage & Service" },
    ];

    for (const s of services) {
      await addDoc(collection(db, 'services'), {
        ...s,
        createdAt: serverTimestamp()
      });
    }

    const customerRef = await addDoc(collection(db, 'customers'), {
      firstName: "Max",
      lastName: "Mustermann",
      email: "max.mustermann@example.com",
      phone: "+49 151 12345678",
      billingAddress: {
        street: "Musterstraße 1",
        zip: "44787",
        city: "Bochum"
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await addDoc(collection(db, 'orders'), {
      customerId: customerRef.id,
      status: "quote",
      totals: { net: 1000, tax: 190, gross: 1190 },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log("Seeding complete.");
  } catch (error) {
    console.error("Error seeding", error);
  }
  process.exit(0);
}

run();
