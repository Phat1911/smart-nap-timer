/**
 * Tasks 3.8, 3.15, 3.16 — Session summary + insufficient sleep detection
 * Task 4.9 — Shorter target suggestion after 3-streak of insufficient sleep
 * Used by WakeScreen to build the summary card and insufficient sleep warning.
 */
import { useState, useEffect } from 'react';
import { sessionService } from '../services/SessionService';
import { DURATION_SUGGESTIONS } from '../constants/config';
import type { DetectionMethod } from '../models/Session';

export interface SessionSummaryData {
  targetMinutes: number;
  actualMinutes: number;
  latencyMinutes: number;
  detectionMethod: DetectionMethod;
  isInsufficient: boolean;
  missingMinutes: number;
  progressPercent: number;
}

// ── Task 4.9 — Shorter target suggestion ─────────────────────────────────────

export interface InsufficientSuggestionResult {
  shouldSuggestShorterTarget: boolean;
  suggestedTargetMinutes: number;
}

/**
 * Returns a shorter-target suggestion when:
 *   insufficient_streak >= 3  AND  avg_actual_sleep < avg_target * 0.75
 *
 * The suggestion snaps avg_actual_sleep to the nearest standard duration
 * (20 / 60 / 90) that is strictly below the avg target.
 */
export function useInsufficientSuggestion(): InsufficientSuggestionResult {
  const [result, setResult] = useState<InsufficientSuggestionResult>({
    shouldSuggestShorterTarget: false,
    suggestedTargetMinutes: 20,
  });

  useEffect(() => {
    async function check() {
      const sessions = await sessionService.loadAll();
      if (sessions.length < 3) return;

      const stats = await sessionService.getStats();
      if (stats.insufficient_streak < 3) return;

      // Compute avg actual and avg target from the last 3+ sessions
      const recent = sessions.slice(-Math.max(3, stats.insufficient_streak));
      const avgActual =
        recent.reduce((sum, s) => sum + s.actual_sleep_minutes, 0) / recent.length;
      const avgTarget =
        recent.reduce((sum, s) => sum + s.target_minutes, 0) / recent.length;

      if (avgActual >= avgTarget * 0.75) {
        // Not severe enough per spec (actual >= target * 0.75)
        return;
      }

      // Snap avgActual to nearest standard duration that is < avgTarget
      const candidates = DURATION_SUGGESTIONS.map((d) => d.value).filter(
        (v) => v < avgTarget,
      );

      if (candidates.length === 0) {
        // Already at the smallest standard duration; suggest it anyway
        setResult({ shouldSuggestShorterTarget: true, suggestedTargetMinutes: DURATION_SUGGESTIONS[0].value });
        return;
      }

      const snapped = candidates.reduce((best, v) =>
        Math.abs(v - avgActual) < Math.abs(best - avgActual) ? v : best,
      );

      setResult({ shouldSuggestShorterTarget: true, suggestedTargetMinutes: snapped });
    }
    check();
  }, []);

  return result;
}

// ── Session summary builder ───────────────────────────────────────────────────

export function buildSessionSummary(
  targetMinutes: number,
  actualMinutes: number,
  latencyMinutes: number,
  detectionMethod: DetectionMethod,
): SessionSummaryData {
  const isInsufficient = sessionService.isInsufficient(actualMinutes, targetMinutes);
  const missingMinutes = Math.max(0, targetMinutes - actualMinutes);
  const progressPercent = Math.min(100, Math.round((actualMinutes / targetMinutes) * 100));

  return {
    targetMinutes,
    actualMinutes,
    latencyMinutes,
    detectionMethod,
    isInsufficient,
    missingMinutes,
    progressPercent,
  };
}
