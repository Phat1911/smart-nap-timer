/**
 * useRollingWindow — Hook to manage a 5-minute rolling window for sensor data
 *
 * Responsible for:
 * - Maintaining and pruning MotionSample + MicSample within a 5-minute window
 * - Checking the stillness ratio >= 95% in the window
 * - Tolerating brief movement < 30s (wiggle tolerance)
 * - Resetting the entire window when movement is sustained >= 30s
 *
 * Used by:
 * - useSleepDetection: addMotion(), addMic() per sample, getSnapshot() per evaluation
 *
 * Notes:
 * - All state uses useRef (not useState) to avoid re-renders on each new sample
 *   (sensors emit at 2 Hz = 120 times/min — re-rendering per sample would lag the UI)
 * - getSnapshot() is safe to call from setInterval outside the component lifecycle
 *
 * Tasks 2.6 / 2.7 / 2.8 — useRollingWindow
 *
 * Maintains a 5-minute rolling window of MotionSample + MicSample data.
 *
 * Task 2.6 — 5-min window + 95 % stillness check
 *   Prunes samples older than ROLLING_WINDOW_MINUTES.
 *   isStill = true when ≥ STILLNESS_PERCENTAGE (95 %) of motion samples in
 *   the window have accelVariance < STILL_ACCEL_VARIANCE.
 *
 * Task 2.7 — Wiggle tolerance: brief movement < 30 s does NOT reset
 *   Movement is only tracked once it has been sustained; short wiggles
 *   (phone shifts, micro-arousals) are tolerated.
 *
 * Task 2.8 — Sustained movement > 30 s resets detection
 *   If movement continues for RESET_MOVEMENT_SECONDS the entire window is
 *   cleared and addMotion returns { wasReset: true } so the caller
 *   (useSleepDetection) can reset its consecutive-high counter.
 *
 * Design notes:
 *   • Uses only refs internally → zero re-renders per sample tick.
 *   • getSnapshot() is called by useSleepDetection's setInterval to feed
 *     the ConfidenceEngine at a controlled rate.
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { useRef, useCallback } from 'react';
import { MotionSample } from '../services/MotionService';
import { MicSample }    from '../services/MicService';
import { DETECTION }    from '../constants/config';

const WINDOW_MS = DETECTION.ROLLING_WINDOW_MINUTES * 60 * 1_000;
const RESET_MS  = DETECTION.RESET_MOVEMENT_SECONDS * 1_000;

// ── Public types ──────────────────────────────────────────────────────────────

export interface RollingWindowSnapshot {
  motionSamples: MotionSample[];
  micSamples:    MicSample[];
  /** True when ≥ 95 % of window samples are still (task 2.6) */
  isStill:       boolean;
}

export interface RollingWindowHandle {
  /** Feed a new motion sample. Returns { wasReset } (task 2.8). */
  addMotion: (sample: MotionSample) => { wasReset: boolean };
  /** Feed a new mic sample. */
  addMic:    (sample: MicSample)   => void;
  /** Snapshot of the current window, safe to pass to ConfidenceEngine. */
  getSnapshot: () => RollingWindowSnapshot;
  /** Externally clear the window (e.g. on Cancel). */
  reset: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Hook that creates and manages the sensor rolling window — zero re-renders per sample tick
 * @returns RollingWindowHandle with addMotion, addMic, getSnapshot, reset
 */
export function useRollingWindow(): RollingWindowHandle {
  const motionRef        = useRef<MotionSample[]>([]);
  const micRef           = useRef<MicSample[]>([]);
  /** Timestamp when sustained movement first began; null = no movement. */
  const movementStartRef = useRef<number | null>(null);

  // ── Prune samples older than WINDOW_MS ────────────────────────────────────

  const pruneMotion = (now: number) => {
    motionRef.current = motionRef.current.filter(
      (s) => now - s.timestamp <= WINDOW_MS,
    );
  };

  const pruneMic = (now: number) => {
    micRef.current = micRef.current.filter(
      (s) => now - s.timestamp <= WINDOW_MS,
    );
  };

  // ── stillness check (task 2.6) ────────────────────────────────────────────

  const computeIsStill = (samples: MotionSample[]): boolean => {
    if (samples.length < 5) return false;
    const stillCount = samples.filter(
      (s) => s.accelVariance < DETECTION.STILL_ACCEL_VARIANCE,
    ).length;
    return stillCount / samples.length >= DETECTION.STILLNESS_PERCENTAGE;
  };

  // ── addMotion ──────────────────────────────────────────────────────────────

  const addMotion = useCallback((sample: MotionSample): { wasReset: boolean } => {
    const now = sample.timestamp;
    motionRef.current.push(sample);
    pruneMotion(now);

    const isSampleStill = sample.accelVariance < DETECTION.STILL_ACCEL_VARIANCE;

    if (isSampleStill) {
      // Still → cancel any pending movement timer (task 2.7 wiggle tolerance)
      movementStartRef.current = null;
    } else {
      // Moving
      if (movementStartRef.current === null) {
        // Start tracking how long movement has been sustained (task 2.7)
        movementStartRef.current = now;
      } else if (now - movementStartRef.current >= RESET_MS) {
        // Sustained movement > 30 s → full reset (task 2.8)
        motionRef.current      = [];
        micRef.current         = [];
        movementStartRef.current = null;
        return { wasReset: true };
      }
      // Brief movement < 30 s: tolerated, window kept intact (task 2.7)
    }

    return { wasReset: false };
  }, []);

  // ── addMic ────────────────────────────────────────────────────────────────

  const addMic = useCallback((sample: MicSample): void => {
    micRef.current.push(sample);
    pruneMic(sample.timestamp);
  }, []);

  // ── getSnapshot ───────────────────────────────────────────────────────────

  const getSnapshot = useCallback((): RollingWindowSnapshot => ({
    motionSamples: motionRef.current,
    micSamples:    micRef.current,
    isStill:       computeIsStill(motionRef.current),
  }), []);

  // ── reset ─────────────────────────────────────────────────────────────────

  const reset = useCallback((): void => {
    motionRef.current        = [];
    micRef.current           = [];
    movementStartRef.current = null;
  }, []);

  return { addMotion, addMic, getSnapshot, reset };
}
