export type DetectionMethod = 'accelerometer' | 'mic' | 'combo' | 'manual_tap';

export type WakeRating = 1 | 2 | 3 | 4 | 5;

export type TimeOfDay = 'night' | 'morning' | 'afternoon' | 'evening';

/** P.1 — Where the user places their phone during a nap session */
export type PhonePlacement = 'mattress' | 'hand' | 'chest' | 'pocket';

/**
 * Placement combination key — canonical string representation of a sorted
 * placements array, e.g. ['hand','chest'] => 'chest+hand'.
 * Used as the map key in PlacementHabit records.
 */
export type PlacementComboKey = string;

/**
 * User's post-nap evaluation of the current placement setup.
 * Collected from a quick survey on WakeScreen.
 */
export interface PlacementEvaluation {
  /** Did the placement feel comfortable? */
  comfortable: boolean;
  /** Did the placement seem to detect sleep accurately (user's perception)? */
  accuracyPerceived: 'good' | 'late' | 'too_early' | 'unknown';
  /** Free-text note (optional) */
  note?: string;
}

export interface NapSession {
  session_id: string;
  date: string;                      // ISO date string
  hour: number;                      // 0-23
  day_of_week: number;               // 0-6 (Sunday=0)
  time_of_day: TimeOfDay;
  target_minutes: number;
  actual_sleep_minutes: number;
  latency_minutes: number;           // time from Start to sleep detected
  threshold_T_used: number;          // stillness threshold used (minutes)
  detection_method: DetectionMethod;
  placement: PhonePlacement;         // P.1 — primary phone placement
  /** P.10 — all active placements for this session (single-element for Free tier) */
  placements: PhonePlacement[];
  wake_rating: WakeRating | null;
  is_insufficient: boolean;          // actual < target * 0.85
  confidence_score: number;          // 0-100 at time of detection
  /** P.12 — optional placement evaluation submitted after waking */
  placement_evaluation?: PlacementEvaluation;
}

export interface SessionStats {
  total_sessions: number;
  avg_latency_minutes: number;
  avg_actual_sleep_minutes: number;
  avg_wake_rating: number;
  best_wake_rating: WakeRating;
  insufficient_streak: number;       // consecutive insufficient sessions
}

export interface AdaptiveThreshold {
  night: number;
  morning: number;
  afternoon: number;
  evening: number;
}

export interface AIModelWeights {
  intercept: number;
  coef_hour: number;
  coef_day_of_week: number;
  coef_prev_latency: number;
  coef_wake_rating: number;
  trained_on_sessions: number;
  last_trained: string;
}

// ── P.12 — Placement Habit types ─────────────────────────────────────────────

/**
 * Aggregated performance record for a specific placement combination.
 * Updated after every session that uses this combo.
 */
export interface PlacementHabit {
  /** Canonical sorted key, e.g. 'chest+hand' */
  comboKey: PlacementComboKey;
  /** The placement(s) in this combo */
  placements: PhonePlacement[];
  /** Total sessions recorded with this combo */
  sessionCount: number;
  /** Average latency minutes across all sessions */
  avgLatencyMinutes: number;
  /** Average wake rating (1-5), null if no ratings yet */
  avgWakeRating: number | null;
  /** Percentage of sessions where user rated accuracy as 'good' */
  accuracyGoodPct: number;
  /** Percentage of sessions that were comfortable */
  comfortPct: number;
  /** Composite performance score 0-100 (higher = better) */
  performanceScore: number;
  /** Timestamp of last session using this combo */
  lastUsedAt: string;
}

/**
 * AI-generated recommendation for the best placement combo.
 * Stored alongside habits so HomeScreen can display it without re-computing.
 */
export interface PlacementRecommendation {
  /** The recommended combo key */
  comboKey: PlacementComboKey;
  /** The recommended placements */
  placements: PhonePlacement[];
  /** Human-readable reason */
  reason: string;
  /**
   * Confidence level of the recommendation.
   * 'learning' = fewer than MIN_SESSIONS_FOR_RECOMMENDATION sessions.
   * 'confident' = enough data.
   */
  confidence: 'learning' | 'confident';
  /** Score of the recommended combo */
  score: number;
  /** ISO timestamp when generated */
  generatedAt: string;
}
