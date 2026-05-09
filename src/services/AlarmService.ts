/**
 * AlarmService — Manages scheduling and cancelling alarm notifications
 *
 * Responsible for:
 * - Requesting notification permission before scheduling
 * - Creating the Android "alarm" notification channel with bypassDnd and MAX importance
 * - Scheduling a notification with a TIME_INTERVAL trigger (delayMinutes * 60 seconds)
 * - Cancelling any previously scheduled alarm before scheduling a new one
 * - Supporting a linear volume ramp from 0 → 1 over ALARM_RAMP_SECONDS
 *
 * Used by:
 * - SleepingScreen: scheduleAlarm() when the countdown starts, cancelAlarm() on unmount
 * - WakeScreen: cancelAll() when the user has woken up
 *
 * Notes:
 * - expo-notifications is NOT supported in Expo Go (SDK 53+)
 *   — a mock is used in __DEV__ to avoid crashes
 * - 'alarm.wav' must be in assets and declared in app.json plugins
 *   to be bundled into the Android/iOS build
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { Platform, NativeModules } from 'react-native';
import { ALARM_RAMP_SECONDS, SNOOZE_MINUTES } from '../constants/config';
import { Strings } from '../constants/strings';

// expo-notifications is NOT supported in Expo Go (SDK 53+).
// In __DEV__ (Expo Go) all notification calls are mocked to no-ops.
// In production EAS builds the real module is used.
let Notifications: any;

if (!__DEV__) {
  Notifications = require('expo-notifications');
  // Configure how notifications appear when app is foregrounded
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} else {
  // Dev mock -- all methods are silent no-ops
  Notifications = {
    requestPermissionsAsync:              async () => ({ status: 'granted' }),
    setNotificationChannelAsync:          async () => {},
    scheduleNotificationAsync:            async () => 'mock-id',
    cancelScheduledNotificationAsync:     async () => {},
    cancelAllScheduledNotificationsAsync: async () => {},
    AndroidImportance:             { MAX: 5 },
    AndroidNotificationPriority:   { MAX: 'max' },
    AndroidNotificationVisibility: { PUBLIC: 1 },
    SchedulableTriggerInputTypes:  { TIME_INTERVAL: 'timeInterval' },
  };
}

// ─────────────────────────────────────────
// Class Definition
// ─────────────────────────────────────────

class AlarmService {
  private scheduledId: string | null = null;

  /**
   * Requests notification permission from the user
   * @returns true if permission is granted
   */
  async requestPermission(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Schedules an alarm notification after delayMinutes minutes
   * @param delayMinutes - Number of minutes before the alarm fires
   * @returns The scheduled notification ID, or null if permission is not granted
   */
  async scheduleAlarm(delayMinutes: number): Promise<string | null> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return null;
    await this.cancelAlarm();

    // Prefer native AlarmManager on Android (fires even if app is killed).
    if (Platform.OS === 'android' && NativeModules.NativeAlarm) {
      try {
        await NativeModules.NativeAlarm.scheduleExactAlarm(delayMinutes);
        this.scheduledId = 'native';
        return this.scheduledId;
      } catch (e) {
        // fall back to expo-notifications below
      }
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alarm', {
        name: 'Sleep Alarm',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        sound: 'alarm.wav',
        bypassDnd: true,
        lockscreenVisibility:
          Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: Strings.alarm_notification_title,
        body: Strings.alarm_notification_body(delayMinutes),
        sound: 'alarm.wav',
        priority: Notifications.AndroidNotificationPriority.MAX,
        categoryIdentifier: 'alarm',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delayMinutes * 60,
        repeats: false,
      },
    });

    this.scheduledId = id;
    return id;
  }

  async scheduleSnooze(): Promise<string | null> {
    return this.scheduleAlarm(SNOOZE_MINUTES);
  }

  /**
   * Cancels the previously scheduled notification (if any)
   */
  async cancelAlarm(): Promise<void> {
    if (!this.scheduledId) return;
    if (this.scheduledId === 'native' && NativeModules.NativeAlarm) {
      try {
        await NativeModules.NativeAlarm.cancelAlarm();
      } catch {
        // ignore
      }
      this.scheduledId = null;
      return;
    }
    try {
      await Notifications.cancelScheduledNotificationAsync(this.scheduledId);
    } catch {
      // ignore
    }
    this.scheduledId = null;
  }

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    this.scheduledId = null;
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
