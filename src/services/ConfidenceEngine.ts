/**
 * Task 2.5 + 2.9 — ConfidenceEngine
 * P.3 — Updated to accept PlacementProfile for per-placement weights
 *
 * Computes a weighted sleep-confidence score (0-100) from sensor data.
 * Weights and thresholds are now driven by the active PlacementProfile
 * instead of hardcoded constants, so each placement gets the most
 * accurate prediction possible.
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
}

export interface ConfidenceResult {
  score: number;               // 0-100 overall (capped if guard fires)
  accelScore: number;          // 0-100 component
  gyroScore: number;           // 0-100 component
  micScore: number;            // 0-100 component
  durationScore: number;       // 0-100 component
  /** True when the false positive guard was NOT applied */
  falsePositiveGuard: boolean;
  /** Which placement profile was used */
  placement: PhonePlacement;
}

// Maximum score allowed when the false positive guard fires.
// Must be < DETECTION.SLEEP_SCORE_TRIGGER (80).
const GUARDED_SCORE_CAP = 65;

// ── Engine ────────────────────────────────────────────────────────────────────

class ConfidenceEngine {
  compute(input: ConfidenceInput): ConfidenceResult {
    const { motionSamples, micSamples, elapsedSeconds, thresholdMinutes } = input;
    const placement = input.placement ?? DEFAULT_PLACEMENT;

    // P.3 — resolve placement profile for weights + thresholds
    const profile: PlacementProfile = PLACEMENT_PROFILES[placement];

    // ── Accelerometer score ──────────────────────────────────────────────────
    const accelScore = varianceToScore(
      arrayMeanOr1(motionSamples.map((s) => s.accelVariance)),
      profile.stillVarianceThreshold,
    );

    // ── Gyroscope score ──────────────────────────────────────────────────────
    const gyroScore = varianceToScore(
      arrayMeanOr1(motionSamples.map((s) => s.gyroVariance)),
      profile.stillVarianceThreshold,
    );

    // ── Mic score via BreathingDetector ──────────────────────────────────────
    const { micScore } = breathingDetector.analyze(micSamples);

    // ── Duration score ───────────────────────────────────────────────────────
    // Linearly ramps 0->100 as elapsed time reaches the adaptive threshold T.
    const thresholdSeconds = thresholdMinutes * 60;
    const durationScore = Math.min(
      100,
      Math.round((elapsedSeconds / Math.max(1, thresholdSeconds)) * 100),
    );

    // ── Weighted sum (P.3: uses profile weights) ─────────────────────────────
    const { weights } = profile;
    const totalWeight = weights.accel + weights.gyro + weights.mic + weights.duration;

    const raw =
      (accelScore    * weights.accel    +
       gyroScore     * weights.gyro     +
       micScore      * weights.mic      +
       durationScore * weights.duration) / totalWeight;

    // ── False positive guard (P.3: uses profile-specific agree thresholds) ───
    const bothAgree =
      accelScore >= profile.accelAgreeMin &&
      micScore   >= profile.micAgreeMin;

    const score = bothAgree
      ? Math.round(Math.min(100, Math.max(0, raw)))
      : Math.round(Math.min(GUARDED_SCORE_CAP, Math.max(0, raw)));

    return {
      score,
      accelScore:         Math.round(accelScore),
      gyroScore:          Math.round(gyroScore),
      micScore:           Math.round(micScore),
      durationScore,
      falsePositiveGuard: !bothAgree,
      placement,
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
 *
 * variance = 0       -> 100 (perfectly still)
 * variance = scale   -> ~37
 * variance >> scale  -> ~0  (lots of movement)
 */
function varianceToScore(variance: number, scale: number): number {
  if (variance <= 0) return 100;
  return Math.round(100 * Math.exp(-variance / scale));
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const confidenceEngine = new ConfidenceEngine();
