import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, Timestamp, setDoc } from 'firebase/firestore';

export async function POST() {
  try {
    // Only allow this if it's the demo database.
    // For safety, we enforce prefix 'demo_'
    const prefix = 'demo_';
    
    // Clear existing demo orders and customers
    const ordersSnap = await getDocs(collection(db, `${prefix}orders`));
    for (const d of ordersSnap.docs) {
      await deleteDoc(doc(db, `${prefix}orders`, d.id));
    }

    const customersSnap = await getDocs(collection(db, `${prefix}customers`));
    for (const d of customersSnap.docs) {
      await deleteDoc(doc(db, `${prefix}customers`, d.id));
    }

    const usersSnap = await getDocs(collection(db, `${prefix}users`));
    for (const d of usersSnap.docs) {
      await deleteDoc(doc(db, `${prefix}users`, d.id));
    }

    // Seed Demo Users (Team)
    await setDoc(doc(db, `${prefix}users`, 'demo-admin'), {
      uid: 'demo-admin',
      displayName: 'System Admin',
      email: 'admin@rothirsch-umzug.de',
      loginId: 'admin@rothirsch-umzug.de',
      role: 'admin',
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, `${prefix}users`, 'demo-office'), {
      uid: 'demo-office',
      displayName: 'Lisa (Büro)',
      email: 'lisa@rothirsch-umzug.de',
      loginId: 'lisa@rothirsch-umzug.de',
      role: 'office',
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, `${prefix}users`, 'demo-teamlead'), {
      uid: 'demo-teamlead',
      displayName: 'Thomas (Teamleiter)',
      email: 'thomas@rothirsch-umzug.de',
      loginId: 'thomas@rothirsch-umzug.de',
      role: 'teamlead',
      createdAt: serverTimestamp(),
    });

    // Helper to create a customer
    const createCustomer = async (data: any) => {
      const c = await addDoc(collection(db, `${prefix}customers`), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return c.id;
    };

    const c1 = await createCustomer({ firstName: "Julia", lastName: "Schmidt", email: "julia@example.com", phone: "0170 123456" });
    const c2 = await createCustomer({ firstName: "Bernd", lastName: "Logistik", email: "bernd@example.com", phone: "0151 987654" });
    const c3 = await createCustomer({ firstName: "Anna", lastName: "Müller", email: "anna@example.com", phone: "0176 111222" });
    const c4 = await createCustomer({ firstName: "Peter", lastName: "Doppel", email: "peter@example.com", phone: "0176 333444" });
    const c5 = await createCustomer({ firstName: "Familie", lastName: "Zahler", email: "zahler@example.com", phone: "0160 555666" });
    const c6 = await createCustomer({ firstName: "Storno", lastName: "Kunde", email: "storno@example.com", phone: "0172 777888" });
    const c7 = await createCustomer({ firstName: "Inkasso", lastName: "Kunde", email: "inkasso@example.com", phone: "0152 999000" });

    // --- KUNDEN GENERIEREN ---
    const c1 = await createCustomer({ firstName: "Neu", lastName: "Entwurf", email: "entwurf@example.com", phone: "0170 111" });
    const c2 = await createCustomer({ firstName: "Wartet", lastName: "Antwort", email: "wartet@example.com", phone: "0170 222" });
    const c3 = await createCustomer({ firstName: "Abgelehnt", lastName: "Kunde", email: "abgelehnt@example.com", phone: "0170 333" });
    const c4 = await createCustomer({ firstName: "Zukunft", lastName: "Logistik", email: "zukunft@example.com", phone: "0170 444" });
    const c5 = await createCustomer({ firstName: "Zeitnah", lastName: "Umzug", email: "zeitnah@example.com", phone: "0170 555" });
    const c6 = await createCustomer({ firstName: "Heute", lastName: "Aktiv", email: "heute@example.com", phone: "0170 666" });
    const c7 = await createCustomer({ firstName: "Gestern", lastName: "Beendet", email: "gestern@example.com", phone: "0170 777" });
    const c8 = await createCustomer({ firstName: "Frische", lastName: "Rechnung", email: "frisch@example.com", phone: "0170 888" });
    const c9 = await createCustomer({ firstName: "Teilzahlung", lastName: "Kunde", email: "teil@example.com", phone: "0170 999" });
    const c10 = await createCustomer({ firstName: "Mahnung", lastName: "Eins", email: "mahnung1@example.com", phone: "0170 000" });
    const c11 = await createCustomer({ firstName: "Mahnung", lastName: "Zwei", email: "mahnung2@example.com", phone: "0171 111" });
    const c12 = await createCustomer({ firstName: "Voll", lastName: "Bezahlt", email: "bezahlt@example.com", phone: "0171 222" });
    const c13 = await createCustomer({ firstName: "Bar", lastName: "Zahler", email: "bar@example.com", phone: "0171 333" });
    const c14 = await createCustomer({ firstName: "Einfach", lastName: "Storno", email: "storno1@example.com", phone: "0171 444" });
    const c15 = await createCustomer({ firstName: "GoBD", lastName: "Storno", email: "storno2@example.com", phone: "0171 555" });
    const c16 = await createCustomer({ firstName: "Schaden", lastName: "Neu", email: "schaden1@example.com", phone: "0171 666" });
    const c17 = await createCustomer({ firstName: "Schaden", lastName: "Bearbeitung", email: "schaden2@example.com", phone: "0171 777" });
    const c18 = await createCustomer({ firstName: "Schaden", lastName: "Erledigt", email: "schaden3@example.com", phone: "0171 888" });
    const c19 = await createCustomer({ firstName: "Archiv", lastName: "Perfekt", email: "archiv1@example.com", phone: "0171 999", isArchived: true });
    const c20 = await createCustomer({ firstName: "Archiv", lastName: "Storno", email: "archiv2@example.com", phone: "0172 000", isArchived: true });

    // Hilfsfunktion für ein Datum in der Zukunft/Vergangenheit
    const getDate = (daysOffset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + daysOffset);
      return d.toISOString().split('T')[0];
    };

    // --- AUFTRÄGE GENERIEREN ---

    // 1. Neu / Entwurf
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c1, customerName: "Neu Entwurf", status: "draft",
      createdAt: serverTimestamp()
    });

    // 2. Wartet auf Antwort (Angebot)
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c2, customerName: "Wartet Antwort", status: "quote",
      orderNumber: "AN-DEMO-0001", movingDate: getDate(14),
      logistics: { a_street: "Musterweg 1", b_street: "Zielweg 2" },
      totals: { net: 800, tax: 152, gross: 952 },
      createdAt: serverTimestamp()
    });

    // 3. Abgelehnt
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c3, customerName: "Abgelehnt Kunde", status: "canceled",
      orderNumber: "AN-DEMO-0002", movingDate: getDate(20),
      totals: { net: 1000, tax: 190, gross: 1190 },
      createdAt: serverTimestamp()
    });

    // 4. Zukunft (in 30 Tagen) -> Logistics Warnings
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c4, customerName: "Zukunft Logistik", status: "confirmed",
      orderNumber: "AU-DEMO-0004", movingDate: getDate(30),
      logistics: { a_street: "Start 1", b_street: "Ziel 2", noParkingZone: true, noParkingZoneConfirmed: false },
      todos: [{ id: "t1", title: "Halteverbotsschilder bei der Stadt beantragen", isDone: false }],
      totals: { net: 1200, tax: 228, gross: 1428 },
      createdAt: serverTimestamp()
    });

    // 5. Zeitnah (in 2 Tagen) -> Offene Tickets
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c5, customerName: "Zeitnah Umzug", status: "confirmed",
      orderNumber: "AU-DEMO-0005", movingDate: getDate(2),
      logistics: { a_street: "Startstr", b_street: "Zielstr", noParkingZone: true, noParkingZoneConfirmed: true },
      todos: [{ id: "t2", title: "Umzugskartons vorab an Kunden liefern", isDone: false }, { id: "t3", title: "Kunde anrufen wg. Schlüsselübergabe", isDone: false }],
      totals: { net: 1500, tax: 285, gross: 1785 },
      createdAt: serverTimestamp()
    });

    // 6. HEUTE (Aktiv) -> Laufzettel / Dispo
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c6, customerName: "Heute Aktiv", status: "confirmed",
      orderNumber: "AU-DEMO-0006", movingDate: getDate(0),
      logistics: { a_street: "Heute 1", b_street: "Heute 2" },
      disposition: { helpers: 3, koffer35t: 1, lkw7t: 0 },
      totals: { net: 900, tax: 171, gross: 1071 },
      createdAt: serverTimestamp()
    });

    // 7. Gestern Beendet (Wartet auf Rechnung)
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c7, customerName: "Gestern Beendet", status: "completed",
      orderNumber: "AU-DEMO-0007", movingDate: getDate(-1),
      totals: { net: 850, tax: 161.5, gross: 1011.5 },
      createdAt: serverTimestamp()
    });

    // 8. Frische Rechnung
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c8, customerName: "Frische Rechnung", status: "invoice_open",
      invoiceNumber: "RE-DEMO-0008", movingDate: getDate(-5),
      totals: { net: 1000, tax: 190, gross: 1190 },
      createdAt: serverTimestamp()
    });

    // 9. Teilzahlung (Bar + Rest offen)
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c9, customerName: "Teilzahlung Kunde", status: "invoice_open",
      invoiceNumber: "RE-DEMO-0009", movingDate: getDate(-10),
      totals: { net: 2000, tax: 380, gross: 2380 },
      payments: [{ amount: 1000, method: "Barzahlung", date: Timestamp.fromDate(new Date()), notes: "Anzahlung beim Teamleiter" }],
      createdAt: serverTimestamp()
    });

    // 10. Überfällig (Mahnung 1)
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c10, customerName: "Mahnung Eins", status: "invoice_overdue",
      invoiceNumber: "RE-DEMO-0010", movingDate: getDate(-20),
      totals: { net: 800, tax: 152, gross: 952 },
      createdAt: serverTimestamp()
    });

    // 11. Überfällig (Mahnung 2)
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c11, customerName: "Mahnung Zwei", status: "invoice_overdue",
      invoiceNumber: "RE-DEMO-0011", movingDate: getDate(-40),
      totals: { net: 1500, tax: 285, gross: 1785 },
      createdAt: serverTimestamp()
    });

    // 12. Voll Bezahlt (Überweisung)
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c12, customerName: "Voll Bezahlt", status: "invoice_paid",
      invoiceNumber: "RE-DEMO-0012", movingDate: getDate(-15),
      totals: { net: 1000, tax: 190, gross: 1190 },
      payments: [{ amount: 1190, method: "Überweisung", date: Timestamp.fromDate(new Date()), notes: "Komplett bezahlt" }],
      createdAt: serverTimestamp()
    });

    // 13. Voll Bezahlt (Bar)
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c13, customerName: "Bar Zahler", status: "invoice_paid",
      invoiceNumber: "RE-DEMO-0013", movingDate: getDate(-3),
      totals: { net: 500, tax: 95, gross: 595 },
      payments: [{ amount: 595, method: "Barzahlung", date: Timestamp.fromDate(new Date()), notes: "Direkt vor Ort" }],
      createdAt: serverTimestamp()
    });

    // 14. Einfacher Storno
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c14, customerName: "Einfach Storno", status: "canceled",
      orderNumber: "AU-DEMO-0014", movingDate: getDate(10),
      totals: { net: 600, tax: 114, gross: 714 },
      createdAt: serverTimestamp()
    });

    // 15. GoBD Storno (mit Korrektur)
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c15, customerName: "GoBD Storno", status: "canceled",
      invoiceNumber: "RE-DEMO-0015", cancellationInvoice: "KO-DEMO-0015", movingDate: getDate(-2),
      totals: { net: 1200, tax: 228, gross: 1428 },
      createdAt: serverTimestamp()
    });

    // 16. Schaden Neu
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c16, customerName: "Schaden Neu", status: "completed", movingDate: getDate(-5),
      totals: { net: 900, tax: 171, gross: 1071 }, createdAt: serverTimestamp()
    });
    await addDoc(collection(db, `${prefix}claims`), {
      customerId: c16, customerName: "Schaden Neu", status: "Neu",
      description: "Ein Kratzer im Kühlschrank wurde beim Ausladen festgestellt.", createdAt: serverTimestamp()
    });

    // 17. Schaden In Bearbeitung
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c17, customerName: "Schaden Bearbeitung", status: "completed", movingDate: getDate(-10),
      totals: { net: 1100, tax: 209, gross: 1309 }, createdAt: serverTimestamp()
    });
    await addDoc(collection(db, `${prefix}claims`), {
      customerId: c17, customerName: "Schaden Bearbeitung", status: "In Bearbeitung",
      description: "Glasscheibe vom Wohnzimmerschrank gebrochen.", insuranceId: "VHV-987654", createdAt: serverTimestamp()
    });

    // 18. Schaden Erledigt
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c18, customerName: "Schaden Erledigt", status: "completed", movingDate: getDate(-30),
      totals: { net: 2000, tax: 380, gross: 2380 }, createdAt: serverTimestamp()
    });
    await addDoc(collection(db, `${prefix}claims`), {
      customerId: c18, customerName: "Schaden Erledigt", status: "Erledigt",
      description: "Kratzer an der Kommode. Versicherung hat 150€ erstattet.", createdAt: serverTimestamp()
    });

    // 19. Archiv Perfekt
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c19, customerName: "Archiv Perfekt", status: "invoice_paid",
      invoiceNumber: "RE-DEMO-0019", movingDate: getDate(-60),
      totals: { net: 1000, tax: 190, gross: 1190 },
      payments: [{ amount: 1190, method: "Überweisung", date: Timestamp.fromDate(new Date()), notes: "Bezahlt" }],
      createdAt: serverTimestamp()
    });

    // 20. Archiv Storno
    await addDoc(collection(db, `${prefix}orders`), {
      customerId: c20, customerName: "Archiv Storno", status: "canceled",
      orderNumber: "AU-DEMO-0020", movingDate: getDate(-50),
      totals: { net: 500, tax: 95, gross: 595 },
      createdAt: serverTimestamp()
    });

    return NextResponse.json({ success: true, message: "Demo Database seeded." });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
