/**
 * SettingsScreen — App settings screen
 *
 * Responsible for:
 * - Selecting and previewing alarm sounds (Classic, Bell, Gentle, Digital, custom)
 * - Selecting and previewing white noise (rain, fan, static, brown) gated by tier
 * - Adjusting volume with a custom PanResponder slider (no @react-native-slider)
 * - Managing custom sounds (upload from device) — Pro/Max tier
 * - Exporting/importing session data backup
 * - Resetting all data
 * - Opening DevTools (tap version text 5 times)
 *
 * Used by:
 * - AppNavigator: "Settings" tab in MainTabs
 *
 * Notes:
 * - This file already has many detailed inline comments — only header and JSDoc added
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert, Share,
  PanResponder, LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { sessionService } from '../services/SessionService';
import { exportBackup, importBackup } from '../services/BackupService';
import { audioService } from '../services/AudioService';
import { getAlarmSound, setAlarmSound, saveVolume, loadVolume } from '../services/SettingsService';
import { customSoundService, CustomSound } from '../services/CustomSoundService';
import { useTier } from '../hooks/useTier';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ALARM_SOUNDS, AlarmSoundId } from '../constants/config';
import type { SoundType } from '../services/AudioService';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

// Navigation prop type scoped to the root stack
type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

// Three sensitivity levels for sleep detection threshold
const SENSITIVITIES = ['Low', 'Medium', 'High'] as const;
type Sensitivity = typeof SENSITIVITIES[number];

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

/**
 * Settings screen — manages sounds, backup, and sleep detection options
 */
export default function SettingsScreen() {
  // ── Context & navigation ─────────────────────────────────────────────────

  // Live localised strings (reactive to language toggle)
  const { strings: Strings } = useLanguage();
  const navigation = useNavigation<Nav>();
  // Tier limits gate which sounds and features are accessible
  const { limits } = useTier();

  // ── Derived constants (depend on live strings) ────────────────────────────

  // White noise sound options shown as chips — label reacts to language
  const SOUNDS: { label: string; value: SoundType }[] = [
    { label: Strings.settings_sound_rain, value: 'rain' },
    { label: Strings.settings_sound_fan, value: 'fan' },
    { label: Strings.settings_sound_static, value: 'static' },
    { label: Strings.settings_sound_brown, value: 'brown' },
  ];

  // Localised display labels for sensitivity chips
  const SENSITIVITY_LABELS: Record<Sensitivity, string> = {
    Low:    Strings.settings_sensitivity_low,
    Medium: Strings.settings_sensitivity_medium,
    High:   Strings.settings_sensitivity_high,
  };

  // ── State ─────────────────────────────────────────────────────────────────

  // Currently active white noise type (used during nap monitoring)
  const [selectedSound,    setSelectedSound]    = useState<SoundType>('rain');
  // Alarm volume (0.0 – 1.0), mirrors AudioService and persisted to SettingsService
  const [volume,           setVolume]           = useState(0.4);
  // Detection sensitivity selection (UI only — not yet wired to ConfidenceEngine)
  const [sensitivity,      setSensitivity]      = useState<Sensitivity>('Medium');
  // Permission toggle display states (UI only — actual permissions via expo APIs)
  const [micEnabled,       setMicEnabled]       = useState(true);
  const [accelEnabled,     setAccelEnabled]     = useState(true);
  const [notifEnabled,     setNotifEnabled]     = useState(true);
  // ID of the currently selected bundled or custom alarm sound
  const [selectedAlarm,    setSelectedAlarm]    = useState<AlarmSoundId>('alarm');
  // List of user-imported custom alarm sounds from device storage
  const [customSounds,     setCustomSounds]     = useState<CustomSound[]>([]);

  // ── Refs ──────────────────────────────────────────────────────────────────

  // Holds the currently playing preview sound so it can be stopped before starting another
  const previewSoundRef  = useRef<Audio.Sound | null>(null);
  // Measured pixel width of the volume slider track (set via onLayout)
  const trackWidthRef    = useRef(0);
  // Ref to the slider track View — used to get its on-screen X position
  const trackRef         = useRef<View>(null);
  // Cached absolute X position of the slider track's left edge on screen
  const trackPageX       = useRef(0);
  // Ref-wrapped volume applier — avoids stale closure inside PanResponder
  const applyVolumeRef   = useRef((_x: number) => {});

  // ── Volume slider logic ───────────────────────────────────────────────────

  // Updated every render so PanResponder always calls the latest version
  // Converts a raw screen X coordinate into a 0–1 volume value
  applyVolumeRef.current = (pageX: number) => {
    if (trackWidthRef.current <= 0) return;
    const relative = pageX - trackPageX.current;
    const clamped = Math.max(0, Math.min(1, relative / trackWidthRef.current));
    setVolume(clamped);
    audioService.setVolume(clamped).catch(() => {});
  };

  // PanResponder handles drag gestures on the volume slider track
  // Created once via useRef so it is stable across renders
  const volPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      // On finger down: measure track position, then apply volume immediately
      onPanResponderGrant: (e) => {
        trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
          trackPageX.current = pageX;
          applyVolumeRef.current(e.nativeEvent.pageX);
        });
      },
      // On finger move: continuously update volume
      onPanResponderMove:    (e) => applyVolumeRef.current(e.nativeEvent.pageX),
      // On finger up: apply final value and persist to AsyncStorage
      onPanResponderRelease: (e) => {
        applyVolumeRef.current(e.nativeEvent.pageX);
        const rel = e.nativeEvent.pageX - trackPageX.current;
        const vol = Math.max(0, Math.min(1, rel / trackWidthRef.current));
        saveVolume(vol).catch(() => {});
      },
    }),
  ).current;

  // ── Effects ───────────────────────────────────────────────────────────────

  // On mount: load persisted alarm sound selection, volume, and custom sounds
  useEffect(() => {
    getAlarmSound().then(setSelectedAlarm).catch(() => {});
    loadVolume().then(v => {
      setVolume(v);
      audioService.setVolume(v).catch(() => {});
    }).catch(() => {});
    customSoundService.getAll().then(setCustomSounds).catch(() => {});
  }, []);

  // ── Handlers — Custom Sounds ──────────────────────────────────────────────

  // Opens the device document picker (audio/*), copies picked file to permanent
  // storage, appends it to the custom sounds list, and auto-selects it as alarm
  async function handleAddCustomSound() {
    try {
      const sound = await customSoundService.pick();
      if (!sound) return; // user cancelled the picker
      setCustomSounds(prev => [...prev, sound]);
      await handleAlarmSelect(sound.id);
    } catch {
      Alert.alert(Strings.settings_custom_sound_pick_error_title, Strings.settings_custom_sound_pick_error);
    }
  }

  // Shows a destructive confirmation alert before deleting a custom sound.
  // If the deleted sound is currently selected, falls back to the Classic alarm.
  async function handleDeleteCustomSound(sound: CustomSound) {
    Alert.alert(
      Strings.settings_custom_sound_delete_confirm_title,
      Strings.settings_custom_sound_delete_confirm_body(sound.name),
      [
        { text: Strings.common_cancel, style: 'cancel' },
        {
          text: Strings.settings_custom_sound_delete,
          style: 'destructive',
          onPress: async () => {
            await customSoundService.delete(sound.id);
            setCustomSounds(prev => prev.filter(s => s.id !== sound.id));
            if (selectedAlarm === sound.id) {
              setSelectedAlarm('alarm');
              await setAlarmSound('alarm');
            }
          },
        },
      ],
    );
  }

  // Plays a custom sound by its file:// URI for 3 seconds as a preview.
  // Stops any existing preview before starting a new one.
  async function handleCustomSoundPreview(uri: string) {
    if (previewSoundRef.current) {
      await previewSoundRef.current.stopAsync().catch(() => {});
      await previewSoundRef.current.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync({ uri }, { volume: 0.8, shouldPlay: true });
      previewSoundRef.current = sound;
      setTimeout(async () => {
        await sound.stopAsync().catch(() => {});
        await sound.unloadAsync().catch(() => {});
        if (previewSoundRef.current === sound) previewSoundRef.current = null;
      }, 3000);
    } catch {
      // Preview unavailable (e.g. file deleted from disk)
    }
  }

  // ── Handlers — Bundled Alarm Sounds ──────────────────────────────────────

  // Selects a bundled alarm sound by ID and persists the choice
  async function handleAlarmSelect(id: AlarmSoundId) {
    setSelectedAlarm(id);
    await setAlarmSound(id).catch(() => {});
  }

  // Plays a bundled alarm sound (require() asset number) for 3 seconds as a preview.
  // Stops any existing preview before starting a new one.
  async function handleAlarmPreview(file: number) {
    if (previewSoundRef.current) {
      await previewSoundRef.current.stopAsync().catch(() => {});
      await previewSoundRef.current.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
      });
      // In Expo Go dev mode, asset.localUri is an HTTP URL from Metro — not a
      // real file:// path. ExoPlayer can't parse audio from it directly.
      // Fix: download the bytes to a temp file first, then play the local copy.
      const asset = Asset.fromModule(file);
      const ext = asset.name?.split('.').pop() ?? 'wav';
      const destUri = `${FileSystem.cacheDirectory}preview_alarm.${ext}`;
      await FileSystem.downloadAsync(asset.uri, destUri);
      const { sound } = await Audio.Sound.createAsync(
        { uri: destUri },
        { volume: 0.8, shouldPlay: true },
      );
      previewSoundRef.current = sound;
      setTimeout(async () => {
        await sound.stopAsync().catch(() => {});
        await sound.unloadAsync().catch(() => {});
        if (previewSoundRef.current === sound) previewSoundRef.current = null;
      }, 3000);
    } catch (e: any) {
      Alert.alert('Preview error', String(e?.message ?? e));
    }
  }

  // ── Handlers — Data ───────────────────────────────────────────────────────

  // 3.13 — Confirms and wipes all session data + learned thresholds
  function confirmReset() {
    Alert.alert(
      Strings.settings_reset_alert_title,
      Strings.settings_reset_confirm,
      [
        { text: Strings.settings_reset_alert_cancel, style: 'cancel' },
        {
          text: Strings.settings_reset_alert_confirm, style: 'destructive',
          onPress: async () => {
            await sessionService.reset();
            Alert.alert(Strings.settings_reset_done_title, Strings.settings_reset_done_body);
          },
        },
      ],
    );
  }

  // 3.12 — Exports all sessions as JSON via native Share sheet (Max tier only)
  async function handleExport() {
    if (!limits.exportEnabled) {
      navigation.navigate('Paywall', { reason: Strings.paywall_reason_export });
      return;
    }
    try {
      const json = await sessionService.exportJSON();
      await Share.share({ message: json, title: Strings.settings_export_share_title });
    } catch {
      Alert.alert(Strings.settings_export_error_title, Strings.settings_export_error_body);
    }
  }

  // 7.7 — Exports all sessions as a dated JSON backup file via native Share sheet
  async function handleBackupExport() {
    try {
      await exportBackup();
    } catch {
      Alert.alert(Strings.settings_backup_export_error_title, Strings.settings_backup_export_error);
    }
  }

  // 7.7 — Opens document picker to import a previously exported backup JSON file.
  // Merges imported sessions, skipping any duplicates by session_id.
  async function handleBackupImport() {
    try {
      const { imported, skipped } = await importBackup();
      Alert.alert(
        Strings.settings_backup_import_success_title,
        Strings.settings_backup_import_success(imported, skipped),
      );
    } catch (e: unknown) {
      if ((e as Error).message === 'cancelled') return;
      Alert.alert(Strings.settings_backup_import_error_title, Strings.settings_backup_import_error);
    }
  }

  // ── Handlers — White Noise ────────────────────────────────────────────────

  // Selects a white noise type for monitoring; gated by tier soundsUnlocked list.
  // Plays a 3-second preview on selection.
  async function handleSoundSelect(s: SoundType) {
    if (!limits.soundsUnlocked.includes(s)) {
      navigation.navigate('Paywall', { reason: Strings.paywall_reason_sound(s) });
      return;
    }
    setSelectedSound(s);
    await audioService.play(s, volume);
    setTimeout(() => audioService.stop(), 3000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{Strings.settings_title}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Bundled Alarm Sounds — 4 built-in WAV files, selectable + previewable */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{Strings.settings_alarm_sound}</Text>
          <View style={styles.card}>
            {ALARM_SOUNDS.map((item, index) => {
              const active = selectedAlarm === item.id;
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.alarmRow}>
                    {/* Select button — circle icon toggles to checkmark when active */}
                    <TouchableOpacity
                      style={styles.alarmLeft}
                      onPress={() => handleAlarmSelect(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 20 }}>🎵</Text>
                      <Text style={[styles.permLabel, active && styles.alarmLabelActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                    {/* Preview button — plays 3-second sample of the bundled sound */}
                    <TouchableOpacity
                      style={styles.previewBtn}
                      onPress={() => handleAlarmPreview(item.file as number)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 16 }}>▶️</Text>
                      <Text style={styles.previewBtnText}>{Strings.common_preview}</Text>
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Custom Alarm Sounds — user-imported audio files from device */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{Strings.settings_custom_sounds}</Text>
          <View style={styles.card}>
            {/* Render each imported custom sound with select, preview, and delete */}
            {customSounds.map((item, index) => {
              const active = selectedAlarm === item.id;
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.alarmRow}>
                    {/* Select button */}
                    <TouchableOpacity
                      style={styles.alarmLeft}
                      onPress={() => handleAlarmSelect(item.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 20 }}>🎵</Text>
                      <Text style={[styles.permLabel, active && styles.alarmLabelActive]} numberOfLines={1}>
                        {item.name.length > 10 ? `${item.name.slice(0, 10)}...` : item.name}
                      </Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {/* Preview button — plays 3-second sample via file:// URI */}
                      <TouchableOpacity
                        style={styles.previewBtn}
                        onPress={() => handleCustomSoundPreview(item.uri)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 16 }}>▶️</Text>
                        <Text style={styles.previewBtnText}>{Strings.common_preview}</Text>
                      </TouchableOpacity>
                      {/* Delete button — shows confirmation alert before removing */}
                      <TouchableOpacity
                        style={[styles.previewBtn, { backgroundColor: 'rgba(255,110,132,0.1)' }]}
                        onPress={() => handleDeleteCustomSound(item)}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontSize: 16 }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
            {/* Divider only shown when there are existing custom sounds above */}
            {customSounds.length > 0 && <View style={styles.divider} />}
            {/* Add button — opens device audio picker */}
            <TouchableOpacity style={styles.actionRow} onPress={handleAddCustomSound} activeOpacity={0.7}>
              <View style={styles.permLeft}>
                <Text style={{ fontSize: 20 }}>➕</Text>
                <Text style={styles.permLabel}>{Strings.settings_add_custom_sound}</Text>
              </View>
              <Text style={{ fontSize: 20 }}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* White Noise Sound — played during MonitoringScreen to aid sleep */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{Strings.settings_sound}</Text>
          <View style={styles.chipRow}>
            {SOUNDS.map((s) => {
              const unlocked = limits.soundsUnlocked.includes(s.value);
              const active = selectedSound === s.value;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.chip, active && styles.chipActive, !unlocked && styles.chipLocked]}
                  onPress={() => handleSoundSelect(s.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {s.label}
                  </Text>
                  {/* Pro badge overlaid on locked sounds */}
                  {!unlocked && (
                    <View style={styles.proBadge}>
                      <Text style={styles.proBadgeText}>Pro</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Volume — drag slider to set alarm + white noise volume (0–100%) */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>{Strings.settings_volume}</Text>
            {/* Live percentage readout */}
            <Text style={styles.valueText}>{Math.round(volume * 100)}%</Text>
          </View>
          <View style={styles.sliderRow}>
            <Text style={{ fontSize: 16 }}>🔇</Text>
            {/* Slider track — PanResponder handles drag; onLayout captures width */}
            <View
              ref={trackRef}
              style={styles.sliderTrack}
              onLayout={(e: LayoutChangeEvent) => { trackWidthRef.current = e.nativeEvent.layout.width; }}
              {...volPanResponder.panHandlers}
            >
              {/* Fill bar — grows proportionally with volume */}
              <View style={[styles.sliderFill, { width: `${volume * 100}%` as any }]} />
              {/* Draggable thumb indicator */}
              <View style={[styles.sliderThumb, { left: `${Math.max(0, volume * 100 - 4)}%` as any }]} />
            </View>
            <Text style={{ fontSize: 16 }}>🔊</Text>
          </View>
        </View>

        {/* Detection Sensitivity — adjusts how aggressively sleep onset is detected */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{Strings.settings_sensitivity}</Text>
          <View style={styles.chipRow}>
            {SENSITIVITIES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, styles.chipFlex, sensitivity === s && styles.chipActive]}
                onPress={() => setSensitivity(s)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, sensitivity === s && styles.chipTextActive]}>{SENSITIVITY_LABELS[s]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Permissions — toggle display for mic, motion, and notification access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{Strings.settings_permissions}</Text>
          <View style={styles.card}>
            <View style={styles.permRow}>
              <View style={styles.permLeft}>
                <Text style={{ fontSize: 20 }}>🎤</Text>
                <Text style={styles.permLabel}>{Strings.settings_perm_microphone}</Text>
              </View>
              <Switch value={micEnabled} onValueChange={setMicEnabled}
                trackColor={{ false: Colors.surface_container_high, true: Colors.secondary_container }}
                thumbColor={micEnabled ? Colors.primary : Colors.outline} />
            </View>
            <View style={styles.divider} />
            <View style={styles.permRow}>
              <View style={styles.permLeft}>
                <Text style={{ fontSize: 20 }}>📳</Text>
                <Text style={styles.permLabel}>{Strings.settings_perm_motion}</Text>
              </View>
              <Switch value={accelEnabled} onValueChange={setAccelEnabled}
                trackColor={{ false: Colors.surface_container_high, true: Colors.secondary_container }}
                thumbColor={accelEnabled ? Colors.primary : Colors.outline} />
            </View>
            <View style={styles.divider} />
            <View style={styles.permRow}>
              <View style={styles.permLeft}>
                <Text style={{ fontSize: 20 }}>🔔</Text>
                <Text style={styles.permLabel}>{Strings.settings_perm_notifications}</Text>
              </View>
              <Switch value={notifEnabled} onValueChange={setNotifEnabled}
                trackColor={{ false: Colors.surface_container_high, true: Colors.secondary_container }}
                thumbColor={notifEnabled ? Colors.primary : Colors.outline} />
            </View>
          </View>
        </View>

        {/* Guide — link to the best experience guide */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{Strings.settings_section_help}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => navigation.navigate('Guide')}
              activeOpacity={0.7}
            >
              <View style={styles.permLeft}>
                <Text style={{ fontSize: 20 }}>💡</Text>
                <Text style={styles.permLabel}>{Strings.settings_guide_btn}</Text>
              </View>
              <Text style={{ fontSize: 20 }}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Data — export, backup, restore, and reset session history */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{Strings.settings_section_data}</Text>
          <View style={styles.card}>
            {/* Export as JSON via Share sheet — Max tier only */}
            <TouchableOpacity style={styles.actionRow} onPress={handleExport} activeOpacity={0.7}>
              <View style={styles.permLeft}>
                <Text style={{ fontSize: 20 }}>📤</Text>
                <Text style={styles.permLabel}>{Strings.settings_export}</Text>
                {!limits.exportEnabled && (
                  <View style={styles.maxBadge}>
                    <Text style={styles.maxBadgeText}>Max</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 20 }}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            {/* Save a dated backup JSON file to device via Share sheet */}
            <TouchableOpacity style={styles.actionRow} onPress={handleBackupExport} activeOpacity={0.7}>
              <View style={styles.permLeft}>
                <Text style={{ fontSize: 20 }}>☁️</Text>
                <Text style={styles.permLabel}>{Strings.settings_backup_export}</Text>
              </View>
              <Text style={{ fontSize: 20 }}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            {/* Import and merge sessions from a previously saved backup file */}
            <TouchableOpacity style={styles.actionRow} onPress={handleBackupImport} activeOpacity={0.7}>
              <View style={styles.permLeft}>
                <Text style={{ fontSize: 20 }}>📥</Text>
                <Text style={styles.permLabel}>{Strings.settings_backup_import}</Text>
              </View>
              <Text style={{ fontSize: 20 }}>›</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            {/* Destructive reset — wipes all sessions, thresholds, and AI weights */}
            <TouchableOpacity style={styles.actionRow} onPress={confirmReset} activeOpacity={0.7}>
              <View style={styles.permLeft}>
                <Text style={{ fontSize: 20 }}>🗑️</Text>
                <Text style={[styles.permLabel, { color: Colors.error }]}>{Strings.settings_reset_threshold}</Text>
              </View>
              <Text style={{ fontSize: 20 }}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dev Tools trigger — hidden in production; 5 taps within 2s to open */}
        {/* {__DEV__ && <DevToolsTrigger />} */}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

// Hidden component rendered only in __DEV__ builds.
// Counts taps on the version label — 5 taps within 2 seconds navigates to DevTools.
function DevToolsTrigger() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const tapsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTap() {
    tapsRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (tapsRef.current >= 5) {
      tapsRef.current = 0;
      if (__DEV__) { navigation.navigate('DevTools'); }
      return;
    }
    // Reset tap count if 2 seconds pass without hitting 5 taps
    timerRef.current = setTimeout(() => { tapsRef.current = 0; }, 2000);
  }

  return (
    <TouchableOpacity onPress={handleTap} style={styles.appInfo} activeOpacity={1}>
      <Text style={{ fontSize: 20, opacity: 0.4 }}>✨</Text>
      <Text style={styles.appInfoText}>Smart Nap Timer v1.0.0</Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────

const styles = StyleSheet.create({
  // Screen root
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: Colors.background },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.on_surface, letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120, gap: 28 },

  // Section wrapper and title
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 1.5, color: Colors.on_surface_variant,
  },

  // Row with space between (used for volume label + value)
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valueText: { fontSize: 13, fontWeight: '600', color: Colors.primary },

  // Chip row (white noise + sensitivity)
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
    backgroundColor: Colors.surface_container,
    borderWidth: 1, borderColor: Colors.outline_variant,
    overflow: 'visible',
  },
  chipFlex: { flex: 1, alignItems: 'center' },
  chipActive: { backgroundColor: Colors.secondary_container, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: Colors.on_surface_variant },
  chipTextActive: { color: Colors.on_secondary_container, fontWeight: '700' },

  // Volume slider
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sliderTrack: {
    flex: 1, height: 4, backgroundColor: Colors.surface_container_high,
    borderRadius: 2, position: 'relative',
  },
  sliderFill: {
    position: 'absolute', left: 0, top: 0, height: '100%',
    backgroundColor: Colors.primary, borderRadius: 2,
  },
  sliderThumb: {
    position: 'absolute', top: -6, width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
  },

  // Card container (permissions, alarm sounds, data)
  card: { backgroundColor: Colors.surface_container, borderRadius: 12, overflow: 'hidden' },

  // Row inside a card (permission toggle row)
  permRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  // Row inside a card (tappable action row with chevron)
  actionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  permLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  permLabel: { fontSize: 14, fontWeight: '500', color: Colors.on_surface },

  // Thin separator line between card rows
  divider: { height: 1, backgroundColor: Colors.outline_variant, opacity: 0.3, marginHorizontal: 16 },

  // Dimmed appearance for tier-locked sound chips
  chipLocked: { opacity: 0.4 },

  // Small "Pro" badge overlaid top-right of locked chips
  proBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.primary, borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  proBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },

  // Small "Max" badge shown inline next to gated export row
  maxBadge: {
    backgroundColor: Colors.secondary_container,
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4,
  },
  maxBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.on_secondary_container },

  // Dev tools tap target (version label at bottom)
  appInfo: { alignItems: 'center', gap: 6, paddingTop: 8 },
  appInfoText: { fontSize: 12, color: Colors.on_surface_variant, opacity: 0.4 },

  // Alarm sound list row
  alarmRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  alarmLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  // Highlighted label style when a sound is the active selection
  alarmLabelActive: { color: Colors.primary, fontWeight: '700' },

  // Small pill button for Preview / Delete actions
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(168,164,255,0.1)',
  },
  previewBtnText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
});
