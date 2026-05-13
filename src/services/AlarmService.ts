/**
 * AlarmService — Manages scheduling and cancelling alarm notifications using Notifee
 *
 * **NEW IMPLEMENTATION (Using Notifee + Android AlarmManager)**
 *
 * Responsible for:
 * - Requesting notification permission before scheduling
 * - Creating the Android "alarm" notification channel with bypassDnd and MAX importance
 * - **Using Notifee's timeTrigger for reliable native AlarmManager scheduling**
 * - Cancelling any previously scheduled alarm before scheduling a new one
 * - Supporting a linear volume ramp from 0 → 1 over ALARM_RAMP_SECONDS
 *
 * **WHY NOTIFEE?**
 * - Uses Android's native AlarmManager (not JS timers that get paused)
 * - Works reliably even when app is closed or screen is off
 * - Handles Redmi/Xiaomi battery optimization correctly
 * - Provides automatic wake-up when alarm fires
 *
 * Used by:
 * - MonitoringScreen: scheduleAlarm() when nap monitoring starts (max fall-asleep timeout)
 * - SleepingScreen: scheduleAlarm() when the countdown starts, cancelAlarm() on unmount
 * - WakeScreen: cancelAll() when the user has woken up
 *
 * Notes:
 * - Notifee is production-ready and used by major apps
 * - Uses native code (automatically included with EAS build)
 * - Replaces expo-notifications for alarm scheduling (keeps expo-notifications for other notifications)
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { Platform } from 'react-native';
import notifee, { AndroidCategory, AndroidImportance, TimestampTrigger, TriggerType } from '@notifee/react-native';
import { ALARM_RAMP_SECONDS, SNOOZE_MINUTES } from '../constants/config';
import { Strings } from '../constants/strings';
import type { WakeAlarmIntent } from './WakeFlowService';
import { wakeFlowService } from './WakeFlowService';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const ALARM_CHANNEL_ID = 'alarm-channel';
const ALARM_NOTIFICATION_ID = 'alarm-notification';

// ─────────────────────────────────────────
// Class Definition
// ─────────────────────────────────────────

class AlarmService {
  private scheduledId: string | null = null;

  /**
   * Initialize the alarm service
   * - Creates notification channel on Android
   * - Requests permissions
   * Should be called once on app startup
   */
  async initialize(): Promise<void> {
    if (Platform.OS === 'android') {
      await this.createNotificationChannel();
    }
    await this.requestPermission();
  }

  /**
   * Creates the Android notification channel for alarms
   * Uses maximum importance and bypasses DND
   */
  private async createNotificationChannel(): Promise<void> {
    try {
      await notifee.createChannel({
        id: ALARM_CHANNEL_ID,
        name: 'Sleep Alarm',
        importance: 5 as any, // AndroidImportance.MAX (5 = highest importance for Android)
        sound: 'alarm', // References alarm.wav
        vibration: true,
        vibrationPattern: [0, 500, 250, 500],
        bypassDnd: true,
        lightColor: '#6c63ff',
      });
    } catch (error) {
      console.error('Failed to create alarm channel:', error);
    }
  }

  /**
   * Requests notification permission from the user
   * @returns true if permission is granted
   */
  async requestPermission(): Promise<boolean> {
    try {
      const result = await notifee.requestPermission();
      return (
        result.authorizationStatus === 1 || // AUTHORIZED
        result.authorizationStatus === 2    // PROVISIONAL
      );
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }

  /**
   * Schedules an alarm notification after delayMinutes minutes
   * Uses native Android AlarmManager for reliable background scheduling
   * @param delayMinutes - Number of minutes before the alarm fires
   * @returns The scheduled notification ID, or null if failed
   */
  async scheduleAlarm(delayMinutes: number, wakeIntent?: WakeAlarmIntent): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.warn('Notification permission not granted');
        return null;
      }

      // Cancel any existing alarm first
      await this.cancelAlarm();

      // Calculate trigger time (now + delayMinutes)
      const triggerTime = Date.now() + delayMinutes * 60 * 1000;

      // Schedule notification using Notifee (uses native AlarmManager)
      const notificationId = await notifee.getTriggerNotificationIds();
      
      await notifee.createTriggerNotification(
        {
          title: Strings.alarm_notification_title,
          body: Strings.alarm_notification_body(delayMinutes),
          data: wakeIntent ? { wakeIntent: JSON.stringify(wakeIntent) } : undefined,
          android: {
            channelId: ALARM_CHANNEL_ID,
            sound: 'alarm', // Will play the alarm.wav sound
            category: AndroidCategory.ALARM,
            importance: AndroidImportance.HIGH,
            pressAction: {
              id: 'default',
            },
            fullScreenAction: {
              id: 'wake-full-screen',
            },
            actions: [
              {
                title: 'Dismiss',
                pressAction: {
                  id: 'dismiss',
                },
              },
            ],
            asForegroundService: false, // Notification only, not a foreground service
          },
        },
        {
          type: TriggerType.TIMESTAMP,
          timestamp: triggerTime, // Native AlarmManager will wake app at this time
        } as TimestampTrigger
      );

      this.scheduledId = ALARM_NOTIFICATION_ID;
      const fireTime = new Date(triggerTime).toLocaleTimeString();
      console.log(`⏰ ALARM SCHEDULED: ${delayMinutes} min from now (fires at ${fireTime})`);
      if (wakeIntent) {
        console.log(`   └─ Intent: ${wakeIntent.kind}`);
      }
      return ALARM_NOTIFICATION_ID;
    } catch (error) {
      console.error('Failed to schedule alarm:', error);
      return null;
    }
  }

  async scheduleSnooze(): Promise<string | null> {
    return this.scheduleAlarm(SNOOZE_MINUTES);
  }

  /**
   * Cancels the previously scheduled notification (if any)
   * Works reliably even for native AlarmManager scheduled alarms
   */
  async cancelAlarm(): Promise<void> {
    try {
      if (this.scheduledId) {
        await notifee.cancelTriggerNotification(this.scheduledId);
        this.scheduledId = null;
        await wakeFlowService.clearPendingWakeIntent();
        console.log('⏰ ALARM CANCELLED');
      }
    } catch (error) {
      console.error('Failed to cancel alarm:', error);
    }
  }

  async cancelAll(): Promise<void> {
    try {
      const ids = await notifee.getTriggerNotificationIds();
      for (const id of ids) {
        await notifee.cancelTriggerNotification(id);
      }
      this.scheduledId = null;
      console.log('⏰ ALL ALARMS CANCELLED');
    } catch (error) {
      console.error('Failed to cancel all alarms:', error);
    }
  }

  /**
   * Starts a linear volume ramp from 0 → 1 over ALARM_RAMP_SECONDS seconds
   * @param onVolumeChange - Callback that receives the new volume each second
   * @param onComplete - Callback when maximum volume is reached
   * @returns A cleanup function to stop the ramp when needed
   */
  startGradualRamp(
    onVolumeChange: (volume: number) => void,
    onComplete: () => void
  ): () => void {
    const steps = ALARM_RAMP_SECONDS;
    const intervalMs = 1000;
    let currentStep = 0;

    const id = setInterval(() => {
      currentStep++;
      const volume = Math.min(currentStep / steps, 1.0);
      onVolumeChange(volume);
      if (currentStep >= steps) {
        clearInterval(id);
        onComplete();
      }
    }, intervalMs);

    return () => clearInterval(id);
  }

  get isScheduled(): boolean {
    return this.scheduledId !== null;
  }
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const alarmService = new AlarmService();
