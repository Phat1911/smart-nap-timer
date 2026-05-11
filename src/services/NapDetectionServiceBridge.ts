/**
 * NapDetectionServiceBridge — React Native bridge to native NapDetectionService
 *
 * Provides JS interface to start/stop the foreground service that keeps
 * the app process alive during monitoring/sleeping phases.
 *
 * The native module is auto-registered by the withNapDetectionService config plugin
 * during expo prebuild / eas build.
 *
 * Usage:
 *   - MonitoringScreen.tsx: Call napDetectionServiceBridge.start() on mount
 *   - SleepingScreen.tsx: Optionally continue or stop
 *   - WakeScreen.tsx: Call napDetectionServiceBridge.stop() on mount
 */

import { Platform, NativeModules } from 'react-native';

interface INapDetectionServiceBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
}

class NapDetectionServiceBridge implements INapDetectionServiceBridge {
  private getModule() {
    try {
      return NativeModules.NapDetectionServiceModule;
    } catch (error) {
      console.warn('[NapDetectionServiceBridge] Module not available:', error);
      return null;
    }
  }

  /**
   * Start the foreground service.
   * On Android: launches NapDetectionService with foreground notification + WakeLock.
   * On iOS: no-op (iOS handles background execution differently).
   * Gracefully handles missing module (dev/testing scenarios).
   */
  async start(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }
    try {
      const module = this.getModule();
      if (module && module.startService) {
        await module.startService();
      }
    } catch (error) {
      console.warn('[NapDetectionServiceBridge] start() error:', error);
      // Graceful failure: if the service fails to start, detection still works in foreground
    }
  }

  /**
   * Stop the foreground service.
   * Releases the WakeLock and hides the persistent notification.
   */
  async stop(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }
    try {
      const module = this.getModule();
      if (module && module.stopService) {
        await module.stopService();
      }
    } catch (error) {
      console.warn('[NapDetectionServiceBridge] stop() error:', error);
    }
  }

  /**
   * Check if the service is currently running.
   */
  async isRunning(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return false;
    }
    try {
      const module = this.getModule();
      if (module && module.isServiceRunning) {
        return await module.isServiceRunning();
      }
    } catch (error) {
      console.warn('[NapDetectionServiceBridge] isRunning() error:', error);
    }
    return false;
  }
}

export const napDetectionServiceBridge = new NapDetectionServiceBridge();
