/**
 * useStreak — Hook for tracking nap streak and displaying new badge notifications
 *
 * Responsible for:
 * - Reloading StreakData every time HomeScreen gains focus (useFocusEffect)
 * - Showing an Alert when the user just unlocked a new milestone badge (3/7/14/30 days)
 * - Providing currentStreak, weeklyCount, weeklyGoal, earnedBadges to the UI
 *
 * Used by:
 * - HomeScreen: displays the streak widget and badge list
 * - DashboardScreen: weeklyCount to display weekly stats and share text
 *
 * Notes:
 * - newlyEarnedBadges is only non-empty on the first compute call after crossing a threshold
 *   (earned badges are persisted in AsyncStorage by StreakService)
 *
 * 7.2 — useStreak
 *
 * Thin hook that reloads streak data every time HomeScreen gains focus,
 * so the counters reflect the latest completed nap without requiring a
 * full app restart.
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { streakService, StreakData, BADGE_MILESTONES } from '../services/StreakService';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const EMPTY: StreakData = {
  currentStreak:      0,
  weeklyCount:        0,
  weeklyGoal:         5,
  earnedBadges:       [],
  newlyEarnedBadges:  [],
};

// ─────────────────────────────────────────
// Hook
// ─────────────────────────────────────────

/**
 * Hook for streak and badge tracking — reloads every time HomeScreen is focused
 * @returns StreakData: currentStreak, weeklyCount, weeklyGoal, earnedBadges, newlyEarnedBadges
 */
export function useStreak(): StreakData {
  const [data, setData] = useState<StreakData>(EMPTY);

  useFocusEffect(
    useCallback(() => {
      streakService.compute().then(setData).catch(() => {});
    }, []),
  );

  // Show a one-time congratulation alert for each newly unlocked badge.
  useEffect(() => {
    if (data.newlyEarnedBadges.length === 0) return;
    for (const days of data.newlyEarnedBadges) {
      const badge = BADGE_MILESTONES.find((b) => b.days === days);
      if (!badge) continue;
      Alert.alert(
        `${badge.emoji} Badge Unlocked!`,
        `You earned the "${badge.label}" badge for reaching a ${badge.days}-day streak. Keep it up!`,
        [{ text: 'Awesome!', style: 'default' }],
      );
    }
  }, [data.newlyEarnedBadges]);

  return data;
}
