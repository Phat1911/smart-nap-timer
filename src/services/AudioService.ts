import { Audio, AVPlaybackStatus } from 'expo-av';

export type SoundType = 'rain' | 'fan' | 'static' | 'brown';

// Map sound types to bundled asset requires
// Assets will be added to assets/sounds/ in V5
const SOUND_ASSETS: Record<SoundType, any> = {
  rain: require('../../assets/sounds/alarm.wav'),   // placeholder until real sounds added
  fan: require('../../assets/sounds/alarm.wav'),
  static: require('../../assets/sounds/alarm.wav'),
  brown: require('../../assets/sounds/alarm.wav'),
};

class AudioService {
  private sound: Audio.Sound | null = null;
  private currentVolume = 0.5;
  private isPlaying = false;

  async play(type: SoundType, volume = 0.5): Promise<void> {
    await this.stop();

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        SOUND_ASSETS[type],
        {
          isLooping: true,
          volume,
          shouldPlay: true,
        }
      );

      this.sound = sound;
      this.currentVolume = volume;
      this.isPlaying = true;
    } catch (error) {
      console.warn('AudioService: failed to play sound', error);
    }
  }

  async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, volume));
    this.currentVolume = clamped;
    await this.sound?.setVolumeAsync(clamped);
  }

  async stop(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch {
        // Ignore cleanup errors
      }
      this.sound = null;
    }
    this.isPlaying = false;
  }

  async pause(): Promise<void> {
    await this.sound?.pauseAsync();
    this.isPlaying = false;
  }

  async resume(): Promise<void> {
    await this.sound?.playAsync();
    this.isPlaying = true;
  }

  get volume(): number {
    return this.currentVolume;
  }

  get playing(): boolean {
    return this.isPlaying;
  }
}

export const audioService = new AudioService();
