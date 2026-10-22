export interface PaymentMethodItem {
  id?: string;
  name: string;
  textQuote: string;
  textInvoice: string;
  shortText: string;
  dueDays: number;
  isDefault?: boolean;
}

export const MASTER_PAYMENT_METHODS: PaymentMethodItem[] = [
  {
    name: 'Überweisung',
    textQuote: 'Wir bitten Sie höflich, den Rechnungsbetrag innerhalb von 5 Tagen nach Abschluss des Umzugs per Überweisung zu begleichen.',
    textInvoice: 'Bitte überweisen Sie den Rechnungsbetrag innerhalb von 5 Tagen ohne Abzug auf unser Konto.',
    shortText: '5 Tage',
    dueDays: 5,
    isDefault: true
  },
  {
    name: 'Barzahlung',
    textQuote: 'Wir bitten Sie höflich, den Rechnungsbetrag unmittelbar nach Abschluss des Umzugs in bar zu begleichen.',
    textInvoice: 'Der Rechnungsbetrag wurde in bar bezahlt. Vielen Dank für Ihre Zahlung!',
    shortText: 'Am Umzugstag',
    dueDays: 0,
    isDefault: false
  },
  {
    name: 'Echtzeit-Überweisung',
    textQuote: 'Wir bitten Sie höflich, den Rechnungsbetrag unmittelbar nach Abschluss des Umzugs per Echtzeitüberweisung zu begleichen.',
    textInvoice: 'Der Rechnungsbetrag wurde per Echtzeitüberweisung bezahlt. Vielen Dank für Ihre Zahlung!',
    shortText: 'Sofort',
    dueDays: 0,
    isDefault: false
  }
];
