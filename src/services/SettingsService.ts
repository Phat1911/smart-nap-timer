/**
 * SettingsService — Saves and loads user audio preferences
 *
 * Responsible for:
 * - Saving/loading the alarm sound selection (alarm sound ID)
 * - Saving/loading the volume level (0.0 - 1.0)
 * - Saving/loading the preferred white noise type (rain, fan, static, brown)
 *
 * Used by:
 * - SettingsScreen: reads on mount, saves when the user changes a setting
 * - WakeScreen: getAlarmSound() to retrieve the alarm sound when waking up
 *
 * Notes:
 * - AsyncStorage only stores strings — volume is stringified and parseFloat'd
 * - Default volume is 0.4 (40%) if nothing has been saved yet
 * - Default white noise is 'rain' if nothing has been saved yet
 *
 * ===========================================================
 * FILE: SettingsService.ts
 * PURPOSE: Persists user audio preferences to AsyncStorage
 *
 * WHAT THIS DOES:
 *   - Saves/loads alarm sound selection (bell, digital, gentle)
 *   - Saves/loads volume level (0.0 to 1.0)
 *   - Saves/loads white noise type (rain, fan, static, brown)
 *   - All data stored in AsyncStorage with @smart_nap_timer: prefix
 *
 * WHO USES IT:
 *   - SettingsScreen: reads preferences on mount, saves on user change
 *   - SleepingScreen: reads selected white noise type on mount
 *   - AudioService: indirectly - SettingsScreen passes saved values to it
 *
 * STORAGE KEYS:
 *   @smart_nap_timer:alarm_sound  -> AlarmSoundId ('bell' | 'digital' | 'gentle')
 *   @smart_nap_timer:volume       -> stringified number ('0.4')
 *   @smart_nap_timer:white_noise  -> SoundType ('rain' | 'fan' | 'static' | 'brown')
 * ===========================================================
 */

// -- Imports ------------------------------------------------
// AsyncStorage: React Native persistent key-value storage
//   - Data survives app restarts and phone reboots
//   - Stored in app sandbox - deleted only on app uninstall
//   - NOT encrypted - dont store passwords or tokens here
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AlarmSoundId, DEFAULT_ALARM_SOUND } from '../constants/config';
import type { SoundType } from './AudioService';

// -- Constants ----------------------------------------------
/**
 * Storage key for alarm sound selection.
 *
 * FORMAT:
 *   Value is one of: 'bell' | 'digital' | 'gentle'
 *   These map to files in assets/sounds/: alarm_bell.wav, etc.
 */
const ALARM_SOUND_KEY = '@smart_nap_timer:alarm_sound';

/**
 * Storage key for volume level.
 *
 * FORMAT:
 *   Value is a stringified number: '0.4' (not 0.4)
 *   AsyncStorage only stores strings, so we stringify/parseFloat.
 */
const VOLUME_KEY = '@smart_nap_timer:volume';

/**
 * Storage key for white noise type selection.
 *
 * FORMAT:
 *   Value is one of: 'rain' | 'fan' | 'static' | 'brown'
 *   Defaults to 'rain' if not set (first-time user).
 *   Maps to SOUND_ASSETS in AudioService.ts.
 */
const WHITE_NOISE_KEY = '@smart_nap_timer:white_noise';

// -- Alarm Sound Functions ----------------------------------
/**
 * getAlarmSound() - Read the saved alarm sound preference.
 *
 * FLOW:
 *   1. AsyncStorage.getItem() - Read raw string from storage
 *   2. Cast to AlarmSoundId type (TypeScript assertion)
 *   3. If null (first run) or invalid, return DEFAULT_ALARM_SOUND
 *
 * @returns Promise<AlarmSoundId> - Saved sound ID or default
 */
export async function getAlarmSound(): Promise<AlarmSoundId> {
  try {
    const val = await AsyncStorage.getItem(ALARM_SOUND_KEY);
    return (val as AlarmSoundId) ?? DEFAULT_ALARM_SOUND;
  } catch {
    // If AsyncStorage fails (rare - storage full, corrupted),
    // return default so the app still works.
    return DEFAULT_ALARM_SOUND;
  }
}

/**
 * setAlarmSound() - Save the alarm sound preference.
 *
 * @param id - Which alarm sound ('bell' | 'digital' | 'gentle')
 *
 * NOTE:
 *   - No validation here - we trust SettingsScreen to pass valid values
 *   - If you need validation, add it in SettingsScreen before calling this
 */
export async function setAlarmSound(id: AlarmSoundId): Promise<void> {
  await AsyncStorage.setItem(ALARM_SOUND_KEY, id);
}

// -- Volume Functions ---------------------------------------
/**
 * saveVolume() - Save the volume level preference.
 *
 * @param volume - Volume level 0.0 (silent) to 1.0 (max)
 *
 * WHY String(volume)?
 *   AsyncStorage only accepts string values.
 *   '0.5' in storage becomes 0.5 number when loaded.
 */
export async function saveVolume(volume: number): Promise<void> {
  await AsyncStorage.setItem(VOLUME_KEY, String(volume));
}

/**
 * loadVolume() - Read and parse the saved volume level.
 *
 * FLOW:
 *   1. AsyncStorage.getItem() - Read raw string
 *   2. If null (first run), return default 0.4
 *   3. parseFloat() - Convert string back to number
 *   4. isNaN check - Guard against corrupted data
 *   5. Math.max/Math.min - Clamp to valid range 0.0-1.0
 *
 * @returns Promise<number> - Volume level 0.0 to 1.0, default 0.4
 */
export async function loadVolume(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(VOLUME_KEY);
    if (raw === null) return 0.4;
    const n = parseFloat(raw);
    return isNaN(n) ? 0.4 : Math.max(0, Math.min(1, n));
  } catch {
    // AsyncStorage read failed - return safe default
    return 0.4;
  }
}

// -- White Noise Functions ----------------------------------
/**
 * getWhiteNoise() - Read the saved white noise type preference.
 *
 * FLOW:
 *   1. AsyncStorage.getItem() - Read raw string from storage
 *   2. If null (first-time user), return 'rain' as default
 *   3. Return the saved SoundType value
 *
 * DEFAULT: 'rain' - Chosen because rain is the most common
 *   white noise preference and the default in SettingsScreen UI.
 *
 * @returns Promise<SoundType> - Saved white noise type or 'rain'
 */
export async function getWhiteNoise(): Promise<SoundType> {
  try {
    const val = await AsyncStorage.getItem(WHITE_NOISE_KEY);
    return (val as SoundType) ?? 'rain';
  } catch {
    // If storage fails, return safe default
    return 'rain';
  }
}

/**
 * setWhiteNoise() - Save the white noise type preference.
 *
 * @param type - Which white noise ('rain' | 'fan' | 'static' | 'brown')
 *
 * USAGE:
 *   Called by SettingsScreen when user taps a sound chip.
 *   The saved value is read by SleepingScreen on mount to
 *   determine which white noise to play.
 */
export async function setWhiteNoise(type: SoundType): Promise<void> {
  await AsyncStorage.setItem(WHITE_NOISE_KEY, type);
}