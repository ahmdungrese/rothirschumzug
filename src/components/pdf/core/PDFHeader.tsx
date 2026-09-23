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
  },
  companyName: {
    fontSize: 21,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    letterSpacing: 1.2,
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
    marginTop: -6, // Shifts the word Rothirsch and deer up to optical center
  },
  dividerLine: {
    borderBottomWidth: 1.2,
    borderBottomColor: PDF_COLORS.primary,
    marginBottom: 6,
  },
  senderLine: {
    fontSize: 7.5,
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
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  minimalLogoImage: {
    width: 18,
    height: 18,
    objectFit: 'contain',
    marginTop: -1.5,
  }
});

export const PDFHeader: React.FC<PDFHeaderProps> = ({ settings, minimal = false, docTitle = '' }) => {
  const companyName = settings?.companyName || 'Rothirsch Umzug';
  const street = settings?.street || 'Haydnstr. 16';
  const zip = settings?.zip || '44805';
  const city = settings?.city || 'Bochum';

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
      {/* Top Row: Company Name only on the LEFT, Centered Black Circle Logo on the RIGHT */}
      <View style={styles.topRow}>
        <View style={styles.brandLeftBox}>
          <Text style={styles.companyName}>ROTHIRSCH UMZUG</Text>
        </View>

        <View style={styles.blackCircleWrapper}>
          <Image src="/Rothirsch.png" style={styles.logoImage} />
        </View>
      </View>

      {/* Red accent line */}
      <View style={styles.dividerLine} />

      {/* DIN 5008 Absenderzeile */}
      <Text style={styles.senderLine}>
        {companyName} • {street} • {zip} {city}
      </Text>
    </View>
  );
};
