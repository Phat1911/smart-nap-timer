/**
 * MicService — Manages audio recording and metering level capture from the microphone
 *
 * Responsible for:
 * - Configuring the iOS audio session (allowsRecordingIOS, playsInSilentModeIOS)
 * - Starting LOW_QUALITY recording with metering enabled
 * - Polling metering every 500 ms and emitting MicSamples via callback
 * - Stopping recording and restoring audio mode to playback mode on stop()
 *
 * Used by:
 * - useSleepDetection: start() when monitoring begins, stop() on unmount
 * - BreathingDetector: receives MicSample[] for breathing rhythm analysis
 *
 * Notes:
 * - Requires microphone permission (RECORD_AUDIO on Android, NSMicrophoneUsageDescription on iOS)
 *   — requested by usePermissions() before MicService.start() is called
 * - If start() fails (permission denied), isRunning will be false and
 *   useSleepDetection will operate in accel-only mode
 * - stop() always restores audio mode so AudioService can play white noise afterwards
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { Audio } from 'expo-av';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export interface MicSample {
  metering: number;   // dB level, typically -160 to 0
  timestamp: number;
}

type MicCallback = (sample: MicSample) => void;

// ─────────────────────────────────────────
// Class Definition
// ─────────────────────────────────────────

class MicService {
  private recording: Audio.Recording | null = null;
  private callback: MicCallback | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /**
   * Starts recording and emits a MicSample every 500 ms
   * @param callback - Function that receives MicSample (metering dB + timestamp)
   * @throws Does not throw — errors are caught internally and isRunning will be false
   */
  async start(callback: MicCallback): Promise<void> {
    if (this.isRunning) return;
    this.callback = callback;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.LOW_QUALITY,
          isMeteringEnabled: true,
        }
      );

      this.recording = recording;
      this.isRunning = true;

      // Poll metering every 500ms
      this.intervalId = setInterval(async () => {
        if (!this.recording) return;
        const status = await this.recording.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          this.callback?.({
            metering: status.metering,
            timestamp: Date.now(),
          });
        }
      }, 500);
    } catch (error) {
      console.warn('MicService: failed to start recording', error);
      this.isRunning = false;
    }
  }

  /**
   * Stops recording and restores audio mode to playback
   */
  async stop(): Promise<void> {
    if (this.intervalId) clearInterval(this.intervalId);
    try {
      await this.recording?.stopAndUnloadAsync();
    } catch {
      // Ignore cleanup errors
    }
    this.recording = null;
    this.callback = null;
    this.isRunning = false;

    // Restore audio mode for playback
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  }

  get running(): boolean {
    return this.isRunning;
  }
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const micService = new MicService();
