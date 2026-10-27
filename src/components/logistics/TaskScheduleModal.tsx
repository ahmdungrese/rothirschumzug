"use client";

import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  CalendarDaysIcon, 
  ClockIcon, 
  ChatBubbleLeftRightIcon,
  CheckIcon,
  CheckCircleIcon,
  MapPinIcon,
  TruckIcon,
  BuildingOfficeIcon,
  HomeIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { updateTaskSchedule } from '@/lib/taskStateController';
import toast from 'react-hot-toast';
import { useModalBackHandler } from '@/hooks/useModalBackHandler';
import { triggerHaptic } from '@/lib/haptics';
import { exportTaskToCalendar } from '@/lib/calendarExport';

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
  useModalBackHandler(isOpen, onClose, 'task-schedule-modal');

  const isKarton = todo?.id === 'kartons_liefern' || todo?.kanbanCategory === 'kartons';
  const isHV = todo?.id === 'halteverbot' || todo?.kanbanCategory === 'halteverbot' || todo?.id === 'hvz';
  const isLift = todo?.id === 'moebellift_buchen' || todo?.kanbanCategory === 'moebellift' || todo?.id === 'moebellift';
  const isViewing = todo?.id === 'viewing_requested' || todo?.id === 'viewing_date';

  // Extract clean addresses
  const addressA = [
    parentOrder?.logistics?.a_street || parentOrder?.logistics?.from?.street,
    parentOrder?.logistics?.a_houseNr || parentOrder?.logistics?.from?.houseNumber,
    parentOrder?.logistics?.a_zip || parentOrder?.logistics?.from?.postalCode,
    parentOrder?.logistics?.a_city || parentOrder?.logistics?.from?.city
  ].filter(Boolean).join(' ');

  const addressB = [
    parentOrder?.logistics?.b_street || parentOrder?.logistics?.to?.street,
    parentOrder?.logistics?.b_houseNr || parentOrder?.logistics?.to?.houseNumber,
    parentOrder?.logistics?.b_zip || parentOrder?.logistics?.to?.postalCode,
    parentOrder?.logistics?.b_city || parentOrder?.logistics?.to?.city
  ].filter(Boolean).join(' ');

  const moveDateDefault = (parentOrder?.orderMeta?.movingDateFrom || parentOrder?.movingDate || '').split('T')[0];

  // Determine initial location
  const initialLocation: 'a' | 'b' | 'both' = (() => {
    if (isLift) {
      if (parentOrder?.orderMeta?.moebelliftLocation) return parentOrder.orderMeta.moebelliftLocation;
      if (parentOrder?.logistics?.moebelliftLocation) return parentOrder.logistics.moebelliftLocation;
      if (parentOrder?.logistics?.a_furnitureLift && parentOrder?.logistics?.b_furnitureLift) return 'both';
      if (parentOrder?.logistics?.b_furnitureLift) return 'b';
      return 'a';
    }
    if (isHV) {
      if (parentOrder?.orderMeta?.hvzLocation) return parentOrder.orderMeta.hvzLocation;
      if (parentOrder?.logistics?.hvzLocation) return parentOrder.logistics.hvzLocation;
      if (parentOrder?.logistics?.a_parking && parentOrder?.logistics?.b_parking) return 'both';
      if (parentOrder?.logistics?.b_parking) return 'b';
      return 'a';
    }
    return 'a';
  })();

  // Single date/time (for Kartons / Viewing)
  const initialDate = isKarton 
    ? (parentOrder?.orderMeta?.kartonDeliveryDate || parentOrder?.logistics?.boxDeliveryDate || '')
    : (['requested', 'erledigt_fotos'].includes(parentOrder?.orderMeta?.viewingDate || '') 
        ? '' 
        : (parentOrder?.orderMeta?.viewingDate?.split('T')[0] || parentOrder?.orderMeta?.viewingDate?.slice(0, 10) || ''));

  const initialTime = isKarton
    ? (parentOrder?.orderMeta?.kartonDeliveryTime || '')
    : (parentOrder?.orderMeta?.viewingTime || (parentOrder?.orderMeta?.viewingDate?.includes('T') ? parentOrder.orderMeta.viewingDate.split('T')[1]?.slice(0, 5) : ''));

  // Separate states for Location A
  const initialDateA = isLift
    ? (parentOrder?.orderMeta?.moebelliftDateA || (initialLocation !== 'b' ? parentOrder?.orderMeta?.moebelliftDate : '') || moveDateDefault)
    : isHV
      ? (parentOrder?.orderMeta?.halteverbotDateA || (initialLocation !== 'b' ? parentOrder?.orderMeta?.halteverbotDate : '') || parentOrder?.logistics?.hvzDate || '')
      : initialDate;

  const initialTimeA = isLift
    ? (parentOrder?.orderMeta?.moebelliftTimeA || (initialLocation !== 'b' ? parentOrder?.orderMeta?.moebelliftTime : '') || '09:00')
    : isHV
      ? (parentOrder?.orderMeta?.halteverbotTimeA || (initialLocation !== 'b' ? parentOrder?.orderMeta?.halteverbotTime : '') || parentOrder?.logistics?.hvzTime || '08:00')
      : initialTime;

  const initialDurationA = isLift
    ? (parentOrder?.orderMeta?.moebelliftDurationA || (initialLocation !== 'b' ? parentOrder?.orderMeta?.moebelliftDuration : '') || '2')
    : '2';

  // Separate states for Location B
  const initialDateB = isLift
    ? (parentOrder?.orderMeta?.moebelliftDateB || (initialLocation !== 'a' ? parentOrder?.orderMeta?.moebelliftDate : '') || moveDateDefault)
    : isHV
      ? (parentOrder?.orderMeta?.halteverbotDateB || (initialLocation !== 'a' ? parentOrder?.orderMeta?.halteverbotDate : '') || parentOrder?.logistics?.hvzDate || '')
      : initialDate;

  const initialTimeB = isLift
    ? (parentOrder?.orderMeta?.moebelliftTimeB || (initialLocation === 'b' ? parentOrder?.orderMeta?.moebelliftTime : '') || '13:00')
    : isHV
      ? (parentOrder?.orderMeta?.halteverbotTimeB || (initialLocation === 'b' ? parentOrder?.orderMeta?.halteverbotTime : '') || parentOrder?.logistics?.hvzTime || '08:00')
      : initialTime;

  const initialDurationB = isLift
    ? (parentOrder?.orderMeta?.moebelliftDurationB || (initialLocation === 'b' ? parentOrder?.orderMeta?.moebelliftDuration : '') || '2')
    : '2';

  const initialMethod = parentOrder?.orderMeta?.hvzMethod || parentOrder?.logistics?.hvzMethod || 'selbst';
  const initialViewingType = ((parentOrder?.orderMeta?.viewingType || parentOrder?.logistics?.viewingType || 'vor_ort').toLowerCase().includes('video') || (parentOrder?.orderMeta?.viewingType || '').toLowerCase().includes('online')) ? 'online' : 'vor_ort';

  // States
  const [location, setLocation] = useState<'a' | 'b' | 'both'>(initialLocation);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);

  const [dateA, setDateA] = useState(initialDateA);
  const [timeA, setTimeA] = useState(initialTimeA);
  const [durationA, setDurationA] = useState(initialDurationA);

  const [dateB, setDateB] = useState(initialDateB);
  const [timeB, setTimeB] = useState(initialTimeB);
  const [durationB, setDurationB] = useState(initialDurationB);

  const [method, setMethod] = useState<'selbst' | 'extern'>(initialMethod as any);
  const [viewingType, setViewingType] = useState<'vor_ort' | 'online'>(initialViewingType);
  const [activeDualTab, setActiveDualTab] = useState<'a' | 'b'>('a');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [calendarExported, setCalendarExported] = useState(false);
  const [whatsAppSent, setWhatsAppSent] = useState(false);

  useEffect(() => {
    setLocation(initialLocation);
    setDate(initialDate);
    setTime(initialTime);
    setDateA(initialDateA);
    setTimeA(initialTimeA);
    setDurationA(initialDurationA);
    setDateB(initialDateB);
    setTimeB(initialTimeB);
    setDurationB(initialDurationB);
    setMethod(initialMethod as any);
    setViewingType(initialViewingType);
    setActiveDualTab('a');
    setSaveSuccess(false);
    setCalendarExported(false);
    setWhatsAppSent(false);
  }, [isOpen, parentOrder?.id]);

  const isDirty = (isLift || isHV)
    ? (location !== initialLocation ||
       (location !== 'b' && (dateA !== initialDateA || timeA !== initialTimeA || (isLift && durationA !== initialDurationA))) ||
       (location !== 'a' && (dateB !== initialDateB || timeB !== initialTimeB || (isLift && durationB !== initialDurationB))))
    : (date !== initialDate || time !== initialTime);

  const hasSavedInDb = (isLift || isHV)
    ? Boolean((location !== 'b' && initialDateA) || (location !== 'a' && initialDateB))
    : Boolean(initialDate);

  if (!isOpen || !todo || !parentOrder) return null;

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

  const endTimePreviewA = isLift && timeA ? calculateEndTime(timeA, parseInt(durationA, 10) || 1) : '';
  const endTimePreviewB = isLift && timeB ? calculateEndTime(timeB, parseInt(durationB, 10) || 1) : '';

  // Quick Date presets helpers
  const applyRelativeDays = (target: 'single' | 'a' | 'b', daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    const iso = d.toISOString().split('T')[0];
    if (target === 'a') setDateA(iso);
    else if (target === 'b') setDateB(iso);
    else setDate(iso);
  };

  const applyMoveDay = (target: 'single' | 'a' | 'b') => {
    if (!moveDateDefault) {
      toast.error('Kein Umzugsdatum vorhanden');
      return;
    }
    if (target === 'a') setDateA(moveDateDefault);
    else if (target === 'b') setDateB(moveDateDefault);
    else setDate(moveDateDefault);
  };

  const applyRelativeMoveDays = (target: 'single' | 'a' | 'b', daysBeforeMove: number) => {
    if (!moveDateDefault) {
      toast.error('Kein Umzugsdatum vorhanden');
      return;
    }
    const d = new Date(moveDateDefault);
    d.setDate(d.getDate() - daysBeforeMove);
    const iso = d.toISOString().split('T')[0];
    if (target === 'a') setDateA(iso);
    else if (target === 'b') setDateB(iso);
    else setDate(iso);
  };

  const handleSave = async () => {
    let effectiveDate = date;
    let effectiveTime = time;

    if (isLift || isHV) {
      if (location === 'a') {
        if (!dateA) {
          toast.error('Bitte wählen Sie ein Datum für Auszugsort (A) aus.');
          return;
        }
        effectiveDate = dateA;
        effectiveTime = timeA;
      } else if (location === 'b') {
        if (!dateB) {
          toast.error('Bitte wählen Sie ein Datum für Einzugsort (B) aus.');
          return;
        }
        effectiveDate = dateB;
        effectiveTime = timeB;
      } else if (location === 'both') {
        if (!dateA && !dateB) {
          toast.error('Bitte wählen Sie mindestens ein Datum aus.');
          return;
        }
        effectiveDate = dateA || dateB;
        effectiveTime = timeA || timeB;
      }
    } else {
      if (!date) {
        toast.error('Bitte wählen Sie ein Datum aus.');
        return;
      }
    }

    setIsSaving(true);
    try {
      await updateTaskSchedule(parentOrder.id, todo.id, effectiveDate, effectiveTime, {
        duration: isLift ? (location === 'b' ? durationB : durationA) : undefined,
        endTime: isLift ? (location === 'b' ? endTimePreviewB : endTimePreviewA) : undefined,
        location: (isLift || isHV) ? location : undefined,
        method: isHV ? method : undefined,
        viewingType: isViewing ? viewingType : undefined,
        dateA: (isLift || isHV) ? dateA : undefined,
        timeA: (isLift || isHV) ? timeA : undefined,
        durationA: isLift ? durationA : undefined,
        endTimeA: isLift ? endTimePreviewA : undefined,
        dateB: (isLift || isHV) ? dateB : undefined,
        timeB: (isLift || isHV) ? timeB : undefined,
        durationB: isLift ? durationB : undefined,
        endTimeB: isLift ? endTimePreviewB : undefined,
      });

      toast.success('Termin(e) erfolgreich gespeichert!');
      triggerHaptic('success');
      if (onSaved) onSaved();
      setSaveSuccess(true);
      setCalendarExported(false);
      setWhatsAppSent(false);
    } catch (error) {
      console.error('Error saving task schedule:', error);
      toast.error('Fehler beim Speichern des Termins.');
    } finally {
      setIsSaving(false);
    }
  };

  // WhatsApp generator with support for dual locations
  const handleSendWhatsApp = () => {
    const phone = parentOrder.billingAddress?.phone || parentOrder.customer?.phone || parentOrder.customerPhone || '';
    if (!phone) {
      toast.error('Keine Telefonnummer beim Kunden hinterlegt.');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const salutation = `Hallo ${parentOrder.customerName || 'Herr/Frau Kunde'},\n\n`;

    let messageBody = '';

    if (isLift) {
      if (location === 'both') {
        const fA = dateA ? new Date(dateA).toLocaleDateString('de-DE') : 'Termin folgt';
        const fB = dateB ? new Date(dateB).toLocaleDateString('de-DE') : 'Termin folgt';
        messageBody = 
          `wir haben den Möbellift für Ihren Umzug wie folgt eingeplant:\n\n` +
          `🏢 Auszugsort (A): am ${fA} um ca. ${timeA || '09:00'} Uhr (${durationA} Std. bis ca. ${endTimePreviewA || ''} Uhr)\n` +
          `🏠 Einzugsort (B): am ${fB} um ca. ${timeB || '13:00'} Uhr (${durationB} Std. bis ca. ${endTimePreviewB || ''} Uhr)\n\n` +
          `Passt dieser Ablauf für Sie?\n\nViele Grüße,\nRothirsch Team`;
      } else if (location === 'b') {
        const fB = dateB ? new Date(dateB).toLocaleDateString('de-DE') : 'Termin folgt';
        messageBody = 
          `wir haben den Möbellift an der Einzugsadresse (B) am ${fB} um ca. ${timeB || '13:00'} Uhr (${durationB} Std. bis ca. ${endTimePreviewB || ''} Uhr) eingeplant.\n\n` +
          `Passt Ihnen dieser Termin?\n\nViele Grüße,\nRothirsch Team`;
      } else {
        const fA = dateA ? new Date(dateA).toLocaleDateString('de-DE') : 'Termin folgt';
        messageBody = 
          `wir haben den Möbellift an der Auszugsadresse (A) am ${fA} um ca. ${timeA || '09:00'} Uhr (${durationA} Std. bis ca. ${endTimePreviewA || ''} Uhr) eingeplant.\n\n` +
          `Passt Ihnen dieser Termin?\n\nViele Grüße,\nRothirsch Team`;
      }
    } else if (isHV) {
      if (location === 'both') {
        const fA = dateA ? new Date(dateA).toLocaleDateString('de-DE') : 'Termin folgt';
        const fB = dateB ? new Date(dateB).toLocaleDateString('de-DE') : 'Termin folgt';
        messageBody = 
          `wir haben die Halteverbotszonen für Ihren Umzug wie folgt terminiert:\n\n` +
          `🏢 Auszugsort (A): Aufbau am ${fA}${timeA ? ` um ca. ${timeA} Uhr` : ''}\n` +
          `🏠 Einzugsort (B): Aufbau am ${fB}${timeB ? ` um ca. ${timeB} Uhr` : ''}\n\n` +
          `Passt Ihnen dieser Ablauf?\n\nViele Grüße,\nRothirsch Team`;
      } else {
        const actD = location === 'b' ? dateB : dateA;
        const actT = location === 'b' ? timeB : timeA;
        const locTxt = location === 'b' ? 'an der Einzugsadresse' : 'an der Auszugsadresse';
        const fDate = actD ? new Date(actD).toLocaleDateString('de-DE') : 'Termin folgt';
        messageBody = 
          `wir möchten die Halteverbotszone für Ihren Umzug ${locTxt} am ${fDate}${actT ? ` um ca. ${actT} Uhr` : ''} einrichten.\n\n` +
          `Passt Ihnen dieser Termin?\n\nViele Grüße,\nRothirsch Team`;
      }
    } else {
      const formattedDate = date ? new Date(date).toLocaleDateString('de-DE') : 'einem vereinbarten Termin';
      const timeText = time ? ` um ca. ${time}` : '';
      const taskName = isKarton ? 'die Umzugskartons liefern' : 'den Besichtigungstermin durchführen';
      messageBody = 
        `wir möchten für Ihren Umzug gerne am ${formattedDate}${timeText} ${taskName}.\n\n` +
        `Passt Ihnen dieser Termin?\n\nViele Grüße,\nRothirsch Team`;
    }

    const message = encodeURIComponent(salutation + messageBody);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    setWhatsAppSent(true);
    triggerHaptic('light');
  };

  const handleExportToCalendar = () => {
    const d = (isLift || isHV) ? (location === 'b' ? dateB : dateA) : date;
    const t = (isLift || isHV) ? (location === 'b' ? timeB : timeA) : time;
    if (!d && !(dateA || dateB)) {
      toast.error('Bitte zuerst ein Datum auswählen.');
      return;
    }

    exportTaskToCalendar(todo.id, parentOrder, d || dateA || dateB, t, location as any, {
      dateA,
      timeA,
      durationA,
      endTimeA: endTimePreviewA,
      dateB,
      timeB,
      durationB,
      endTimeB: endTimePreviewB,
    });
    setCalendarExported(true);
    triggerHaptic('success');
  };

  const getTaskTitle = () => {
    if (isKarton) return 'Kartonlieferung planen';
    if (isHV) return 'Halteverbot aufstellen planen';
    if (isLift) return 'Möbellift reservieren';
    if (isViewing) return 'Besichtigungstermin planen';
    return `Termin: ${todo.title || 'Aufgabe'}`;
  };

  const moveDateDisplay = moveDateDefault 
    ? new Date(moveDateDefault).toLocaleDateString('de-DE')
    : 'TBA';

  // Sub-component: Date & Time selector card for a specific location
  const renderLocationScheduleBox = (
    locKey: 'a' | 'b',
    title: string,
    badgeText: string,
    address: string,
    currentDate: string,
    onDateChange: (val: string) => void,
    currentTime: string,
    onTimeChange: (val: string) => void,
    currentDuration: string,
    onDurationChange: (val: string) => void,
    endTimeCalc: string,
    accentBorder: string
  ) => {
    return (
      <div className={`p-4 rounded-2xl border-2 ${accentBorder} bg-slate-50/70 dark:bg-slate-800/40 space-y-4`}>
        {/* Box Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            {locKey === 'a' ? (
              <BuildingOfficeIcon className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <HomeIcon className="w-4 h-4 text-primary shrink-0" />
            )}
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              {title}
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {badgeText}
          </span>
        </div>

        {/* Address */}
        <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 font-medium">
          <MapPinIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">{address || (locKey === 'a' ? 'Adresse A' : 'Adresse B')}</span>
        </div>

        {/* Date Row */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CalendarDaysIcon className="w-3.5 h-3.5 text-primary" />
              <span>Datum</span>
            </label>
            {currentDate && (
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {new Date(currentDate).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            )}
          </div>

          <input 
            type="date" 
            value={currentDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-xs shadow-inner"
          />

          {/* Quick presets for this box */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[9px] text-slate-400 font-bold uppercase">Schnellwahl:</span>
            {isLift && (
              <button 
                type="button"
                onClick={() => applyMoveDay(locKey)}
                className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-primary/15 text-primary hover:bg-primary hover:text-white transition-all border border-primary/30"
              >
                Am Umzugstag ({moveDateDisplay})
              </button>
            )}
            {isHV && (
              <button 
                type="button"
                onClick={() => applyRelativeMoveDays(locKey, 4)}
                className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-white transition-all border border-amber-500/30"
              >
                4 Tage vor Umzug
              </button>
            )}
            <button 
              type="button"
              onClick={() => applyRelativeDays(locKey, 1)}
              className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-white dark:bg-slate-800 hover:bg-primary hover:text-white transition-all text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              Morgen
            </button>
            <button 
              type="button"
              onClick={() => applyRelativeDays(locKey, 3)}
              className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-white dark:bg-slate-800 hover:bg-primary hover:text-white transition-all text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
            >
              In 3 Tagen
            </button>
          </div>
        </div>

        {/* Time & Duration Row */}
        <div className="space-y-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/50">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <ClockIcon className="w-3.5 h-3.5 text-primary" />
            <span>{isLift ? 'Startzeit & Dauer' : 'Uhrzeit / Zeitfenster'}</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">
                {isLift ? 'Startzeit' : 'Uhrzeit'}
              </label>
              <input 
                type="time" 
                value={currentTime}
                onChange={(e) => onTimeChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-xs shadow-inner"
              />
            </div>

            {isLift ? (
              <div>
                <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">
                  Dauer (Stunden)
                </label>
                <div className="flex items-center gap-1">
                  {['1', '2', '3', '4', '5'].map(h => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onDurationChange(h)}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        currentDuration === h 
                          ? 'bg-primary text-white border-primary shadow-xs' 
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary/50'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-[9px] text-slate-400 font-bold uppercase mb-1">
                  Schnell-Zeitfenster
                </label>
                <select
                  value={currentTime}
                  onChange={(e) => onTimeChange(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white text-xs"
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

          {/* Live Preview Badge */}
          {isLift && currentTime && (
            <div className="p-2 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-950 dark:text-blue-200 text-[11px] font-bold flex items-center justify-between">
              <span>Geplanter Einsatz {locKey.toUpperCase()}:</span>
              <span className="font-headline text-primary font-extrabold">
                {currentTime} - {endTimeCalc} Uhr ({currentDuration} Std.)
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto my-2.5 sm:hidden cursor-grab" />

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
        {saveSuccess ? (
          <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <CheckCircleIcon className="w-6 h-6" />
            </div>

            <div className="space-y-0.5 max-w-sm">
              <h4 className="font-headline font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                Termin im System gespeichert!
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Verbindlich in der Datenbank hinterlegt. Sie können den Termin jetzt exportieren oder per WhatsApp teilen.
              </p>
            </div>

            {/* Saved Appointment Summary Card */}
            <div className="w-full max-w-sm p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-left space-y-2 shadow-xs text-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200 pb-1.5 border-b border-slate-200 dark:border-slate-700">
                <span className="flex items-center gap-1.5 text-primary">
                  <CalendarDaysIcon className="w-3.5 h-3.5" />
                  <span>{getTaskTitle()}</span>
                </span>
                <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                  Gespeichert
                </span>
              </div>

              {(isLift || isHV) ? (
                <div className="space-y-1.5 text-xs">
                  {location !== 'b' && (
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-1">
                          <BuildingOfficeIcon className="w-3.5 h-3.5 text-primary" />
                          <span>Auszug (A)</span>
                        </span>
                        <span className="text-primary font-mono">{timeA || '08:00'} Uhr{isLift ? ` (${durationA}h)` : ''}</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                        {dateA ? new Date(dateA).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Termin folgt'}
                      </p>
                    </div>
                  )}

                  {location !== 'a' && (
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-1">
                          <HomeIcon className="w-3.5 h-3.5 text-primary" />
                          <span>Einzug (B)</span>
                        </span>
                        <span className="text-primary font-mono">{timeB || '13:00'} Uhr{isLift ? ` (${durationB}h)` : ''}</span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                        {dateB ? new Date(dateB).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Termin folgt'}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase">Datum</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-xs">
                      {date ? new Date(date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'TBA'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold uppercase">Uhrzeit / Zeitfenster</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-xs">
                      {time || 'Keine feste Uhrzeit'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Follow-up Actions Section */}
            <div className="w-full max-w-sm space-y-2 pt-0.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">
                Verfügbare Aktionen für diesen Termin
              </p>

              {/* 1. In Kalender eintragen */}
              <button
                type="button"
                onClick={handleExportToCalendar}
                className="w-full p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 transition-all text-left flex items-center justify-between group cursor-pointer shadow-xs active:scale-98"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <CalendarDaysIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-headline font-bold text-xs text-blue-950 dark:text-white flex items-center gap-1">
                      <span>In Smartphone-Kalender eintragen</span>
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-blue-200/60 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">.ics</span>
                    </div>
                    <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80">
                      {calendarExported ? '✓ In Kalender exportiert' : 'Für Samsung, Outlook & Smartphone'}
                    </p>
                  </div>
                </div>
                <ArrowRightIcon className="w-3.5 h-3.5 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
              </button>

              {/* 2. WhatsApp Nachricht */}
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="w-full p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 transition-all text-left flex items-center justify-between group cursor-pointer shadow-xs active:scale-98"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ChatBubbleLeftRightIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-headline font-bold text-xs text-emerald-950 dark:text-white flex items-center gap-1">
                      <span>Kunde per WhatsApp informieren</span>
                    </div>
                    <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                      {whatsAppSent ? '✓ WhatsApp geöffnet' : 'Terminbestätigung direkt an den Kunden'}
                    </p>
                  </div>
                </div>
                <ArrowRightIcon className="w-3.5 h-3.5 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">

            {/* Existing Scheduled Date Notice */}
            {hasSavedInDb && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-slate-600 dark:text-slate-300">
                    Bereits im System gespeichert
                  </span>
                </div>
                {!isDirty && (
                  <button
                    type="button"
                    onClick={() => setSaveSuccess(true)}
                    className="text-primary hover:underline font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <span>Kalender &amp; WhatsApp Aktionen</span>
                    <ArrowRightIcon className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Location Selector (A vs B vs Both) for Möbellift and HVZ */}
          {(isLift || isHV) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4 text-primary" />
                  <span>Einsatzort festlegen</span>
                </label>
                {location === 'both' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    Beide Adressen aktiv (A &amp; B)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setLocation('a')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    location === 'a' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <BuildingOfficeIcon className="w-4 h-4 text-primary shrink-0" />
                      <span>Auszugsort (A)</span>
                    </span>
                    {location === 'a' && <CheckIcon className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {addressA || 'Adresse A'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setLocation('b')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    location === 'b' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <HomeIcon className="w-4 h-4 text-primary shrink-0" />
                      <span>Einzugsort (B)</span>
                    </span>
                    {location === 'b' && <CheckIcon className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    {addressB || 'Adresse B'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setLocation('both')}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    location === 'both' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' 
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ArrowPathIcon className="w-4 h-4 text-primary shrink-0" />
                      <span>Beide Orte (A &amp; B)</span>
                    </span>
                    {location === 'both' && <CheckIcon className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 truncate">
                    Auszug &amp; Einzug
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
                  <BuildingOfficeIcon className="w-4 h-4" />
                  <span>Externe Firma</span>
                </button>
              </div>
            </div>
          )}

          {/* Viewing Type Selector (Vor-Ort vs Video / Online) */}
          {isViewing && (
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">visibility</span>
                <span>Art der Besichtigung</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setViewingType('vor_ort')}
                  className={`p-3 rounded-2xl border text-left transition-all text-xs font-bold flex items-center gap-2 ${
                    viewingType === 'vor_ort' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <HomeIcon className="w-4 h-4 shrink-0" />
                  <span>Vor-Ort-Besichtigung</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingType('online')}
                  className={`p-3 rounded-2xl border text-left transition-all text-xs font-bold flex items-center gap-2 ${
                    viewingType === 'online' 
                      ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30' 
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-base shrink-0">videocam</span>
                  <span>Video / Online</span>
                </button>
              </div>
            </div>
          )}

          {/* DUAL LOCATION SCHEDULING (For Möbellift and HVZ) */}
          {(isLift || isHV) ? (
            <div className="space-y-3">
              {/* If both is selected, show mobile-friendly tab switcher */}
              {location === 'both' ? (
                <>
                  {/* Segmented Dual-Location Switcher */}
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setActiveDualTab('a')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        activeDualTab === 'a'
                          ? 'bg-white dark:bg-slate-900 text-primary shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <BuildingOfficeIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>1. Auszug (A)</span>
                      {timeA && <span className="text-[10px] font-normal opacity-80 font-mono">({timeA})</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDualTab('b')}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        activeDualTab === 'b'
                          ? 'bg-white dark:bg-slate-900 text-primary shadow-xs ring-1 ring-slate-200 dark:ring-slate-700'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <HomeIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>2. Einzug (B)</span>
                      {timeB && <span className="text-[10px] font-normal opacity-80 font-mono">({timeB})</span>}
                    </button>
                  </div>

                  {/* Active Location Card */}
                  {activeDualTab === 'a' ? (
                    renderLocationScheduleBox(
                      'a',
                      '1. Einsatz Auszugsort (A)',
                      'Start der Beladung',
                      addressA,
                      dateA,
                      setDateA,
                      timeA,
                      setTimeA,
                      durationA,
                      setDurationA,
                      endTimePreviewA,
                      'border-primary/40'
                    )
                  ) : (
                    renderLocationScheduleBox(
                      'b',
                      '2. Einsatz Einzugsort (B)',
                      'Entladung am Zielort',
                      addressB,
                      dateB,
                      setDateB,
                      timeB,
                      setTimeB,
                      durationB,
                      setDurationB,
                      endTimePreviewB,
                      'border-blue-400/50'
                    )
                  )}

                  {/* Sleek Compact Overview of both */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <BuildingOfficeIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-bold">Auszug (A):</span>
                      <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {dateA ? new Date(dateA).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : 'TBA'} {timeA && `(${timeA}${isLift ? `-${endTimePreviewA}` : ''})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <HomeIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="font-bold">Einzug (B):</span>
                      <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                        {dateB ? new Date(dateB).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : 'TBA'} {timeB && `(${timeB}${isLift ? `-${endTimePreviewB}` : ''})`}
                      </span>
                    </div>
                  </div>
                </>
              ) : location === 'b' ? (
                /* Only Einzugsort (B) */
                renderLocationScheduleBox(
                  'b',
                  'Einsatz Einzugsort (B)',
                  'Einzugsadresse',
                  addressB,
                  dateB,
                  setDateB,
                  timeB,
                  setTimeB,
                  durationB,
                  setDurationB,
                  endTimePreviewB,
                  'border-primary/40'
                )
              ) : (
                /* Only Auszugsort (A) */
                renderLocationScheduleBox(
                  'a',
                  'Einsatz Auszugsort (A)',
                  'Auszugsadresse',
                  addressA,
                  dateA,
                  setDateA,
                  timeA,
                  setTimeA,
                  durationA,
                  setDurationA,
                  endTimePreviewA,
                  'border-primary/40'
                )
              )}
            </div>
          ) : (
            /* STANDARD SINGLE LOCATION TASKS (Kartons, Viewing) */
            <div className="space-y-4">
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
                  {isKarton && (
                    <button 
                      type="button"
                      onClick={() => applyRelativeMoveDays('single', 21)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500 hover:text-white transition-all border border-orange-500/20"
                    >
                      3 Wochen vor Umzug
                    </button>
                  )}
                  <button 
                    type="button"
                    onClick={() => applyRelativeDays('single', 1)}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white transition-all text-slate-600 dark:text-slate-300"
                  >
                    Morgen
                  </button>
                  <button 
                    type="button"
                    onClick={() => applyRelativeDays('single', 3)}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-primary hover:text-white transition-all text-slate-600 dark:text-slate-300"
                  >
                    In 3 Tagen
                  </button>
                </div>
              </div>

              {/* Section 2: Uhrzeit / Zeitfenster */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-primary" />
                  <span>Uhrzeit / Zeitfenster</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                      Uhrzeit
                    </label>
                    <input 
                      type="time" 
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary text-sm shadow-inner"
                    />
                  </div>

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
                </div>
              </div>
            </div>
          )}

        </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 flex-wrap">
          {saveSuccess ? (
            <>
              <button
                type="button"
                onClick={() => setSaveSuccess(false)}
                className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
              >
                Termin anpassen
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer ml-auto"
              >
                <CheckIcon className="w-4 h-4" />
                <span>Fertig &amp; Schließen</span>
              </button>
            </>
          ) : (
            <>
              <div className="text-[11px] text-slate-500 font-medium">
                {isDirty && hasSavedInDb ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5 text-xs">
                    <ExclamationTriangleIcon className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>Ungespeicherte Änderungen</span>
                  </span>
                ) : hasSavedInDb && !isDirty ? (
                  <button
                    type="button"
                    onClick={() => setSaveSuccess(true)}
                    className="text-primary hover:underline font-bold text-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>✓ Gespeichert (Aktionen anzeigen)</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span>Termin festlegen &amp; im System speichern</span>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <CheckIcon className="w-4 h-4" />
                  <span>{isSaving ? 'Speichern...' : 'Termin speichern'}</span>
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
