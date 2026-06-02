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

export const InventoryPDF = ({ customer, items }: { customer: any, items: any[] }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={{ fontSize: 24, fontFamily: 'Helvetica-Bold', color: '#8F1627' }}>Rothirsch Umzüge</Text>
        <View style={styles.companyInfo}>
          <Text>{COMPANY_DETAILS.name}</Text>
          <Text>{COMPANY_DETAILS.phone}</Text>
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
            <Text style={styles.col2}>{item.name}</Text>
          </View>
        ))}
      </View>
      
      <View style={styles.footer}>
        <Text>{COMPANY_DETAILS.name} | Inventarliste</Text>
      </View>
    </Page>
  </Document>
);
