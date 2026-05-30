/**
 * NapDetectionServiceBridge — React Native bridge to native NapDetectionService
 *
 * Provides JS interface to start/stop the foreground service that keeps
 * the app process alive during monitoring/sleeping phases, and collects
 * continuous sensor data even when the screen is off.
 *
 * The native module is auto-registered by the withNapDetectionService config plugin
 * during expo prebuild / eas build.
 *
 * Usage:
 *   - MonitoringScreen.tsx: Call napDetectionServiceBridge.start() on mount
 *   - useSleepDetection.ts: Subscribe to onSensorDataStream() for background mic/motion
 *   - WakeScreen.tsx: Call napDetectionServiceBridge.stop() on mount
 */

import { Platform, NativeModules, NativeEventEmitter } from 'react-native';

export interface BackgroundSensorData {
  accel: Array<[number, number, number]>;
  gyro: Array<[number, number, number]>;
  mic: Uint8Array[];
}

interface INapDetectionServiceBridge {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
  startSensorCollection(): Promise<void>;
  stopSensorCollection(): Promise<void>;
  onSensorDataStream(callback: (data: BackgroundSensorData) => void): () => void;
}

class NapDetectionServiceBridge implements INapDetectionServiceBridge {
  private eventEmitter: NativeEventEmitter | null = null;
  private sensorDataSubscription: any = null;

  isAvailable(): boolean {
    return Platform.OS === 'android' && !!NativeModules.NapDetectionServiceModule;
  }

  private getModule() {
    return NativeModules.NapDetectionServiceModule ?? null;
  }

  private getEventEmitter(): NativeEventEmitter | null {
    if (Platform.OS !== 'android') return null;
    if (this.eventEmitter) return this.eventEmitter;

    try {
      const module = this.getModule();
      if (module) {
        this.eventEmitter = new NativeEventEmitter(module);
        return this.eventEmitter;
      }
    } catch (error) {
      console.warn('[NapDetectionServiceBridge] Could not create event emitter:', error);
    }
    return null;
  }

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
      const module = this.getModule();
      if (module && module.startService) {
        await module.startService();
      }
    } catch (error) {
      console.warn('[NapDetectionServiceBridge] start() error:', error);
      throw error;
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

  /**
   * Start background sensor collection (mic + motion).
   * Enables continuous data collection even when screen is off.
   */
  async startSensorCollection(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }
    try {
      const module = this.getModule();
      if (module && module.startSensorCollection) {
        await module.startSensorCollection();
      }
    } catch (error) {
      console.warn('[NapDetectionServiceBridge] startSensorCollection() error:', error);
      throw error;
    }
  }

  /**
   * Stop background sensor collection.
   */
  async stopSensorCollection(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }
    try {
      const module = this.getModule();
      if (module && module.stopSensorCollection) {
        await module.stopSensorCollection();
      }
    } catch (error) {
      console.warn('[NapDetectionServiceBridge] stopSensorCollection() error:', error);
    }
  }

  /**
   * Subscribe to background sensor data stream.
   * Returns an unsubscribe function.
   */
  onSensorDataStream(callback: (data: BackgroundSensorData) => void): () => void {
    if (Platform.OS !== 'android') {
      return () => {};
    }

    const emitter = this.getEventEmitter();
    if (!emitter) {
      console.warn('[NapDetectionServiceBridge] Event emitter not available');
      return () => {};
    }

    try {
      this.sensorDataSubscription = emitter.addListener(
        'NapDetectionSensorData',
        (event: any) => {
          try {
            const data: BackgroundSensorData = {
              accel: event.accel || [],
              gyro: event.gyro || [],
              mic: (event.mic || []).map((base64: string) => {
                const str = atob(base64);
                const arr = new Uint8Array(str.length);
                for (let i = 0; i < str.length; i++) {
                  arr[i] = str.charCodeAt(i);
                }
                return arr;
              }),
            };
            callback(data);
          } catch (e) {
            console.warn('[NapDetectionServiceBridge] Error processing sensor data:', e);
          }
        },
      );

      // Return unsubscribe function
      return () => {
        this.sensorDataSubscription?.remove();
        this.sensorDataSubscription = null;
      };
    } catch (error) {
      console.warn('[NapDetectionServiceBridge] onSensorDataStream() error:', error);
      return () => {};
    }
  }
}

export const napDetectionServiceBridge = new NapDetectionServiceBridge();
