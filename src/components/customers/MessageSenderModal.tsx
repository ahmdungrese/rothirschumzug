import { useState, useEffect } from 'react';
import { XMarkIcon, EnvelopeIcon, DocumentDuplicateIcon, ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { pdf } from '@react-pdf/renderer';
import { OrderPDF } from '../pdf/OrderPDF';
import { InvoicePDF } from '../pdf/InvoicePDF';

const DEFAULT_COMMUNICATION_TEMPLATES = [
  {
    id: 't1',
    name: 'Erstkontakt (Bilder oder Liste erhalten)',
    subject: 'Angebot für Ihren Umzug',
    body: 'Hallo [Name],\n\nvielen Dank für Ihr Interesse an unserem Service und für die Übersendung der Bilder.\n\nGerne erstellen wir Ihnen ein individuelles Angebot mit Festpreis und lassen Ihnen dieses zeitnah zukommen.\n\nSollten Sie vorab noch weitere Fragen haben, stehen wir Ihnen selbstverständlich jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge\n\nKontaktdaten: Telefon: +49 1590 6603011 | E-Mail: info@rothirsch-umzug.de | Webseite: www.rothirsch-umzug.de'
  },
  {
    id: 't2',
    name: 'Erstkontakt (Keine Bilder oder Liste)',
    subject: 'Ihre Umzugsanfrage',
    body: 'Hallo [Name],\n\nvielen Dank für Ihr Interesse an unserem Service. Gerne erstellen wir für Sie ein Angebot mit einem festen Preis. Teilen Sie uns bitte Bilder oder eine Liste mit den gewünschten Leistungen mit. Sie können uns auch gerne Ihre Telefonnummer mitteilen oder uns jederzeit anrufen, um Ihren Umzug zu besprechen.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge\n\nKontaktdaten: Telefon: +49 1590 6603011 | E-Mail: info@rothirsch-umzug.de | Webseite: www.rothirsch-umzug.de'
  },
  {
    id: 't3',
    name: 'Angebot schicken',
    subject: 'Ihr Umzugsangebot – Festpreis',
    body: 'Sehr geehrte(r) [Name],\n\nanbei sende ich Ihnen unser verbindliches Angebot für Ihren bevorstehenden Umzug am [Datum]. Bitte überprüfen Sie die angehängte Datei für die detaillierten Informationen und Konditionen.\n\nBei Rothirsch Umzüge legen wir großen Wert auf den Schutz Ihrer Möbel. Daher werden alle Möbelstücke sorgfältig mit Umzugsdecken und hochwertigen Schutzmaterialien geschützt.\n\nEs handelt sich bei unserem Angebot um einen Festpreis ([Summe]). Sie können darauf vertrauen, dass es keine unerwarteten zusätzlichen Gebühren gibt.\n\nWenn Sie mit dem Angebot zufrieden sind, bitten wir Sie um eine kurze Bestätigung, damit wir Ihren Wunschtermin verbindlich für Sie reservieren können.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't4',
    name: 'Nachfrage zu Ihrem Umzugsangebot',
    subject: 'Nachfrage zu Ihrem Umzugsangebot',
    body: 'Hallo [Name],\n\nich wollte mich kurz erkundigen, ob Sie bereits eine Entscheidung zu unserem Angebot getroffen haben. Der gewünschte Termin am [Datum] ist aktuell noch verfügbar – allerdings erhalten wir viele Anfragen, sodass eine zeitnahe Rückmeldung wichtig für die Reservierung ist.\n\nSollten noch Fragen offen sein oder Sie Anpassungen wünschen, können wir das gerne telefonisch besprechen.\n\nGeben Sie uns einfach kurz Bescheid.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't5',
    name: 'Aktualisiertes Angebot schicken',
    subject: 'Ihr aktualisiertes Umzugsangebot',
    body: 'Sehr geehrte(r) [Name],\n\nvielen Dank für Ihre Rückmeldung. Anbei senden wir Ihnen das überarbeitete Angebot sowie die angepasste Umzugsliste, die Ihren Änderungswünschen entspricht.\n\nFalls Sie noch weitere Fragen haben oder weitere Anpassungen benötigen, stehen wir Ihnen jederzeit gern zur Verfügung.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't6',
    name: 'Absage',
    subject: 'Schade, dass es nicht geklappt hat',
    body: 'Hallo [Name],\n\nes ist schade zu hören, dass Sie sich für einen anderen Anbieter entschieden haben. Wir wünschen Ihnen dennoch viel Erfolg und einen reibungslosen Umzug.\n\nSollten Sie in Zukunft erneut Unterstützung benötigen, stehen wir Ihnen jederzeit gerne zur Verfügung.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't7',
    name: 'Bestätigung (Auftragsbestätigung & Termin)',
    subject: 'Auftragsbestätigung für Ihren Umzug',
    body: 'Hallo [Name],\n\nvielen Dank für Ihr Vertrauen und das unterzeichnete Angebot! Hiermit bestätige ich Ihnen verbindlich den Umzugstermin am [Datum].\n\nWir freuen uns auf die Zusammenarbeit und darauf, Ihnen den Weg in Ihr neues Zuhause so angenehm wie möglich zu gestalten.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't8',
    name: 'Zeit des Umzugs (Wann trifft das Team ein?)',
    subject: 'Ihre Umzugs-Uhrzeit / Ankunftszeit unseres Teams',
    body: 'Hallo [Name],\n\nkurze Information zu Ihrem Umzug am [Datum]: Unser Team wird voraussichtlich zwischen 08:30 und 09:30 Uhr bei Ihnen an der Beladestelle eintreffen.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't9',
    name: 'Rechnung schicken',
    subject: 'Ihre Rechnung – Rothirsch Umzüge',
    body: 'Sehr geehrte(r) [Name],\n\nanbei erhalten Sie die Rechnung für die von uns erbrachten Dienstleistungen. Sollten Sie Fragen oder Anmerkungen haben, stehe ich Ihnen selbstverständlich gerne zur Verfügung.\n\nWir möchten uns herzlich für Ihr Vertrauen bedanken! Falls Sie mit unserer Arbeit zufrieden waren, würden wir uns sehr über eine kurze Bewertung auf Google oder Check24 freuen.\n\nMit freundlichen Grüßen\n[Mitarbeiter]\nRothirsch Umzüge'
  },
  {
    id: 't10',
    name: 'Dank für Bewertung',
    subject: 'Vielen Dank für Ihre Bewertung!',
    body: 'Hallo [Name],\n\nvielen Dank für Ihre großartige Bewertung! Wir freuen uns wirklich sehr über Ihr positives Feedback und es ist schön zu hören, dass alles nach Ihren Wünschen gelaufen ist. Es war uns eine Freude, Ihren Umzug durchzuführen!\n\nViele Grüße\n[Mitarbeiter]\nRothirsch Umzüge'
  }
];

export function MessageSenderModal({ 
  order, 
  customer, 
  defaultTemplateName,
  onClose 
}: { 
  order: any; 
  customer: any; 
  defaultTemplateName?: string;
  onClose: () => void 
}) {
  const [templates, setTemplates] = useState<any[]>(DEFAULT_COMMUNICATION_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [attachmentType, setAttachmentType] = useState<'none' | 'order' | 'invoice'>('none');
  const [settings, setSettings] = useState<any>(null);
  const { profile } = useAuth();

  const findBestMatchingTemplate = (tpls: any[], queryRaw?: string) => {
    if (!tpls || tpls.length === 0) return null;
    if (!queryRaw) return tpls[0];

    const q = queryRaw.trim().toLowerCase();

    // 1. Direct ID match (e.g. "t1", "t5", "t6", "t7", "t8", "t9", "t10")
    const idMatch = tpls.find((t: any) => (t.id || '').toLowerCase() === q);
    if (idMatch) return idMatch;

    // 2. Embedded ID match (e.g. "Absage (t6)" -> "t6")
    const embeddedId = q.match(/\b(t[0-9]{1,2})\b/);
    if (embeddedId && embeddedId[1]) {
      const byEmbeddedId = tpls.find((t: any) => (t.id || '').toLowerCase() === embeddedId[1]);
      if (byEmbeddedId) return byEmbeddedId;
    }

    // 3. Exact or substring match in template name
    const nameMatch = tpls.find((t: any) => (t.name || '').toLowerCase().includes(q));
    if (nameMatch) return nameMatch;

    // 4. Semantic keyword mapping for German synonyms
    if (q.includes('absage')) return tpls.find((t: any) => t.id === 't6' || (t.name || '').toLowerCase().includes('absage')) || tpls[0];
    if (q.includes('aktualisiert') || q.includes('erstellt')) return tpls.find((t: any) => t.id === 't5' || (t.name || '').toLowerCase().includes('aktualisiert')) || tpls[0];
    if (q.includes('bestätigung') || q.includes('bestaetigung')) return tpls.find((t: any) => t.id === 't7' || (t.name || '').toLowerCase().includes('bestätigung')) || tpls[0];
    if (q.includes('zeit') || q.includes('ankunft') || q.includes('team')) return tpls.find((t: any) => t.id === 't8' || (t.name || '').toLowerCase().includes('zeit')) || tpls[0];
    if (q.includes('nachfrage') || q.includes('nachfassen')) return tpls.find((t: any) => t.id === 't4' || (t.name || '').toLowerCase().includes('nachfrage')) || tpls[0];
    if (q.includes('angebot')) return tpls.find((t: any) => t.id === 't3' || (t.name || '').toLowerCase().includes('angebot schicken')) || tpls[0];
    if (q.includes('rechnung')) return tpls.find((t: any) => t.id === 't9' || (t.name || '').toLowerCase().includes('rechnung')) || tpls[0];
    if (q.includes('bewertung') || q.includes('dank')) return tpls.find((t: any) => t.id === 't10' || (t.name || '').toLowerCase().includes('bewertung')) || tpls[0];
    if (q.includes('keine bilder')) return tpls.find((t: any) => t.id === 't2' || (t.name || '').toLowerCase().includes('keine bilder')) || tpls[0];

    return tpls[0];
  };
  
  useEffect(() => {
    const loadSettings = async () => {
      let mergedTemplates = [...DEFAULT_COMMUNICATION_TEMPLATES];
      try {
        const docSnap = await getDoc(doc(db, 'system', 'settings'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings(data);
          if (Array.isArray(data.communicationTemplates) && data.communicationTemplates.length > 0) {
            // Merge custom Firestore templates with DEFAULT_COMMUNICATION_TEMPLATES so no template (t1-t10) is ever missing!
            const customMap = new Map<string, any>();
            data.communicationTemplates.forEach((t: any) => {
              if (t && t.id) customMap.set(t.id, t);
            });
            mergedTemplates = DEFAULT_COMMUNICATION_TEMPLATES.map(def => {
              const custom = customMap.get(def.id);
              return custom ? { ...def, ...custom } : def;
            });
            // Append any extra custom templates created in Settings that aren't t1..t10
            data.communicationTemplates.forEach((t: any) => {
              if (t && !DEFAULT_COMMUNICATION_TEMPLATES.some(d => d.id === t.id)) {
                mergedTemplates.push(t);
              }
            });
          }
        }
      } catch (e) {
        console.error("Error loading templates", e);
      }

      setTemplates(mergedTemplates);
      const tplToApply = findBestMatchingTemplate(mergedTemplates, defaultTemplateName) || mergedTemplates[0];
      if (tplToApply) {
        setSelectedTemplateId(tplToApply.id);
        applyTemplate(tplToApply, order, customer, profile);
        const lowerName = (tplToApply.name || '').toLowerCase();
        if (lowerName.includes('angebot') || tplToApply.id === 't3' || tplToApply.id === 't5') {
          setAttachmentType('order');
        } else if (lowerName.includes('rechnung') || tplToApply.id === 't9') {
          setAttachmentType(order?.invoiceNumber ? 'invoice' : 'none');
        } else {
          setAttachmentType('none');
        }
      }
    };
    loadSettings();
  }, [order, customer, profile, defaultTemplateName]);

  const applyTemplate = (tpl: any, o: any, c: any, p: any) => {
    if (!tpl) return;
    
    const billing = o?.billingAddress || c;
    const salutation = billing?.salutation || c?.salutation || '';
    const lastName = billing?.lastName || c?.lastName || '';
    const firstName = billing?.firstName || c?.firstName || '';
    const type = billing?.type || c?.type || 'privat';
    const fullName = `${firstName} ${lastName}`.trim() || billing?.company || c?.company || o?.customerName || 'Kunde';
    
    let kundeAnrede = `Sehr geehrte(r) ${fullName}`.trim();
    
    if (type === 'firma') {
      if (salutation === 'Herr' && lastName) {
        kundeAnrede = `Sehr geehrter Herr ${lastName}`;
      } else if (salutation === 'Frau' && lastName) {
        kundeAnrede = `Sehr geehrte Frau ${lastName}`;
      } else {
        kundeAnrede = `Sehr geehrte Damen und Herren`;
      }
    } else {
      if (salutation === 'Herr' && lastName) {
        kundeAnrede = `Sehr geehrter Herr ${lastName}`;
      } else if (salutation === 'Frau' && lastName) {
        kundeAnrede = `Sehr geehrte Frau ${lastName}`;
      }
    }

    const rawMovingDate = o?.orderMeta?.movingDateFrom || o?.movingDate || o?.logistics?.movingDate;
    const movingDate = rawMovingDate 
      ? new Date(rawMovingDate).toLocaleDateString('de-DE') 
      : 'Nach Absprache';
      
    const manager = p?.displayName || p?.email || 'Rothirsch Team';
    const summe = o?.totals?.gross ? `${o.totals.gross.toFixed(2)} €` : '0,00 €';

    let newSubject = tpl.subject || '';
    let newBody = tpl.body || '';

    const replaceVars = (text: string) => {
      return text
        .replace(/\[Name\]/g, fullName)
        .replace(/\[Datum\]/g, movingDate)
        .replace(/\[Mitarbeiter\]/g, manager)
        .replace(/\[Summe\]/g, summe)
        .replace(/\{\{Kunde_Anrede\}\}/g, kundeAnrede)
        .replace(/\{\{Kunde_Name\}\}/g, fullName)
        .replace(/\{\{Kunde_Nachname\}\}/g, lastName || fullName)
        .replace(/\{\{Umzugsdatum\}\}/g, movingDate)
        .replace(/\{\{Angebot_Summe\}\}/g, summe)
        .replace(/\{\{Sachbearbeiter\}\}/g, manager);
    };

    setSubject(replaceVars(newSubject));
    setBody(replaceVars(newBody));
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tId = e.target.value;
    setSelectedTemplateId(tId);
    const tpl = templates.find(t => t.id === tId);
    if (tpl) {
      applyTemplate(tpl, order, customer, profile);
      
      const lowerName = (tpl.name || '').toLowerCase();
      if (lowerName.includes('angebot') || tpl.id === 't3' || tpl.id === 't5') setAttachmentType('order');
      else if (lowerName.includes('rechnung') || tpl.id === 't9') setAttachmentType(order?.invoiceNumber ? 'invoice' : 'none');
      else setAttachmentType('none');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(body);
    toast.success('Text kopiert! Ideal für den Check24-Chat.');
  };

  const handleEmail = async () => {
    const email = customer?.email || '';
    if (!email) return toast.error('Keine E-Mail-Adresse beim Kunden hinterlegt!');
    if (!settings?.smtpHost) return toast.error('Keine SMTP E-Mail Server-Daten in den Einstellungen hinterlegt!');

    setIsSending(true);
    const loadingToast = toast.loading('Generiere PDF und versende E-Mail...');

    try {
      const formData = new FormData();
      formData.append('smtpHost', settings.smtpHost);
      formData.append('smtpPort', settings.smtpPort || '465');
      formData.append('smtpUser', settings.smtpUser);
      formData.append('smtpPass', settings.smtpPass);
      formData.append('fromName', settings.companyName || 'Rothirsch Umzüge');
      
      formData.append('to', email);
      formData.append('subject', subject);
      formData.append('text', body);

      const managerName = profile?.displayName || profile?.email || 'Mitarbeiter';
      const company = settings.companyName || 'Rothirsch Umzüge';
      const customerName = customer?.type === 'firma' ? customer?.lastName : `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
      const safeCustomerName = customerName || 'Kunde';
      const orderNum = order?.orderNumber || 'Entwurf';

      // Generate PDF on the fly if needed
      if (attachmentType !== 'none') {
        let pdfComponent;
        let fileName = 'Dokument.pdf';

        if (attachmentType === 'order') {
          pdfComponent = <OrderPDF order={order} customer={customer} settings={settings} employeeName={managerName} />;
          fileName = `Angebot ${orderNum} - ${company} - ${safeCustomerName}.pdf`;
        } else if (attachmentType === 'invoice') {
          pdfComponent = <InvoicePDF order={order} customer={customer} settings={settings} employeeName={managerName} />;
          fileName = `Rechnung ${order?.invoiceNumber || orderNum} - ${company}.pdf`;
        }

        if (pdfComponent) {
          const asPdf = pdf(pdfComponent);
          const blob = await asPdf.toBlob();
          formData.append('file', blob, fileName);
          formData.append('fileName', fileName);
        }
      } else {
        // We still need a dummy file to satisfy the API route if we make it required, 
        // OR we can adjust the API route to handle no attachments.
        // For now, let's create a tiny dummy blob if absolutely needed, or the API route will fail.
        // Wait, the API route currently says: if(!file) return error. 
        // I will adjust the API route to make file optional.
      }

      const res = await fetch('/api/email/send', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        toast.success('E-Mail erfolgreich gesendet!', { id: loadingToast });
        onClose();
      } else {
        toast.error(`Fehler: ${data.error}`, { id: loadingToast });
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Kritischer Fehler beim Senden.', { id: loadingToast });
    } finally {
      setIsSending(false);
    }
  };

  const handleWhatsApp = () => {
    const phone = customer?.phone?.replace(/[^0-9]/g, '') || '';
    // Format to international format if necessary. Usually we just trust it starts with country code or we can assume +49.
    let formattedPhone = phone;
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '49' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('49')) {
      // Very basic fallback, ideally the user inputs +49...
    }
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(body)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-bg-panel border border-structure w-full max-w-3xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-structure bg-bg-dark/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <ChatBubbleLeftEllipsisIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-text-main">Nachricht senden</h2>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-main hover:bg-structure rounded-full transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          <div>
            <label className="block text-sm font-semibold text-text-muted mb-1">Vorlage auswählen</label>
            <select 
              value={selectedTemplateId} 
              onChange={handleTemplateChange}
              className="input-field w-full"
            >
              {templates.length === 0 && <option value="">Keine Vorlagen gefunden...</option>}
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-muted mb-1">Betreff (für E-Mail)</label>
            <input 
              type="text" 
              value={subject} 
              onChange={e => setSubject(e.target.value)}
              className="input-field w-full text-text-main"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-muted mb-1 flex justify-between">
              <span>Nachrichtentext</span>
              <span className="text-xs text-primary font-normal">Du kannst diesen Text frei anpassen</span>
            </label>
            <textarea 
              value={body} 
              onChange={e => setBody(e.target.value)}
              className="input-field w-full h-64 text-sm whitespace-pre-wrap text-text-main leading-relaxed"
            />
          </div>

          <div className="bg-bg-dark border border-structure p-3 rounded-lg flex items-center justify-between mt-4">
            <div>
              <span className="block text-sm font-semibold text-text-main">PDF-Anhang</span>
              <span className="text-xs text-text-muted">Welches Dokument soll generiert und an die Mail angehängt werden?</span>
            </div>
            <select 
              value={attachmentType} 
              onChange={e => setAttachmentType(e.target.value as any)}
              className="input-field text-sm"
            >
              <option value="none">Kein Anhang</option>
              <option value="order">Angebot (PDF)</option>
              <option value="invoice" disabled={!order?.invoiceNumber}>Rechnung (PDF) {!order?.invoiceNumber ? '(Fehlt)' : ''}</option>
            </select>
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-structure bg-bg-dark/50 rounded-b-xl flex flex-wrap justify-end gap-3">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-structure hover:bg-structure/80 text-text-main rounded-lg transition-colors font-semibold shadow-lg"
          >
            <DocumentDuplicateIcon className="w-5 h-5" />
            Text kopieren
          </button>
          
          <button 
            onClick={handleEmail}
            disabled={isSending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg transition-colors font-semibold shadow-lg shadow-blue-500/20"
          >
            <EnvelopeIcon className="w-5 h-5" />
            {isSending ? 'Wird gesendet...' : 'Per E-Mail senden'}
          </button>

          <button 
            onClick={handleWhatsApp}
            className="flex items-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20b858] text-text-main rounded-lg transition-colors font-semibold shadow-lg shadow-[#25D366]/20"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
            WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}
