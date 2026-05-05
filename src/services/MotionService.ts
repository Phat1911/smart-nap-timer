/**
 * MotionService — Manages accelerometer and gyroscope sensor data
 *
 * Responsible for:
 * - Subscribing to Accelerometer + Gyroscope from expo-sensors
 * - Computing the variance of the magnitude vector (√x²+y²+z²) over a 60-second window
 * - Emitting a MotionSample every SAMPLE_INTERVAL_MS for the hook and engine to process
 * - Cleaning up subscriptions and memory on stop()
 *
 * Used by:
 * - useSleepDetection: start() when monitoring begins, stop() on unmount
 * - ConfidenceEngine: receives MotionSample[] to compute accelScore and gyroScore
 *
 * Notes:
 * - Accelerometer and Gyroscope do not require runtime permissions on Android/iOS
 *   (declared in AndroidManifest via app.json; iOS grants automatically)
 * - Keeps at most 120 readings (~60 seconds at 2 Hz) to avoid memory leaks
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { Accelerometer, Gyroscope } from 'expo-sensors';
import { DETECTION } from '../constants/config';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export interface MotionSample {
  accelVariance: number;
  gyroVariance: number;
  timestamp: number;
}

type MotionCallback = (sample: MotionSample) => void;

// ─────────────────────────────────────────
// Class Definition
// ─────────────────────────────────────────

class MotionService {
  private accelSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
  private gyroSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;

  private accelReadings: { x: number; y: number; z: number }[] = [];
  private gyroReadings: { x: number; y: number; z: number }[] = [];

  private callback: MotionCallback | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * Starts collecting sensor data and emits variance every SAMPLE_INTERVAL_MS
   * @param callback - Function that receives a MotionSample each time new data arrives
   */
  start(callback: MotionCallback): void {
    this.callback = callback;

    Accelerometer.setUpdateInterval(DETECTION.SAMPLE_INTERVAL_MS);
    Gyroscope.setUpdateInterval(DETECTION.SAMPLE_INTERVAL_MS);

    this.accelSubscription = Accelerometer.addListener((data) => {
      this.accelReadings.push(data);
      // Keep only last 60 seconds of readings
      if (this.accelReadings.length > 120) this.accelReadings.shift();
    });

    this.gyroSubscription = Gyroscope.addListener((data) => {
      this.gyroReadings.push(data);
      if (this.gyroReadings.length > 120) this.gyroReadings.shift();
    });

    // Emit aggregated variance every SAMPLE_INTERVAL_MS
    this.intervalId = setInterval(() => {
      const accelVariance = this.calculateVariance(this.accelReadings);
      const gyroVariance = this.calculateVariance(this.gyroReadings);
      this.callback?.({ accelVariance, gyroVariance, timestamp: Date.now() });
    }, DETECTION.SAMPLE_INTERVAL_MS);
  }

  /**
   * Stops all sensor subscriptions and clears buffered data
   */
  stop(): void {
    this.accelSubscription?.remove();
    this.gyroSubscription?.remove();
    if (this.intervalId) clearInterval(this.intervalId);
    this.accelReadings = [];
    this.gyroReadings = [];
    this.callback = null;
    this.intervalId = null;
  }

  private calculateVariance(readings: { x: number; y: number; z: number }[]): number {
    if (readings.length < 2) return 0;

    const magnitudes = readings.map((r) =>
      Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z)
    );

    const mean = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const variance =
      magnitudes.reduce((sum, m) => sum + Math.pow(m - mean, 2), 0) /
      magnitudes.length;

    return variance;
  }

  /**
   * Checks whether the device supports both Accelerometer and Gyroscope
   * @returns true if both sensors are available
   */
  async isAvailable(): Promise<boolean> {
    const [accelAvailable, gyroAvailable] = await Promise.all([
      Accelerometer.isAvailableAsync(),
      Gyroscope.isAvailableAsync(),
    ]);
    return accelAvailable && gyroAvailable;
  }
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const motionService = new MotionService();
