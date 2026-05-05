/**
 * useTierGate — Hook to check permission to start a new nap session based on tier limits
 *
 * Responsible for:
 * - Combining useTier() (getting tier) and UsageService (counting today's sessions)
 * - Determining canStart: false when the daily limit has been reached
 * - Providing upgradeReason for the UI to display an appropriate message
 * - Exposing dailyCount and dailyLimit for the progress bar "X/Y naps remaining"
 *
 * Used by:
 * - HomeScreen: displays the upgrade prompt or a disabled Start button
 * - MonitoringScreen: checks again as a second layer of protection (deep-link bypass)
 *
 * Notes:
 * - dailyLimit initialised to 999 to hide the counter while async is loading
 * - loading: true when tier has not yet resolved from AsyncStorage — avoids a UI flash
 *
 * Task 5.2 — useTierGate hook
 * Checks on mount whether the user can start a new nap session today
 * given their current tier's daily limit.
 * Exposes: canStart, showUpgrade, upgradeReason, dailyCount, dailyLimit
 */
// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { useState, useEffect } from 'react';
import { useTier } from './useTier';
import { usageService } from '../services/UsageService';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export interface TierGateResult {
  canStart: boolean;
  showUpgrade: boolean;
  upgradeReason: string;
  dailyCount: number;
  dailyLimit: number;
  loading: boolean;
}

// ─────────────────────────────────────────
// Hook
// ─────────────────────────────────────────

/**
 * Hook to check whether the user is allowed to start a new nap today
 * @returns canStart, showUpgrade, upgradeReason, dailyCount, dailyLimit, loading
 */
export function useTierGate(): TierGateResult {
  const { tier, limits, loading } = useTier();
  const [canStart, setCanStart] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [dailyCount, setDailyCount] = useState(0);
  // Start at 999 (= "unlimited") so the counter is hidden before async resolves
  const [dailyLimit, setDailyLimit] = useState(999);

  useEffect(() => {
    if (loading) return;   // wait for tier to resolve from AsyncStorage
    async function check() {
      const result = await usageService.checkCanStartSession(tier);
      setCanStart(result.allowed);
      setShowUpgrade(!result.allowed);
      setUpgradeReason(result.reason ?? '');
      setDailyCount(result.currentCount);
      setDailyLimit(result.limit);
    }
    check();
  }, [tier, loading]);

  return { canStart, showUpgrade, upgradeReason, dailyCount, dailyLimit, loading };
}
