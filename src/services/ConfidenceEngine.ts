/**
 * ConfidenceEngine — Engine that computes a combined sleep confidence score from multiple sensors
 *
 * Responsible for:
 * - Combining accelScore, gyroScore, micScore, and durationScore into a 0-100 score
 * - Applying per-placement weights from PlacementProfile (P.3)
 * - Multi-placement fusion (P.10): weighted average by accuracyStars
 * - False positive guard (2.9): caps score at 65 when signal is insufficient
 * - EMA smoothing: mic increases by at most 5/tick; accel drops fast but recovers slowly
 *
 * Used by:
 * - useSleepDetection: calls compute() every EVAL_INTERVAL_MS
 *
 * Notes:
 * - resetSession() must be called before each new session to clear EMA state
 * - GUARDED_SCORE_CAP (65) must be < SLEEP_SCORE_TRIGGER (80) for the guard to work
 * - Asymmetric EMA accel: drops quickly (-20/tick) on movement, recovers slowly (+8/tick)
 *   because false positives from sudden movement are more harmful than false negatives
 *
 * Task 2.5 + 2.9 — ConfidenceEngine
 * P.3 — Updated to accept PlacementProfile for per-placement weights
 * P.10 — Multi-placement fusion: Pro (2), Max (4) combine scores
 *
 * Computes a weighted sleep-confidence score (0-100) from sensor data.
 * Weights and thresholds are now driven by the active PlacementProfile
 * instead of hardcoded constants, so each placement gets the most
 * accurate prediction possible.
 *
 * Multi-placement fusion (P.10):
 *   When multiple placements are active, compute a score per placement
 *   then fuse them using accuracy-star weighted average. More accurate
 *   placements contribute more to the final score. The false positive
 *   guard fires only if ALL placements fail to agree.
 *
 * Task 2.9 — False positive guard:
 *   If accel AND mic do not both agree (each >= their minimum threshold
 *   defined in the placement profile), the score is capped below
 *   SLEEP_SCORE_TRIGGER (80) so detection cannot fire on partial signal.
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { MotionSample } from './MotionService';
import { MicSample } from './MicService';
import { breathingDetector } from './BreathingDetector';
import { DETECTION, PLACEMENT_PROFILES, DEFAULT_PLACEMENT, PlacementProfile, DEBUG_DETECTION } from '../constants/config';
import type { PhonePlacement } from '../models/Session';

// ── Public types ──────────────────────────────────────────────────────────────

export interface ConfidenceInput {
  motionSamples: MotionSample[];
  micSamples: MicSample[];
  elapsedSeconds: number;
  thresholdMinutes: number;
  /** P.3 — active phone placement; defaults to 'mattress' if omitted */
  placement?: PhonePlacement;
  /** P.10 — all active placements for multi-placement fusion */
  placements?: PhonePlacement[];
}

export interface ConfidenceResult {
  score: number;               // 0-100 overall (capped if guard fires)
  accelScore: number;          // 0-100 component
  gyroScore: number;           // 0-100 component
  micScore: number;            // 0-100 component
  durationScore: number;       // 0-100 component
  /** True when the false positive guard was NOT applied */
  falsePositiveGuard: boolean;
  /** Which placement profile was used (primary) */
  placement: PhonePlacement;
}

// Maximum score allowed when the false positive guard fires.
// Must be < DETECTION.SLEEP_SCORE_TRIGGER (80).
// Set to 58 so a guarded score is visually distinct from approaching-trigger (80).
const GUARDED_SCORE_CAP = 58;

// ── Engine ────────────────────────────────────────────────────────────────────

class ConfidenceEngine {
  /** EMA state: mic rises slowly (+3/tick) but drops fast (-10/tick) to reject noise quickly */
  private _prevMicScore: number | null = null;
  /** EMA state: accel drops instantly (max -20/tick) but recovers slowly (+8/tick max) */
  private _prevAccelScore: number | null = null;
  /** Consecutive evals where the false positive guard fired — drives dynamic cap */
  private _guardedCount = 0;

  /**
   * Clears EMA state — call once at the start of each new detection session
   */
  resetSession(): void {
    this._prevMicScore = null;
    this._prevAccelScore = null;
    this._guardedCount = 0;
  }

  /**
   * Computes the combined sleep confidence score from sensor input data
   * @param input - Sensor sample arrays, elapsed time, and thresholdMinutes
   * @returns ConfidenceResult with a 0-100 score and per-component details
   */
  compute(input: ConfidenceInput): ConfidenceResult {
    const { motionSamples, micSamples, elapsedSeconds, thresholdMinutes } = input;

    // P.10 — resolve placements list (fallback to single placement or default)
    const placements: PhonePlacement[] =
      input.placements && input.placements.length > 0
        ? input.placements
        : [input.placement ?? DEFAULT_PLACEMENT];

    const primaryPlacement = placements[0];

    // ── Duration score (shared across all placements) ─────────────────────
    const thresholdSeconds = thresholdMinutes * 60;
    const durationScore = Math.min(
      100,
      Math.round((elapsedSeconds / Math.max(1, thresholdSeconds)) * 100),
    );

    // ── Mic score via BreathingDetector (single mic, shared) ─────────────
    // Asymmetric EMA: mic score rises slowly (+3/tick) to prevent brief quiet moments
    // from spiking the score, but drops fast (-10/tick) so that noise quickly
    // pulls the score down and the false positive guard fires sooner.
    const rawMicScore = breathingDetector.analyze(micSamples).micScore;
    const micScore = this._prevMicScore === null
      ? rawMicScore
      : rawMicScore > this._prevMicScore
        ? Math.min(rawMicScore, this._prevMicScore + 3)
        : Math.max(rawMicScore, this._prevMicScore - 10);
    this._prevMicScore = micScore;

    // ── Per-placement scores ───────────────────────────────────────────────
    // Use only the last 30 s of motion samples to compute accel/gyro scores.
    // Averaging the full 5-minute rolling window creates a "long memory" of
    // old movements that suppresses the score long after the user is still.
    const now = Date.now();
    const recentMotion = motionSamples.filter((s) => now - s.timestamp <= 30_000);
    const activeMotion = recentMotion.length >= 3 ? recentMotion : motionSamples.slice(-5);

    const placementScores = placements.map((p, idx) => {
      const profile: PlacementProfile = PLACEMENT_PROFILES[p];

      const rawAccelScore = varianceToScore(
        arrayMeanOr1(activeMotion.map((s) => s.accelVariance)),
        profile.stillVarianceThreshold,
      );

      // Asymmetric EMA: movement detected → fast drop (max -20/tick);
      // phone still again → slow recovery (max +8/tick).
      // Primary placement (idx 0) drives the shared EMA state.
      const accelScore = this._prevAccelScore === null
        ? rawAccelScore
        : rawAccelScore < this._prevAccelScore
          ? Math.max(rawAccelScore, this._prevAccelScore - 20)
          : Math.min(rawAccelScore, this._prevAccelScore + 8);
      if (idx === 0) {
        this._prevAccelScore = accelScore;
        // Wake event: primary placement clearly shows movement (well below accelAgreeMin).
        // Snap the mic EMA to ≤15 so stale breathing score can't carry over — mic must
        // re-earn its contribution slowly (+3/tick) after the user has been moving.
        const clearlyMoving = rawAccelScore < profile.accelAgreeMin - 20;
        if (clearlyMoving && (this._prevMicScore ?? 0) > 15) {
          this._prevMicScore = 15;
        }
      }

      const gyroScore = varianceToScore(
        arrayMeanOr1(activeMotion.map((s) => s.gyroVariance)),
        profile.stillVarianceThreshold,
      );

      const { weights } = profile;
      const totalWeight = weights.accel + weights.gyro + weights.mic + weights.duration;

      const raw = DEBUG_DETECTION.MIC_ONLY_FUSION
        ? micScore
        : (accelScore    * weights.accel    +
           gyroScore     * weights.gyro     +
           micScore      * weights.mic      +
           durationScore * weights.duration) / totalWeight;

      // If mic is disabled (no samples) and mic is a secondary signal for this
      // placement (weight ≤ 15%), skip the mic gate so accel-primary placements
      // (hand, pocket) can still detect sleep without microphone access.
      // For chest and mattress (high mic weight), always require mic agreement.
      const micDisabled = micSamples.length === 0;
      const skipMicGate = micDisabled && profile.weights.mic <= 15;
      const bothAgree = DEBUG_DETECTION.MIC_ONLY_FUSION
        ? micScore >= profile.micAgreeMin
        : skipMicGate
          ? accelScore >= profile.accelAgreeMin
          : accelScore >= profile.accelAgreeMin && micScore >= profile.micAgreeMin;

      const score = bothAgree
        ? Math.round(Math.min(100, Math.max(0, raw)))
        : Math.round(Math.min(GUARDED_SCORE_CAP, Math.max(0, raw)));

      return {
        placement: p,
        profile,
        accelScore: Math.round(accelScore),
        gyroScore: Math.round(gyroScore),
        score,
        bothAgree,
      };
    });

    // ── P.10 — Fusion: accuracy-star weighted average ─────────────────────
    // Each placement contributes proportional to its accuracyStars
    const totalStars = placementScores.reduce((s, p) => s + p.profile.accuracyStars, 0);
    const fusedRaw = placementScores.reduce(
      (sum, p) => sum + p.score * (p.profile.accuracyStars / totalStars),
      0,
    );

    // Guard fires unless a reliable placement (accuracyStars >= 3) agrees.
    // Pocket (2 stars) cannot bypass the guard alone — its signal is too weak.
    const reliableAgrees = placementScores.some(
      (p) => p.bothAgree && p.profile.accuracyStars >= 3,
    );

    // Dynamic cap: after 60 consecutive guarded evals (~60 s of clear wakefulness),
    // lower the cap to 40 so the display honestly reflects being far from sleep,
    // rather than appearing stuck just below the trigger threshold.
    if (reliableAgrees) {
      this._guardedCount = 0;
    } else {
      this._guardedCount += 1;
    }
    const dynamicCap = this._guardedCount > 60 ? 40 : GUARDED_SCORE_CAP;

    const fusedScore = reliableAgrees
      ? Math.round(Math.min(100, Math.max(0, fusedRaw)))
      : Math.round(Math.min(dynamicCap, Math.max(0, fusedRaw)));

    // Use primary placement's component scores for display
    const primary = placementScores[0];

    return {
      score:              fusedScore,
      accelScore:         primary.accelScore,
      gyroScore:          primary.gyroScore,
      micScore:           Math.round(micScore),
      durationScore,
      falsePositiveGuard: !reliableAgrees,
      placement:          primaryPlacement,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function arrayMeanOr1(values: number[]): number {
  if (values.length === 0) return 1;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Maps sensor variance to 0-100 using exponential decay.
 * P.3: scale parameter comes from the placement profile's stillVarianceThreshold.
 */
function varianceToScore(variance: number, scale: number): number {
  if (variance <= 0) return 100;
  return Math.round(100 * Math.exp(-variance / scale));
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const confidenceEngine = new ConfidenceEngine();

