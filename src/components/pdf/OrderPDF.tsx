import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { calculateOrderTotals } from '@/lib/financeHelpers';
import { PDF_COLORS, pdfCommonStyles } from './core/pdfTheme';
import { PDFHeader } from './core/PDFHeader';
import { PDFFooter } from './core/PDFFooter';
import { PDFWatermark } from './core/PDFWatermark';
import { PDFServiceShowcase } from './core/PDFServiceShowcase';

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
    backgroundColor: '#ffffff',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 4,
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
  
  // Umzugsdaten Card (Protected with crisp solid white background so no symbols obstruct addresses)
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
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeCols: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  routeCol: {
    width: '48%',
  },
  routeTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMain,
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 8.5,
    color: PDF_COLORS.textMain,
    marginBottom: 2,
  },
  routeMeta: {
    fontSize: 7.5,
    color: PDF_COLORS.textMuted,
    lineHeight: 1.3,
  },
  routeBadge: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginTop: 2,
  },
  
  // Table Columns
  colPos: { width: '7%', textAlign: 'center', paddingTop: 1, fontFamily: 'Helvetica-Bold', color: '#8F1627' },
  colDesc: { width: '49%', paddingRight: 8 },
  colDescFlat: { width: '71%', paddingRight: 8 },
  colQty: { width: '14%', textAlign: 'center', paddingTop: 1 },
  colQtyFlat: { width: '22%', textAlign: 'center', paddingTop: 1 },
  colPrice: { width: '15%', textAlign: 'right', paddingTop: 1 },
  colTotal: { width: '15%', textAlign: 'right', paddingTop: 1, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  
  itemName: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0f172a',
    lineHeight: 1.25,
  },
  itemNote: {
    fontSize: 8,
    color: '#475569',
    marginTop: 2.5,
    lineHeight: 1.35,
  },
  
  textBlock: {
    fontSize: 8.5,
    lineHeight: 1.5,
    color: PDF_COLORS.textMain,
    marginBottom: 12,
  },
  
  detailsSectionHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginTop: 14,
    marginBottom: 7,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.borderLight,
    paddingBottom: 3,
  },
  
  signatureBox: {
    marginTop: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sigLine: {
    width: '45%',
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.textMain,
    paddingTop: 5,
    fontSize: 8.5,
    textAlign: 'center',
    color: PDF_COLORS.textMuted,
  },
  
  agbTitle: {
    fontSize: 11.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginTop: 4,
    marginBottom: 12,
    textAlign: 'center',
  },
  agbColumnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  agbColumn: {
    width: '48%',
  },
  agbText: {
    fontSize: 6.8,
    lineHeight: 1.3,
    textAlign: 'justify',
    color: '#475569',
  },
  
  agbSignatureBox: {
    marginTop: 20,
    alignItems: 'flex-end',
  },
  agbSigLine: {
    width: '55%',
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.textMain,
    paddingTop: 4,
    fontSize: 8,
    textAlign: 'center',
    color: PDF_COLORS.textMuted,
  }
});

export const OrderPDF = ({
  order,
  customer,
  settings,
  isContract = false,
  employeeName,
}: {
  order: any;
  customer: any;
  settings: any;
  isContract?: boolean;
  employeeName?: string;
}) => {
  const isFlat = order?.isFlatRate;
  const billing = order?.billingAddress || customer;

  const docTypeTitle = isContract ? 'Auftragsbestätigung' : 'Angebot';
  const docNum = isContract
    ? order?.contractNumber || order?.orderNumber || 'Entwurf'
    : order?.orderNumber || 'Entwurf';
  const docFullTitle = `${docTypeTitle} ${docNum} - ${billing?.lastName || 'Kunde'}`;

  // Personalisierte Anrede
  const salutation = billing?.salutation || customer?.salutation;
  let introText = isContract
    ? order?.texts?.orderIntro || settings?.texts?.orderIntro || ''
    : order?.texts?.quoteIntro || settings?.texts?.quoteIntro || '';

  let kundeAnredeStr = 'Sehr geehrte Damen und Herren,';
  if (salutation === 'Herr' && billing?.lastName) {
    kundeAnredeStr = `Sehr geehrter Herr ${billing.lastName},`;
  } else if (salutation === 'Frau' && billing?.lastName) {
    kundeAnredeStr = `Sehr geehrte Frau ${billing.lastName},`;
  }

  // Replace variable or fallback
  if (introText.includes('{{Kunde_Anrede}}')) {
    introText = introText.replace(/\{\{Kunde_Anrede\}\}/g, kundeAnredeStr);
  } else {
    introText = introText.replace(/Sehr geehrte Damen und Herren,?/gi, kundeAnredeStr);
  }

  const outroText = isContract
    ? order?.texts?.orderOutro || settings?.texts?.orderOutro || ''
    : order?.texts?.quoteOutro || settings?.texts?.quoteOutro || '';
  const greetingText = isContract
    ? order?.texts?.orderGreeting || settings?.texts?.orderGreeting || ''
    : order?.texts?.quoteGreeting || settings?.texts?.quoteGreeting || '';

  const pmSettings =
    settings?.paymentMethods?.find((p: any) => p.name === order?.orderMeta?.paymentMethod) ||
    settings?.paymentMethods?.[0];
  const paymentTerms = order?.texts?.paymentTerms || pmSettings?.textQuote || '';

  // AGB Splitting into two equal columns
  const agbFullText = settings?.texts?.agb || '';
  const midpoint = Math.floor(agbFullText.length / 2);
  const splitIndex = agbFullText.indexOf(' ', midpoint) !== -1 ? agbFullText.indexOf(' ', midpoint) : midpoint;
  const agbLeft = agbFullText.substring(0, splitIndex);
  const agbRight = agbFullText.substring(splitIndex);

  const { net, tax, gross } = calculateOrderTotals(order);

  const hasRouteInfo = order?.logistics?.a_city || order?.logistics?.b_city;

  return (
    <Document title={docFullTitle}>
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* PAGE 1: Header, Route Details (BEFORE Table), Services & Pricing Summary  */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PDFWatermark pageVariant="page1" />
        <PDFHeader settings={settings} docTitle={docTypeTitle} />
        <PDFFooter settings={settings} />

        {/* Recipient Window & Document Meta Box */}
        <View style={styles.customerDateBox}>
          {/* Left: Clean Customer Address (NO "Auftraggeber" label!) */}
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
              <Text style={styles.docLabel}>{isContract ? 'Auftragsnummer' : 'Angebotsnummer'}</Text>
              <Text style={styles.docValue}>{docNum}</Text>
            </View>
            <View style={styles.docRow}>
              <Text style={styles.docLabel}>Datum</Text>
              <Text style={styles.docValue}>
                {order?.documentDate
                  ? new Date(order.documentDate).toLocaleDateString('de-DE')
                  : order?.createdAt
                  ? typeof order.createdAt.toDate === 'function'
                    ? order.createdAt.toDate().toLocaleDateString('de-DE')
                    : new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleDateString('de-DE')
                  : new Date().toLocaleDateString('de-DE')}
              </Text>
            </View>
            <View style={styles.docRow}>
              <Text style={styles.docLabel}>Umzugstermin</Text>
              <Text style={styles.docValue}>
                {order?.orderMeta?.movingDateFrom
                  ? new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE')
                  : 'Nach Absprache'}
                {order?.orderMeta?.movingDateTo
                  ? ` - ${new Date(order.orderMeta.movingDateTo).toLocaleDateString('de-DE')}`
                  : ''}
              </Text>
            </View>
            <View style={styles.docRow}>
              <Text style={styles.docLabel}>Gültig bis</Text>
              <Text style={styles.docValue}>
                {order?.orderMeta?.validUntil
                  ? new Date(order.orderMeta.validUntil).toLocaleDateString('de-DE')
                  : '-'}
              </Text>
            </View>
            {employeeName && (
              <View style={styles.docRow}>
                <Text style={styles.docLabel}>Sachbearbeiter</Text>
                <Text style={styles.docValue}>{employeeName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Document Title with generous spacing */}
        <Text style={styles.mainTitle}>{isContract ? 'Auftragsbestätigung' : 'Angebot'}</Text>
        
        {/* Intro text (Sehr geehrte...) with clear distance from title */}
        <Text style={styles.introText}>{introText}</Text>

        {/* ── UMZUGSDETAILS & ADRESSEN (Placed BEFORE the services table) ── */}
        {hasRouteInfo && (
          <View style={styles.routeCard}>
            <Text style={styles.routeHeader}>Umzugsdaten & Einsatzorte</Text>
            <View style={styles.routeCols}>
              {/* Beladestelle (Auszug) */}
              <View style={styles.routeCol}>
                <Text style={styles.routeTitle}>Auszugsort (Beladestelle):</Text>
                <Text style={styles.routeAddress}>
                  {order?.logistics?.a_street} {order?.logistics?.a_houseNr}, {order?.logistics?.a_zip} {order?.logistics?.a_city}
                </Text>
                <Text style={styles.routeMeta}>
                  {order?.logistics?.a_type ? `${order.logistics.a_type} • ` : ''}
                  Etage: {order?.logistics?.a_floor || 'k.A.'} {order?.logistics?.a_elevator ? '(Aufzug)' : '(ohne Aufzug)'}
                  {order?.logistics?.a_distance ? ` • Laufweg: ${order.logistics.a_distance}m` : ' • Laufweg: < 10m'}
                </Text>
                {(order?.logistics?.a_furnitureLift || order?.logistics?.a_parking) && (
                  <Text style={styles.routeBadge}>
                    {[
                      order?.logistics?.a_furnitureLift ? 'Möbellift gebucht' : null,
                      order?.logistics?.a_parking ? 'Halteverbotszone' : null,
                    ].filter(Boolean).join(' | ')}
                  </Text>
                )}
              </View>

              {/* Entladestelle (Einzug) */}
              <View style={styles.routeCol}>
                <Text style={styles.routeTitle}>Einzugsort (Entladestelle):</Text>
                <Text style={styles.routeAddress}>
                  {order?.logistics?.b_street} {order?.logistics?.b_houseNr}, {order?.logistics?.b_zip} {order?.logistics?.b_city}
                </Text>
                <Text style={styles.routeMeta}>
                  {order?.logistics?.b_type ? `${order.logistics.b_type} • ` : ''}
                  Etage: {order?.logistics?.b_floor || 'k.A.'} {order?.logistics?.b_elevator ? '(Aufzug)' : '(ohne Aufzug)'}
                  {order?.logistics?.b_distance ? ` • Laufweg: ${order.logistics.b_distance}m` : ' • Laufweg: < 10m'}
                </Text>
                {(order?.logistics?.b_furnitureLift || order?.logistics?.b_parking) && (
                  <Text style={styles.routeBadge}>
                    {[
                      order?.logistics?.b_furnitureLift ? 'Möbellift gebucht' : null,
                      order?.logistics?.b_parking ? 'Halteverbotszone' : null,
                    ].filter(Boolean).join(' | ')}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* ── LEISTUNGEN TABELLE ── */}
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.colPos}>Pos.</Text>
            <Text style={isFlat ? styles.colDescFlat : styles.colDesc}>Bezeichnung & Leistungsumfang</Text>
            <Text style={isFlat ? styles.colQtyFlat : styles.colQty}>{isFlat ? 'Umfang' : 'Menge'}</Text>
            {!isFlat && (
              <>
                <Text style={styles.colPrice}>Einzelpreis</Text>
                <Text style={styles.colTotal}>Gesamt</Text>
              </>
            )}
          </View>

          {order?.services?.map((item: any, i: number) => {
            const itemNameLower = (item.name || '').toLowerCase();
            const showExactAmount = isFlat && (itemNameLower.includes('karton') || itemNameLower.includes('einpack'));

            return (
              <View key={i} style={styles.tableRow} wrap={false}>
                <Text style={styles.colPos}>{i + 1}</Text>
                <View style={isFlat ? styles.colDescFlat : styles.colDesc}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
                  {item.location && item.location !== 'both' && (
                    <View style={{ marginTop: 2, flexDirection: 'row' }}>
                      <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#8F1627', backgroundColor: '#fdf2f4', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2 }}>
                        Ort: {item.location === 'a' ? 'A (Beladung)' : 'B (Entladung)'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={isFlat ? styles.colQtyFlat : styles.colQty}>
                  {isFlat
                    ? showExactAmount
                      ? `${item.quantity} ${item.unit}`
                      : 'Inklusiv'
                    : `${item.quantity} ${item.unit}`}
                </Text>
                {!isFlat && (
                  <>
                    <Text style={styles.colPrice}>
                      {item.isIncluded ? '—' : `${item.unitPrice?.toFixed(2)} €`}
                    </Text>
                    <Text style={styles.colTotal}>
                      {item.isIncluded ? 'Inklusiv' : `${(item.quantity * item.unitPrice)?.toFixed(2)} €`}
                    </Text>
                  </>
                )}
              </View>
            );
          })}
        </View>

        {/* Totals Summary */}
        <View style={styles.totalsContainer} wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text>Nettobetrag:</Text>
              <Text>{net.toFixed(2)} €</Text>
            </View>
            <View style={styles.totalRow}>
              <Text>zzgl. 19% MwSt.:</Text>
              <Text>{tax.toFixed(2)} €</Text>
            </View>
            <View style={styles.totalRowGrand}>
              <Text>Gesamtbetrag (inkl. MwSt.):</Text>
              <Text>{gross.toFixed(2)} €</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* PAGE 2: Terms, Insurance, Payment Conditions & Customer Signature          */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PDFWatermark pageVariant="page2" />
        <PDFHeader settings={settings} minimal docTitle={isContract ? 'Auftragsdetails & Bestätigung' : 'Angebotsdetails & Bestätigung'} />
        <PDFFooter settings={settings} />

        <Text style={styles.detailsSectionHeader}>
          {order?.texts?.insuranceTitle || settings?.texts?.insuranceTitle || 'Versicherungsschutz'}
        </Text>
        <Text style={styles.textBlock}>
          {settings?.texts?.insurance ||
            'Mit unserer Transportgüterversicherung ist Ihr Umzugsgut optimal abgesichert. Für diesen Transport deckt unser Unternehmen eine Haftung gem. § 451g HGB mit bis zu 620,00 € je Kubikmeter Ladevolumen ab.'}
        </Text>

        {paymentTerms ? (
          <>
            <Text style={styles.detailsSectionHeader}>
              {order?.texts?.paymentTermsTitle || settings?.texts?.paymentTermsTitle || 'Zahlungsinformationen'}
            </Text>
            <Text style={styles.textBlock}>{paymentTerms}</Text>
          </>
        ) : null}

        <Text style={styles.detailsSectionHeader}>
          {order?.texts?.quoteBindingTitle || settings?.texts?.quoteBindingTitle || (isContract ? 'Auftragsbestätigung & Unterschrift' : 'Verbindliche Beauftragung')}
        </Text>
        <Text style={styles.textBlock}>
          {outroText ||
            'Mit Ihrer Unterschrift bestätigen Sie die verbindliche Beauftragung der auf Seite 1 detaillierten Leistungen und erkennen unsere Allgemeinen Geschäftsbedingungen sowie die gesetzlichen Haftungsregelungen des Möbelspediteurs (§ 451g HGB) an.'}
        </Text>

        {greetingText && !outroText.includes(greetingText) && (
          <Text style={{ ...styles.textBlock, marginTop: 4 }}>{greetingText}</Text>
        )}

        {/* Signature Box */}
        <View style={styles.signatureBox} wrap={false}>
          <View style={styles.sigLine}>
            <Text>
              {order?.signatureOrderPlace
                ? `${order.signatureOrderPlace}, den ${order.signatureOrderDateString}`
                : 'Ort, Datum'}
            </Text>
          </View>
          <View style={styles.sigLine}>
            {order?.signatureOrder ? (
              <Image
                src={order.signatureOrder}
                style={{ height: 40, marginTop: -32, objectFit: 'contain', alignSelf: 'center' }}
              />
            ) : (
              <Text>Unterschrift Auftraggeber</Text>
            )}
          </View>
        </View>

        {/* Core Service Portfolio Showcase: Nur anzeigen, wenn in Schritt 5 explizit aktiviert. Platziert HINTER der Unterschrift zur Vermeidung von Missverständnissen. */}
        {order?.showServicePortfolioInPDF && (
          <PDFServiceShowcase
            title={order?.showcaseTexts?.title || settings?.showcaseTexts?.title}
            subtitle={order?.showcaseTexts?.subtitle || settings?.showcaseTexts?.subtitle}
            disclaimer={order?.showcaseTexts?.disclaimer || settings?.showcaseTexts?.disclaimer}
            services={order?.showcaseServices || settings?.showcaseServices}
          />
        )}
      </Page>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* PAGE 3: Allgemeine Geschäftsbedingungen (AGB)                             */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      <Page size="A4" style={styles.page}>
        <PDFWatermark pageVariant="agb" />
        <PDFHeader settings={settings} minimal docTitle="Allgemeine Geschäftsbedingungen" />
        <PDFFooter settings={settings} />

        <Text style={styles.agbTitle}>Allgemeine Geschäftsbedingungen (AGB)</Text>

        <View style={styles.agbColumnsContainer}>
          <View style={styles.agbColumn}>
            <Text style={styles.agbText}>{agbLeft}</Text>
          </View>
          <View style={styles.agbColumn}>
            <Text style={styles.agbText}>{agbRight}</Text>
          </View>
        </View>

        <View style={styles.agbSignatureBox} wrap={false}>
          <View style={styles.agbSigLine}>
            {order?.signatureAGB ? (
              <>
                <Image
                  src={order.signatureAGB}
                  style={{ height: 35, marginTop: -28, objectFit: 'contain', alignSelf: 'center' }}
                />
                <Text style={{ fontSize: 8, marginTop: 4 }}>
                  {order.signatureAGBPlace}, den {order.signatureAGBDateString}
                </Text>
              </>
            ) : (
              <Text style={{ fontSize: 8 }}>Ort, Datum & Unterschrift (AGBs gelesen & akzeptiert)</Text>
            )}
          </View>
        </View>
      </Page>

      {/* ───────────────────────────────────────────────────────────────────────── */}
      {/* OPTIONAL PAGE 4: Inventarliste / Umzugsgut                                */}
      {/* ───────────────────────────────────────────────────────────────────────── */}
      {order?.appendInventoryToPDF && order?.inventory?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PDFWatermark pageVariant="dense" />
          <PDFHeader settings={settings} minimal docTitle="Anlage: Umzugsgut / Inventarliste" />
          <PDFFooter settings={settings} />

          <Text style={styles.detailsSectionHeader}>Anlage: Umzugsgut / Inventarliste</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader} fixed>
              <Text style={{ width: '45%' }}>Möbelstück / Karton</Text>
              <Text style={{ width: '40%' }}>Serviceleistungen</Text>
              <Text style={{ width: '15%', textAlign: 'center' }}>Stück</Text>
            </View>
            {Object.entries(
              order.inventory.reduce((acc: any, item: any) => {
                const room = item.room || 'Allgemein';
                if (!acc[room]) acc[room] = [];
                acc[room].push(item);
                return acc;
              }, {})
            ).map(([room, items]: [string, any], rIdx: number) => (
              <React.Fragment key={rIdx}>
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: '#ffffff',
                    padding: '4px 6px',
                    borderBottomWidth: 1,
                    borderBottomColor: PDF_COLORS.border,
                  }}
                  wrap={false}
                >
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: PDF_COLORS.primary }}>
                    {room.toUpperCase()}
                  </Text>
                </View>
                {items.map((item: any, i: number) => {
                  const services = [
                    item.disassembly ? `${item.disassembly}x Abbau` : null,
                    item.assembly ? `${item.assembly}x Aufbau` : null,
                    item.disconnection ? `${item.disconnection}x Abklemmen` : null,
                    item.connection ? `${item.connection}x Anschluss` : null,
                  ]
                    .filter(Boolean)
                    .join(' | ');

                  return (
                    <View key={`${rIdx}-${i}`} style={styles.tableRow} wrap={false}>
                      <View style={{ width: '45%' }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.note && item.showNoteInPdf !== false && (
                          <Text style={styles.itemNote}>Notiz: {item.note}</Text>
                        )}
                      </View>
                      <View style={{ width: '40%' }}>
                        <Text style={{ fontSize: 8, color: PDF_COLORS.textMuted }}>{services || '—'}</Text>
                      </View>
                      <Text style={{ width: '15%', textAlign: 'center', fontSize: 8.5 }}>{item.quantity}</Text>
                    </View>
                  );
                })}
              </React.Fragment>
            ))}
          </View>
        </Page>
      )}
    </Document>
  );
};
