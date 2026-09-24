import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { PDF_COLORS, pdfCommonStyles } from './core/pdfTheme';
import { PDFHeader } from './core/PDFHeader';
import { PDFFooter } from './core/PDFFooter';
import { PDFWatermark } from './core/PDFWatermark';

const styles = StyleSheet.create({
  ...pdfCommonStyles,
  col1: { width: '18%' },
  col2: { width: '82%' },
});

export const InventoryPDF = ({ customer, items, settings }: { customer: any; items: any[]; settings?: any }) => {
  const isBusiness = customer?.type === 'firma';
  const streetLine = customer?.billingAddress?.street || customer?.street
    ? `${customer?.billingAddress?.street || customer?.street} ${customer?.billingAddress?.houseNr || customer?.houseNr || ''}`.trim()
    : '';
  const cityLine = `${customer?.billingAddress?.zip || customer?.zip || ''} ${customer?.billingAddress?.city || customer?.city || ''}`.trim();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <PDFWatermark type="symbols" />
        <PDFHeader settings={settings} docTitle="Inventarliste" />
        <PDFFooter settings={settings} />

        <View style={{ marginBottom: 14 }}>
          {isBusiness && customer?.lastName && (
            <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: PDF_COLORS.textMain }}>
              {customer.lastName}
            </Text>
          )}
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: PDF_COLORS.textMain }}>
            {isBusiness && customer?.firstName
              ? `z.Hd. ${customer?.salutation && customer?.salutation !== 'Firma' ? customer.salutation + ' ' : ''}${customer.firstName}`
              : `${customer?.salutation && customer?.salutation !== 'Firma' ? customer.salutation + ' ' : ''}${customer?.firstName || ''} ${customer?.lastName || ''}`.trim()}
          </Text>
          {streetLine ? <Text style={{ fontSize: 9, color: PDF_COLORS.textMain }}>{streetLine}</Text> : null}
          {cityLine ? <Text style={{ fontSize: 9, color: PDF_COLORS.textMain }}>{cityLine}</Text> : null}
        </View>

        <Text style={styles.mainTitle}>Umzugsgut / Inventarliste</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={styles.col1}>Menge</Text>
            <Text style={styles.col2}>Gegenstand & Hinweise</Text>
          </View>
          {items?.map((item: any, i: number) => (
            <View key={i} style={styles.tableRow} wrap={false}>
              <Text style={[{ fontFamily: 'Helvetica-Bold' }, styles.col1]}>{item.quantity}x</Text>
              <View style={styles.col2}>
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>{item.name}</Text>
                {item.note && item.showNoteInPdf !== false && (
                  <Text style={{ fontSize: 8, color: PDF_COLORS.textMuted, marginTop: 2 }}>Notiz: {item.note}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
};
