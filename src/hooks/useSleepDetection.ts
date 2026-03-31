/**
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

import { useState, useEffect, useRef, useCallback } from 'react';
import { motionService, MotionSample } from '../services/MotionService';
import { micService }                  from '../services/MicService';
import { confidenceEngine }            from '../services/ConfidenceEngine';
import { useRollingWindow }            from './useRollingWindow';
import { DETECTION }                   from '../constants/config';
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
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSleepDetection(thresholdMinutes: number, placement?: PhonePlacement) {
  const [state, setState] = useState<SleepDetectionState>({
    isDetected:      false,
    confidence:      0,
    detectionMethod: 'combo',
    elapsedSeconds:  0,
    accelActive:     false,
    micActive:       false,
  });

  const { addMotion, addMic, getSnapshot, reset } = useRollingWindow();

  const startTimeRef       = useRef(Date.now());
  const consecutiveHighRef = useRef(0);
  const detectedRef        = useRef(false); // idempotency guard
  const accelActiveRef     = useRef(false);
  const micActiveRef       = useRef(false);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(() => {
    startTimeRef.current = Date.now();
    detectedRef.current  = false;
    consecutiveHighRef.current = 0;
    reset();

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
      });

      // Sustained trigger (task 2.10): score must be high for N consecutive evals
      if (result.score >= DETECTION.SLEEP_SCORE_TRIGGER) {
        consecutiveHighRef.current += 1;
      } else {
        consecutiveHighRef.current = 0;
      }

      const shouldDetect =
        consecutiveHighRef.current >= DETECTION.SUSTAINED_HIGH_COUNT;

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
        isDetected:      shouldDetect,
        confidence:      result.score,
        detectionMethod: method,
        elapsedSeconds:  Math.round(elapsed),
        accelActive:     accelActiveRef.current,
        micActive:       micActiveRef.current,
      });
    }, EVAL_INTERVAL_MS);

    return () => {
      clearInterval(evalId);
      motionService.stop();
      micService.stop().catch(() => {});
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
