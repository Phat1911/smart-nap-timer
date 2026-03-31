/**
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

import { MicSample } from './MicService';

// Breathing frequency bounds
const BREATHING_MIN_PERIOD_MS = 2_500;  // 24 BPM
const BREATHING_MAX_PERIOD_MS = 5_000;  // 12 BPM

const ANALYSIS_WINDOW_MS = 60_000; // last 60 seconds
const MIN_SAMPLES = 10;

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

    const micScore = Math.round(
      quietnessScore * 0.5 + varianceScore * 0.3 + rhythmScore * 0.2,
    );
    const clamped = Math.max(0, Math.min(100, micScore));
    const isBreathing = clamped >= 50 && rhythmScore > 30;

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
  if (samples.length < 20) return { rhythmScore: 0, breathingRate: null };

  const smoothed = movingAverage(samples.map((s) => s.metering), 3);

  // Collect timestamps of local maxima
  const peakTimestamps: number[] = [];
  for (let i = 1; i < smoothed.length - 1; i++) {
    if (smoothed[i] > smoothed[i - 1] && smoothed[i] > smoothed[i + 1]) {
      peakTimestamps.push(samples[i].timestamp);
    }
  }

  if (peakTimestamps.length < 3) return { rhythmScore: 0, breathingRate: null };

  // Inter-peak intervals
  const intervals: number[] = [];
  for (let i = 1; i < peakTimestamps.length; i++) {
    intervals.push(peakTimestamps[i] - peakTimestamps[i - 1]);
  }

  const valid = intervals.filter(
    (iv) => iv >= BREATHING_MIN_PERIOD_MS && iv <= BREATHING_MAX_PERIOD_MS,
  );
  if (valid.length === 0) return { rhythmScore: 0, breathingRate: null };

  const validRatio = valid.length / intervals.length;
  const avgInterval = arrayMean(valid);
  const ivVariance  = arrayVariance(valid);

  // Consistency: lower variance relative to mean → more consistent rhythm
  const consistencyFactor = Math.exp(-ivVariance / (avgInterval * avgInterval) * 10);
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
