/**
 * DndService — Controls Do Not Disturb mode on Android
 *
 * Responsible for:
 * - Enabling DND (INTERRUPTION_FILTER_NONE) when a nap begins
 * - Disabling DND (INTERRUPTION_FILTER_ALL) when a nap ends
 * - Requesting ACCESS_NOTIFICATION_POLICY permission if not already granted
 * - All methods are no-ops on iOS (iOS uses a different Focus API)
 *
 * Used by:
 * - MonitoringScreen: enable() on mount, disable() on unmount
 * - MonitoringScreen: isPermissionGranted() and requestPermission() for the DND modal
 *
 * Notes:
 * - DndModule is injected by the withAndroidDnd config plugin — undefined in Expo Go
 * - All methods degrade gracefully when the module is unavailable (no crashes)
 * - MANAGE_NOTIFICATIONS permission must be declared in app.json
 *
 * DndService — Android Do Not Disturb control.
 *
 * Wraps the native DndModule injected by the withAndroidDnd config plugin.
 * All methods are no-ops on iOS (iOS DND requires different Focus APIs).
 *
 * The module will be undefined in Expo Go (no native build); all calls degrade
 * gracefully to avoid crashing in development.
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { NativeModules, Platform } from 'react-native';

// ─────────────────────────────────────────
// Service
// ─────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { DndModule } = NativeModules as { DndModule?: Record<string, (...args: any[]) => Promise<unknown>> };

const isAndroid = Platform.OS === 'android';

const DndService = {
  /**
   * Returns true if the ACCESS_NOTIFICATION_POLICY permission has been granted
   * by the user in system settings. Always returns false on iOS.
   */
  async isPermissionGranted(): Promise<boolean> {
    if (!isAndroid || !DndModule) return false;
    return DndModule.isPermissionGranted() as Promise<boolean>;
  },

  /**
   * Opens the system "Do Not Disturb access" settings screen so the user can
   * grant the permission. No-op on iOS or if the native module is unavailable.
   */
  async requestPermission(): Promise<void> {
    if (!isAndroid || !DndModule) return;
    await DndModule.requestPermission();
  },

  /**
   * Sets the Android interruption filter to INTERRUPTION_FILTER_NONE (total silence).
   * Requires ACCESS_NOTIFICATION_POLICY; rejects if not granted.
   * No-op on iOS.
   */
  async enable(): Promise<void> {
    if (!isAndroid || !DndModule) return;
    await DndModule.enable();
  },

  /**
   * Restores the Android interruption filter to INTERRUPTION_FILTER_ALL.
   * Silently skips if permission is not held (nothing to restore).
   * No-op on iOS.
   */
  async disable(): Promise<void> {
    if (!isAndroid || !DndModule) return;
    await DndModule.disable();
  },
};

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export default DndService;
