"use client";

import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  CalendarDaysIcon, 
  ClockIcon, 
  ChatBubbleLeftRightIcon,
  CheckIcon
} from '@heroicons/react/24/outline';
import { updateTaskSchedule } from '@/lib/taskStateController';
import toast from 'react-hot-toast';

interface TaskScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  todo: any;
  parentOrder: any;
  onSaved?: () => void;
}

export function TaskScheduleModal({
  isOpen,
  onClose,
  todo,
  parentOrder,
  onSaved
}: TaskScheduleModalProps) {
  if (!isOpen || !todo || !parentOrder) return null;

  const isKarton = todo.id === 'kartons_liefern' || todo.kanbanCategory === 'kartons';
  const isHV = todo.id === 'halteverbot' || todo.kanbanCategory === 'halteverbot';
  const isLift = todo.id === 'moebellift_buchen' || todo.kanbanCategory === 'moebellift';
  const isViewing = todo.id === 'viewing_requested' || todo.id === 'viewing_date';

  // Determine initial date & time from order
  const initialDate = isKarton 
    ? (parentOrder.orderMeta?.kartonDeliveryDate || parentOrder.logistics?.boxDeliveryDate || '')
    : isHV 
      ? (parentOrder.orderMeta?.halteverbotDate || parentOrder.logistics?.hvzDate || '')
      : isLift 
        ? (parentOrder.orderMeta?.moebelliftDate || '')
        : (['requested', 'erledigt_fotos'].includes(parentOrder.orderMeta?.viewingDate || '') 
            ? '' 
            : (parentOrder.orderMeta?.viewingDate?.split('T')[0] || parentOrder.orderMeta?.viewingDate?.slice(0, 10) || ''));

  const initialTime = isKarton
    ? (parentOrder.orderMeta?.kartonDeliveryTime || '')
    : isHV
      ? (parentOrder.orderMeta?.halteverbotTime || '')
      : isLift
        ? (parentOrder.orderMeta?.moebelliftTime || '')
        : (parentOrder.orderMeta?.viewingTime || (parentOrder.orderMeta?.viewingDate?.includes('T') ? parentOrder.orderMeta.viewingDate.split('T')[1]?.slice(0, 5) : ''));

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDate(initialDate);
    setTime(initialTime);
  }, [initialDate, initialTime]);

  // Quick Date presets
  const setRelativeDays = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const dateStr = d.toISOString().split('T')[0];
    setDate(dateStr);
  };

  const setRelativeMoveDays = (daysBeforeMove: number) => {
    const moveDateStr = parentOrder.orderMeta?.movingDateFrom || parentOrder.movingDate;
    if (!moveDateStr) {
      toast.error('Kein Umzugsdatum vorhanden');
      return;
    }
    const d = new Date(moveDateStr.split('T')[0]);
    d.setDate(d.getDate() - daysBeforeMove);
    const dateStr = d.toISOString().split('T')[0];
    setDate(dateStr);
  };

  const timeSlots = [
    '08:00 - 12:00 Uhr (Vormittag)',
    '10:00 - 14:00 Uhr (Mittag)',
    '13:00 - 17:00 Uhr (Nachmittag)',
    'Ganztägig (Flexibel)'
  ];

  const handleSave = async () => {
    if (!date) {
      toast.error('Bitte wählen Sie ein Datum aus.');
      return;
    }

    setIsSaving(true);
    try {
      await updateTaskSchedule(parentOrder.id, todo.id, date, time);
      toast.success('Termin erfolgreich gespeichert!');
      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      console.error('Error saving task schedule:', error);
      toast.error('Fehler beim Speichern des Termins.');
    } finally {
      setIsSaving(false);
    }
  };

  // WhatsApp reminder generator
  const handleSendWhatsApp = () => {
    const phone = parentOrder.billingAddress?.phone || parentOrder.customer?.phone || '';
    if (!phone) {
      toast.error('Keine Telefonnummer beim Kunden hinterlegt.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const taskName = isKarton ? 'die Umzugskartons liefern' : isHV ? 'die Halteverbotszone einrichten' : isLift ? 'den Möbellift bereitstellen' : 'den Besichtigungstermin durchführen';
    const formattedDate = date ? new Date(date).toLocaleDateString('de-DE') : 'einem vereinbarten Termin';
    const timeText = time ? ` um ca. ${time}` : '';
    
    const message = encodeURIComponent(
      `Hallo ${parentOrder.customerName || 'Herr/Frau Kunde'},\n` +
      `wir möchten für Ihren Umzug gerne am ${formattedDate}${timeText} ${taskName}.\n` +
      `Passt Ihnen dieser Termin?\n\nViele Grüße,\nRothirsch Team`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const getTaskTitle = () => {
    if (isKarton) return 'Kartonlieferung planen';
    if (isHV) return 'Halteverbot aufstellen planen';
    if (isLift) return 'Möbellift reservieren';
    if (isViewing) return 'Besichtigungstermin planen';
    return `Termin: ${todo.title || 'Aufgabe'}`;
  };

  const moveDateDisplay = parentOrder.orderMeta?.movingDateFrom 
    ? new Date(parentOrder.orderMeta.movingDateFrom).toLocaleDateString('de-DE')
    : 'TBA';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <CalendarDaysIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-base text-slate-900 dark:text-white">
                {getTaskTitle()}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kunde: <span className="font-semibold text-slate-800 dark:text-slate-200">{parentOrder.customerName || 'Kunde'}</span> • Umzug: <span className="font-semibold text-primary">{moveDateDisplay}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Section 1: Datum */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CalendarDaysIcon className="w-4 h-4 text-primary" />
                <span>Datum festlegen</span>
              </label>
              {date && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                  {new Date(date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              )}
            </div>

            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-sm shadow-inner"
            />

            {/* Quick Presets */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Schnellwahl:</span>
              <button 
                type="button"
                onClick={() => setRelativeDays(1)}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white transition-all text-slate-600 dark:text-slate-300"
              >
                Morgen
              </button>
              <button 
                type="button"
                onClick={() => setRelativeDays(3)}
                className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white transition-all text-slate-600 dark:text-slate-300"
              >
                In 3 Tagen
              </button>
              {isKarton && (
                <button 
                  type="button"
                  onClick={() => setRelativeMoveDays(21)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500 hover:text-white transition-all border border-orange-500/20"
                >
                  3 Wochen vor Umzug
                </button>
              )}
              {isHV && (
                <button 
                  type="button"
                  onClick={() => setRelativeMoveDays(4)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500 hover:text-white transition-all border border-yellow-500/20"
                >
                  4 Tage vor Umzug
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Uhrzeit & Zeitfenster */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-primary" />
              <span>Uhrzeit / Zeitfenster</span>
            </label>

            {/* Presets Chips */}
            <div className="grid grid-cols-2 gap-2">
              {timeSlots.map((slot) => {
                const isSelected = time === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setTime(slot)}
                    className={`p-2.5 text-xs text-left font-medium rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-primary text-white border-primary shadow-sm scale-[1.02]'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/50'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <input 
                type="text" 
                placeholder="Oder genaue Uhrzeit (z.B. 14:30 Uhr)"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-xs"
              />
            </div>
          </div>

          {/* WhatsApp Direct Notification Option */}
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                  Kunde per WhatsApp informieren
                </p>
                <p className="text-[10px] text-emerald-700/80 dark:text-emerald-400">
                  Senden Sie eine vorformulierte Nachricht mit Datum & Uhrzeit.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm shrink-0 whitespace-nowrap"
            >
              WhatsApp öffnen
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !date}
            className="btn-primary py-2.5 px-6 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isSaving ? (
              <span>Speichern...</span>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                <span>Termin festlegen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
