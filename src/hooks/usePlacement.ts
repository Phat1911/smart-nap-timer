/**
 * P.5 — usePlacement hook
 * Persists the user's selected phone placements to AsyncStorage so it
 * survives app restarts. Defaults to ['mattress'] on first launch.
 *
 * P.10 — Multi-placement: stores an array of placements.
 * The number of selectable placements is gated by tier (maxPlacements).
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PLACEMENT_PROFILES, DEFAULT_PLACEMENT } from '../constants/config';
import type { PhonePlacement } from '../models/Session';

const PLACEMENTS_KEY = '@smart_nap_timer:phone_placements';

export interface UsePlacementResult {
  /** Currently selected placements (1-4 depending on tier) */
  placements: PhonePlacement[];
  /** Primary (first) placement -- used for single-placement contexts */
  placement: PhonePlacement;
  /** Toggle a placement on/off, respecting maxPlacements cap */
  togglePlacement: (p: PhonePlacement, maxPlacements: number) => Promise<void>;
  /** Set placements directly. Pass maxPlacements to enforce tier cap. */
  setPlacements: (p: PhonePlacement[], maxPlacements?: number) => Promise<void>;
  /** Convenience: resolved profile for primary placement */
  profile: typeof PLACEMENT_PROFILES[PhonePlacement];
  loading: boolean;
}

export function usePlacement(): UsePlacementResult {
  const [placements, setPlacementsState] = useState<PhonePlacement[]>([DEFAULT_PLACEMENT]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(PLACEMENTS_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PhonePlacement[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPlacementsState(parsed);
          }
        } catch {
          // Legacy: single string value
          if (raw in PLACEMENT_PROFILES) {
            setPlacementsState([raw as PhonePlacement]);
          }
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  /**
   * Set placements directly. Pass maxPlacements to enforce a tier cap;
   * omit (or pass Infinity) to allow any number.
   */
  const setPlacements = useCallback(async (p: PhonePlacement[], maxPlacements = Infinity) => {
    const capped = p.slice(0, maxPlacements);
    const next   = capped.length > 0 ? capped : [DEFAULT_PLACEMENT];
    setPlacementsState(next);
    await AsyncStorage.setItem(PLACEMENTS_KEY, JSON.stringify(next));
  }, []);

  const togglePlacement = useCallback(async (p: PhonePlacement, maxPlacements: number) => {
    setPlacementsState((prev) => {
      const isSelected = prev.includes(p);
      let next: PhonePlacement[];

      if (isSelected) {
        // Deselect -- but always keep at least one
        next = prev.length > 1 ? prev.filter((x) => x !== p) : prev;
      } else {
        if (prev.length >= maxPlacements) {
          // At cap: replace the last one (not the first, which is primary)
          next = [...prev.slice(0, maxPlacements - 1), p];
        } else {
          next = [...prev, p];
        }
      }

      AsyncStorage.setItem(PLACEMENTS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const primary = placements[0] ?? DEFAULT_PLACEMENT;

  return {
    placements,
    placement: primary,
    togglePlacement,
    setPlacements,
    profile: PLACEMENT_PROFILES[primary],
    loading,
  };
}

