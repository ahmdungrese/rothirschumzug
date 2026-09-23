"use client";

import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  CalendarDaysIcon, 
  ClockIcon, 
  ChatBubbleLeftRightIcon,
  CheckIcon,
  MapPinIcon,
  TruckIcon
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

  // Extract clean addresses
  const addressA = [
    parentOrder.logistics?.a_street || parentOrder.logistics?.from?.street,
    parentOrder.logistics?.a_houseNr || parentOrder.logistics?.from?.houseNumber,
    parentOrder.logistics?.a_zip || parentOrder.logistics?.from?.postalCode,
    parentOrder.logistics?.a_city || parentOrder.logistics?.from?.city
  ].filter(Boolean).join(' ');

  const addressB = [
    parentOrder.logistics?.b_street || parentOrder.logistics?.to?.street,
    parentOrder.logistics?.b_houseNr || parentOrder.logistics?.to?.houseNumber,
    parentOrder.logistics?.b_zip || parentOrder.logistics?.to?.postalCode,
    parentOrder.logistics?.b_city || parentOrder.logistics?.to?.city
  ].filter(Boolean).join(' ');

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

  const initialDuration = parentOrder.orderMeta?.moebelliftDuration || '3';
  const initialLocation = parentOrder.orderMeta?.moebelliftLocation || parentOrder.orderMeta?.hvzLocation || 
    (parentOrder.logistics?.a_parking && !parentOrder.logistics?.b_parking ? 'a' :
     !parentOrder.logistics?.a_parking && parentOrder.logistics?.b_parking ? 'b' :
     parentOrder.logistics?.a_parking && parentOrder.logistics?.b_parking ? 'both' : 'a');
  const initialMethod = parentOrder.orderMeta?.hvzMethod || parentOrder.logistics?.hvzMethod || 'selbst';

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [duration, setDuration] = useState(initialDuration);
  const [location, setLocation] = useState<'a' | 'b' | 'both'>(initialLocation as any);
  const [method, setMethod] = useState<'selbst' | 'extern'>(initialMethod as any);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDate(initialDate);
    setTime(initialTime);
  }, [initialDate, initialTime]);

  // Quick Date presets
  const setRelativeDays = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setDate(d.toISOString().split('T')[0]);
  };

  const setMoveDay = () => {
    const moveDateStr = parentOrder.orderMeta?.movingDateFrom || parentOrder.movingDate;
    if (!moveDateStr) {
      toast.error('Kein Umzugsdatum vorhanden');
      return;
    }
    setDate(moveDateStr.split('T')[0]);
  };

  const setRelativeMoveDays = (daysBeforeMove: number) => {
    const moveDateStr = parentOrder.orderMeta?.movingDateFrom || parentOrder.movingDate;
    if (!moveDateStr) {
      toast.error('Kein Umzugsdatum vorhanden');
      return;
    }
    const d = new Date(moveDateStr.split('T')[0]);
    d.setDate(d.getDate() - daysBeforeMove);
    setDate(d.toISOString().split('T')[0]);
  };

  // Calculate end time
  const calculateEndTime = (startStr: string, durHours: number) => {
    if (!startStr) return '';
    const match = startStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) return '';
    const h = parseInt(match[1], 10);
    const m = match[2];
    const endH = (h + durHours) % 24;
    return `${endH < 10 ? '0' + endH : endH}:${m}`;
  };

  const endTimePreview = isLift && time ? calculateEndTime(time, parseInt(duration, 10) || 1) : '';

  const handleSave = async () => {
    if (!date) {
      toast.error('Bitte wählen Sie ein Datum aus.');
      return;
    }

    setIsSaving(true);
    try {
      await updateTaskSchedule(parentOrder.id, todo.id, date, time, {
        duration: isLift ? duration : undefined,
        endTime: isLift ? endTimePreview : undefined,
        location: (isLift || isHV) ? location : undefined,
        method: isHV ? method : undefined
      });
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

          {/* Location Selector (A vs B vs Both) for Möbellift and HVZ */}
          {(isLift || isHV) && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <MapPinIcon className="w-4 h-4 text-primary" />
                <span>Einsatzort festlegen</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLocation('a')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    location === 'a' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>🏢 Auszugsort (A)</span>
                    {location === 'a' && <CheckIcon className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {addressA || 'Adresse A'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setLocation('b')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    location === 'b' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>🏠 Einzugsort (B)</span>
                    {location === 'b' && <CheckIcon className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {addressB || 'Adresse B'}
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Execution Method for Halteverbot (Selbst vs Extern) */}
          {isHV && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Ausführung / Zuständigkeit
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('selbst')}
                  className={`p-3 rounded-2xl border text-left transition-all text-xs font-bold flex items-center gap-2 ${
                    method === 'selbst' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <TruckIcon className="w-4 h-4" />
                  <span>Selbst aufstellen</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('extern')}
                  className={`p-3 rounded-2xl border text-left transition-all text-xs font-bold flex items-center gap-2 ${
                    method === 'extern' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">domain</span>
                  <span>Externe Firma</span>
                </button>
              </div>
            </div>
          )}

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
              
              {isLift && (
                <button 
                  type="button"
                  onClick={setMoveDay}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-primary/15 text-primary hover:bg-primary hover:text-white transition-all border border-primary/30"
                >
                  Am Umzugstag ({moveDateDisplay})
                </button>
              )}

              {isHV && (
                <button 
                  type="button"
                  onClick={() => setRelativeMoveDays(4)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all border border-amber-500/30"
                >
                  4 Tage vor Umzug (Aufbau)
                </button>
              )}

              {isKarton && (
                <button 
                  type="button"
                  onClick={() => setRelativeMoveDays(21)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500 hover:text-white transition-all border border-orange-500/20"
                >
                  3 Wochen vor Umzug
                </button>
              )}

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
            </div>
          </div>

          {/* Section 2: Uhrzeit & Dauer (besonders für Möbellift) */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <ClockIcon className="w-4 h-4 text-primary" />
              <span>{isLift ? 'Startzeit & Dauer' : 'Uhrzeit / Zeitfenster'}</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                  {isLift ? 'Startzeit' : 'Uhrzeit'}
                </label>
                <input 
                  type="time" 
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-sm shadow-inner"
                />
              </div>

              {isLift ? (
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                    Dauer (Stunden)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {['1', '2', '3', '4', '5'].map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setDuration(h)}
                        className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                          duration === h 
                            ? 'bg-primary text-white border-primary shadow-xs' 
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                    Schnell-Zeitfenster
                  </label>
                  <select
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white text-xs"
                  >
                    <option value="">Benutzerdefiniert</option>
                    <option value="08:00 - 12:00">08:00 - 12:00 (Vormittag)</option>
                    <option value="10:00 - 14:00">10:00 - 14:00 (Mittag)</option>
                    <option value="13:00 - 17:00">13:00 - 17:00 (Nachmittag)</option>
                    <option value="Ganztägig">Ganztägig (Flexibel)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Möbellift live preview badge */}
            {isLift && time && (
              <div className="p-3 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-blue-900 dark:text-blue-200 text-xs font-bold flex items-center justify-between">
                <span>Geplanter Einsatz:</span>
                <span className="font-headline text-primary">
                  {time} - {endTimePreview} Uhr ({duration} Std.)
                </span>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSendWhatsApp}
            className="px-3.5 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4 text-emerald-600" />
            <span>Kunde informieren</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckIcon className="w-4 h-4" />
              <span>{isSaving ? 'Speichern...' : 'Termin speichern'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
