import { StyleSheet } from '@react-pdf/renderer';

export const PDF_COLORS = {
  primary: '#8F1627',       // Rothirsch Bordeaux
  primaryLight: '#fdf2f4',
  primaryDark: '#6b0f1d',
  textMain: '#1e293b',       // Slate 800
  textMuted: '#64748b',      // Slate 500
  textLight: '#94a3b8',      // Slate 400
  border: '#e2e8f0',         // Crisp thin slate border
  borderLight: '#f1f5f9',
  bgCard: '#ffffff',         // Clean crisp white (No muddy gray backgrounds!)
  bgSubtle: '#ffffff',
  white: '#ffffff',
  success: '#15803d',
  danger: '#b91c1c',
};

export const pdfCommonStyles = StyleSheet.create({
  page: {
    paddingHorizontal: 36,
    paddingTop: 30,
    paddingBottom: 88, // Safe buffer preventing any overlap with fixed footer
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    color: PDF_COLORS.textMain,
    lineHeight: 1.4,
    backgroundColor: '#ffffff',
  },
  
  // Document Title & Metadata
  mainTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.primary,
    marginTop: 12,
    marginBottom: 12,
  },
  
  // Table Styling
  table: {
    width: '100%',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1.5,
    borderBottomColor: PDF_COLORS.primary,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
    color: PDF_COLORS.textMain,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  
  // Totals Section
  totalsContainer: {
    alignItems: 'flex-end',
    marginTop: 6,
    marginBottom: 14,
  },
  totalsBox: {
    width: '45%',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: PDF_COLORS.border,
    padding: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2.5,
    fontSize: 8.5,
    color: PDF_COLORS.textMuted,
  },
  totalRowGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1.5,
    borderTopColor: PDF_COLORS.primary,
    fontFamily: 'Helvetica-Bold',
    fontSize: 11,
    color: PDF_COLORS.primary,
  },
});
