"use client";

import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, ChatBubbleBottomCenterTextIcon, EnvelopeIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface CommunicationDropdownProps {
  customer: any;
  order: any;
  settings: any;
  employeeName: string;
}

export function CommunicationDropdown({ customer, order, settings, employeeName }: CommunicationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const templates: Template[] = settings?.communicationTemplates || [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (templates.length === 0) {
    return null; // Keine Vorlagen vorhanden
  }

  // Ermittle die "Haupt-Vorlage" basierend auf dem Status
  const status = order?.status || 'draft';
  let defaultTemplateId = 't2'; // Erstkontakt (Keine Bilder)

  if (status === 'draft') {
    defaultTemplateId = 't2'; // Erstkontakt (Keine Bilder)
  } else if (status === 'quote') {
    defaultTemplateId = 't3'; // Angebot schicken
  } else if (status === 'confirmed') {
    defaultTemplateId = 't7'; // Bestätigung
  } else if (status === 'completed' || status === 'invoice_open') {
    defaultTemplateId = 't9'; // Rechnung schicken
  }

  const defaultTemplate = templates.find(t => t.id === defaultTemplateId) || templates[0];

  // Funktion zum Ersetzen der Platzhalter
  const generateText = (templateText: string) => {
    let text = templateText;
    
    // Name einfügen
    const fullName = customer?.type === 'firma' ? customer?.lastName : `${customer?.firstName || ''} ${customer?.lastName || ''}`.trim();
    text = text.replace(/\[Name\]/g, fullName || 'Kunde');

    // Datum einfügen
    let dateStr = 'TBD';
    if (order?.orderMeta?.movingDateFrom) {
      dateStr = new Date(order.orderMeta.movingDateFrom).toLocaleDateString('de-DE');
    }
    text = text.replace(/\[Datum\]/g, dateStr);

    // Mitarbeiter einfügen
    text = text.replace(/\[Mitarbeiter\]/g, employeeName || 'Rothirsch Team');

    return text;
  };

  const handleWhatsApp = (template: Template) => {
    if (!customer?.phone) {
      toast.error("Keine Telefonnummer beim Kunden hinterlegt!");
      return;
    }
    const text = generateText(template.body);
    const phone = customer.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    setIsOpen(false);
  };

  const handleEmail = (template: Template) => {
    if (!customer?.email) {
      toast.error("Keine E-Mail Adresse beim Kunden hinterlegt!");
      return;
    }
    const text = generateText(template.body);
    const subject = template.subject || 'Ihre Anfrage bei Rothirsch Umzüge';
    window.open(`mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`, '_blank');
    setIsOpen(false);
  };

  const handleCopy = (template: Template) => {
    const text = generateText(template.body);
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Text kopiert! (z.B. für Check24)");
      setIsOpen(false);
    }).catch(() => {
      toast.error("Fehler beim Kopieren.");
    });
  };

  return (
    <div className="relative inline-block w-full text-left" ref={dropdownRef}>
      <div className="flex rounded-lg shadow-sm w-full">
        <button
          onClick={() => handleWhatsApp(defaultTemplate)}
          className="relative inline-flex flex-1 items-center justify-center gap-2 rounded-l-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-500 focus:z-10"
        >
          <ChatBubbleBottomCenterTextIcon className="w-5 h-5" />
          WhatsApp: {defaultTemplate.name}
        </button>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative -ml-px inline-flex items-center rounded-r-lg bg-green-600 px-2 py-2 text-white hover:bg-green-500 focus:z-10 border-l border-green-700"
        >
          <span className="sr-only">Optionen öffnen</span>
          <ChevronDownIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-72 origin-top-right rounded-md bg-bg-panel shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none border border-structure max-h-96 overflow-y-auto">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider bg-bg-dark border-b border-structure">
              Vorlage auswählen
            </div>
            {templates.map((tpl) => (
              <div key={tpl.id} className="border-b border-structure/50 last:border-0 hover:bg-bg-dark transition-colors">
                <div className="px-4 py-2">
                  <p className="text-sm font-semibold text-text-main mb-2">{tpl.name}</p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleWhatsApp(tpl)}
                      className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs transition-colors"
                      title="Per WhatsApp senden"
                    >
                      <ChatBubbleBottomCenterTextIcon className="w-4 h-4" /> WA
                    </button>
                    <button 
                      onClick={() => handleEmail(tpl)}
                      className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-xs transition-colors"
                      title="Per E-Mail senden"
                    >
                      <EnvelopeIcon className="w-4 h-4" /> Mail
                    </button>
                    <button 
                      onClick={() => handleCopy(tpl)}
                      className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded bg-structure text-white hover:bg-structure/80 text-xs transition-colors"
                      title="Text in Zwischenablage kopieren"
                    >
                      <DocumentDuplicateIcon className="w-4 h-4" /> Kopie
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
