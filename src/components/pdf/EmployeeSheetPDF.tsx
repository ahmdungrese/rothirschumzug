import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { COMPANY_DETAILS } from '@/lib/constants';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 },
  companyInfo: { textAlign: 'right', fontSize: 9, color: '#666' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 20, color: '#8F1627' },
  section: { marginBottom: 20 },
  table: { width: '100%', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 5, marginBottom: 5, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
  col1: { width: '20%' },
  col2: { width: '80%' },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#999', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
});

export const EmployeeSheetPDF = ({ order, customer }: { order: any, customer: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#8F1627' }}>Rothirsch Umzüge</Text>
        <View style={styles.companyInfo}>
          <Text>{COMPANY_DETAILS.name}</Text>
          <Text>{COMPANY_DETAILS.phone}</Text>
        </View>
      </View>

      <Text style={styles.title}>Laufzettel für Mitarbeiter</Text>

      <View style={styles.section}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>Kunde:</Text>
        <Text>{customer?.firstName} {customer?.lastName}</Text>
        <Text>{customer?.phone} (Kontakt vor Ort)</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>Ladeadresse:</Text>
        <Text>{customer?.billingAddress?.street}</Text>
        <Text>{customer?.billingAddress?.city}</Text>
      </View>

      <View style={styles.section}>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 10 }}>Logistische Parameter:</Text>
        <Text>Etagen (Trageweg): {order?.logistics?.floors || 0}</Text>
        <Text>Laufweg: {order?.logistics?.walkingDistance || 0} Meter</Text>
        <Text>Möbellift benötigt: {order?.logistics?.furnitureLift ? 'Ja' : 'Nein'}</Text>
        <Text>Halteverbotszone: {order?.logistics?.noParkingZone ? 'Ja, wird eingerichtet' : 'Nein'}</Text>
      </View>

      <Text style={{ fontFamily: 'Helvetica-Bold', marginTop: 20, marginBottom: 10 }}>Zu erbringende Leistungen:</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Menge</Text>
          <Text style={styles.col2}>Leistung</Text>
        </View>
        {order?.services?.map((item: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.col1}>{item.quantity}</Text>
            <Text style={styles.col2}>{item.name}</Text>
          </View>
        ))}
      </View>

      {customer?.checklist && customer.checklist.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#8F1627', marginBottom: 10 }}>Mitarbeiter Checkliste:</Text>
          <View style={{ backgroundColor: '#f9f9f9', padding: 10, borderLeftWidth: 3, borderLeftColor: '#8F1627' }}>
            {customer.checklist.map((item: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ width: 12, height: 12, borderWidth: 1, borderColor: '#666', marginRight: 8, marginTop: 1, backgroundColor: item.done ? '#666' : 'transparent' }} />
                <Text style={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? '#999' : '#333' }}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      
      <View style={styles.footer}>
        <Text>Internes Dokument - NICHT zur Weitergabe an den Kunden bestimmt.</Text>
      </View>
    </Page>
  </Document>
);
