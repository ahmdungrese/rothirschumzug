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

### Version 2.18.0 (Current) – Official IONOS (1&1) SMTP Mail Engine & 1-Click Offer/Invoice Sending
*   **Team Access In-Line Validation & App DNA Parity (`TeamAccessManager.tsx`)**:
    *   Integrated full App DNA real-time field validation matching the login page (`page.tsx`) with contextual German notices.
    *   Name validation (min 2 chars), strict phone/email regex formatting, and 6-character password/PIN enforcement.
    *   Dynamic visual styling with red borders (`border-red-500/80`), `ExclamationTriangleIcon`, and instant clearing on keystroke.
    *   Clean German error mapping for Firebase Auth (`auth/email-already-in-use`, `auth/invalid-email`, `auth/weak-password`, `permission-denied`).
*   **Official IONOS E-Mail Suite (`settings/page.tsx`, `/api/email/send`)**:
    *   Added dedicated **IONOS E-Mail-Postfach (SMTP)** configuration panel in `Einstellungen > E-Mail (IONOS) & Kalender`.
    *   Pre-configured with German standard parameters for IONOS (`smtp.ionos.de`, Port 465 SSL/TLS, `info@rothirsch-umzug.de`, Absendername `Rothirsch Umzüge`).
    *   Password field with secure show/hide toggle and persistent Firestore encryption in `system/settings`.
    *   **Automatic BCC Loop to Self (`info@rothirsch-umzug.de`)**: Guaranteed visibility in Outlook and smartphone mail clients for all sent customer communications.
    *   **1-Click Test-E-Mail Button**: Instant connection verification directly contacting IONOS servers with clear German status reports.
*   **Direct In-App E-Mail Action Hub (`CustomerPremiumProfile.tsx`, `MessageSenderModal.tsx`)**:
    *   Integrated `E-Mail senden` into the Customer Profile Action Hub (`•••` dropdown menu) across all project phases.
    *   Dynamically auto-selects appropriate templates (e.g. `t3 - Angebot schicken` or `t9 - Rechnung schicken`), compiles the matching PDF document on the fly, and attaches it automatically.
*   **Resilient Email Backend Route (`/api/email/send/route.ts`)**:
    *   Added JWT fallback verification to prevent serverless authentication crashes when Admin SDK credentials are uninitialized.
    *   Supports text-only and attachment-backed emails up to 15 MB.

### Version 2.17.1 – Protected Nummernkreise Starting Ranges & Resilient Database Purge
*   **Configurable Starting Document Ranges (`settings/page.tsx`)**:
    *   **Protected Invoice Start Number (`Nächste Rechnungsnummer`)**: Rendered gray/protected by default with lock badge to prevent accidental modifications during day-to-day operations. Includes an interactive `[✏️ Anpassen]` unlock toggle allowing disponents to freely define custom start numbers (e.g., migrating 45 existing invoices from a previous system).
    *   **Offer Start Number (`Nächste Angebotsnummer`)**: Freely editable with proactive amber notice reminding disponents to click "Speichern" above to commit the new sequence.
    *   **Order Start Number (`Nächste Auftragsnummer`)**: Configurable starting number for confirmed customer orders.
*   **Guaranteed Client-Side Database Reset Engine (`ResetDatabaseModal.tsx`)**:
    *   Implemented direct Firestore batch deletion fallback (400 docs/batch) for `customers`, `orders`, `invoices`, `claims`, `activity_logs`, and `time_entries`.
    *   Eliminated Vercel serverless dependency failures when Google Admin SDK credentials are uninitialized.
    *   Successfully resets all counters in `system/settings` back to 1 and reloads active sessions cleanly.

### Version 2.17.0 – Universal 1-Click Mobile Calendar Sync & Outlook/Samsung Integration
*   **Universal RFC 5545 iCalendar Engine (`src/lib/calendarExport.ts`)**:
    *   Created standalone `.ics` calendar generator supporting **Samsung Calendar**, **Microsoft Outlook** (App, Desktop & Web), Google Calendar, and Apple Calendar.
    *   No expensive Office 365 enterprise licenses or Azure Graph API setup required: uses universal UTF-8 iCalendar standard.
    *   Encodes contextual Emojis and Categories directly in titles (🚚 Umzug, 📋 Besichtigung, ⛔ Halteverbot, 📦 Kartonlieferung, 🏗️ Möbellift).
    *   Includes turn-by-turn navigation addresses (A ➔ B), clickable customer phone numbers (`tel:`), order volume ($m^3$), assigned helpers and trucks, and direct app deep links in the event description.
*   **Ergonomic 1-Click Calendar Actions Across Operations**:
    *   **Order Cockpit (`OrderDetailsDrawer.tsx`)**: Added `+ Kalender` direct export buttons in the header metrics card for moving dates, in Phase 1 & 2 for inspection appointments, and in Phase 3 for logistics tasks (Kartons, HVZ, Möbellift).
    *   **Task Scheduling Modal (`TaskScheduleModal.tsx`)**: Added `In Kalender` button in the modal footer allowing disponents to export appointments directly to their smartphone while scheduling.
    *   **Calendar & Resource Dispatch (`DispoModal.tsx`)**: Added `Tag in Kalender exportieren` batch button in the header KPI row and individual `+ Kalender` buttons for each scheduled moving order and inspection.
    *   **Customer Profile Action Hub (`CustomerPremiumProfile.tsx`)**: Integrated `In Kalender eintragen` into the contextual `•••` action dropdown menu across all project phases.
*   **Settings Overhaul for Smartphone & Calendar Integration (`settings/page.tsx`)**:
    *   Replaced the previous misleading Microsoft Graph API mockup with an interactive test export tool and clear instructions for Samsung Galaxy and Outlook smartphones.

### Version 2.16.4 – Direct Testing Phase Access & Database Reset Restoration
*   **Removal of PIN Protection in Settings (`settings/page.tsx`)**:
    *   Completely eliminated the 4-digit PIN barrier from the "System & Finanzen" settings tab.
    *   Steuersätze, Mahngebühren, Angebots- und Rechnungsnummernkreise sowie der Entwickler-Bereich sind nun während der Testphase direkt und ohne Hürden zugänglich.
*   **Restoration of Resilient Database Reset (`/api/reset-database`, `ResetDatabaseModal.tsx`)**:
    *   Updated `verifyAdmin` helper to support resilient JWT session decoding when serverless environments lack Google Cloud Admin keys.
    *   Permitted tester and admin roles to execute complete database resets during the testing phase.

### Version 2.16.3 – Resilient Online PIN Verification & Service Worker API Bypass
*   **Resilient Online PIN Verification Engine (`/api/admin/verify-pin`)**:
    *   Added JWT session fallback decoding: If Google Cloud Firebase Admin credentials (`FIREBASE_SERVICE_ACCOUNT_KEY`) are uninitialized in serverless/cloud environments, the endpoint now safely decodes and validates non-expired client JWTs instead of crashing with HTTP 500.
    *   Defensive Firestore check: Non-blocking role evaluation that supports tester, admin, and office roles while preserving brute-force rate-limiting (5 attempts / 10-minute lock).
*   **Service Worker API & Method Bypass (`public/sw.js`)**:
    *   Explicitly bypassed all `/api/*` routes and non-GET requests in the Service Worker fetch listener, preventing PWA offline cache errors on POST requests.
*   **Settings PIN Protection Ergonomics (`settings/page.tsx`)**:
    *   Added session verification (`auth.currentUser`), safe JSON parsing, and a visual loading state ("Prüfe...") to prevent UI lockups and double-submissions.

### Version 2.16.2 – Universal Native Validation Shield & Service Worker Cache Purge
*   **Password Field App DNA Parity & Browser Popup Shield (`src/app/page.tsx`)**:
    *   Added explicit `onInvalid={(e) => e.preventDefault()}` on `<form>` and input elements to defensively suppress all native browser validation balloons.
    *   Configured `autoComplete="off"`, `data-lpignore="true"`, and `spellCheck={false}` to prevent third-party credential managers and browser suggestion bubbles from overlaying input fields.
    *   Added 6-character minimum client validation with instant in-line App DNA feedback and coupled credential failure response directly to `passwordError`.
*   **PWA Cache Invalidation & Client Claim (`public/sw.js`, `PwaRegister.tsx`)**:
    *   Bumped Service Worker cache to `rothirsch-erp-v2.16.2`.
    *   Added `activate` event handler to automatically purge obsolete cache versions and force-claimed active clients via `clients.claim()` and `skipWaiting()`.

### Version 2.16.1 – Login Security Hardening, App DNA Validation & German-Only Messages
*   **Decoupled Client Validation from Server Rate Limiting (`src/app/page.tsx`)**:
    *   Syntactically invalid inputs (empty fields, malformed characters such as `edwsfdfasgereremmmujz`) are now intercepted client-side and do not trigger a backend authentication request.
    *   Failed attempt counter and exponential backoff are strictly incremented only upon authentic credential failure (`auth/invalid-credential`, `auth/wrong-password`, `auth/user-not-found`) returned by the authentication server.
*   **Custom App DNA Validation UI**:
    *   Added `noValidate` to form to disable browser-native validation tooltips.
    *   Integrated native Rothirsch design system feedback: highlighted input borders, contextual error icons, and in-line validation messages for email and password fields.
*   **100% German Language Parity for Security & Lockout Alerts**:
    *   Purged all foreign/multilingual text artifacts from security banners, countdown timers, and rate-limit warnings.
    *   Standardized clear, professional German notifications for security lockouts, server rate limits, network errors, and remaining login attempts.

### Version 2.16.0 – Universal Claims Reporting Hub & Automated Protocol Damage Intake
*   **Central Claims Creation Hub (`claims/page.tsx`, `ClaimModal.tsx`)**:
    *   Integrated a prominent "+ Neue Reklamation" action directly in the central claims dashboard (`/dashboard/claims`).
    *   Multi-mode intake: Allows disponents to search and select any customer in the database and bind the claim to any of their specific orders/offers (`AU-...`, `AN-...`) or file a general claim.
    *   Enhanced `ClaimCard` with order number pill badges (`#AU-...`) and origin tags (`Protokoll`).
*   **Customer Profile Action Hub Integration (`CustomerPremiumProfile.tsx`, `customers/[id]/page.tsx`)**:
    *   Added dedicated "Schaden / Reklamation melden" trigger to the contextual `•••` action dropdown menu across all project phases.
    *   Automatically pre-populates customer details and the active order context for 1-click filing.
*   **Zero-Double-Entry Protocol Damage Automation (`ProtocolModal.tsx`)**:
    *   Saving an on-site handover or acceptance protocol of type "Mängel- & Schadensfeststellung" (or any damage/defect description) automatically generates a synchronized ticket in `claims`.
    *   Links customer, order number, signed protocol ID, and defect descriptions seamlessly without requiring manual re-entry.

### Version 2.15.0 – Layout Frame Docking, Zero-Collision Bottom Navigation & Mobile Signature Compression
*   **Integrated Layout Frame Docking (`BottomNav.tsx`, `layout.tsx`)**:
    *   Docked `BottomNav` directly as an integral flex child within the main application frame instead of a viewport-floating overlay (`fixed bottom-0`).
    *   `<main>` viewport strictly terminates above `BottomNav`, guaranteeing zero content clipping, overlapping, or hidden elements across mobile devices.
    *   Automatically suppresses `BottomNav` across dedicated full-screen wizard and editor routes (`/edit-order`, `/new-offer`, `/new-invoice`, `/edit-invoice`, `/orders/new`, `/inventory`).
*   **High-Priority Modal Elevation & Dock Shield (`KartonConfigModal.tsx`, `OrderEditor.tsx`, `PaymentManager.tsx`, etc.)**:
    *   Elevated all application modals (`KartonConfigModal`, `ProtocolModal`, `SignatureModal`, `PaymentManager`, `TaskScheduleModal`, `MessageSenderModal`, `StornoModal`) to `z-[100]`.
    *   Suppressed the docked action bar in `OrderEditor.tsx` when `isKartonModalOpen` is active, completely resolving modal footer blocking.
*   **High-DPI Signature Compression Engine (`SignatureModal.tsx`, `ProtocolModal.tsx`)**:
    *   Introduced an offscreen canvas compression pipeline that downsamples high-DPI smartphone signatures to a crisp max 500px width (JPEG/PNG ~15–25 KB).
    *   Eliminated Firestore's 1MB document limit violation that crashed writes on mobile devices.
    *   Wrapped canvas trimming in defensive fallbacks to eliminate `IndexSizeError` and `getTrimmedCanvas` failures.
*   **Dual-Signer Support & Non-Blocking Protocol Engine (`ProtocolModal.tsx`, `firestore.rules`)**:
    *   Added instant signer role toggle between `Auftraggeber (Kunde)` and `Auftragnehmer (Teamleiter)` with dedicated watermark lines and metadata tagging.
    *   Isolated background task auto-completion (`autoCompletePreMoveTasks`) into a non-blocking safe block to prevent protocol submission aborts.
    *   Updated `firestore.rules` to permit field workers/teamleaders to record customer and contractor digital signatures, protocols, and task states on site.

### Version 2.14.0 – Cockpit Resource Dispatching, Dual-HVZ Scheduling & Orders Pipeline Retention
*   **Order Wizard Step 5 Action Hub Ergonomics (`OrderEditor.tsx`)**:
    *   Eliminated confusing redundant "PDF drucken / sichern" and screenshot-based action buttons.
    *   Connected the offer preview card directly to the official interactive `PdfModal` displaying the actual offer document.
    *   Unified bottom action bar into a clear "Angebot abschließen" trigger and added subtle persistent "☁️ Als Entwurf gesichert" indicator.
*   **Cockpit Resource Dispatch & Phase 3 100% Milestone (`OrderDetailsDrawer.tsx`)**:
    *   Added dedicated "Fahrzeug & Team (Disposition)" card directly inside the Cockpit logistics phase.
    *   Inline counter buttons to increment/decrement and assign helpers and trucks (3.5t / 7.5t) on the fly with direct Firestore synchronization.
    *   Interactive progress counter tooltip indicating pending disposition before hitting 100%.
*   **Smart Logistics Scheduling Logic & Dual-HVZ Support (`TaskScheduleModal.tsx`, `taskStateController.ts`, `CustomerPremiumProfile.tsx`)**:
    *   Restricted "Kartonlieferung planen" to only appear when carton boxes are actually part of the order/services.
    *   Expanded HVZ location scheduling to support `Auszugsort (A)`, `Einzugsort (B)`, and `Beide Orte (A & B)` with dynamic address breakdown.
    *   Ensured offer PDF button remains permanently accessible across all 4 customer lifecycle phases.
*   **Complete Orders & Invoices Pipeline Retention (`orders/page.tsx`)**:
    *   Removed restrictive Firestore status filters that dropped completed, billed, and paid orders.
    *   Updated the `Abgeschlossen` filter tab to accurately include all finalized, invoiced, and settled orders (`invoice_paid`, `invoice_open`, `completed`).
    *   Enhanced status badges to clearly distinguish `Bezahlt ✓` (emerald), `Abgeschlossen`, and `Teilw. bezahlt`.

### Version 2.13.0 – Universal Template Synchronization, Dynamic Protocols & Mobile Signature Engine
*   **Unified Master Communication & WhatsApp Templates Engine (`communicationDefaults.ts`, `settings/page.tsx`, `CustomerPremiumProfile.tsx`)**:
    *   Elevated all **17 operational moving templates** to official system master standard templates across all 7 stages (`Erstkontakt`, `Besichtigung`, `Angebot`, `Nachfassen`, `Auftrag`, `Logistik`, `Abrechnung`, `Nachbereitung`).
    *   Unified IDs and dynamic overlay: Templates edited or created in `Einstellungen > Nachrichten-Vorlagen` instantly propagate across WhatsApp modals and customer profiles with 100% bidirectional parity.
    *   Comprehensive placeholder substitution engine supporting `{{Kunde_Anrede}}`, `[Anrede]`, `{{Kunde_Name}}`, `[Name]`, `{{Kunde_Nachname}}`, `[Nachname]`, `{{Umzugsdatum}}`, `[Datum]`, `{{Angebot_Summe}}`, `[Summe]`, `{{Auftragsnummer}}`, `[Auftrag]`, `{{Rechnungsnummer}}`, `[Rechnung]`, and `{{Sachbearbeiter}}`, `[Mitarbeiter]`.
*   **100% Protocol Parity between Settings & Customer Cockpit (`protocolDefaults.ts`, `ProtocolModal.tsx`, `settings/page.tsx`)**:
    *   Standardized all 6 core protocol categories (`Abnahme ohne Mängel`, `Gefahrenübergang / Haftungsausschluss`, `Mängel- & Schadensfeststellung`, `Zählerstände & Schlüsselübergabe`, `Besichtigungsprotokoll`, `Sondervereinbarung / Zusatzarbeiten`) and standard quick-snippets.
    *   Dynamic protocol synchronization: `ProtocolModal` loads categories and snippets directly from Firestore settings, with fallback to master defaults. Creating or editing categories in settings immediately appears in customer profiles.
*   **Dynamic Standard-Texte & AGB Engine (`textDefaults.ts`, `settings/page.tsx`, `OrderPDF.tsx`)**:
    *   Added 1-click **"Standard laden"** button in `Einstellungen > Textbausteine & AGB` to instantly restore standard quote, order, invoice, insurance texts, and full 12-paragraph § 1 to § 12 AGBs.
    *   **Offer Page 2 Custom Titles & Text Blocks**: Added explicit management for `Versicherungsschutz` (title & text) and `Verbindliche Beauftragung` (title & confirmation text directly above customer signature), fully synchronized with `OrderPDF.tsx`.
*   **Dynamic Default Payment Method Engine (`paymentDefaults.ts`, `settings/page.tsx`, `OrderEditor.tsx`, `InvoiceEditor.tsx`)**:
    *   Enabled 1-click **"☆ Als Standard festlegen"** for any payment method: automatically flags `isDefault: true`, reorganizes order priority to index 0, and assigns it as the automatic default payment method for all new quotes and invoices.
    *   Added 1-click **"Standard laden"** button for payment methods: instantly restores the 3 official master moving company payment methods (`Überweisung`, `Barzahlung`, `Echtzeit-Überweisung`) with all their legally compliant texts, terms, and due days.
*   **Cockpit Drawer Infinite Scroll Jitter & Layout Thrashing Fix (`OrderDetailsDrawer.tsx`)**:
    *   Identified and resolved the violent scroll jitter bug where scrolling down inside Cockpit (especially Phase 3 with long checklists) caused the view to endlessly vibrate, stutter, and bounce back to the top.
    *   **Root Cause**: The dynamic `isScrolled` collapse logic triggered when `scrollTop > 30px`, shrinking the header by 70px. This expansion of the scroll container dropped `scrollTop` back below 30px, immediately re-expanding the header, creating a 60 FPS layout thrashing loop.
    *   **Resolution**: Eliminated the unstable dynamic header resizing and `onScroll` state mutations. Established a rock-solid, stable layout with fixed-height header metrics and smooth, uninterrupted scrolling.

### Version 2.12.0 – Native Mobile Ergonomics & Field Logistics Suite
*   **Auto-Hide Bottom Navigation on Scroll (`BottomNav.tsx`)**:
    *   Scroll-direction listener automatically hides bottom navigation bar when scrolling down to give maximum vertical screen space for checklists and lists, and restores it instantly upon upward scroll.
    *   Subtle tactile feedback (`triggerHaptic('light')`) on tab navigation.
*   **One-Tap Turn-by-Turn GPS Navigation for Addresses A & B (`OrderDetailsDrawer.tsx`)**:
    *   Direct `Navi` action buttons rendered in the Route header card and within Auszug (A) and Einzug (B) checklist rows.
    *   Opens native Google / Apple Maps turn-by-turn navigation directly with destination address preloaded.
*   **Mobile Bottom Sheets Architecture with Touch Drag Handles**:
    *   Converted centered desktop dialogs into native bottom-sheet modals with top drag handles (`w-12 h-1.5`) across:
        *   Customer edit modal (`customers/[id]/page.tsx`)
        *   Payment management modal (`PaymentManager.tsx`)
        *   Logistics task scheduling modal (`TaskScheduleModal.tsx`)
        *   Digital signature & contract scan modal (`SignatureModal.tsx`)
        *   Handover & acceptance protocol modal (`ProtocolModal.tsx`)
        *   Cockpit logistics drawer (`OrderDetailsDrawer.tsx`)
*   **Native Camera Capture with Client-Side Compression (`SignatureModal.tsx`)**:
    *   Instant photo capture directly via smartphone camera (`capture="environment"`) for physically signed contracts and acceptance documents with client-side canvas compression.
*   **Floating Action Button (FAB) for Quick Offer Creation (`KanbanDispositionBoard.tsx`, `orders/page.tsx`)**:
    *   Sleek mobile FAB (`+`) docked comfortably in the thumb-zone (`bottom-20 right-4`) for 1-tap quote creation on the go.
*   **Haptic Feedback Engine (`src/lib/haptics.ts`)**:
    *   Tactile vibration responses for saving operations, payments, signatures, and navigation.

### Version 2.11.0 – Mobile First Architecture & Responsive Experience Overhaul
*   **Tages-Planung & Ressourcen Padding Fix (`DispoModal.tsx`)**:
    *   Resolved mobile clipping where bottom content of the resource dispatch modal was trapped under the bottom navigation bar.
    *   Elevated modal container z-index to `z-[70]` (above bottom nav `z-50`) with dynamic viewport sizing (`max-h-[calc(100dvh-4.5rem)]`) and generous `pb-32` bottom padding for smooth scrolling.
*   **Official Video/Online Viewing Option (`TaskScheduleModal.tsx`, `OrderEditor.tsx`, `taskStateController.ts`)**:
    *   Added `Video-Besichtigung / Online-Besichtigung` alongside on-site viewing in Step 1 of the Order Wizard, logistics task scheduling modals, and state updates.
    *   Saved in `orderMeta.viewingType` and `logistics.viewingType` (`vor_ort` vs `online`).
*   **Responsive Mobile Sidebar Fix (`Sidebar.tsx`)**:
    *   Fixed the oversized empty drawer on phones where only centered icons were visible without titles.
    *   Integrated clear navigation labels alongside icons with balanced `gap-3 px-3.5 py-2.5` padding.
*   **Customer Lead Source Badge & Tracking (`customers/[id]/page.tsx`, `CustomerPremiumProfile.tsx`)**:
    *   Added `source` (Herkunft) tracking field with quick-select datalist options (`Website / Formular`, `Google Suche`, `Empfehlung`, `Check24`, `Kleinanzeigen`, `Telefon / Kaltakquise`).
    *   Rendered as an informative styled badge in the customer profile header.
*   **Network Disconnect Resilience & Debounced Heartbeat (`NetworkMonitor.tsx`)**:
    *   Eliminated spurious "Keine Verbindung zum Server" error notifications when switching between apps on mobile.
    *   Added 3500ms disconnect debounce and automated instant reconnection checks on window `focus` and `visibilitychange`. Tab background pings suspended while inactive.
*   **Dynamic Payment Methods Management (`settings/page.tsx`)**:
    *   Transformed static payment settings into a dynamic array with `+ Neue Zahlungsart` creation, custom naming, and deletion.
*   **Standard Communication & Protocol Templates Engine (`settings/page.tsx`)**:
    *   Expanded standard communication templates to cover all 10 stages (`Erstkontakt`, `Besichtigung`, `Angebot`, `Bestätigung`, `Erinnerung`, `Rechnung`, `Feedback`, etc.) with 1-click restore.
    *   Provided full CRUD template management for on-site acceptance and hand-over protocols.
*   **Flexible Customer Profile Form Validation (`customers/[id]/page.tsx`)**:
    *   Removed `required` constraint on `Vorname` and added `noValidate` on forms, enabling one-name individuals and commercial/business clients to save without browser validation blocks.
*   **Compact Action Hub & Collapsible Cockpit Header (`CustomerPremiumProfile.tsx`, `OrderDetailsDrawer.tsx`)**:
    *   Consolidated customer action buttons and cards into a compact 3-column row (`Angebot PDF`, `WhatsApp`, `Digital signieren`).
    *   Order Cockpit Drawer features a compact single-row header and scroll-aware collapsing (`isScrolled`) that shrinks summary cards and hides phase selectors on upward scroll to prioritize logistics checklist visibility.
*   **Zero-Overflow Responsive Mobile Cards for Orders & Finances (`orders/page.tsx`, `finances/page.tsx`)**:
    *   Hidden large vertical KPI stat blocks on mobile (`hidden sm:grid`) to instantly surface search filters and listings.
    *   Converted wide horizontal-scrolling desktop tables into responsive, single-column Mobile Cards with direct PDF previews, payment triggers, status badges, and action dropdowns.
*   **Smart Dashboard Default Tab Auto-Selection (`KanbanDispositionBoard.tsx`)**:
    *   Changed initial mobile tab default from empty `bestaetigt` to `neu`, with automated non-empty column detection.

### Version 2.10.1 – Wizard Auto-Save Engine, Step 5 Action Hub Unification & PDF Safe-Persist Guard
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

