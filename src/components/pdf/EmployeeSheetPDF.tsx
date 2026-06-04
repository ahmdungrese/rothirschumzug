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
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
        <View style={{ width: '48%' }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 5, color: '#8F1627' }}>Beladestelle (Auszug):</Text>
          <Text style={{ fontSize: 12 }}>
            {order?.logistics?.a_street ? `${order.logistics.a_street} ${order.logistics.a_houseNr || ''}` : 'Keine Angabe'}
          </Text>
          <Text style={{ fontSize: 12 }}>
            {order?.logistics?.a_zip ? `${order.logistics.a_zip} ${order.logistics.a_city || ''}` : ''}
          </Text>
          <Text style={{ fontSize: 10, marginTop: 5, color: '#666' }}>
            Etage: {order?.logistics?.a_floor || '0'} | Laufweg: {order?.logistics?.a_distance || '0'}m
          </Text>
        </View>
        <View style={{ width: '48%' }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, marginBottom: 5, color: '#8F1627' }}>Entladestelle (Einzug):</Text>
          <Text style={{ fontSize: 12 }}>
            {order?.logistics?.b_street ? `${order.logistics.b_street} ${order.logistics.b_houseNr || ''}` : 'Keine Angabe'}
          </Text>
          <Text style={{ fontSize: 12 }}>
            {order?.logistics?.b_zip ? `${order.logistics.b_zip} ${order.logistics.b_city || ''}` : ''}
          </Text>
          <Text style={{ fontSize: 10, marginTop: 5, color: '#666' }}>
            Etage: {order?.logistics?.b_floor || '0'} | Laufweg: {order?.logistics?.b_distance || '0'}m
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 10 }}>Logistische Parameter & Zahlung:</Text>
        <Text>Möbellift benötigt: {(order?.logistics?.a_furnitureLift || order?.logistics?.b_furnitureLift) ? 'Ja' : 'Nein'}</Text>
        <Text>Halteverbotszone: {(order?.logistics?.a_parking || order?.logistics?.b_parking) ? 'Ja, wird eingerichtet' : 'Nein'}</Text>
        <Text style={{ marginTop: 5, fontFamily: 'Helvetica-Bold', color: '#8F1627' }}>
          Zahlungsmethode: {order?.paymentMethod || 'Nicht angegeben'}
        </Text>
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

      {(order?.checklist?.length > 0 || order?.logistics?.a_furnitureLift || order?.logistics?.b_furnitureLift || order?.logistics?.a_parking || order?.logistics?.b_parking) && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 14, color: '#8F1627', marginBottom: 10 }}>Mitarbeiter Checkliste:</Text>
          <View style={{ backgroundColor: '#f9f9f9', padding: 10, borderLeftWidth: 3, borderLeftColor: '#8F1627' }}>
            {/* Automatisierte Logistik-Checks */}
            {(order?.logistics?.a_furnitureLift || order?.logistics?.b_furnitureLift) && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ width: 12, height: 12, borderWidth: 1, borderColor: '#666', marginRight: 8, marginTop: 1 }} />
                <Text style={{ flex: 1, color: '#333', fontFamily: 'Helvetica-Bold' }}>Möbellift sicher aufbauen & bedienen (Gebucht!)</Text>
              </View>
            )}
            {(order?.logistics?.a_parking || order?.logistics?.b_parking) && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                <View style={{ width: 12, height: 12, borderWidth: 1, borderColor: '#666', marginRight: 8, marginTop: 1 }} />
                <Text style={{ flex: 1, color: '#333', fontFamily: 'Helvetica-Bold' }}>Halteverbotsschilder einsammeln nach Umzug</Text>
              </View>
            )}
            
            {/* Manuelle Checks */}
            {order?.checklist?.map((item: any, i: number) => (
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
