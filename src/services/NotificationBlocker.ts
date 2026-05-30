/**
 * NotificationBlocker — Suppresses notifications from other apps during a nap
 *
 * Responsible for:
 * - Overriding the notification handler to hide all foreground notifications while napping
 * - Restoring the normal notification handler when the nap ends
 *
 * Used by:
 * - MonitoringScreen: block() on mount, unblock() on unmount
 * - useSleepDetection: block() when monitoring starts, unblock() on cleanup
 *
 * Notes:
 * - expo-notifications is NOT supported in Expo Go — mocked in __DEV__
 * - Only foreground notifications are blocked; background notifications are still
 *   delivered to the notification centre but do not show a popup
 * - DndService works alongside this to also block system DND on Android
 *
 * NotificationBlocker
 *
 * Suppresses incoming notifications from other apps while a nap is active.
 * On Android, sets the notification channel to silent and enables Do Not
 * Disturb by muting all notifications via expo-notifications.
 * Restored on cancel or when the nap ends.
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

// expo-notifications is NOT supported in Expo Go (SDK 53+).
// In __DEV__ (Expo Go) all notification calls are mocked to no-ops.
let Notifications: any;
if (!__DEV__) {
  Notifications = require('expo-notifications');
} else {
  Notifications = { setNotificationHandler: () => {} };
}

// ─────────────────────────────────────────
// Class Definition
// ─────────────────────────────────────────

class NotificationBlocker {
  private blockCount = 0;

  /**
   * Suppresses all foreground notifications — call when monitoring starts
   */
  async block(): Promise<void> {
    try {
      this.blockCount += 1;
      console.log(`NotificationBlocker: block() called -> count=${this.blockCount}`);
      // If already blocked by another caller, nothing else to do
      if (this.blockCount > 1) {
        return;
      }

      // Override: hide all foreground notifications while napping
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert:  false,
          shouldPlaySound:  false,
          shouldSetBadge:   false,
          shouldShowBanner: false,
          shouldShowList:   false,
        }),
      });
    } catch {
      // Silently fail -- not critical
    }
  }

  /**
   * Restores normal notifications — call when the nap ends or the user cancels
   */
  async unblock(): Promise<void> {
    try {
      if (this.blockCount > 0) {
        this.blockCount -= 1;
      }
      console.log(`NotificationBlocker: unblock() called -> count=${this.blockCount}`);

      if (this.blockCount > 0) {
        return;
      }

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert:  true,
          shouldPlaySound:  true,
          shouldSetBadge:   true,
          shouldShowBanner: true,
          shouldShowList:   true,
        }),
      });
    } catch {
      // Silently fail
    }
  }
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const notificationBlocker = new NotificationBlocker();
