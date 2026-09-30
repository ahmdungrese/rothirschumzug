# Rothirsch Umzug – Enterprise ERP & Logistics Suite

![Rothirsch Logo](public/login-logo.png)

A modern, high-performance ERP and logistics management application purpose-built for German moving and relocation companies (*Umzugsunternehmen*).

---

## 🚀 Key Features

* **Event-Driven Kanban Pipeline**: Automated status progression from incoming quote request to final settlement based on verified milestones (`orderStateMachine.ts`).
* **5-Step Order Wizard**:
  * Step 1: Customer details & date management.
  * Step 2: Route calculation via Google Maps API, floor levels, carrying paths, and parking permits (Halteverbotszone).
  * Step 3: Dynamic service catalog with flat-rate or hourly/itemized pricing models.
  * Step 4: Visual room-by-room inventory calculator ($m^3$) and logistics checklist.
  * Step 5: Instant preview and document generation.
* **On-Site Mobile Operations**:
  * Digital touch-signed protocols on tablets (`ProtocolModal.tsx`).
  * Operational dispatch sheets (*Laufzettel*) for moving crews (`EmployeeSheetPDF.tsx`).
* **GoBD-Compliant Accounting & Finance**:
  * Dual-sequence document numbering (Offers, Orders, Invoices).
  * Storno cancellation workflow (`ST-XXXX`) with counterpart rollbacks.
  * DATEV-export bundle (ZIP with all monthly PDFs and CSV accounting sheet for tax advisors).
  * Standalone material sales & free invoices.
* **Integrated Claims & Damage Management (`v2.5.0`)**:
  * Automated settlement against open invoices via tax-compliant damage offsetting (`schaden_verrechnung`) or service deduction (`service_deduction`).

---

## 🛠️ Tech Stack

* **Framework**: Next.js 16.2.6 (App Router)
* **Frontend**: React 19.2.4, Tailwind CSS v4, Lucide React
* **Database & Auth**: Google Cloud Firestore & Firebase Auth (SDK v12)
* **Server Operations**: Firebase Admin SDK
* **PDF Rendering**: `@react-pdf/renderer`

---

## 💻 Getting Started

### 1. Prerequisites
* Node.js 18+ or 20+
* NPM, Yarn, or PNPM

### 2. Environment Configuration
Create a `.env.local` file in the root directory:

```env
# Client Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Server-Side Firebase Admin (Alternative to serviceAccountKey.json)
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

### 3. Installation & Run
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run type check
npx tsc --noEmit

# Build for production
npm run build
```

---

## 📖 Documentation & Guidelines

* [CLAUDE.md](CLAUDE.md) – Instructions and core conventions for AI pair programmers.
* [AGENTS.md](AGENTS.md) – Deep architecture manual, version history, and state machine specifications.
* [Manualbuch.md](Manualbuch.md) – Official German user manual with UI walkthrough and button explanations.

---

## 🔒 Security & Deployment Notes

* The `serviceAccountKey.json` file contains private service credentials and is strictly excluded via `.gitignore`.
* In production platforms like **Vercel**, supply credentials via the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable.
