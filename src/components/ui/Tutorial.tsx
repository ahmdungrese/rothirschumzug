"use client";

import { useEffect, useState } from 'react';
import { Joyride, Step, STATUS } from 'react-joyride';

export function Tutorial() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Only run if the user is in Demo Mode
    if (typeof window !== 'undefined') {
      const isDemoMode = localStorage.getItem('demoMode') === 'true';
      if (!isDemoMode) {
        return; // Don't show tutorial for real users!
      }

      const hasSeenTutorial = localStorage.getItem('rothirsch_tutorial_completed');
      if (!hasSeenTutorial) {
        // Small delay to let the UI render completely
        setTimeout(() => {
          setRun(true);
          // Direkt als gesehen markieren, damit es bei einem Refresh nicht jedes Mal neu startet!
          localStorage.setItem('rothirsch_tutorial_completed', 'true');
        }, 1000);
      }
    }
  }, []);

  const steps: Step[] = [
    {
      target: 'body',
      placement: 'center',
      content: 'Willkommen bei Rothirsch Umzüge! Wir zeigen Ihnen kurz die wichtigsten Funktionen Ihres neuen Dashboards.',
    },
    {
      target: '#nav-dashboard',
      content: 'Hier finden Sie eine Übersicht der aktuellen Woche und wichtige KPIs.',
    },
    {
      target: '#nav-orders',
      content: 'Unter Aufträge & Disposition verwalten Sie alle Angebote, weisen Fahrzeuge und Mitarbeiter zu und erstellen Rechnungen.',
    },
    {
      target: '#nav-calendar',
      content: 'Im Kalender sehen Sie alle Termine. Rote Blocker (z.B. für Halteverbote) werden automatisch aus den Aufträgen hier eingetragen.',
    },
    {
      target: '#nav-finances',
      content: 'Unter Finanzen behalten Sie den Überblick über Zahlungen und Mahnwesen.',
    },
    {
      target: '#bell-icon',
      content: 'Wichtig: Hier finden Sie automatisch generierte ToDos für jeden Auftrag (z.B. Halteverbote beantragen oder Kartons ausliefern).',
    },
    {
      target: '#demo-reset-btn', // We will add this to settings or dashboard
      content: 'Sie befinden sich im Demo-Modus. Über diesen Knopf in den Einstellungen können Sie die Datenbank jederzeit zurücksetzen.',
    }
  ];

  return (
    // @ts-ignore
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      scrollToFirstStep={true}
      styles={({
        options: {
          primaryColor: '#e0592a', // Primary orange color of Rothirsch
          textColor: '#333',
          zIndex: 10000,
        }
      }) as any}
      locale={{
        back: 'Zurück',
        close: 'Schließen',
        last: 'Fertig',
        next: 'Weiter',
        skip: 'Überspringen',
      }}
    />
  );
}
