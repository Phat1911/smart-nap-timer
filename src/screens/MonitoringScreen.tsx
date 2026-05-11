/**
 * MonitoringScreen — Real-time sleep state monitoring screen
 *
 * Responsible for:
 * - Displaying sleep confidence score as a progress bar (updates every second)
 * - Counting sleep latency (time to fall asleep) in mm:ss format
 * - Displaying the detection method label (accelerometer / mic / combo / tap)
 * - Blocking system notifications and enabling DND when monitoring starts
 * - Automatically navigating to SleepingScreen when sleep is detected
 * - Showing PermissionDeniedCard if notification permission is denied
 * - Handling fall-asleep timeout: saves session and navigates directly to WakeScreen
 *
 * Used by:
 * - AppNavigator: "Monitoring" screen in the stack
 * - HomeScreen: navigates here when "Start Nap" is pressed
 *
 * Notes:
 * - DND modal is shown only once (flag saved in AsyncStorage)
 * - navigatedRef prevents double-navigation when multiple effects fire simultaneously
 * - useTierGate() is re-checked here even though HomeScreen already checks it —
 *   protects against users deep-linking directly into this screen
 *
 * Tasks wired here:
 *   2.22 — Live confidence score bar from ConfidenceEngine (via useSleepDetection)
 *   2.23 — Sleep latency counter (elapsed seconds) from useSleepDetection
 *   2.24 — Detection method label from useSleepDetection
 *   2.16 — PermissionDeniedCard shown when permissions are not granted
 *   2.15 — Manual tap fallback via onManualTap
 *   P.11 — NotificationBlocker: block on mount, unblock on unmount / cancel
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import * as Brightness from 'expo-brightness';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp }          from '@react-navigation/native-stack';
import { Colors }                             from '../constants';
import { getSleepScoreTrigger }               from '../constants/config';
import { useLanguage }                        from '../contexts/LanguageContext';
import { RootStackParamList }                 from '../navigation/AppNavigator';
import { useSleepDetection }                  from '../hooks/useSleepDetection';
import { usePermissions }                     from '../hooks/usePermissions';
import { useTierGate }                        from '../hooks/useTierGate';
import { PermissionDeniedCard }               from '../components/ui/PermissionDeniedCard';
import { notificationBlocker }                from '../services/NotificationBlocker';
import DndService                             from '../services/DndService';
import { sessionService }                     from '../services/SessionService';
import { usageService }                       from '../services/UsageService';
import type { NapSession }                    from '../models/Session';

const DND_PERMISSION_ASKED_KEY = '@smart_nap_timer:dnd_permission_asked';
const MANUAL_TAP_DIM_BRIGHTNESS = 0.005;

// ── Haptics shim (no static import — native module guard) ─────────────────────
let Haptics: any;
if (!__DEV__) {
  Haptics = require('expo-haptics');
} else {
  Haptics = {
    notificationAsync: async () => {},
    impactAsync:       async () => {},
    NotificationFeedbackType: { Success: 'success' },
    ImpactFeedbackStyle:      { Heavy: 'heavy' },
  };
}

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Monitoring'>;

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

export default function MonitoringScreen() {
  const { strings: Strings } = useLanguage();
  const navigation = useNavigation<Nav>();

  // Labels shown in the detection method row (task 2.24)
  const METHOD_LABELS: Record<string, string> = {
    combo:         Strings.monitoring_method_combo,
    accelerometer: Strings.monitoring_method_accel,
    mic:           Strings.monitoring_method_mic,
    manual_tap:    Strings.monitoring_method_tap,
  };
  const route      = useRoute<Route>();
  const { targetMinutes, placement, placements, maxFallAsleepMinutes } = route.params;
  const originalBrightnessRef = useRef<number | null>(null);
  const brightnessDimmedRef = useRef(false);
  const [touchLocked, setTouchLocked] = useState(false);

  // ── Permissions (tasks 2.11–2.14, 2.16) ──────────────────────────────────
  const permissions = usePermissions();

  // ── Sleep detection (tasks 2.10, 2.22–2.24) ──────────────────────────────
  // P.4 — pass placement so ConfidenceEngine uses the correct profile weights
  const { state, onManualTap } = useSleepDetection(targetMinutes, placement, placements);

  // Guard: prevents double navigation if two timeout effects fire in rapid succession
  const navigatedRef = useRef(false);

  // "Put phone down" hint — shown once when hand placement confidence reaches 65%
  const [showPlaceDownHint, setShowPlaceDownHint] = useState(false);
  const placeDownShownRef = useRef(false);
  useEffect(() => {
    if (placeDownShownRef.current) return;
    if (placement !== 'hand') return;
    if (state.confidence >= 65) {
      placeDownShownRef.current = true;
      setShowPlaceDownHint(true);
    }
  }, [state.confidence]);

  // ── Tier gate (Finding 3 security fix) ───────────────────────────────────
  // canStart is also checked in HomeScreen, but a user could deep-link here
  // bypassing HomeScreen entirely. Re-check here as a second enforcement layer.
  const { canStart, loading } = useTierGate();
  const checking = loading;

  // ── DND permission modal (one-time, Android only) ────────────────────────
  const [showDndModal, setShowDndModal] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      const alreadyAsked = await AsyncStorage.getItem(DND_PERMISSION_ASKED_KEY).catch(() => null);
      if (alreadyAsked) return;
      const granted = await DndService.isPermissionGranted();
      if (!granted) {
        setShowDndModal(true);
        await AsyncStorage.setItem(DND_PERMISSION_ASKED_KEY, 'true').catch(() => {});
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (originalBrightnessRef.current !== null) {
        Brightness.setBrightnessAsync(originalBrightnessRef.current).catch(() => {});
      }
    };
  }, []);

  // ── Gate: navigate back to Main if daily limit is reached ───────────────
  useEffect(() => {
    // checking=true means the async check is still in-flight -- wait for it
    if (checking) return;
    if (!canStart) {
      // User has hit their daily limit -- send them back to Home
      // (HomeScreen will show the upgrade prompt via its own useTierGate)
      navigation.replace('Main');
    }
  }, [canStart, checking]);

  // ── Navigate to Sleeping when sleep is detected (task 2.10) ──────────────
  useEffect(() => {
    if (navigatedRef.current) return;
    if (state.isDetected) {
      navigatedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.replace('Sleeping', {
        targetMinutes,
        sleepStartTime: Date.now(),
        placement,
        placements,
        latencySeconds: state.elapsedSeconds,
        detectionMethod: state.detectionMethod,
        confidenceScore: state.confidence,
      });
    }
  }, [state.isDetected, targetMinutes, placement, placements, navigation, state.elapsedSeconds, state.detectionMethod, state.confidence]);

  function handleManualTapStart() {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    onManualTap();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.replace('Sleeping', {
      targetMinutes,
      sleepStartTime: Date.now(),
      placement,
      placements,
      latencySeconds: state.elapsedSeconds,
      detectionMethod: 'manual_tap',
      confidenceScore: state.confidence,
    });
  }

  // ── Feature 1: Fall-asleep timeout — fires when max fall-asleep window elapses ──
  // Only fires if sleep hasn't been detected yet.
  useEffect(() => {
    if (navigatedRef.current) return;
    if (state.isDetected) return;
    if (state.elapsedSeconds < maxFallAsleepMinutes * 60) return;

    navigatedRef.current = true;
    const now = new Date();
    const ts = Date.now();
    const sessionId = `session_${ts}`;
    const session: NapSession = {
      session_id:           sessionId,
      date:                 now.toISOString(),
      hour:                 now.getHours(),
      day_of_week:          now.getDay(),
      time_of_day:          sessionService.getTimeOfDay(now.getHours()),
      target_minutes:       targetMinutes,
      actual_sleep_minutes: 0,
      latency_minutes:      maxFallAsleepMinutes,
      threshold_T_used:     maxFallAsleepMinutes,
      detection_method:     state.detectionMethod,
      placement,
      placements:           placements.length > 0 ? placements : [placement],
      wake_rating:          null,
      is_insufficient:      true,
      confidence_score:     state.confidence,
    };
    usageService.recordSessionStart().catch(() => {});
    sessionService.save(session).catch(() => {});
    navigation.replace('Wake', { sessionId, fallAsleepTimeout: true });
  }, [state.elapsedSeconds]);

  // ── Auto-stop: user never fell asleep — skip Sleeping, go directly to Wake ───
  // Sleeping screen counts down the nap; if detection never fired the nap time
  // is already elapsed, so there is nothing to count down. Save a zero-sleep
  // session and navigate straight to WakeScreen.
  useEffect(() => {
    if (navigatedRef.current) return;
    if (state.elapsedSeconds >= targetMinutes * 60 && !state.isDetected) {
      const now = new Date();
      const ts = Date.now();
      const sessionId = `session_${ts}`;
      const session: NapSession = {
        session_id:           sessionId,
        date:                 now.toISOString(),
        hour:                 now.getHours(),
        day_of_week:          now.getDay(),
        time_of_day:          sessionService.getTimeOfDay(now.getHours()),
        target_minutes:       targetMinutes,
        actual_sleep_minutes: 0,
        latency_minutes:      targetMinutes,
        threshold_T_used:     targetMinutes,
        detection_method:     state.detectionMethod,
        placement,
        placements:           placements.length > 0 ? placements : [placement],
        wake_rating:          null,
        is_insufficient:      true,
        confidence_score:     state.confidence,
      };
      navigatedRef.current = true;
      usageService.recordSessionStart().catch(() => {});
      sessionService.save(session).catch(() => {});
      navigation.replace('Wake', { sessionId });
    }
  }, [state.elapsedSeconds]);

  // ── P.11 — Block foreground notifications + system DND on mount ─────────────
  useEffect(() => {
    notificationBlocker.block().catch(() => {});
    DndService.enable().catch(() => {});
    return () => {
      notificationBlocker.unblock().catch(() => {});
      DndService.disable().catch(() => {});
    };
  }, []);

  // ── Formatted elapsed time (task 2.23) ───────────────────────────────────
  const elapsedMins = Math.floor(state.elapsedSeconds / 60);
  const elapsedSecs = state.elapsedSeconds % 60;
  const timeStr = `${String(elapsedMins).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')}`;

  const confInt        = Math.round(state.confidence);                       // task 2.22
  const methodLabel    = METHOD_LABELS[state.detectionMethod] ?? Strings.monitoring_method_combo; // task 2.24

  function handleCancel() {
    // P.11 -- unblock is handled by the useEffect cleanup on unmount;
    // do NOT call it here to avoid a race with the new screen's block().
    navigation.replace('Main');
  }

  function handleManualTapBrightness() {
    if (brightnessDimmedRef.current) return;
    brightnessDimmedRef.current = true;
    setTouchLocked(true);

    (async () => {
      try {
        if (originalBrightnessRef.current === null) {
          originalBrightnessRef.current = await Brightness.getBrightnessAsync();
        }
        await Brightness.setBrightnessAsync(MANUAL_TAP_DIM_BRIGHTNESS);
      } catch {
        brightnessDimmedRef.current = false;
        setTouchLocked(false);
      }
    })();
  }

  // ── Show permission wall if critical permissions are denied ───────────────
  const showPermissionWall =
    !permissions.requesting &&
    (permissions.micStatus === 'denied' || permissions.notifStatus === 'denied') &&
    permissions.notifStatus === 'denied'; // alarm won't work without notifications

  if (showPermissionWall) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <Text style={{ fontSize: 22 }}>✨</Text>
          <Text style={styles.headerTitle}>{Strings.monitoring_permissions_title}</Text>
        </View>
        <PermissionDeniedCard
          micDenied={permissions.micStatus === 'denied'}
          notifDenied={permissions.notifStatus === 'denied'}
          onContinueWithoutMic={
            permissions.micStatus === 'denied' && permissions.notifStatus !== 'denied'
              ? handleCancel
              : undefined
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {touchLocked && <View style={styles.touchShield} pointerEvents="auto" />}

      {/* DND permission modal — shown once when permission hasn't been granted */}
      <Modal
        visible={showDndModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDndModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{Strings.monitoring_dnd_title}</Text>
            <Text style={styles.modalBody}>{Strings.monitoring_dnd_body}</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowDndModal(false)}
                style={styles.modalBtnSecondary}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnSecondaryText}>{Strings.monitoring_dnd_not_now}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setShowDndModal(false);
                  await DndService.requestPermission();
                }}
                style={styles.modalBtnPrimary}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnPrimaryText}>{Strings.monitoring_dnd_grant}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <Text style={{ fontSize: 22 }}>✨</Text>
        <Text style={styles.headerTitle}>{Strings.monitoring_title}</Text>
      </View>

      {/* Main */}
      <View style={styles.main}>
        <View style={styles.glow} pointerEvents="none" />

        {/* Elapsed time — sleep latency counter (task 2.23) */}
        <View style={styles.timerSection}>
          <Text style={styles.timerLabel}>{Strings.monitoring_latency}</Text>
          <Text style={styles.timerDisplay}>{timeStr}</Text>
        </View>

        {/* Confidence bar (task 2.22) */}
        <View style={styles.confidenceCard}>
          <View style={styles.confidenceTop}>
            <Text style={styles.confidenceTitle}>{Strings.monitoring_confidence}</Text>
            <Text style={styles.confidenceValue}>{confInt}%</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${confInt}%` as any }]} />
          </View>
        </View>

        {/* Hand placement "put phone down" hint — appears once at 65% confidence */}
        {showPlaceDownHint && (
          <View style={styles.placeDownHint}>
            <Text style={{ fontSize: 18 }}>🛏️</Text>
            <Text style={styles.placeDownText}>
              Drifting off — gently place phone on your chest or mattress
            </Text>
          </View>
        )}

        {/* Debug overlay — __DEV__ only, not shown in production */}
        {/* {__DEV__ && (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>DEBUG — Score Breakdown</Text>
            <DebugRow label="Accel   " value={state.accelScore} />
            <DebugRow label="Gyro    " value={state.gyroScore} />
            <DebugRow label="Mic     " value={state.micScore} />
            <DebugRow label="Duration" value={state.durationScore} />
            <View style={styles.debugDivider} />
            <DebugRow label="FUSED  " value={Math.round(state.confidence)} highlight />
            <DebugRow label="TRIGGER" value={getSleepScoreTrigger()} dim />
            <Text style={styles.debugGuard}>
              {state.falsePositiveGuard
                ? 'FP GUARD: ACTIVE (score capped at 58)'
                : 'FP guard: off'}
            </Text>
          </View>
        )} */}

        {/* Sensor status */}
        <View style={styles.sensorList}>
          <View style={styles.sensorRow}>
            <View style={styles.sensorLeft}>
              <View style={styles.sensorIconBox}>
                <Text style={{ fontSize: 20 }}>📳</Text>
              </View>
              <Text style={styles.sensorName}>{Strings.monitoring_method_accel}</Text>
            </View>
            <View style={styles.sensorStatus}>
              <Text style={styles.sensorStatusText}>
                {state.accelActive ? Strings.monitoring_sensor_active : Strings.monitoring_sensor_starting}
              </Text>
              <View style={[styles.statusDot, !state.accelActive && styles.statusDotOff]} />
            </View>
          </View>

          <View style={styles.sensorRow}>
            <View style={styles.sensorLeft}>
              <View style={styles.sensorIconBox}>
                <Text style={{ fontSize: 20 }}>🎤</Text>
              </View>
              <Text style={styles.sensorName}>{Strings.monitoring_method_mic}</Text>
            </View>
            <View style={styles.sensorStatus}>
              <Text style={styles.sensorStatusText}>
                {permissions.micStatus === 'denied'
                  ? Strings.monitoring_sensor_denied
                  : state.micActive ? Strings.monitoring_sensor_active : Strings.monitoring_sensor_starting}
              </Text>
              <View
                style={[
                  styles.statusDot,
                  (!state.micActive || permissions.micStatus === 'denied') &&
                    styles.statusDotOff,
                ]}
              />
            </View>
          </View>

          {/* Detection method label (task 2.24) */}
          <View style={styles.methodRow}>
            <Text style={styles.methodLabel}>{Strings.monitoring_detection_method}</Text>
            <Text style={styles.methodValue}>{methodLabel}</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* White noise indicator */}
        <View style={styles.whiteNoiseBar}>
          <Text style={{ fontSize: 16 }}>〰️</Text>
          <Text style={styles.whiteNoiseText}>{Strings.monitoring_white_noise}</Text>
          <View style={styles.waveViz}>
            {[2, 3, 4, 3, 2].map((h, i) => (
              <View key={i} style={[styles.waveLine, { height: h * 3 }]} />
            ))}
          </View>
        </View>

        {/* Manual tap fallback (brightness dim only) */}
        <TouchableOpacity onPress={handleManualTapStart} style={styles.tapFallbackBtn} activeOpacity={0.7}>
          <Text style={styles.tapFallbackText}>{Strings.monitoring_tap_fallback}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn} activeOpacity={0.7}>
          <Text style={styles.cancelText}>{Strings.monitoring_cancel}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Debug helpers ─────────────────────────────────────────────────────────────

function DebugRow({ label, value, highlight, dim }: {
  label: string;
  value: number;
  highlight?: boolean;
  dim?: boolean;
}) {
  const color = highlight
    ? Colors.primary
    : dim
    ? Colors.on_surface_variant
    : Colors.on_surface;
  return (
    <View style={debugRowStyles.row}>
      <Text style={[debugRowStyles.label, { color }]}>{label}</Text>
      <Text style={[debugRowStyles.value, { color }]}>{Math.round(value)}</Text>
    </View>
  );
}

const debugRowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  label: { fontSize: 11, fontFamily: 'monospace', fontWeight: '500' },
  value: { fontSize: 11, fontFamily: 'monospace', fontWeight: '700' },
});

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.on_surface, letterSpacing: -0.3 },
  main: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  glow: { position: 'absolute', alignSelf: 'center', width: '100%', height: '100%' },

  timerSection: { alignItems: 'center', marginBottom: 48 },
  timerLabel: {
    fontSize: 10, textTransform: 'uppercase', letterSpacing: 2,
    color: Colors.on_surface_variant, fontWeight: '500',
  },
  timerDisplay: {
    fontSize: 80, fontWeight: '200', letterSpacing: -2,
    color: Colors.on_surface, lineHeight: 88, marginTop: 8,
  },

  confidenceCard: {
    width: '100%', backgroundColor: Colors.surface_container_low,
    borderRadius: 12, padding: 20, marginBottom: 24,
  },
  confidenceTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', marginBottom: 12,
  },
  confidenceTitle: { fontSize: 13, fontWeight: '600', color: Colors.on_surface },
  confidenceValue: { fontSize: 24, fontWeight: '700', color: Colors.primary },
  barTrack: {
    height: 10, backgroundColor: Colors.surface_container_lowest,
    borderRadius: 5, overflow: 'hidden', padding: 2,
  },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.primary },

  sensorList: { width: '100%', gap: 12 },
  sensorRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.surface_container, borderRadius: 12, padding: 16,
  },
  sensorLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  sensorIconBox: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: Colors.surface_container_high,
    alignItems: 'center', justifyContent: 'center',
  },
  sensorName: { fontSize: 14, fontWeight: '500', color: Colors.on_surface },
  sensorStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sensorStatusText: {
    fontSize: 11, fontWeight: '500',
    color: Colors.on_surface_variant, textTransform: 'uppercase', letterSpacing: 1,
  },
  statusDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 4, elevation: 3,
  },
  statusDotOff: { backgroundColor: Colors.outline, shadowOpacity: 0 },

  methodRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 4,
  },
  methodLabel: {
    fontSize: 11, fontWeight: '500',
    color: Colors.on_surface_variant, textTransform: 'uppercase', letterSpacing: 1,
  },
  methodValue: { fontSize: 13, fontWeight: '700', color: Colors.secondary },

  footer: { alignItems: 'center', gap: 16, paddingBottom: 48, paddingHorizontal: 24 },
  whiteNoiseBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(31,31,38,0.4)',
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 99,
    borderWidth: 1, borderColor: 'rgba(72,71,77,0.1)',
  },
  whiteNoiseText: { fontSize: 12, fontWeight: '500', color: 'rgba(249,245,253,0.8)' },
  waveViz: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 8 },
  waveLine: { width: 2, borderRadius: 1, backgroundColor: Colors.primary },

  tapFallbackBtn: { paddingVertical: 6 },
  tapFallbackText: {
    fontSize: 13, color: Colors.on_surface_variant, fontStyle: 'italic',
  },
  cancelBtn: { paddingVertical: 8 },
  cancelText: {
    color: Colors.on_surface_variant, fontSize: 12,
    fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2,
  },

  placeDownHint: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    width: '100%', marginBottom: 16,
    backgroundColor: Colors.surface_container,
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.primary + '33',
  },
  placeDownText: {
    flex: 1, fontSize: 13, lineHeight: 18,
    color: Colors.on_surface, fontWeight: '500',
  },

  touchShield: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },

  // Debug card (__DEV__ only)
  debugCard: {
    width: '100%', marginTop: 12,
    backgroundColor: 'rgba(255,200,0,0.06)',
    borderRadius: 8, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,200,0,0.2)',
    gap: 2,
  },
  debugTitle: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', color: 'rgba(255,200,0,0.6)',
    marginBottom: 6,
  },
  debugDivider: {
    height: 1, backgroundColor: 'rgba(255,200,0,0.15)', marginVertical: 4,
  },
  debugGuard: {
    fontSize: 10, color: 'rgba(255,100,100,0.7)',
    fontWeight: '600', marginTop: 4,
  },

  // DND permission modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%', backgroundColor: Colors.surface_container,
    borderRadius: 20, padding: 24, gap: 16,
  },
  modalTitle: {
    fontSize: 17, fontWeight: '700', color: Colors.on_surface,
  },
  modalBody: {
    fontSize: 14, lineHeight: 22, color: Colors.on_surface_variant,
  },
  modalActions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4,
  },
  modalBtnSecondary: { paddingVertical: 10, paddingHorizontal: 16 },
  modalBtnSecondaryText: {
    fontSize: 14, fontWeight: '600', color: Colors.on_surface_variant,
  },
  modalBtnPrimary: {
    paddingVertical: 10, paddingHorizontal: 20,
    backgroundColor: Colors.primary, borderRadius: 10,
  },
  modalBtnPrimaryText: {
    fontSize: 14, fontWeight: '700', color: '#fff',
  },
});
