import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Switch, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Audio } from 'expo-av';
import { Colors } from '../constants';
import { sessionService } from '../services/SessionService';
import { audioService } from '../services/AudioService';
import { getAlarmSound, setAlarmSound } from '../services/SettingsService';
import { useTier } from '../hooks/useTier';
import { RootStackParamList } from '../navigation/AppNavigator';
import { ALARM_SOUNDS, AlarmSoundId } from '../constants/config';
import type { SoundType } from '../services/AudioService';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SOUNDS: { label: string; value: SoundType }[] = [
  { label: 'Rain', value: 'rain' },
  { label: 'Fan', value: 'fan' },
  { label: 'Static', value: 'static' },
  { label: 'Brown', value: 'brown' },
];

const SENSITIVITIES = ['Low', 'Medium', 'High'] as const;
type Sensitivity = typeof SENSITIVITIES[number];

export default function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { limits } = useTier();
  const [selectedSound,    setSelectedSound]    = useState<SoundType>('rain');
  const [volume,           setVolume]           = useState(0.4);
  const [sensitivity,      setSensitivity]      = useState<Sensitivity>('Medium');
  const [micEnabled,       setMicEnabled]       = useState(true);
  const [accelEnabled,     setAccelEnabled]     = useState(true);
  const [notifEnabled,     setNotifEnabled]     = useState(true);
  const [selectedAlarm,    setSelectedAlarm]    = useState<AlarmSoundId>('alarm');
  const previewSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    getAlarmSound().then(setSelectedAlarm).catch(() => {});
  }, []);

  async function handleAlarmSelect(id: AlarmSoundId) {
    setSelectedAlarm(id);
    await setAlarmSound(id).catch(() => {});
  }

  async function handleAlarmPreview(file: number) {
    // Stop any existing preview
    if (previewSoundRef.current) {
      await previewSoundRef.current.stopAsync().catch(() => {});
      await previewSoundRef.current.unloadAsync().catch(() => {});
      previewSoundRef.current = null;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(file, { volume: 0.8, shouldPlay: true });
      previewSoundRef.current = sound;
      setTimeout(async () => {
        await sound.stopAsync().catch(() => {});
        await sound.unloadAsync().catch(() => {});
        if (previewSoundRef.current === sound) previewSoundRef.current = null;
      }, 3000);
    } catch {
      // Preview unavailable
    }
  }

  // 3.13 — Reset learning data
  function confirmReset() {
    Alert.alert(
      'Reset Learning Data',
      'This will delete all your session history and restart learning from scratch. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: async () => {
            await sessionService.reset();
            Alert.alert('Done', 'Your learning data has been reset.');
          },
        },
      ],
    );
  }

  // 3.12 — Export session data as JSON (5.6a: gated on exportEnabled)
  async function handleExport() {
    if (!limits.exportEnabled) {
      navigation.navigate('Paywall', { reason: 'Session export requires Max plan' });
      return;
    }
    try {
      const json = await sessionService.exportJSON();
      await Share.share({ message: json, title: 'Smart Nap Timer — Session Data' });
    } catch {
      Alert.alert('Export failed', 'Could not export session data.');
    }
  }

  // Sound preview (5.6a: gated on soundsUnlocked)
  async function handleSoundSelect(s: SoundType) {
    if (!limits.soundsUnlocked.includes(s)) {
      navigation.navigate('Paywall', { reason: `${s} sound requires a paid plan` });
      return;
    }
    setSelectedSound(s);
    await audioService.play(s, volume);
    setTimeout(() => audioService.stop(), 3000);
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Alarm Sound */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alarm Sound</Text>
          <View style={styles.card}>
            {ALARM_SOUNDS.map((item, index) => {
              const active = selectedAlarm === item.id;
              return (
                <React.Fragment key={item.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.alarmRow}>
                    <TouchableOpacity
                      style={styles.alarmLeft}
                      onPress={() => handleAlarmSelect(item.id)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={active ? 'check-circle' : 'circle-outline'}
                        size={20}
                        color={active ? Colors.primary : Colors.outline}
                      />
                      <Text style={[styles.permLabel, active && styles.alarmLabelActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.previewBtn}
                      onPress={() => handleAlarmPreview(item.file as number)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="play-circle-outline" size={16} color={Colors.primary} />
                      <Text style={styles.previewBtnText}>Preview</Text>
                    </TouchableOpacity>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* White noise sound */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>White Noise Sound</Text>
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

        {/* Volume */}
        <View style={styles.section}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Volume</Text>
            <Text style={styles.valueText}>{Math.round(volume * 100)}%</Text>
          </View>
          <View style={styles.sliderRow}>
            <MaterialCommunityIcons name="volume-mute" size={16} color={Colors.on_surface_variant} />
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${volume * 100}%` as any }]} />
              <View style={[styles.sliderThumb, { left: `${Math.max(0, volume * 100 - 4)}%` as any }]} />
            </View>
            <MaterialCommunityIcons name="volume-high" size={16} color={Colors.on_surface_variant} />
          </View>
        </View>

        {/* Detection sensitivity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detection Sensitivity</Text>
          <View style={styles.chipRow}>
            {SENSITIVITIES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, styles.chipFlex, sensitivity === s && styles.chipActive]}
                onPress={() => setSensitivity(s)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, sensitivity === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Permissions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Permissions</Text>
          <View style={styles.card}>
            <View style={styles.permRow}>
              <View style={styles.permLeft}>
                <MaterialCommunityIcons name="microphone" size={20} color={Colors.primary} />
                <Text style={styles.permLabel}>Microphone</Text>
              </View>
              <Switch value={micEnabled} onValueChange={setMicEnabled}
                trackColor={{ false: Colors.surface_container_high, true: Colors.secondary_container }}
                thumbColor={micEnabled ? Colors.primary : Colors.outline} />
            </View>
            <View style={styles.divider} />
            <View style={styles.permRow}>
              <View style={styles.permLeft}>
                <MaterialCommunityIcons name="vibrate" size={20} color={Colors.primary} />
                <Text style={styles.permLabel}>Motion Sensors</Text>
              </View>
              <Switch value={accelEnabled} onValueChange={setAccelEnabled}
                trackColor={{ false: Colors.surface_container_high, true: Colors.secondary_container }}
                thumbColor={accelEnabled ? Colors.primary : Colors.outline} />
            </View>
            <View style={styles.divider} />
            <View style={styles.permRow}>
              <View style={styles.permLeft}>
                <MaterialCommunityIcons name="bell-outline" size={20} color={Colors.primary} />
                <Text style={styles.permLabel}>Notifications</Text>
              </View>
              <Switch value={notifEnabled} onValueChange={setNotifEnabled}
                trackColor={{ false: Colors.surface_container_high, true: Colors.secondary_container }}
                thumbColor={notifEnabled ? Colors.primary : Colors.outline} />
            </View>
          </View>
        </View>

        {/* Data — 3.12 export + 3.13 reset */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.actionRow} onPress={handleExport} activeOpacity={0.7}>
              <View style={styles.permLeft}>
                <MaterialCommunityIcons name="export" size={20} color={Colors.secondary} />
                <Text style={styles.permLabel}>Export Session Data</Text>
                {!limits.exportEnabled && (
                  <View style={styles.maxBadge}>
                    <Text style={styles.maxBadgeText}>Max</Text>
                  </View>
                )}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.outline} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.actionRow} onPress={confirmReset} activeOpacity={0.7}>
              <View style={styles.permLeft}>
                <MaterialCommunityIcons name="delete-outline" size={20} color={Colors.error} />
                <Text style={[styles.permLabel, { color: Colors.error }]}>Reset Learning Data</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={Colors.outline} />
            </TouchableOpacity>
          </View>
        </View>

        {/* 5-tap to open Dev Tools (DEV only) */}
        {__DEV__ && <DevToolsTrigger />}
      </ScrollView>
    </SafeAreaView>
  );
}

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
    timerRef.current = setTimeout(() => { tapsRef.current = 0; }, 2000);
  }

  return (
    <TouchableOpacity onPress={handleTap} style={styles.appInfo} activeOpacity={1}>
      <MaterialCommunityIcons name="star-four-points" size={20} color={Colors.primary} style={{ opacity: 0.4 }} />
      <Text style={styles.appInfoText}>Smart Nap Timer v1.0.0</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 24, paddingVertical: 16, backgroundColor: Colors.background },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.on_surface, letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120, gap: 28 },
  section: { gap: 12 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: 1.5, color: Colors.on_surface_variant,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  valueText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
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
  card: { backgroundColor: Colors.surface_container, borderRadius: 12, overflow: 'hidden' },
  permRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  actionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  permLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  permLabel: { fontSize: 14, fontWeight: '500', color: Colors.on_surface },
  divider: { height: 1, backgroundColor: Colors.outline_variant, opacity: 0.3, marginHorizontal: 16 },
  chipLocked: { opacity: 0.4 },
  proBadge: {
    position: 'absolute', top: -4, right: -4,
    backgroundColor: Colors.primary, borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1,
  },
  proBadgeText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  maxBadge: {
    backgroundColor: Colors.secondary_container,
    borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginLeft: 4,
  },
  maxBadgeText: { fontSize: 9, fontWeight: '700', color: Colors.on_secondary_container },
  appInfo: { alignItems: 'center', gap: 6, paddingTop: 8 },
  appInfoText: { fontSize: 12, color: Colors.on_surface_variant, opacity: 0.4 },

  alarmRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  alarmLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  alarmLabelActive: { color: Colors.primary, fontWeight: '700' },
  previewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: 'rgba(168,164,255,0.1)',
  },
  previewBtnText: { fontSize: 11, fontWeight: '600', color: Colors.primary },
});
