import React from 'react';
import { View, Text, StyleSheet, Svg, Path, Rect, G, Circle, Line } from '@react-pdf/renderer';

export interface PDFWatermarkProps {
  type?: 'single_logo' | 'symbols' | 'text' | 'none';
  density?: 'sparse' | 'dense' | 'medium';
  pageVariant?: 'page1' | 'page2' | 'agb' | 'dense' | 'sparse' | 'medium';
  text?: string;
  softRows?: number[];
  color?: string;
  scale?: number;
  y?: number;
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

// Clean vector renderer for all 10 authentic transport & service symbols
function renderLogisticsSymbol(
  symbolId: number,
  x: number,
  y: number,
  scale: number,
  color: string,
  key: string
) {
  const sw1 = 1.4;
  const sw2 = 1.8;

  switch (symbolId % 10) {
    case 0:
      // 1. Moving truck arriving at house (سيارة نقل لمنزل)
      return (
        <G key={key} transform={`translate(${x - 48 * scale}, ${y - 36 * scale}) scale(${scale})`}>
          <Path d="M12 28 L30 14 L48 28" fill="none" stroke={color} strokeWidth={sw1} />
          <Path d="M16 28 L16 54 L44 54 L44 28" fill="none" stroke={color} strokeWidth={sw1} />
          <Path d="M26 54 L26 40 L34 40 L34 54" fill="none" stroke={color} strokeWidth={sw1} />
          <Rect x="42" y="32" width="30" height="20" rx="1" fill="none" stroke={color} strokeWidth={sw1} />
          <Path d="M72 38 L84 38 L90 46 L90 52 L72 52" fill="none" stroke={color} strokeWidth={sw1} />
          <Path d="M74 40 L82 40 L86 46 L74 46 Z" fill="none" stroke={color} strokeWidth={1.0} />
          <Circle cx="52" cy="54" r="4.5" fill="none" stroke={color} strokeWidth={sw1} />
          <Circle cx="82" cy="54" r="4.5" fill="none" stroke={color} strokeWidth={sw1} />
          <Line x1="8" y1="58.5" x2="94" y2="58.5" stroke={color} strokeWidth={1.0} />
        </G>
      );
    case 1:
      // 2. House A to House B with items flying in transition (أغراض تطير من منزل إلى آخر: كرتونة وتخت)
      return (
        <G key={key} transform={`translate(${x - 50 * scale}, ${y - 25 * scale}) scale(${scale})`}>
          {/* House A (Left - Auszugsort) */}
          <Rect x="7" y="15" width="3" height="6" fill="none" stroke={color} strokeWidth={1.0} />
          <Path d="M4 23 L15 13 L26 23" fill="none" stroke={color} strokeWidth={sw2} strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="5" y="23" width="20" height="19" rx="1" fill="none" stroke={color} strokeWidth={sw1} />
          <Rect x="7.5" y="26" width="5.5" height="5.5" fill="none" stroke={color} strokeWidth={0.9} />
          <Line x1="10.25" y1="26" x2="10.25" y2="31.5" stroke={color} strokeWidth={0.7} />
          <Line x1="7.5" y1="28.75" x2="13" y2="28.75" stroke={color} strokeWidth={0.7} />
          <Rect x="16" y="26" width="5.5" height="5.5" fill="none" stroke={color} strokeWidth={0.9} />
          <Line x1="18.75" y1="26" x2="18.75" y2="31.5" stroke={color} strokeWidth={0.7} />
          <Line x1="16" y1="28.75" x2="21.5" y2="28.75" stroke={color} strokeWidth={0.7} />
          <Rect x="11.5" y="34" width="7" height="8" fill="none" stroke={color} strokeWidth={1.0} />
          <Circle cx="12.8" cy="38" r="0.6" fill={color} />
          <Line x1="2" y1="42" x2="28" y2="42" stroke={color} strokeWidth={0.9} strokeLinecap="round" />

          {/* House B (Right - Einzugsort) */}
          <Path d="M74 23 L85 13 L96 23" fill="none" stroke={color} strokeWidth={sw2} strokeLinecap="round" strokeLinejoin="round" />
          <Rect x="75" y="23" width="20" height="19" rx="1" fill="none" stroke={color} strokeWidth={sw1} />
          <Rect x="77.5" y="26" width="5.5" height="5.5" fill="none" stroke={color} strokeWidth={0.9} />
          <Line x1="80.25" y1="26" x2="80.25" y2="31.5" stroke={color} strokeWidth={0.7} />
          <Line x1="77.5" y1="28.75" x2="83" y2="28.75" stroke={color} strokeWidth={0.7} />
          <Rect x="86" y="26" width="5.5" height="5.5" fill="none" stroke={color} strokeWidth={0.9} />
          <Line x1="88.75" y1="26" x2="88.75" y2="31.5" stroke={color} strokeWidth={0.7} />
          <Line x1="86" y1="28.75" x2="91.5" y2="28.75" stroke={color} strokeWidth={0.7} />
          <Rect x="81.5" y="34" width="7" height="8" fill="none" stroke={color} strokeWidth={1.0} />
          <Circle cx="87.2" cy="38" r="0.6" fill={color} />
          <Line x1="72" y1="42" x2="98" y2="42" stroke={color} strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" />

          {/* Trajectory Arc with Arrowhead */}
          <Path d="M24 20 Q50 3 76 20" fill="none" stroke={color} strokeWidth={1.1} strokeDasharray="3 2" />
          <Path d="M72 17 L77 20 L73 23" fill="none" stroke={color} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round" />

          {/* Flying Box */}
          <G transform="translate(33, 7) rotate(-7)">
            <Path d="M6 1.5 L12 4.5 L6 7.5 L0 4.5 Z" fill="none" stroke={color} strokeWidth={1.0} />
            <Path d="M0 4.5 L6 7.5 L6 13.5 L0 10.5 Z" fill="none" stroke={color} strokeWidth={1.0} />
            <Path d="M6 7.5 L12 4.5 L12 10.5 L6 13.5 Z" fill="none" stroke={color} strokeWidth={1.0} />
            <Line x1="6" y1="1.5" x2="6" y2="7.5" stroke={color} strokeWidth={0.8} />
            <Line x1="3" y1="6" x2="9" y2="10.5" stroke={color} strokeWidth={0.6} strokeDasharray="1.2 0.8" />
          </G>

          {/* Flying Bed */}
          <G transform="translate(51, 7) rotate(6)">
            <Rect x="0" y="0" width="2.2" height="10" rx="0.6" fill="none" stroke={color} strokeWidth={0.8} />
            <Rect x="2.2" y="4" width="13.5" height="4.2" rx="0.8" fill="none" stroke={color} strokeWidth={1.0} />
            <Rect x="3" y="2.5" width="3.6" height="1.9" rx="0.6" fill="none" stroke={color} strokeWidth={0.7} />
            <Line x1="8.5" y1="4" x2="8.5" y2="8.2" stroke={color} strokeWidth={0.8} />
            <Rect x="15.7" y="2.5" width="1.8" height="7.5" rx="0.6" fill="none" stroke={color} strokeWidth={0.8} />
          </G>
        </G>
      );
    case 2:
      // 3. 3D Moving box with company deer logo & handle (كرتونة نقل عليها شعار الشركة)
      return (
        <G key={key} transform={`translate(${x - 35 * scale}, ${y - 40 * scale}) scale(${scale})`}>
          <Path d="M35 12 L65 24 L35 36 L5 24 Z" fill="none" stroke={color} strokeWidth={sw1} />
          <Path d="M5 24 L35 36 L35 68 L5 56 Z" fill="none" stroke={color} strokeWidth={sw1} />
          <Path d="M35 36 L65 24 L65 56 L35 68 Z" fill="none" stroke={color} strokeWidth={sw1} />
          <Line x1="35" y1="12" x2="35" y2="36" stroke={color} strokeWidth={sw2} />
          <Rect x="46" y="44" width="10" height="4" rx="2" fill="none" stroke={color} strokeWidth={1.0} />
          <G transform="translate(10, 36) scale(0.22)">
            <Path d={ROTHIRSCH_DEER_PATH} fillRule="evenodd" fill={color} />
          </G>
        </G>
      );
    case 3:
      // 4. Küchenzeile & Arbeitsplatte (Küchenmontage / Küchenservice)
      return (
        <G key={key} transform={`translate(${x - 35 * scale}, ${y - 35 * scale}) scale(${scale})`}>
          {/* Oberschrank / Wall cabinet */}
          <Rect x="6" y="5" width="28" height="10" rx="1.5" fill="none" stroke={color} strokeWidth={sw1} />
          <Line x1="20" y1="5" x2="20" y2="15" stroke={color} strokeWidth={1.0} />
          {/* Arbeitsplatte & Unterschrank */}
          <Rect x="4" y="20" width="32" height="16" rx="1.5" fill="none" stroke={color} strokeWidth={sw1} />
          <Line x1="4" y1="24" x2="36" y2="24" stroke={color} strokeWidth={1.0} />
          <Line x1="20" y1="24" x2="20" y2="36" stroke={color} strokeWidth={1.0} />
          {/* Wasserhahn / Spüle */}
          <Path d="M12 20 L12 17 C12 16, 14 16, 14 17" fill="none" stroke={color} strokeWidth={1.2} />
        </G>
      );
    case 4:
      // 5. Kleiderschrank / Möbelmontage (Möbelservice)
      return (
        <G key={key} transform={`translate(${x - 35 * scale}, ${y - 35 * scale}) scale(${scale})`}>
          <Rect x="7" y="5" width="26" height="30" rx="2" fill="none" stroke={color} strokeWidth={sw1} />
          <Line x1="20" y1="5" x2="20" y2="29" stroke={color} strokeWidth={1.0} />
          <Line x1="7" y1="29" x2="33" y2="29" stroke={color} strokeWidth={1.0} />
          <Line x1="17" y1="15" x2="17" y2="19" stroke={color} strokeWidth={1.2} />
          <Line x1="23" y1="15" x2="23" y2="19" stroke={color} strokeWidth={1.2} />
          <Line x1="11" y1="35" x2="11" y2="38" stroke={color} strokeWidth={1.4} />
          <Line x1="29" y1="35" x2="29" y2="38" stroke={color} strokeWidth={1.4} />
        </G>
      );
    case 5:
      // 6. Lightbulb / Lampenmontage with rays (لمبة)
      return (
        <G key={key} transform={`translate(${x - 40 * scale}, ${y - 35 * scale}) scale(${scale})`}>
          <Path d="M26 32 C26 20, 54 20, 54 32 C54 39, 47 43, 46 48 L34 48 C33 43, 26 39, 26 32 Z" fill="none" stroke={color} strokeWidth={sw1} />
          <Line x1="34" y1="51" x2="46" y2="51" stroke={color} strokeWidth={1.0} />
          <Line x1="36" y1="54" x2="44" y2="54" stroke={color} strokeWidth={1.0} />
          <Line x1="38" y1="57" x2="42" y2="57" stroke={color} strokeWidth={1.0} />
          <Line x1="40" y1="12" x2="40" y2="16" stroke={color} strokeWidth={1.2} />
          <Line x1="20" y1="20" x2="23" y2="23" stroke={color} strokeWidth={1.2} />
          <Line x1="60" y1="20" x2="57" y2="23" stroke={color} strokeWidth={1.2} />
          <Line x1="15" y1="32" x2="19" y2="32" stroke={color} strokeWidth={1.2} />
          <Line x1="65" y1="32" x2="61" y2="32" stroke={color} strokeWidth={1.2} />
        </G>
      );
    case 6:
      // 7. Halteverbotszone (HVZ Schild)
      return (
        <G key={key} transform={`translate(${x - 40 * scale}, ${y - 42 * scale}) scale(${scale})`}>
          <Circle cx="40" cy="30" r="18" fill="none" stroke={color} strokeWidth={sw1} />
          <Circle cx="40" cy="30" r="14.5" fill="none" stroke={color} strokeWidth={1.0} />
          <Line x1="29" y1="19" x2="51" y2="41" stroke={color} strokeWidth={sw2} />
          <Line x1="51" y1="19" x2="29" y2="41" stroke={color} strokeWidth={sw2} />
          <Line x1="40" y1="48" x2="40" y2="68" stroke={color} strokeWidth={sw2} />
          <Line x1="32" y1="68" x2="48" y2="68" stroke={color} strokeWidth={sw2} />
        </G>
      );
    case 7:
      // 8. Möbellift / Außenaufzug (Furniture lift)
      return (
        <G key={key} transform={`translate(${x - 42 * scale}, ${y - 36 * scale}) scale(${scale})`}>
          <Rect x="15" y="50" width="50" height="8" rx="1.5" fill="none" stroke={color} strokeWidth={sw1} />
          <Circle cx="26" cy="58" r="4.5" fill="none" stroke={color} strokeWidth={sw1} />
          <Circle cx="54" cy="58" r="4.5" fill="none" stroke={color} strokeWidth={sw1} />
          <Line x1="26" y1="50" x2="64" y2="12" stroke={color} strokeWidth={sw1} />
          <Line x1="32" y1="52" x2="70" y2="14" stroke={color} strokeWidth={sw1} />
          <Line x1="33" y1="43" x2="38" y2="45" stroke={color} strokeWidth={1.0} />
          <Line x1="41" y1="35" x2="46" y2="37" stroke={color} strokeWidth={1.0} />
          <Line x1="49" y1="27" x2="54" y2="29" stroke={color} strokeWidth={1.0} />
          <Line x1="57" y1="19" x2="62" y2="21" stroke={color} strokeWidth={1.0} />
          <Rect x="44" y="24" width="14" height="10" rx="1" fill="none" stroke={color} strokeWidth={1.0} />
        </G>
      );
    case 8:
      // 9. Sackkarre mit Umzugskarton (Hand truck)
      return (
        <G key={key} transform={`translate(${x - 22 * scale}, ${y - 38 * scale}) scale(${scale})`}>
          <Path d="M15 10 L15 65 L40 65" fill="none" stroke={color} strokeWidth={sw1} />
          <Path d="M10 12 L15 10" stroke={color} strokeWidth={sw1} />
          <Circle cx="15" cy="65" r="7" fill="none" stroke={color} strokeWidth={sw1} />
          <Rect x="20" y="35" width="28" height="25" rx="1.5" fill="none" stroke={color} strokeWidth={1.0} />
        </G>
      );
    case 9: {
      // 10. Rothirsch Haus & Hirsch Wappen (Company seal)
      const logoScale = scale * 0.9;
      return (
        <G key={key} transform={`translate(${x - 50 * logoScale}, ${y - 50 * logoScale}) scale(${logoScale})`}>
          <Path d={ROTHIRSCH_HOUSE_OUTLINE_PATH} fill="none" stroke={color} strokeWidth={sw1} strokeLinejoin="round" />
          <Path d={ROTHIRSCH_DEER_PATH} fillRule="evenodd" fill={color} />
        </G>
      );
    }
    default:
      return null;
  }
}

// 6 columns and 8 rows across A4 coordinate space (595 x 842 pt)
const COLS = [50, 148, 246, 344, 442, 540];
const ROWS = [160, 235, 310, 385, 460, 535, 610, 685];

// Dynamic Matrix Configurator (Scale variation & subtle neutral grays)
function getCellVisuals(rowIdx: number, colIdx: number, density: 'sparse' | 'dense' | 'medium') {
  // Scale variation: Large (0.52), Medium (0.38), Small (0.26)
  const pattern = (rowIdx * 2 + colIdx * 3) % 3;
  let scale = 0.38;
  if (pattern === 0) scale = 0.52; // Large
  else if (pattern === 1) scale = 0.26; // Small
  else scale = 0.38; // Medium

  // Subtle gray variation: ultra-light neutral grays so they never distract or bleed
  const grays = ['#F2F4F7', '#ECEFF3', '#E6EAEF', '#EDF0F4'];
  const color = grays[(rowIdx + colIdx) % grays.length];

  return { scale, color };
}

export const PDFWatermark: React.FC<PDFWatermarkProps> = ({
  type = 'symbols',
  density,
  pageVariant,
  text = 'Rothirsch Umzug',
  color = '#F1F3F5',
  scale = 2.0,
  y = 440,
}) => {
  if (type === 'none') {
    return null;
  }

  if (type === 'text') {
    return (
      <View style={styles.textContainer} fixed>
        <Text style={styles.watermarkText}>{text}</Text>
      </View>
    );
  }

  if (type === 'single_logo') {
    const x = 297.5;
    return (
      <View style={styles.container} fixed>
        <Svg width="100%" height="100%" viewBox="0 0 595 842">
          <G transform={`translate(${x - 50 * scale}, ${y - 50 * scale}) scale(${scale})`}>
            <Path
              d={ROTHIRSCH_HOUSE_OUTLINE_PATH}
              fill="none"
              stroke={color}
              strokeWidth={1.0}
              strokeLinejoin="round"
            />
            <Path d={ROTHIRSCH_DEER_PATH} fillRule="evenodd" fill={color} />
          </G>
        </Svg>
      </View>
    );
  }

  // Determine density mode:
  // - 'sparse' (Page 1): Light border icons + centered logo, table zone kept clean
  // - 'dense' (Page 2 / attachments): Rich cell matrix across all 48 cells
  // - 'medium' (AGB / legal): Balanced 2/3 distribution for high legibility
  let effectiveDensity: 'sparse' | 'dense' | 'medium' = 'sparse';

  if (pageVariant === 'page2' || pageVariant === 'dense' || density === 'dense') {
    effectiveDensity = 'dense';
  } else if (pageVariant === 'agb' || pageVariant === 'medium' || density === 'medium') {
    effectiveDensity = 'medium';
  } else {
    // Default to 'sparse' (Page 1 friendly)
    effectiveDensity = 'sparse';
  }

  return (
    <View style={styles.container} fixed>
      <Svg width="100%" height="100%" viewBox="0 0 595 842">
        {ROWS.map((rowY, rowIdx) => {
          return COLS.map((colX, colIdx) => {
            // For SPARSE mode (Page 1):
            // Keep outer edges / corners, skip central table area (rows 2-5, cols 1-4)
            // and skip every other cell so it's airy and very light
            if (effectiveDensity === 'sparse') {
              const isCenter = rowIdx >= 2 && rowIdx <= 5 && colIdx >= 1 && colIdx <= 4;
              if (isCenter) return null; // Table area completely free!
              if ((rowIdx + colIdx) % 2 !== 0) return null; // Half density on borders
            } else if (effectiveDensity === 'medium') {
              // For MEDIUM mode (AGB):
              // Balanced rhythm (skip 1 in 3 cells)
              if ((rowIdx + colIdx) % 3 === 1) return null;
            }

            const symbolId = (rowIdx * 4 + colIdx * 3) % 10;
            const { scale: cellScale, color: cellColor } = getCellVisuals(rowIdx, colIdx, effectiveDensity);

            return renderLogisticsSymbol(
              symbolId,
              colX,
              rowY,
              cellScale,
              effectiveDensity === 'sparse' ? '#F2F5F8' : cellColor,
              `sym-${rowIdx}-${colIdx}`
            );
          });
        })}

        {/* In sparse mode (Page 1), place the centered official Rothirsch logo in the middle */}
        {effectiveDensity === 'sparse' && (
          <G transform={`translate(${297.5 - 50 * 1.6}, ${450 - 50 * 1.6}) scale(1.6)`}>
            <Path
              d={ROTHIRSCH_HOUSE_OUTLINE_PATH}
              fill="none"
              stroke="#F1F4F7"
              strokeWidth={1.0}
              strokeLinejoin="round"
            />
            <Path d={ROTHIRSCH_DEER_PATH} fillRule="evenodd" fill="#F1F4F7" />
          </G>
        )}
      </Svg>
    </View>
  );
};
