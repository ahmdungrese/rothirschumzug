import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { COMPANY_DETAILS } from '@/lib/constants';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  headerContainer: { alignItems: 'flex-end', marginBottom: 20 },
  logoWrapper: { backgroundColor: '#1a1a1a', width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  logoTextPrimary: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#8F1627', textTransform: 'uppercase', letterSpacing: 2 },
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

export const InventoryPDF = ({ customer, items }: { customer: any, items: any[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.headerContainer}>
        <View style={styles.logoWrapper}>
          <Image src="/Rothirsch.png" style={{ height: 80, width: 80, objectFit: 'contain' }} />
        </View>
      </View>

      <Text style={styles.title}>Umzugsgut / Inventarliste</Text>

      <View style={styles.section}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>Kunde:</Text>
        <Text>{customer?.firstName} {customer?.lastName}</Text>
        <Text>{customer?.billingAddress?.street}</Text>
        <Text>{customer?.billingAddress?.zip} {customer?.billingAddress?.city}</Text>
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={styles.col1}>Menge</Text>
          <Text style={styles.col2}>Gegenstand</Text>
        </View>
        {items?.map((item: any, i: number) => (
          <View key={i} style={styles.tableRow}>
            <Text style={styles.col1}>{item.quantity}x</Text>
            <View style={styles.col2}>
              <Text>{item.name}</Text>
              {item.note && item.showNoteInPdf !== false && (
                <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>Notiz: {item.note}</Text>
              )}
            </View>
          </View>
        ))}
      </View>
      
      <View style={styles.footer}>
        <Text>{COMPANY_DETAILS.name} | Inventarliste</Text>
      </View>
    </Page>
  </Document>
);
