/**
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

import { useEffect } from 'react';
import * as Brightness from 'expo-brightness';

// Chosen to keep the screen barely visible for the countdown
const DIM_BRIGHTNESS = 0.02;

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
