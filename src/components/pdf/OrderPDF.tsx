import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  logoBox: { width: 120 },
  logoTextPrimary: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#8F1627' },
  logoTextSecondary: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  logoCity: { fontSize: 10 },
  headerRight: { textAlign: 'right', width: 200 },
  docType: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#8F1627', marginBottom: 5 },
  docNumLabel: { fontSize: 9, color: '#666' },
  docNum: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  line: { borderBottomWidth: 1, borderBottomColor: '#8F1627', marginBottom: 20 },
  companyLine: { fontSize: 8, color: '#666', marginBottom: 15 },
  
  customerDateBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  customerBox: { width: '50%' },
  customerTitle: { fontSize: 9, color: '#666', marginBottom: 3 },
  customerText: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  customerAddress: { fontSize: 10 },
  
  dateBox: { width: '40%' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  dateLabel: { color: '#666' },
  dateValue: { fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  
  introText: { marginBottom: 20, lineHeight: 1.4 },
  
  table: { width: '100%', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 5, marginBottom: 5, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
  col1: { width: '10%' },
  col2: { width: '60%' },
  col3: { width: '30%', textAlign: 'right' },
  
  totals: { alignItems: 'flex-end', marginBottom: 30 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: '40%', marginBottom: 5 },
  totalRowBold: { flexDirection: 'row', justifyContent: 'space-between', width: '40%', marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#333', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  
  textBlock: { marginBottom: 20, lineHeight: 1.4 },
  
  detailsHeader: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#8F1627', marginBottom: 15, marginTop: 20 },
  addressBox: { flexDirection: 'row', marginBottom: 15 },
  arrow: { width: 30, fontSize: 20, color: '#8F1627', fontFamily: 'Helvetica-Bold' },
  addressContent: { flex: 1 },
  addressTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 5 },
  addressGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  addressItem: { width: '50%', marginBottom: 5 },
  addressLabel: { color: '#666', fontSize: 9 },
  
  signatureBox: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' },
  sigLine: { width: '45%', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 5, fontSize: 9, textAlign: 'center' },
  
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  
  agbTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10 },
  agbText: { fontSize: 7, lineHeight: 1.3 }
});

export const OrderPDF = ({ order, customer, settings, isContract = false }: { order: any, customer: any, settings: any, isContract?: boolean }) => {
  const isFlat = order?.isFlatRate;
  const billing = order?.billingAddress || customer;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoTextSecondary}>RU</Text>
            <Text style={styles.logoTextPrimary}>{settings?.companyName || 'Dein Unternehmen'}</Text>
            <Text style={styles.logoCity}>{settings?.city || 'Bochum'}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docType}>{isContract ? 'Auftragsbestätigung' : 'Angebot'}</Text>
            <Text style={styles.docNumLabel}>{isContract ? 'Auftragsnummer' : 'Angebotsnummer'}</Text>
            <Text style={styles.docNum}>{isContract ? (order?.contractNumber || 'Entwurf') : (order?.orderNumber || 'Entwurf')}</Text>
          </View>
        </View>

        <View style={styles.line} />

        <Text style={styles.companyLine}>
          {settings?.companyName} • {settings?.street} • {settings?.zip} {settings?.city}
        </Text>

        <View style={styles.customerDateBox}>
          <View style={styles.customerBox}>
            <Text style={styles.customerTitle}>Auftraggeber</Text>
            <Text style={styles.customerText}>{billing?.type === 'firma' ? billing?.lastName : `${billing?.firstName} ${billing?.lastName}`.trim()}</Text>
            {billing?.type === 'firma' && billing?.firstName && (
              <Text style={{ fontSize: 9, color: '#444', marginBottom: 2 }}>z.Hd. {billing.firstName}</Text>
            )}
            <Text style={styles.customerAddress}>
              {billing?.street ? `${billing.street} ${billing.houseNr || ''}`.trim() : (billing?.address?.split(',')[0] || '')}
            </Text>
            <Text style={styles.customerAddress}>
              {billing?.zip ? `${billing.zip} ${billing.city || ''}`.trim() : (billing?.address?.split(',')[1]?.trim() || '')}
            </Text>
          </View>
          <View style={styles.dateBox}>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Datum</Text>
              <Text style={styles.dateValue}>{order?.createdAt?.toDate().toLocaleDateString('de-DE') || new Date().toLocaleDateString('de-DE')}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Umzug</Text>
              <Text style={styles.dateValue}>
                {order?.orderMeta?.movingDateFrom ? new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE') : 'Nach Absprache'}
                {order?.orderMeta?.movingDateTo ? ` - ${new Date(order.orderMeta.movingDateTo).toLocaleDateString('de-DE')}` : ''}
              </Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Gültig</Text>
              <Text style={styles.dateValue}>{order?.orderMeta?.validUntil ? new Date(order.orderMeta.validUntil).toLocaleDateString('de-DE') : '-'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.introText}>
          {isContract ? (order?.texts?.orderIntro || settings?.texts?.orderIntro) : (order?.texts?.quoteIntro || settings?.texts?.quoteIntro)}
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Pos.</Text>
            <Text style={styles.col2}>Bezeichnung</Text>
            <Text style={styles.col3}>Umfang</Text>
          </View>
          {order?.services?.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{i + 1}</Text>
              <Text style={styles.col2}>{item.name}</Text>
              <Text style={styles.col3}>
                {isFlat ? 'Inklusiv' : `${item.quantity} ${item.unit} à €${item.unitPrice.toFixed(2)}`}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Summe Netto:</Text>
            <Text>{order?.totals?.net?.toFixed(2)} €</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>MwSt. 19%:</Text>
            <Text>{order?.totals?.tax?.toFixed(2)} €</Text>
          </View>
          <View style={styles.totalRowBold}>
            <Text>Gesamtbetrag (inkl. MwSt.)</Text>
            <Text>{order?.totals?.gross?.toFixed(2)} €</Text>
          </View>
        </View>

        <Text style={styles.textBlock}>
          {isContract ? (order?.texts?.orderOutro || settings?.texts?.orderOutro) : (order?.texts?.quoteOutro || settings?.texts?.quoteOutro)}
        </Text>
        
        <Text style={styles.textBlock}>
          {isContract ? (order?.texts?.orderGreeting || settings?.texts?.orderGreeting) : (order?.texts?.quoteGreeting || settings?.texts?.quoteGreeting)}
        </Text>

        <View style={styles.footer}>
          <View>
            <Text>Unternehmen: {settings?.companyName}</Text>
            <Text>{settings?.street}, {settings?.zip} {settings?.city}</Text>
          </View>
          <View>
            <Text>Bank: {settings?.bankName}</Text>
            <Text>IBAN: {settings?.iban}</Text>
          </View>
          <View>
            <Text>Tel: {settings?.phone}</Text>
            <Text>Steuer-Nr: {settings?.taxId}</Text>
          </View>
        </View>
      </Page>

      {/* Page 2: Details & Signature */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.detailsHeader}>Auftragsdetails & Bestätigung</Text>

        <View style={styles.addressBox}>
          <Text style={styles.arrow}>↑</Text>
          <View style={styles.addressContent}>
            <Text style={styles.addressTitle}>Auszugsort</Text>
            <View style={styles.addressGrid}>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Adresse:</Text><Text>{order?.logistics?.a_street} {order?.logistics?.a_houseNr}, {order?.logistics?.a_zip} {order?.logistics?.a_city}</Text></View>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Immo-Art:</Text><Text>{order?.logistics?.a_type || 'k.A.'}</Text></View>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Etage:</Text><Text>{order?.logistics?.a_floor || 'k.A.'} {order?.logistics?.a_elevator ? '(mit Aufzug)' : '(ohne Aufzug)'}</Text></View>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Laufweg:</Text><Text>{!order?.logistics?.a_distance ? 'Unter 10 Meter' : `${order.logistics.a_distance} Meter`}</Text></View>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Halteverbot:</Text><Text>{order?.logistics?.a_parking ? 'Ja' : 'Nein / Bauseits'}</Text></View>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Möbellift:</Text><Text>{order?.logistics?.a_furnitureLift ? 'Ja (wird gestellt)' : 'Nein'}</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.addressBox}>
          <Text style={styles.arrow}>↓</Text>
          <View style={styles.addressContent}>
            <Text style={styles.addressTitle}>Einzugsort</Text>
            <View style={styles.addressGrid}>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Adresse:</Text><Text>{order?.logistics?.b_street} {order?.logistics?.b_houseNr}, {order?.logistics?.b_zip} {order?.logistics?.b_city}</Text></View>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Immo-Art:</Text><Text>{order?.logistics?.b_type || 'k.A.'}</Text></View>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Etage:</Text><Text>{order?.logistics?.b_floor || 'k.A.'} {order?.logistics?.b_elevator ? '(mit Aufzug)' : '(ohne Aufzug)'}</Text></View>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Laufweg:</Text><Text>{!order?.logistics?.b_distance ? 'Unter 10 Meter' : `${order.logistics.b_distance} Meter`}</Text></View>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Halteverbot:</Text><Text>{order?.logistics?.b_parking ? 'Ja' : 'Nein / Bauseits'}</Text></View>
              <View style={styles.addressItem}><Text style={styles.addressLabel}>Möbellift:</Text><Text>{order?.logistics?.b_furnitureLift ? 'Ja (wird gestellt)' : 'Nein'}</Text></View>
            </View>
          </View>
        </View>

        <Text style={{ ...styles.detailsHeader, fontSize: 11, marginBottom: 5 }}>Versicherungsschutz</Text>
        <Text style={styles.textBlock}>{settings?.texts?.insurance}</Text>

        <Text style={{ ...styles.detailsHeader, fontSize: 11, marginBottom: 5 }}>Zum Auftrag</Text>
        <Text style={styles.textBlock}>Mit Ihrer Unterschrift bestätigen Sie die Beauftragung und erkennen unsere Allgemeinen Geschäftsbedingungen sowie die gesetzlichen Haftungsregelungen des Möbelspediteurs (§ 451g HGB) an. Wir sichern Ihnen eine professionelle und zuverlässige Durchführung Ihres Umzugs zu.</Text>

        <View style={styles.signatureBox}>
          <View style={styles.sigLine}><Text>Ort, Datum</Text></View>
          <View style={styles.sigLine}><Text>Unterschrift Auftraggeber</Text></View>
        </View>

        <View style={styles.footer}>
          <Text>{settings?.companyName} | Seite 2</Text>
        </View>
      </Page>

      {/* Page 3: AGBs */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.agbTitle}>Allgemeine Geschäftsbedingungen (AGB)</Text>
        <Text style={styles.agbText}>{settings?.texts?.agb}</Text>
        <View style={styles.footer}>
          <Text>{settings?.companyName} | Seite 3</Text>
        </View>
      </Page>

      {/* Optional: Inventarliste */}
      {order?.appendInventoryToPDF && order?.inventory?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <Text style={{ ...styles.detailsHeader, fontSize: 18, marginBottom: 20 }}>Anlage: Umzugsgut / Inventarliste</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={{ width: '20%' }}>Menge</Text>
              <Text style={{ width: '80%' }}>Gegenstand</Text>
            </View>
            {order.inventory.map((item: any, i: number) => (
              <View key={i} style={styles.tableRow}>
                <Text style={{ width: '20%' }}>{item.quantity}x</Text>
                <View style={{ width: '80%' }}>
                  <Text>{item.name}</Text>
                  {item.note && item.showNoteInPdf !== false && (
                    <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>Notiz: {item.note}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
          <View style={styles.footer}>
            <Text>{settings?.companyName} | Anlage: Inventarliste</Text>
          </View>
        </Page>
      )}
    </Document>
  );
};
