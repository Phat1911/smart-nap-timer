/**
 * P.5 — usePlacement hook
 * Persists the user's selected phone placement to AsyncStorage so it
 * survives app restarts. Defaults to 'mattress' on first launch.
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PLACEMENT_PROFILES, DEFAULT_PLACEMENT } from '../constants/config';
import type { PhonePlacement } from '../models/Session';

const PLACEMENT_KEY = '@smart_nap_timer:phone_placement';

export interface UsePlacementResult {
  placement: PhonePlacement;
  setPlacement: (p: PhonePlacement) => Promise<void>;
  /** Convenience: resolved profile for current placement */
  profile: typeof PLACEMENT_PROFILES[PhonePlacement];
  loading: boolean;
}

export function usePlacement(): UsePlacementResult {
  const [placement, setPlacementState] = useState<PhonePlacement>(DEFAULT_PLACEMENT);
  const [loading, setLoading] = useState(true);

  // Load persisted placement on mount
  useEffect(() => {
    AsyncStorage.getItem(PLACEMENT_KEY).then((raw) => {
      if (raw && raw in PLACEMENT_PROFILES) {
        setPlacementState(raw as PhonePlacement);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Persist + update state
  const setPlacement = useCallback(async (p: PhonePlacement) => {
    setPlacementState(p);
    await AsyncStorage.setItem(PLACEMENT_KEY, p);
  }, []);

  return {
    placement,
    setPlacement,
    profile: PLACEMENT_PROFILES[placement],
    loading,
  };
}
