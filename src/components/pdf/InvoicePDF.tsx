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
  
  footerBlocks: { marginTop: 40, flexDirection: 'row', justifyContent: 'space-between' },
  footerCol: { width: '30%' },
  footerTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 5, color: '#8F1627' },
  footerText: { fontSize: 9, marginBottom: 2, color: '#666' }
});

export const InvoicePDF = ({ order, customer, settings }: { order: any, customer: any, settings: any }) => {
  const isFlat = order?.isFlatRate;
  const isStorno = order?.isStorno;
  const billing = order?.billingAddress || customer;
  
  // Fälligkeit berechnen
  const pmSettings = settings?.paymentMethods?.find((p:any) => p.name === order?.orderMeta?.paymentMethod) || settings?.paymentMethods?.[0];
  const dueDays = pmSettings?.dueDays || 0;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

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
            <Text style={styles.docType}>{isStorno ? 'STORNORECHNUNG' : 'RECHNUNG'}</Text>
            <Text style={styles.docNumLabel}>Rechnungsnummer</Text>
            <Text style={styles.docNum}>{order?.invoiceNumber || 'Entwurf'}</Text>
            {isStorno && (
              <Text style={{ fontSize: 9, color: '#8F1627', marginTop: 5 }}>zu Rechnung {order?.stornoFor}</Text>
            )}
          </View>
        </View>

        <View style={styles.line} />

        <Text style={styles.companyLine}>
          {settings?.companyName} • {settings?.street} • {settings?.zip} {settings?.city}
        </Text>

        <View style={styles.customerDateBox}>
          <View style={styles.customerBox}>
            <Text style={styles.customerTitle}>Rechnungsempfänger</Text>
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
              <Text style={styles.dateValue}>{new Date().toLocaleDateString('de-DE')}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Fälligkeit</Text>
              <Text style={styles.dateValue}>{dueDate.toLocaleDateString('de-DE')}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Zahlungsziel</Text>
              <Text style={styles.dateValue}>{pmSettings?.shortText || '-'}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Leistungsdatum</Text>
              <Text style={styles.dateValue}>
                {order?.orderMeta?.movingDateFrom ? new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE') : '-'}
                {order?.orderMeta?.movingDateTo ? ` - ${new Date(order.orderMeta.movingDateTo).toLocaleDateString('de-DE')}` : ''}
              </Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateLabel}>Sachbearbeiter</Text>
              <Text style={styles.dateValue}>{order?.orderMeta?.manager || '-'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.introText}>Sehr geehrte(r) {billing?.lastName || billing?.firstName},</Text>
        <Text style={{ ...styles.introText, marginTop: -10 }}>
          {isStorno 
            ? `hiermit stornieren wir die Rechnung ${order?.stornoFor}. Der unten ausgewiesene Betrag wird Ihrem Konto gutgeschrieben bzw. gleicht unsere Forderung aus.` 
            : settings?.texts?.invoiceIntro}
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Pos.</Text>
            <Text style={styles.col2}>Leistungsbeschreibung</Text>
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

        <Text style={{ ...styles.detailsHeader, fontSize: 12, marginBottom: 5 }}>Zahlungsinformationen</Text>
        <Text style={styles.textBlock}>{pmSettings?.textInvoice}</Text>
        
        <Text style={styles.textBlock}>{settings?.texts?.invoiceOutro}</Text>
        <Text style={styles.textBlock}>{settings?.texts?.invoiceGreeting}</Text>

        <View style={styles.footerBlocks}>
          <View style={styles.footerCol}>
            <Text style={styles.footerTitle}>Unternehmen</Text>
            <Text style={styles.footerText}>{settings?.companyName}</Text>
            <Text style={styles.footerText}>{settings?.street}</Text>
            <Text style={styles.footerText}>{settings?.zip} {settings?.city}</Text>
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerTitle}>Bankverbindung</Text>
            <Text style={styles.footerText}>Name: {settings?.companyName}</Text>
            <Text style={styles.footerText}>{settings?.bankName}</Text>
            <Text style={styles.footerText}>IBAN: {settings?.iban}</Text>
            <Text style={styles.footerText}>BIC: {settings?.bic}</Text>
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerTitle}>Kontakt</Text>
            <Text style={styles.footerText}>Tel: {settings?.phone}</Text>
            <Text style={styles.footerText}>Steuer-Nr: {settings?.taxId}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
