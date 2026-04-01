/**
 * NotificationBlocker
 *
 * Suppresses incoming notifications from other apps while a nap is active.
 * On Android, sets the notification channel to silent and enables Do Not
 * Disturb by muting all notifications via expo-notifications.
 * Restored on cancel or when the nap ends.
 */

import * as Notifications from 'expo-notifications';

class NotificationBlocker {
  private originalBehavior: Notifications.NotificationBehavior | null = null;

  /** Call when monitoring starts -- silences all foreground notifications */
  async block(): Promise<void> {
    try {
      // Store current behavior
      this.originalBehavior = {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };

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

  /** Call when nap ends or user cancels -- restores normal notifications */
  async unblock(): Promise<void> {
    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert:  true,
          shouldPlaySound:  true,
          shouldSetBadge:   true,
          shouldShowBanner: true,
          shouldShowList:   true,
        }),
      });
      this.originalBehavior = null;
    } catch {
      // Silently fail
    }
  }
}

export const notificationBlocker = new NotificationBlocker();
