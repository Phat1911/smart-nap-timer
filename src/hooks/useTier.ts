/**
 * useTier — Hook to read the current user tier and feature limits
 *
 * Responsible for:
 * - Reading the tier from TierService (AsyncStorage cache) on mount
 * - Automatically refreshing whenever the screen gains focus (useFocusEffect)
 *   to reflect changes immediately after the user upgrades from PaywallScreen
 * - Providing limits: dailyNapLimit, historyLimit, aiEnabled, maxPlacements...
 *
 * Used by:
 * - HomeScreen: limits.maxPlacements for the placement picker
 * - DashboardScreen: limits.historyLimit to slice chart data
 * - WakeScreen: limits.fullReportEnabled to show/hide the insufficient warning
 * - useTierGate: tier to check the daily limit
 *
 * Notes:
 * - Uses useFocusEffect instead of useEffect to re-run every time the screen gains focus
 *   (useEffect only runs once on mount)
 *
 * Task 5.10 — useTier hook
 * Loads the active tier and its feature limits on mount and on every
 * screen focus (so upgrades reflect immediately when returning from Paywall).
 */
// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { tierService } from '../services/TierService';
import { TIER_LIMITS } from '../models/Tier';
import type { TierName, TierLimits } from '../models/Tier';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export interface TierResult {
  tier: TierName;
  limits: TierLimits;
  loading: boolean;
  refresh: () => void;
}

// ─────────────────────────────────────────
// Hook
// ─────────────────────────────────────────

/**
 * Hook to read tier and feature limits — auto-refreshes on every screen focus
 * @returns tier, limits, loading, refresh()
 */
export function useTier(): TierResult {
  const [tier, setTier] = useState<TierName>('free');
  const [limits, setLimits] = useState<TierLimits>(TIER_LIMITS['free']);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const t = await tierService.getCurrentTier();
    setTier(t);
    setLimits(TIER_LIMITS[t]);
    setLoading(false);
  }, []);

  // Run on mount + every time this screen gains focus
  useFocusEffect(
    useCallback(() => { load(); }, [load])
  );

  return { tier, limits, loading, refresh: load };
}
