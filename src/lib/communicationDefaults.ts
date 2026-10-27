export interface CommunicationTemplate {
  id: string;
  name: string;
  category: string;
  subject?: string;
  body: string;
}

export const MASTER_COMMUNICATION_TEMPLATES: CommunicationTemplate[] = [
  // 1. Erstkontakt
  {
    id: 't1',
    name: 'Erstkontakt (Bilder erhalten)',
    category: 'Erstkontakt',
    subject: 'Angebot für Ihren Umzug – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nvielen Dank für Ihr Interesse an unserem Service und für die Übersendung der Bilder.\n\nGerne erstellen wir Ihnen ein individuelles Angebot mit Festpreis und lassen Ihnen dieses zeitnah zukommen.\n\nSollten Sie vorab noch weitere Fragen haben, stehen wir Ihnen selbstverständlich jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge\n\nTelefon: +49 1590 6603011 | E-Mail: info@rothirsch-umzug.de | Web: www.rothirsch-umzug.de'
  },
  {
    id: 't2',
    name: 'Erstkontakt (Details anfragen)',
    category: 'Erstkontakt',
    subject: 'Ihre Umzugsanfrage – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nvielen Dank für Ihr Interesse an unserem Service. Gerne erstellen wir für Sie ein maßgeschneidertes Angebot mit einem fairen Festpreis.\n\nBitte teilen Sie uns kurz eine Liste oder Bilder der Möbel sowie das gewünschte Umzugsdatum mit. Sie können uns auch jederzeit gerne anrufen, um Details persönlich zu besprechen.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge\n\nTelefon: +49 1590 6603011 | E-Mail: info@rothirsch-umzug.de | Web: www.rothirsch-umzug.de'
  },

  // 2. Besichtigung
  {
    id: 't_besichtigung_vorort',
    name: 'Besichtigung (Vor-Ort-Termin anfragen)',
    category: 'Besichtigung',
    subject: 'Vor-Ort-Besichtigungstermin für Ihren Umzug',
    body: '{{Kunde_Anrede}},\n\num Ihnen ein absolut verlässliches Festpreisangebot zu erstellen, würden wir gerne eine persönliche Vor-Ort-Besichtigung bei Ihnen durchführen.\n\nBitte teilen Sie uns kurz mit, an welchen Tagen und Uhrzeiten es Ihnen am besten passt.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 't_besichtigung_online',
    name: 'Video-Besichtigung (Online-Termin)',
    category: 'Besichtigung',
    subject: 'Online- / Video-Besichtigung für Ihren Umzug',
    body: '{{Kunde_Anrede}},\n\ngerne bieten wir Ihnen eine bequeme Online-Video-Besichtigung (via WhatsApp-Video oder FaceTime) an. In nur 10–15 Minuten schauen wir uns gemeinsam die Räumlichkeiten und Möbel an, um Ihr Festpreisangebot sofort fertigzustellen.\n\nWann passt es Ihnen am besten für einen kurzen Video-Call?\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 'dispo_besichtigung',
    name: 'Besichtigung – Terminbestätigung',
    category: 'Besichtigung',
    subject: 'Bestätigung Ihres Besichtigungstermins – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nhiermit bestätigen wir verbindlich unseren gemeinsamen Besichtigungstermin für Ihren Umzug:\n\n{{Termin_Details}}\n\nUnser Kundenberater wird sich alle Räumlichkeiten und das Umzugsgut gemeinsam mit Ihnen ansehen, um Ihr Festpreisangebot verbindlich fertigzustellen.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 'dispo_unterwegs',
    name: 'Besichtigung – Ich bin unterwegs',
    category: 'Besichtigung',
    subject: 'Auf dem Weg zum Besichtigungstermin – Rothirsch Umzüge',
    body: 'Hallo {{Kunde_Name}},\n\nich bin pünktlich auf dem Weg zu Ihnen für unseren Besichtigungstermin{{Termin_Details}}.\n\nBis gleich!\nViele Grüße,\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },

  // 3. Angebot
  {
    id: 't3',
    name: 'Angebot übermitteln (Verbindlicher Festpreis)',
    category: 'Angebot',
    subject: 'Ihr verbindliches Umzugsangebot mit Festpreis',
    body: '{{Kunde_Anrede}},\n\nanbei sende ich Ihnen unser verbindliches Angebot mit garantiertem Festpreis in Höhe von {{Angebot_Summe}} für Ihren bevorstehenden Umzug am {{Umzugsdatum}}.\n\nBei Rothirsch Umzüge sind alle Möbelstücke durch Profi-Decken, Stretch- und Schutzfolien optimal geschützt. Der vereinbarte Preis deckt alle vereinbarten Leistungen vollständig ab – ohne versteckte Kosten.\n\nBitte prüfen Sie das Angebot und geben Sie uns kurz Bescheid, um Ihren Wunschtermin fest im Kalender zu sichern!\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 't4',
    name: 'Nachfrage zum Umzugsangebot',
    category: 'Nachfassen',
    subject: 'Nachfrage zu Ihrem Umzugsangebot – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nich wollte mich kurz erkundigen, ob Sie bereits eine Entscheidung zu unserem Angebot treffen konnten? Ihr Wunschtermin ({{Umzugsdatum}}) ist aktuell noch für Sie reserviert.\n\nSollten noch Fragen offen sein oder Sie Anpassungen bei Leistungen oder Budget wünschen, melden Sie sich gerne jederzeit telefonisch oder per Nachricht!\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 't5',
    name: 'Aktualisiertes Angebot senden',
    category: 'Angebot',
    subject: 'Ihr aktualisiertes Umzugsangebot – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nvielen Dank für Ihre Rückmeldung. Anbei erhalten Sie das aktualisierte Umzugsangebot angepasst an Ihre neuen Wünsche und Vorgaben.\n\nFür Rückfragen stehe ich Ihnen jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 't6',
    name: 'Freundliche Absage',
    category: 'Nachfassen',
    subject: 'Ihre Umzugsanfrage – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nvielen Dank für Ihre Information. Es ist schade zu hören, dass es diesmal nicht geklappt hat. Wir wünschen Ihnen für Ihren Umzug alles Gute und stehen Ihnen bei zukünftigen Projekten jederzeit sehr gerne wieder zur Seite!\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },

  // 4. Auftrag & Durchführung
  {
    id: 't7',
    name: 'Auftragsbestätigung & Termin',
    category: 'Auftrag',
    subject: 'Auftragsbestätigung für Ihren Umzug am {{Umzugsdatum}}',
    body: '{{Kunde_Anrede}},\n\nvielen Dank für Ihr Vertrauen und die verbindliche Auftragserteilung! Hiermit bestätigen wir Ihnen Ihren Umzugstermin verbindlich für den {{Umzugsdatum}}.\n\nUnser Team wird alles sorgfältig vorbereiten. Wir freuen uns auf einen professionellen und reibungslosen Ablauf!\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 't8',
    name: 'Uhrzeit des Umzugs (Team-Eintreffen)',
    category: 'Auftrag',
    subject: 'Ankunftszeit unseres Umzugsteams am {{Umzugsdatum}}',
    body: '{{Kunde_Anrede}},\n\nkurze Information zu Ihrem Umzug am {{Umzugsdatum}}: Unser Team wird voraussichtlich zwischen 8:00 und 9:00 Uhr bei Ihnen an der Beladestelle eintreffen.\n\nDie Teamleitung wird sich ca. 30 Minuten vor Ankunft nochmals kurz telefonisch bei Ihnen melden.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },

  // 5. Logistik & Disposition
  {
    id: 'dispo_hvz',
    name: 'Halteverbotszone (HVZ) – Termin & Aufbau',
    category: 'Logistik',
    subject: 'Terminbestätigung Halteverbotszone (HVZ) – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nwir haben die amtlich genehmigte Halteverbotszone (HVZ) für Ihren Umzugstermin am {{Umzugsdatum}} wie folgt terminiert:\n\n{{Termin_Details}}\n\nDie vorschriftsmäßige Beschilderung sowie das Aufstellprotokoll werden rechtzeitig vor Ort mit dem gesetzlichen Vorlauf eingerichtet, um kurze Tragewege zu sichern.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 'dispo_moebellift',
    name: 'Möbellift – Einsatz & Stellplatz-Freihaltung',
    category: 'Logistik',
    subject: 'Möbellift-Einsatz für Ihren Umzug – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nfür Ihren Umzug am {{Umzugsdatum}} haben wir den Einsatz unseres Möbellifts (Außenaufzugs) wie folgt verbindlich eingeplant:\n\n{{Termin_Details}}\n\n⚠️ Wichtiger Hinweis zur Vorbereitung:\nBitte stellen Sie unbedingt sicher, dass der Stellplatz direkt vor und unter dem entsprechenden Fenster bzw. Balkon am Einsatztag vollständig frei geräumt und ungehindert zugänglich bleibt, damit wir unseren Außenaufzug sicher positionieren und aufbauen können.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 'dispo_kartons',
    name: 'Umzugskartons – Liefertermin',
    category: 'Logistik',
    subject: 'Lieferung Ihrer Umzugskartons – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nIhre bestellten Umzugskartons und Packmaterialien liefern wir wie folgt an:\n\n{{Termin_Details}}\n\nBitte stellen Sie sicher, dass zum vereinbarten Zeitfenster jemand vor Ort ist, um das Material in Empfang zu nehmen.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 'hvz_info',
    name: 'Halteverbotszone (HVZ) Info',
    category: 'Logistik',
    subject: 'Halteverbotszone für Ihren Umzug eingerichtet',
    body: '{{Kunde_Anrede}},\n\ndie amtlich genehmigte Halteverbotszone (HVZ) für Ihren Umzugstermin am {{Umzugsdatum}} wurde erfolgreich beantragt und wird rechtzeitig mit vorschriftsmäßigem Vorlauf und Aufstellprotokoll beschildert.\n\nDadurch ist ein kurzer Trageweg für Ihre Möbel garantiert.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 'kartons_info',
    name: 'Umzugskartons Bereitstellung',
    category: 'Logistik',
    subject: 'Bereitstellung Ihrer Umzugskartons & Packmaterial',
    body: '{{Kunde_Anrede}},\n\nIhre bestellten Umzugskartons und Packmaterialien stehen bereit. Gerne stimmen wir mit Ihnen den genauen Liefertermin ab, damit Sie rechtzeitig und entspannt mit dem Packen beginnen können.\n\nBitte geben Sie uns kurz Bescheid, wann die Anlieferung für Sie ideal ist.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 'moebellift_info',
    name: 'Möbellift (Außenaufzug) Info',
    category: 'Logistik',
    subject: 'Möbellift-Einsatz für Ihren Umzug eingeplant',
    body: '{{Kunde_Anrede}},\n\nfür Ihren Umzug am {{Umzugsdatum}} ist der Einsatz unseres Möbellifts (Außenaufzugs) fest eingeplant. Dies schont das Treppenhaus und sorgt für einen schnellen, sicheren Transport Ihrer großen Möbelstücke.\n\nBitte stellen Sie sicher, dass der Stellplatz unter dem Fenster/Balkon frei zugänglich bleibt.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },

  // 6. Abrechnung & Finanzen
  {
    id: 'anzahlung',
    name: 'Anzahlung / Sicherheitsleistung anfordern',
    category: 'Abrechnung',
    subject: 'Anzahlung für Ihren Umzug am {{Umzugsdatum}}',
    body: '{{Kunde_Anrede}},\n\nvielen Dank für die Auftragserteilung. Wie besprochen bitten wir um Überweisung der vereinbarten Anzahlung auf unser Geschäftskonto, um die Reservierung der Fahrzeuge und des Personals für den {{Umzugsdatum}} final abzuschließen.\n\nNach Zahlungseingang erhalten Sie umgehend eine Bestätigung.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 't9',
    name: 'Rechnung übermitteln',
    category: 'Abrechnung',
    subject: 'Ihre Rechnung zum Umzug – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nvielen Dank nochmals für Ihren Auftrag und das entgegengebrachte Vertrauen!\n\nAnbei erhalten Sie die offizielle Rechnung zu Ihrem Umzug am {{Umzugsdatum}} über den Betrag von {{Angebot_Summe}}.\n\nWir hoffen, Sie haben sich in Ihrem neuen Zuhause bereits gut eingelebt und waren mit unserem Team vollkommen zufrieden!\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },
  {
    id: 'zahlungserinnerung',
    name: 'Zahlungserinnerung (Offener Betrag)',
    category: 'Abrechnung',
    subject: 'Freundliche Zahlungserinnerung – Rechnung {{Rechnungsnummer}}',
    body: '{{Kunde_Anrede}},\n\nwir erlauben uns, höflich an die Begleichung der Rechnung zu Ihrem Umzug am {{Umzugsdatum}} zu erinnern. Aktuell ist noch ein Betrag von {{Angebot_Summe}} offen.\n\nSollte sich Ihre Zahlung mit dieser Nachricht gekreuzt haben, betrachten Sie diese Bitte als gegenstandslos.\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  },

  // 7. Nachbereitung
  {
    id: 't10',
    name: 'Feedback & Bitte um Google-Bewertung',
    category: 'Nachbereitung',
    subject: 'Wie zufrieden waren Sie mit Ihrem Umzug? – Rothirsch Umzüge',
    body: '{{Kunde_Anrede}},\n\nes war uns eine Freude, Ihren Umzug durchführen zu dürfen! Wenn Sie mit unserem Service und unserem Team zufrieden waren, würden wir uns riesig über eine kurze Google-Bewertung freuen. Das hilft unserem Familienbetrieb sehr!\n\nHier können Sie uns bewerten:\nhttps://g.page/r/rothirsch-umzug/review\n\nVielen Dank für Ihre Unterstützung und alles Gute im neuen Zuhause!\n\nMit freundlichen Grüßen\n{{Sachbearbeiter}}\nRothirsch Umzüge'
  }
];
