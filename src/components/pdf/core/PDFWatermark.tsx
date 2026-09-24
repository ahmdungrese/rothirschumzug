import React from 'react';
import { View, Text, StyleSheet, Svg, Path, Rect, G, Circle } from '@react-pdf/renderer';

interface PDFWatermarkProps {
  type?: 'symbols' | 'text';
  text?: string;
}

// Exact vector contour of the official Rothirsch deer logo traced from /Rothirsch.png (90x103 coordinate space)
const ROTHIRSCH_DEER_PATH =
  'M67.0 1.0 L69.5 3.5 L69.5 6.5 L69.0 6.5 L69.0 9.0 L68.5 9.0 L68.5 9.5 L68.5 10.0 L67.0 12.0 L67.0 13.5 L66.0 14.5 L66.0 16.0 L65.5 16.0 L65.5 19.5 L66.0 19.5 L66.0 21.0 L67.0 21.5 L67.0 22.0 L67.0 22.5 L68.5 24.5 L69.0 27.5 L71.5 27.0 L71.5 25.0 L71.0 25.0 L70.5 22.5 L72.5 23.0 L73.0 24.5 L74.5 25.0 L77.5 21.0 L77.5 18.5 L76.5 17.5 L74.0 17.0 L74.0 16.5 L72.0 16.5 L70.0 15.0 L70.0 13.5 L74.5 14.5 L73.5 12.0 L73.0 12.0 L72.5 9.0 L72.0 9.0 L72.0 5.5 L73.5 6.5 L75.5 11.5 L76.5 12.0 L76.5 12.5 L76.5 13.0 L79.5 16.0 L80.0 17.5 L81.5 16.0 L81.5 15.5 L81.5 15.0 L82.5 14.5 L82.5 13.0 L83.5 12.0 L83.5 9.0 L82.5 8.0 L82.5 7.5 L82.5 7.0 L81.5 6.5 L81.5 6.0 L81.5 5.5 L79.0 3.5 L78.5 1.5 L81.5 2.5 L84.0 5.0 L85.0 8.5 L85.5 8.5 L85.5 10.5 L86.5 9.5 L86.5 7.5 L86.0 7.5 L86.0 5.5 L85.5 5.5 L85.5 1.5 L86.0 1.5 L86.0 1.0 L87.5 2.5 L87.5 3.0 L87.5 3.5 L89.0 5.5 L89.0 7.0 L89.5 7.0 L89.0 11.5 L88.0 12.0 L88.0 12.5 L88.0 13.0 L86.0 14.5 L86.0 15.0 L86.0 15.5 L84.0 17.0 L84.0 17.5 L84.0 18.0 L80.0 22.0 L80.0 22.5 L83.0 22.0 L83.0 21.5 L84.5 22.0 L84.0 25.5 L83.5 25.5 L83.0 27.5 L80.5 30.0 L78.5 30.5 L79.0 34.0 L79.5 34.0 L79.5 37.0 L80.0 37.0 L80.0 35.0 L80.5 35.0 L80.5 35.5 L80.5 36.0 L81.5 37.0 L81.5 39.0 L82.0 39.0 L82.5 52.0 L82.0 52.0 L82.0 57.0 L81.5 57.0 L81.0 60.5 L82.0 60.0 L82.0 59.5 L82.0 59.0 L82.5 59.0 L83.0 59.0 L83.0 61.0 L82.5 61.0 L82.5 64.0 L82.0 64.0 L81.0 67.5 L77.5 71.0 L77.5 71.5 L77.5 72.0 L75.0 74.0 L75.0 74.5 L75.0 75.0 L74.0 75.5 L73.5 78.0 L73.0 78.0 L73.0 80.0 L72.0 81.5 L72.0 83.5 L71.5 83.5 L71.5 85.5 L71.0 85.5 L71.0 87.5 L70.5 87.5 L70.5 90.0 L70.0 90.0 L70.0 94.0 L69.5 94.0 L70.0 98.5 L71.0 99.5 L71.0 102.5 L67.5 102.0 L67.0 91.5 L66.0 92.0 L65.5 96.5 L65.0 96.5 L65.5 102.0 L62.5 102.5 L62.5 102.0 L62.5 101.5 L62.0 101.5 L62.0 88.5 L61.5 88.5 L61.0 84.5 L60.0 84.0 L60.0 82.5 L58.5 80.5 L58.5 79.0 L57.5 77.5 L57.5 75.0 L51.5 75.5 L51.5 75.0 L49.5 75.0 L49.5 74.5 L48.0 74.5 L46.5 73.5 L42.0 74.0 L41.0 75.5 L40.5 75.5 L40.0 75.5 L39.0 77.0 L38.5 77.0 L38.0 77.0 L37.0 78.5 L36.5 78.5 L36.0 78.5 L32.5 82.0 L34.5 86.5 L35.0 86.5 L35.5 89.5 L36.0 89.5 L37.5 97.5 L40.5 100.5 L40.0 102.0 L36.0 101.5 L36.0 101.0 L36.0 100.5 L35.0 100.0 L35.0 99.5 L35.0 99.0 L34.0 98.0 L34.0 96.5 L33.5 96.5 L33.5 95.0 L32.5 94.0 L31.0 88.5 L30.0 88.0 L30.0 87.5 L30.0 87.0 L27.5 83.0 L27.5 80.0 L28.0 80.0 L28.5 80.0 L30.5 78.0 L31.0 75.5 L31.5 75.5 L31.5 72.0 L31.0 72.0 L31.0 71.5 L26.0 72.5 L20.5 77.5 L20.5 78.0 L20.5 78.5 L14.5 84.5 L14.5 85.0 L14.5 85.5 L13.0 86.5 L12.0 89.0 L10.5 90.0 L9.5 92.5 L7.5 94.0 L7.0 96.0 L6.0 96.5 L5.5 99.5 L6.5 100.0 L6.5 102.0 L2.0 102.0 L1.0 101.0 L1.0 98.5 L1.5 98.5 L2.0 95.5 L2.5 95.5 L4.0 91.5 L5.0 91.0 L7.0 86.5 L8.5 85.5 L8.5 85.0 L8.5 84.5 L9.5 84.0 L9.5 83.5 L9.5 83.0 L11.5 81.0 L11.5 80.5 L11.5 80.0 L12.0 80.0 L14.5 74.0 L16.0 73.0 L16.5 71.0 L20.0 67.5 L20.5 67.5 L21.0 67.5 L22.0 66.5 L21.0 65.0 L21.0 63.5 L20.5 63.5 L20.5 60.0 L21.0 60.0 L21.5 58.0 L16.5 58.5 L16.5 58.0 L16.0 58.0 L15.5 58.0 L16.0 57.0 L16.5 57.0 L17.0 57.0 L17.5 56.0 L20.0 55.0 L27.0 48.0 L30.5 47.0 L30.5 46.5 L38.0 46.5 L38.0 47.0 L41.5 47.0 L41.5 47.5 L52.5 48.0 L52.5 47.5 L58.0 47.0 L58.0 46.5 L61.0 46.0 L63.0 44.5 L64.5 44.5 L65.5 43.5 L69.0 43.0 L68.5 42.0 L63.0 42.0 L63.0 41.5 L59.0 41.0 L56.5 37.5 L57.0 35.0 L57.5 35.0 L58.0 35.0 L59.0 34.0 L61.0 34.0 L63.5 32.0 L63.0 30.5 L62.5 30.5 L62.0 30.5 L61.0 29.0 L60.5 29.0 L60.0 29.0 L59.0 25.5 L61.0 25.5 L61.0 26.0 L66.0 28.0 L65.5 24.5 L65.0 24.5 L64.5 22.5 L63.0 21.5 L54.5 21.0 L54.5 20.5 L52.0 20.0 L50.5 18.5 L50.0 18.5 L49.5 18.5 L47.0 15.5 L47.0 15.0 L47.0 14.5 L47.5 14.5 L48.0 14.5 L48.5 15.5 L49.0 15.5 L49.5 15.5 L50.0 16.5 L50.5 16.5 L51.0 16.5 L52.5 18.0 L54.0 18.0 L55.0 19.0 L58.5 19.0 L58.0 17.5 L56.5 17.0 L54.5 15.0 L53.5 12.5 L52.0 11.5 L52.0 10.0 L51.0 9.0 L50.5 6.0 L50.0 6.0 L50.0 4.0 L50.5 4.0 L50.5 4.5 L50.5 5.0 L51.5 5.5 L52.5 8.0 L55.0 10.5 L55.0 11.0 L55.0 11.5 L57.0 13.0 L57.5 14.5 L58.0 14.5 L58.5 14.5 L60.5 16.5 L63.5 16.5 L64.0 14.5 L64.5 14.5 L64.0 12.0 L62.0 9.5 L61.5 9.5 L61.0 9.5 L59.5 8.0 L59.5 7.5 L59.5 7.0 L58.5 6.0 L58.5 3.5 L59.5 2.5 L59.5 4.0 L61.0 5.5 L61.0 6.0 L61.0 6.5 L61.5 6.5 L62.0 6.5 L64.5 9.5 L66.0 10.0 L67.0 8.5 L67.0 7.0 L67.5 7.0 L67.0 1.0 Z M69.5 30.5 L68.0 31.0 L67.5 32.5 L69.0 32.5 L70.0 31.5 L70.0 31.0 L70.0 30.5 L69.5 30.5 Z M66.5 72.5 L63.0 73.0 L63.0 73.5 L63.5 73.5 L64.0 80.5 L64.5 80.5 L64.5 82.5 L65.0 82.5 L65.5 84.5 L66.5 83.5 L67.5 75.5 L68.5 74.0 L68.5 72.5 L66.5 72.5 Z';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  textContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermarkText: {
    fontSize: 52,
    fontFamily: 'Helvetica-Bold',
    color: '#F1F5F9', // Solid light tint (NO opacity property so PDFKit graphics state never leaks!)
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

  // Dichtes 6x9 Zellengitter (54 Zellen) exakt zwischen Kopfzeile und Fußzeile
  const COLS = [48, 138, 228, 318, 408, 498];
  const ROWS = [140, 210, 280, 350, 420, 490, 560, 630, 700];

  // Geometrische Skalierungs-Variation: Groß, Mittel, Klein
  // IMPORTANT: Use solid pre-blended Bordeaux tints (#F4E6E8, #F6EBED, #F9F1F2) instead of SVG opacity
  // to prevent @react-pdf/pdfkit from leaking graphics state opacity to PDFHeader and PDFFooter!
  const getScaleAndColor = (rowIdx: number, colIdx: number) => {
    const pattern = (rowIdx + colIdx) % 3;
    if (pattern === 0) {
      return { scale: 0.58, strokeColor: '#F3E3E6' }; // Groß
    } else if (pattern === 1) {
      return { scale: 0.32, strokeColor: '#F8EFF1' }; // Klein
    } else {
      return { scale: 0.44, strokeColor: '#F6E9EB' }; // Mittel
    }
  };

  const renderCellIcon = (iconIndex: number, x: number, y: number, scale: number, strokeColor: string, key: string) => {
    switch (iconIndex) {
      case 0:
        // 1. Umzugskarton 3D
        return (
          <G key={key} transform={`translate(${x - 40 * scale}, ${y - 42 * scale}) scale(${scale})`}>
            <Path d="M40 5 L75 22 L75 65 L40 82 L5 65 L5 22 Z" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M40 5 L40 82" stroke={strokeColor} strokeWidth={2} />
            <Path d="M5 22 L40 40 L75 22" fill="none" stroke={strokeColor} strokeWidth={2} />
            <Path d="M40 5 L40 40" stroke={strokeColor} strokeWidth={3.5} />
          </G>
        );
      case 1:
        // 2. Moderner Umzugs-LKW
        return (
          <G key={key} transform={`translate(${x - 55 * scale}, ${y - 30 * scale}) scale(${scale})`}>
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
          <G key={key} transform={`translate(${x - 22 * scale}, ${y - 38 * scale}) scale(${scale})`}>
            <Path d="M15 10 L15 65 L40 65" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M10 12 L15 10" stroke={strokeColor} strokeWidth={2.5} />
            <Circle cx="15" cy="65" r="7" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Rect x="20" y="35" width="28" height="25" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={2} />
          </G>
        );
      case 3:
        // 4. Kartonstapel (2 Boxen)
        return (
          <G key={key} transform={`translate(${x - 35 * scale}, ${y - 38 * scale}) scale(${scale})`}>
            <Rect x="10" y="35" width="55" height="35" rx="2" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M10 44 L65 44" stroke={strokeColor} strokeWidth={1.8} />
            <Rect x="18" y="5" width="40" height="30" rx="2" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M18 13 L58 13" stroke={strokeColor} strokeWidth={1.8} />
          </G>
        );
      case 4:
        // 5. Möbel / Moderner Sessel
        return (
          <G key={key} transform={`translate(${x - 35 * scale}, ${y - 35 * scale}) scale(${scale})`}>
            <Path d="M15 15 C15 8, 55 8, 55 15 L55 38 L15 38 Z" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Rect x="10" y="38" width="50" height="15" rx="3" fill="none" stroke={strokeColor} strokeWidth={2.2} />
            <Path d="M10 26 L10 53 M60 26 L60 53" stroke={strokeColor} strokeWidth={3} />
            <Path d="M16 53 L13 65 M54 53 L57 65" stroke={strokeColor} strokeWidth={2.5} />
          </G>
        );
      case 5:
        // 6. Zerbrechlich / Glas-Symbol (Fragile)
        return (
          <G key={key} transform={`translate(${x - 28 * scale}, ${y - 30 * scale}) scale(${scale})`}>
            <Path d="M20 10 C20 30, 45 30, 45 10 Z" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M32.5 30 L32.5 50" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M22 50 L43 50" stroke={strokeColor} strokeWidth={2.5} />
            <Path d="M28 10 L30 18 L26 23" fill="none" stroke={strokeColor} strokeWidth={1.8} />
          </G>
        );
      case 6:
        // 7. Auftrags-Klemmbrett / Checkliste
        return (
          <G key={key} transform={`translate(${x - 30 * scale}, ${y - 35 * scale}) scale(${scale})`}>
            <Rect x="10" y="10" width="45" height="60" rx="3" fill="none" stroke={strokeColor} strokeWidth={2.5} />
            <Rect x="22" y="5" width="20" height="9" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={2} />
            <Path d="M18 25 L22 29 L30 21 M35 25 L48 25" stroke={strokeColor} strokeWidth={2} fill="none" />
            <Path d="M18 40 L22 44 L30 36 M35 40 L48 40" stroke={strokeColor} strokeWidth={2} fill="none" />
            <Path d="M18 55 L22 59 L30 51 M35 55 L48 55" stroke={strokeColor} strokeWidth={2} fill="none" />
          </G>
        );
      case 7:
        // 8. Offizielles Rothirsch-Symbol (Hirsch-Logo als Symbol im Gitter)
        return (
          <G key={key} transform={`translate(${x - 45 * scale}, ${y - 51 * scale}) scale(${scale})`}>
            <Path d={ROTHIRSCH_DEER_PATH} fillRule="evenodd" fill={strokeColor} />
          </G>
        );
      default:
        return null;
    }
  };

  // Exact horizontal & vertical center of A4 page (595 / 2 = 297.5, 842 / 2 = 421)
  const centerX = 297.5;
  const centerY = 420;
  const centerScale = 1.45;

  return (
    <View style={styles.container} fixed>
      <Svg width="100%" height="100%" viewBox="0 0 595 842">
        {/* 1. Surrounding Geometric Cell Grid (skipping the central cells to frame the Centerpiece Rothirsch Emblem) */}
        {ROWS.map((y, rowIdx) =>
          COLS.map((x, colIdx) => {
            // Leave a clean central sanctuary at rowIdx === 3, 4, 5 & colIdx === 2, 3 for the large Rothirsch Medallion
            if ((rowIdx === 3 || rowIdx === 4 || rowIdx === 5) && (colIdx === 2 || colIdx === 3)) {
              return null;
            }
            const cellIndex = (rowIdx * COLS.length + colIdx) % 8;
            const { scale, strokeColor } = getScaleAndColor(rowIdx, colIdx);
            return renderCellIcon(cellIndex, x, y, scale, strokeColor, `grid-${rowIdx}-${colIdx}`);
          })
        )}

        {/* 2. Centerpiece Rothirsch Logo Symbol in the exact middle of the page */}
        <G>
          {/* Subtle double-ring medallion around the central Rothirsch symbol */}
          <Circle cx={centerX} cy={centerY} r={88} fill="none" stroke="#F1DEE1" strokeWidth={1.8} />
          <Circle cx={centerX} cy={centerY} r={82} fill="none" stroke="#F5E6E8" strokeWidth={1} />
          <G transform={`translate(${centerX - 45 * centerScale}, ${centerY - 51.5 * centerScale}) scale(${centerScale})`}>
            <Path d={ROTHIRSCH_DEER_PATH} fillRule="evenodd" fill="#F0E0E3" />
          </G>
        </G>
      </Svg>
    </View>
  );
};
