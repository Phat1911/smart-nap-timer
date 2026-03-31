/**
 * Task 4.5 -- AI model weights persistence
 * Saves and loads LinearRegression weights to/from AsyncStorage so the
 * trained model survives app restarts without retraining from scratch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIModelWeights } from '../models/Session';

const WEIGHTS_KEY = '@smart_nap_timer:ai_weights';

class AIModelService {
  // ── Load ──────────────────────────────────────────────────────────────────

  async loadWeights(): Promise<AIModelWeights | null> {
    try {
      const raw = await AsyncStorage.getItem(WEIGHTS_KEY);
      return raw ? (JSON.parse(raw) as AIModelWeights) : null;
    } catch {
      return null;
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

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

export const aiModelService = new AIModelService();
