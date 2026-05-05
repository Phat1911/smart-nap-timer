/**
 * AudioService — Manages all sound playback in the application
 *
 * Responsible for:
 * - Playing white noise loops (rain, fan, static, brown) during naps
 * - Adjusting volume in real-time via setVolume()
 * - Stopping and releasing native resources on stop()
 * - Pausing/resuming playback without unloading (pause/resume)
 *
 * Used by:
 * - SleepingScreen: play() on mount, stop() on unmount
 * - SettingsScreen: play() to preview sounds
 * - WakeScreen: not used directly (WakeScreen creates its own Audio.Sound)
 *
 * Notes:
 * - Only one sound plays at a time — play() stops the previous sound automatically
 * - Uses expo-av; setAudioModeAsync() must be called before playing
 * - staysActiveInBackground: true so white noise keeps playing when the screen is locked
 *
 * ===========================================================
 * FILE: AudioService.ts
 * PURPOSE: Manages ALL sound playback in the app
 *
 * WHAT THIS DOES:
 *   - Plays white noise loops (rain, fan, static, brown) during naps
 *   - Plays alarm sounds when nap timer expires
 *   - Controls volume in real-time via SleepingScreen slider
 *   - Handles audio session configuration (background play, silent mode)
 *
 * WHO USES IT:
 *   - SleepingScreen: calls audioService.play() on mount, audioService.stop() on unmount
 *   - SettingsScreen: calls audioService.play() for preview button
 *   - WakeScreen: uses audioService for alarm playback
 *
 * DEPENDENCY: expo-av (bundled with Expo SDK, no extra install needed)
 * ===========================================================
 */

// -- Imports ------------------------------------------------
// expo-av: Expo built-in audio module
//   - Audio.Sound: class representing a loaded sound file (native resource)
//   - AVPlaybackStatus: type describing playback state (position, duration, etc.)
import { Audio, AVPlaybackStatus } from 'expo-av';

// -- Types --------------------------------------------------
/**
 * SoundType - Union type of ALL supported sound identifiers.
 *
 * HOW IT WORKS:
 *   - TypeScript string literal union. Variable can ONLY be one of these 4 strings.
 *     TypeScript errors if you pass something like audioService.play('bird').
 *   - Each value maps to a key in SOUND_ASSETS below.
 *   - Used by: SettingsScreen (dropdown selection), AudioService.play() (parameter)
 */
export type SoundType = 'rain' | 'fan' | 'static' | 'brown';

// -- Constants ----------------------------------------------
/**
 * SOUND_ASSETS - Maps each SoundType to its bundled audio file.
 *
 * HOW IT WORKS:
 *   - require() is a Metro bundler directive. At build time, Metro
 *     copies the audio file into the app bundle and returns a numeric ID.
 *     This ID is what Audio.Sound.createAsync() expects.
 *   - All paths are relative to THIS file location (src/services/).
 *     ../../assets/sounds/ goes up 2 levels from services to project root,
 *     then into assets/sounds/.
 *
 * CURRENT STATE:
 *   - All 4 types point to alarm.wav as a placeholder.
 *   - TODO: Replace with actual white noise files:
 *     rain -> rain_loop.wav, fan -> fan_loop.wav, etc.
 *
 * GOTCHA:
 *   - If you change a file path here, you MUST restart Metro bundler
 *     (npx expo start --clear) for Metro to pick up the new file.
 */
const SOUND_ASSETS: Record<SoundType, any> = {
  rain: require('../../assets/sounds/alarm.wav'),   // placeholder - replace with rain_loop.wav
  fan: require('../../assets/sounds/alarm.wav'),     // placeholder - replace with fan_loop.wav
  static: require('../../assets/sounds/alarm.wav'),  // placeholder - replace with static_loop.wav
  brown: require('../../assets/sounds/alarm.wav'),   // placeholder - replace with brown_loop.wav
};

// -- Class Definition ---------------------------------------
/**
 * AudioService - Singleton class managing a single active sound.
 *
 * DESIGN DECISION:
 *   - Only ONE sound plays at a time. This is intentional - we dont
 *     need overlapping audio. If play() is called while another sound
 *     is playing, stop() is called first.
 *   - State is stored in instance variables (sound, currentVolume, isPlaying)
 *     because Audio.Sound objects are stateful native resources.
 *
 * LIFECYCLE:
 *   1. play(type, volume) - loads sound file, configures audio session, starts playback
 *   2. setVolume(v) - adjusts volume on the active sound object
 *   3. stop() - stops playback, unloads from memory, frees native resource
 *   4. pause()/resume() - temporary stop/start without unloading
 */
class AudioService {
  /**
   * sound - Reference to the currently loaded Audio.Sound object.
   *   - null when nothing is playing
   *   - Set by play(), cleared by stop()
   *   - This is a native resource - must call unloadAsync() to free memory
   */
  private sound: Audio.Sound | null = null;

  /**
   * currentVolume - Tracks the volume level (0.0 to 1.0).
   *   - Default 0.5 (50% volume)
   *   - Used by getter volume and updated by setVolume()
   */
  private currentVolume = 0.5;

  /**
   * isPlaying - Tracks whether sound is actively playing.
   *   - Used by getter playing for UI components to check state
   *   - Updated by play() to true, stop()/pause() to false, resume() to true
   */
  private isPlaying = false;

  /**
   * play() - Load and start playing a sound.
   *
   * FLOW:
   *   1. await this.stop() - Stop any currently playing sound first.
   *      This prevents overlapping audio and frees the old Sound object.
   *   2. Audio.setAudioModeAsync() - Configure the audio session.
   *      This MUST be called before play and affects ALL audio in the app.
   *   3. Audio.Sound.createAsync() - Load the sound file and start playing.
   *      The second arg config means:
   *      - Loop forever (for white noise)
   *      - Start at the specified volume
   *      - Start playing immediately (dont wait for another call)
   *   4. Store references for later control (stop, setVolume, pause, resume)
   *
   * @param type - Which sound to play ('rain' | 'fan' | 'static' | 'brown')
   * @param volume - Volume level 0.0 (silent) to 1.0 (max), default 0.5
   */
  async play(type: SoundType, volume = 0.5): Promise<void> {
    // Stop any currently playing sound before starting a new one.
    // This is critical - without it, calling play() twice would overlap sounds.
    await this.stop();

    try {
      /**
       * Audio session configuration - affects ALL audio in the app.
       *
       * WHAT EACH OPTION DOES:
       *   - allowsRecordingIOS: false - We dont need mic recording here.
       *     (MicService uses a separate audio session for recording.)
       *   - playsInSilentModeIOS: true - CRITICAL for iOS. Without this,
       *     sounds wont play if the iPhone mute switch is on.
       *   - staysActiveInBackground: true - Sound keeps playing when user
       *     switches apps or locks the phone. Essential for nap alarms.
       *   - shouldDuckAndroid: false - Dont lower volume when other apps
       *     play audio (e.g., music). We want our alarm/white noise at full volume.
       */
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });

      /**
       * CreateAsync - Loads the sound file from the bundle and starts playing.
       *
       * WHAT HAPPENS UNDER THE HOOD:
       *   1. Metro resolves SOUND_ASSETS[type] to a file path
       *   2. The audio file is decoded from the app bundle
       *   3. A native Audio.Sound object is created
       *   4. Because shouldPlay: true, playback begins immediately
       *
       * WHY isLooping: true?
       *   White noise needs to play continuously during the nap.
       *   Without looping, the sound would end after ~30 seconds and stop.
       */
      const { sound } = await Audio.Sound.createAsync(
        SOUND_ASSETS[type],
        {
          isLooping: true,
          volume,
          shouldPlay: true,
        }
      );

      // Store the sound object so we can control it later (stop, setVolume, etc.)
      this.sound = sound;
      this.currentVolume = volume;
      this.isPlaying = true;
    } catch (error) {
      /**
       * Error handling - If playback fails (file missing, permission denied),
       * log a warning but DONT crash the app.
       *
       * WHY NOT throw?
       *   Audio is non-critical. If white noise fails to play, the nap
       *   session should still work. The user just wont hear the sound.
       */
      console.warn('AudioService: failed to play sound', error);
    }
  }

  /**
   * setVolume() - Change volume of the currently playing sound.
   *
   * @param volume - New volume 0.0 to 1.0. Values outside this range are clamped.
   *
   * FLOW:
   *   1. Math.max(0, Math.min(1, volume)) - Clamp to valid range.
   *      Prevents bugs like setVolume(-1) or setVolume(2.0).
   *   2. Update this.currentVolume - Track for getter access.
   *   3. sound?.setVolumeAsync(clamped) - Apply to the native sound object.
   *      The ? is optional chaining - if no sound is loaded, this is a no-op.
   */
  async setVolume(volume: number): Promise<void> {
    // Clamp volume to 0.0 to 1.0 range. Prevents invalid values from slider.
    const clamped = Math.max(0, Math.min(1, volume));
    this.currentVolume = clamped;
    await this.sound?.setVolumeAsync(clamped);
  }

  /**
   * stop() - Stop playback and free the native sound resource.
   *
   * WHY TWO STEPS (stopAsync + unloadAsync)?
   *   - stopAsync(): Pauses playback. Sound stays in memory.
   *   - unloadAsync(): Frees the audio buffer from memory.
   *     This is CRITICAL - Audio.Sound objects hold native memory.
   *     If you create many sounds without unloading, you get OOM errors.
   *
   * WHY the try/catch?
   *   - stop() can be called even when no sound is loaded.
   *   - If the sound object is already unloaded or corrupted,
   *     stopAsync/unloadAsync will throw. We ignore these errors
   *     because the goal (stopping the sound) is already achieved.
   */
  async stop(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      } catch {
        // Ignore cleanup errors - sound is already stopped/unloaded.
      }
      this.sound = null;
    }
    this.isPlaying = false;
  }

  /**
   * pause() - Temporarily pause playback WITHOUT unloading.
   *
   * WHEN TO USE:
   *   - User taps pause alarm but might resume in seconds.
   *   - Unlike stop(), the sound stays in memory for instant resume.
   */
  async pause(): Promise<void> {
    await this.sound?.pauseAsync();
    this.isPlaying = false;
  }

  /**
   * resume() - Resume playback after pause().
   *
   * REQUIREMENT: Can only be called after pause() (not after stop()).
   * After stop(), you must call play() again to reload the sound.
   */
  async resume(): Promise<void> {
    await this.sound?.playAsync();
    this.isPlaying = true;
  }

  /**
   * volume (getter) - Read-only access to current volume level.
   * Used by UI components to show the slider current value.
   */
  get volume(): number {
    return this.currentVolume;
  }

  /**
   * playing (getter) - Read-only access to playback state.
   * Used by UI components to show play/pause icon.
   */
  get playing(): boolean {
    return this.isPlaying;
  }
}

// -- Singleton Export ---------------------------------------
/**
 * audioService - Singleton instance of AudioService.
 *
 * WHY A SINGLETON?
 *   - Only ONE sound should play at a time across the entire app.
 *   - If we exported the class and let each screen create its own instance,
 *     you could have SleepingScreen and SettingsScreen playing different
 *     sounds simultaneously. The singleton prevents this.
 *   - All screens import this SAME instance:
 *       import { audioService } from '../services/AudioService';
 *
 * HOW TO USE:
 *   import { audioService } from '../services/AudioService';
 *   audioService.play('rain', 0.5);
 *   audioService.setVolume(0.8);
 *   audioService.stop();
 */
export const audioService = new AudioService();