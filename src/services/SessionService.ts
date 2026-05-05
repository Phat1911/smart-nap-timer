/**
 * SessionService — Manages storage and retrieval of nap session data
 *
 * Responsible for:
 * - Saving and reading NapSession from AsyncStorage
 * - Computing aggregated statistics (SessionStats) from session history
 * - Updating the adaptive threshold per-placement after each session (P.9)
 * - Updating PlacementHabitAnalyzer after each session (P.12)
 * - Exporting JSON and merging imports from backup files
 * - Resetting all data (used by DevTools)
 *
 * Used by:
 * - SleepingScreen: save() when nap time runs out
 * - MonitoringScreen: save() on timeout or if the user doesn't fall asleep
 * - WakeScreen: loadAll() to get sessions, updatePlacementEvaluation()
 * - useDashboardData, useAIModel, useAdaptiveThreshold, useStreak...
 *
 * Notes:
 * - Each placement has its own threshold key to avoid cross-contamination (P.9)
 * - save() automatically normalizes the placements array (ensures it is non-empty)
 * - Adaptive threshold uses EMA: 70% weight for previous avg, 30% for new session
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { NapSession, SessionStats, AdaptiveThreshold } from '../models/Session';
import { placementHabitAnalyzer } from './PlacementHabitAnalyzer';
import { TIME_OF_DAY, ADAPTIVE, INSUFFICIENT, DETECTION, DEFAULT_PLACEMENT } from '../constants/config';
import type { TimeOfDay, PhonePlacement } from '../models/Session';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const SESSIONS_KEY = '@smart_nap_timer:sessions';
/** P.9 — one threshold key per placement so buckets don't cross-contaminate */
const thresholdKey = (placement: PhonePlacement) =>
  `@smart_nap_timer:threshold_${placement}`;
const AI_WEIGHTS_KEY = '@smart_nap_timer:ai_weights';

// ─────────────────────────────────────────
// Class Definition
// ─────────────────────────────────────────

class SessionService {
  // ── Read ──────────────────────────────────────────────────────────────────

  /**
   * Reads all session history from AsyncStorage
   * @returns Array of NapSession, empty if no data exists yet
   */
  async loadAll(): Promise<NapSession[]> {
    try {
      const raw = await AsyncStorage.getItem(SESSIONS_KEY);
      return raw ? (JSON.parse(raw) as NapSession[]) : [];
    } catch {
      return [];
    }
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  /**
   * Saves a new nap session and updates the adaptive threshold and PlacementHabitAnalyzer
   * @param session - Nap session data to save
   */
  async save(session: NapSession): Promise<void> {
    // Ensure placements array is always populated
    const normalised: NapSession = {
      ...session,
      placements: session.placements?.length > 0
        ? session.placements
        : [session.placement],
    };
    const all = await this.loadAll();
    all.push(normalised);
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
    await this.updateThreshold(normalised);
    // P.12 -- feed into AI habit analyzer
    await placementHabitAnalyzer.ingest(normalised).catch(() => {});
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  /**
   * Computes and returns aggregated statistics from the full session history
   * @returns SessionStats with avg latency, avg sleep, avg rating and insufficient streak
   */
  async getStats(): Promise<SessionStats> {
    const sessions = await this.loadAll();
    if (sessions.length === 0) {
      return {
        total_sessions: 0,
        avg_latency_minutes: 0,
        avg_actual_sleep_minutes: 0,
        avg_wake_rating: 0,
        best_wake_rating: 1,
        insufficient_streak: 0,
      };
    }

    const rated = sessions.filter((s) => s.wake_rating !== null);
    const avgLatency =
      sessions.reduce((sum, s) => sum + s.latency_minutes, 0) / sessions.length;
    const avgSleep =
      sessions.reduce((sum, s) => sum + s.actual_sleep_minutes, 0) /
      sessions.length;
    const avgRating =
      rated.length > 0
        ? rated.reduce((sum, s) => sum + (s.wake_rating ?? 0), 0) / rated.length
        : 0;
    const bestRating = rated.length > 0
      ? (Math.max(...rated.map((s) => s.wake_rating ?? 0)) as NapSession['wake_rating'])
      : 1;

    // Count consecutive insufficient sessions from the end
    let streak = 0;
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].is_insufficient) streak++;
      else break;
    }

    return {
      total_sessions: sessions.length,
      avg_latency_minutes: Math.round(avgLatency * 10) / 10,
      avg_actual_sleep_minutes: Math.round(avgSleep * 10) / 10,
      avg_wake_rating: Math.round(avgRating * 10) / 10,
      best_wake_rating: (bestRating ?? 1) as NapSession['wake_rating'] & {},
      insufficient_streak: streak,
    };
  }

  // ── Adaptive threshold (P.9: per-placement keys) ─────────────────────────

  /**
   * Returns the adaptive threshold for the given placement (defaults to
   * 'mattress' when omitted for backward compatibility).
   */
  async getThreshold(placement: PhonePlacement = DEFAULT_PLACEMENT): Promise<AdaptiveThreshold> {
    const defaults: AdaptiveThreshold = {
      night: 5,
      morning: 5,
      afternoon: 5,
      evening: 5,
    };
    try {
      const raw = await AsyncStorage.getItem(thresholdKey(placement));
      return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
    } catch {
      return defaults;
    }
  }

  private async updateThreshold(session: NapSession): Promise<void> {
    // P.9 — use the placement stored on the session for the lookup key
    const placement = session.placement ?? DEFAULT_PLACEMENT;
    const current = await this.getThreshold(placement);
    const tod = session.time_of_day;
    const prev = current[tod];
    const next =
      prev * ADAPTIVE.PREV_AVG_WEIGHT +
      session.latency_minutes * ADAPTIVE.LAST_SESSION_WEIGHT;

    const clamped = Math.max(
      DETECTION.MIN_THRESHOLD_MINUTES,
      Math.min(DETECTION.MAX_THRESHOLD_MINUTES, next)
    );

    current[tod] = Math.round(clamped * 10) / 10;
    await AsyncStorage.setItem(thresholdKey(placement), JSON.stringify(current));
  }

  // ── Utils ─────────────────────────────────────────────────────────────────

  /**
   * Maps the current hour to a TimeOfDay bucket (night/morning/afternoon/evening)
   * @param hour - Current hour (0-23)
   * @returns The corresponding time-of-day bucket
   */
  getTimeOfDay(hour: number): TimeOfDay {
    if (hour >= TIME_OF_DAY.night.start && hour < TIME_OF_DAY.night.end)
      return 'night';
    if (hour >= TIME_OF_DAY.morning.start && hour < TIME_OF_DAY.morning.end)
      return 'morning';
    if (hour >= TIME_OF_DAY.afternoon.start && hour < TIME_OF_DAY.afternoon.end)
      return 'afternoon';
    return 'evening';
  }

  /**
   * Checks whether a nap session should be considered insufficient
   * @param actualMinutes - Actual sleep time (minutes)
   * @param targetMinutes - Target sleep time (minutes)
   * @returns true if actualMinutes < targetMinutes * INSUFFICIENT.THRESHOLD_RATIO (0.85)
   */
  isInsufficient(actualMinutes: number, targetMinutes: number): boolean {
    return actualMinutes < targetMinutes * INSUFFICIENT.THRESHOLD_RATIO;
  }

  // ── Reset / Export ────────────────────────────────────────────────────────

  /**
   * P.12 -- Attach a placement evaluation to an existing session, then
   * re-ingest into the habit analyzer so performance data is updated.
   */
  async updatePlacementEvaluation(
    sessionId: string,
    evaluation: import('../models/Session').PlacementEvaluation,
  ): Promise<void> {
    const all = await this.loadAll();
    const idx = all.findIndex((s) => s.session_id === sessionId);
    if (idx < 0) return;
    all[idx] = { ...all[idx], placement_evaluation: evaluation };
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(all));
    // Re-ingest from scratch so each session is counted exactly once
    await placementHabitAnalyzer.rebuildFromSessions(all).catch(() => {});
  }

  /**
   * Deletes all data: sessions, AI weights, placement habits and all thresholds
   * Only called from DevTools
   */
  async reset(): Promise<void> {
    const placementKeys: PhonePlacement[] = ['mattress', 'hand', 'chest', 'pocket'];
    await AsyncStorage.multiRemove([
      SESSIONS_KEY,
      AI_WEIGHTS_KEY,
      '@smart_nap_timer:placement_habits',
      '@smart_nap_timer:placement_recommendation',
      ...placementKeys.map(thresholdKey),
    ]);
  }

  /**
   * Exports all sessions as a pretty-printed JSON string (2-space indent)
   * @returns JSON string of the NapSession array
   */
  async exportJSON(): Promise<string> {
    const sessions = await this.loadAll();
    return JSON.stringify(sessions, null, 2);
  }

  /**
   * Merges sessions from an imported file into existing data, skipping duplicates
   * @param incoming - Data array from a JSON backup file
   * @returns Number of sessions imported and skipped (due to duplicates)
   */
  async mergeImported(incoming: unknown[]): Promise<{ imported: number; skipped: number }> {
    const existing = await this.loadAll();
    const existingIds = new Set(existing.map((s) => s.session_id));
    const valid = (incoming as NapSession[]).filter(
      (s) => s.session_id && !existingIds.has(s.session_id),
    );
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify([...existing, ...valid]));
    return { imported: valid.length, skipped: incoming.length - valid.length };
  }
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const sessionService = new SessionService();
