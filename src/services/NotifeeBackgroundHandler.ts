/**
 * NotifeeBackgroundHandler — Handles background notification events from Notifee
 *
 * Responsible for:
 * - Listening to notification events even when app is in background/closed
 * - Handling user interactions with the alarm notification
 * - The notification sound is played automatically by Android notification system
 *
 * How it works:
 * - Notifee fires the alarm at the scheduled time using native AlarmManager
 * - Android automatically plays the alarm.wav sound defined in the notification
 * - This handler responds to user interactions (dismiss, open, etc.)
 * - When user opens the app, the screen can handle additional audio playback
 *
 * Used by:
 * - App.tsx: notifeeBackgroundHandler.setupListeners() on app startup
 */

import notifee, { EventType } from '@notifee/react-native';
import { wakeFlowService } from './WakeFlowService';

class NotifeeBackgroundHandler {
  private isListenerSetup = false;

  /**
   * Sets up foreground and background notification event listeners
   * Must be called once from App.tsx
   */
  setupListeners(): void {
    if (this.isListenerSetup) return;
    this.isListenerSetup = true;

    // Listen to foreground notifications (app open or in background)
    notifee.onForegroundEvent(({ type, detail }) => {
      void this.handleNotificationEvent(type, detail);
    });

    // Listen to background notifications (when user taps notification or alarm fires while app closed)
    notifee.onBackgroundEvent(async ({ type, detail }) => {
      await this.handleNotificationEvent(type, detail);
    });

    console.log('✓ Notifee background handlers setup complete');
  }

  /**
   * Handles all notification events
   */
  private async handleNotificationEvent(type: EventType, detail: any): Promise<void> {
    const { notification, pressAction } = detail;

    if (type === EventType.DELIVERED) {
      await this.handleAlarmDelivered(notification);
    }

    // When the notification is delivered to the device
    if (type === EventType.DELIVERED) {
      console.log('🔔 Alarm notification displayed (foreground)');
      console.log('🔊 Android notification system is playing alarm sound');
    }

    // When user opens the notification (app was closed or in background)
    if (type === EventType.PRESS) {
      console.log('👆 User opened alarm notification');
      this.onAlarmOpened();
    }

    // When user presses an action button on the notification
    if (type === EventType.ACTION_PRESS) {
      const pressActionId = pressAction?.id;
      
      if (pressActionId === 'dismiss') {
        console.log('❌ User dismissed alarm');
        this.onAlarmDismissed();
      }
    }
  }

  private async handleAlarmDelivered(notification: any): Promise<void> {
    try {
      const rawIntent = notification?.data?.wakeIntent;
      if (!rawIntent || typeof rawIntent !== 'string') return;

      const parsed = JSON.parse(rawIntent);
      await wakeFlowService.queuePendingWakeIntent(parsed);
      await wakeFlowService.consumePendingWakeIntent();
      console.log('✓ Wake intent queued from delivered alarm notification');
    } catch (error) {
      console.error('Failed handling delivered alarm notification:', error);
    }
  }

  /**
   * Called when user taps the alarm notification
   */
  private onAlarmOpened(): void {
    try {
      console.log('ℹ️ Alarm notification opened - app has been brought to foreground');
      // The relevant screen will handle the audio and user interaction
    } catch (error) {
      console.error('Error in onAlarmOpened:', error);
    }
  }

  /**
   * Called when user dismisses the notification
   */
  private onAlarmDismissed(): void {
    try {
      console.log('✓ Alarm dismissed by user');
    } catch (error) {
      console.error('Error in onAlarmDismissed:', error);
    }
  }
}

export const notifeeBackgroundHandler = new NotifeeBackgroundHandler();
