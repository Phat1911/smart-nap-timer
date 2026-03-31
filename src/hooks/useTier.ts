/**
 * Task 5.10 — useTier hook
 * Loads the active tier and its feature limits on mount and on every
 * screen focus (so upgrades reflect immediately when returning from Paywall).
 */
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { tierService } from '../services/TierService';
import { TIER_LIMITS } from '../models/Tier';
import type { TierName, TierLimits } from '../models/Tier';

export interface TierResult {
  tier: TierName;
  limits: TierLimits;
  loading: boolean;
  refresh: () => void;
}

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
