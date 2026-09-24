import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { PDF_COLORS, commonPdfStyles } from './core/pdfTheme';
import { PDFHeader } from './core/PDFHeader';
import { PDFFooter } from './core/PDFFooter';
import { PDFWatermark } from './core/PDFWatermark';

const styles = StyleSheet.create({
  ...commonPdfStyles,
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

        <View style={styles.metaGrid}>
          <View style={styles.addressWindow}>
            {isBusiness && customer?.lastName && (
              <Text style={styles.customerNameBold}>{customer.lastName}</Text>
            )}
            <Text style={isBusiness ? styles.customerText : styles.customerNameBold}>
              {isBusiness && customer?.firstName
                ? `z.Hd. ${customer?.salutation && customer?.salutation !== 'Firma' ? customer.salutation + ' ' : ''}${customer.firstName}`
                : `${customer?.salutation && customer?.salutation !== 'Firma' ? customer.salutation + ' ' : ''}${customer?.firstName || ''} ${customer?.lastName || ''}`.trim()}
            </Text>
            {streetLine ? <Text style={styles.customerText}>{streetLine}</Text> : null}
            {cityLine ? <Text style={styles.customerText}>{cityLine}</Text> : null}
          </View>
        </View>

        <Text style={styles.docTitle}>Umzugsgut / Inventarliste</Text>

        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderCell, styles.col1]}>Menge</Text>
            <Text style={[styles.tableHeaderCell, styles.col2]}>Gegenstand & Hinweise</Text>
          </View>
          {items?.map((item: any, i: number) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
              <Text style={[styles.tableCellBold, styles.col1]}>{item.quantity}x</Text>
              <View style={styles.col2}>
                <Text style={styles.tableCellBold}>{item.name}</Text>
                {item.note && item.showNoteInPdf !== false && (
                  <Text style={{ fontSize: 8.5, color: PDF_COLORS.textMuted, marginTop: 2 }}>Notiz: {item.note}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <PDFFooter settings={settings} />
      </Page>
    </Document>
  );
};
