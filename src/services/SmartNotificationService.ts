/**
 * SmartNotificationService — Schedules habit-based smart nap reminder notifications
 *
 * Responsible for:
 * - Computing the user's most common nap hour from session history
 * - Cancelling the previous nudge before scheduling a new one (no stale notification accumulation)
 * - Scheduling a daily repeating notification at the computed hour
 * - Skipping if there are fewer than MIN_SESSIONS (3) sessions for a reliable pattern
 *
 * Used by:
 * - App.tsx: scheduleSmartNudge() on startup and on every foreground
 *
 * Notes:
 * - expo-notifications is NOT supported in Expo Go — mocked in __DEV__
 * - The 'smart-nudge' channel differs from the 'alarm' channel: no bypassDnd, DEFAULT priority
 *   because this is a gentle reminder, not an urgent alarm
 * - This function catches all errors — never throws to avoid crashing the app
 *
 * 7.3 — Smart Notification
 *
 * Schedules (or replaces) a daily local nudge notification at the hour the
 * user most commonly starts a nap, derived from session history.
 *
 * Requirements:
 *   - At least 3 sessions required before scheduling anything
 *   - Only one nudge scheduled at a time; prior ID is cancelled on update
 *   - Notification channel is separate from the alarm channel (lower priority)
 *   - Free-tier feature — no paywall check
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sessionService } from './SessionService';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const NUDGE_ID_KEY = '@smart_nap_timer:smart_nudge_id';
const MIN_SESSIONS  = 3;

// expo-notifications is NOT supported in Expo Go (SDK 53+).
// Follow the same conditional-require pattern as AlarmService.
let Notifications: any;
if (!__DEV__) {
  Notifications = require('expo-notifications');
} else {
  Notifications = {
    scheduleNotificationAsync:        async () => 'mock-nudge-id',
    cancelScheduledNotificationAsync: async () => {},
    setNotificationChannelAsync:      async () => {},
    SchedulableTriggerInputTypes: { DAILY: 'daily' },
    AndroidImportance: { DEFAULT: 3 },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the hour (0-23) that appears most often across sessions, or null. */
function mostCommonHour(sessions: { hour: number }[]): number | null {
  if (sessions.length < MIN_SESSIONS) return null;
  const tally: Record<number, number> = {};
  for (const s of sessions) {
    tally[s.hour] = (tally[s.hour] ?? 0) + 1;
  }
  let bestHour = -1;
  let bestCount = 0;
  for (const [h, count] of Object.entries(tally)) {
    if (count > bestCount) { bestCount = count; bestHour = Number(h); }
  }
  return bestHour >= 0 ? bestHour : null;
}

/** "13" → "1pm",  "9" → "9am",  "0" → "12am" */
function formatHour(hour: number): string {
  if (hour === 0)  return '12am';
  if (hour < 12)  return `${hour}am`;
  if (hour === 12) return '12pm';
  return `${hour - 12}pm`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call on every app foreground. Reads session history, computes the preferred
 * nap hour, cancels any existing nudge, and schedules a new one if eligible.
 * Silently no-ops on any error.
 */
export async function scheduleSmartNudge(): Promise<void> {
  try {
    const sessions = await sessionService.loadAll();
    const hour     = mostCommonHour(sessions);

    // Cancel the previous nudge (always, so we don't accumulate stale ones).
    const prevId = await AsyncStorage.getItem(NUDGE_ID_KEY).catch(() => null);
    if (prevId) {
      await Notifications.cancelScheduledNotificationAsync(prevId).catch(() => {});
      await AsyncStorage.removeItem(NUDGE_ID_KEY).catch(() => {});
    }

    if (hour === null) return; // Not enough history yet

    // Android requires a notification channel.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('smart-nudge', {
        name:       'Daily Nap Reminder',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound:      null,
        bypassDnd:  false,
      }).catch(() => {});
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Smart Nap Timer',
        body:  `You usually nap around ${formatHour(hour)} — ready?`,
      },
      trigger: {
        type:   Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
        repeats: true,
      },
    });

    await AsyncStorage.setItem(NUDGE_ID_KEY, id).catch(() => {});
  } catch {
    // Never block the caller
  }
}
