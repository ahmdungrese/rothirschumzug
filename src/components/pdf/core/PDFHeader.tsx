import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { PDF_COLORS } from './pdfTheme';

interface PDFHeaderProps {
  settings?: any;
  minimal?: boolean;
  docTitle?: string;
}

const styles = StyleSheet.create({
  headerFull: {
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  brandLeftBox: {
    justifyContent: 'center',
    maxWidth: '68%',
  },
  companyName: {
    fontSize: 21,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  blackCircleWrapper: {
    backgroundColor: '#1a1a1a',
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: 65,
    height: 65,
    objectFit: 'contain',
    marginTop: -6, // Optically centers the deer and word Rothirsch inside the black circle
  },
  dividerLine: {
    borderBottomWidth: 1.2,
    borderBottomColor: PDF_COLORS.primary,
    marginBottom: 6,
  },
  senderLine: {
    fontSize: 8,
    color: PDF_COLORS.textMuted,
    marginBottom: 12,
  },

  // Minimal header for subsequent pages
  headerMinimal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    paddingBottom: 6,
    marginBottom: 14,
  },
  companyNameMini: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
  },
  minimalLogoWrapper: {
    backgroundColor: '#1a1a1a',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  minimalLogoImage: {
    width: 22,
    height: 22,
    objectFit: 'contain',
    marginTop: -2,
  },
});

export const PDFHeader: React.FC<PDFHeaderProps> = ({ settings, minimal = false, docTitle = '' }) => {
  // Directly read from Einstellungen -> Basisdaten (Allgemeine Firmendaten)
  const companyName = settings?.companyName || 'Rothirsch Umzug';
  const street = settings?.street || '';
  const zip = settings?.zip || '';
  const city = settings?.city || '';

  const senderParts = [
    companyName,
    street,
    `${zip} ${city}`.trim(),
  ].filter(Boolean);

  if (minimal) {
    return (
      <View style={styles.headerMinimal} fixed>
        <Text style={styles.companyNameMini}>
          {companyName} {docTitle ? `• ${docTitle}` : ''}
        </Text>
        <View style={styles.minimalLogoWrapper}>
          <Image src="/Rothirsch.png" style={styles.minimalLogoImage} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.headerFull}>
      {/* Top Row: Company Name from Einstellungen on the LEFT, Black Circle Logo on the RIGHT */}
      <View style={styles.topRow}>
        <View style={styles.brandLeftBox}>
          <Text style={styles.companyName}>{companyName}</Text>
        </View>

        <View style={styles.blackCircleWrapper}>
          <Image src="/Rothirsch.png" style={styles.logoImage} />
        </View>
      </View>

      {/* Red accent line */}
      <View style={styles.dividerLine} />

      {/* DIN 5008 Absenderzeile directly from Einstellungen -> Basisdaten */}
      <Text style={styles.senderLine}>
        {senderParts.join(' • ')}
      </Text>
    </View>
  );
};
