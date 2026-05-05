/**
 * BackupService — Export and Import session history as a JSON file
 *
 * Responsible for:
 * - Export: serialises sessions → .json file in cache directory → system share sheet
 * - Import: document picker → reads JSON → merges into store (deduplication by ID)
 *
 * Used by:
 * - SettingsScreen: exportBackup() and importBackup() when the user taps the buttons
 *
 * Notes:
 * - Requires 3 packages: expo-file-system, expo-document-picker, expo-sharing
 * - Mocked in __DEV__ following the same pattern as AlarmService / NotificationBlocker
 * - Import uses copyToCacheDirectory: true to support reading on Android (content:// URIs)
 * - Throws 'cancelled' or 'invalid' so SettingsScreen can display the appropriate Alert
 *
 * 7.7 — Session History Backup
 *
 * Export: serialises sessions to a dated .json file in the cache directory
 *         then shares it via expo-sharing (user saves to iCloud / Drive / etc.)
 * Import: user picks the .json file via expo-document-picker, sessions are
 *         merged (no duplicates) by sessionService.mergeImported().
 *
 * Install the three required packages before building:
 *   npx expo install expo-file-system expo-document-picker expo-sharing
 *
 * In Expo Go (__DEV__) the native calls are mocked to no-ops so the screen
 * still renders and the import alert still fires, matching the existing
 * AlarmService / NotificationBlocker pattern.
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import { sessionService } from './SessionService';

// ── Conditional requires ──────────────────────────────────────────────────────

let FileSystem: any;
let Sharing: any;
let DocumentPicker: any;

if (!__DEV__) {
  FileSystem     = require('expo-file-system');
  Sharing        = require('expo-sharing');
  DocumentPicker = require('expo-document-picker');
} else {
  FileSystem = {
    cacheDirectory:     'file:///cache/',
    writeAsStringAsync: async () => {},
    readAsStringAsync:  async () => { throw new Error('dev'); },
  };
  Sharing        = { shareAsync: async () => {} };
  DocumentPicker = { getDocumentAsync: async () => ({ canceled: true, assets: [] }) };
}

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Write sessions to a .json file in the cache directory and open the system
 * share sheet so the user can save it wherever they like.
 *
 * Throws on failure; caller is responsible for showing an Alert.
 */
export async function exportBackup(): Promise<void> {
  const json     = await sessionService.exportJSON();
  const date     = new Date().toISOString().slice(0, 10);
  const filename = `smart-nap-backup-${date}.json`;
  const uri      = `${FileSystem.cacheDirectory as string}${filename}`;

  await FileSystem.writeAsStringAsync(uri, json);
  await Sharing.shareAsync(uri, {
    mimeType:    'application/json',
    dialogTitle: 'Save your nap session backup',
    UTI:         'public.json', // iOS hint
  });
}

// ── Import ────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export interface ImportResult {
  imported: number;
  skipped: number;
}

/**
 * Open the document picker, read the chosen .json file, and merge the
 * sessions into the existing store (duplicates filtered by session_id).
 *
 * Throws 'cancelled' when the user dismisses the picker.
 * Throws 'invalid'   when the file content is not a parseable session array.
 */
export async function importBackup(): Promise<ImportResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type:                 'application/json',
    copyToCacheDirectory: true, // Required for reliable reading on Android
  });

  if (result.canceled || !result.assets?.[0]?.uri) {
    throw new Error('cancelled');
  }

  let incoming: unknown;
  try {
    const raw = await FileSystem.readAsStringAsync(result.assets[0].uri as string);
    incoming  = JSON.parse(raw);
  } catch {
    throw new Error('invalid');
  }

  if (!Array.isArray(incoming)) {
    throw new Error('invalid');
  }

  return sessionService.mergeImported(incoming);
}
