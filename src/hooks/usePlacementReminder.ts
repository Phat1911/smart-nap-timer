/**
 * usePlacementReminder — Hook to manage the phone placement reminder shown on HomeScreen
 *
 * Responsible for:
 * - Reading the "seen" flag from AsyncStorage on mount
 * - Showing the reminder tip if the user hasn't dismissed it yet
 * - Saving the flag and hiding the tip when the user taps "Got it"
 *
 * Used by:
 * - HomeScreen: visible to show/hide the tip card, dismiss to hide it
 *
 * Notes:
 * - Flag persisted in AsyncStorage — does not reappear even after app restart
 * - Not related to notifications; just a UI tip card inside HomeScreen
 *
 * Task 3.11 — Persistent phone placement reminder
 * Shows on HomeScreen before every session until user taps "Got it".
 * Flag persisted in AsyncStorage so it survives app restarts.
 */
// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const KEY = '@smart_nap_timer:placement_tip_seen';

// ─────────────────────────────────────────
// Hook
// ─────────────────────────────────────────

/**
 * Hook to manage the phone placement tip — permanently hidden when the user dismisses it
 * @returns visible (whether to show), dismiss() (hide and save flag)
 */
export function usePlacementReminder() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((val) => {
      if (val !== 'true') setVisible(true);
    });
  }, []);

  async function dismiss() {
    await AsyncStorage.setItem(KEY, 'true');
    setVisible(false);
  }

  return { visible, dismiss };
}
