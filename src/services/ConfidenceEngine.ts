/**
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

import { MotionSample } from './MotionService';
import { MicSample } from './MicService';
import { breathingDetector } from './BreathingDetector';
import { DETECTION, PLACEMENT_PROFILES, DEFAULT_PLACEMENT, PlacementProfile } from '../constants/config';
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
const GUARDED_SCORE_CAP = 65;

// ── Engine ────────────────────────────────────────────────────────────────────

class ConfidenceEngine {
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
    const { micScore } = breathingDetector.analyze(micSamples);

    // ── Per-placement scores ───────────────────────────────────────────────
    const placementScores = placements.map((p) => {
      const profile: PlacementProfile = PLACEMENT_PROFILES[p];

      const accelScore = varianceToScore(
        arrayMeanOr1(motionSamples.map((s) => s.accelVariance)),
        profile.stillVarianceThreshold,
      );

      const gyroScore = varianceToScore(
        arrayMeanOr1(motionSamples.map((s) => s.gyroVariance)),
        profile.stillVarianceThreshold,
      );

      const { weights } = profile;
      const totalWeight = weights.accel + weights.gyro + weights.mic + weights.duration;

      const raw =
        (accelScore    * weights.accel    +
         gyroScore     * weights.gyro     +
         micScore      * weights.mic      +
         durationScore * weights.duration) / totalWeight;

      const bothAgree =
        accelScore >= profile.accelAgreeMin &&
        micScore   >= profile.micAgreeMin;

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

    // Guard fires only if NO placement agrees (any agreement = proceed)
    const anyAgrees = placementScores.some((p) => p.bothAgree);
    const fusedScore = anyAgrees
      ? Math.round(Math.min(100, Math.max(0, fusedRaw)))
      : Math.round(Math.min(GUARDED_SCORE_CAP, Math.max(0, fusedRaw)));

    // Use primary placement's component scores for display
    const primary = placementScores[0];

    return {
      score:              fusedScore,
      accelScore:         primary.accelScore,
      gyroScore:          primary.gyroScore,
      micScore:           Math.round(micScore),
      durationScore,
      falsePositiveGuard: !anyAgrees,
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

