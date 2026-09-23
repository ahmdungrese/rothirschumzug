import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { PDF_COLORS, pdfCommonStyles } from './core/pdfTheme';
import { PDFHeader } from './core/PDFHeader';
import { PDFFooter } from './core/PDFFooter';
import { PDFWatermark } from './core/PDFWatermark';

const styles = StyleSheet.create({
  ...pdfCommonStyles,

  titleRow: {
    marginTop: 6,
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 9.5,
    color: PDF_COLORS.textMuted,
    lineHeight: 1.3,
  },

  metaCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: PDF_COLORS.primary,
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaCol: {
    width: '48%',
  },
  metaLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMuted,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMain,
    marginBottom: 4,
  },
  metaSub: {
    fontSize: 8.5,
    color: PDF_COLORS.textMain,
  },

  protocolBox: {
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    padding: 12,
    marginBottom: 14,
  },
  protocolHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 6,
    borderBottomWidth: 0.8,
    borderBottomColor: PDF_COLORS.borderLight,
    paddingBottom: 4,
  },
  protocolText: {
    fontSize: 9,
    lineHeight: 1.5,
    color: PDF_COLORS.textMain,
    marginTop: 6, // Proper spacing to prevent glueing to header
    marginBottom: 12,
  },

  signatureBox: {
    padding: 9,
    backgroundColor: '#ffffff',
    borderLeftWidth: 3,
    borderLeftColor: PDF_COLORS.primary,
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 2,
  },
  sigHeader: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMain,
    marginBottom: 3,
  },
  sigDate: {
    fontSize: 7.5,
    color: PDF_COLORS.textMuted,
    marginBottom: 5,
  },
  sigImage: {
    height: 48,
    objectFit: 'contain',
    marginTop: 4,
  }
});

export const ProtocolPDF = ({
  order,
  customer,
  employeeName,
  settings,
}: {
  order: any;
  customer: any;
  employeeName: string;
  settings?: any;
}) => {
  const docTitle = `Protokoll - ${order?.orderNumber || order?.contractNumber || 'Auftrag'}`;
  const protocols = order?.protocols || [];

  return (
    <Document title={docTitle}>
      <Page size="A4" style={styles.page}>
        <PDFWatermark type="symbols" />
        <PDFHeader settings={settings} docTitle="Arbeitsprotokoll & Dokumentation" />

        <View style={styles.titleRow}>
          <Text style={styles.title}>Arbeitsprotokoll & Haftungsausschluss</Text>
          <Text style={styles.subtitle}>
            Auftragsreferenz: {order?.orderNumber || order?.contractNumber || 'Auftrag'}
          </Text>
        </View>

        {/* Customer & Employee Meta Card */}
        <View style={styles.metaCard}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Auftraggeber / Kunde:</Text>
            <Text style={styles.metaValue}>
              {customer?.type === 'firma'
                ? customer?.lastName
                : `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim()}
            </Text>
            <Text style={styles.metaSub}>
              {customer?.street} {customer?.houseNr}, {customer?.zip} {customer?.city}
            </Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Protokolldatum:</Text>
            <Text style={styles.metaValue}>{new Date().toLocaleDateString('de-DE')}</Text>
            <Text style={{ ...styles.metaLabel, marginTop: 4 }}>Verantwortlicher Mitarbeiter:</Text>
            <Text style={styles.metaSub}>{employeeName || settings?.manager || 'Rothirsch Team'}</Text>
          </View>
        </View>

        {/* Protocols List */}
        {protocols.length === 0 ? (
          <View style={{ ...styles.protocolBox, padding: 18, alignItems: 'center' }}>
            <Text style={{ fontSize: 9.5, color: PDF_COLORS.textMuted, fontStyle: 'italic' }}>
              Keine spezifischen Zusatzprotokolle für diesen Auftrag erfasst.
            </Text>
          </View>
        ) : (
          protocols.map((protocol: any, index: number) => (
            <View key={index} style={styles.protocolBox} wrap={false}>
              <Text style={styles.protocolHeader}>
                {index + 1}. {protocol.type || 'Schadens- / Arbeitsprotokoll'}
              </Text>
              <Text style={styles.protocolText}>
                {protocol.text || 'Keine Beschreibung angegeben.'}
              </Text>

              <View style={styles.signatureBox}>
                <Text style={styles.sigHeader}>Bestätigung & Kundenunterschrift</Text>
                <Text style={styles.sigDate}>
                  Gezeichnet am: {protocol.createdAt ? new Date(protocol.createdAt).toLocaleString('de-DE') : new Date().toLocaleString('de-DE')}
                </Text>
                {protocol.signature ? (
                  <Image src={protocol.signature} style={styles.sigImage} />
                ) : (
                  <Text style={{ fontSize: 8, color: PDF_COLORS.textLight, fontStyle: 'italic' }}>
                    Keine digitale Unterschrift erfasst.
                  </Text>
                )}
              </View>
            </View>
          ))
        )}

        {/* Overall Confirmation Box */}
        {order?.signatureProtocol && (
          <View style={styles.protocolBox} wrap={false}>
            <Text style={styles.protocolHeader}>Gesamtbestätigung des Arbeitsprotokolls</Text>
            <Text style={styles.protocolText}>
              Der Auftraggeber bestätigt hiermit die Richtigkeit aller oben aufgeführten Protokolle, Leistungen und Vereinbarungen.
            </Text>
            <View style={styles.signatureBox}>
              <Text style={styles.sigHeader}>Unterschrift Auftraggeber</Text>
              <Text style={styles.sigDate}>
                {order?.signatureProtocolPlace
                  ? `${order.signatureProtocolPlace}, den ${order.signatureProtocolDateString}`
                  : `Gezeichnet am: ${
                      order?.signatureProtocolDate
                        ? new Date(order.signatureProtocolDate.toMillis?.() || Date.now()).toLocaleString('de-DE')
                        : new Date().toLocaleDateString('de-DE')
                    }`}
              </Text>
              <Image src={order.signatureProtocol} style={styles.sigImage} />
            </View>
          </View>
        )}

        <PDFFooter settings={settings} customNote="Offizielles Arbeitsprotokoll • Rothirsch Umzug" />
      </Page>
    </Document>
  );
};
