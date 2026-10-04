"use client";

/**
 * Universal Mobile & Desktop Modal Stack History Manager.
 * 
 * Solves the critical mobile UX challenge:
 * When a user on a mobile device (Android hardware back, iOS swipe-back, or browser back button)
 * presses Back while a Modal or Drawer is open:
 * 1. It closes the topmost Modal or Drawer instead of navigating away to another route or dashboard.
 * 2. It supports nested modals (e.g. a confirm dialog or shopping list on top of an order drawer).
 * 3. It is 100% immune to React StrictMode remounts and re-render cycles (zero self-closing bugs).
 * 4. It cleanly cleans up pushed history states when a modal is closed via UI buttons (X or Cancel).
 */

type ModalEntry = {
  id: string;
  close: () => void;
};

class ModalManager {
  private stack: ModalEntry[] = [];
  private isSilentBack = false;
  private pendingUnregisters = new Map<string, NodeJS.Timeout>();
  private isInitialized = false;
  private isNavigating = false;

  private init() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    // Global navigation detection: If a link is clicked inside any modal/drawer, prepare navigation
    window.addEventListener('click', (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('a');
      if (target && target.href && !target.href.startsWith('#') && !target.target) {
        if (this.hasOpenModals()) {
          this.prepareNavigation();
        }
      }
    }, true);

    // Listen to browser / mobile hardware back button
    window.addEventListener('popstate', (e: PopStateEvent) => {
      // If we triggered this back programmatically to clean up history, ignore it
      if (this.isSilentBack) {
        this.isSilentBack = false;
        return;
      }

      // If we have open modals on the stack, the mobile back button closes the top modal
      if (this.stack.length > 0) {
        const topModal = this.stack.pop();
        if (topModal) {
          try {
            topModal.close();
          } catch (err) {
            console.error('Error closing modal on popstate:', err);
          }

          // If there are still modals underneath (nested modals), push a state so the next back
          // press closes the next modal down rather than leaving the page
          if (this.stack.length > 0 && !window.history.state?.rothirschModal) {
            try {
              window.history.pushState({ rothirschModal: true }, '');
            } catch {}
          }
        }
      }
    });

    // Desktop Escape key support
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.stack.length > 0) {
        const topModal = this.stack[this.stack.length - 1];
        if (topModal) {
          topModal.close();
        }
      }
    });
  }

  register(id: string, close: () => void) {
    if (typeof window === 'undefined') return () => {};
    this.init();

    // Cancel any pending unregister for this modal ID (e.g. during React StrictMode remount)
    const pendingTimer = this.pendingUnregisters.get(id);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.pendingUnregisters.delete(id);
    }

    // If already registered, update the close callback without touching history
    const existingIndex = this.stack.findIndex(m => m.id === id);
    if (existingIndex !== -1) {
      this.stack[existingIndex].close = close;
      return () => this.unregister(id);
    }

    // Push state ONLY if this is the first modal opening and state doesn't already have rothirschModal
    if (this.stack.length === 0) {
      if (!window.history.state?.rothirschModal) {
        try {
          window.history.pushState({ rothirschModal: true, modalId: id }, '');
        } catch {}
      }
    }

    this.stack.push({ id, close });

    return () => this.unregister(id);
  }

  /**
   * Prepares modal manager for a route transition.
   * Cancels any pending history.back() calls so the browser does not revert or abort the navigation.
   */
  prepareNavigation() {
    this.isNavigating = true;
    this.stack = [];
    this.pendingUnregisters.forEach(timer => clearTimeout(timer));
    this.pendingUnregisters.clear();

    setTimeout(() => {
      this.isNavigating = false;
    }, 1000);
  }

  unregister(id: string) {
    if (typeof window === 'undefined') return;

    // Clear any previous pending timer
    const prevTimer = this.pendingUnregisters.get(id);
    if (prevTimer) {
      clearTimeout(prevTimer);
    }

    // Debounce unregister slightly (60ms) to allow React StrictMode and micro-tasks to settle
    const timer = setTimeout(() => {
      this.pendingUnregisters.delete(id);

      // If a route navigation is currently in flight, never revert history backwards
      if (this.isNavigating) {
        return;
      }

      const index = this.stack.findIndex(m => m.id === id);
      if (index !== -1) {
        this.stack.splice(index, 1);
      }

      // If all modals are closed programmatically (via UI click, not popstate),
      // cleanly revert the pushed history entry
      if (this.stack.length === 0 && window.history.state?.rothirschModal) {
        this.isSilentBack = true;
        try {
          window.history.back();
        } catch {
          this.isSilentBack = false;
        }

        // Safety fallback to reset flag
        setTimeout(() => {
          this.isSilentBack = false;
        }, 150);
      }
    }, 60);

    this.pendingUnregisters.set(id, timer);
  }

  hasOpenModals(): boolean {
    return this.stack.length > 0;
  }
}

export const modalManager = new ModalManager();
