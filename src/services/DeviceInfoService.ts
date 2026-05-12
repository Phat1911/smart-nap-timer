/**
 * DeviceInfoService — Utility to check device-level battery optimization status
 *
 * Responsible for:
 * - Checking if the app is whitelisted from battery optimization on Android
 * - Helping users understand why they need to whitelist the app for mic persistence
 *
 * Used by:
 * - MonitoringScreen: checks isIgnoringBatteryOptimizations() to show prompt
 */

import { Platform, NativeModules } from 'react-native';

class DeviceInfoService {
  /**
   * Checks whether the app is whitelisted from Redmi/OEM battery optimization.
   * Returns true if the app is NOT affected by battery optimization (i.e., can run background tasks freely).
   * Returns false if the app IS subject to battery optimization.
   */
  async isIgnoringBatteryOptimizations(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true; // iOS doesn't have equivalent restrictions
    }

    try {
      // If native module exists, use it to check battery optimization status
      const module = NativeModules.DeviceInfoModule;
      if (module && typeof module.isIgnoringBatteryOptimizations === 'function') {
        return await module.isIgnoringBatteryOptimizations();
      }
    } catch (error) {
      console.warn('DeviceInfoService: failed to check battery optimization', error);
    }

    // Fallback: assume not whitelisted if we can't determine
    return false;
  }
}

export const deviceInfoService = new DeviceInfoService();
