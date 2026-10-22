import { AGB_TEXT } from './constants';

export const MASTER_AGB_STRING = `Allgemeine Geschäftsbedingungen (AGB) – Rothirsch Umzüge

${AGB_TEXT.map(item => `${item.title}\n${item.content}`).join('\n\n')}`;

export interface SystemTexts {
  quoteIntro: string;
  quoteBindingTitle: string;
  quoteOutro: string;
  quoteGreeting: string;
  insuranceTitle: string;
  insurance: string;
  paymentTermsTitle?: string;
  orderIntro: string;
  orderOutro: string;
  orderGreeting: string;
  invoiceIntro: string;
  invoiceOutro: string;
  invoiceGreeting: string;
  googleReview: string;
  dunningIntro: string;
  agb: string;
}

export const MASTER_SYSTEM_TEXTS: SystemTexts = {
  // 1. Angebote (Page 1)
  quoteIntro: 'Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Anfrage und das damit verbundene Vertrauen. Gerne unterbreiten wir Ihnen für Ihren bevorstehenden Umzug folgendes verbindliches Festpreisangebot:',
  quoteGreeting: 'Wir würden uns freuen, Ihren Umzug für Sie durchführen zu dürfen, und sichern Ihnen schon heute eine sorgfältige und termingerechte Ausführung zu.\n\nMit freundlichen Grüßen\nRothirsch Umzüge',

  // 2. Angebote (Page 2: Versicherung & Verbindliche Beauftragung)
  insuranceTitle: 'Versicherungsschutz',
  insurance: 'Mit unserer Transportgüterversicherung ist Ihr Umzugsgut optimal abgesichert. Für diesen Transport deckt unser Unternehmen eine Haftung gem. § 451g HGB mit bis zu 620,00 € je Kubikmeter Ladevolumen ab.',
  paymentTermsTitle: 'Zahlungsinformationen',
  quoteBindingTitle: 'Verbindliche Beauftragung',
  quoteOutro: 'Mit Ihrer Unterschrift bestätigen Sie die verbindliche Beauftragung der auf Seite 1 detaillierten Leistungen und erkennen unsere Allgemeinen Geschäftsbedingungen sowie die gesetzlichen Haftungsregelungen des Möbelspediteurs (§ 451g HGB) an.',

  // 3. Auftragsbestätigungen
  orderIntro: 'Vielen Dank für Ihren Auftrag. Hiermit bestätigen wir verbindlich die Buchung Ihres Umzugs:',
  orderOutro: 'Wir freuen uns auf eine erfolgreiche Zusammenarbeit.',
  orderGreeting: 'Mit freundlichen Grüßen\nRothirsch Umzüge',

  // 4. Rechnungen & Mahnwesen
  invoiceIntro: 'Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen für unsere erbrachten Leistungen:',
  invoiceOutro: 'Bitte überweisen Sie den Rechnungsbetrag innerhalb von 5 Tagen ohne Abzug auf unser Konto.',
  invoiceGreeting: 'Für etwaige Fragen stehen wir Ihnen selbstverständlich jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\nRothirsch Umzüge',
  googleReview: 'Wir hoffen, dass alles zu Ihrer Zufriedenheit war, und würden uns über eine positive Bewertung auf Google freuen.',
  dunningIntro: 'Leider konnten wir bis zum heutigen Tag keinen Zahlungseingang für die unten aufgeführte Rechnung feststellen. Sicherlich ist dies nur ein Versehen Ihrerseits.\n\nWir bitten Sie daher, den ausstehenden Betrag innerhalb der nächsten 5 Tage auf unser unten genanntes Konto zu überweisen.',

  // 5. Allgemeine Geschäftsbedingungen (AGB)
  agb: MASTER_AGB_STRING
};
