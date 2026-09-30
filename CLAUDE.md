# Rothirsch Umzug App – Claude Code Instructions & Architecture Guide

This file provides direct, actionable instructions and guidelines for Claude Code and AI assistants working on the **Rothirsch Umzug** enterprise application.

---

## 1. Quick Commands
* **Run Development Server**: `npm run dev` (Runs on `http://localhost:3000`)
* **Type Check**: `npx tsc --noEmit` (Always verify before committing)
* **Production Build**: `npm run build` (Executes `next build --webpack` to avoid font timeout issues)
* **Linting**: `npm run lint`

---

## 2. Tech Stack & Environment
* **Framework**: Next.js 16.2.6 (App Router, Server & Client Components).
* **UI & Styling**: React 19.2.4, Tailwind CSS v4, Lucide React icons.
* **Database & Auth**: Google Cloud Firestore & Firebase Auth (Firebase SDK v12).
* **Server Operations**: Firebase Admin SDK (`src/lib/firebaseAdmin.ts`).
* **PDF Engine**: `@react-pdf/renderer` for quotes, invoices, and employee work sheets.

---

## 3. Deployment & Environment Variables
For production deployment (e.g. Vercel):
* **Client Variables** (`.env.local` / Vercel Environment):
  * `NEXT_PUBLIC_FIREBASE_API_KEY`
  * `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  * `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  * `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  * `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  * `NEXT_PUBLIC_FIREBASE_APP_ID`
* **Admin Variables** (Server-side):
  * `FIREBASE_SERVICE_ACCOUNT_KEY`: Full JSON string of the Firebase Admin service account credentials.
  * *OR* separate keys: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
* ⚠️ **Security Warning**: `serviceAccountKey.json` is strictly ignored by `.gitignore` and must NEVER be committed to Git.

---

## 4. Core Business Rules & Architecture (DO NOT BREAK)

### A. Strict Event-Driven State Machine (`src/lib/orderStateMachine.ts`)
* **Pipeline Flow**:
  `draft` ──► `quote` ──► `confirmed` ──► `completed` ──► `invoice_open` ──► `invoice_paid`
* **Transition to `confirmed` requires**:
  1. `movingDateFrom` or `movingDateTo`.
  2. Both addresses (Beladestelle A and Entladestelle B).
  3. Valid confirmation: `signatureOrder`, `externallyConfirmed`, `isManuallySigned`, or `contractSigned`.
* **Transition to `completed` requires**:
  1. Signed acceptance protocol (`signatureProtocol` or entry in `protocols` array).
  2. All Phase 4 action tickets marked as completed.
* **NO Drag & Drop on Kanban**: Kanban columns (`neu`, `verhandlung`, `bestaetigt`, `abgeschlossen`) are automatically derived from the order state machine and logistical checks. Do not re-introduce drag-and-drop.

### B. Invoicing, GoBD Compliance & Collections
* **Collections Dual-Sync**:
  * Finalized invoices exist in the `invoices` collection, but counterpart tracking exists in `orders`.
  * When updating payments or settling claims, ALWAYS update both collections simultaneously using a Firestore `writeBatch` (see `PaymentManager.tsx` and `SettleClaimModal.tsx`).
* **Calculations**:
  * Always use `calculateOrderTotals(order)` from `@/lib/financeHelpers`.
  * Always use `calculateOpenAmount(order)` to determine open balance.
* **Claims Settlement (`SettleClaimModal.tsx`)**:
  * Two valid paths:
    1. `schaden_verrechnung`: Books an offset payment entry in `payments` (§ 1 Abs. 1 UStG).
    2. `service_deduction`: Adds a negative item (`-X.XX €`) to `services` and recalculates net/tax/gross.
* **Storno Workflow (`StornoModal.tsx`)**:
  * Invoices cannot be silently modified. To alter an issued invoice, generate a Storno (`ST-XXXX`) and roll the counterpart back to `confirmed`.

### C. UI / Mobile UX Conventions
* **Modal Back Handling**: Always wrap modal components with `useModalBackHandler` so the browser/Android back button closes the active modal instead of navigating away.
* **Theme Support**: The UI supports seamless Light Mode and Dark Mode. Respect semantic color tokens.

---

## 5. Additional Documentation
* **Comprehensive Agent Guidelines**: See [AGENTS.md](file:///c:/Users/PC-Bashar/OneDrive%20-%20hs-bochum.de/Dokumente/Rothirsch%20App/AGENTS.md)
* **Detailed User Manual (German)**: See [Manualbuch.md](file:///c:/Users/PC-Bashar/OneDrive%20-%20hs-bochum.de/Dokumente/Rothirsch%20App/Manualbuch.md)
