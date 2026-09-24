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
    top: 762,
    left: 36,
    right: 36,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    width: '24%',
  },
  colTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginBottom: 3,
  },
  colText: {
    fontSize: 7.5,
    color: '#444444',
    lineHeight: 1.35,
  },
});

export const PDFFooter: React.FC<PDFFooterProps> = ({ settings }) => {
  const companyName = settings?.companyName || 'Rothirsch Umzug';
  const street = settings?.street || '';
  const zip = settings?.zip || '';
  const city = settings?.city || '';
  const manager = settings?.manager || '';

  const phone = settings?.phone || '';
  const email = settings?.email || '';
  const website = settings?.website || '';

  const bankName = settings?.bankName || '';
  const iban = settings?.iban || '';
  const bic = settings?.bic || '';

  const taxId = settings?.taxId || '';
  const taxNumber = settings?.taxNumber || '';
  const register = settings?.register || '';

  return (
    <View style={styles.footerContainer} fixed>
      {/* Col 1: Unternehmen (Allgemeine Firmendaten) */}
      <View style={styles.col}>
        <Text style={styles.colTitle}>Unternehmen</Text>
        {companyName ? <Text style={styles.colText}>{companyName}</Text> : null}
        {street ? <Text style={styles.colText}>{street}</Text> : null}
        {(zip || city) ? <Text style={styles.colText}>{`${zip} ${city}`.trim()}</Text> : null}
        {manager ? <Text style={styles.colText}>Inhaber/-in: {manager}</Text> : null}
      </View>

      {/* Col 2: Kontakt */}
      <View style={styles.col}>
        <Text style={styles.colTitle}>Kontakt</Text>
        {phone ? <Text style={styles.colText}>Tel: {phone}</Text> : null}
        {email ? <Text style={styles.colText}>E-Mail: {email}</Text> : null}
        {website ? <Text style={styles.colText}>Web: {website}</Text> : null}
      </View>

      {/* Col 3: Bankverbindung */}
      <View style={styles.col}>
        <Text style={styles.colTitle}>Bankverbindung</Text>
        {bankName ? <Text style={styles.colText}>Bank: {bankName}</Text> : null}
        {iban ? <Text style={styles.colText}>IBAN: {iban}</Text> : null}
        {bic ? <Text style={styles.colText}>BIC: {bic}</Text> : null}
      </View>

      {/* Col 4: Steuern & Recht */}
      <View style={styles.col}>
        <Text style={styles.colTitle}>Steuern & Recht</Text>
        {taxId ? <Text style={styles.colText}>USt-IdNr: {taxId}</Text> : null}
        {taxNumber ? <Text style={styles.colText}>Steuer-Nr: {taxNumber}</Text> : null}
        {register ? <Text style={styles.colText}>{register}</Text> : null}
      </View>
    </View>
  );
};
