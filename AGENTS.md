<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rothirsch Umzug App – AI Agent Guidelines & Architecture Manual

This document provides definitive guidance for any AI coding agent working on the **Rothirsch Umzug** codebase.

---

## 1. Project Overview & Tech Stack
*   **Domain**: Enterprise ERP & Logistics Suite for German Moving & Relocation Companies (Umzugsunternehmen).
*   **Framework**: Next.js 16.2.6 (App Router, Server Components + Client Components).
*   **UI Library**: React 19.2.4 with Tailwind CSS v4.
*   **Database**: Google Cloud Firestore (Firebase SDK v12).
*   **Build Target**: `next build --webpack` (configured in `package.json` to prevent font fetching timeouts).

### Semantic Versioning (SemVer) Protocol:
*   **MAJOR (`X.0.0`)**: Incompatible architectural rewrites or breaking database schema shifts.
*   **MINOR (`2.X.0`)**: New feature modules, significant business logic upgrades, or workflow improvements (e.g. Smart Logistics Engine, UTC DST immunity).
*   **PATCH (`2.7.X`)**: Bug fixes, styling tweaks, minor edge cases without feature additions.
*   **Single Source of Truth**:
    *   Version is stored centrally in `src/lib/constants.ts` (`APP_VERSION`) and `package.json`.
    *   UI components (`Sidebar.tsx`, etc.) import `APP_VERSION` directly; never hardcode version numbers in UI templates.
    *   AI agents must update `package.json`, `src/lib/constants.ts`, and add an entry to the Changelog below upon release.

---

## 2. Versionen-Historie & Changelog (Changelog by Versions)

### Version 2.10.1 (Current) – Wizard Auto-Save Engine, Step 5 Action Hub Unification & PDF Safe-Persist Guard
*   **Automatic Draft Persistence on Reaching Step 5 (`OrderEditor.tsx`)**:
    *   Navigating to Step 5 (Abschluss) via stepper, next buttons, or wizard tabs now automatically executes a silent background draft save to Firestore.
    *   Generates or updates the `orders` document and customer profile in real time, preventing any data loss across reloads, unexpected browser closes, or offline interruptions.
    *   Step 5 verification banner replaced the redundant manual "Entwurf sichern" button with a reassuring "Als Entwurf gesichert" status indicator badge.
*   **PDF Safe-Persist Guard (`OrderEditor.tsx`)**:
    *   Clicking "PDF herunterladen / drucken" or the interactive preview paper card now automatically persists the official offer into Firestore before invoking `window.print()`.
    *   Eliminates the bug where disponents triggered print/download while the offer had not yet been committed to the database.
*   **Action Hub Streamlining & Duplicate Removal (`OrderEditor.tsx`)**:
    *   Eliminated confusing duplicate actions between Card 1 ("Angebot speichern") and the floating dock ("Angebot abschließen") by unifying them into a clear primary action.
    *   Intermediate saves ("Zwischenspeichern" in Step 3 and "Entwurf speichern" in Step 4/dock) now smoothly persist without kicking the disponent out of the wizard.

### Version 2.10.0 – Dynamic Offer Service Portfolio & Settings Showcase Manager
*   **Settings-Integrated Offer Service Portfolio (`settings/page.tsx`, `showcaseDefaults.ts`)**:
    *   Full master management under `Einstellungen > Leistungskatalog > Werbeblock & Service-Portfolio für Angebote (Seite 2)`.
    *   Disponents can enable/disable showcase items, customize service names, pick from 14 authentic logistics vector icons (Truck, Kitchen, Furniture, Boxes, HVZ, Lift, Light, Storage, Cleaning, Disposal, Piano, Painting, Sanitary, Star), and add custom services (e.g. `Endreinigung`, `Entrümpelung`, `Klaviertransport`).
    *   Configurable title, subtitle, and legal footnote disclaimer with 1-click reset to defaults.
*   **Per-Quote Instant Selection in Step 5 (`OrderEditor.tsx`)**:
    *   Enabling the showcase in Step 5 renders an interactive pill chips bar.
    *   Disponents can click individual services to toggle them on or off specifically for this quote (e.g., enable `Endreinigung` or disable `Küchenmontage` for customers without a kitchen) without affecting other orders.
*   **Airy Non-Tabular Pill Design & Legal Signature Segregation (`PDFServiceShowcase.tsx`, `OrderPDF.tsx`)**:
    *   Customer signature box sits immediately beneath the binding confirmation ("...bestätigen Sie die verbindliche Beauftragung der auf Seite 1 detaillierten Leistungen..."), ensuring customers sign exclusively for Page 1 positions.
    *   Promotional showcase placed below the signature as a courteous 4-column pill ribbon with explicit contractual disclaimer footnote, eliminating legal ambiguity.
    *   Watermark matrix enhanced with authentic moving iconography and complete eradication of drill symbols.

### Version 2.9.0 – Smart Contact Validation, Phase-Aware Action Hub & Box Configurator
*   **Smart Phase 1 Contact Validation & Non-Blocking Warnings (`OrderDetailsDrawer.tsx` & `CustomerPremiumProfile.tsx`)**:
    *   Phase 1 completion badge requires at least ONE contact method (`phone` OR `email`).
    *   If BOTH contact channels are missing, Phase 1 renders an amber warning indicator (`⚠️` / `!`) instead of an inaccurate green checkmark.
    *   Completely non-blocking: disponents can navigate and switch phases freely at any time.
*   **Smart Phase-Aware Action Bar & Secondary Dropdown Hub (`CustomerPremiumProfile.tsx`)**:
    *   Replaced the crowded 7-button toolbar with a context-aware 3-4 button layout customized to the current project phase:
        *   *Phase 1 & 2 (Anfrage / Verhandlung)*: `Angebot PDF`, `WhatsApp`, `Digital signieren`. Secondary actions (`Laufzettel`, `Protokoll`, `Rechnung`, `Zahlung`) accessible in sleek `•••` dropdown.
        *   *Phase 3 (Bestätigt & Umzugstag)*: `Angebot PDF`, `WhatsApp`, `Laufzettel`, `Protokoll`. Secondary actions in `•••` dropdown.
        *   *Phase 4 (Abrechnung)*: `Rechnung PDF`, `Zahlung erfassen`, `Protokoll`, `WhatsApp`. Secondary actions in `•••` dropdown.
*   **Umzugskartons Configurator & Settings Integration (`settings/page.tsx`, `KartonConfigModal.tsx`, `OrderEditor.tsx`)**:
    *   **Settings Management**: Default net unit prices for all 6 box sizes (`S`, `M`, `L`, `XL`, `Bücherkarton`, `Kleiderkarton mit Stange`) are manageable and saved in `Einstellungen > Leistungskatalog`.
    *   **In-App Modal Configurator**: Clicking `Kartons bereitstellen` opens an interactive configurator where disponents adjust quantities and per-unit prices with real-time totals.
    *   **Single Clean Offer Line**: Consolidates all chosen box types into a single clean line item `Umzugskartons & Packmaterial` with automated breakdown in the note (e.g. `Bereitstellung von 55 Umzugskartons vorab. Enthält: 20x M, 10x L, 10x Bücher, 5x Kleider.`), preventing quote clutter.

### Version 2.8.0 – Halteverbotszone Auto-Pricing & GoBD Customer Archival Guard
*   **Consolidated Logistics Services: Single-Line Positions for Halteverbot & Möbellift (`OrderEditor.tsx`)**:
    *   **Unified Halteverbotszone (HVZ)**:
        *   Instead of cluttering the offer with separate entries for A and B, a single unified line item `Halteverbotszone (HVZ)` is generated.
        *   When both A and B are active: `Ort: Beide`, `Menge: 2`, `Einzelpreis: 125 €`, `Summe: 250 €`.
        *   When only A is active: `Ort: A (Beladung)`, `Menge: 1`, `Summe: 125 €`.
        *   When only B is active: `Ort: B (Entladung)`, `Menge: 1`, `Summe: 125 €`.
    *   **Möbellift (Außenaufzug) Automated Sync & Pricing**:
        *   Toggling Möbellift in Step 2 under Address A and/or Address B automatically creates a unified service item `Möbellift (Außenaufzug)`.
        *   Standard fallback is **150 € Netto per Einsatz** (300 € Netto for both addresses with `Menge: 2`).
        *   Inline price editing rendered directly in Step 2 for immediate customization.
    *   **Full Two-Way Sync (Step 2 ↔ Step 3)**:
        *   Selecting `Ort` (`A`, `B`, or `Beide`) in Step 3 automatically updates `logistics` and quantities (`Menge: 1` or `2`).
        *   Changing quantities or deleting the service in Step 3 automatically syncs the address toggles in Step 2.
    *   **Foundational Base Transport & Interactive Service Reordering (`OrderEditor.tsx`)**:
        *   New quotes now automatically initialize with `Transport inkl. Be- & Entladen (Personal und Fahrzeug)` as the primary #1 position, ensuring standard logistics services (HVZ, Möbellift) appear beneath it rather than preceding it. Removable via `✕` button at any time.
        *   Integrated native HTML5 drag-and-drop (`drag_indicator`) and touch-friendly 1-click Up/Down buttons (`▲`/`▼`) on each service row in `Preiskalkulation`, allowing arbitrary position ordering directly in the wizard and PDF outputs.
*   **GoBD-Compliant Customer Archiving & Invoice Protection Guard (`SmartCustomerTable.tsx`)**:
    *   Before archiving a customer, the system queries Firestore for all linked orders and official invoices.
    *   If active/un-stornierte invoices exist (`!isStorno && !isCanceled`):
        *   An explicit **GoBD Warning Modal** displays all affected invoices and totals, warning that customer deletion without cancellation violates GoBD / § 14b UStG.
        *   Upon confirmation, the system creates atomic GoBD Storno records (`ST-XXXX`) in the `invoices` collection and sets counterpart statuses to `invoice_cancelled`.
*   **Cascading Task & Calendar Cleanup (`SmartCustomerTable.tsx`, `logistics/page.tsx`, `calendar/page.tsx`, `ticketEngine.ts`)**:
    *   Archiving a customer now cascades atomically to all their orders (`status: 'archived'`, `isArchived: true`).
    *   `logistics/page.tsx` and `ticketEngine.ts` strictly filter out archived orders and tasks of archived customers, preventing completed or open tasks from lingering on the Logistics page.
    *   `calendar/page.tsx` ignores archived orders, keeping the dispatch calendar clean.

### Version 2.7.0 – Cockpit Financial Integrity, DST Calendar Math & Strict Accounting Segregation
*   **Inviolable UTC Calendar Math (`CustomerPremiumProfile.tsx` & `ticketEngine.ts`)**:
    *   Replaced local timestamp `Math.ceil(diffTime / 86400000)` with UTC calendar arithmetic (`Date.UTC(y, m, d)` and `Math.round`).
    *   Completely eliminates the Daylight Saving Time (DST Sommerzeit/Winterzeit) 1-hour shift bug that previously rounded a 40-day difference (40.04 days) up to 41 days.
*   **Cockpit 100% Progress Synchronization (`orderValidation.ts` & `taskStateController.ts`)**:
    *   In Phase 4, when an invoice is fully settled (`openAmount <= 0.01` or `status === 'invoice_paid'` / `completed`), both payment and handover protocol (`Übergabeprotokoll`) are marked as completed.
    *   Eliminates the contradiction where the header showed "Phase 4: Abgeschlossen & Bezahlt" while the progress bar was stuck at 67% (2 von 3 Aufgaben).
*   **Smart Dynamic Logistics Actions (`ticketEngine.ts` & `logistics/page.tsx`)**:
    *   Guaranteed that fully paid invoices never display "Zahlung erfassen" or stay in the "Offen" (open tasks) list.
    *   Four operational milestones feature dedicated smart dynamic states:
        1.  *Rechnung & Zahlung*: `Rechnung erstellen` if missing; `Zahlung erfassen (Offen: €X)` if unpaid; `Bezahlt ✓` (read-only audit) if paid.
        2.  *Halteverbotszone (HVZ)*: `HVZ planen` if unscheduled; `Als beantragt markieren` 1-click completion.
        3.  *Umzugskartons*: `Lieferung planen` if unscheduled; `Geliefert ✓` 1-click delivery.
        4.  *Besichtigung*: Marked complete immediately if `Durch Fotos` or if order is already confirmed/completed.
*   **Strict Accounting Segregation (No Storno in Cockpit Drawer)**:
    *   Removed GoBD lock warning banner and "Storno erstellen" buttons from `OrderDetailsDrawer.tsx`.
    *   The Cockpit is strictly reserved for operational delivery, logistics checklist, and PDF inspection. Storno cancellations belong exclusively inside the customer profile (`CustomerPremiumProfile.tsx` / `Kundenakte`) and finances module (`finances/page.tsx`).
*   **Order Wizard Ergonomics & In-App Modals (`OrderEditor.tsx`)**:
    *   Direct numeric input for item quantities (`Menge`) without requiring repeated clicks on plus button.
    *   Removed persistent sticky `0` from Netto price inputs.
    *   Hidden bottom navigation bar during modal dialogs to avoid UI overlap.
    *   Replaced native browser `window.confirm` dialogs with custom bilingual in-app modals with single-prompt cancellation.

### Version 2.6.0 – Wizard Flexibility, Empty Offer Guard & Network/Login Hardening
*   **Empty Offer Guard & Visual PDF Status (`CustomerPremiumProfile.tsx` & `OrderDetailsDrawer.tsx`)**:
    *   PDF preview buttons (`Angebot PDF` & `PDF`) automatically display in muted gray with an explicit `0 €` badge if the offer has no services or its price is `0,00 €`.
    *   Clicking an empty offer triggers an informative confirmation modal with 1-click jump to the editor (`Leistungen im Editor bearbeiten`) or explicit bypass (`Trotzdem PDF ansehen`), preventing unintentional transmission of empty 0€ quotes.
*   **Flexible 5-Step Order Wizard (`OrderEditor.tsx`)**:
    *   Disponents can freely jump to Step 3 (`Leistungen`) and Step 4 (`Inventar`) as soon as the customer's `Nachname` is entered, without being blocked by empty Step 2 (`Logistik`) address fields.
    *   Step 3 and Step 5 provide visual indicators and modal confirmations when saving offers with 0 services.
*   **Login Hardening & Brute-Force Rate Limiting (`page.tsx`)**:
    *   5 failed login attempts trigger an automatic 10-minute security lockout.
    *   Persistent countdown timer across page reloads via `localStorage` with bilingual alerts (German/Arabic).
*   **Network Watchdog & Database Timeout Guard (`NetworkMonitor.tsx` & `networkWatchdog.ts`)**:
    *   Real-time detection of connectivity drops and database request stalls.
    *   Data loss prevention on accidental page refresh during offline state (`beforeunload` listener).
*   **Production Deployment Cleanup**:
    *   Removed obsolete debug scripts, unused mockups, and ghost route handlers.
    *   Added standard `firestore.indexes.json`, `firebase.json`, `vercel.json`, and Next.js `global-error.tsx`.

### Version 2.5.0 – Stability, Claims-to-Finance Integration & Automated State Machine
*   **Claims & Invoicing Integration (`SettleClaimModal`)**:
    *   Direct settlement of customer complaints and damages against open invoices.
    *   Two compliant settlement paths:
        1.  `schaden_verrechnung`: Books an offset payment entry directly in `payments` without distorting the VAT taxable base (Echter Schadensersatz gem. § 1 Abs. 1 UStG).
        2.  `service_deduction`: Adds a negative item (`-X.XX €`) to `services` and recalculates net, tax (19%), and gross.
    *   Added `schaden_verrechnung` payment method in `PaymentManager.tsx`.
    *   Auto-closes claims to `status: 'Erledigt'` with audit linkage (`settledInvoiceNumber`, `settledAmount`, `settledAt`).
    *   Activity logging via `logActivity(..., 'SETTLE_CLAIM', ...)`.
*   **Event-Driven Kanban Pipeline**:
    *   Manual Drag & Drop is completely removed and replaced by strict event-driven state transitions (`orderStateMachine.ts`). Cards advance only when key milestones are verified.
*   **Contract Confirmation Hotfix**:
    *   `src/lib/orderStateMachine.ts` now fully recognizes `isManuallySigned`, `contractSigned`, and `additionalData.isManuallySigned` in addition to `externallyConfirmed` and `signatureOrder`, preventing silent rollback of confirmations.
*   **Webpack Production Stability**:
    *   Build script switched to `next build --webpack` to avoid Turbopack Google font download stalls.

### Version 2.4.0 – GoBD Accounting & Cancellation Engine
*   **GoBD-Compliant Storno Workflow (`StornoModal.tsx`)**:
    *   Dedicated cancellation number sequence (`ST-XXXX`).
    *   Immutable audit history in `invoiceHistory`.
    *   Counterpart rollback to `confirmed` so corrected invoices can be cleanly re-issued.
*   **DATEV-Export & Monthly Closing (`finances/page.tsx`)**:
    *   Automated ZIP bundles with all monthly PDFs and CSV accounting export for tax advisors.
*   **Free Invoices**:
    *   Stand-alone invoice support for material sales not tied to moving projects.

### Version 2.3.0 – On-Site Execution & Mobile Protocols
*   **Digital Acceptance Protocol (`ProtocolModal.tsx`)**:
    *   Client touch signature on tablets on moving day.
    *   Categories: Mängelfrei (completion), Gefahrenübergang (staircase risk), Zählerstände (utilities & keys).
*   **Team Laufzettel (`EmployeeSheetPDF.tsx`)**:
    *   Operational dispatch sheet for movers with addresses, access conditions, and special items.
*   **Calendar Resource Scheduling (`DispoModal.tsx`)**:
    *   Assignment of vehicles (3.5t, 7.5t LKW), team leaders, and helpers.

### Version 2.0.0 – 2.2.0 – Core Order Wizard & Estimation Foundation
*   **5-Step Order Wizard (`OrderEditor.tsx`)**:
    *   Step 1: Customer & Dates.
    *   Step 2: Logistics & Addresses.
    *   Step 3: Services & Pricing (Flat Rate vs. Hourly/Items).
    *   Step 4: Inventory ($m^3$) & Checklists.
    *   Step 5: Review & Document Generation.
*   **Google Maps Route Integration (`routeCalculator.ts`)**:
    *   Calculates real-world distance (km) and travel duration (minutes).
*   **Visual Inventory Calculator (`InventoryWizardModal.tsx`)**:
    *   Room-based furniture selection and automated cubic meter calculation.

---

## 3. Core Business & State Machine Rules (DO NOT BREAK)

### A. Order Status Flow (`orderStateMachine.ts`)
```
draft ──► quote ──► confirmed ──► completed ──► invoice_open ──► invoice_paid
  │         │           │             │               │
  └─────────┴───────────┴─────────────┴───────────────┴──► archived / canceled
```
*   **Transition to `confirmed` MUST have**:
    1.  `movingDateFrom` or `movingDateTo`.
    2.  Both addresses (Beladestelle A and Entladestelle B).
    3.  A signature OR external/manual confirmation (`signatureOrder`, `externallyConfirmed`, `isManuallySigned`, or `contractSigned`).
*   **Transition to `completed` MUST have**:
    1.  Signed protocol (`signatureProtocol` or entry in `protocols` array).
    2.  All Phase 4 action tickets completed.

### B. Invoicing & Collections
*   **Orders vs Invoices Collections**:
    *   `invoices` collection stores standalone and finalized invoices.
    *   `orders` collection also tracks `invoiceNumber`, `invoiceDate`, `status`, and `payments`.
    *   When updating payments, ALWAYS synchronize both `invoices` and counterpart `orders` documents via `writeBatch` (see `PaymentManager.tsx` and `SettleClaimModal.tsx`).
*   **Financial Calculations**:
    *   Always use `calculateOrderTotals(order)` from `@/lib/financeHelpers`.
    *   Always use `calculateOpenAmount(order)` to determine remaining open amounts.
    *   Never modify an issued invoice's amounts directly without generating a Storno (`ST-XXXX`) or recording a documented settlement.

### C. UI & UX Guidelines
*   **No Drag & Drop on Kanban**: The Kanban columns (`neu`, `verhandlung`, `bestaetigt`, `abgeschlossen`) are strictly calculated and populated based on order status and logistics evaluation. Do not add drag-and-drop unless requested.
*   **Modal History**: Always use `useModalBackHandler` on mobile modals so pressing Android/browser back closes the modal rather than navigating away.

### D. Inviolable Calendar Math (DST Immunity)
*   **NEVER use local date millisecond division with `Math.ceil`**: In Germany/Europe, Daylight Saving Time (DST) changes in late March and late October. When crossing a DST boundary, local millisecond difference is off by $\pm 1$ hour (e.g. 40 days + 1 hour = 40.04 days), and `Math.ceil(40.04)` falsely yields 41 days!
*   **ALWAYS use UTC calendar arithmetic**:
    ```ts
    const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const utcTarget = Date.UTC(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffDays = Math.round((utcTarget - utcToday) / (1000 * 60 * 60 * 24));
    ```

### E. Cockpit vs. Customer Folder Separation of Concerns
*   **Cockpit Drawer (`OrderDetailsDrawer.tsx`)**: Strictly operational. Shows moving route, team/vehicle dispatch, logistical checklist status, and a button to view the official invoice PDF (`Rechnung ansehen`).
*   **Customer Profile (`CustomerPremiumProfile.tsx`)**: Contains full financial administration and GoBD accounting workflows (issuing invoices, payments, and GoBD Storno cancellation). Never leak Storno or accounting lock banners into the operational Cockpit!
*   **Progress Bar Synchronization**: When an order is completed and fully paid, all Phase 4 items (`invoice`, `protocol`, `payment`) must evaluate to 100% completed so the progress bar never contradicts the completed badge.

---

## 4. Deployment & Security Guidelines
*   **Production Build Target**: `npm run build` is configured to `next build --webpack` to avoid Turbopack font download stalls.
*   **Firebase Admin Credentials**:
    *   Do NOT upload or commit `serviceAccountKey.json`.
    *   In Vercel or cloud environments, populate the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable as a single JSON string.
    *   Alternatively, populate `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` individually.
*   **TypeScript Verification**:
    *   Always verify with `npx tsc --noEmit` before triggering a deployment build.

