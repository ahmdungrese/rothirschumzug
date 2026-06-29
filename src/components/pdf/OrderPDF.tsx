import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#333' },
  headerContainer: { alignItems: 'center', marginBottom: 30 },
  logoTextPrimary: { fontSize: 26, fontFamily: 'Helvetica-Bold', color: '#8F1627', textTransform: 'uppercase', letterSpacing: 2 },
  
  docInfoBox: { width: '40%', alignItems: 'flex-end', justifyContent: 'flex-start' },
  docType: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#8F1627', marginBottom: 5 },
  docNumLabel: { fontSize: 9, color: '#666' },
  docNum: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  
  line: { borderBottomWidth: 1, borderBottomColor: '#8F1627', marginBottom: 15 },
  companyLine: { fontSize: 8, color: '#666', marginBottom: 15 },
  
  customerDateBox: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  customerBox: { width: '50%' },
  customerTitle: { fontSize: 9, color: '#666', marginBottom: 3 },
  customerText: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  customerAddress: { fontSize: 10 },
  
  dateBox: { width: '40%' },
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  dateLabel: { color: '#666' },
  dateValue: { fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  
  introText: { marginBottom: 20, lineHeight: 1.4 },
  
  table: { width: '100%', marginBottom: 20 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 5, marginBottom: 5, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#eee' },
  col1: { width: '10%' },
  col2: { width: '45%' },
  col3: { width: '15%', textAlign: 'right' },
  col4: { width: '15%', textAlign: 'right' },
  col5: { width: '15%', textAlign: 'right' },
  
  totals: { alignItems: 'flex-end', marginBottom: 30 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: '40%', marginBottom: 5 },
  totalRowBold: { flexDirection: 'row', justifyContent: 'space-between', width: '40%', marginTop: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: '#333', fontFamily: 'Helvetica-Bold', fontSize: 11 },
  
  textBlock: { marginBottom: 20, lineHeight: 1.4 },
  
  detailsHeader: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#8F1627', marginBottom: 15, marginTop: 20 },
  
  // Neue Adresse Boxen
  addressesRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  addressBoxHalf: { width: '48%' },
  addressTitle: { fontFamily: 'Helvetica-Bold', marginBottom: 5, color: '#8F1627', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 3 },
  addressItem: { marginBottom: 4, flexDirection: 'row' },
  addressLabel: { color: '#666', fontSize: 9, width: '40%' },
  addressValue: { width: '60%' },
  
  signatureBox: { marginTop: 30, flexDirection: 'row', justifyContent: 'space-between' },
  sigLine: { width: '45%', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 5, fontSize: 9, textAlign: 'center' },
  
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, fontSize: 8, color: '#999', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  
  agbTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10, textAlign: 'center' },
  agbColumnsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  agbColumn: { width: '48%' },
  agbText: { fontSize: 7, lineHeight: 1.3, textAlign: 'justify' },
  
  agbSignatureBox: { marginTop: 40, alignItems: 'flex-end' },
  agbSigLine: { width: '60%', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 5, fontSize: 9, textAlign: 'center' },

  watermarkContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: -1 },
  watermarkText: { fontSize: 60, color: '#e5e7eb', transform: 'rotate(-45deg)', fontFamily: 'Helvetica-Bold', opacity: 0.3 }
});

export const OrderPDF = ({ order, customer, settings, isContract = false, employeeName }: { order: any, customer: any, settings: any, isContract?: boolean, employeeName?: string }) => {
  const isFlat = order?.isFlatRate;
  const billing = order?.billingAddress || customer;

  const docTitle = isContract ? `Auftragsbestätigung ${order?.contractNumber || order?.orderNumber || 'Entwurf'} - ${billing?.lastName || 'Kunde'}` : `Angebot ${order?.orderNumber || 'Entwurf'} - ${billing?.lastName || 'Kunde'}`;

  // Personalisierte Anrede
  const salutation = billing?.salutation || customer?.salutation;
  let introText = isContract ? (order?.texts?.orderIntro || settings?.texts?.orderIntro || '') : (order?.texts?.quoteIntro || settings?.texts?.quoteIntro || '');
  
  let kundeAnredeStr = 'Sehr geehrte Damen und Herren';
  if (salutation === 'Herr' && billing?.lastName) {
    kundeAnredeStr = `Sehr geehrter Herr ${billing.lastName}`;
  } else if (salutation === 'Frau' && billing?.lastName) {
    kundeAnredeStr = `Sehr geehrte Frau ${billing.lastName}`;
  }
  
  // Replace the variable if used in settings
  introText = introText.replace(/\{\{Kunde_Anrede\}\}/g, kundeAnredeStr);
  
  // Fallback for older hardcoded texts
  if (salutation === 'Herr' && billing?.lastName) {
    introText = introText.replace(/Sehr geehrte Damen und Herren,?/gi, `Sehr geehrter Herr ${billing.lastName},`);
  } else if (salutation === 'Frau' && billing?.lastName) {
    introText = introText.replace(/Sehr geehrte Damen und Herren,?/gi, `Sehr geehrte Frau ${billing.lastName},`);
  }

  // Schlusstexte ohne doppelte Begrüßung
  const outroText = isContract ? (order?.texts?.orderOutro || settings?.texts?.orderOutro || '') : (order?.texts?.quoteOutro || settings?.texts?.quoteOutro || '');
  const greetingText = isContract ? (order?.texts?.orderGreeting || settings?.texts?.orderGreeting || '') : (order?.texts?.quoteGreeting || settings?.texts?.quoteGreeting || '');

  // Zahlungsmethode Text (aus Order settings oder Global)
  const pmSettings = settings?.paymentMethods?.find((p:any) => p.name === order?.orderMeta?.paymentMethod) || settings?.paymentMethods?.[0];
  const paymentTerms = order?.texts?.paymentTerms || pmSettings?.textQuote || '';

  // Helper Funktion für AGB Splitting (Sehr grobes Aufteilen in 2 Hälften)
  const agbFullText = settings?.texts?.agb || '';
  const midpoint = Math.floor(agbFullText.length / 2);
  const splitIndex = agbFullText.indexOf(' ', midpoint) !== -1 ? agbFullText.indexOf(' ', midpoint) : midpoint;
  const agbLeft = agbFullText.substring(0, splitIndex);
  const agbRight = agbFullText.substring(splitIndex);

  return (
    <Document title={docTitle}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <Text style={styles.logoTextPrimary}>{settings?.companyName || 'ROTHIRSCH UMZUG'}</Text>
        </View>

        <View style={styles.line} />

        <Text style={styles.companyLine}>
          {settings?.companyName} • {settings?.street} • {settings?.zip} {settings?.city}
        </Text>

        <View style={styles.customerDateBox}>
          <View style={styles.customerBox}>
            <Text style={styles.customerTitle}>Auftraggeber</Text>
            <Text style={styles.customerText}>{billing?.type === 'firma' ? billing?.lastName : `${billing?.firstName} ${billing?.lastName}`.trim()}</Text>
            {billing?.type === 'firma' && billing?.firstName && (
              <Text style={{ fontSize: 9, color: '#444', marginBottom: 2 }}>z.Hd. {billing.firstName}</Text>
            )}
            <Text style={styles.customerAddress}>
              {billing?.street ? `${billing.street} ${billing.houseNr || ''}`.trim() : (billing?.address?.split(',')[0] || '')}
            </Text>
            <Text style={styles.customerAddress}>
              {billing?.zip ? `${billing.zip} ${billing.city || ''}`.trim() : (billing?.address?.split(',')[1]?.trim() || '')}
            </Text>
          </View>
          <View style={styles.docInfoBox}>
            <Text style={styles.docType}>{isContract ? 'Auftragsbestätigung' : 'Angebot'}</Text>
            <Text style={styles.docNumLabel}>{isContract ? 'Auftragsnummer' : 'Angebotsnummer'}</Text>
            <Text style={styles.docNum}>{isContract ? (order?.contractNumber || 'Entwurf') : (order?.orderNumber || 'Entwurf')}</Text>
            <View style={{ height: 15 }} />

            <View style={[styles.dateRow, { width: '100%' }]}>
              <Text style={styles.dateLabel}>Datum</Text>
              <Text style={styles.dateValue}>
                {order?.documentDate 
                  ? new Date(order.documentDate).toLocaleDateString('de-DE') 
                  : (order?.createdAt 
                    ? (typeof order.createdAt.toDate === 'function' 
                        ? order.createdAt.toDate().toLocaleDateString('de-DE') 
                        : new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleDateString('de-DE')) 
                    : new Date().toLocaleDateString('de-DE'))}
              </Text>
            </View>
            <View style={[styles.dateRow, { width: '100%' }]}>
              <Text style={styles.dateLabel}>Umzug</Text>
              <Text style={styles.dateValue}>
                {order?.orderMeta?.movingDateFrom ? new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE') : 'Nach Absprache'}
                {order?.orderMeta?.movingDateTo ? ` - ${new Date(order.orderMeta.movingDateTo).toLocaleDateString('de-DE')}` : ''}
              </Text>
            </View>
            <View style={[styles.dateRow, { width: '100%' }]}>
              <Text style={styles.dateLabel}>Gültig</Text>
              <Text style={styles.dateValue}>{order?.orderMeta?.validUntil ? new Date(order.orderMeta.validUntil).toLocaleDateString('de-DE') : '-'}</Text>
            </View>
            {employeeName && (
              <View style={[styles.dateRow, { width: '100%' }]}>
                <Text style={styles.dateLabel}>Sachbearbeiter</Text>
                <Text style={styles.dateValue}>{employeeName}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.introText}>
          {introText}
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.col1}>Pos.</Text>
            <Text style={[styles.col2, isFlat && { width: '70%' }]}>Bezeichnung</Text>
            <Text style={[styles.col3, isFlat && { width: '20%' }]}>{isFlat ? 'Umfang' : 'Menge'}</Text>
            {!isFlat && (
              <>
                <Text style={styles.col4}>Einzelpreis</Text>
                <Text style={styles.col5}>Gesamt</Text>
              </>
            )}
          </View>
          {order?.services?.map((item: any, i: number) => {
            const itemNameLower = (item.name || '').toLowerCase();
            const showExactAmount = isFlat && (itemNameLower.includes('karton') || itemNameLower.includes('einpack'));
            
            return (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col1}>{i + 1}</Text>
                <Text style={[styles.col2, isFlat && { width: '70%' }]}>{item.name}</Text>
                <Text style={[styles.col3, isFlat && { width: '20%' }]}>
                  {isFlat 
                    ? (showExactAmount ? `${item.quantity} ${item.unit}` : 'Inklusiv') 
                    : `${item.quantity} ${item.unit}`}
                </Text>
                {!isFlat && (
                  <>
                    <Text style={styles.col4}>{item.unitPrice?.toFixed(2)} €</Text>
                    <Text style={styles.col5}>{(item.quantity * item.unitPrice)?.toFixed(2)} €</Text>
                  </>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Summe Netto:</Text>
            <Text>{order?.totals?.net?.toFixed(2)} €</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>MwSt. 19%:</Text>
            <Text>{order?.totals?.tax?.toFixed(2)} €</Text>
          </View>
          <View style={styles.totalRowBold}>
            <Text>Gesamtbetrag (inkl. MwSt.)</Text>
            <Text>{order?.totals?.gross?.toFixed(2)} €</Text>
          </View>
        </View>

        <Text style={styles.textBlock}>
          {paymentTerms ? outroText.replace(paymentTerms, '').trim() : outroText}
        </Text>
        
        {greetingText && !outroText.includes(greetingText) && (
          <Text style={styles.textBlock}>
            {greetingText}
          </Text>
        )}

        <View style={styles.footer}>
          <View>
            <Text>Unternehmen: {settings?.companyName}</Text>
            <Text>{settings?.street}, {settings?.zip} {settings?.city}</Text>
          </View>
          <View>
            <Text>Bank: {settings?.bankName}</Text>
            <Text>IBAN: {settings?.iban}</Text>
          </View>
          <View>
            <Text>Tel: {settings?.phone}</Text>
            <Text>Steuer-Nr: {settings?.taxId}</Text>
          </View>
        </View>
      </Page>

      {/* Page 2: Details & Signature */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.detailsHeader}>{isContract ? 'Auftragsdetails & Bestätigung' : 'Angebotsdetails'}</Text>

        <View style={styles.addressesRow}>
          {/* Auszugsort (A) */}
          <View style={styles.addressBoxHalf}>
            <Text style={styles.addressTitle}>Auszugsort</Text>
            <View style={styles.addressItem}>
              <Text style={styles.addressLabel}>Adresse:</Text>
              <Text style={styles.addressValue}>{order?.logistics?.a_street} {order?.logistics?.a_houseNr}, {order?.logistics?.a_zip} {order?.logistics?.a_city}</Text>
            </View>
            <View style={styles.addressItem}>
              <Text style={styles.addressLabel}>Immo-Art:</Text>
              <Text style={styles.addressValue}>{order?.logistics?.a_type || 'k.A.'}</Text>
            </View>
            <View style={styles.addressItem}>
              <Text style={styles.addressLabel}>Etage:</Text>
              <Text style={styles.addressValue}>{order?.logistics?.a_floor || 'k.A.'} {order?.logistics?.a_elevator ? '(mit Aufzug)' : '(ohne Aufzug)'}</Text>
            </View>
            <View style={styles.addressItem}>
              <Text style={styles.addressLabel}>Laufweg:</Text>
              <Text style={styles.addressValue}>{!order?.logistics?.a_distance ? 'Unter 10 Meter' : `${order.logistics.a_distance} Meter`}</Text>
            </View>
            {order?.logistics?.a_parking && (
              <View style={styles.addressItem}>
                <Text style={styles.addressLabel}>Halteverbot:</Text>
                <Text style={styles.addressValue}>Ja</Text>
              </View>
            )}
            {order?.logistics?.a_furnitureLift && (
              <View style={styles.addressItem}>
                <Text style={styles.addressLabel}>Möbellift:</Text>
                <Text style={styles.addressValue}>Ja (wird gestellt)</Text>
              </View>
            )}
          </View>

          {/* Einzugsort (B) */}
          <View style={styles.addressBoxHalf}>
            <Text style={styles.addressTitle}>Einzugsort</Text>
            <View style={styles.addressItem}>
              <Text style={styles.addressLabel}>Adresse:</Text>
              <Text style={styles.addressValue}>{order?.logistics?.b_street} {order?.logistics?.b_houseNr}, {order?.logistics?.b_zip} {order?.logistics?.b_city}</Text>
            </View>
            <View style={styles.addressItem}>
              <Text style={styles.addressLabel}>Immo-Art:</Text>
              <Text style={styles.addressValue}>{order?.logistics?.b_type || 'k.A.'}</Text>
            </View>
            <View style={styles.addressItem}>
              <Text style={styles.addressLabel}>Etage:</Text>
              <Text style={styles.addressValue}>{order?.logistics?.b_floor || 'k.A.'} {order?.logistics?.b_elevator ? '(mit Aufzug)' : '(ohne Aufzug)'}</Text>
            </View>
            <View style={styles.addressItem}>
              <Text style={styles.addressLabel}>Laufweg:</Text>
              <Text style={styles.addressValue}>{!order?.logistics?.b_distance ? 'Unter 10 Meter' : `${order.logistics.b_distance} Meter`}</Text>
            </View>
            {order?.logistics?.b_parking && (
              <View style={styles.addressItem}>
                <Text style={styles.addressLabel}>Halteverbot:</Text>
                <Text style={styles.addressValue}>Ja</Text>
              </View>
            )}
            {order?.logistics?.b_furnitureLift && (
              <View style={styles.addressItem}>
                <Text style={styles.addressLabel}>Möbellift:</Text>
                <Text style={styles.addressValue}>Ja (wird gestellt)</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={{ ...styles.detailsHeader, fontSize: 11, marginBottom: 5 }}>Versicherungsschutz</Text>
        <Text style={styles.textBlock}>{settings?.texts?.insurance}</Text>

        {paymentTerms && (
          <>
            <Text style={{ ...styles.detailsHeader, fontSize: 11, marginBottom: 5 }}>Zahlungsinformationen</Text>
            <Text style={styles.textBlock}>{paymentTerms}</Text>
          </>
        )}

        <Text style={{ ...styles.detailsHeader, fontSize: 11, marginBottom: 5 }}>Zum Auftrag</Text>
        <Text style={styles.textBlock}>Mit Ihrer Unterschrift bestätigen Sie die Beauftragung und erkennen unsere Allgemeinen Geschäftsbedingungen sowie die gesetzlichen Haftungsregelungen des Möbelspediteurs (§ 451g HGB) an. Wir sichern Ihnen eine professionelle und zuverlässige Durchführung Ihres Umzugs zu.</Text>

        <View style={styles.signatureBox}>
          <View style={styles.sigLine}>
            <Text>{order?.signatureOrderPlace ? `${order.signatureOrderPlace}, den ${order.signatureOrderDateString}` : 'Ort, Datum'}</Text>
          </View>
          <View style={styles.sigLine}>
            {order?.signatureOrder ? (
              <Image src={order.signatureOrder} style={{ height: 40, marginTop: -35, objectFit: 'contain', alignSelf: 'center' }} />
            ) : (
              <Text>Unterschrift Auftraggeber</Text>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>{settings?.companyName} | Seite 2</Text>
        </View>
      </Page>

      {/* Page 3: AGBs */}
      <Page size="A4" style={styles.page}>
        <View style={styles.watermarkContainer}>
          <Text style={styles.watermarkText}>{settings?.companyName}</Text>
        </View>

        <Text style={styles.agbTitle}>Allgemeine Geschäftsbedingungen (AGB)</Text>
        
        <View style={styles.agbColumnsContainer}>
          <View style={styles.agbColumn}>
            <Text style={styles.agbText}>{agbLeft}</Text>
          </View>
          <View style={styles.agbColumn}>
            <Text style={styles.agbText}>{agbRight}</Text>
          </View>
        </View>

        <View style={styles.agbSignatureBox}>
          <View style={styles.agbSigLine}>
            {order?.signatureAGB ? (
              <>
                <Image src={order.signatureAGB} style={{ height: 40, marginTop: -35, objectFit: 'contain', alignSelf: 'center' }} />
                <Text style={{ fontSize: 10, marginTop: 5 }}>{order.signatureAGBPlace}, den {order.signatureAGBDateString}</Text>
              </>
            ) : (
              <Text style={{ fontSize: 10 }}>Ort, Datum & Unterschrift (AGBs gelesen & akzeptiert)</Text>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>{settings?.companyName} | Seite 3</Text>
        </View>
      </Page>

      {/* Optional: Inventarliste */}
      {order?.appendInventoryToPDF && order?.inventory?.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.watermarkContainer}>
            <Text style={styles.watermarkText}>{settings?.companyName}</Text>
          </View>
          
          <Text style={{ ...styles.detailsHeader, fontSize: 18, marginBottom: 20 }}>Anlage: Umzugsgut / Inventarliste</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={{ width: '45%' }}>Möbelliste</Text>
              <Text style={{ width: '40%' }}>Service</Text>
              <Text style={{ width: '15%', textAlign: 'center' }}>Stück</Text>
            </View>
            {Object.entries(order.inventory.reduce((acc: any, item: any) => {
              const room = item.room || 'Allgemein';
              if (!acc[room]) acc[room] = [];
              acc[room].push(item);
              return acc;
            }, {})).map(([room, items]: [string, any], rIdx: number) => (
              <React.Fragment key={rIdx}>
                <View style={{ flexDirection: 'row', backgroundColor: '#f3f4f6', padding: '6px 8px', borderBottom: '1px solid #e5e7eb' }}>
                   <Text style={{ fontSize: 10, fontWeight: 'bold', width: '100%', color: '#333' }}>{room.toUpperCase()}</Text>
                </View>
                {items.map((item: any, i: number) => {
                  const services = [
                    item.disassembly ? `${item.disassembly}x Abbau` : null,
                    item.assembly ? `${item.assembly}x Aufbau` : null,
                    item.disconnection ? `${item.disconnection}x Abklemmen` : null,
                    item.connection ? `${item.connection}x Anschluss` : null
                  ].filter(Boolean).join(' | ');

                  return (
                    <View key={`${rIdx}-${i}`} style={styles.tableRow} wrap={false}>
                      <View style={{ width: '45%' }}>
                        <Text>{item.name}</Text>
                        {item.note && item.showNoteInPdf !== false && (
                          <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>Notiz: {item.note}</Text>
                        )}
                      </View>
                      <View style={{ width: '40%' }}>
                        <Text style={{ fontSize: 9, color: '#555' }}>{services}</Text>
                      </View>
                      <Text style={{ width: '15%', textAlign: 'center' }}>{item.quantity}</Text>
                    </View>
                  );
                })}
              </React.Fragment>
            ))}
          </View>
          <View style={styles.footer}>
            <Text>{settings?.companyName} | Anlage: Inventarliste</Text>
          </View>
        </Page>
      )}
    </Document>
  );
};
