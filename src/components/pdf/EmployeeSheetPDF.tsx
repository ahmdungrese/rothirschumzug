import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { PDF_COLORS, pdfCommonStyles } from './core/pdfTheme';
import { PDFHeader } from './core/PDFHeader';
import { PDFFooter } from './core/PDFFooter';
import { PDFWatermark } from './core/PDFWatermark';

const styles = StyleSheet.create({
  ...pdfCommonStyles,

  titleRow: {
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
  },
  subtitle: {
    fontSize: 9,
    color: PDF_COLORS.textMuted,
    marginTop: 2,
  },

  customerCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMain,
  },
  customerPhone: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
  },

  addressesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addressBoxHalf: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: PDF_COLORS.primary,
    borderRadius: 4,
    padding: 8,
  },
  addressTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.borderLight,
    paddingBottom: 2,
  },
  addressStreet: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMain,
    marginBottom: 2,
  },
  addressCity: {
    fontSize: 9,
    color: PDF_COLORS.textMain,
    marginBottom: 4,
  },
  addressMeta: {
    fontSize: 8,
    color: PDF_COLORS.textMuted,
    lineHeight: 1.3,
  },

  paramsCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginBottom: 12,
  },
  paramHeader: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 4,
  },
  paramText: {
    fontSize: 8.5,
    color: PDF_COLORS.textMain,
    marginBottom: 2,
  },
  teamHighlight: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginTop: 3,
  },

  table: {
    width: '100%',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1.5,
    borderBottomColor: PDF_COLORS.primary,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: PDF_COLORS.textMain,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  colQty: { width: '18%', textAlign: 'center', fontFamily: 'Helvetica-Bold' },
  colService: { width: '82%', paddingRight: 6 },

  checklistContainer: {
    backgroundColor: '#ffffff',
    borderLeftWidth: 3,
    borderLeftColor: PDF_COLORS.primary,
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  checkBox: {
    width: 10,
    height: 10,
    borderWidth: 1,
    borderColor: PDF_COLORS.textMuted,
    marginRight: 7,
    marginTop: 1.5,
  },
  checkText: {
    flex: 1,
    fontSize: 8.5,
    color: PDF_COLORS.textMain,
  },
});

export const EmployeeSheetPDF = ({
  order,
  customer,
  employeeName,
  settings,
}: {
  order: any;
  customer: any;
  employeeName?: string;
  settings?: any;
}) => {
  const docTitle = `Laufzettel - ${customer?.lastName || 'Kunde'}`;

  return (
    <Document title={docTitle}>
      <Page size="A4" style={styles.page}>
        <PDFWatermark type="symbols" />
        <PDFHeader settings={settings} docTitle="Laufzettel für Mitarbeiter" />

        <View style={styles.titleRow}>
          <Text style={styles.title}>Laufzettel für Mitarbeiter</Text>
          <Text style={styles.subtitle}>
            Auftrag / Angebot: {order?.contractNumber || order?.orderNumber || 'Entwurf'}
            {employeeName ? ` | Disponent / Sachbearbeiter: ${employeeName}` : ''}
          </Text>
        </View>

        {/* Customer Contact Card */}
        <View style={styles.customerCard}>
          <View>
            <Text style={{ fontSize: 7.5, color: PDF_COLORS.textMuted, marginBottom: 1 }}>Kunde vor Ort:</Text>
            <Text style={styles.customerName}>
              {customer?.firstName} {customer?.lastName}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7.5, color: PDF_COLORS.textMuted, marginBottom: 1 }}>Kontakt vor Ort:</Text>
            <Text style={styles.customerPhone}>{customer?.phone || 'Keine Telefonnummer'}</Text>
          </View>
        </View>

        {/* Two Address Boxes */}
        <View style={styles.addressesRow}>
          {/* Auszugsort (Beladestelle) */}
          <View style={styles.addressBoxHalf}>
            <Text style={styles.addressTitle}>Beladestelle (Auszug)</Text>
            <Text style={styles.addressStreet}>
              {order?.logistics?.a_street ? `${order.logistics.a_street} ${order.logistics.a_houseNr || ''}` : 'Keine Angabe'}
            </Text>
            <Text style={styles.addressCity}>
              {order?.logistics?.a_zip ? `${order.logistics.a_zip} ${order.logistics.a_city || ''}` : ''}
            </Text>
            <Text style={styles.addressMeta}>
              Etage: {order?.logistics?.a_floor || '0'} {order?.logistics?.a_elevator ? '(Aufzug)' : '(ohne Aufzug)'}
              {'\n'}Laufweg: {order?.logistics?.a_distance || '< 10'} Meter
              {order?.logistics?.a_type ? `\nImmo: ${order.logistics.a_type}` : ''}
            </Text>
          </View>

          {/* Einzugsort (Entladestelle) */}
          <View style={styles.addressBoxHalf}>
            <Text style={styles.addressTitle}>Entladestelle (Einzug)</Text>
            <Text style={styles.addressStreet}>
              {order?.logistics?.b_street ? `${order.logistics.b_street} ${order.logistics.b_houseNr || ''}` : 'Keine Angabe'}
            </Text>
            <Text style={styles.addressCity}>
              {order?.logistics?.b_zip ? `${order.logistics.b_zip} ${order.logistics.b_city || ''}` : ''}
            </Text>
            <Text style={styles.addressMeta}>
              Etage: {order?.logistics?.b_floor || '0'} {order?.logistics?.b_elevator ? '(Aufzug)' : '(ohne Aufzug)'}
              {'\n'}Laufweg: {order?.logistics?.b_distance || '< 10'} Meter
              {order?.logistics?.b_type ? `\nImmo: ${order.logistics.b_type}` : ''}
            </Text>
          </View>
        </View>

        {/* Logistics Parameters & Disposition */}
        <View style={styles.paramsCard}>
          <Text style={styles.paramHeader}>Logistische Parameter & Disposition:</Text>
          <Text style={styles.paramText}>
            Möbellift benötigt: {order?.logistics?.a_furnitureLift || order?.logistics?.b_furnitureLift ? 'Ja (wird gestellt)' : 'Nein'}
          </Text>
          <Text style={styles.paramText}>
            Halteverbotszone: {order?.logistics?.a_parking || order?.logistics?.b_parking ? 'Ja, ist eingerichtet' : 'Nein'}
          </Text>
          <Text style={styles.teamHighlight}>
            Geplantes Team: {order?.disposition?.helpers || 0} Helfer | {order?.disposition?.koffer35t || 0}x 3,5t LKW | {order?.disposition?.lkw7t || 0}x 7,5t LKW
          </Text>
          <Text style={{ ...styles.paramText, marginTop: 3 }}>
            Zahlungsart vor Ort: {order?.paymentMethod || order?.orderMeta?.paymentMethod || 'Nicht angegeben / Nach Absprache'}
          </Text>
        </View>

        {/* Services to perform */}
        <Text style={{ ...styles.paramHeader, marginTop: 4, marginBottom: 4 }}>Zu erbringende Leistungen:</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.colQty}>Menge</Text>
            <Text style={styles.colService}>Leistung / Beschreibung</Text>
          </View>
          {order?.services?.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={styles.colQty}>{item.quantity} {item.unit || ''}</Text>
              <View style={styles.colService}>
                <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold' }}>{item.name}</Text>
                {item.note ? <Text style={{ fontSize: 7.5, color: PDF_COLORS.textMuted }}>{item.note}</Text> : null}
              </View>
            </View>
          ))}
        </View>

        {/* Checklist */}
        <View wrap={false}>
          <Text style={{ ...styles.paramHeader, marginTop: 6, marginBottom: 3 }}>Mitarbeiter Checkliste:</Text>
          <View style={styles.checklistContainer}>
            {/* Auto Logistics Checks */}
            {(order?.logistics?.a_furnitureLift || order?.logistics?.b_furnitureLift) && (
              <View style={styles.checkRow}>
                <View style={styles.checkBox} />
                <Text style={{ ...styles.checkText, fontFamily: 'Helvetica-Bold' }}>
                  Möbellift sicher aufbauen, bedienen und sichern (Gebucht!)
                </Text>
              </View>
            )}
            {(order?.logistics?.a_parking || order?.logistics?.b_parking) && (
              <View style={styles.checkRow}>
                <View style={styles.checkBox} />
                <Text style={{ ...styles.checkText, fontFamily: 'Helvetica-Bold' }}>
                  Halteverbotsschilder kontrollieren und nach Umzug einsammeln
                </Text>
              </View>
            )}
            <View style={styles.checkRow}>
              <View style={styles.checkBox} />
              <Text style={styles.checkText}>Schutzmaterial (Decken, Folien) vollständig eingesetzt</Text>
            </View>
            <View style={styles.checkRow}>
              <View style={styles.checkBox} />
              <Text style={styles.checkText}>Abnahmeprotokoll vom Kunden unterzeichnen lassen</Text>
            </View>

            {/* Custom Checklist items */}
            {order?.checklist?.map((item: any, i: number) => (
              <View key={i} style={styles.checkRow}>
                <View style={{ ...styles.checkBox, backgroundColor: item.done ? PDF_COLORS.textMuted : 'transparent' }} />
                <Text style={{ ...styles.checkText, textDecoration: item.done ? 'line-through' : 'none' }}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <PDFFooter settings={settings} customNote="INTERNES DOKUMENT • Nicht zur Weitergabe an den Kunden bestimmt" />
      </Page>
    </Document>
  );
};
