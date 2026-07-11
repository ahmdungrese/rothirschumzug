import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { calculateOrderTotals, calculateOpenAmount, calculateTotalPaid } from '@/lib/financeHelpers';

const styles = StyleSheet.create({
  page: { padding: 30, paddingBottom: 90, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  headerContainer: { alignItems: 'flex-end', marginBottom: 30 },
  logoWrapper: { backgroundColor: '#1a1a1a', width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  logoTextPrimary: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#8F1627', textTransform: 'uppercase', letterSpacing: 2 },
  
  docInfoBox: { width: '40%', alignItems: 'flex-end', justifyContent: 'flex-start' },
  mainDocumentTitle: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#8F1627', marginBottom: 20, marginTop: 10 },
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
  const billing = order?.customerData || order?.billingAddress || customer;
  
  // Fälligkeit berechnen
  const pmSettings = settings?.paymentMethods?.find((p:any) => p.name === order?.orderMeta?.paymentMethod) || settings?.paymentMethods?.[0];
  const dueDays = pmSettings?.dueDays || 0;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  // Fallback Calculation if totals/calcInput are missing
  const { net: safeNet, tax: safeTax, gross: safeGross } = calculateOrderTotals(order);

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
          <View style={styles.logoWrapper}>
            <Image src="/Rothirsch.png" style={{ height: 60, width: 60, objectFit: 'contain' }} />
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
          
          <View style={styles.docInfoBox}>
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

        <Text style={styles.mainDocumentTitle}>{isStorno ? 'STORNORECHNUNG' : 'RECHNUNG'}</Text>
        <Text style={styles.introText}>{introGreeting}</Text>
        <Text style={{ ...styles.introText, marginTop: -10 }}>
          {isStorno 
            ? `hiermit stornieren wir die Rechnung ${order?.stornoFor}. Der unten ausgewiesene Betrag wird Ihrem Konto gutgeschrieben bzw. gleicht unsere Forderung aus.` 
            : (order?.texts?.invoiceIntro || settings?.texts?.invoiceIntro || 'Anbei erhalten Sie unsere Rechnung zu den erbrachten Leistungen.').replace(/\{\{Kunde_Anrede\}\}/g, introGreeting.replace(',', ''))}
        </Text>

        {order?.logistics?.a_city && order?.logistics?.b_city && (
          <View style={{ marginTop: 10, marginBottom: 15, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', marginBottom: 4, color: '#333' }}>Leistungsort / Umzugswege:</Text>
            <Text style={{ fontSize: 9, color: '#444' }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Von: </Text>
              {order.logistics.a_street} {order.logistics.a_houseNr}, {order.logistics.a_zip} {order.logistics.a_city}
            </Text>
            <Text style={{ fontSize: 9, color: '#444', marginTop: 2 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>Nach: </Text>
              {order.logistics.b_street} {order.logistics.b_houseNr}, {order.logistics.b_zip} {order.logistics.b_city}
            </Text>
          </View>
        )}

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
          {order?.services?.length ? order.services.map((item: any, i: number) => {
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
          }) : isStorno ? (
            <View style={styles.tableRow}>
              <Text style={styles.col1}>1</Text>
              <Text style={[styles.col2, { width: '70%' }]}>Stornierung der Rechnung {order?.stornoFor}</Text>
              <Text style={[styles.col3, { width: '20%' }]}></Text>
              {!isFlat && (
                <>
                  <Text style={styles.col4}></Text>
                  <Text style={styles.col5}>{safeNet.toFixed(2)} €</Text>
                </>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Summe Netto:</Text>
            <Text>{safeNet.toFixed(2)} €</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>MwSt. 19%:</Text>
            <Text>{safeTax.toFixed(2)} €</Text>
          </View>
          <View style={styles.totalRowBold}>
            <Text>Gesamtbetrag (inkl. MwSt.)</Text>
            <Text>{safeGross.toFixed(2)} €</Text>
          </View>
        </View>

        <Text style={{ ...styles.detailsHeader, fontSize: 12, marginBottom: 5 }}>Zahlungsinformationen</Text>
        {(() => {
          const payments = order?.payments || [];
          const totalPaid = calculateTotalPaid(order);
          const remaining = calculateOpenAmount(order);
          
          if (totalPaid >= safeGross - 0.01) {
            // Wenn es genau eine Zahlung gab, versuchen wir den Standardtext des Users zu verwenden
            if (payments.length === 1) {
              const paymentMethod = payments[0].method; // 'bar', 'ueberweisung', 'ec-karte', 'paypal'
              const methodMapping: Record<string, string> = { 'bar': 'bar', 'ueberweisung': 'überweisung', 'ec-karte': 'ec-karte', 'paypal': 'paypal' };
              const mapped = methodMapping[paymentMethod] || paymentMethod;
              
              const matchedSetting = settings?.paymentMethods?.find((p: any) => p.name.toLowerCase().includes(mapped));
              if (matchedSetting?.textInvoice) {
                return <Text style={styles.textBlock}>{matchedSetting.textInvoice}</Text>;
              }
            }
            return <Text style={styles.textBlock}>Der Rechnungsbetrag wurde bereits vollständig bezahlt. Vielen Dank für Ihre Zahlung!</Text>;
          }
          
          if (totalPaid > 0 && remaining > 0) {
            return (
              <>
                <Text style={styles.textBlock}>
                  Bereits bezahlt: {totalPaid.toFixed(2)} € 
                  {payments.length > 0 ? ` (${payments.map((p: any) => {
                    const m = p.method === 'bar' ? 'Bar' : p.method === 'ueberweisung' ? 'Überw.' : p.method === 'ec-karte' ? 'EC' : 'PayPal';
                    return `${p.amount.toFixed(2)}€ ${m}`;
                  }).join(' + ')})` : ''}
                </Text>
                <Text style={{ ...styles.textBlock, fontFamily: 'Helvetica-Bold' }}>Noch offener Betrag: {remaining.toFixed(2)} €</Text>
                <Text style={styles.textBlock}>{invoiceOutro || 'Bitte überweisen Sie den noch offenen Betrag ohne Abzug auf unser Konto.'}</Text>
              </>
            );
          }

          // Not paid yet or partially paid: show the selected payment method text, or default outro
          // Always append bank details for open invoices to ensure they have the transfer info
          return (
            <View>
              {pmSettings?.textInvoice ? (
                <Text style={styles.textBlock}>{pmSettings.textInvoice}</Text>
              ) : invoiceOutro ? (
                <Text style={styles.textBlock}>{invoiceOutro}</Text>
              ) : (
                <Text style={styles.textBlock}>Bitte überweisen Sie den offenen Betrag auf folgendes Konto:</Text>
              )}
              
              <View style={{ marginTop: 5, backgroundColor: '#f9f9f9', padding: 10, borderRadius: 4 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>Bankverbindung für Ihre Zahlung:</Text>
                <Text>Kontoinhaber: {settings?.companyName}</Text>
                <Text>IBAN: {settings?.iban}</Text>
                <Text>BIC: {settings?.bic}</Text>
                <Text>Bank: {settings?.bankName}</Text>
                <Text style={{ marginTop: 5, fontFamily: 'Helvetica-Bold' }}>
                  Zahlungsziel: {dueDays > 0 ? `Innerhalb von ${dueDays} Tagen (bis zum ${dueDate.toLocaleDateString('de-DE')})` : 'Sofort nach Rechnungserhalt'}
                </Text>
              </View>
            </View>
          );
        })()}

        {invoiceGreeting && (
          <Text style={styles.textBlock}>{invoiceGreeting}</Text>
        )}

        <View style={styles.footerBlocks} fixed>
          <View style={styles.footerCol}>
            <Text style={styles.footerTitle}>Unternehmen</Text>
            <Text style={styles.footerText}>{settings?.companyName}</Text>
            <Text style={styles.footerText}>{settings?.street}</Text>
            <Text style={styles.footerText}>{settings?.zip} {settings?.city}</Text>
            {settings?.manager && <Text style={styles.footerText}>Inhaber/-in: {settings?.manager}</Text>}
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerTitle}>Kontakt & Steuern</Text>
            <Text style={styles.footerText}>Tel: {settings?.phone}</Text>
            <Text style={styles.footerText}>E-Mail: {settings?.email}</Text>
            <Text style={styles.footerText}>Web: {settings?.website}</Text>
            {settings?.taxNumber && <Text style={styles.footerText}>Steuer-Nr: {settings?.taxNumber}</Text>}
            {settings?.taxId && <Text style={styles.footerText}>USt-IdNr: {settings?.taxId}</Text>}
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerTitle}>Bankverbindung</Text>
            <Text style={styles.footerText}>{settings?.bankName}</Text>
            <Text style={styles.footerText}>IBAN: {settings?.iban}</Text>
            <Text style={styles.footerText}>BIC: {settings?.bic}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
