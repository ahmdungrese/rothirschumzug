# Rothirsch App – Benutzerhandbuch & Manualbuch

Willkommen im offiziellen Benutzerhandbuch der **Rothirsch Umzug App**. In diesem Handbuch wird jede Schaltfläche (Taste), jedes Eingabefeld und jede Interaktionsmöglichkeit im System kurz und präzise erklärt.

---

## Inhaltsverzeichnis
1. [Systemweiter Header & Navigation](#1-systemweiter-header--navigation)
2. [Zentrale Disposition (Dashboard)](#2-zentrale-disposition-dashboard)
3. [Einsatzplanung (Kalender)](#3-einsatzplanung-kalender)
4. [Kunden Control Center & Kundenprofil](#4-kunden-control-center--kundenprofil)
5. [Angebotserstellung & Bearbeitung (Order Wizard)](#5-angebotserstellung--bearbeitung-order-wizard)
6. [Finanzverwaltung & Rechnungs-Editor](#6-finanzverwaltung--rechnungs-editor)
7. [Zentrale Reklamationen (Schadensverwaltung)](#7-zentrale-reklamationen-schadensverwaltung)
8. [Archiv & System-Einstellungen](#8-archiv--system-einstellungen)

---

## 1. Systemweiter Header & Navigation

Der Header befindet sich am oberen Rand jeder Seite, während die Seitenleiste (Sidebar) auf Desktop-Geräten links fixiert ist und auf Mobilgeräten ausgeklappt werden kann.

*   **Menü-Schaltfläche (Burgermenü - nur mobil)**:
    *   *Aktion*: Öffnet/schließt die Navigationsleiste auf Smartphones und Tablets.
*   **Schaltfläche „Neues Angebot“ (`+ Neues Angebot`)**:
    *   *Aktion*: Leitet dich sofort zum mehrstufigen Assistenten (Order Wizard) weiter, um einen neuen Kunden und ein neues Angebot anzulegen.
*   **Anti-Vergess-System (Glocken-Symbol)**:
    *   *Aktion*: Öffnet ein Dropdown-Menü mit automatischen Warnmeldungen des Systems.
    *   *Dringlichkeiten*: Rot (Hoch) oder Gelb (Mittel).
    *   *Meldungen*:
        *   *Angebot abgelaufen / läuft ab*: Erinnert daran, ein erstelltes Angebot beim Kunden nachzufassen.
        *   *Rechnung fehlt*: Weist darauf hin, dass ein Umzug bereits abgeschlossen wurde, aber noch keine Rechnung existiert.
        *   *Mitarbeiter fehlen*: Warnt, wenn bei einem bestätigten Umzug (in den nächsten 7 Tagen) noch keine Helfer eingeteilt sind.
        *   *Fahrzeug fehlt*: Warnt, wenn kein LKW/Transporter für den anstehenden Umzug reserviert ist.
        *   *Halteverbot nicht bestellt*: Erinnert daran, die genehmigungspflichtige Straßensperrung rechtzeitig zu beantragen.
*   **Design-Umschalter (Sonne / Mond)**:
    *   *Aktion*: Wechselt das visuelle Erscheinungsbild der App in Echtzeit zwischen **Hellem Design (Light Mode)** und **Dunklem Design (Dark Mode)**.
*   **Abmelden-Schaltfläche (Tür-mit-Pfeil-Symbol)**:
    *   *Aktion*: Meldet den aktuellen Benutzer sicher vom Firebase-Konto ab und leitet ihn zurück zum Login-Bildschirm.

---

## 2. Zentrale Disposition (Dashboard)

Das Dashboard (`/dashboard`) bietet die operative Tagesübersicht und steuert den Status der Kunden und Logistik-To-Dos.

### KPI-Widgets (Obere Statuskarten)
*   **Angebote-Karte**: Zeigt die Gesamtanzahl aller offenen Angebote (Status *Entwurf* oder *Angebot erstellt*).
*   **Umzüge-Karte**: Zeigt die Anzahl aller fest gebuchten und bestätigten Umzüge (Status *Umzug bestätigt*).
*   **Überfällig-Karte**: Listet alle To-Dos auf, deren Fälligkeitsdatum überschritten ist.
*   **Aufgaben-Karte**: Zeigt die Gesamtanzahl aller noch nicht erledigten logistischen Aufgaben.

### Dynamic View Tab-Umschalter
*   **Schaltfläche „Kunden-Status“**:
    *   *Aktion*: Aktiviert die Kanban-Ansicht der Kunden-Pipeline.
*   **Schaltfläche „Logistik-Aufgaben & To-Dos“**:
    *   *Aktion*: Wechselt zur Listenansicht aller offenen Zusatzaufgaben wie Kartons ausliefern, Halteverbote aufstellen oder Rechnungen erstellen. Ein roter Puls-Zähler zeigt die Anzahl der noch offenen Logistik-Aktionen an.

### Kanban-Board („Kunden-Status“)
Das Board besteht aus vier Spalten, in denen die Aufträge als Karten visualisiert werden:
1.  **NEU / ENTWURF**: Frisch angelegte oder unvollständige Anfragen.
2.  **ANGEBOT ERSTELLT**: Angebote, die kalkuliert und an den Kunden geschickt wurden.
3.  **UMZUG BESTÄTIGT**: Vom Kunden fest zugesagte Aufträge.
4.  **ABGESCHLOSSEN**: Durchgeführte Umzüge, die bereit für die Rechnungsstellung sind.

*   **Drag & Drop (Karten ziehen)**:
    *   *Aktion*: Ziehe eine Kundenkarte in eine andere Spalte, um deren Status in der Datenbank automatisch zu aktualisieren.
*   **Klick auf eine Kanban-Karte**:
    *   *Aktion*: Öffnet das detaillierte **Kunden-Popup-Modal** (siehe unten).
*   **Schaltfläche „Kundenprofil öffnen“ (User-Icon auf Karte)**:
    *   *Aktion*: Leitet dich direkt zur vollständigen Kunden-Profilseite (`/dashboard/customers/[id]`) weiter.
*   **Schaltfläche „Erledigen / Erledigt“ (Häkchen-Knopf in der Logistikliste)**:
    *   *Aktion*: Markiert eine logistische Aufgabe manuell als erledigt. Bereits erledigte Aufgaben werden grün dargestellt. Systemgenerierte Aufgaben (z.B. Verträge) können nur durch das entsprechende Systemereignis abgehakt werden.

### Dashboard Kunden-Popup-Modal
*   **Schließ-Schaltfläche (X oben rechts)**:
    *   *Aktion*: Schließt das Popup und kehrt zum Dashboard zurück.
*   **Phasen-Checkboxes (1. Verifizieren bis 5. Abrechnung)**:
    *   *Aktion*: Ermöglicht das schrittweise Abhaken von Teilaufgaben.
    *   *Wichtige Funktion*: Das Abhaken bestimmter Phasen-Schlüsseltasks (z.B. „Angebot erstellen & senden“) ändert automatisch den Gesamtstatus des Auftrags und verschiebt ihn im Kanban-Board.
*   **Schaltfläche „Los“**:
    *   *Aktion*: Springt direkt zum entsprechenden Formular oder Dialog (z. B. zum Schreiben eines Angebots).
*   **Schaltfläche „Zum Kunden“**:
    *   *Aktion*: Öffnet das vollständige Kundenprofil.
*   **Termin- & Datumseingabefelder (z.B. Karton-Lieferdatum, Halteverbots-Datum)**:
    *   *Aktion*: Ermöglicht die direkte Eingabe oder Änderung von Terminen. Das System speichert diese sofort ab und trägt sie in den Kalender ein.

---

## 3. Einsatzplanung (Kalender)

Der Kalender (`/dashboard/calendar`) steuert die operative Terminierung und Zuweisung von Ressourcen.

*   **Pfeil-Schaltflächen (Links `<` / Rechts `>`)**:
    *   *Aktion*: Navigiert einen Monat zurück oder vor.
*   **Event-Schaltflächen in den Kalendertagen**:
    *   *Aktion*: Öffnet ein Vorschau-Popup für den jeweiligen Termin. Die Termine sind farblich codiert:
        *   **Orange (Umzug)**: Zeigt einen bestätigten Umzug. Ein Klick darauf bietet die Option, die Disposition zu bearbeiten.
        *   **Blau (Halteverbot)**: Zeigt das Aufstelldatum des Halteverbots.
        *   **Gelb (Kartons)**: Zeigt den Tag der Kartonlieferung.
        *   **Lila (Möbellift)**: Zeigt den Einsatzzeitraum des Möbellifts.
        *   **Grün (Besichtigung)**: Zeigt ein geplantes Vor-Ort- oder Video-Besichtigungsgespräch.
*   **Schaltfläche „Disposition bearbeiten“ (LKW-Symbol im Event-Popup)**:
    *   *Aktion*: Öffnet das **Dispo-Modal** zur Ressourceneinteilung.

### Dispo-Modal (Einsatzplanung)
*   **Fahrzeug-Auswahl (Checkboxen)**:
    *   *Aktion*: Reserviert Fahrzeuge (z.B. 3.5t Koffer, 7.5t LKW) für diesen Auftrag.
*   **Teamleiter-Dropdown**:
    *   *Aktion*: Weist dem Umzug einen leitenden Mitarbeiter/Fahrer zu.
*   **Helfer-Auswahl (Mehrfachauswahl)**:
    *   *Aktion*: Teilt Packer und Helfer aus dem in den Einstellungen gepflegten Mitarbeiter-Pool ein.
*   **Schaltfläche „Speichern“**:
    *   *Aktion*: Sichert die Zuteilung ab und macht sie für alle Mitarbeiter im Kalender sichtbar.

---

## 4. Kunden Control Center & Kundenprofil

Hier werden alle Kundendaten und deren Historie verwaltet.

### Kunden Control Center (`/dashboard/customers`)
*   **Eingabefeld „Suche“**:
    *   *Aktion*: Filtert Kunden in Echtzeit nach Name, Stadt oder Telefonnummer.
*   **Schaltfläche „X“ (im Suchfeld)**:
    *   *Aktion*: Löscht den aktuellen Suchbegriff und zeigt wieder alle Kunden an.
*   **Schaltfläche „Neuer Kunde (via Angebot)“**:
    *   *Aktion*: Leitet dich zum Wizard für die Anlage eines neuen Angebots weiter.
*   **Tabellen-Sortierköpfe (Name, Umzugsdatum, Umsatz)**:
    *   *Aktion*: Sortiert die Kundenliste nach der ausgewählten Spalte.
*   **Auge-Schaltfläche (Details/Profil)**:
    *   *Aktion*: Öffnet die detaillierte Profilseite des Kunden.
*   **Kommunikations-Schaltfläche (Telefon-Dropdown)**:
    *   *Aktion*: Bietet Direktlinks zum Starten eines WhatsApp-Chats, einer E-Mail (über Standard-Mailprogramm) oder eines Telefonanrufs.

### Kunden-Profilseite (`/dashboard/customers/[id]`)
*   **Schaltfläche „Kundendaten bearbeiten“ (Stift-Symbol)**:
    *   *Aktion*: Schaltet die Kundenstammdaten (Name, Telefon, Adresse, E-Mail-Adresse) in den Editiermodus.
*   **Schaltfläche „Abbrechen“ (während der Bearbeitung)**:
    *   *Aktion*: Verwirft alle Änderungen und schließt den Editiermodus.
*   **Schaltfläche „Speichern“ (Häkchen-Symbol während der Bearbeitung)**:
    *   *Aktion*: Speichert die Änderungen dauerhaft in der Firebase-Datenbank.
*   **Schaltfläche „Neue freie Rechnung“ (Dokumenten-Plus-Symbol)**:
    *   *Aktion*: Erstellt eine Rechnung, die nicht an ein Umzugsprojekt gekoppelt ist (z. B. für reinen Materialverkauf oder Entsorgungsgebühren).
*   **Chevron-Schaltflächen (Auf-/Zuklappen in der Historie)**:
    *   *Aktion*: Blendet die Details eines Angebots oder einer Rechnung ein bzw. aus.
*   **Zahnrad / Drei-Punkte-Schaltfläche (Aktions-Menü für Aufträge)**:
    *   *Aktion*: Öffnet das Schnellmenü für den ausgewählten Auftrag:
        *   **Bearbeiten**: Öffnet den Order Wizard zur Editierung.
        *   **Digitale Signatur**: Öffnet das Unterschriftenfeld für den Kunden.
        *   **Dispo bearbeiten**: Startet das Dispositions-Modal.
        *   **Rechnung generieren**: Erzeugt einen editierbaren Rechnungsentwurf.
        *   **Rechnung stornieren**: Storniert die ausgestellte Rechnung und erzeugt einen Stornobeleg.
        *   **Zahlung verwalten**: Öffnet den Zahlungs-Manager.
        *   **Smarte Nachricht senden**: Ermöglicht den schnellen Versand vordefinierter Nachrichten.
        *   **Auftrag stornieren**: Setzt den Status auf storniert.
        *   **Auftrag löschen**: Löscht den Auftrag unwiderruflich (nur bei Angeboten ohne Rechnung möglich).

---

## 5. Angebotserstellung & Bearbeitung (Order Wizard)

Der Wizard (`/dashboard/orders/new` oder `edit-order`) führt dich in 5 Schritten durch die Angebotserstellung.

### Stepper-Buttons (Schritt 1 bis 5)
Ermöglichen das direkte Springen zwischen den einzelnen Abschnitten:

1.  **Schritt 1: Kunde & Termine**:
    *   *Eingabefelder*: Kundensuche (für Bestandskunden) oder manuelle Eingabe von Vorname, Nachname, E-Mail, Telefon und der Marketing-Quelle (z. B. Empfehlung, Google).
    *   *Terminfelder*: Umzugsdatum (von/bis), Packdatum, Besichtigungsdatum und Halteverbotsdatum.
2.  **Schritt 2: Logistik & Route**:
    *   *Eingabefelder*: Auszugs- und Einzugsadresse (Straße, PLZ, Ort, Etage, Aufzug vorhanden (Ja/Nein), Trageweg in Metern, Halteverbotszone gewünscht).
    *   *Schaltfläche „Route berechnen“*: Startet die automatische Berechnung der Entfernung in Kilometern und der Fahrzeit in Minuten über eine integrierte Schnittstelle.
3.  **Schritt 3: Leistungen & Finanzen**:
    *   *Toggle „Pauschalpreis“*: Aktiviert den Festpreismodus. Wenn aktiv, wird ein fixer Gesamtpreis eingetragen, statt einzelne Stunden zu listen.
    *   *Schaltfläche „Leistung hinzufügen“*: Öffnet das Dropdown des Leistungskatalogs (z.B. Packservice, Demontage, Küchenmontage).
    *   *Eingabefelder für Finanzen*: MwSt-Satz (19% oder 0%), Rabatt in Prozent oder Euro, Anzahlungsbetrag und gewünschte Zahlungsart.
4.  **Schritt 4: Inventar & Checkliste**:
    *   *Schaltfläche „Inventar-Assistent öffnen“*: Öffnet ein grafisches Tool, bei dem du pro Raum (Wohnzimmer, Küche, etc.) Möbelstücke anklicken kannst. Das System berechnet daraus automatisch das geschätzte Ladevolumen in Kubikmetern (cbm).
    *   *Eingabefeld „Neuer Punkt“*: Fügt ein individuelles To-Do zur internen Checkliste dieses Auftrags hinzu.
5.  **Schritt 5: Abschluss & Dokumente**:
    *   *Status-Auswahl*: Setzt den Auftrag auf *Entwurf*, *Angebot erstellt*, *Umzug bestätigt* oder *Abgeschlossen*.
    *   *Vorlagen-Auswahl*: Wählt den passenden Anschreibentext für das Angebot aus.
    *   *Schaltfläche „Speichern“*: Sichert den gesamten Auftrag in der Datenbank.

---

## 6. Finanzverwaltung & Rechnungs-Editor

Unter `/dashboard/finances` verwaltest du alle Geldeingänge und Abschlüsse.

### Haupt-Bedienelemente
*   **Tab „Offene Rechnungen“**:
    *   *Aktion*: Zeigt nur Rechnungen, die noch nicht vollständig bezahlt sind.
*   **Tab „Alle Rechnungen“**:
    *   *Aktion*: Zeigt die vollständige Liste aller Rechnungen inklusive bereits bezahlter oder stornierter Belege.
*   **Schaltfläche „Monatsabschluss / DATEV-Export“**:
    *   *Aktion*: Klappt das Export-Panel aus.
        *   *Eingabefeld „Abrechnungsmonat“*: Auswahl des gewünschten Monats.
        *   *Schaltfläche „ZIP inkl. PDFs laden“*: Erstellt vollautomatisch alle PDFs des Monats, fügt eine CSV-Übersicht für den Steuerberater hinzu und lädt diese als ZIP-Archiv herunter.
        *   *Schaltfläche „Nur CSV-Tabelle“*: Lädt nur die Buchhaltungstabelle als CSV-Datei herunter.

### Zahlungs-Manager (Zahlungs-Modal)
*   **Dropdown „Zahlungsart“**:
    *   *Aktion*: Auswahl zwischen *Bar*, *Überweisung*, *EC-Karte*, *PayPal* oder *Verrechnung mit Guthaben*.
    *   *Spezialfunktion „Guthaben“*: Wenn ein vorheriger Auftrag storniert wurde, für den bereits Zahlungen eingegangen sind, bietet das System dieses Guthaben hier zur Verrechnung an.
*   **Eingabefeld „Betrag“**:
    *   *Aktion*: Eingabe des gezahlten Betrags (schlägt automatisch den noch offenen Restbetrag vor).
*   **Schaltfläche „Zahlung verbuchen“**:
    *   *Aktion*: Bucht den Geldeingang. Ist die Summe aller Zahlungen gleich oder höher als der Bruttobetrag, wird der Rechnungsstatus automatisch auf „Bezahlt“ gesetzt.
*   **Mülleimer-Symbol (in der Zahlungsliste)**:
    *   *Aktion*: Storniert eine falsch eingetragene Zahlung und korrigiert den offenen Rechnungsbetrag.

---

## 7. Zentrale Reklamationen (Schadensverwaltung)

Das Reklamations-Center (`/dashboard/claims`) hilft bei der Abwicklung von Versicherungsschäden und Mängeln.

*   **Status-Dropdown auf den Schadenskarten**:
    *   *Aktion*: Verschiebt die Karte zwischen den Phasen:
        *   *Neu Gemeldet*
        *   *In Bearbeitung*
        *   *An Versicherung gemeldet*
        *   *Erledigt / Abgeschlossen*
*   **Mülleimer-Symbol (auf Schadenskarte)**:
    *   *Aktion*: Löscht die Schadensmeldung nach einer Sicherheitsabfrage dauerhaft.
*   **Kundenname-Link**:
    *   *Aktion*: Leitet dich direkt zum Kundenprofil weiter, um die Umzugsdetails einzusehen.
*   **Rote Umrandung / Kennzeichnung „ÜBERFÄLLIG“**:
    *   *Bedeutung*: Leuchtet auf, wenn ein neuer Schaden länger als 3 Tage unbearbeitet ist, oder ein Schaden in Bearbeitung/bei der Versicherung seit über 10 Tagen kein Update erhalten hat.

---

## 8. Archiv & System-Einstellungen

### Archiv (`/dashboard/archive`)
*   **Tab „Kunden“ / „Angebote/Aufträge“**:
    *   *Aktion*: Schaltet zwischen den beiden archivierten Datentypen um.
*   **Schaltfläche „Restore“ (Pfeil-zurück-Symbol)**:
    *   *Aktion*: Holt den Kunden oder Auftrag aus dem Archiv zurück in die aktive Datenbankliste.
*   **Schaltfläche „Löschen“ (Mülleimer-Symbol)**:
    *   *Aktion*: Löscht den Eintrag **endgültig und unwiderruflich** aus der Datenbank.

### System-Einstellungen (`/dashboard/settings`)
*   **Schaltfläche „Hinzufügen“ (in den Listen Fuhrpark, Partner, Quellen, Immobilien)**:
    *   *Aktion*: Speichert das neu eingegebene Element (z. B. ein neues Kennzeichen oder eine neue Marketingquelle) im System.
*   **Mülleimer-Symbol (neben Listenelementen)**:
    *   *Aktion*: Entfernt das Fahrzeug oder die Option dauerhaft aus den Auswahllisten des Systems.
*   **Schaltfläche „Speichern“ (bei Textbausteinen / SMTP / Kalender)**:
    *   *Aktion*: Sichert deine geänderten E-Mail-Servereinstellungen, AGB-Texte oder Google-Kalender-Verbindungen.
*   **Schaltfläche „System zurücksetzen“ (Gefahrenzone)**:
    *   *Aktion*: Öffnet ein rotes Sicherheitsmodal.
    *   *Voraussetzung*: Du musst das Wort `LÖSCHEN` eingeben, um die Schaltfläche freizuschalten. Nach dem Klick werden alle Aufträge, Kunden und Finanzen gelöscht und das System in den Werkszustand versetzt.
