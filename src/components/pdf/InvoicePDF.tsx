import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { calculateOrderTotals, calculateOpenAmount, calculateTotalPaid } from '@/lib/financeHelpers';
import { PDF_COLORS, pdfCommonStyles } from './core/pdfTheme';
import { PDFHeader } from './core/PDFHeader';
import { PDFFooter } from './core/PDFFooter';
import { PDFWatermark } from './core/PDFWatermark';

const styles = StyleSheet.create({
  ...pdfCommonStyles,
  page: {
    ...pdfCommonStyles.page,
    paddingTop: 24,
    paddingBottom: 82, // Protects fixed footer at top 762pt
  },
  pageComfort: {
    paddingTop: 28,
  },
  
  customerDateBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  customerDateBoxComfort: {
    marginBottom: 12,
  },
  customerBox: {
    width: '52%',
    paddingRight: 10,
    backgroundColor: '#ffffff',
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  customerBoxComfort: {
    paddingVertical: 4,
  },
  customerName: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMain,
    marginBottom: 2,
  },
  customerNameComfort: {
    fontSize: 10.5,
  },
  customerAddress: {
    fontSize: 8.5,
    color: PDF_COLORS.textMain,
    lineHeight: 1.3,
  },
  customerAddressComfort: {
    fontSize: 9,
    lineHeight: 1.35,
  },
  
  docInfoBox: {
    width: '44%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 4,
    padding: 6,
  },
  docInfoBoxComfort: {
    padding: 8,
  },
  docRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1.5,
  },
  docRowComfort: {
    marginBottom: 2,
  },
  docLabel: {
    fontSize: 7.5,
    color: PDF_COLORS.textMuted,
  },
  docLabelComfort: {
    fontSize: 8,
  },
  docValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMain,
    textAlign: 'right',
  },
  docValueComfort: {
    fontSize: 8.5,
  },
  
  stornoBadge: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginTop: 2,
    paddingTop: 2,
    borderTopWidth: 0.5,
    borderTopColor: PDF_COLORS.border,
  },
  
  // Document Title & Salutation Spacing
  mainTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginTop: 2,
    marginBottom: 4,
  },
  mainTitleComfort: {
    fontSize: 18,
    marginTop: 4,
    marginBottom: 6,
  },
  introText: {
    fontSize: 8.5,
    lineHeight: 1.35,
    marginBottom: 8,
    color: PDF_COLORS.textMain,
  },
  introTextComfort: {
    fontSize: 9,
    lineHeight: 1.4,
    marginBottom: 12,
  },
  
  routeCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: PDF_COLORS.primary,
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginBottom: 8,
  },
  routeCardComfort: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  routeHeader: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeHeaderComfort: {
    fontSize: 8,
  },
  routeCols: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  routeCol: {
    width: '48%',
  },
  routeText: {
    fontSize: 8,
    color: PDF_COLORS.textMain,
  },
  routeTextComfort: {
    fontSize: 8.5,
  },
  
  // Table
  table: {
    ...pdfCommonStyles.table,
    marginBottom: 8,
  },
  tableComfort: {
    marginBottom: 12,
  },
  tableHeader: {
    ...pdfCommonStyles.tableHeader,
    paddingVertical: 4.5,
    paddingHorizontal: 6,
    fontSize: 8,
  },
  tableHeaderComfort: {
    paddingVertical: 5.5,
    fontSize: 8.5,
  },
  tableRow: {
    ...pdfCommonStyles.tableRow,
    paddingVertical: 3.5,
    paddingHorizontal: 6,
  },
  tableRowComfort: {
    paddingVertical: 4.5,
  },
  
  // Table Columns
  colPos: { width: '7%', textAlign: 'center', fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#8F1627', paddingTop: 1 },
  colPosComfort: { fontSize: 8.5 },
  colDesc: { width: '49%', paddingRight: 8 },
  colDescFlat: { width: '71%', paddingRight: 8 },
  colQty: { width: '14%', textAlign: 'center', fontSize: 8, paddingTop: 1 },
  colQtyComfort: { fontSize: 8.5 },
  colQtyFlat: { width: '22%', textAlign: 'center', fontSize: 8, paddingTop: 1 },
  colQtyFlatComfort: { fontSize: 8.5 },
  colPrice: { width: '15%', textAlign: 'right', fontSize: 8, paddingTop: 1 },
  colPriceComfort: { fontSize: 8.5 },
  colTotal: { width: '15%', textAlign: 'right', fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: '#0f172a', paddingTop: 1 },
  colTotalComfort: { fontSize: 9 },
  
  itemName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    lineHeight: 1.25,
  },
  itemNameComfort: {
    fontSize: 9.5,
  },
  itemNote: {
    fontSize: 7.8,
    color: '#475569',
    marginTop: 2,
    lineHeight: 1.35,
  },
  itemNoteComfort: {
    fontSize: 8,
  },
  
  // Side-by-Side Finance & Payment Row (Compact Mode)
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  paymentCol: {
    width: '52%',
  },
  totalsCol: {
    width: '44%',
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    padding: 6,
  },
  paymentHeader: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 3,
  },
  paymentCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 4,
    padding: 5,
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    marginBottom: 1,
    color: PDF_COLORS.textMain,
  },
  textBlock: {
    fontSize: 7.5,
    lineHeight: 1.3,
    color: PDF_COLORS.textMain,
    marginBottom: 3,
  },

  // Comfort Mode Finance Blocks (Stacked, Full-Width & Rich Spacing)
  totalsWrapperComfort: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  totalsColComfort: {
    width: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    padding: 8,
  },
  totalRowComfort: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
    fontSize: 8.5,
    color: PDF_COLORS.textMuted,
  },
  totalRowGrandComfort: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 5,
    marginTop: 3,
    borderTopWidth: 1.5,
    borderTopColor: PDF_COLORS.primary,
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
  },
  paymentCardComfort: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginBottom: 6,
  },
  bankRowComfort: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    marginBottom: 2,
    color: PDF_COLORS.textMain,
  },
  paymentHeaderComfort: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 4,
  },
  textBlockComfort: {
    fontSize: 8,
    lineHeight: 1.35,
    color: PDF_COLORS.textMain,
    marginBottom: 4,
  },

  legalNoticeBox: {
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: PDF_COLORS.border,
    backgroundColor: '#fafafa',
    marginTop: 2,
  },
  legalNoticeBoxComfort: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 4,
  },
  legalNoticeText: {
    fontSize: 6,
    color: '#64748b',
    lineHeight: 1.2,
  },
  legalNoticeTextComfort: {
    fontSize: 6.5,
    lineHeight: 1.25,
  },
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
  const isKorrektur = Boolean(order?.isKorrektur || order?.isCorrection);
  const billing = order?.customerData || order?.billingAddress || customer;
  const isCompact = (order?.services?.length || 0) >= 5;

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
    : isKorrektur
    ? `Korrekturrechnung ${order?.invoiceNumber || order?.orderNumber || 'Entwurf'} - ${billing?.lastName || 'Kunde'}`
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
      <Page size="A4" style={isCompact ? styles.page : [styles.page, styles.pageComfort]}>
        <PDFWatermark pageVariant="page1" />
        <PDFHeader settings={settings} docTitle={isStorno ? 'Stornorechnung' : (isKorrektur ? 'Korrekturrechnung' : 'Rechnung')} />
        <PDFFooter settings={settings} />

        {/* Recipient Window & Document Meta Box */}
        <View style={isCompact ? styles.customerDateBox : [styles.customerDateBox, styles.customerDateBoxComfort]}>
          {/* Left: Clean Customer Address (NO "Rechnungsempfänger" label!) */}
          <View style={isCompact ? styles.customerBox : [styles.customerBox, styles.customerBoxComfort]}>
            <Text style={isCompact ? styles.customerName : [styles.customerName, styles.customerNameComfort]}>
              {billing?.type === 'firma'
                ? billing?.lastName
                : `${billing?.firstName || ''} ${billing?.lastName || ''}`.trim()}
            </Text>
            {billing?.type === 'firma' && billing?.firstName && (
              <Text style={{ fontSize: isCompact ? 8.5 : 9, color: PDF_COLORS.textMuted, marginBottom: 2 }}>
                z.Hd. {billing.firstName}
              </Text>
            )}
            <Text style={isCompact ? styles.customerAddress : [styles.customerAddress, styles.customerAddressComfort]}>
              {billing?.street ? `${billing.street} ${billing.houseNr || ''}`.trim() : billing?.address?.split(',')[0] || ''}
            </Text>
            <Text style={isCompact ? styles.customerAddress : [styles.customerAddress, styles.customerAddressComfort]}>
              {billing?.zip ? `${billing.zip} ${billing.city || ''}`.trim() : billing?.address?.split(',')[1]?.trim() || ''}
            </Text>
          </View>

          {/* Right: Document Meta Box */}
          <View style={isCompact ? styles.docInfoBox : [styles.docInfoBox, styles.docInfoBoxComfort]}>
            <View style={isCompact ? styles.docRow : [styles.docRow, styles.docRowComfort]}>
              <Text style={isCompact ? styles.docLabel : [styles.docLabel, styles.docLabelComfort]}>{isStorno ? 'Stornonummer' : 'Rechnungsnummer'}</Text>
              <Text style={isCompact ? styles.docValue : [styles.docValue, styles.docValueComfort]}>{order?.invoiceNumber || 'Entwurf'}</Text>
            </View>
            <View style={isCompact ? styles.docRow : [styles.docRow, styles.docRowComfort]}>
              <Text style={isCompact ? styles.docLabel : [styles.docLabel, styles.docLabelComfort]}>Rechnungsdatum</Text>
              <Text style={isCompact ? styles.docValue : [styles.docValue, styles.docValueComfort]}>
                {order?.invoiceDate
                  ? new Date(order.invoiceDate).toLocaleDateString('de-DE')
                  : new Date().toLocaleDateString('de-DE')}
              </Text>
            </View>
            <View style={isCompact ? styles.docRow : [styles.docRow, styles.docRowComfort]}>
              <Text style={isCompact ? styles.docLabel : [styles.docLabel, styles.docLabelComfort]}>Leistungsdatum</Text>
              <Text style={isCompact ? styles.docValue : [styles.docValue, styles.docValueComfort]}>
                {order?.orderMeta?.movingDateFrom
                  ? new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE')
                  : 'Gemäß Absprache'}
              </Text>
            </View>
            <View style={isCompact ? styles.docRow : [styles.docRow, styles.docRowComfort]}>
              <Text style={isCompact ? styles.docLabel : [styles.docLabel, styles.docLabelComfort]}>Sachbearbeiter</Text>
              <Text style={isCompact ? styles.docValue : [styles.docValue, styles.docValueComfort]}>{employeeName || order?.orderMeta?.manager || settings?.manager || '-'}</Text>
            </View>
            {isStorno && (
              <Text style={styles.stornoBadge}>
                Storno zu Rechnung: {order?.stornoFor || 'Ursprungsrechnung'}
              </Text>
            )}
            {isKorrektur && (
              <Text style={styles.stornoBadge}>
                Korrektur zu Rechnung: {order?.correctionFor || 'Ursprüngliche Rechnung'}
              </Text>
            )}
          </View>
        </View>

        {/* Document Title with generous spacing */}
        <Text style={isCompact ? styles.mainTitle : [styles.mainTitle, styles.mainTitleComfort]}>{isStorno ? 'STORNORECHNUNG' : (isKorrektur ? 'KORREKTURRECHNUNG' : 'RECHNUNG')}</Text>
        
        {/* Intro text */}
        <Text style={isCompact ? styles.introText : [styles.introText, styles.introTextComfort]}>
          {introGreeting}{'\n'}
          {isStorno
            ? `hiermit stornieren wir die Rechnung ${order?.stornoFor || ''}. Der unten ausgewiesene Betrag wird Ihrem Konto gutgeschrieben bzw. gleicht unsere Forderung aus.`
            : isKorrektur
            ? (order?.texts?.invoiceIntro ||
                `hiermit erhalten Sie die Korrekturrechnung zu der stornierten Rechnung ${order?.correctionFor || ''}. Für unsere erbrachten Leistungen stellen wir Ihnen folgenden Betrag in Rechnung:`
              ).replace(/\{\{Kunde_Anrede\}\}/g, introGreeting.replace(',', ''))
            : (order?.texts?.invoiceIntro ||
                settings?.texts?.invoiceIntro ||
                'vielen Dank für Ihren Auftrag. Für unsere erbrachten Leistungen stellen wir Ihnen folgenden Betrag in Rechnung:')
                .replace(/\{\{Kunde_Anrede\}\}/g, introGreeting.replace(',', ''))}
        </Text>

        {/* Umzugswege / Leistungsort Card */}
        {hasRouteInfo && (
          <View style={isCompact ? styles.routeCard : [styles.routeCard, styles.routeCardComfort]}>
            <Text style={isCompact ? styles.routeHeader : [styles.routeHeader, styles.routeHeaderComfort]}>Leistungsort / Umzugswege</Text>
            <View style={styles.routeCols}>
              <View style={styles.routeCol}>
                <Text style={isCompact ? styles.routeText : [styles.routeText, styles.routeTextComfort]}>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>Von: </Text>
                  {order?.logistics?.a_street} {order?.logistics?.a_houseNr}, {order?.logistics?.a_zip} {order?.logistics?.a_city}
                </Text>
              </View>
              <View style={styles.routeCol}>
                <Text style={isCompact ? styles.routeText : [styles.routeText, styles.routeTextComfort]}>
                  <Text style={{ fontFamily: 'Helvetica-Bold' }}>Nach: </Text>
                  {order?.logistics?.b_street} {order?.logistics?.b_houseNr}, {order?.logistics?.b_zip} {order?.logistics?.b_city}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ── LEISTUNGEN TABELLE ── */}
        <View style={isCompact ? styles.table : [styles.table, styles.tableComfort]}>
          <View style={isCompact ? styles.tableHeader : [styles.tableHeader, styles.tableHeaderComfort]} fixed>
            <Text style={isCompact ? styles.colPos : [styles.colPos, styles.colPosComfort]}>Pos.</Text>
            <Text style={isFlat ? styles.colDescFlat : styles.colDesc}>Bezeichnung & Leistungsumfang</Text>
            <Text style={isCompact ? (isFlat ? styles.colQtyFlat : styles.colQty) : [isFlat ? styles.colQtyFlat : styles.colQty, isFlat ? styles.colQtyFlatComfort : styles.colQtyComfort]}>{isFlat ? 'Umfang' : 'Menge'}</Text>
            {!isFlat && (
              <>
                <Text style={isCompact ? styles.colPrice : [styles.colPrice, styles.colPriceComfort]}>Einzelpreis</Text>
                <Text style={isCompact ? styles.colTotal : [styles.colTotal, styles.colTotalComfort]}>Gesamt</Text>
              </>
            )}
          </View>

          {order?.services?.length ? (
            order.services.map((item: any, i: number) => {
              const itemNameLower = (item.name || '').toLowerCase();
              const showExactAmount = isFlat && (itemNameLower.includes('karton') || itemNameLower.includes('einpack'));
              const isItemIncluded = Boolean(item.isIncluded || item.unitPrice === 0);

              return (
                <View key={i} style={isCompact ? styles.tableRow : [styles.tableRow, styles.tableRowComfort]} wrap={false}>
                  <Text style={isCompact ? styles.colPos : [styles.colPos, styles.colPosComfort]}>{i + 1}</Text>
                  <View style={isFlat ? styles.colDescFlat : styles.colDesc}>
                    <Text style={isCompact ? styles.itemName : [styles.itemName, styles.itemNameComfort]}>{item.name}</Text>
                    {item.note ? <Text style={isCompact ? styles.itemNote : [styles.itemNote, styles.itemNoteComfort]}>{item.note}</Text> : null}
                    {item.location && item.location !== 'both' && (
                      <View style={{ marginTop: 2, flexDirection: 'row' }}>
                        <Text style={{ fontSize: 6.8, fontFamily: 'Helvetica-Bold', color: '#8F1627', backgroundColor: '#fdf2f4', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 }}>
                          Ort: {item.location === 'a' ? 'A (Beladung)' : 'B (Entladung)'}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={isCompact ? (isFlat ? styles.colQtyFlat : styles.colQty) : [isFlat ? styles.colQtyFlat : styles.colQty, isFlat ? styles.colQtyFlatComfort : styles.colQtyComfort]}>
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
                      <Text style={isCompact ? styles.colPrice : [styles.colPrice, styles.colPriceComfort]}>
                        {isItemIncluded ? '—' : `${item.unitPrice?.toFixed(2)} €`}
                      </Text>
                      <Text style={isCompact ? styles.colTotal : [styles.colTotal, styles.colTotalComfort]}>
                        {isItemIncluded ? 'Inklusiv' : `${(item.quantity * item.unitPrice)?.toFixed(2)} €`}
                      </Text>
                    </>
                  )}
                </View>
              );
            })
          ) : isStorno ? (
            <View style={isCompact ? styles.tableRow : [styles.tableRow, styles.tableRowComfort]} wrap={false}>
              <Text style={isCompact ? styles.colPos : [styles.colPos, styles.colPosComfort]}>1</Text>
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

        {/* ── FINANZEN & ZAHLUNG (Adaptive: Compact Side-by-Side vs. Comfort Stacked) ── */}
        {isCompact ? (
          <View style={styles.financeRow} wrap={false}>
            {/* Left Column: Zahlungsinformationen */}
            <View style={styles.paymentCol}>
              <Text style={styles.paymentHeader}>Zahlungsinformationen</Text>

              {isStorno ? (
                <Text style={styles.textBlock}>
                  Der Gutschriftsbetrag wird Ihrem Bankkonto erstattet bzw. mit noch offenen Forderungen verrechnet.
                </Text>
              ) : isFullyPaid ? (
                <Text style={{ ...styles.textBlock, color: PDF_COLORS.success, fontFamily: 'Helvetica-Bold' }}>
                  ✓ Der Rechnungsbetrag wurde bereits vollständig bezahlt. Vielen Dank!
                </Text>
              ) : totalPaid > 0 && remaining > 0 ? (
                <View style={styles.paymentCard}>
                  <View style={styles.bankRow}>
                    <Text style={{ color: PDF_COLORS.textMuted }}>Bereits bezahlt:</Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>{totalPaid.toFixed(2)} €</Text>
                  </View>
                  <View style={{ ...styles.bankRow, borderTopWidth: 0.5, borderTopColor: PDF_COLORS.border, paddingTop: 2, marginTop: 1 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: PDF_COLORS.primary }}>Offener Restbetrag:</Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: PDF_COLORS.primary }}>{remaining.toFixed(2)} €</Text>
                  </View>
                  <View style={{ ...styles.bankRow, marginTop: 2 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>IBAN:</Text>
                    <Text>{settings?.iban || ''}</Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>BIC / Bank:</Text>
                    <Text>{settings?.bic || ''} • {settings?.bankName || ''}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.paymentCard}>
                  <Text style={{ fontSize: 7, color: PDF_COLORS.textMuted, marginBottom: 2 }}>
                    {pmSettings?.textInvoice || invoiceOutro || 'Bitte überweisen Sie den Betrag auf unser Bankkonto:'}
                  </Text>
                  <View style={styles.bankRow}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>IBAN:</Text>
                    <Text>{settings?.iban || ''}</Text>
                  </View>
                  <View style={styles.bankRow}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>BIC / Bank:</Text>
                    <Text>{settings?.bic || ''} • {settings?.bankName || ''}</Text>
                  </View>
                  <View style={{ ...styles.bankRow, borderTopWidth: 0.5, borderTopColor: PDF_COLORS.border, paddingTop: 2, marginTop: 1 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: PDF_COLORS.primary }}>Zahlungsziel:</Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                      {dueDays > 0
                        ? `Bis zum ${dueDate.toLocaleDateString('de-DE')}`
                        : 'Sofort nach Rechnungserhalt'}
                    </Text>
                  </View>
                </View>
              )}

              {invoiceGreeting ? (
                <Text style={{ ...styles.textBlock, marginTop: 3 }}>
                  {invoiceGreeting}
                </Text>
              ) : null}
            </View>

            {/* Right Column: Totals Summary */}
            <View style={styles.totalsCol}>
              <View style={styles.totalRow}>
                <Text>Nettobetrag:</Text>
                <Text>{isStorno ? `-${safeNet.toFixed(2)}` : safeNet.toFixed(2)} €</Text>
              </View>
              <View style={styles.totalRow}>
                <Text>zzgl. 19% MwSt.:</Text>
                <Text>{isStorno ? `-${safeTax.toFixed(2)}` : safeTax.toFixed(2)} €</Text>
              </View>
              <View style={styles.totalRowGrand}>
                <Text>{isStorno ? 'Gutschriftsbetrag:' : 'Gesamtbetrag:'}</Text>
                <Text>{isStorno ? `-${safeGross.toFixed(2)}` : safeGross.toFixed(2)} €</Text>
              </View>
            </View>
          </View>
        ) : (
          <View wrap={false}>
            {/* Totals Box on Right */}
            <View style={styles.totalsWrapperComfort}>
              <View style={styles.totalsColComfort}>
                <View style={styles.totalRowComfort}>
                  <Text>Nettobetrag:</Text>
                  <Text>{isStorno ? `-${safeNet.toFixed(2)}` : safeNet.toFixed(2)} €</Text>
                </View>
                <View style={styles.totalRowComfort}>
                  <Text>zzgl. 19% MwSt.:</Text>
                  <Text>{isStorno ? `-${safeTax.toFixed(2)}` : safeTax.toFixed(2)} €</Text>
                </View>
                <View style={styles.totalRowGrandComfort}>
                  <Text>{isStorno ? 'Gutschriftsbetrag:' : 'Gesamtbetrag:'}</Text>
                  <Text>{isStorno ? `-${safeGross.toFixed(2)}` : safeGross.toFixed(2)} €</Text>
                </View>
                {totalPaid > 0 && remaining > 0 && !isStorno && (
                  <>
                    <View style={{ ...styles.totalRowComfort, borderTopWidth: 0.5, borderTopColor: PDF_COLORS.border, paddingTop: 3, marginTop: 2 }}>
                      <Text>Bereits bezahlt:</Text>
                      <Text>-{totalPaid.toFixed(2)} €</Text>
                    </View>
                    <View style={{ ...styles.totalRowGrandComfort, paddingTop: 3, marginTop: 2, fontSize: 10 }}>
                      <Text>Restbetrag offen:</Text>
                      <Text>{remaining.toFixed(2)} €</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Payment Information Card (Full Width) */}
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.paymentHeaderComfort}>Zahlungsinformationen</Text>

              {isStorno ? (
                <Text style={styles.textBlockComfort}>
                  Der Gutschriftsbetrag wird Ihrem Bankkonto erstattet bzw. mit noch offenen Forderungen verrechnet.
                </Text>
              ) : isFullyPaid ? (
                <Text style={{ ...styles.textBlockComfort, color: PDF_COLORS.success, fontFamily: 'Helvetica-Bold' }}>
                  ✓ Der Rechnungsbetrag wurde bereits vollständig bezahlt. Vielen Dank!
                </Text>
              ) : (
                <View style={styles.paymentCardComfort}>
                  <Text style={{ fontSize: 8, color: PDF_COLORS.textMuted, marginBottom: 3 }}>
                    {pmSettings?.textInvoice || invoiceOutro || 'Bitte überweisen Sie den fälligen Rechnungsbetrag auf unser Bankkonto:'}
                  </Text>
                  <View style={styles.bankRowComfort}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                      Kontoinhaber: <Text style={{ fontFamily: 'Helvetica' }}>{settings?.companyName || 'Rothirsch Umzug'}</Text>
                    </Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                      Kreditinstitut: <Text style={{ fontFamily: 'Helvetica' }}>{settings?.bankName || 'Sparkasse'}</Text>
                    </Text>
                  </View>
                  <View style={styles.bankRowComfort}>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                      IBAN: <Text style={{ fontFamily: 'Helvetica' }}>{settings?.iban || ''}</Text>
                    </Text>
                    <Text style={{ fontFamily: 'Helvetica-Bold' }}>
                      BIC: <Text style={{ fontFamily: 'Helvetica' }}>{settings?.bic || ''}</Text>
                    </Text>
                  </View>
                  <View style={{ ...styles.bankRowComfort, borderTopWidth: 0.5, borderTopColor: PDF_COLORS.border, paddingTop: 3, marginTop: 1 }}>
                    <Text style={{ fontFamily: 'Helvetica-Bold', color: PDF_COLORS.primary }}>
                      Zahlungsziel:{' '}
                      <Text style={{ fontFamily: 'Helvetica' }}>
                        {dueDays > 0
                          ? `Bis zum ${dueDate.toLocaleDateString('de-DE')}`
                          : 'Sofort nach Rechnungserhalt'}
                      </Text>
                    </Text>
                    <Text style={{ color: PDF_COLORS.textMuted }}>
                      Zahlungsart: {order?.orderMeta?.paymentMethod || 'Überweisung'}
                    </Text>
                  </View>
                </View>
              )}

              {invoiceGreeting ? (
                <Text style={styles.textBlockComfort}>
                  {invoiceGreeting}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Gesetzliche Hinweise (§ 14b Abs. 1 UStG & § 35a EStG) */}
        {!isStorno && (
          <View style={isCompact ? styles.legalNoticeBox : [styles.legalNoticeBox, styles.legalNoticeBoxComfort]} wrap={false}>
            {billing?.type !== 'firma' ? (
              <Text style={isCompact ? styles.legalNoticeText : [styles.legalNoticeText, styles.legalNoticeTextComfort]}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Hinweis (§ 14b UStG): </Text>
                Gesetzliche 2-jährige Aufbewahrungsfrist für Privatpersonen. • 
                <Text style={{ fontFamily: 'Helvetica-Bold' }}> Steuerabzug (§ 35a EStG): </Text>
                Umzugskosten (Arbeitslohn) sind steuerlich absetzbar (Zahlung per Überweisung).
              </Text>
            ) : (
              <Text style={isCompact ? styles.legalNoticeText : [styles.legalNoticeText, styles.legalNoticeTextComfort]}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>Hinweis (§ 14b UStG): </Text>
                Für Unternehmer gilt die gesetzliche Aufbewahrungsfrist von 8 Jahren (gem. § 14b Abs. 1 UStG / BEG IV).
              </Text>
            )}
          </View>
        )}
      </Page>
    </Document>
  );
};
