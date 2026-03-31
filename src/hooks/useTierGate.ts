/**
 * Task 5.2 — useTierGate hook
 * Checks on mount whether the user can start a new nap session today
 * given their current tier's daily limit.
 * Exposes: canStart, showUpgrade, upgradeReason, dailyCount, dailyLimit
 */
import { useState, useEffect } from 'react';
import { useTier } from './useTier';
import { usageService } from '../services/UsageService';

export interface TierGateResult {
  canStart: boolean;
  showUpgrade: boolean;
  upgradeReason: string;
  dailyCount: number;
  dailyLimit: number;
}

export function useTierGate(): TierGateResult {
  const { tier, limits } = useTier();
  const [canStart, setCanStart] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState('');
  const [dailyCount, setDailyCount] = useState(0);
  // Start at 999 (= "unlimited") so the counter is hidden before async resolves
  const [dailyLimit, setDailyLimit] = useState(999);

  useEffect(() => {
    async function check() {
      const result = await usageService.checkCanStartSession(tier);
      setCanStart(result.allowed);
      setShowUpgrade(!result.allowed);
      setUpgradeReason(result.reason ?? '');
      setDailyCount(result.currentCount);
      setDailyLimit(result.limit);
    }
    check();
  }, [tier]);

  return { canStart, showUpgrade, upgradeReason, dailyCount, dailyLimit };
}
