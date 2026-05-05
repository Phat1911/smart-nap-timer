/**
 * CustomSoundService — Manages custom alarm sounds uploaded by the user
 *
 * Responsible for:
 * - Opening a document picker filtered to audio files
 * - Copying the file into the app's documents directory (persistent, not purged by the OS)
 * - Saving metadata (id, name, uri) to AsyncStorage
 * - Deleting the physical file and its metadata when the user removes a sound
 *
 * Used by:
 * - SettingsScreen: pick() when the user taps "Add Custom Sound", delete() to remove
 * - WakeScreen: getById() to load a custom sound when the alarm fires
 *
 * Notes:
 * - IDs always start with 'custom_' to distinguish them from built-in ALARM_SOUNDS
 * - Uses documentDirectory (not cacheDirectory) so files are not purged by the OS
 * - Requires expo-document-picker and expo-file-system (not mocked in DEV because
 *   SettingsScreen uses static imports, not conditional require)
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export interface CustomSound {
  /** Unique ID, always starts with 'custom_' */
  id: string;
  /** Display name (original filename without extension) */
  name: string;
  /** Permanent file:// URI inside the app's document directory */
  uri: string;
}

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const CUSTOM_SOUNDS_KEY = '@smart_nap_timer:custom_sounds';
const CUSTOM_SOUNDS_DIR = `${FileSystem.documentDirectory}custom_sounds/`;

// ─────────────────────────────────────────
// Class Definition
// ─────────────────────────────────────────

class CustomSoundService {
  // ── Private Helpers ───────────────────────────────────────────────────────

  private async ensureDir(): Promise<void> {
    const info = await FileSystem.getInfoAsync(CUSTOM_SOUNDS_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(CUSTOM_SOUNDS_DIR, { intermediates: true });
    }
  }

  // ── Public Methods ────────────────────────────────────────────────────────

  /**
   * Reads all saved custom sounds
   * @returns Array of CustomSound, empty if none have been added yet
   */
  async getAll(): Promise<CustomSound[]> {
    try {
      const raw = await AsyncStorage.getItem(CUSTOM_SOUNDS_KEY);
      return raw ? (JSON.parse(raw) as CustomSound[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Finds a custom sound by ID
   * @param id - ID in the form 'custom_<timestamp>'
   * @returns CustomSound or null if not found
   */
  async getById(id: string): Promise<CustomSound | null> {
    const all = await this.getAll();
    return all.find((s) => s.id === id) ?? null;
  }

  /**
   * Opens the device document picker filtered to audio files.
   * Copies the picked file into the app's permanent document directory,
   * persists the entry, and returns the new CustomSound.
   * Returns null if the user cancels.
   */
  async pick(): Promise<CustomSound | null> {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/*', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) return null;

    const asset = result.assets[0];
    await this.ensureDir();

    const id  = `custom_${Date.now()}`;
    const ext = (asset.name ?? 'sound').split('.').pop() ?? 'mp3';
    const destUri = `${CUSTOM_SOUNDS_DIR}${id}.${ext}`;

    await FileSystem.copyAsync({ from: asset.uri, to: destUri });

    const name: string = (asset.name ?? 'Custom Sound').replace(/\.[^.]+$/, '');
    const sound: CustomSound = { id, name, uri: destUri };

    const all = await this.getAll();
    all.push(sound);
    await AsyncStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(all));

    return sound;
  }

  /**
   * Deletes a custom sound by ID — removes the file from disk and
   * removes the entry from AsyncStorage.
   */
  async delete(id: string): Promise<void> {
    const all = await this.getAll();
    const target = all.find((s) => s.id === id);
    if (target) {
      await FileSystem.deleteAsync(target.uri, { idempotent: true });
    }
    const updated = all.filter((s) => s.id !== id);
    await AsyncStorage.setItem(CUSTOM_SOUNDS_KEY, JSON.stringify(updated));
  }
}

// ─────────────────────────────────────────
// Exports
// ─────────────────────────────────────────

export const customSoundService = new CustomSoundService();
