/**
 * Tasks 2.11–2.14 — usePermissions
 *
 * Checks and requests the permissions required for sleep detection:
 *   • Microphone  — needed by MicService for breathing detection
 *   • Notifications — needed by AlarmService to fire the wake alarm
 *
 * Motion sensors (Accelerometer / Gyroscope) do not require a runtime
 * permission prompt on Android (declared in AndroidManifest via app.json)
 * and on iOS CoreMotion access is granted automatically when the app reads
 * from the sensor; there is no requestPermissionsAsync in expo-sensors.
 *
 * Task 2.11 — iOS mic permission via expo-av Audio.requestPermissionsAsync()
 * Task 2.12 — Android mic permission via expo-av Audio.requestPermissionsAsync()
 * Task 2.13 — iOS notification permission via expo-notifications
 * Task 2.14 — Android notification permission via expo-notifications
 *
 * Usage:
 *   const { micGranted, notifGranted, allGranted, requesting, request } =
 *     usePermissions();
 */

import { useState, useEffect, useCallback } from 'react';
import { Audio } from 'expo-av';

// expo-notifications not supported in Expo Go (SDK 53+) -- mock in __DEV__
const Notifications = __DEV__
  ? { requestPermissionsAsync: async () => ({ status: 'granted' as const }) }
  : require('expo-notifications');

// ── Public types ──────────────────────────────────────────────────────────────

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export interface PermissionsState {
  /** expo-av microphone permission (tasks 2.11 / 2.12) */
  micStatus:    PermissionStatus;
  /** expo-notifications permission (tasks 2.13 / 2.14) */
  notifStatus:  PermissionStatus;
  /** true when both mic + notifications are granted */
  allGranted:   boolean;
  /** true while a permission request is in flight */
  requesting:   boolean;
  /** Re-run the permission request flow (e.g. after user taps "Try Again") */
  request:      () => Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePermissions(): PermissionsState {
  const [micStatus,   setMicStatus]   = useState<PermissionStatus>('undetermined');
  const [notifStatus, setNotifStatus] = useState<PermissionStatus>('undetermined');
  const [requesting,  setRequesting]  = useState(false);

  const request = useCallback(async () => {
    setRequesting(true);
    try {
      // ── Microphone (tasks 2.11 iOS / 2.12 Android) ─────────────────────
      // expo-av handles platform differences internally; on Android it maps
      // to the RECORD_AUDIO runtime permission (API 23+); on iOS it presents
      // the NSMicrophoneUsageDescription prompt.
      const micResult = await Audio.requestPermissionsAsync();
      setMicStatus(micResult.status === 'granted' ? 'granted' : 'denied');

      // ── Notifications (tasks 2.13 iOS / 2.14 Android) ──────────────────
      // On iOS this shows the native system alert; on Android 13+ it maps to
      // POST_NOTIFICATIONS.  On older Android it resolves to 'granted'
      // automatically since no runtime prompt was required.
      const notifResult = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true,
          allowCriticalAlerts: true,
        },
      });
      setNotifStatus(notifResult.status === 'granted' ? 'granted' : 'denied');
    } finally {
      setRequesting(false);
    }
  }, []);

  // Auto-request on mount
  useEffect(() => {
    request();
  // run once
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    micStatus,
    notifStatus,
    allGranted: micStatus === 'granted' && notifStatus === 'granted',
    requesting,
    request,
  };
}
