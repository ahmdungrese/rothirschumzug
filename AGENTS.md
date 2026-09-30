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

---

## 2. Versionen-Historie & Changelog (Changelog by Versions)

### Version 2.5.0 (Current) – Stability, Claims-to-Finance Integration & Automated State Machine
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

---

## 4. Deployment & Security Guidelines
*   **Production Build Target**: `npm run build` is configured to `next build --webpack` to avoid Turbopack font download stalls.
*   **Firebase Admin Credentials**:
    *   Do NOT upload or commit `serviceAccountKey.json`.
    *   In Vercel or cloud environments, populate the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable as a single JSON string.
    *   Alternatively, populate `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` individually.
*   **TypeScript Verification**:
    *   Always verify with `npx tsc --noEmit` before triggering a deployment build.

