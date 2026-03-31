/**
 * Task 4.3 — AI model hook
 *
 * On mount:
 *   - Load all sessions from sessionService
 *   - If sessions.length >= AI_ACTIVATION_SESSION (5), train LinearRegression
 *   - Try to reuse persisted weights if trained_on_sessions count matches
 * After each new session save: retrain (caller should re-mount or call refresh)
 *
 * Exposes: isPredicting, predictedLatency, confidence, isAIActive
 */
import { useState, useEffect, useCallback } from 'react';
import { sessionService } from '../services/SessionService';
import { aiModelService } from '../services/AIModelService';
import { LinearRegression } from '../services/LinearRegression';
import { ADAPTIVE } from '../constants/config';
import type { NapSession } from '../models/Session';
import type { TrainingRow, PredictInput } from '../services/LinearRegression';

export interface AIModelResult {
  isPredicting: boolean;
  predictedLatency: number;
  confidence: number;
  isAIActive: boolean;
  /** Call this after saving a new session to retrain immediately */
  retrain: () => Promise<void>;
}

// ── Feature extraction (Task 4.2) ────────────────────────────────────────────

export function sessionsToTrainingRows(sessions: NapSession[]): TrainingRow[] {
  return sessions
    .filter((s) => s.wake_rating !== null)
    .map((s, i) => ({
      hour: s.hour,
      day_of_week: s.day_of_week,
      // prev_latency: use the previous session's latency, or own if first
      prev_latency: i > 0 ? (sessions[i - 1]?.latency_minutes ?? s.latency_minutes) : s.latency_minutes,
      wake_rating: s.wake_rating as number,
      actual_latency: s.latency_minutes,
    }));
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAIModel(): AIModelResult {
  const [result, setResult] = useState<Omit<AIModelResult, 'retrain'>>({
    isPredicting: false,
    predictedLatency: 0,
    confidence: 0,
    isAIActive: false,
  });

  const run = useCallback(async () => {
    const sessions = await sessionService.loadAll();

    if (sessions.length < ADAPTIVE.AI_ACTIVATION_SESSION) {
      setResult({ isPredicting: false, predictedLatency: 0, confidence: 0, isAIActive: false });
      return;
    }

    const model = new LinearRegression();

    // Try to reuse persisted weights (avoids retraining on every mount)
    const saved = await aiModelService.loadWeights();
    if (saved && saved.trained_on_sessions === sessions.length) {
      model.loadWeights(saved);
    } else {
      const rows = sessionsToTrainingRows(sessions);
      model.train(rows);
      await aiModelService.saveWeights(model.getWeights());
    }

    // Predict for current moment using last session's latency as prev_latency
    const last = sessions[sessions.length - 1];
    const now = new Date();
    const input: PredictInput = {
      hour: now.getHours(),
      day_of_week: now.getDay(),
      prev_latency: last.latency_minutes,
      wake_rating: (last.wake_rating ?? 3) as number,
    };
    const predicted = model.predict(input);

    setResult({
      isPredicting: true,
      predictedLatency: Math.round(predicted * 10) / 10,
      confidence: model.confidence,
      isAIActive: true,
    });
  }, []);

  useEffect(() => { run(); }, [run]);

  return { ...result, retrain: run };
}
