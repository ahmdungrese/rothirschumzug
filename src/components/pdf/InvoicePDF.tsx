import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { calculateOrderTotals, calculateOpenAmount, calculateTotalPaid } from '@/lib/financeHelpers';
import { PDF_COLORS, pdfCommonStyles } from './core/pdfTheme';
import { PDFHeader } from './core/PDFHeader';
import { PDFFooter } from './core/PDFFooter';
import { PDFWatermark } from './core/PDFWatermark';

const styles = StyleSheet.create({
  ...pdfCommonStyles,
  
  customerDateBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  customerBox: {
    width: '52%',
    paddingRight: 10,
  },
  customerName: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMain,
    marginBottom: 3,
  },
  customerAddress: {
    fontSize: 9,
    color: PDF_COLORS.textMain,
    lineHeight: 1.35,
  },
  
  docInfoBox: {
    width: '44%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 4,
    padding: 8,
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2.5,
  },
  docLabel: {
    fontSize: 8,
    color: PDF_COLORS.textMuted,
  },
  docValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMain,
    textAlign: 'right',
  },
  
  stornoBadge: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginTop: 3,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: PDF_COLORS.border,
  },
  
  // Document Title & Salutation Spacing
  mainTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginTop: 8,
    marginBottom: 10,
  },
  introText: {
    fontSize: 9.5,
    lineHeight: 1.5,
    marginBottom: 14,
    color: PDF_COLORS.textMain,
  },
  
  routeCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: PDF_COLORS.primary,
    borderRadius: 4,
    padding: 9,
    marginBottom: 14,
  },
  routeHeader: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeRow: {
    flexDirection: 'row',
    fontSize: 8.5,
    color: PDF_COLORS.textMain,
    marginBottom: 2,
  },
  
  // Table Columns
  colPos: { width: '8%', textAlign: 'center' },
  colDesc: { width: '47%', paddingRight: 6 },
  colDescFlat: { width: '70%', paddingRight: 6 },
  colQty: { width: '15%', textAlign: 'center' },
  colQtyFlat: { width: '22%', textAlign: 'center' },
  colPrice: { width: '15%', textAlign: 'right' },
  colTotal: { width: '15%', textAlign: 'right' },
  
  itemName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMain,
  },
  itemNote: {
    fontSize: 7.5,
    color: PDF_COLORS.textMuted,
    marginTop: 1.5,
  },
  
  paymentSection: {
    marginTop: 6,
    marginBottom: 12,
  },
  paymentHeader: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 4,
  },
  paymentCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    marginBottom: 2,
    color: PDF_COLORS.textMain,
  },
  textBlock: {
    fontSize: 8.5,
    lineHeight: 1.45,
    color: PDF_COLORS.textMain,
    marginBottom: 6,
  }
});

export const InvoicePDF = ({
  order,
  customer,
  settings,
  employeeName,
}: {
  order: any;
  customer: any;
  settings: any;
  employeeName?: string;
}) => {
  const isFlat = order?.isFlatRate;
  const isStorno = order?.isStorno;
  const billing = order?.customerData || order?.billingAddress || customer;

  // Zahlungskonditionen & Fälligkeit
  const pmSettings =
    settings?.paymentMethods?.find((p: any) => p.name === order?.orderMeta?.paymentMethod) ||
    settings?.paymentMethods?.[0];
  const dueDays = pmSettings?.dueDays || 0;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const { net: safeNet, tax: safeTax, gross: safeGross } = calculateOrderTotals(order);

  const docTitle = isStorno
    ? `Stornorechnung ${order?.invoiceNumber || order?.orderNumber || 'Entwurf'} - ${billing?.lastName || 'Kunde'}`
    : `Rechnung ${order?.invoiceNumber || order?.orderNumber || 'Entwurf'} - ${billing?.lastName || 'Kunde'}`;

  // Personalisierte Anrede
  const salutation = billing?.salutation || customer?.salutation;
  let introGreeting = 'Sehr geehrte Damen und Herren,';
  if (salutation === 'Herr' && billing?.lastName) {
    introGreeting = `Sehr geehrter Herr ${billing.lastName},`;
  } else if (salutation === 'Frau' && billing?.lastName) {
    introGreeting = `Sehr geehrte Frau ${billing.lastName},`;
  }

  const invoiceOutro = settings?.texts?.invoiceOutro || '';
  const invoiceGreeting = settings?.texts?.invoiceGreeting || '';

  const hasRouteInfo = order?.logistics?.a_city || order?.logistics?.b_city;

  const totalPaid = calculateTotalPaid(order);
  const remaining = calculateOpenAmount(order);
  const isFullyPaid = totalPaid >= safeGross - 0.01;

  return (
    <Document title={docTitle}>
      <Page size="A4" style={styles.page}>
        <PDFWatermark type="symbols" />

        <PDFHeader settings={settings} docTitle={isStorno ? 'Stornorechnung' : 'Rechnung'} />

        {/* Recipient Window & Document Meta Box */}
        <View style={styles.customerDateBox}>
          {/* Left: Clean Customer Address (NO "Rechnungsempfänger" label!) */}
          <View style={styles.customerBox}>
            <Text style={styles.customerName}>
              {billing?.type === 'firma'
                ? billing?.lastName
                : `${billing?.firstName || ''} ${billing?.lastName || ''}`.trim()}
            </Text>
            {billing?.type === 'firma' && billing?.firstName && (
              <Text style={{ fontSize: 8.5, color: PDF_COLORS.textMuted, marginBottom: 2 }}>
                z.Hd. {billing.firstName}
              </Text>
            )}
            <Text style={styles.customerAddress}>
              {billing?.street ? `${billing.street} ${billing.houseNr || ''}`.trim() : billing?.address?.split(',')[0] || ''}
            </Text>
            <Text style={styles.customerAddress}>
              {billing?.zip ? `${billing.zip} ${billing.city || ''}`.trim() : billing?.address?.split(',')[1]?.trim() || ''}
            </Text>
          </View>

          {/* Right: Document Meta Box */}
          <View style={styles.docInfoBox}>
            <View style={styles.docRow}>
              <Text style={styles.docLabel}>{isStorno ? 'Stornonummer' : 'Rechnungsnummer'}</Text>
              <Text style={styles.docValue}>{order?.invoiceNumber || 'Entwurf'}</Text>
            </View>
            <View style={styles.docRow}>
              <Text style={styles.docLabel}>Rechnungsdatum</Text>
              <Text style={styles.docValue}>
                {order?.invoiceDate
                  ? new Date(order.invoiceDate).toLocaleDateString('de-DE')
                  : new Date().toLocaleDateString('de-DE')}
              </Text>
            </View>
            <View style={styles.docRow}>
              <Text style={styles.docLabel}>Leistungsdatum</Text>
              <Text style={styles.docValue}>
                {order?.orderMeta?.movingDateFrom
                  ? new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE')
                  : 'Gemäß Absprache'}
              </Text>
            </View>
            <View style={styles.docRow}>
              <Text style={styles.docLabel}>Sachbearbeiter</Text>
              <Text style={styles.docValue}>{employeeName || order?.orderMeta?.manager || settings?.manager || '-'}</Text>
            </View>
            {isStorno && (
              <Text style={styles.stornoBadge}>
                Storno zu Rechnung: {order?.stornoFor || 'Ursprungsrechnung'}
              </Text>
            )}
          </View>
        </View>

        {/* Document Title with generous spacing */}
        <Text style={styles.mainTitle}>{isStorno ? 'STORNORECHNUNG' : 'RECHNUNG'}</Text>
        
        {/* Intro text */}
        <Text style={styles.introText}>
          {introGreeting}{'\n'}
          {isStorno
            ? `hiermit stornieren wir die Rechnung ${order?.stornoFor || ''}. Der unten ausgewiesene Betrag wird Ihrem Konto gutgeschrieben bzw. gleicht unsere Forderung aus.`
            : (order?.texts?.invoiceIntro ||
                settings?.texts?.invoiceIntro ||
                'vielen Dank für Ihren Auftrag. Für unsere erbrachten Leistungen stellen wir Ihnen folgenden Betrag in Rechnung:')
                .replace(/\{\{Kunde_Anrede\}\}/g, introGreeting.replace(',', ''))}
        </Text>

        {/* Umzugswege / Leistungsort Card */}
        {hasRouteInfo && (
          <View style={styles.routeCard}>
            <Text style={styles.routeHeader}>Leistungsort / Umzugswege</Text>
            <View style={styles.routeRow}>
              <Text style={{ fontFamily: 'Helvetica-Bold', width: '12%' }}>Von:</Text>
              <Text style={{ width: '88%' }}>
                {order.logistics.a_street} {order.logistics.a_houseNr}, {order.logistics.a_zip} {order.logistics.a_city}
              </Text>
            </View>
            <View style={styles.routeRow}>
              <Text style={{ fontFamily: 'Helvetica-Bold', width: '12%' }}>Nach:</Text>
              <Text style={{ width: '88%' }}>
                {order.logistics.b_street} {order.logistics.b_houseNr}, {order.logistics.b_zip} {order.logistics.b_city}
              </Text>
            </View>
          </View>
        )}

        {/* ── LEISTUNGEN TABELLE ── */}
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.colPos}>Pos.</Text>
            <Text style={isFlat ? styles.colDescFlat : styles.colDesc}>Leistungsbeschreibung</Text>
            <Text style={isFlat ? styles.colQtyFlat : styles.colQty}>{isFlat ? 'Umfang' : 'Menge'}</Text>
            {!isFlat && (
              <>
                <Text style={styles.colPrice}>Einzelpreis</Text>
                <Text style={styles.colTotal}>Gesamt</Text>
              </>
            )}
          </View>

          {order?.services?.length ? (
            order.services.map((item: any, i: number) => {
              const itemNameLower = (item.name || '').toLowerCase();
              const showExactAmount = isFlat && (itemNameLower.includes('karton') || itemNameLower.includes('einpack'));
              const isItemIncluded = Boolean(item.isIncluded || item.unitPrice === 0);

              return (
                <View key={i} style={styles.tableRow} wrap={false}>
                  <Text style={styles.colPos}>{i + 1}</Text>
                  <View style={isFlat ? styles.colDescFlat : styles.colDesc}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
                  </View>
                  <Text style={isFlat ? styles.colQtyFlat : styles.colQty}>
                    {isFlat
                      ? showExactAmount
                        ? `${item.quantity} ${item.unit}`
                        : isItemIncluded
                        ? 'Inklusiv'
                        : `${item.quantity} ${item.unit}`
                      : `${item.quantity} ${item.unit}`}
                  </Text>
                  {!isFlat && (
                    <>
                      <Text style={styles.colPrice}>
                        {isItemIncluded ? '—' : `${item.unitPrice?.toFixed(2)} €`}
                      </Text>
                      <Text style={styles.colTotal}>
                        {isItemIncluded ? 'Inklusiv' : `${(item.quantity * item.unitPrice)?.toFixed(2)} €`}
                      </Text>
                    </>
                  )}
                </View>
              );
            })
          ) : isStorno ? (
            <View style={styles.tableRow} wrap={false}>
              <Text style={styles.colPos}>1</Text>
              <Text style={[styles.colDesc, { width: '70%' }]}>
                Stornierung der Rechnung {order?.stornoFor || ''}
              </Text>
              <Text style={[styles.colQty, { width: '22%' }]}>Pauschal</Text>
              {!isFlat && (
                <>
                  <Text style={styles.colPrice}></Text>
                  <Text style={styles.colTotal}>-{safeNet.toFixed(2)} €</Text>
                </>
              )}
            </View>
          ) : null}
        </View>

        {/* Totals Summary */}
        <View style={styles.totalsContainer} wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Nettobetrag:</Text>
              <Text>{isStorno ? `-${safeNet.toFixed(2)}` : safeNet.toFixed(2)} €</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>zzgl. 19% MwSt.:</Text>
              <Text>{isStorno ? `-${safeTax.toFixed(2)}` : safeTax.toFixed(2)} €</Text>
            </View>
            <View style={styles.totalRowGrand}>
              <Text>{isStorno ? 'Gutschriftsbetrag:' : 'Gesamtbetrag (inkl. MwSt.):'}</Text>
              <Text>{isStorno ? `-${safeGross.toFixed(2)}` : safeGross.toFixed(2)} €</Text>
            </View>
          </View>
        </View>

        {/* ── ZAHLUNGSINFORMATIONEN & BANK (Smart Payment Info) ── */}
        <View style={styles.paymentSection} wrap={false}>
          <Text style={styles.paymentHeader}>Zahlungsinformationen</Text>

          {isStorno ? (
            <Text style={styles.textBlock}>
              Der Gutschriftsbetrag wird Ihrem Bankkonto erstattet bzw. mit noch offenen Forderungen verrechnet.
            </Text>
          ) : isFullyPaid ? (
            <Text style={{ ...styles.textBlock, color: PDF_COLORS.success, fontFamily: 'Helvetica-Bold' }}>
              ✓ Der Rechnungsbetrag wurde bereits vollständig bezahlt. Vielen Dank für Ihre Zahlung!
            </Text>
          ) : totalPaid > 0 && remaining > 0 ? (
            <View>
              <Text style={styles.textBlock}>
                Bereits angezahlt / bezahlt: {totalPaid.toFixed(2)} €
              </Text>
              <Text style={{ ...styles.textBlock, fontFamily: 'Helvetica-Bold', color: PDF_COLORS.primary }}>
                Noch offener Restbetrag: {remaining.toFixed(2)} €
              </Text>
              <Text style={styles.textBlock}>
                {invoiceOutro || 'Bitte überweisen Sie den noch offenen Betrag ohne Abzug auf unser unten aufgeführtes Konto.'}
              </Text>
            </View>
          ) : (
            <View>
              <Text style={styles.textBlock}>
                {pmSettings?.textInvoice ||
                  invoiceOutro ||
                  'Bitte überweisen Sie den fälligen Rechnungsbetrag auf unser Bankkonto:'}
              </Text>
              <View style={styles.paymentCard}>
                <View style={styles.bankRow}>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>Kontoinhaber:</Text>
                  <Text>{settings?.companyName || 'Rothirsch Umzug'}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>IBAN:</Text>
                  <Text>{settings?.iban || 'DE51 4305 0001 0033 4371 12'}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>BIC:</Text>
                  <Text>{settings?.bic || 'WELADED1B0C'}</Text>
                </View>
                <View style={styles.bankRow}>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>Kreditinstitut:</Text>
                  <Text>{settings?.bankName || 'Sparkasse Bochum'}</Text>
                </View>
                <View style={{ ...styles.bankRow, marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: PDF_COLORS.border }}>
                  <Text style={{ fontFamily: 'Helvetica-Bold', color: PDF_COLORS.primary }}>Zahlungsziel:</Text>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                    {dueDays > 0
                      ? `Innerhalb von ${dueDays} Tagen (bis zum ${dueDate.toLocaleDateString('de-DE')})`
                      : 'Sofort nach Rechnungserhalt'}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {invoiceGreeting ? (
          <Text style={{ ...styles.textBlock, marginTop: 8 }} wrap={false}>
            {invoiceGreeting}
          </Text>
        ) : null}

        <PDFFooter settings={settings} />
      </Page>
    </Document>
  );
};
