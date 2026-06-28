import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, paddingBottom: 50, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  headerContainer: { alignItems: 'center', marginBottom: 30 },
  logoTextPrimary: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#8F1627', textTransform: 'uppercase', letterSpacing: 2 },
  
  docInfoBox: { width: '40%', alignItems: 'flex-end', justifyContent: 'flex-start' },
  docType: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#8F1627', marginBottom: 5 },
  docNumLabel: { fontSize: 9, color: '#666' },
  docNum: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  
  line: { borderBottomWidth: 1, borderBottomColor: '#8F1627', marginBottom: 15 },
  companyLine: { fontSize: 8, color: '#666', marginBottom: 10 },
  
  customerDateBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  customerBox: { width: '50%' },
  customerTitle: { fontSize: 9, color: '#666', marginBottom: 3 },
  customerText: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  customerAddress: { fontSize: 10 },
  
  dateBox: { width: '40%' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  dateLabel: { color: '#666' },
  dateValue: { fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  
  introText: { marginBottom: 15, lineHeight: 1.4 },
  
  table: { width: '100%', marginBottom: 15 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 5, marginBottom: 5, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
  col1: { width: '10%' },
  col2: { width: '45%' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  
  totals: { alignItems: 'flex-end', marginBottom: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: '40%', marginBottom: 5 },
  totalRowBold: { flexDirection: 'row', justifyContent: 'space-between', width: '40%', marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#333', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  
  textBlock: { marginBottom: 10, lineHeight: 1.4 },
  
  detailsHeader: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#8F1627', marginBottom: 10, marginTop: 15 },
  
  footerBlocks: { position: 'absolute', bottom: 30, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  footerCol: { width: '30%' },
  footerTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 5, color: '#8F1627' },
  footerText: { fontSize: 9, marginBottom: 2, color: '#666' }
});

export const InvoicePDF = ({ order, customer, settings, employeeName }: { order: any, customer: any, settings: any, employeeName?: string }) => {
  const isFlat = order?.isFlatRate;
  const isStorno = order?.isStorno;
  const billing = order?.billingAddress || customer;
  
  // Fälligkeit berechnen
  const pmSettings = settings?.paymentMethods?.find((p:any) => p.name === order?.orderMeta?.paymentMethod) || settings?.paymentMethods?.[0];
  const dueDays = pmSettings?.dueDays || 0;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const docTitle = isStorno ? `Stornorechnung ${order?.invoiceNumber || order?.orderNumber || 'Entwurf'} - ${billing?.lastName || 'Kunde'}` : `Rechnung ${order?.invoiceNumber || order?.orderNumber || 'Entwurf'} - ${billing?.lastName || 'Kunde'}`;

  // Personalisierte Anrede
  const salutation = billing?.salutation || customer?.salutation;
  let introGreeting = `Sehr geehrte(r) ${billing?.lastName || billing?.firstName},`;
  if (salutation === 'Herr' && billing?.lastName) {
    introGreeting = `Sehr geehrter Herr ${billing.lastName},`;
  } else if (salutation === 'Frau' && billing?.lastName) {
    introGreeting = `Sehr geehrte Frau ${billing.lastName},`;
  }

  // Für InvoicePDF wird normal kein Variablen-Replacement gemacht, aber falls es benötigt wird:
  // (In Rechnungen wird oft 'introGreeting' separat vom Haupttext genutzt. 
  // Falls die Variable in `invoiceIntro` steckt, tauschen wir sie hier vorsichtshalber mit aus).

  const invoiceOutro = settings?.texts?.invoiceOutro || '';
  const invoiceGreeting = settings?.texts?.invoiceGreeting || '';

  return (
    <Document title={docTitle}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <Text style={styles.logoTextPrimary}>{settings?.companyName || 'ROTHIRSCH UMZUG'}</Text>
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
          
          <View style={styles.docInfoBox}>
            <Text style={styles.docType}>{isStorno ? 'STORNORECHNUNG' : 'RECHNUNG'}</Text>
            <Text style={styles.docNumLabel}>Rechnungsnummer</Text>
            <Text style={styles.docNum}>{order?.invoiceNumber || 'Entwurf'}</Text>
            {isStorno && (
              <Text style={{ fontSize: 9, color: '#8F1627', marginTop: 5, marginBottom: 15 }}>zu Rechnung {order?.stornoFor}</Text>
            )}
            {!isStorno && <View style={{ height: 15 }} />}
            
            <View style={[styles.dateRow, { width: '100%', marginTop: 10 }]}>
              <Text style={styles.dateLabel}>Datum</Text>
              <Text style={styles.dateValue}>{order?.invoiceDate ? new Date(order.invoiceDate).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')}</Text>
            </View>
            <View style={[styles.dateRow, { width: '100%' }]}>
              <Text style={styles.dateLabel}>Leistungsdatum</Text>
              <Text style={styles.dateValue}>
                {order?.orderMeta?.movingDateFrom ? new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE') : 'Nach Absprache'}
              </Text>
            </View>
            <View style={[styles.dateRow, { width: '100%' }]}>
              <Text style={styles.dateLabel}>Sachbearbeiter</Text>
              <Text style={styles.dateValue}>{employeeName || order?.orderMeta?.manager || '-'}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.introText}>{introGreeting}</Text>
        <Text style={{ ...styles.introText, marginTop: -10 }}>
          {isStorno 
            ? `hiermit stornieren wir die Rechnung ${order?.stornoFor}. Der unten ausgewiesene Betrag wird Ihrem Konto gutgeschrieben bzw. gleicht unsere Forderung aus.` 
            : (settings?.texts?.invoiceIntro || '').replace(/\{\{Kunde_Anrede\}\}/g, introGreeting.replace(',', ''))}
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Pos.</Text>
            <Text style={[styles.col2, isFlat && { width: '70%' }]}>Leistungsbeschreibung</Text>
            <Text style={[styles.col3, isFlat && { width: '20%' }]}>{isFlat ? 'Umfang' : 'Menge'}</Text>
            {!isFlat && (
              <>
                <Text style={styles.col4}>Einzelpreis</Text>
                <Text style={styles.col5}>Gesamt</Text>
              </>
            )}
          </View>
          {order?.services?.map((item: any, i: number) => {
            const itemNameLower = (item.name || '').toLowerCase();
            const showExactAmount = isFlat && (itemNameLower.includes('karton') || itemNameLower.includes('einpack'));
            
            return (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col1}>{i + 1}</Text>
                <Text style={[styles.col2, isFlat && { width: '70%' }]}>{item.name}</Text>
                <Text style={[styles.col3, isFlat && { width: '20%' }]}>
                  {isFlat 
                    ? (showExactAmount ? `${item.quantity} ${item.unit}` : 'Inklusiv') 
                    : `${item.quantity} ${item.unit}`}
                </Text>
                {!isFlat && (
                  <>
                    <Text style={styles.col4}>{item.unitPrice?.toFixed(2)} €</Text>
                    <Text style={styles.col5}>{(item.quantity * item.unitPrice)?.toFixed(2)} €</Text>
                  </>
                )}
              </View>
            );
          })}
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
        {pmSettings?.textInvoice && (
          <Text style={styles.textBlock}>{pmSettings.textInvoice}</Text>
        )}
        
        {invoiceOutro && (
          <Text style={styles.textBlock}>
            {pmSettings?.textInvoice ? invoiceOutro.replace(pmSettings.textInvoice, '').trim() : invoiceOutro}
          </Text>
        )}
        {invoiceGreeting && !invoiceOutro.includes(invoiceGreeting) && (
          <Text style={styles.textBlock}>{invoiceGreeting}</Text>
        )}

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
