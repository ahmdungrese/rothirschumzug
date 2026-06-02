import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_DETAILS, AGB_TEXT } from '@/lib/constants';

// Define styles
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  companyInfo: { textAlign: 'right', fontSize: 9, color: '#666' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 20, color: '#8F1627' },
  section: { marginBottom: 20 },
  table: { width: '100%', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 5, marginBottom: 5, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
  col1: { width: '15%' },
  col2: { width: '50%' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '20%', textAlign: 'right' },
  totals: { marginTop: 20, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: '40%', marginBottom: 5 },
  totalRowBold: { flexDirection: 'row', justifyContent: 'space-between', width: '40%', marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#333', fontFamily: 'Helvetica-Bold', fontSize: 12 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#999', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  agbTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 15, textAlign: 'center' },
  agbColumns: { flexDirection: 'row', justifyContent: 'space-between' },
  agbCol: { width: '48%' },
  agbParagraph: { marginBottom: 10 },
  agbParagraphTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 3, fontSize: 9 },
  agbParagraphText: { fontSize: 8, lineHeight: 1.4 },
  signatureBox: { marginTop: 50, flexDirection: 'row', justifyContent: 'space-between' },
  sigLine: { width: '45%', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 5, fontSize: 9, textAlign: 'center' }
});

export const OrderPDF = ({ order, customer }: { order: any, customer: any }) => (
  <Document>
    {/* Page 1: Angebot/Auftrag & Leistungen */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        {/* Platzhalter-Logo als Text, da React-PDF absolute URLs für Bilder braucht */}
        <Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#8F1627' }}>Rothirsch Umzüge</Text>
        <View style={styles.companyInfo}>
          <Text>{COMPANY_DETAILS.name}</Text>
          <Text>{COMPANY_DETAILS.address.street}</Text>
          <Text>{COMPANY_DETAILS.address.zip} {COMPANY_DETAILS.address.city}</Text>
          <Text>{COMPANY_DETAILS.phone}</Text>
          <Text>{COMPANY_DETAILS.email}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>Kunde:</Text>
        <Text>{customer?.firstName} {customer?.lastName}</Text>
        <Text>{customer?.billingAddress?.street}</Text>
        <Text>{customer?.billingAddress?.city}</Text>
      </View>

      <Text style={styles.title}>
        {order?.status === 'quote' || order?.status === 'draft' ? 'Angebot' : 'Auftragsbestätigung'} 
        {order?.orderNumber ? ` Nr. ${order.orderNumber}` : ''}
      </Text>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Menge</Text>
          <Text style={styles.col2}>Leistung</Text>
          {!order?.isFlatRate && <Text style={styles.col3}>Einzelpreis</Text>}
          <Text style={styles.col4}>Gesamt</Text>
        </View>
        {order?.services?.map((item: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.col1}>{item.quantity}</Text>
            <Text style={styles.col2}>{item.name}</Text>
            {!order?.isFlatRate && <Text style={styles.col3}>€ {item.unitPrice.toFixed(2)}</Text>}
            <Text style={styles.col4}>
              {order?.isFlatRate ? 'Inklusiv' : `€ ${(item.quantity * item.unitPrice).toFixed(2)}`}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.totals}>
        <View style={styles.totalRow}>
          <Text>Summe Netto:</Text>
          <Text>€ {order?.totals?.net.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text>zzgl. 19% MwSt:</Text>
          <Text>€ {order?.totals?.tax.toFixed(2)}</Text>
        </View>
        <View style={styles.totalRowBold}>
          <Text>Gesamtbetrag:</Text>
          <Text>€ {order?.totals?.gross.toFixed(2)}</Text>
        </View>
        {order?.payments && order.payments.length > 0 && (
          <>
            <View style={{ ...styles.totalRow, marginTop: 10, color: '#3b82f6' }}>
              <Text>Bereits bezahlt:</Text>
              <Text>€ {order.payments.reduce((sum: number, p: any) => sum + p.amount, 0).toFixed(2)}</Text>
            </View>
            <View style={{ ...styles.totalRowBold, color: '#8F1627', borderTopColor: '#8F1627' }}>
              <Text>Offener Rechnungsbetrag:</Text>
              <Text>€ {Math.max(0, (order?.totals?.gross || 0) - order.payments.reduce((sum: number, p: any) => sum + p.amount, 0)).toFixed(2)}</Text>
            </View>
          </>
        )}
      </View>
      
      <View style={styles.footer}>
        <Text>{COMPANY_DETAILS.name} | {COMPANY_DETAILS.address.street}, {COMPANY_DETAILS.address.zip} {COMPANY_DETAILS.address.city} | {COMPANY_DETAILS.email}</Text>
      </View>
    </Page>

    {/* Page 2: Logistik & Zahlung */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Logistik & Rahmenbedingungen</Text>
      
      <View style={styles.section}>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 10 }}>Adressen & Logistische Parameter:</Text>
        <Text style={{ marginBottom: 3 }}><Text style={{ fontFamily: 'Helvetica-Bold' }}>Beladestelle (Auszug):</Text> {order?.logistics?.loadingAddress || 'Keine Angabe'}</Text>
        <Text style={{ marginBottom: 10 }}><Text style={{ fontFamily: 'Helvetica-Bold' }}>Entladestelle (Einzug):</Text> {order?.logistics?.unloadingAddress || 'Keine Angabe'}</Text>
        
        <Text>Etagen (Trageweg): {order?.logistics?.floors || 0}</Text>
        <Text>Laufweg: {order?.logistics?.walkingDistance || 0} Meter</Text>
        <Text>Möbellift benötigt: {order?.logistics?.furnitureLift ? 'Ja' : 'Nein'}</Text>
        <Text>Halteverbotszone: {order?.logistics?.noParkingZone ? 'Ja, wird eingerichtet' : 'Nicht benötigt'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 10, marginTop: 20 }}>Zahlungsbedingungen:</Text>
        <Text>{AGB_TEXT.find(a => a.title.includes('Zahlungsmodalitäten'))?.content}</Text>
      </View>

      <View style={styles.footer}>
        <Text>{COMPANY_DETAILS.name} | Seite 2</Text>
      </View>
    </Page>

    {/* Page 3: Bestätigung */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Auftragsbestätigung</Text>
      <Text style={{ marginBottom: 40, lineHeight: 1.5 }}>
        Hiermit bestätige ich die Richtigkeit der angegebenen Daten und nehme das Angebot zu den genannten Konditionen verbindlich an. Ich bestätige zudem, die Allgemeinen Geschäftsbedingungen (AGB) auf der nachfolgenden Seite gelesen und akzeptiert zu haben.
      </Text>
      
      <View style={styles.signatureBox}>
        <View style={styles.sigLine}>
          <Text>Ort, Datum</Text>
        </View>
        <View style={styles.sigLine}>
          <Text>Unterschrift Auftraggeber</Text>
        </View>
      </View>
    </Page>

    {/* Page 4: AGB (2-Spalten Layout) */}
    <Page size="A4" style={styles.page}>
      <Text style={styles.agbTitle}>Allgemeine Geschäftsbedingungen (AGB)</Text>
      
      <View style={styles.agbColumns}>
        {/* Spalte 1: Paragraph 1-6 */}
        <View style={styles.agbCol}>
          {AGB_TEXT.slice(0, 6).map((agb, idx) => (
            <View key={idx} style={styles.agbParagraph}>
              <Text style={styles.agbParagraphTitle}>{agb.title}</Text>
              <Text style={styles.agbParagraphText}>{agb.content}</Text>
            </View>
          ))}
        </View>

        {/* Spalte 2: Paragraph 7-12 */}
        <View style={styles.agbCol}>
          {AGB_TEXT.slice(6, 12).map((agb, idx) => (
            <View key={idx} style={styles.agbParagraph}>
              <Text style={styles.agbParagraphTitle}>{agb.title}</Text>
              <Text style={styles.agbParagraphText}>{agb.content}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ ...styles.signatureBox, marginTop: 30 }}>
        <View style={{...styles.sigLine, width: '100%'}}>
          <Text>Gelesen und akzeptiert (Unterschrift Kunde)</Text>
        </View>
      </View>
    </Page>

    {/* Page 5 (Optional): Inventarliste (Jobcenter) */}
    {customer?.appendInventoryToPDF && customer?.inventory && customer.inventory.length > 0 && (
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Anhang: Umzugsgut / Inventarliste</Text>
        <Text style={{ marginBottom: 20 }}>Die folgende Liste dokumentiert das erfasste Umzugsgut und ist verbindlicher Bestandteil dieses Angebots/Auftrags.</Text>
        
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Menge</Text>
            <Text style={styles.col2}>Gegenstand</Text>
          </View>
          {customer.inventory.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{item.quantity}x</Text>
              <Text style={styles.col2}>{item.name}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.footer}>
          <Text>{COMPANY_DETAILS.name} | Anhang: Inventarliste</Text>
        </View>
      </Page>
    )}
  </Document>
);
