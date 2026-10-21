# Rothirsch Umzug App – Master Claude Architecture & Rebuild Blueprint

This document is the **definitive, self-contained master specification** for Claude Code and AI assistants. It contains all essential architecture, data schemas, workflows, and strict business rules required to build, maintain, or rebuild the entire **Rothirsch Umzug** enterprise application from scratch.

---

## 1. Quick Commands
* **Run Development Server**: `npm run dev` (Runs on `http://localhost:3000`)
* **Type Check**: `npx tsc --noEmit` (Always verify before committing)
* **Production Build**: `npm run build` (Executes `next build --webpack` to avoid font timeout issues)
* **Linting**: `npm run lint`

---

## 2. Tech Stack & Environment
* **Domain**: Enterprise ERP & Logistics Suite for German Moving Companies (*Umzugsunternehmen*).
* **Framework**: Next.js 16.2.6 (App Router, Server Components & Client Components).
* **UI & Styling**: React 19.2.4, Tailwind CSS v4, Heroicons & Google Material Symbols.
* **Database & Auth**: Google Cloud Firestore & Firebase Auth (Firebase SDK v12).
* **Server Operations**: Firebase Admin SDK (`src/lib/firebaseAdmin.ts`).
* **PDF Engine**: `@react-pdf/renderer` for quotes, invoices, and employee dispatch sheets.
* **Geocoding & Routing**: Google Maps Distance Matrix API.

---

## 3. Database Architecture & Firestore Collections Schema

### A. Collection `orders`
The core transactional document representing a move quote, contract, or executed project:
* `orderNumber`: Sequential quote/order number (e.g. `1771`).
* `status`: `'draft' | 'quote' | 'confirmed' | 'completed' | 'invoice_open' | 'invoice_paid' | 'archived' | 'canceled'`.
* `customerId`: Reference to `customers` document ID.
* `customer`: Customer snapshot (name, email, phone, company).
* `orderMeta`:
  * `movingDateFrom`, `movingDateTo`: Moving date window.
  * `viewingDate`: ISO string or `'erledigt_fotos'` (inspection conducted via customer photos) or `'requested'`.
  * `viewingTime`: Inspection time string.
  * `validUntil`: Quote expiration date.
* `logistics`:
  * `a_street`, `a_city`, `a_postal`, `a_floor`, `a_hasLift`, `a_carryingDistance`: Loading address details.
  * `b_street`, `b_city`, `b_postal`, `b_floor`, `b_hasLift`, `b_carryingDistance`: Unloading address details.
  * `distanceKm`, `durationMinutes`: Real-world route calculated via Google Maps.
  * `needHVZ`: Halteverbotszone requirement boolean (`hvzDate`, `hvzStatus`).
  * `needLift`: Furniture lift requirement boolean (`moebelliftDate`).
  * `boxDeliveryDate`, `boxesDelivered`: Packing material logistics.
* `services`: Array of items `{ id, name, price, quantity, unit, category, defaultDesc }`.
* `calcInput`: `{ isFlatRate: boolean, flatRateNet: number, hourlyRate: number, estimatedHours: number, workersCount: number, trucksCount: number }`.
* `totals`: `{ net: number, tax: number, gross: number }` (Standard German 19% MwSt).
* `inventory`: Array of room items `{ id, roomName, itemName, volumeCbm, quantity }`.
* `totalVolumeCbm`: Calculated cubic meters of furniture and boxes.
* `invoiceNumber`: Issued invoice reference (e.g. `R-1771`).
* `invoiceDate`: ISO timestamp of invoice generation.
* `payments`: Array of `{ id, amount, method ('bar'|'ueberweisung'|'karte'|'schaden_verrechnung'), date, note }`.
* `totalPaid`: Cumulative sum of booked payments.
* `protocols`: Array of digital touch-signed handover protocols (`signatureProtocol`, meter readings, key handover).
* `ticketStates`: Key-value completion state for operational tasks (`halteverbot`, `kartons_liefern`, `viewing_requested`, `team`).

### B. Collection `customers`
* `customerNumber`, `firstName`, `lastName`, `company`, `email`, `phone`.
* `address`: `{ street, houseNumber, postalCode, city }`.
* `source`: Lead acquisition channel (`Check24`, `Google Ads`, `Empfehlung`, `Direkt`).
* `tags`: Array of customer labels (`Privat`, `Gewerblich`, `VIP`, `Behörde`).
* `notes`: Operational and customer-service logs.

### C. Collection `invoices`
Stores finalized standalone and counterpart invoices. Synchronized with counterpart `orders` via `writeBatch`.
* `invoiceNumber`: `R-XXXX`.
* `isStorno`, `stornoDocumentNumber`: `ST-XXXX` for GoBD cancellations.
* `services`, `totals`, `payments`, `status`.

### D. Collection `settings`
Global enterprise configuration document (`company_settings`):
* `nextQuoteNumber`, `nextInvoiceNumber`, `nextCustomerNumber`.
* `companyName`, `address`, `taxId` (Steuernummer / USt-IdNr), `bankName`, `iban`, `bic`.
* `servicesCatalog`: Pre-defined standard moving, packing, kitchen, and montage items with default prices.
* `defaultTerms`: Standard German moving liability (§ 451g HGB) and cancellation policies.

---

## 4. Application Route & Component Architecture

### 1. `/` (Login & Security Shield)
* Authentication via Firebase Auth.
* 5-attempt brute-force protection with persistent 10-minute lockout in `localStorage`.
* Bilingual alerts (German/Arabic).

### 2. `/dashboard` (Kanban Disposition Board)
* Automated event-driven columns: `Neu`, `In Verhandlung`, `Bestätigt`, `Abgeschlossen`.
* Quick order inspection drawer (`OrderDetailsDrawer.tsx`).
* Live date urgency badges and materials summary.

### 3. `/dashboard/customers` & `/dashboard/customers/[id]` (Customer Profile / Kundenakte)
* Comprehensive customer dossier (`CustomerPremiumProfile.tsx`).
* **Operational Stepper**: 4-Phase visual indicator with progress bar.
* **Financial Administration Hub**: Dedicated section for issuing invoices, booking payments, and executing GoBD Storno cancellations (`StornoModal.tsx`).
* **Document Archive**: 1-click preview and PDF download for quotes, invoices, and protocols.

### 4. `/dashboard/customers/[id]/edit-order/[orderId]` (5-Step Order Wizard)
* **Step 1 (Stammdaten)**: Customer contact info, moving dates, viewing date scheduling or 1-click `Durch Fotos` completion.
* **Step 2 (Logistik & Adressen)**: Start & destination addresses, floor levels, elevators, carrying distances, Google Maps route integration, and parking permits (HVZ).
* **Step 3 (Leistungen & Preise)**: Itemized service catalog or Flat-rate (Festpreis) toggle, direct numeric quantity inputs (`Menge`), and clean Netto inputs without persistent zero.
* **Step 4 (Inventar & Volumen)**: Visual room-by-room inventory calculator ($m^3$) with dynamic sub-room discovery (`Raum jetzt auswählen`). Bottom navigation bar hides automatically during modal dialogs.
* **Step 5 (Vorschau & Dokument)**: Totals calculation (Netto, 19% MwSt, Brutto), and 1-click generation of the formal quote PDF.
* *Navigation Flexibility*: Disponents can jump directly to Steps 3 and 4 once the customer's last name is provided.

### 5. `/dashboard/logistics` (Einsatzplan & Checklist)
* Central logistics command center.
* Grouped by customer and flat task view.
* Four smart dynamic milestones:
  1. *Rechnung & Zahlung*: `Rechnung erstellen` if missing; `Zahlung erfassen (Offen: €X)` if unpaid; `Bezahlt ✓` if paid.
  2. *Halteverbotszone (HVZ)*: `HVZ planen` if unscheduled; `Als beantragt markieren` 1-click completion.
  3. *Umzugskartons*: `Lieferung planen` if unscheduled; `Geliefert ✓` 1-click delivery.
  4. *Besichtigung*: Auto-completed if `Durch Fotos` or if order is confirmed/completed.

### 6. `/dashboard/calendar` (Resource Disposition)
* Vehicle fleet assignment (3.5t Transporter, 7.5t LKW, Möbellift).
* Crew assignment (Teamleiter, Umzugshelfer, Monteure).
* Drag-and-schedule dispo modal (`DispoModal.tsx`).

### 7. `/dashboard/finances` (GoBD Accounting & DATEV)
* Official invoice ledger, revenue reporting, open balance tracking.
* DATEV export engine: generates monthly ZIP bundles with all invoices PDF and standardized CSV for tax advisors.

### 8. `/dashboard/claims` (Reklamationen & Settlements)
* Customer damage and complaint tracking.
* Two GoBD-compliant settlement paths (`SettleClaimModal.tsx`):
  1. `schaden_verrechnung`: Books an offset payment without distorting VAT base (§ 1 Abs. 1 UStG).
  2. `service_deduction`: Adds a negative item (`-X.XX €`) to invoice services.

---

## 5. Inviolable Core Business Rules & Edge Cases (DO NOT BREAK)

### A. Inviolable UTC Calendar Math (DST Immunity)
* **NEVER use local date millisecond division with `Math.ceil`**: In Germany/Europe, Daylight Saving Time (DST) changes in late March and late October. When crossing a DST boundary, local millisecond difference is off by $\pm 1$ hour (e.g. 40 days + 1 hour = 40.04 days), and `Math.ceil(40.04)` falsely yields 41 days!
* **ALWAYS use UTC calendar arithmetic**:
  ```ts
  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const utcTarget = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diffDays = Math.round((utcTarget - utcToday) / (1000 * 60 * 60 * 24));
  ```

### B. Cockpit vs. Customer Folder Separation of Concerns
* **Cockpit Drawer (`OrderDetailsDrawer.tsx`)**: Strictly operational. Shows moving route, team/vehicle dispatch, logistical checklist status, and a button to view the official invoice PDF (`Rechnung ansehen`). **NEVER leak GoBD lock warnings or Storno creation buttons into the operational Cockpit!**
* **Customer Profile (`CustomerPremiumProfile.tsx`)**: The dedicated administrative hub where GoBD Storno cancellation and invoice adjustments reside.
* **Progress Bar 100% Alignment**: In Phase 4, when an order is completed and fully settled (`calculateOpenAmount(order) <= 0.01` or `status === 'invoice_paid'`), all tasks (`invoice`, `protocol`, `payment`) must evaluate to 100% completed so the progress bar never contradicts the completed badge.

### C. State Machine & Pipeline Flow (`orderStateMachine.ts`)
```
draft ──► quote ──► confirmed ──► completed ──► invoice_open ──► invoice_paid
  │         │           │             │               │
  └─────────┴───────────┴─────────────┴───────────────┴──► archived / canceled
```
* **Transition to `confirmed` requires**:
  1. `movingDateFrom` or `movingDateTo`.
  2. Both addresses (Beladestelle A and Entladestelle B).
  3. Valid confirmation: `signatureOrder`, `externallyConfirmed`, `isManuallySigned`, or `contractSigned`.
* **Transition to `completed` requires**:
  1. Signed acceptance protocol (`signatureProtocol` or entry in `protocols` array).
  2. All Phase 4 action tickets completed.
* **NO Drag & Drop on Kanban**: Columns are strictly derived from state machine status and logistical evaluation.

### D. Invoicing, Payments & Collections Dual-Sync
* When recording or deleting payments, ALWAYS update both `invoices` and counterpart `orders` documents simultaneously via Firestore `writeBatch`.
* Use `calculateOpenAmount(order)` to determine open balance. If `calculateOpenAmount(order) <= 0.01`, treat the invoice as fully paid.

### E. Wizard Ergonomics & Native In-App Modals
* Replace all native browser `window.confirm` dialogs with custom bilingual in-app modals.
* Allow direct typing in item quantity inputs (`Menge`).
* Do not keep sticky `0` in price inputs.
* Automatically hide bottom navigation bars when modal popups are open to prevent UI overlap.

---

## 6. Document PDF Specifications (`@react-pdf/renderer`)
1. **Angebot PDF (`src/components/pdf/OfferPDF.tsx`)**:
   * Official corporate header, recipient box, offer number, moving route, service breakdown table.
   * Total net, 19% VAT, total gross.
   * Legal terms: § 451g HGB carrier liability limit (€620 / cbm) and 14-day cancellation policy.
   * Customer acceptance signature block.
2. **Rechnung PDF (`src/components/pdf/InvoicePDF.tsx`)**:
   * Official invoice number (`R-XXXX`), tax date, performance period (*Leistungsdatum*).
   * GoBD compliance: Tax ID, bank details (IBAN/BIC), payment terms, and clear distinction of Storno documents (`ST-XXXX`).
3. **Laufzettel PDF (`src/components/pdf/EmployeeSheetPDF.tsx`)**:
   * Mover crew dispatch sheet: Contact numbers, loading/unloading addresses, floor levels, parking distance, and full inventory item checklist.
