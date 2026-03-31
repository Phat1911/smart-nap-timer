import { Platform } from 'react-native';
import { ALARM_RAMP_SECONDS, SNOOZE_MINUTES } from '../constants/config';

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

class AlarmService {
  private scheduledId: string | null = null;

  async requestPermission(): Promise<boolean> {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  async scheduleAlarm(delayMinutes: number): Promise<string | null> {
    const hasPermission = await this.requestPermission();
    if (!hasPermission) return null;

    await this.cancelAlarm();

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
        title: 'Wake up!',
        body: `Your ${delayMinutes}-minute nap is complete.`,
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

  async cancelAlarm(): Promise<void> {
    if (this.scheduledId) {
      await Notifications.cancelScheduledNotificationAsync(this.scheduledId);
      this.scheduledId = null;
    }
  }

  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    this.scheduledId = null;
  }

  // Gradual volume ramp -- call this when alarm fires in-app
  // Returns a cleanup function
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

export const alarmService = new AlarmService();
