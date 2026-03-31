/**
 * Task 3.14 — Duration suggestion logic
 * Sessions 1-4: suggest based on time-of-day science defaults.
 *
 * Task 4.8 — AI duration suggestion
 * Sessions 5+: for each candidate duration (20/60/90 min), train a
 * LinearRegression on sessions that used that duration, predict latency for
 * the current context, then pick the duration with the lowest predicted
 * latency. Falls back to wake-rating ranking when a bucket has < 2 sessions.
 */
import { useState, useEffect } from 'react';
import { sessionService } from '../services/SessionService';
import { LinearRegression } from '../services/LinearRegression';
import { sessionsToTrainingRows } from './useAIModel';
import { DURATION_SUGGESTIONS } from '../constants/config';
import type { NapSession } from '../models/Session';
import type { PredictInput } from '../services/LinearRegression';

export interface DurationSuggestion {
  recommendedMinutes: number;
  label: string;
  reason: string;
}

// Science-based defaults per time-of-day
const SCIENCE_DEFAULTS: Record<string, number> = {
  night: 20,
  morning: 20,
  afternoon: 60,
  evening: 20,
};

/** Snap a session's target_minutes to the nearest standard duration bucket */
function snapToBucket(targetMinutes: number): number {
  return DURATION_SUGGESTIONS.reduce((best, opt) =>
    Math.abs(opt.value - targetMinutes) < Math.abs(best.value - targetMinutes)
      ? opt
      : best,
  ).value;
}

/**
 * Train one LinearRegression per duration bucket and predict latency for the
 * current context. Returns a map from bucket value → predicted latency, or
 * null for buckets with < 2 sessions.
 */
function predictPerBucket(
  sessions: NapSession[],
  currentInput: PredictInput,
): Map<number, number> {
  const result = new Map<number, number>();

  for (const { value: bucketMinutes } of DURATION_SUGGESTIONS) {
    const bucketSessions = sessions.filter(
      (s) => snapToBucket(s.target_minutes) === bucketMinutes,
    );
    if (bucketSessions.length < 2) continue;

    const rows = sessionsToTrainingRows(bucketSessions);
    if (rows.length < 2) continue;

    const model = new LinearRegression();
    model.train(rows);
    result.set(bucketMinutes, model.predict(currentInput));
  }

  return result;
}

export function useDurationSuggestion(): DurationSuggestion {
  const [suggestion, setSuggestion] = useState<DurationSuggestion>({
    recommendedMinutes: 60,
    label: '60 min',
    reason: 'Science default',
  });

  useEffect(() => {
    async function compute() {
      const sessions = await sessionService.loadAll();
      const hour = new Date().getHours();
      const tod = sessionService.getTimeOfDay(hour);

      // ── Sessions 1-4: science defaults ────────────────────────────────────
      if (sessions.length < 5) {
        const mins = SCIENCE_DEFAULTS[tod] ?? 60;
        const opt = DURATION_SUGGESTIONS.find((d) => d.value === mins) ?? DURATION_SUGGESTIONS[1];
        setSuggestion({
          recommendedMinutes: mins,
          label: opt.label,
          reason: 'Recommended for this time of day',
        });
        return;
      }

      // ── Sessions 5+: AI per-bucket prediction (Task 4.8) ──────────────────
      const last = sessions[sessions.length - 1];
      const currentInput: PredictInput = {
        hour,
        day_of_week: new Date().getDay(),
        prev_latency: last.latency_minutes,
        wake_rating: (last.wake_rating ?? 3) as number,
      };

      const predictions = predictPerBucket(sessions, currentInput);

      if (predictions.size > 0) {
        // Pick the duration with the lowest predicted latency
        let bestMins = SCIENCE_DEFAULTS[tod] ?? 60;
        let bestLatency = Infinity;
        for (const [mins, latency] of predictions.entries()) {
          if (latency < bestLatency) {
            bestLatency = latency;
            bestMins = mins;
          }
        }
        const opt = DURATION_SUGGESTIONS.find((d) => d.value === bestMins) ?? DURATION_SUGGESTIONS[1];
        setSuggestion({
          recommendedMinutes: bestMins,
          label: opt.label,
          reason: `AI predicts fastest sleep onset (~${Math.round(bestLatency)} min)`,
        });
        return;
      }

      // ── Fallback: highest avg wake rating for this time-of-day ────────────
      const todSessions = sessions.filter(
        (s) => s.time_of_day === tod && s.wake_rating !== null,
      );

      if (todSessions.length === 0) {
        const mins = SCIENCE_DEFAULTS[tod] ?? 60;
        const opt = DURATION_SUGGESTIONS.find((d) => d.value === mins) ?? DURATION_SUGGESTIONS[1];
        setSuggestion({ recommendedMinutes: mins, label: opt.label, reason: 'Science default' });
        return;
      }

      const buckets: Record<number, { sum: number; count: number }> = {};
      for (const s of todSessions) {
        const bucket = snapToBucket(s.target_minutes);
        if (!buckets[bucket]) buckets[bucket] = { sum: 0, count: 0 };
        buckets[bucket].sum += s.wake_rating ?? 0;
        buckets[bucket].count += 1;
      }

      let bestMins = SCIENCE_DEFAULTS[tod] ?? 60;
      let bestAvg = -1;
      for (const [mins, { sum, count }] of Object.entries(buckets)) {
        const avg = sum / count;
        if (avg > bestAvg) { bestAvg = avg; bestMins = Number(mins); }
      }

      const opt = DURATION_SUGGESTIONS.find((d) => d.value === bestMins) ?? DURATION_SUGGESTIONS[1];
      setSuggestion({
        recommendedMinutes: bestMins,
        label: opt.label,
        reason: `Your best rated duration at this time (${bestAvg.toFixed(1)}★ avg)`,
      });
    }
    compute();
  }, []);

  return suggestion;
}
