import { Audio } from 'expo-av';

export interface MicSample {
  metering: number;   // dB level, typically -160 to 0
  timestamp: number;
}

type MicCallback = (sample: MicSample) => void;

class MicService {
  private recording: Audio.Recording | null = null;
  private callback: MicCallback | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

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

export const micService = new MicService();
