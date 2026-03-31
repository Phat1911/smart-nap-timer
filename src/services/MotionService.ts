import { Accelerometer, Gyroscope } from 'expo-sensors';
import { DETECTION } from '../constants/config';

export interface MotionSample {
  accelVariance: number;
  gyroVariance: number;
  timestamp: number;
}

type MotionCallback = (sample: MotionSample) => void;

class MotionService {
  private accelSubscription: ReturnType<typeof Accelerometer.addListener> | null = null;
  private gyroSubscription: ReturnType<typeof Gyroscope.addListener> | null = null;

  private accelReadings: { x: number; y: number; z: number }[] = [];
  private gyroReadings: { x: number; y: number; z: number }[] = [];

  private callback: MotionCallback | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;

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

  async isAvailable(): Promise<boolean> {
    const [accelAvailable, gyroAvailable] = await Promise.all([
      Accelerometer.isAvailableAsync(),
      Gyroscope.isAvailableAsync(),
    ]);
    return accelAvailable && gyroAvailable;
  }
}

export const motionService = new MotionService();
