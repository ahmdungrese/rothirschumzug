"use client";

import { useEffect, useRef } from 'react';

/**
 * Universal safe hook for keyboard (Escape key) dismissal in Modals, Drawers, and Overlays.
 * Note: Does NOT manipulate window.history to prevent conflicts with Next.js router and React StrictMode
 * which previously caused all modals to self-close immediately upon opening.
 */
export function useModalBackHandler(
  isOpen: boolean,
  onClose: () => void,
  modalId: string = 'app-modal'
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (typeof window === 'undefined' || !isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);
}
