import React from 'react';
import { View, Text, StyleSheet, Svg, Path, Rect, G, Circle } from '@react-pdf/renderer';

interface PDFWatermarkProps {
  type?: 'symbols' | 'text';
  text?: string;
  softRows?: number[];
}

// Exact vector contours of the official Rothirsch logo (House behind + Rothirsch deer in front)
// traced directly from /Rothirsch.png in a unified 100x100 coordinate space
const ROTHIRSCH_HOUSE_OUTLINE_PATH =
  'M42.0 1.0 L82.0 41.0 L75.0 48.0 L75.0 98.5 L8.0 98.5 L8.0 48.0 L1.0 41.0 Z';

const ROTHIRSCH_DEER_PATH =
  'M77.5 1.0 L79.5 2.5 L79.5 8.0 L79.0 8.0 L78.0 12.0 L76.5 14.0 L76.5 15.5 L76.0 15.5 L76.0 19.0 L76.5 19.0 L77.5 22.0 L78.5 22.5 L79.0 26.5 L81.5 26.5 L81.5 24.0 L81.0 24.0 L80.5 21.5 L82.0 22.0 L84.5 24.5 L87.5 20.5 L87.5 18.0 L86.5 17.0 L84.0 16.5 L84.0 16.0 L82.0 16.0 L80.0 14.0 L80.0 13.5 L80.0 13.0 L82.5 13.5 L82.5 14.0 L84.5 14.0 L84.5 13.5 L84.5 13.0 L84.0 13.0 L84.0 12.5 L84.0 12.0 L82.5 10.0 L82.5 7.5 L82.0 7.5 L82.5 5.5 L83.5 6.0 L85.5 11.0 L86.5 11.5 L86.5 12.0 L86.5 12.5 L89.5 15.5 L90.0 17.0 L93.0 13.0 L93.5 9.5 L93.0 9.5 L93.0 8.0 L92.5 8.0 L92.0 6.0 L89.5 4.0 L88.5 1.5 L91.0 2.0 L92.0 3.5 L92.5 3.5 L93.0 3.5 L93.0 4.0 L93.0 4.5 L94.0 5.0 L94.0 5.5 L94.0 6.0 L95.0 7.0 L95.5 10.5 L96.0 10.5 L95.5 1.0 L96.0 1.0 L96.5 1.0 L96.5 1.5 L96.5 2.0 L97.5 2.5 L97.5 3.0 L97.5 3.5 L98.5 4.5 L98.5 6.0 L99.0 6.0 L99.0 7.5 L99.5 7.5 L99.5 9.5 L99.0 9.5 L98.0 12.5 L96.0 14.0 L96.0 14.5 L96.0 15.0 L93.0 17.5 L93.0 18.0 L93.0 18.5 L90.0 21.5 L90.0 22.0 L90.5 22.0 L90.5 21.5 L94.0 21.0 L94.0 24.0 L93.5 24.0 L93.0 26.5 L90.0 29.5 L88.5 30.0 L89.0 33.0 L89.5 33.0 L89.5 36.0 L90.0 36.0 L90.0 34.0 L90.5 34.0 L90.5 34.5 L90.5 35.0 L91.5 36.0 L91.5 38.0 L92.0 38.0 L92.5 50.5 L92.0 50.5 L92.0 55.5 L91.5 55.5 L91.0 58.5 L92.0 57.5 L92.5 57.5 L93.0 57.5 L93.0 59.0 L92.5 59.0 L92.5 62.0 L92.0 62.0 L92.0 63.5 L91.5 63.5 L91.0 65.5 L89.5 66.5 L89.5 67.0 L89.5 67.5 L85.0 72.0 L85.0 72.5 L85.0 73.0 L83.5 75.0 L83.0 78.0 L82.5 78.0 L82.5 80.0 L82.0 80.0 L81.5 83.5 L81.0 83.5 L81.0 86.0 L80.5 86.0 L80.5 88.5 L80.0 88.5 L80.0 95.0 L80.5 95.0 L80.5 96.5 L81.0 96.5 L81.0 99.5 L78.0 99.5 L78.0 91.0 L77.5 91.0 L77.5 89.0 L77.0 89.0 L76.5 89.0 L76.0 93.5 L75.5 93.5 L76.0 99.5 L73.5 100.0 L73.0 98.5 L72.5 98.5 L72.5 86.0 L72.0 86.0 L71.5 82.0 L71.0 82.0 L71.0 81.5 L71.0 81.0 L69.5 79.0 L69.5 77.5 L68.5 76.5 L68.0 73.0 L64.0 73.5 L64.0 73.0 L61.0 73.0 L61.0 72.5 L59.5 72.5 L59.5 72.0 L58.0 72.0 L58.0 71.5 L53.0 72.0 L52.5 73.0 L52.0 73.0 L51.5 73.0 L50.0 75.0 L49.5 75.0 L49.0 75.0 L47.0 77.5 L46.5 77.5 L46.0 77.5 L44.0 79.5 L44.0 80.0 L44.0 80.5 L44.5 80.5 L44.5 81.0 L44.5 81.5 L45.0 81.5 L45.0 82.0 L45.0 82.5 L46.5 84.5 L47.0 87.5 L47.5 87.5 L48.5 94.0 L49.0 94.0 L49.5 96.0 L51.5 97.5 L51.5 99.0 L50.0 99.0 L50.0 99.5 L48.0 99.0 L46.5 97.5 L46.0 95.5 L45.5 95.5 L45.5 94.0 L45.0 94.0 L44.5 91.5 L43.5 90.5 L43.0 87.5 L42.5 87.5 L42.5 87.0 L42.5 86.5 L42.0 86.5 L42.0 86.0 L42.0 85.5 L41.5 85.5 L41.5 85.0 L41.5 84.5 L41.0 84.5 L41.0 84.0 L41.0 83.5 L39.5 81.5 L39.5 80.0 L39.0 80.0 L39.0 78.0 L40.0 77.0 L40.5 77.0 L41.0 77.0 L42.0 74.5 L42.5 74.5 L42.5 69.5 L40.0 69.5 L40.0 70.0 L38.5 70.0 L38.5 70.5 L36.5 71.0 L33.5 74.0 L33.5 74.5 L33.5 75.0 L29.5 78.5 L29.5 79.0 L29.5 79.5 L26.5 82.0 L26.5 82.5 L26.5 83.0 L23.5 86.0 L23.5 86.5 L23.5 87.0 L21.0 89.5 L21.0 90.0 L21.0 90.5 L20.0 91.0 L20.0 91.5 L20.0 92.0 L19.0 92.5 L19.0 93.0 L19.0 93.5 L18.0 94.5 L18.0 96.5 L19.0 97.5 L19.0 99.0 L18.5 99.0 L18.0 99.0 L18.0 99.5 L14.0 99.0 L14.0 98.5 L13.5 98.5 L13.5 95.0 L14.0 95.0 L14.0 93.5 L14.5 93.5 L16.5 88.5 L17.5 88.0 L18.0 86.0 L20.0 84.0 L21.5 80.5 L23.0 79.5 L23.0 79.0 L23.0 78.5 L23.5 78.5 L24.5 75.5 L25.5 75.0 L25.5 74.5 L25.5 74.0 L26.0 74.0 L27.0 71.0 L28.0 70.5 L28.0 70.0 L28.0 69.5 L30.0 68.0 L30.5 66.5 L31.0 66.5 L31.5 66.5 L32.0 65.5 L32.5 65.5 L33.0 65.5 L34.0 64.5 L33.0 63.5 L33.0 62.0 L32.5 62.0 L32.5 57.5 L33.0 57.5 L33.0 57.0 L33.0 56.5 L28.5 57.0 L28.5 56.5 L28.0 56.5 L27.5 56.5 L27.5 56.0 L27.5 55.5 L28.0 55.5 L28.5 55.5 L29.0 54.5 L32.5 53.0 L38.0 47.0 L38.5 47.0 L39.0 47.0 L39.0 46.5 L39.5 46.5 L40.0 46.5 L41.0 45.5 L47.5 45.0 L47.5 45.5 L51.5 45.5 L51.5 46.0 L55.5 46.0 L55.5 46.5 L65.0 46.5 L65.0 46.0 L69.5 45.5 L69.5 45.0 L72.0 44.5 L72.0 44.0 L72.5 44.0 L73.0 44.0 L75.0 42.5 L80.0 41.5 L80.0 41.0 L77.0 41.0 L77.0 40.5 L70.0 40.0 L67.5 37.5 L67.5 36.0 L67.0 36.0 L67.0 35.5 L67.0 35.0 L68.5 33.5 L71.5 33.0 L74.0 31.0 L74.0 30.5 L74.0 30.0 L73.5 30.0 L73.0 30.0 L72.5 29.0 L72.0 29.0 L71.5 29.0 L70.5 28.0 L69.5 24.5 L73.5 25.5 L74.0 26.5 L76.5 27.5 L75.5 22.5 L74.0 21.0 L72.0 21.0 L72.0 20.5 L65.5 20.5 L65.5 20.0 L64.0 20.0 L64.0 19.5 L61.0 18.5 L58.0 15.5 L58.0 14.0 L58.5 14.0 L60.0 15.5 L60.5 15.5 L61.0 15.5 L61.5 16.5 L62.0 16.5 L62.5 16.5 L62.5 17.0 L63.0 17.0 L63.5 17.0 L63.5 17.5 L64.0 17.5 L64.5 17.5 L65.5 18.5 L69.0 18.5 L69.0 18.0 L69.0 17.5 L68.0 16.5 L67.5 16.5 L67.0 16.5 L65.0 14.5 L65.0 14.0 L65.0 13.5 L64.0 13.0 L64.0 12.5 L64.0 12.0 L63.5 12.0 L63.5 11.5 L63.5 11.0 L63.0 11.0 L63.0 10.5 L63.0 10.0 L62.5 10.0 L62.5 9.5 L62.5 9.0 L61.5 8.0 L61.5 6.5 L61.0 6.5 L61.0 4.0 L61.5 4.0 L63.0 7.5 L65.5 10.0 L65.5 10.5 L65.5 11.0 L67.5 12.5 L68.0 14.0 L68.5 14.0 L69.0 14.0 L71.0 16.0 L74.0 16.0 L74.5 14.5 L75.0 14.5 L74.5 11.5 L70.0 7.5 L69.0 4.0 L69.5 4.0 L69.5 2.5 L70.0 2.5 L71.0 5.5 L76.5 10.0 L76.5 9.5 L76.5 9.0 L77.5 8.5 L77.5 7.0 L78.0 7.0 L77.5 1.0 Z M79.0 30.0 L78.0 30.5 L78.0 31.0 L78.0 31.5 L80.5 30.5 L80.5 30.0 L79.0 30.0 Z M75.5 70.5 L73.5 71.0 L73.5 71.5 L74.0 71.5 L74.5 78.5 L75.0 78.5 L75.5 81.5 L76.5 82.0 L77.0 78.5 L77.5 78.5 L77.5 76.0 L78.0 76.0 L78.0 73.0 L78.5 73.0 L79.0 70.5 L75.5 70.5 Z';

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

export const PDFWatermark: React.FC<PDFWatermarkProps> = ({
  type = 'symbols',
  text = 'Rothirsch Umzug',
  softRows = [],
}) => {
  if (type === 'text') {
    return (
      <View style={styles.textContainer} fixed>
        <Text style={styles.watermarkText}>{text}</Text>
      </View>
    );
  }

  // Dichtes 6x9 Zellengitter (54 Zellen) sicher unterhalb der Kopfzeile/Absenderzeile bis vor die Fußzeile
  const COLS = [48, 138, 228, 318, 408, 498];
  const ROWS = [154, 220, 286, 352, 418, 484, 550, 616, 682];

  // Geometrische Skalierungs-Variation: Groß, Mittel, Klein
  // Für erklärende Textbereiche (softRows, z.B. Versicherungsschutz, Zahlungsbedingungen, Beauftragung)
  // werden die Symbole deutlich sanfter und weniger intensiv (#FAF3F5 / #FBF6F7) sowie feiner gezeichnet,
  // damit der Fließtext darüber glasklar lesbar bleibt, ohne weiße Boxen über den Text legen zu müssen.
  const getScaleAndColor = (rowIdx: number, colIdx: number) => {
    const isSoft = softRows.includes(rowIdx);
    const pattern = (rowIdx + colIdx) % 3;
    if (pattern === 0) {
      return {
        scale: 0.58,
        strokeColor: isSoft ? '#FAF2F4' : '#F3E3E6', // Groß
        strokeFactor: isSoft ? 0.65 : 1,
      };
    } else if (pattern === 1) {
      return {
        scale: 0.32,
        strokeColor: isSoft ? '#FCF8F9' : '#F8EFF1', // Klein
        strokeFactor: isSoft ? 0.65 : 1,
      };
    } else {
      return {
        scale: 0.44,
        strokeColor: isSoft ? '#FBF5F7' : '#F6E9EB', // Mittel
        strokeFactor: isSoft ? 0.65 : 1,
      };
    }
  };

  const renderCellIcon = (
    iconIndex: number,
    x: number,
    y: number,
    scale: number,
    strokeColor: string,
    strokeFactor: number,
    key: string
  ) => {
    const sw25 = 2.5 * strokeFactor;
    const sw22 = 2.2 * strokeFactor;
    const sw20 = 2.0 * strokeFactor;
    const sw18 = 1.8 * strokeFactor;
    const sw30 = 3.0 * strokeFactor;
    const sw35 = 3.5 * strokeFactor;

    switch (iconIndex) {
      case 0:
        // 1. Umzugskarton 3D
        return (
          <G key={key} transform={`translate(${x - 40 * scale}, ${y - 42 * scale}) scale(${scale})`}>
            <Path d="M40 5 L75 22 L75 65 L40 82 L5 65 L5 22 Z" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Path d="M40 5 L40 82" stroke={strokeColor} strokeWidth={sw20} />
            <Path d="M5 22 L40 40 L75 22" fill="none" stroke={strokeColor} strokeWidth={sw20} />
            <Path d="M40 5 L40 40" stroke={strokeColor} strokeWidth={sw35} />
          </G>
        );
      case 1:
        // 2. Moderner Umzugs-LKW
        return (
          <G key={key} transform={`translate(${x - 55 * scale}, ${y - 30 * scale}) scale(${scale})`}>
            <Rect x="5" y="10" width="68" height="40" rx="2" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Path d="M73 22 L89 22 L100 35 L100 50 L73 50 Z" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Path d="M77 25 L87 25 L95 35 L77 35 Z" fill="none" stroke={strokeColor} strokeWidth={sw18} />
            <Circle cx="24" cy="50" r="6.8" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Circle cx="84" cy="50" r="6.8" fill="none" stroke={strokeColor} strokeWidth={sw25} />
          </G>
        );
      case 2:
        // 3. Sackkarre / Handkarre mit Karton
        return (
          <G key={key} transform={`translate(${x - 22 * scale}, ${y - 38 * scale}) scale(${scale})`}>
            <Path d="M15 10 L15 65 L40 65" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Path d="M10 12 L15 10" stroke={strokeColor} strokeWidth={sw25} />
            <Circle cx="15" cy="65" r="7" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Rect x="20" y="35" width="28" height="25" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={sw20} />
          </G>
        );
      case 3:
        // 4. Kartonstapel (2 Boxen)
        return (
          <G key={key} transform={`translate(${x - 35 * scale}, ${y - 38 * scale}) scale(${scale})`}>
            <Rect x="10" y="35" width="55" height="35" rx="2" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Path d="M10 44 L65 44" stroke={strokeColor} strokeWidth={sw18} />
            <Rect x="18" y="5" width="40" height="30" rx="2" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Path d="M18 13 L58 13" stroke={strokeColor} strokeWidth={sw18} />
          </G>
        );
      case 4:
        // 5. Möbel / Moderner Sessel
        return (
          <G key={key} transform={`translate(${x - 35 * scale}, ${y - 35 * scale}) scale(${scale})`}>
            <Path d="M15 15 C15 8, 55 8, 55 15 L55 38 L15 38 Z" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Rect x="10" y="38" width="50" height="15" rx="3" fill="none" stroke={strokeColor} strokeWidth={sw22} />
            <Path d="M10 26 L10 53 M60 26 L60 53" stroke={strokeColor} strokeWidth={sw30} />
            <Path d="M16 53 L13 65 M54 53 L57 65" stroke={strokeColor} strokeWidth={sw25} />
          </G>
        );
      case 5:
        // 6. Zerbrechlich / Glas-Symbol (Fragile)
        return (
          <G key={key} transform={`translate(${x - 28 * scale}, ${y - 30 * scale}) scale(${scale})`}>
            <Path d="M20 10 C20 30, 45 30, 45 10 Z" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Path d="M32.5 30 L32.5 50" stroke={strokeColor} strokeWidth={sw25} />
            <Path d="M22 50 L43 50" stroke={strokeColor} strokeWidth={sw25} />
            <Path d="M28 10 L30 18 L26 23" fill="none" stroke={strokeColor} strokeWidth={sw18} />
          </G>
        );
      case 6:
        // 7. Auftrags-Klemmbrett / Checkliste
        return (
          <G key={key} transform={`translate(${x - 30 * scale}, ${y - 35 * scale}) scale(${scale})`}>
            <Rect x="10" y="10" width="45" height="60" rx="3" fill="none" stroke={strokeColor} strokeWidth={sw25} />
            <Rect x="22" y="5" width="20" height="9" rx="1.5" fill="none" stroke={strokeColor} strokeWidth={sw20} />
            <Path d="M18 25 L22 29 L30 21 M35 25 L48 25" stroke={strokeColor} strokeWidth={sw20} fill="none" />
            <Path d="M18 40 L22 44 L30 36 M35 40 L48 40" stroke={strokeColor} strokeWidth={sw20} fill="none" />
            <Path d="M18 55 L22 59 L30 51 M35 55 L48 55" stroke={strokeColor} strokeWidth={sw20} fill="none" />
          </G>
        );
      case 7: {
        // 8. Komplettes Rothirsch-Logo als Symbol (Weißes Haus dahinter + Rothirsch davor)
        const logoScale = scale * 1.15;
        return (
          <G key={key} transform={`translate(${x - 50 * logoScale}, ${y - 50 * logoScale}) scale(${logoScale})`}>
            {/* 1. Weißes Haus im Hintergrund (als Symbol mit klarem Umriss + weißer Füllung) */}
            <Path
              d={ROTHIRSCH_HOUSE_OUTLINE_PATH}
              fill="#FFFFFF"
              stroke={strokeColor}
              strokeWidth={sw25}
              strokeLinejoin="round"
            />
            {/* 2. Weißer Trennungs-Halo (Abstand zwischen Haus und Hirsch wie im Original-Logo) */}
            <Path
              d={ROTHIRSCH_DEER_PATH}
              fill="#FFFFFF"
              stroke="#FFFFFF"
              strokeWidth={4.2}
              strokeLinejoin="round"
            />
            {/* 3. Offizieller Rothirsch im Vordergrund vor dem Haus */}
            <Path d={ROTHIRSCH_DEER_PATH} fillRule="evenodd" fill={strokeColor} />
          </G>
        );
      }
      default:
        return null;
    }
  };

  return (
    <View style={styles.container} fixed>
      <Svg width="100%" height="100%" viewBox="0 0 595 842">
        {/* Vollständiges 6x9 Zellengitter (alle 54 Zellen ohne großes Zentralsymbol) */}
        {ROWS.map((y, rowIdx) =>
          COLS.map((x, colIdx) => {
            const cellIndex = (rowIdx * COLS.length + colIdx) % 8;
            const { scale, strokeColor, strokeFactor } = getScaleAndColor(rowIdx, colIdx);
            return renderCellIcon(cellIndex, x, y, scale, strokeColor, strokeFactor, `grid-${rowIdx}-${colIdx}`);
          })
        )}
      </Svg>
    </View>
  );
};
