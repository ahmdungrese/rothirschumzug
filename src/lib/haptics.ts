/**
 * Haptic Feedback utility for mobile touch devices
 * Uses the Web Vibration API (navigator.vibrate) when supported.
 */

export type HapticType = 'light' | 'medium' | 'success' | 'warning' | 'error';

export function triggerHaptic(type: HapticType = 'light') {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(30);
        break;
      case 'success':
        navigator.vibrate([20, 35, 25]);
        break;
      case 'warning':
        navigator.vibrate([40, 50, 40]);
        break;
      case 'error':
        navigator.vibrate([50, 40, 50, 40, 50]);
        break;
    }
  } catch {
    // Graceful fallback on devices that block vibration
  }
}
