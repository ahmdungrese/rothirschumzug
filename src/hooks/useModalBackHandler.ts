"use client";

import { useEffect, useRef } from 'react';
import { modalManager } from '@/lib/modalManager';

/**
 * Universal safe hook for mobile hardware back button, swipe-back gesture,
 * and keyboard (Escape key) dismissal in Modals, Drawers, and Overlays.
 * 
 * Powered by centralized modalManager:
 * - Captures mobile Back button and closes the modal instead of navigating away.
 * - Handles nested modals seamlessly.
 * - 100% immune to React StrictMode remounts and re-render loops (no self-closing bugs).
 * - Restores browser history state naturally when modal closes.
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

    const unregister = modalManager.register(modalId, () => {
      onCloseRef.current();
    });

    return () => {
      unregister();
    };
  }, [isOpen, modalId]);
}
