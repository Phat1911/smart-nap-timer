/**
 * Task 3.11 — Persistent phone placement reminder
 * Shows on HomeScreen before every session until user taps "Got it".
 * Flag persisted in AsyncStorage so it survives app restarts.
 */
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@smart_nap_timer:placement_tip_seen';

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
