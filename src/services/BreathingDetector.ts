/**
 * BreathingDetector — Analyses mic metering history to detect breathing patterns during sleep
 *
 * Responsible for:
 * - Computing a quietness score: rewards dB levels in the sleeping range (-80 to -20 dB)
 * - Computing a variance score: low variance = steady sound = regular breathing
 * - Computing a rhythm score: checks whether peak spacing falls in the 12-24 BPM range
 * - Combining these into a micScore (0-100) for ConfidenceEngine to compute the overall score
 *
 * Used by:
 * - ConfidenceEngine: calls breathingDetector.analyze(micSamples) each eval cycle
 *
 * Notes:
 * - Uses a 3-sample moving average to smooth the signal before peak detection
 * - Requires at least MIN_SAMPLES (10) samples before analysis begins
 * - Requires at least 20 samples for detectRhythm to operate
 *
 * Task 2.4 — BreathingDetector
 *
 * Analyses mic metering history for rhythmic breathing patterns.
 * Produces a micScore (0–100) consumed by ConfidenceEngine.
 *
 * Algorithm:
 *  1. Quietness score  — rewards metering in the sleeping dB range (-80 to -20 dB)
 *  2. Variance score   — low variance across the window = consistent, steady sound
 *  3. Rhythm score     — peak spacing in breathing frequency range (12–24 BPM)
 *
 * Final micScore = quietness*0.5 + variance*0.3 + rhythm*0.2
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { MicSample } from './MicService';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

// Breathing frequency bounds
const BREATHING_MIN_PERIOD_MS = 2_500;  // 24 BPM
const BREATHING_MAX_PERIOD_MS = 5_000;  // 12 BPM

const ANALYSIS_WINDOW_MS = 90_000; // last 90 seconds — more cycles for slow/deep breathers
const MIN_SAMPLES = 10;

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export interface BreathingResult {
  isBreathing: boolean;
  breathingRate: number | null;   // breaths per minute; null if not detected
  micScore: number;               // 0–100 for ConfidenceEngine
}

// ── Public class ──────────────────────────────────────────────────────────────

class BreathingDetector {
  /**
   * Analyses the most recent MicSample history.
   * Safe to call with an empty or short array; returns micScore=0 in that case.
   */
  analyze(samples: MicSample[]): BreathingResult {
    if (samples.length < MIN_SAMPLES) {
      return { isBreathing: false, breathingRate: null, micScore: 0 };
    }

    const now = Date.now();
    const window = samples.filter((s) => now - s.timestamp <= ANALYSIS_WINDOW_MS);

    if (window.length < MIN_SAMPLES) {
      return { isBreathing: false, breathingRate: null, micScore: 0 };
    }

    const meterings = window.map((s) => s.metering);

    const quietnessScore = computeQuietnessScore(arrayMean(meterings));
    const varianceScore  = computeVarianceScore(arrayVariance(meterings));
    const { rhythmScore, breathingRate } = detectRhythm(window);

    // Rhythm weighted highest: random noise has no 12-24 BPM rhythm, real breathing does.
    // Quietness cut to 0.3: moderate ambient noise no longer dominates the score.
    const micScore = Math.round(
      quietnessScore * 0.3 + varianceScore * 0.3 + rhythmScore * 0.4,
    );
    const clamped = Math.max(0, Math.min(100, micScore));
    const isBreathing = clamped >= 55 && rhythmScore > 35;

    return {
      isBreathing,
      breathingRate: isBreathing ? breathingRate : null,
      micScore: clamped,
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function arrayMean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function arrayVariance(values: number[]): number {
  const m = arrayMean(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
}

/**
 * Maps average dB to a quietness score (0–100).
 * Ideal sleeping range: –80 to –20 dB (peak at –50 dB → 100).
 * Very loud (> –10 dB) → 0.  Absolute silence (< –140) → 30 (uncertain).
 */
function computeQuietnessScore(avgDb: number): number {
  if (avgDb <= -140) return 30;
  if (avgDb >= -10)  return 0;

  // Ideal window: –80 to –20 dB
  if (avgDb >= -80 && avgDb <= -20) {
    const distFromIdeal = Math.abs(avgDb - (-50));
    return Math.max(70, 100 - distFromIdeal);
  }
  // Below ideal: –140 … –80 → 30 … 70
  if (avgDb < -80) {
    return 30 + ((avgDb - (-140)) / 60) * 40;
  }
  // –20 … –10 → 70 … 0
  return Math.max(0, 70 - (avgDb - (-20)) * 7);
}

/**
 * Maps dB variance to a score (0–100).
 * Low variance = consistent sound level = likely steady breathing → high score.
 */
function computeVarianceScore(variance: number): number {
  if (variance <= 0)   return 100;
  if (variance >= 500) return 0;
  return Math.round(100 * Math.exp(-variance / 80));
}

/**
 * Detects peaks and checks whether their spacing matches breathing frequency.
 */
function detectRhythm(
  samples: MicSample[],
): { rhythmScore: number; breathingRate: number | null } {
  // Need at least 30 samples (~15 seconds) before rhythm detection is reliable
  if (samples.length < 30) return { rhythmScore: 0, breathingRate: null };

  // 5-sample moving average smooths out mic noise better than 3-sample
  const smoothed = movingAverage(samples.map((s) => s.metering), 5);

  // Prominence filter: only count peaks that stand at least 3 dB above the
  // signal mean. A 1-dB noise fluctuation forming a local max is not breathing.
  const signalMean = arrayMean(smoothed);
  const MIN_PEAK_PROMINENCE_DB = 3;

  // Collect timestamps of prominent local maxima
  const peakTimestamps: number[] = [];
  for (let i = 1; i < smoothed.length - 1; i++) {
    if (smoothed[i] > smoothed[i - 1] &&
        smoothed[i] > smoothed[i + 1] &&
        smoothed[i] > signalMean + MIN_PEAK_PROMINENCE_DB) {
      peakTimestamps.push(samples[i].timestamp);
    }
  }

  // Need at least 5 peaks → 4 intervals → at least 2 must be valid
  if (peakTimestamps.length < 5) return { rhythmScore: 0, breathingRate: null };

  // Inter-peak intervals
  const intervals: number[] = [];
  for (let i = 1; i < peakTimestamps.length; i++) {
    intervals.push(peakTimestamps[i] - peakTimestamps[i - 1]);
  }

  const valid = intervals.filter(
    (iv) => iv >= BREATHING_MIN_PERIOD_MS && iv <= BREATHING_MAX_PERIOD_MS,
  );
  // Require at least 2 valid intervals to confirm a genuine rhythm (not a single lucky gap)
  if (valid.length < 2) return { rhythmScore: 0, breathingRate: null };

  const validRatio = valid.length / intervals.length;
  const avgInterval = arrayMean(valid);
  const ivVariance  = arrayVariance(valid);

  // Consistency: lower variance relative to mean → more consistent rhythm.
  // Exponent 15 (up from 10) penalises irregular rhythms more strongly —
  // real sleep breathing has <10% interval variation; random noise has >25%.
  const consistencyFactor = Math.exp(-ivVariance / (avgInterval * avgInterval) * 15);
  const rhythmScore = Math.min(100, Math.round(validRatio * consistencyFactor * 100));

  return {
    rhythmScore,
    breathingRate: Math.round(60_000 / avgInterval),
  };
}

function movingAverage(values: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const start = Math.max(0, i - half);
    const end   = Math.min(values.length, i + half + 1);
    return arrayMean(values.slice(start, end));
  });
}

// ── Singleton ──────────────────────────────────────────────────────────────────

export const breathingDetector = new BreathingDetector();
