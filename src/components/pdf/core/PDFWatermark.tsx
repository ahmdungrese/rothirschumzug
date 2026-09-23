import React from 'react';
import { View, Text, StyleSheet, Svg, Path, Rect, G, Circle } from '@react-pdf/renderer';
import { PDF_COLORS } from './pdfTheme';

interface PDFWatermarkProps {
  type?: 'symbols' | 'text';
  text?: string;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
    overflow: 'hidden',
  },
  textContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  watermarkText: {
    fontSize: 52,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    opacity: 0.04,
    transform: 'rotate(-45deg)',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});

export const PDFWatermark: React.FC<PDFWatermarkProps> = ({ type = 'symbols', text = 'Rothirsch Umzug' }) => {
  if (type === 'text') {
    return (
      <View style={styles.textContainer} fixed>
        <Text style={styles.watermarkText}>{text}</Text>
      </View>
    );
  }

  const strokeColor = PDF_COLORS.primary;

  // Dichtes 6x10 Zellengitter (60 Zellen) für eine gleichmäßige, mathematische Abdeckung
  const COLS = [48, 138, 228, 318, 408, 498];
  const ROWS = [65, 142, 219, 296, 373, 450, 527, 604, 681, 758];

  // Geometrische Skalierungs-Variation: Groß, Mittel, Klein
  const getScaleAndOpacity = (rowIdx: number, colIdx: number) => {
    const pattern = (rowIdx + colIdx) % 3;
    if (pattern === 0) {
      return { scale: 0.58, opacity: 0.028 }; // Groß
    } else if (pattern === 1) {
      return { scale: 0.32, opacity: 0.020 }; // Klein
    } else {
      return { scale: 0.44, opacity: 0.024 }; // Mittel
    }
  };

  const renderCellIcon = (iconIndex: number, x: number, y: number, scale: number, opacity: number, key: string) => {
    switch (iconIndex) {
      case 0:
        // 1. Umzugskarton 3D
        return (
          <G key={key} opacity={opacity} transform={`translate(${x - 40 * scale}, ${y - 42 * scale}) scale(${scale})`}>
            <Path d="M40 5 L75 22 L75 65 L40 82 L5 65 L5 22 Z" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M40 5 L40 82" stroke={strokeColor} strokeWidth={2} />
            <Path d="M5 22 L40 40 L75 22" fill="none" stroke={strokeColor} strokeWidth={2} />
            <Path d="M40 5 L40 40" stroke={strokeColor} strokeWidth={3.5} />
          </G>
        );
      case 1:
        // 2. Moderner Umzugs-LKW
        return (
          <G key={key} opacity={opacity} transform={`translate(${x - 55 * scale}, ${y - 30 * scale}) scale(${scale})`}>
            <Rect x="5" y="10" width="68" height="40" rx="2" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M73 22 L89 22 L100 35 L100 50 L73 50 Z" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M77 25 L87 25 L95 35 L77 35 Z" fill="none" stroke={strokeColor} strokeWidth={1.8} />
            <Circle cx="24" cy="50" r="6.8" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Circle cx="84" cy="50" r="6.8" fill="none" stroke={strokeColor} strokeWidth={2.5} />
          </G>
        );
      case 2:
        // 3. Sackkarre / Handkarre mit Karton
        return (
          <G key={key} opacity={opacity} transform={`translate(${x - 22 * scale}, ${y - 38 * scale}) scale(${scale})`}>
            <Path d="M15 10 L15 65 L40 65" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M10 12 L15 10" stroke={strokeColor} strokeWidth={2.5} />
            <Circle cx="15" cy="65" r="7" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Rect x="20" y="35" width="28" height="25" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={2} />
          </G>
        );
      case 3:
        // 4. Kartonstapel (2 Boxen)
        return (
          <G key={key} opacity={opacity} transform={`translate(${x - 35 * scale}, ${y - 38 * scale}) scale(${scale})`}>
            <Rect x="10" y="35" width="55" height="35" rx="2" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M10 44 L65 44" stroke={strokeColor} strokeWidth={1.8} />
            <Rect x="18" y="5" width="40" height="30" rx="2" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M18 13 L58 13" stroke={strokeColor} strokeWidth={1.8} />
          </G>
        );
      case 4:
        // 5. Möbel / Moderner Sessel
        return (
          <G key={key} opacity={opacity} transform={`translate(${x - 35 * scale}, ${y - 35 * scale}) scale(${scale})`}>
            <Path d="M15 15 C15 8, 55 8, 55 15 L55 38 L15 38 Z" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Rect x="10" y="38" width="50" height="15" rx="3" fill="none" stroke={strokeColor} strokeWidth={2.2} />
            <Path d="M10 26 L10 53 M60 26 L60 53" stroke={strokeColor} strokeWidth={3} />
            <Path d="M16 53 L13 65 M54 53 L57 65" stroke={strokeColor} strokeWidth={2.5} />
          </G>
        );
      case 5:
        // 6. Zerbrechlich / Glas-Symbol (Fragile)
        return (
          <G key={key} opacity={opacity} transform={`translate(${x - 28 * scale}, ${y - 30 * scale}) scale(${scale})`}>
            <Path d="M20 10 C20 30, 45 30, 45 10 Z" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M32.5 30 L32.5 50" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M22 50 L43 50" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M28 10 L30 18 L26 23" fill="none" stroke={strokeColor} strokeWidth={1.8} />
          </G>
        );
      case 6:
        // 7. Auftrags-Klemmbrett / Checkliste
        return (
          <G key={key} opacity={opacity} transform={`translate(${x - 30 * scale}, ${y - 35 * scale}) scale(${scale})`}>
            <Rect x="10" y="10" width="45" height="60" rx="3" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Rect x="22" y="5" width="20" height="9" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={2} />
            <Path d="M18 25 L22 29 L30 21 M35 25 L48 25" stroke={strokeColor} strokeWidth={2} fill="none" />
            <Path d="M18 40 L22 44 L30 36 M35 40 L48 40" stroke={strokeColor} strokeWidth={2} fill="none" />
            <Path d="M18 55 L22 59 L30 51 M35 55 L48 55" stroke={strokeColor} strokeWidth={2} fill="none" />
          </G>
        );
      case 7:
        // 8. Klebebandroller / Paketklebeband
        return (
          <G key={key} opacity={opacity} transform={`translate(${x - 30 * scale}, ${y - 25 * scale}) scale(${scale})`}>
            <Circle cx="25" cy="25" r="16" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Circle cx="25" cy="25" r="7" fill="none" stroke={strokeColor} strokeWidth={1.8} />
            <Path d="M37 15 L52 10 L52 35 L40 33" fill="none" stroke={strokeColor} strokeWidth={2} />
          </G>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container} fixed>
      <Svg width="100%" height="100%" viewBox="0 0 595 842">
        {/* Render dense 6x10 mathematical cell matrix with alternating large/medium/small scales */}
        {ROWS.map((y, rowIdx) =>
          COLS.map((x, colIdx) => {
            const cellIndex = (rowIdx * COLS.length + colIdx) % 8;
            const { scale, opacity } = getScaleAndOpacity(rowIdx, colIdx);
            return renderCellIcon(cellIndex, x, y, scale, opacity, `grid-${rowIdx}-${colIdx}`);
          })
        )}
      </Svg>
    </View>
  );
};
