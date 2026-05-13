/**
 * useSleepDetection — Hook for real-time sleep state detection
 *
 * Responsible for:
 * - Starting MotionService and MicService on mount
 * - Feeding samples into the RollingWindow every SAMPLE_INTERVAL_MS
 * - Computing a confidence score every EVAL_INTERVAL_MS via ConfidenceEngine
 * - Triggering isDetected when score >= trigger for SUSTAINED_HIGH_COUNT consecutive evals
 * - Exposing onManualTap() for the user to trigger detection manually
 *
 * Used by:
 * - MonitoringScreen: receives state.isDetected to navigate to SleepingScreen
 *
 * Notes:
 * - consecutiveHighRef uses useRef (not useState) to avoid re-renders
 *   each time the counter increments — only setState when actually detected or UI needs an update
 * - MIN_DETECTION_SECONDS = 3 minutes: never triggers before 3 minutes
 *   to avoid false positives when the user has just lain down but not yet asleep
 * - detectedRef is an idempotency guard: once detected, no further samples are processed
 *
 * Tasks 2.10 + 2.15 — useSleepDetection
 *
 * Task 2.10 — Fires when ConfidenceEngine score ≥ 80 sustained across window
 *   • Starts motionService + micService on mount; cleans up on unmount.
 *   • Feeds every sample into useRollingWindow.
 *   • Evaluates ConfidenceEngine every second (SAMPLE_INTERVAL_MS × 2).
 *   • Requires SUSTAINED_HIGH_COUNT consecutive high scores before setting
 *     isDetected = true, preventing momentary spikes from triggering.
 *   • On wasReset (30 s sustained movement) the consecutive counter resets.
 *
 * Task 2.15 — Manual tap fallback
 *   • onManualTap() immediately sets isDetected = true with method
 *     'manual_tap', for users who want to start the countdown themselves.
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import { motionService, MotionSample } from '../services/MotionService';
import { micService }                  from '../services/MicService';
import { confidenceEngine }            from '../services/ConfidenceEngine';
import { useRollingWindow }            from './useRollingWindow';
import { DETECTION, getSleepScoreTrigger, PLACEMENT_PROFILES } from '../constants/config';
import { notificationBlocker }         from '../services/NotificationBlocker';
import type { DetectionMethod, PhonePlacement } from '../models/Session';

// Evaluate the engine twice per sample interval (every ~1 s)
const EVAL_INTERVAL_MS = DETECTION.SAMPLE_INTERVAL_MS * 2;

// ── Public types ──────────────────────────────────────────────────────────────

export interface SleepDetectionState {
  /** True once the score has been sustained at ≥ 80 */
  isDetected:      boolean;
  /** 0–100 current confidence score */
  confidence:      number;
  /** Which sensor(s) drove the detection */
  detectionMethod: DetectionMethod;
  /** Seconds elapsed since monitoring began */
  elapsedSeconds:  number;
  /** Whether the accelerometer is feeding data */
  accelActive:     boolean;
  /** Whether the microphone is feeding data */
  micActive:       boolean;
  /** Per-sensor score breakdown (for debug overlay) */
  accelScore:          number;
  gyroScore:           number;
  micScore:            number;
  durationScore:       number;
  falsePositiveGuard:  boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Hook for real-time sleep detection — starts sensors and continuously computes confidence
 * @param thresholdMinutes - Time threshold (minutes) used to compute durationScore
 * @param placement - Primary phone placement (used for ConfidenceEngine profile)
 * @param placements - All currently active placements (for multi-placement fusion)
 * @returns state (SleepDetectionState), onManualTap (manual fallback)
 */
export function useSleepDetection(thresholdMinutes: number, placement?: PhonePlacement, placements?: PhonePlacement[]) {
  const [state, setState] = useState<SleepDetectionState>({
    isDetected:         false,
    confidence:         0,
    detectionMethod:    'combo',
    elapsedSeconds:     0,
    accelActive:        false,
    micActive:          false,
    accelScore:         0,
    gyroScore:          0,
    micScore:           0,
    durationScore:      0,
    falsePositiveGuard: false,
  });

  const { addMotion, addMic, getSnapshot, reset } = useRollingWindow();

  const startTimeRef          = useRef(Date.now());
  const consecutiveHighRef    = useRef(0);
  const scoreHistoryRef       = useRef<number[]>([]); // last 15 scores for stability/trend
  const lastMovementTimeRef   = useRef<number | null>(null); // when accel last showed movement
  const detectedRef           = useRef(false); // idempotency guard
  const accelActiveRef        = useRef(false);
  const micActiveRef          = useRef(false);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    startTimeRef.current = Date.now();
    detectedRef.current  = false;
    consecutiveHighRef.current = 0;
    scoreHistoryRef.current = [];
    lastMovementTimeRef.current = null;
    reset();
    confidenceEngine.resetSession();

    // Block incoming notifications while napping
    notificationBlocker.block().catch(() => {});

    // Start accelerometer + gyroscope
    motionService.start((sample: MotionSample) => {
      accelActiveRef.current = true;
      addMotion(sample);
    });

    // Start microphone (async; may be denied — handled gracefully)
    micService.start((sample) => {
      micActiveRef.current = true;
      addMic(sample);
    }).catch(() => {
      micActiveRef.current = false;
    });

    // Evaluation loop (task 2.10)
    const evalId = setInterval(() => {
      if (detectedRef.current) return;

      const elapsed = (Date.now() - startTimeRef.current) / 1_000;
      const { motionSamples, micSamples } = getSnapshot();

      const result = confidenceEngine.compute({
        motionSamples,
        micSamples,
        elapsedSeconds:   elapsed,
        thresholdMinutes,
        placement,
        placements,
      });

      // Track score history for stability + trend checks (keep last 15 scores)
      scoreHistoryRef.current = [...scoreHistoryRef.current.slice(-14), result.score];

      // Movement-adjusted minimum: if significant movement was detected recently,
      // extend the detection window so the clock restarts from that movement.
      // Prevents the min-time guard from being consumed while the user is still awake.
      // Use placement-aware threshold: consider movement only if accelScore is
      // well below the placement's accelAgreeMin (indicating actual phone movement, not measurement noise).
      const primaryPlacement = (placements && placements[0]) ?? placement ?? 'mattress';
      const profile = PLACEMENT_PROFILES[primaryPlacement];
      const movementThreshold = Math.max(profile.accelAgreeMin - 25, 15); // 15 is floor for very lenient placements
      if (result.accelScore < movementThreshold) {
        lastMovementTimeRef.current = elapsed; // record elapsed seconds of last movement
      }
      const baseMin = getMinDetectionSeconds(primaryPlacement);
      const movementMin = lastMovementTimeRef.current !== null
        ? lastMovementTimeRef.current + 90  // require 90 s of stillness after last movement
        : 0;
      const effectiveMin = Math.max(baseMin, movementMin);

      // Sustained trigger with hysteresis band:
      //   score >= trigger (80)        → increment
      //   trigger-8 <= score < trigger → hold (brief dip doesn't erase progress)
      //   score < trigger-8 (< 72)     → reset (clearly not at sleep level)
      const trigger = getSleepScoreTrigger();
      if (result.score >= trigger && elapsed >= effectiveMin) {
        consecutiveHighRef.current += 1;
      } else if (result.score < trigger - 8) {
        consecutiveHighRef.current = 0;
      }
      // In the band [72, 80): counter is held — neither incremented nor reset

      // Stability gate: genuine sleep produces a steady, non-declining score.
      // Fails if last 12 scores have high standard deviation (oscillation)
      // or if the score trend over the last 8 scores is clearly declining.
      const history = scoreHistoryRef.current;
      const isScoreStable = history.length < 12
        ? true
        : scoreStdDev(history.slice(-12)) < 12;
      const isScoreTrendingOk = history.length < 8
        ? true
        : scoreSlope(history.slice(-8)) >= -2; // allow at most -2 pts/sec downward drift

      const shouldDetect =
        consecutiveHighRef.current >= DETECTION.SUSTAINED_HIGH_COUNT &&
        isScoreStable &&
        isScoreTrendingOk;

      if (shouldDetect) {
        detectedRef.current = true;
      }

      // Determine detection method from which sensors are active + agree
      const method = resolveMethod(
        accelActiveRef.current,
        micActiveRef.current,
        result.accelScore,
        result.micScore,
      );

      setState({
        isDetected:         shouldDetect,
        confidence:         result.score,
        detectionMethod:    method,
        elapsedSeconds:     Math.round(elapsed),
        accelActive:        accelActiveRef.current,
        micActive:          micActiveRef.current,
        accelScore:         result.accelScore,
        gyroScore:          result.gyroScore,
        micScore:           result.micScore,
        durationScore:      result.durationScore,
        falsePositiveGuard: result.falsePositiveGuard,
      });
    }, EVAL_INTERVAL_MS);

    // ── Mic recovery on screen-off (Redmi battery optimization workaround) ───
    // If screen turns off, mic recording thread may be killed. Restart it on app foreground.
    const appStateListener = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && Platform.OS === 'android') {
        // Screen turned off — try to restart mic in case it was killed
        if (micActiveRef.current || micService.running) {
          console.log('🎤 useSleepDetection: app backgrounded, attempting mic recovery');
          micService.stop().catch(() => {});
          setTimeout(() => {
            micService.start((sample) => {
              micActiveRef.current = true;
              addMic(sample);
            }).catch(() => {
              console.warn('🎤 useSleepDetection: mic recovery failed');
              micActiveRef.current = false;
            });
          }, 500);
        }
      }
    });

    return () => {
      clearInterval(evalId);
      appStateListener.remove();
      motionService.stop();
      micService.stop().catch(() => {});
      notificationBlocker.unblock().catch(() => {});
    };
  // thresholdMinutes is set once from navigation params and won't change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Manual tap fallback (task 2.15) ───────────────────────────────────────

  const onManualTap = useCallback(() => {
    if (detectedRef.current) return;
    detectedRef.current = true;
    setState((prev) => ({
      ...prev,
      isDetected:      true,
      detectionMethod: 'manual_tap',
    }));
  }, []);

  return { state, onManualTap };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns the minimum elapsed seconds before sleep detection can fire.
 * Mattress and pocket have weaker motion signals, so they need more time
 * for the mic's breathing rhythm to establish a reliable score.
 */
function getMinDetectionSeconds(placement: PhonePlacement): number {
  switch (placement) {
    case 'hand':    return 210; // 3.5 min — grip relaxation is a clear, fast signal
    case 'chest':   return 240; // 4 min
    case 'mattress':return 300; // 5 min — accel blind, need breathing rhythm to stabilise
    case 'pocket':  return 300; // 5 min — weakest overall signal
    default:        return 240;
  }
}

/**
 * Computes the least-squares linear slope (points per eval) of a score series.
 * Negative slope = score is declining; used to block detection on a falling trend.
 */
function scoreSlope(scores: number[]): number {
  const n = scores.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = scores.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (scores[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/**
 * Computes the population standard deviation of an array of numbers.
 * Used to detect oscillating confidence scores (awake user with intermittent quiet moments).
 */
function scoreStdDev(scores: number[]): number {
  if (scores.length < 2) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
  return Math.sqrt(variance);
}

function resolveMethod(
  accelActive: boolean,
  micActive:   boolean,
  accelScore:  number,
  micScore:    number,
): DetectionMethod {
  const accelAgrees = accelActive && accelScore >= 50;
  const micAgrees   = micActive   && micScore   >= 40;

  if (accelAgrees && micAgrees) return 'combo';
  if (accelAgrees)              return 'accelerometer';
  if (micAgrees)                return 'mic';
  return 'accelerometer'; // default — at least the accel was sampling
}
