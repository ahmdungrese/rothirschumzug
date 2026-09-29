"use client";

import { useEffect, useRef } from 'react';

/**
 * Universal hook for mobile and desktop browser back-button handling in Modals, Drawers, and Overlays.
 * 
 * Behavior:
 * 1. When a modal opens, it pushes a state to history so the browser recognizes the modal as a layer.
 * 2. When the user taps the mobile phone hardware back button, browser back button, or swipe-back gesture:
 *    the popstate event fires, closing the modal without leaving the current page.
 * 3. When the modal is closed programmatically (via (X) button, Backdrop, Cancel, or Submit),
 *    it cleans up the pushed history entry so navigation remains completely natural.
 */
export function useModalBackHandler(
  isOpen: boolean,
  onClose: () => void,
  modalId: string = 'app-modal'
) {
  const isPushedRef = useRef(false);
  const isClosingByPopstateRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (isOpen) {
      if (!isPushedRef.current) {
        window.history.pushState({ modalId, open: true }, '');
        isPushedRef.current = true;
      }

      const handlePopState = (e: PopStateEvent) => {
        if (isPushedRef.current) {
          isClosingByPopstateRef.current = true;
          isPushedRef.current = false;
          onCloseRef.current();
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        if (isPushedRef.current && !isClosingByPopstateRef.current) {
          isPushedRef.current = false;
          try {
            window.history.back();
          } catch {
            // Ignore
          }
        }
        isClosingByPopstateRef.current = false;
      };
    } else {
      if (isPushedRef.current && !isClosingByPopstateRef.current) {
        isPushedRef.current = false;
        try {
          window.history.back();
        } catch {
          // Ignore
        }
      }
      isClosingByPopstateRef.current = false;
    }
  }, [isOpen, modalId]);
}
