/**
 * AIModelService — Stores and loads AI model weights (LinearRegression weights)
 *
 * Responsible for:
 * - Serializing AIModelWeights to JSON and saving to AsyncStorage
 * - Loading weights on app restart to avoid retraining from scratch
 * - Providing a helper to check whether the model has been trained on enough sessions
 *
 * Used by:
 * - useAIModel: loadWeights() on mount, saveWeights() after training
 * - DevToolsScreen: clearWeights() to reset the model
 *
 * Notes:
 * - If trained_on_sessions in saved weights matches the current sessions.length,
 *   useAIModel reuses the weights instead of retraining (avoids CPU overhead on every mount)
 *
 * Task 4.5 -- AI model weights persistence
 * Saves and loads LinearRegression weights to/from AsyncStorage so the
 * trained model survives app restarts without retraining from scratch.
 */
// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIModelWeights } from '../models/Session';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const WEIGHTS_KEY = '@smart_nap_timer:ai_weights';

// ─────────────────────────────────────────
// Class Definition
// ─────────────────────────────────────────

class AIModelService {
  // ── Load ──────────────────────────────────────────────────────────────────

  /**
   * Loads saved AI weights from AsyncStorage
   * @returns AIModelWeights or null if the model has never been trained
   */
  async loadWeights(): Promise<AIModelWeights | null> {
    try {
      const raw = await AsyncStorage.getItem(WEIGHTS_KEY);
      return raw ? (JSON.parse(raw) as AIModelWeights) : null;
    } catch {
      return null;
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  /**
   * Saves AI weights to AsyncStorage
   * @param weights - Model weights after training
   */
  async saveWeights(weights: AIModelWeights): Promise<void> {
    try {
      await AsyncStorage.setItem(WEIGHTS_KEY, JSON.stringify(weights));
    } catch {
      // Non-critical -- model will retrain next session if save fails
    }
  }

  // ── Clear ─────────────────────────────────────────────────────────────────

  async clearWeights(): Promise<void> {
    try {
      await AsyncStorage.removeItem(WEIGHTS_KEY);
    } catch {}
  }

  // ── Metadata helpers ──────────────────────────────────────────────────────

  /** Returns true if saved weights exist and were trained on enough sessions */
  async hasTrainedModel(minSessions = 5): Promise<boolean> {
    const weights = await this.loadWeights();
    return weights !== null && weights.trained_on_sessions >= minSessions;
  }

  /** Returns when the model was last trained, or null */
  async lastTrainedAt(): Promise<Date | null> {
    const weights = await this.loadWeights();
    if (!weights?.last_trained) return null;
    return new Date(weights.last_trained);
  }
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const aiModelService = new AIModelService();
