/**
 * useAdaptiveThreshold — Hook that computes an adaptive sleep threshold based on history
 *
 * Responsible for:
 * - First session: uses DEFAULT_THRESHOLD_MINUTES (5 minutes) as baseline
 * - Subsequent sessions: reads threshold from the correct time-of-day bucket (night/morning/afternoon/evening)
 * - Threshold is updated after each session by SessionService.updateThreshold()
 * - Each placement has its own bucket (P.9) to avoid cross-contamination
 *
 * Used by:
 * - HomeScreen: gets thresholdMinutes to display and pass to MonitoringScreen
 * - MonitoringScreen: receives via route params
 *
 * Notes:
 * - EMA formula: T_next = prev * 0.7 + last_latency * 0.3 (ADAPTIVE constants)
 * - Clamped to [MIN_THRESHOLD_MINUTES, MAX_THRESHOLD_MINUTES] = [3, 10] minutes
 *
 * Tasks 3.4, 3.5, 3.6, 3.7 — Adaptive threshold hook
 *
 * 3.4  Session 1 → default T = 5 min (first-run calibration)
 * 3.5  Session 2+ → T_next = (avg * 0.7) + (last * 0.3) per time-of-day bucket
 * 3.6  Separate threshold buckets: night / morning / afternoon / evening
 * 3.7  T is clamped between MIN_THRESHOLD_MINUTES and MAX_THRESHOLD_MINUTES
 *       (clamping happens inside sessionService.updateThreshold, already built)
 */
// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { useState, useEffect } from 'react';
import { sessionService } from '../services/SessionService';
import { DETECTION, DEFAULT_PLACEMENT } from '../constants/config';
import type { PhonePlacement } from '../models/Session';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export interface AdaptiveThresholdResult {
  thresholdMinutes: number;
  isFirstSession: boolean;
  sessionCount: number;
}

// ─────────────────────────────────────────
// Hook
// ─────────────────────────────────────────

/**
 * Hook that reads the adaptive threshold for the selected placement at the current time
 * @param placement - Phone placement (default: 'mattress')
 * @returns thresholdMinutes, isFirstSession, sessionCount
 */
export function useAdaptiveThreshold(placement: PhonePlacement = DEFAULT_PLACEMENT): AdaptiveThresholdResult {
  const [result, setResult] = useState<AdaptiveThresholdResult>({
    thresholdMinutes: DETECTION.DEFAULT_THRESHOLD_MINUTES,
    isFirstSession: true,
    sessionCount: 0,
  });

  useEffect(() => {
    async function load() {
      const [sessions, threshold] = await Promise.all([
        sessionService.loadAll(),
        sessionService.getThreshold(placement),
      ]);

      const hour = new Date().getHours();
      const tod = sessionService.getTimeOfDay(hour);
      const t = threshold[tod];
      const isFirst = sessions.length === 0;

      setResult({
        // Session 1: use default (3.4). Session 2+: use adaptive value (3.5/3.6/3.7)
        thresholdMinutes: isFirst ? DETECTION.DEFAULT_THRESHOLD_MINUTES : t,
        isFirstSession: isFirst,
        sessionCount: sessions.length,
      });
    }
    load();
  }, [placement]);

  return result;
}
