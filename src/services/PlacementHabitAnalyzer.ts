/**
 * PlacementHabitAnalyzer — Analyses phone placement habits and suggests the optimal setup
 *
 * Responsible for:
 * - Tracking performance of each placement combo across nap sessions
 * - Updating rolling average latency, wake rating, accuracy, and comfort
 * - Computing a composite performance score (0-100) for each combo
 * - Storing the best recommendation so HomeScreen can display it without recomputing
 * - Rebuilding all data from sessions after a backup import
 *
 * Used by:
 * - SessionService: ingest() after each save(), rebuildFromSessions() after import
 * - HomeScreen: loadRecommendation() every time the tab is focused
 * - DevToolsScreen: clears habits on reset
 *
 * Notes:
 * - comboKey() sorts the placements array before joining so ['hand','chest'] and
 *   ['chest','hand'] both produce the same key 'chest+hand'
 * - MIN_SESSIONS_FOR_RECOMMENDATION = 3: at least 3 sessions needed before making a suggestion
 *
 * PlacementHabitAnalyzer — P.12
 *
 * AI service that:
 *   1. Tracks per-combo placement habits from session history
 *   2. Computes a performance score for each combo
 *   3. Recommends the best placement combo based on collected data
 *
 * Performance score formula (0-100):
 *   - 40% wake rating contribution  (avg rating / 5)
 *   - 30% latency contribution       (inverted: shorter = better)
 *   - 20% perceived accuracy         (good pct)
 *   - 10% comfort                    (comfort pct)
 *
 * Signals collected:
 *   - wake_rating         (explicit, from WakeScreen star rating)
 *   - latency_minutes     (implicit, from detection)
 *   - placement_evaluation.accuracyPerceived  (explicit, WakeScreen survey)
 *   - placement_evaluation.comfortable        (explicit, WakeScreen survey)
 *   - confidence_score    (implicit, from ConfidenceEngine)
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  NapSession,
  PhonePlacement,
  PlacementComboKey,
  PlacementHabit,
  PlacementRecommendation,
} from '../models/Session';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum sessions before a combo is eligible for recommendation */
const MIN_SESSIONS_FOR_RECOMMENDATION = 3;

/** Valid PhonePlacement values — used for input validation in ingest() */
const VALID_PLACEMENTS: PhonePlacement[] = ['mattress', 'hand', 'chest', 'pocket'];

/** Storage keys */
const HABITS_KEY        = '@smart_nap_timer:placement_habits';
const RECOMMEND_KEY     = '@smart_nap_timer:placement_recommendation';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Creates a canonical key for a placements array (sort + join)
 * @param placements - Array of PhonePlacement (e.g. ['hand', 'chest'])
 * @returns Key like 'chest+hand' (sorted to ensure consistency)
 */
export function comboKey(placements: PhonePlacement[]): PlacementComboKey {
  return [...placements].sort().join('+');
}

/** Inverse-latency score: shorter latency = higher score (0-100) */
function latencyScore(avgLatency: number): number {
  // Assume 10 min = worst (score 0), 1 min = best (score 100)
  const clamped = Math.max(1, Math.min(10, avgLatency));
  return Math.round(((10 - clamped) / 9) * 100);
}

/** Composite performance score 0-100 */
function computePerformanceScore(habit: Omit<PlacementHabit, 'performanceScore'>): number {
  const ratingScore  = habit.avgWakeRating != null ? (habit.avgWakeRating / 5) * 100 : 50;
  const latScore     = latencyScore(habit.avgLatencyMinutes);
  const accScore     = habit.accuracyGoodPct;
  const comfortScore = habit.comfortPct;

  return Math.round(
    ratingScore  * 0.40 +
    latScore     * 0.30 +
    accScore     * 0.20 +
    comfortScore * 0.10,
  );
}

// ── Service ───────────────────────────────────────────────────────────────────

class PlacementHabitAnalyzer {

  // ── Storage ──────────────────────────────────────────────────────────────

  /**
   * Reads all placement habits from AsyncStorage
   * @returns Record keyed by comboKey, empty if no data exists yet
   */
  async loadHabits(): Promise<Record<PlacementComboKey, PlacementHabit>> {
    try {
      const raw = await AsyncStorage.getItem(HABITS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private async saveHabits(habits: Record<PlacementComboKey, PlacementHabit>): Promise<void> {
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  }

  /**
   * Reads the stored recommendation (does not recompute)
   * @returns PlacementRecommendation or null if insufficient data
   */
  async loadRecommendation(): Promise<PlacementRecommendation | null> {
    try {
      const raw = await AsyncStorage.getItem(RECOMMEND_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private async saveRecommendation(rec: PlacementRecommendation): Promise<void> {
    await AsyncStorage.setItem(RECOMMEND_KEY, JSON.stringify(rec));
  }

  // ── Ingest ───────────────────────────────────────────────────────────────

  /**
   * Called after a session is saved (including wake rating + evaluation).
   * Updates the habit record for the session's placement combo, then
   * re-evaluates the recommendation.
   */
  async ingest(session: NapSession): Promise<void> {
    const rawPlacements = session.placements ?? [session.placement];
    const placements = rawPlacements.filter((p): p is PhonePlacement =>
      VALID_PLACEMENTS.includes(p as PhonePlacement),
    );
    // Skip sessions with no valid placements (corrupted data guard)
    if (placements.length === 0) return;
    const key        = comboKey(placements);
    const habits     = await this.loadHabits();
    const existing   = habits[key];

    const n = (existing?.sessionCount ?? 0) + 1;

    // Rolling average helpers
    const rollingAvg = (prev: number, val: number) =>
      prev + (val - prev) / n;
    const rollingPct = (prevPct: number, hit: boolean) =>
      prevPct + ((hit ? 100 : 0) - prevPct) / n;

    const prevAvgRating   = existing?.avgWakeRating ?? null;
    const prevAvgLatency  = existing?.avgLatencyMinutes ?? session.latency_minutes;
    const prevAccPct      = existing?.accuracyGoodPct ?? 0;
    const prevComfortPct  = existing?.comfortPct ?? 0;

    // Wake rating
    const newRating = session.wake_rating != null
      ? (prevAvgRating != null
          ? rollingAvg(prevAvgRating, session.wake_rating)
          : session.wake_rating)
      : prevAvgRating;

    // Latency
    const newLatency = existing
      ? rollingAvg(prevAvgLatency, session.latency_minutes)
      : session.latency_minutes;

    // Accuracy perceived
    const ev = session.placement_evaluation;
    const newAccPct = ev
      ? rollingPct(prevAccPct, ev.accuracyPerceived === 'good')
      : prevAccPct;

    // Comfort
    const newComfortPct = ev
      ? rollingPct(prevComfortPct, ev.comfortable)
      : prevComfortPct;

    const partial: Omit<PlacementHabit, 'performanceScore'> = {
      comboKey:          key,
      placements,
      sessionCount:      n,
      avgLatencyMinutes: Math.round(newLatency * 10) / 10,
      avgWakeRating:     newRating != null ? Math.round(newRating * 10) / 10 : null,
      accuracyGoodPct:   Math.round(newAccPct),
      comfortPct:        Math.round(newComfortPct),
      lastUsedAt:        new Date().toISOString(),
    };

    habits[key] = {
      ...partial,
      performanceScore: computePerformanceScore(partial),
    };

    await this.saveHabits(habits);
    await this.evaluateAndSaveRecommendation(habits);
  }

  // ── Recommendation ───────────────────────────────────────────────────────

  /**
   * Evaluates all habits and saves the best recommendation.
   * Only considers combos with >= MIN_SESSIONS_FOR_RECOMMENDATION sessions.
   */
  async evaluateAndSaveRecommendation(
    habits: Record<PlacementComboKey, PlacementHabit>,
  ): Promise<void> {
    const eligible = Object.values(habits).filter(
      (h) => h.sessionCount >= MIN_SESSIONS_FOR_RECOMMENDATION,
    );

    let recommendation: PlacementRecommendation;

    if (eligible.length === 0) {
      // Not enough data yet — find the most-used combo as a hint
      const allHabits = Object.values(habits);
      const mostUsed  = allHabits.sort((a, b) => b.sessionCount - a.sessionCount)[0];

      if (!mostUsed) return; // No data at all

      recommendation = {
        comboKey:    mostUsed.comboKey,
        placements:  mostUsed.placements,
        reason:      `Still learning — need ${MIN_SESSIONS_FOR_RECOMMENDATION} sessions per combo. Keep going!`,
        confidence:  'learning',
        score:       mostUsed.performanceScore,
        generatedAt: new Date().toISOString(),
      };
    } else {
      // Pick the highest-scoring eligible combo
      const best = eligible.sort((a, b) => b.performanceScore - a.performanceScore)[0];

      recommendation = {
        comboKey:    best.comboKey,
        placements:  best.placements,
        reason:      buildReasonText(best, eligible),
        confidence:  'confident',
        score:       best.performanceScore,
        generatedAt: new Date().toISOString(),
      };
    }

    await this.saveRecommendation(recommendation);
  }

  /**
   * Force-rebuild recommendation from stored sessions.
   * Call after bulk imports or resets.
   */
  /**
   * Rebuilds all habit data from a sessions array (used after backup import)
   * @param sessions - All sessions merged into the store
   */
  async rebuildFromSessions(sessions: NapSession[]): Promise<void> {
    // Reset habits and re-ingest all sessions in order
    await AsyncStorage.removeItem(HABITS_KEY);
    await AsyncStorage.removeItem(RECOMMEND_KEY);

    const sorted = [...sessions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    for (const session of sorted) {
      await this.ingest(session);
    }
  }
}

// ── Reason text builder ───────────────────────────────────────────────────────

function buildReasonText(
  best: PlacementHabit,
  eligible: PlacementHabit[],
): string {
  const label  = best.placements.map(capitalise).join(' + ');
  const parts: string[] = [];

  if (best.avgWakeRating != null && best.avgWakeRating >= 4) {
    parts.push(`avg wake rating ${best.avgWakeRating.toFixed(1)}/5`);
  }
  if (best.avgLatencyMinutes <= 4) {
    parts.push(`fast sleep onset (${best.avgLatencyMinutes} min avg)`);
  }
  if (best.accuracyGoodPct >= 70) {
    parts.push(`${best.accuracyGoodPct}% detection accuracy`);
  }
  if (best.comfortPct >= 70) {
    parts.push(`${best.comfortPct}% comfort`);
  }

  const reasonDetail = parts.length > 0
    ? `: ${parts.join(', ')}`
    : ` (score ${best.performanceScore}/100)`;

  const vsCount = eligible.length - 1;
  const vsSuffix = vsCount > 0
    ? ` vs ${vsCount} other combo${vsCount > 1 ? 's' : ''}`
    : '';

  return `${label} performs best for you${reasonDetail}${vsSuffix}.`;
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const placementHabitAnalyzer = new PlacementHabitAnalyzer();
