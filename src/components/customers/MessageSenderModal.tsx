import { useState, useEffect } from 'react';
import { XMarkIcon, EnvelopeIcon, DocumentDuplicateIcon, ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getCol } from '@/lib/demoMode';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';

export function MessageSenderModal({ 
  order, 
  customer, 
  onClose 
}: { 
  order: any; 
  customer: any; 
  onClose: () => void 
}) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const { profile } = useAuth();
  
  useEffect(() => {
    // Lade die Vorlagen aus den Settings
    const loadSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, getCol('system'), 'settings'));
        if (docSnap.exists() && docSnap.data().communicationTemplates) {
          const tpls = docSnap.data().communicationTemplates;
          setTemplates(tpls);
          if (tpls.length > 0) {
            setSelectedTemplateId(tpls[0].id);
            applyTemplate(tpls[0], order, customer, profile);
          }
        }
      } catch (e) {
        console.error("Error loading templates", e);
      }
    };
    loadSettings();
  }, [order, customer, profile]);

  const applyTemplate = (tpl: any, o: any, c: any, p: any) => {
    if (!tpl) return;
    
    // Daten vorbereiten
    const billing = o?.billingAddress || c;
    const salutation = billing?.salutation || c?.salutation || '';
    const lastName = billing?.lastName || c?.lastName || '';
    const firstName = billing?.firstName || c?.firstName || '';
    const type = billing?.type || c?.type || 'privat';
    
    let kundeAnrede = `Sehr geehrte(r) ${firstName} ${lastName}`.trim();
    
    if (type === 'firma') {
      if (salutation === 'Herr' && lastName) {
        kundeAnrede = `Sehr geehrter Herr ${lastName}`;
      } else if (salutation === 'Frau' && lastName) {
        kundeAnrede = `Sehr geehrte Frau ${lastName}`;
      } else {
        kundeAnrede = `Sehr geehrte Damen und Herren`;
      }
    } else {
      if (salutation === 'Herr') {
        kundeAnrede = `Sehr geehrter Herr ${lastName}`;
      } else if (salutation === 'Frau') {
        kundeAnrede = `Sehr geehrte Frau ${lastName}`;
      }
    }

    const movingDate = o?.orderMeta?.movingDateFrom 
      ? new Date(o.orderMeta.movingDateFrom).toLocaleDateString('de-DE') 
      : 'Nach Absprache';
      
    const manager = p?.displayName || p?.email || 'Rothirsch Team';
    const summe = o?.totals?.gross ? `${o.totals.gross.toFixed(2)} €` : '0,00 €';

    // Variablen ersetzen
    let newSubject = tpl.subject || '';
    let newBody = tpl.body || '';

    const replaceVars = (text: string) => {
      return text
        .replace(/\{\{Kunde_Anrede\}\}/g, kundeAnrede)
        .replace(/\{\{Kunde_Name\}\}/g, `${firstName} ${lastName}`.trim())
        .replace(/\{\{Kunde_Nachname\}\}/g, lastName)
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
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(body);
    toast.success('Text kopiert! Ideal für den Check24-Chat.');
  };

  const handleEmail = () => {
    const email = customer?.email || '';
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-semibold shadow-lg shadow-blue-500/20"
          >
            <EnvelopeIcon className="w-5 h-5" />
            Per E-Mail senden
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
