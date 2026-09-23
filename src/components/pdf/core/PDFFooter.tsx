import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { PDF_COLORS } from './pdfTheme';

interface PDFFooterProps {
  settings?: any;
  customNote?: string;
}

const styles = StyleSheet.create({
  footerContainer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    paddingTop: 6,
  },
  columnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    width: '24%',
  },
  colTitle: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 3,
  },
  colText: {
    fontSize: 6.8,
    color: PDF_COLORS.textMuted,
    lineHeight: 1.35,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 3,
    borderTopWidth: 0.5,
    borderTopColor: PDF_COLORS.borderLight,
  },
  bottomNote: {
    fontSize: 6.5,
    color: PDF_COLORS.textLight,
  },
  pageNumber: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.textMuted,
  }
});

export const PDFFooter: React.FC<PDFFooterProps> = ({ settings, customNote }) => {
  const companyName = settings?.companyName || 'Rothirsch Umzug';
  const street = settings?.street || 'Haydnstr. 16';
  const zip = settings?.zip || '44805';
  const city = settings?.city || 'Bochum';
  const manager = settings?.manager || 'Tarek Lababidi';
  
  const phone = settings?.phone || '+49 177 4652154';
  const email = settings?.email || 'info@rothirsch-umzug.de';
  const website = settings?.website || 'www.rothirsch-umzug.de';
  
  const bankName = settings?.bankName || 'Sparkasse Bochum';
  const iban = settings?.iban || 'DE51 4305 0001 0033 4371 12';
  const bic = settings?.bic || 'WELADED1B0C';
  
  const taxId = settings?.taxId || 'DE369077991';
  const taxNumber = settings?.taxNumber || '350/5143/3272';

  return (
    <View style={styles.footerContainer} fixed>
      <View style={styles.columnsRow}>
        {/* Col 1: Unternehmen */}
        <View style={styles.col}>
          <Text style={styles.colTitle}>Unternehmen</Text>
          <Text style={styles.colText}>{companyName}</Text>
          <Text style={styles.colText}>{street}</Text>
          <Text style={styles.colText}>{zip} {city}</Text>
          {manager ? <Text style={styles.colText}>Inh.: {manager}</Text> : null}
        </View>

        {/* Col 2: Kontakt */}
        <View style={styles.col}>
          <Text style={styles.colTitle}>Kontakt</Text>
          <Text style={styles.colText}>Tel: {phone}</Text>
          <Text style={styles.colText}>E-Mail: {email}</Text>
          <Text style={styles.colText}>Web: {website}</Text>
        </View>

        {/* Col 3: Bankverbindung */}
        <View style={styles.col}>
          <Text style={styles.colTitle}>Bankverbindung</Text>
          <Text style={styles.colText}>{bankName}</Text>
          <Text style={styles.colText}>IBAN: {iban}</Text>
          <Text style={styles.colText}>BIC: {bic}</Text>
        </View>

        {/* Col 4: Steuern & Register */}
        <View style={styles.col}>
          <Text style={styles.colTitle}>Steuer & Recht</Text>
          {taxId ? <Text style={styles.colText}>USt-IdNr: {taxId}</Text> : null}
          {taxNumber ? <Text style={styles.colText}>St.-Nr: {taxNumber}</Text> : null}
          <Text style={styles.colText}>Amtsgericht Bochum</Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <Text style={styles.bottomNote}>
          {customNote || `${companyName} • Ihr verlässlicher Umzugspartner`}
        </Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
        />
      </View>
    </View>
  );
};
