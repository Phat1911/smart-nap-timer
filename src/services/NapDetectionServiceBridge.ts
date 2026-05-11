/**
 * NapDetectionServiceBridge — React Native bridge to native NapDetectionService
 *
 * Provides JS interface to start/stop the foreground service that keeps
 * the app process alive during monitoring/sleeping phases.
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
  /**
   * Start the foreground service.
   * On Android: launches NapDetectionService with foreground notification + WakeLock.
   * On iOS: no-op (iOS handles background execution differently).
   */
  async start(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }
    try {
      // Use the native module to start the service
      const { NapDetectionServiceModule } = NativeModules;
      if (NapDetectionServiceModule && NapDetectionServiceModule.startService) {
        await NapDetectionServiceModule.startService();
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
      const { NapDetectionServiceModule } = NativeModules;
      if (NapDetectionServiceModule && NapDetectionServiceModule.stopService) {
        await NapDetectionServiceModule.stopService();
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
      const { NapDetectionServiceModule } = NativeModules;
      if (NapDetectionServiceModule && NapDetectionServiceModule.isServiceRunning) {
        return await NapDetectionServiceModule.isServiceRunning();
      }
    } catch (error) {
      console.warn('[NapDetectionServiceBridge] isRunning() error:', error);
    }
    return false;
  }
}

export const napDetectionServiceBridge = new NapDetectionServiceBridge();
