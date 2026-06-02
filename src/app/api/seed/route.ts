import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';

export async function GET() {
  try {
    // Only seed if empty
    const servicesSnap = await getDocs(collection(db, 'services'));
    if (!servicesSnap.empty) {
      return NextResponse.json({ success: true, message: "Already seeded." });
    }

    const services = [
      { name: "Umzugskartons (Kauf)", defaultPrice: 2.50 },
      { name: "Umzugskartons (Miete)", defaultPrice: 1.00 },
      { name: "Kleiderboxen", defaultPrice: 15.00 },
      { name: "Halteverbotszone (Einrichtung)", defaultPrice: 85.00 },
      { name: "Möbellift inkl. Bediener (pro Std)", defaultPrice: 75.00 },
      { name: "Möbelmontage (Stundensatz)", defaultPrice: 35.00 },
      { name: "Packservice (Stundensatz)", defaultPrice: 30.00 },
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

    return NextResponse.json({ success: true, message: "Seeding complete" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
