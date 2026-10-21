import React from 'react';
import { View, Text, StyleSheet, Svg, Path, Rect, Circle, Line } from '@react-pdf/renderer';
import { ShowcaseServiceItem, DEFAULT_SHOWCASE_SERVICES, DEFAULT_SHOWCASE_TEXTS } from '@/lib/showcaseDefaults';

interface PDFServiceShowcaseProps {
  title?: string;
  subtitle?: string;
  disclaimer?: string;
  services?: ShowcaseServiceItem[];
}

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    padding: 8,
    backgroundColor: '#fafbfc',
    borderWidth: 0.8,
    borderColor: '#e2e8f0',
    borderRadius: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
    borderBottomWidth: 0.8,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 3.5,
  },
  titleText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#8F1627',
    letterSpacing: 0.3,
  },
  subtitleText: {
    fontSize: 6.8,
    color: '#64748b',
    fontStyle: 'italic',
  },
  pillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  pillItem: {
    width: '24%', // 4 columns: airy and clean, non-tabular pill design
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 0.6,
    borderColor: '#edf2f7',
    borderRadius: 4,
    paddingVertical: 3.5,
    paddingHorizontal: 4,
    marginBottom: 4.5,
  },
  pillIconBox: {
    width: 15,
    height: 15,
    marginRight: 3.5,
    alignItems: 'center',
    justifyContent: 'center',
    shrink: 0,
  },
  pillText: {
    fontSize: 6.8,
    fontFamily: 'Helvetica-Bold',
    color: '#334155',
    lineHeight: 1.15,
  },
  disclaimerText: {
    fontSize: 6.5,
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 1.25,
  },
});

// Render appropriate authentic vector icon based on icon identifier
const renderIconById = (iconId: string, color = '#8F1627') => {
  switch (iconId) {
    case 'transport':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Rect x="4" y="10" width="22" height="18" rx="2" fill="none" stroke={color} strokeWidth={2} />
          <Path d="M26 15 L33 15 L37 20 L37 28 L26 28 Z" fill="none" stroke={color} strokeWidth={2} />
          <Circle cx="11" cy="28" r="3.5" fill="none" stroke={color} strokeWidth={2} />
          <Circle cx="32" cy="28" r="3.5" fill="none" stroke={color} strokeWidth={2} />
        </Svg>
      );
    case 'kitchen':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Rect x="6" y="6" width="28" height="9" rx="1.5" fill="none" stroke={color} strokeWidth={1.8} />
          <Rect x="4" y="20" width="32" height="15" rx="1.5" fill="none" stroke={color} strokeWidth={1.8} />
          <Line x1="4" y1="24" x2="36" y2="24" stroke={color} strokeWidth={1.5} />
          <Path d="M12 20 L12 17 C12 16, 14 16, 14 17" fill="none" stroke={color} strokeWidth={1.5} />
        </Svg>
      );
    case 'furniture':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Rect x="7" y="6" width="26" height="28" rx="2" fill="none" stroke={color} strokeWidth={2} />
          <Line x1="20" y1="6" x2="20" y2="28" stroke={color} strokeWidth={1.8} />
          <Line x1="7" y1="28" x2="33" y2="28" stroke={color} strokeWidth={1.8} />
          <Line x1="17" y1="15" x2="17" y2="19" stroke={color} strokeWidth={2} />
          <Line x1="23" y1="15" x2="23" y2="19" stroke={color} strokeWidth={2} />
        </Svg>
      );
    case 'packing':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Path d="M20 7 L34 14 L20 21 L6 14 Z" fill="none" stroke={color} strokeWidth={1.8} />
          <Path d="M6 14 L20 21 L20 35 L6 28 Z" fill="none" stroke={color} strokeWidth={1.8} />
          <Path d="M20 21 L34 14 L34 28 L20 35 Z" fill="none" stroke={color} strokeWidth={1.8} />
          <Line x1="20" y1="7" x2="20" y2="21" stroke={color} strokeWidth={2} />
        </Svg>
      );
    case 'hvz':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Circle cx="20" cy="16" r="10" fill="none" stroke={color} strokeWidth={2} />
          <Line x1="13" y1="9" x2="27" y2="23" stroke={color} strokeWidth={2} />
          <Line x1="27" y1="9" x2="13" y2="23" stroke={color} strokeWidth={2} />
          <Line x1="20" y1="26" x2="20" y2="36" stroke={color} strokeWidth={2} />
          <Line x1="15" y1="36" x2="25" y2="36" stroke={color} strokeWidth={2.5} />
        </Svg>
      );
    case 'lift':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Rect x="7" y="28" width="26" height="5" rx="1" fill="none" stroke={color} strokeWidth={1.8} />
          <Circle cx="13" cy="33" r="3" fill="none" stroke={color} strokeWidth={1.8} />
          <Circle cx="27" cy="33" r="3" fill="none" stroke={color} strokeWidth={1.8} />
          <Line x1="14" y1="28" x2="31" y2="7" stroke={color} strokeWidth={1.8} />
          <Line x1="18" y1="28" x2="35" y2="7" stroke={color} strokeWidth={1.8} />
          <Rect x="23" y="12" width="8" height="6" rx="1" fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.2} />
        </Svg>
      );
    case 'light':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Path d="M14 17 C14 10, 26 10, 26 17 C26 21, 23 23, 22.5 26 L17.5 26 C17 23, 14 21, 14 17 Z" fill="none" stroke={color} strokeWidth={1.8} />
          <Line x1="17.5" y1="28" x2="22.5" y2="28" stroke={color} strokeWidth={1.5} />
          <Line x1="20" y1="5" x2="20" y2="8" stroke={color} strokeWidth={1.5} />
          <Line x1="9" y1="10" x2="11.5" y2="12.5" stroke={color} strokeWidth={1.5} />
          <Line x1="31" y1="10" x2="28.5" y2="12.5" stroke={color} strokeWidth={1.5} />
        </Svg>
      );
    case 'storage':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Path d="M6 18 L20 8 L34 18 L34 32 L6 32 Z" fill="none" stroke={color} strokeWidth={1.8} />
          <Rect x="14" y="20" width="12" height="12" fill="none" stroke={color} strokeWidth={1.5} />
          <Line x1="14" y1="24" x2="26" y2="24" stroke={color} strokeWidth={1.2} />
          <Circle cx="20" cy="14" r="2" fill={color} />
        </Svg>
      );
    case 'cleaning':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Line x1="10" y1="34" x2="24" y2="14" stroke={color} strokeWidth={2} />
          <Path d="M22 16 L28 12 L30 15 L24 19 Z" fill={color} fillOpacity={0.2} stroke={color} strokeWidth={1.5} />
          <Path d="M8 32 C6 35, 10 38, 14 35 L11 29 Z" fill="none" stroke={color} strokeWidth={1.8} />
          <Circle cx="30" cy="22" r="1.5" fill={color} />
          <Circle cx="34" cy="17" r="1" fill={color} />
        </Svg>
      );
    case 'disposal':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Rect x="10" y="14" width="20" height="20" rx="2" fill="none" stroke={color} strokeWidth={1.8} />
          <Line x1="7" y1="14" x2="33" y2="14" stroke={color} strokeWidth={2} />
          <Path d="M16 14 L16 10 L24 10 L24 14" fill="none" stroke={color} strokeWidth={1.8} />
          <Line x1="16" y1="19" x2="16" y2="28" stroke={color} strokeWidth={1.5} />
          <Line x1="20" y1="19" x2="20" y2="28" stroke={color} strokeWidth={1.5} />
          <Line x1="24" y1="19" x2="24" y2="28" stroke={color} strokeWidth={1.5} />
        </Svg>
      );
    case 'piano':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Rect x="6" y="12" width="28" height="18" rx="2" fill="none" stroke={color} strokeWidth={1.8} />
          <Line x1="13" y1="12" x2="13" y2="30" stroke={color} strokeWidth={1.2} />
          <Line x1="20" y1="12" x2="20" y2="30" stroke={color} strokeWidth={1.2} />
          <Line x1="27" y1="12" x2="27" y2="30" stroke={color} strokeWidth={1.2} />
          <Rect x="10.5" y="12" width="4" height="10" fill={color} />
          <Rect x="17.5" y="12" width="4" height="10" fill={color} />
          <Rect x="24.5" y="12" width="4" height="10" fill={color} />
        </Svg>
      );
    case 'painting':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Rect x="10" y="8" width="20" height="9" rx="2" fill="none" stroke={color} strokeWidth={1.8} />
          <Path d="M20 17 L20 22 L14 22 L14 26 L22 26 L22 34" fill="none" stroke={color} strokeWidth={1.8} />
          <Rect x="20" y="30" width="4" height="6" rx="1" fill={color} />
        </Svg>
      );
    case 'sanitary':
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Path d="M12 24 L24 24 C28 24, 28 16, 22 16 L12 16" fill="none" stroke={color} strokeWidth={1.8} />
          <Rect x="22" y="10" width="8" height="4" fill="none" stroke={color} strokeWidth={1.5} />
          <Circle cx="12" cy="30" r="2" fill={color} />
        </Svg>
      );
    case 'general':
    default:
      return (
        <Svg width="15" height="15" viewBox="0 0 40 40">
          <Circle cx="20" cy="20" r="13" fill="none" stroke={color} strokeWidth={1.8} />
          <Path d="M20 11 L22.5 17 L29 17.5 L24 21.5 L25.5 28 L20 24.5 L14.5 28 L16 21.5 L11 17.5 L17.5 17 Z" fill={color} fillOpacity={0.25} stroke={color} strokeWidth={1} />
        </Svg>
      );
  }
};

export const PDFServiceShowcase: React.FC<PDFServiceShowcaseProps> = ({
  title = DEFAULT_SHOWCASE_TEXTS.title,
  subtitle = DEFAULT_SHOWCASE_TEXTS.subtitle,
  disclaimer = DEFAULT_SHOWCASE_TEXTS.disclaimer,
  services,
}) => {
  // Use passed services or fallback to default list, filtered to enabled ones
  const rawList = (services && services.length > 0) ? services : DEFAULT_SHOWCASE_SERVICES;
  const activeServices = rawList.filter(s => s.enabled !== false);

  if (activeServices.length === 0) return null;

  return (
    <View style={styles.container} wrap={false}>
      <View style={styles.headerRow}>
        <Text style={styles.titleText}>{title}</Text>
        <Text style={styles.subtitleText}>{subtitle}</Text>
      </View>

      <View style={styles.pillsGrid}>
        {activeServices.map(item => (
          <View key={item.id} style={styles.pillItem}>
            <View style={styles.pillIconBox}>
              {renderIconById(item.icon, '#8F1627')}
            </View>
            <Text style={styles.pillText}>{item.name}</Text>
          </View>
        ))}
      </View>

      {disclaimer ? (
        <Text style={styles.disclaimerText}>{disclaimer}</Text>
      ) : null}
    </View>
  );
};
