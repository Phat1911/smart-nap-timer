/**
 * useScreenDim — Hook to dim the screen while sleeping and restore it on unmount
 *
 * Responsible for:
 * - Saving the current brightness before dimming
 * - Setting brightness to DIM_BRIGHTNESS (0.02) on mount
 * - Restoring the original brightness on unmount (cleanup)
 *
 * Used by:
 * - SleepingScreen: calls useScreenDim() to dim the screen throughout the countdown
 *
 * Notes:
 * - Uses expo-brightness (Expo SDK transitive dep, no separate install needed)
 * - Android: setBrightnessAsync() changes window brightness (no permission needed)
 * - iOS: adjusts system brightness (iOS 11+)
 * - DIM_BRIGHTNESS = 0.02: dark enough not to disturb sleep but countdown still visible
 *
 * Task 2.21 — useScreenDim
 *
 * Dims the screen to a very low brightness when the sleeping screen is active,
 * then restores the original brightness on unmount.
 *
 * Uses expo-brightness (already a transitive Expo SDK dependency).
 * On Android, Brightness.setBrightnessAsync() controls the current window
 * brightness (no special permission needed for window-level brightness).
 * On iOS, it adjusts the system brightness — iOS 11+ allows this.
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { useEffect } from 'react';
import * as Brightness from 'expo-brightness';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

// Chosen to keep the screen barely visible for the countdown
const DIM_BRIGHTNESS = 0.02;

// ─────────────────────────────────────────
// Hook
// ─────────────────────────────────────────

export function useScreenDim(): void {
  useEffect(() => {
    let original: number | null = null;

    (async () => {
      try {
        original = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(DIM_BRIGHTNESS);
      } catch {
        // Brightness permission may not be available on all platforms/simulators
      }
    })();

    return () => {
      if (original !== null) {
        Brightness.setBrightnessAsync(original).catch(() => {});
      }
    };
  }, []);
}
