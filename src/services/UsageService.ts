/**
 * UsageService — Tracks daily nap session counts and enforces tier limits
 *
 * Responsible for:
 * - Counting how many nap sessions have been started today
 * - Automatically resetting the counter when the date changes (YYYY-MM-DD comparison)
 * - Checking whether the user is allowed to start a new session under their tier
 *
 * Used by:
 * - useTierGate: checkCanStartSession() to display status and the upgrade prompt
 * - SleepingScreen / MonitoringScreen: recordSessionStart() when a nap begins
 * - DevToolsScreen: resetToday() to reset the counter during testing
 *
 * Notes:
 * - Uses YYYY-MM-DD (ISO slice) for date comparison, independent of timezone
 * - Max tier (Infinity daily limit) returns 999 in the UI to hide the counter
 *
 * Task 5.1 -- Usage tracking service
 *
 * Counts how many nap sessions the user has started today,
 * resets the counter at midnight, and gates session starts
 * against the active tier's daily limit.
 */
// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TierName, TIER_LIMITS } from '../models/Tier';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const USAGE_KEY   = '@smart_nap_timer:daily_usage';
const DATE_KEY    = '@smart_nap_timer:usage_date';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

interface UsageRecord {
  date: string;   // YYYY-MM-DD
  count: number;
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function todayString(): string {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

// ─────────────────────────────────────────
// Class Definition
// ─────────────────────────────────────────

class UsageService {
  // ── Internal helpers ───────────────────────────────────────────────────────

  private async getRecord(): Promise<UsageRecord> {
    try {
      const raw = await AsyncStorage.getItem(USAGE_KEY);
      if (!raw) return { date: todayString(), count: 0 };
      const record: UsageRecord = JSON.parse(raw);
      // Auto-reset when the calendar day has rolled over
      if (record.date !== todayString()) {
        return { date: todayString(), count: 0 };
      }
      return record;
    } catch {
      return { date: todayString(), count: 0 };
    }
  }

  private async saveRecord(record: UsageRecord): Promise<void> {
    await AsyncStorage.setItem(USAGE_KEY, JSON.stringify(record));
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Returns how many sessions have been started today */
  async getDailyCount(): Promise<number> {
    const record = await this.getRecord();
    return record.count;
  }

  /**
   * Checks whether the user is allowed to start another session.
   * Returns `allowed: false` with a human-readable `reason` if the
   * daily limit for their tier has been reached.
   */
  async checkCanStartSession(tier: TierName): Promise<{
    allowed: boolean;
    reason?: string;
    currentCount: number;
    limit: number;
  }> {
    const record = await this.getRecord();
    const limit = TIER_LIMITS[tier].dailyNapLimit;
    const allowed = record.count < limit;

    return {
      allowed,
      reason: allowed
        ? undefined
        : limit === Infinity
        ? undefined
        : `You've used all ${limit} nap${limit === 1 ? '' : 's'} for today on your ${tier} plan.`,
      currentCount: record.count,
      limit: limit === Infinity ? 999999 : limit,
    };
  }

  /** Call this immediately when a session actually starts */
  async recordSessionStart(): Promise<void> {
    const record = await this.getRecord();
    record.count += 1;
    await this.saveRecord(record);
    console.log(`📊 UsageService: session recorded. Daily count: ${record.count}`);
  }

  /** Manually reset counter (e.g. after purchasing upgrade) */
  async resetToday(): Promise<void> {
    await this.saveRecord({ date: todayString(), count: 0 });
  }
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const usageService = new UsageService();
