import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { COMPANY_DETAILS } from '@/lib/constants';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  headerContainer: { alignItems: 'center', marginBottom: 30 },
  logoTextPrimary: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#8F1627', textTransform: 'uppercase', letterSpacing: 2 },
  companyInfo: { textAlign: 'right', fontSize: 9, color: '#666' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 10, color: '#8F1627' },
  subtitle: { fontSize: 12, marginBottom: 20, color: '#666' },
  section: { marginBottom: 20 },
  label: { fontFamily: 'Helvetica-Bold', marginBottom: 4, color: '#555' },
  value: { fontSize: 11, marginBottom: 10 },
  protocolBox: { borderWidth: 1, borderColor: '#eee', padding: 15, marginBottom: 20, borderRadius: 4 },
  signatureBox: { marginTop: 10, padding: 10, backgroundColor: '#f9f9f9', borderLeftWidth: 3, borderLeftColor: '#8F1627' },
  signatureImage: { height: 60, marginTop: 10 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#999', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
});

export const ProtocolPDF = ({ order, customer, employeeName }: { order: any, customer: any, employeeName: string }) => {
  const docTitle = `Protokoll - ${order?.orderNumber || 'Auftrag'}`;
  const protocols = order?.protocols || [];

  return (
  <Document title={docTitle}>
    <Page size="A4" style={styles.page}>
      <View style={styles.headerContainer}>
        <Text style={styles.logoTextPrimary}>ROTHIRSCH UMZUG</Text>
      </View>

      <Text style={styles.title}>Arbeitsprotokoll / Haftungsausschluss</Text>
      <Text style={styles.subtitle}>Referenz: {order?.orderNumber || order?.contractNumber || 'Auftrag'}</Text>

      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        <View style={{ width: '50%' }}>
          <Text style={styles.label}>Kunde:</Text>
          <Text style={styles.value}>{customer?.type === 'firma' ? customer?.lastName : `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim()}</Text>
          <Text style={styles.value}>{customer?.street} {customer?.houseNr}, {customer?.zip} {customer?.city}</Text>
        </View>
        <View style={{ width: '50%' }}>
          <Text style={styles.label}>Datum der Erstellung:</Text>
          <Text style={styles.value}>{new Date().toLocaleDateString('de-DE')}</Text>
          <Text style={styles.label}>Mitarbeiter:</Text>
          <Text style={styles.value}>{employeeName}</Text>
        </View>
      </View>

      {protocols.length === 0 ? (
        <Text style={{ color: '#999', fontStyle: 'italic', marginTop: 20 }}>Keine Protokolle für diesen Auftrag vorhanden.</Text>
      ) : (
        protocols.map((protocol: any, index: number) => (
          <View key={index} style={styles.protocolBox}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 10, color: '#8F1627' }}>
              {protocol.type || 'Protokoll'}
            </Text>
            <Text style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 15 }}>
              {protocol.text || 'Keine Beschreibung angegeben.'}
            </Text>
            
            <View style={styles.signatureBox}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>Kundenunterschrift</Text>
              <Text style={{ fontSize: 9, color: '#666', marginBottom: 5 }}>
                Gezeichnet am: {new Date(protocol.createdAt).toLocaleString('de-DE')}
              </Text>
              {protocol.signature ? (
                <Image src={protocol.signature} style={styles.signatureImage} />
              ) : (
                <Text style={{ color: '#999', fontStyle: 'italic', marginTop: 10 }}>Keine Unterschrift erfasst.</Text>
              )}
            </View>
          </View>
        ))
      )}
      {order?.signatureProtocol && (
        <View style={{ marginTop: 30, ...styles.protocolBox }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 10, color: '#8F1627' }}>
            Gesamtbestätigung der Protokolle
          </Text>
          <Text style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 15 }}>
            Der Kunde bestätigt hiermit die Richtigkeit aller oben aufgeführten Protokolle und Leistungen.
          </Text>
          <View style={styles.signatureBox}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>Unterschrift Auftraggeber</Text>
            <Text style={{ fontSize: 9, color: '#666', marginBottom: 5 }}>
              {order?.signatureProtocolPlace ? `${order.signatureProtocolPlace}, den ${order.signatureProtocolDateString}` : `Gezeichnet am: ${order?.signatureProtocolDate ? new Date(order.signatureProtocolDate.toMillis?.() || Date.now()).toLocaleString('de-DE') : 'Gerade eben'}`}
            </Text>
            <Image src={order.signatureProtocol} style={styles.signatureImage} />
          </View>
        </View>
      )}
      
      <View style={styles.footer}>
        <Text>Dieses Protokoll ist Bestandteil der Auftragsdokumentation.</Text>
      </View>
    </Page>
  </Document>
);
};
