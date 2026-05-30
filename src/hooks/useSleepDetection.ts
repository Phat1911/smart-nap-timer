import { useCallback, useEffect, useRef, useState } from 'react';
import { DETECTION, getSleepScoreTrigger } from '../constants/config';
import type { DetectionMethod, PhonePlacement } from '../models/Session';
import { confidenceEngine } from '../services/ConfidenceEngine';
import { micService, MicSample } from '../services/MicService';
import { motionService, MotionSample } from '../services/MotionService';
import { napDetectionServiceBridge } from '../services/NapDetectionServiceBridge';
import { useRollingWindow } from './useRollingWindow';

const EVAL_INTERVAL_MS = DETECTION.SAMPLE_INTERVAL_MS * 2;

export interface SleepDetectionState {
  isDetected: boolean;
  confidence: number;
  detectionMethod: DetectionMethod;
  elapsedSeconds: number;
  accelActive: boolean;
  micActive: boolean;
  accelScore: number;
  gyroScore: number;
  micScore: number;
  durationScore: number;
  falsePositiveGuard: boolean;
}

export function useSleepDetection(
  thresholdMinutes: number,
  placement?: PhonePlacement,
  placements?: PhonePlacement[],
) {
  const [state, setState] = useState<SleepDetectionState>({
    isDetected: false,
    confidence: 0,
    detectionMethod: 'combo',
    elapsedSeconds: 0,
    accelActive: false,
    micActive: false,
    accelScore: 0,
    gyroScore: 0,
    micScore: 0,
    durationScore: 0,
    falsePositiveGuard: false,
  });

  const { addMotion, addMic, getSnapshot, reset } = useRollingWindow();

  const startTimeRef = useRef(Date.now());
  const consecutiveHighRef = useRef(0);
  const scoreHistoryRef = useRef<number[]>([]);
  const lastMovementTimeRef = useRef<number | null>(null);
  const detectedRef = useRef(false);
  const accelActiveRef = useRef(false);
  const micActiveRef = useRef(false);
  const warnedMicDeathRef = useRef(false);
  const unsubscribeSensorDataRef = useRef<(() => void) | null>(null);
  const usingNativeRef = useRef(false);

  useEffect(() => {
    startTimeRef.current = Date.now();
    detectedRef.current = false;
    warnedMicDeathRef.current = false;
    consecutiveHighRef.current = 0;
    scoreHistoryRef.current = [];
    lastMovementTimeRef.current = null;
    accelActiveRef.current = false;
    micActiveRef.current = false;
    usingNativeRef.current = false;

    reset();
    confidenceEngine.resetSession();

    const startNative = async () => {
      if (!napDetectionServiceBridge.isAvailable()) {
        return false;
      }

      try {
        await napDetectionServiceBridge.start();
        await napDetectionServiceBridge.startSensorCollection();

        unsubscribeSensorDataRef.current = napDetectionServiceBridge.onSensorDataStream((data) => {
          usingNativeRef.current = true;
          const nowTs = Date.now();

          let accelVariance = 0;
          if (data.accel && data.accel.length > 0) {
            const mags = data.accel.map((v: [number, number, number]) =>
              Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
            );
            const mean = mags.reduce((a: number, b: number) => a + b, 0) / mags.length;
            accelVariance = mags.reduce((s: number, m: number) => s + (m - mean) * (m - mean), 0) / mags.length;
          }

          let gyroVariance = 0;
          if (data.gyro && data.gyro.length > 0) {
            const magsG = data.gyro.map((v: [number, number, number]) =>
              Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]),
            );
            const meanG = magsG.reduce((a: number, b: number) => a + b, 0) / magsG.length;
            gyroVariance = magsG.reduce((s: number, m: number) => s + (m - meanG) * (m - meanG), 0) / magsG.length;
          }

          if ((data.accel && data.accel.length > 0) || (data.gyro && data.gyro.length > 0)) {
            const sample: MotionSample = {
              timestamp: nowTs,
              accelVariance,
              gyroVariance,
            };
            accelActiveRef.current = true;
            const { wasReset } = addMotion(sample);
            if (wasReset) {
              consecutiveHighRef.current = 0;
              scoreHistoryRef.current = [];
              lastMovementTimeRef.current = (Date.now() - startTimeRef.current) / 1000;
            }
          }

          for (const micDataRaw of data.mic || []) {
            try {
              const micArr = micDataRaw as Uint8Array;
              const dv = new DataView(micArr.buffer, micArr.byteOffset, micArr.byteLength);
              const sampleCount = Math.floor(micArr.byteLength / 2);
              if (sampleCount <= 0) continue;

              let sumSq = 0;
              for (let i = 0; i < sampleCount; i++) {
                const v = dv.getInt16(i * 2, true);
                sumSq += v * v;
              }
              const meanSq = sumSq / sampleCount;
              const rms = Math.sqrt(meanSq) / 32768;
              const meterDb = rms <= 1e-5 ? -140 : 20 * Math.log10(rms);

              const sample: MicSample = { timestamp: nowTs, metering: meterDb };
              micActiveRef.current = true;
              warnedMicDeathRef.current = false;
              addMic(sample);
            } catch (e) {
              console.warn('useSleepDetection: failed to convert native mic chunk', e);
            }
          }
        });

        usingNativeRef.current = true;
        console.log('useSleepDetection: using native foreground sensor path');
        return true;
      } catch (error) {
        console.warn('useSleepDetection: native foreground path unavailable, falling back to Expo sensors', error);
        return false;
      }
    };

    const startFallback = () => {
      motionService.start((sample: MotionSample) => {
        accelActiveRef.current = true;
        const { wasReset } = addMotion(sample);
        if (wasReset) {
          consecutiveHighRef.current = 0;
          scoreHistoryRef.current = [];
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          lastMovementTimeRef.current = elapsed;
        }
      });

      micService
        .start((sample: MicSample) => {
          micActiveRef.current = true;
          warnedMicDeathRef.current = false;
          addMic(sample);
        })
        .catch((error) => {
          console.warn('useSleepDetection: microphone failed to start', error);
        });
    };

    void (async () => {
      const nativeStarted = await startNative();
      if (!nativeStarted) {
        startFallback();
      }
    })();

    const evalId = setInterval(() => {
      if (detectedRef.current) return;

      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const { motionSamples, micSamples } = getSnapshot();

      const result = confidenceEngine.compute({
        motionSamples,
        micSamples,
        elapsedSeconds: elapsed,
        thresholdMinutes,
        placement,
        placements,
      });

      scoreHistoryRef.current = [...scoreHistoryRef.current.slice(-14), result.score];

      if (result.accelScore < 45) {
        lastMovementTimeRef.current = elapsed;
      }

      const primaryPlacement = (placements && placements[0]) ?? placement ?? 'mattress';
      const baseMin = getMinDetectionSeconds(primaryPlacement);
      const movementMin =
        lastMovementTimeRef.current !== null ? lastMovementTimeRef.current + 90 : 0;
      const effectiveMin = Math.max(baseMin, movementMin);

      const trigger = getSleepScoreTrigger();
      if (result.score >= trigger && elapsed >= effectiveMin) {
        consecutiveHighRef.current += 1;
      } else if (result.score < trigger - 8) {
        consecutiveHighRef.current = 0;
      }

      const history = scoreHistoryRef.current;
      const isScoreStable = history.length < 12 ? true : scoreStdDev(history.slice(-12)) < 12;
      const isScoreTrendingOk = history.length < 8 ? true : scoreSlope(history.slice(-8)) >= -2;

      const shouldDetect =
        consecutiveHighRef.current >= DETECTION.SUSTAINED_HIGH_COUNT &&
        isScoreStable &&
        isScoreTrendingOk;

      if (shouldDetect) {
        detectedRef.current = true;
      }

      const method = resolveMethod(
        accelActiveRef.current,
        micActiveRef.current,
        result.accelScore,
        result.micScore,
      );

      setState({
        isDetected: shouldDetect,
        confidence: result.score,
        detectionMethod: method,
        elapsedSeconds: Math.round(elapsed),
        accelActive: accelActiveRef.current,
        micActive: micActiveRef.current,
        accelScore: result.accelScore,
        gyroScore: result.gyroScore,
        micScore: result.micScore,
        durationScore: result.durationScore,
        falsePositiveGuard: result.falsePositiveGuard,
      });

      if (micActiveRef.current && !micService.running && !warnedMicDeathRef.current) {
        warnedMicDeathRef.current = true;
        console.warn(
          `useSleepDetection: mic stopped unexpectedly at ${elapsed.toFixed(1)}s (possible battery optimization)`
        );
        micActiveRef.current = false;
      }
    }, EVAL_INTERVAL_MS);

    let lastHealthCheckTime = 0;
    const healthCheckInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastHealthCheckTime < 5000) return;
      lastHealthCheckTime = now;

      const micUptime = micService.getUptime();
      const timeSinceLastMeter = micService.getTimeSinceLastMeter();

      if (micActiveRef.current && micUptime > 0) {
        console.log(
          `MIC HEALTH: uptime=${Math.round(micUptime / 1000)}s, lastMeter=${timeSinceLastMeter}ms`
        );
        if (timeSinceLastMeter > 3000) {
          console.warn(`MIC UNRESPONSIVE: no data for ${Math.round(timeSinceLastMeter / 1000)}s`);
        }
      }
    }, 1000);

    return () => {
      clearInterval(evalId);
      clearInterval(healthCheckInterval);
      if (usingNativeRef.current) {
        napDetectionServiceBridge.stopSensorCollection().catch(() => {});
        napDetectionServiceBridge.stop().catch(() => {});
      } else {
        motionService.stop();
        micService.stop().catch(() => {});
      }
      unsubscribeSensorDataRef.current?.();
    };
    // thresholdMinutes / placement params are set at screen entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onManualTap = useCallback(() => {
    if (detectedRef.current) return;
    detectedRef.current = true;
    setState((prev) => ({
      ...prev,
      isDetected: true,
      detectionMethod: 'manual_tap',
    }));
  }, []);

  return { state, onManualTap };
}

function getMinDetectionSeconds(placement: PhonePlacement): number {
  switch (placement) {
    case 'hand':
      return 210;
    case 'chest':
      return 240;
    case 'mattress':
      return 300;
    case 'pocket':
      return 300;
    default:
      return 240;
  }
}

function scoreSlope(scores: number[]): number {
  const n = scores.length;
  if (n < 2) return 0;

  const xMean = (n - 1) / 2;
  const yMean = scores.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i += 1) {
    numerator += (i - xMean) * (scores[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

function scoreStdDev(scores: number[]): number {
  if (scores.length === 0) return 0;

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, value) => sum + (value - mean) ** 2, 0) / scores.length;
  return Math.sqrt(variance);
}

function resolveMethod(
  accelActive: boolean,
  micActive: boolean,
  accelScore: number,
  micScore: number,
): DetectionMethod {
  const accelAgrees = accelActive && accelScore >= 50;
  const micAgrees = micActive && micScore >= 40;

  if (accelAgrees && micAgrees) return 'combo';
  if (accelAgrees) return 'accelerometer';
  if (micAgrees) return 'mic';

  return accelActive ? 'accelerometer' : 'mic';
}
