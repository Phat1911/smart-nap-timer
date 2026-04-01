/**
 * MonitoringScreen
 *
 * Tasks wired here:
 *   2.22 — Live confidence score bar from ConfidenceEngine (via useSleepDetection)
 *   2.23 — Sleep latency counter (elapsed seconds) from useSleepDetection
 *   2.24 — Detection method label from useSleepDetection
 *   2.16 — PermissionDeniedCard shown when permissions are not granted
 *   2.15 — Manual tap fallback via onManualTap
 *   P.11 — NotificationBlocker: block on mount, unblock on unmount / cancel
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp }          from '@react-navigation/native-stack';
import { Colors }                             from '../constants';
import { RootStackParamList }                 from '../navigation/AppNavigator';
import { useSleepDetection }                  from '../hooks/useSleepDetection';
import { usePermissions }                     from '../hooks/usePermissions';
import { PermissionDeniedCard }               from '../components/ui/PermissionDeniedCard';
import { notificationBlocker }                from '../services/NotificationBlocker';
import DndService                             from '../services/DndService';

const DND_PERMISSION_ASKED_KEY = '@smart_nap_timer:dnd_permission_asked';

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

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Monitoring'>;

// Labels shown in the detection method row (task 2.24)
const METHOD_LABELS: Record<string, string> = {
  combo:         'Accel + Mic',
  accelerometer: 'Accelerometer',
  mic:           'Microphone',
  manual_tap:    'Manual tap',
};

export default function MonitoringScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { targetMinutes, placement, placements } = route.params;

  // ── Permissions (tasks 2.11–2.14, 2.16) ──────────────────────────────────
  const permissions = usePermissions();

  // ── Sleep detection (tasks 2.10, 2.22–2.24) ──────────────────────────────
  // P.4 — pass placement so ConfidenceEngine uses the correct profile weights
  const { state, onManualTap } = useSleepDetection(targetMinutes, placement, placements);

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

  // ── Navigate to Sleeping when sleep is detected (task 2.10) ──────────────
  useEffect(() => {
    if (state.isDetected) {
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
  }, [state.isDetected]);

  // ── Auto-stop: navigate when targetMinutes elapsed without detection ─────────
  useEffect(() => {
    if (state.elapsedSeconds >= targetMinutes * 60 && !state.isDetected) {
      navigation.replace('Sleeping', {
        targetMinutes,
        sleepStartTime: Date.now(),
        placement,
        placements,
        latencySeconds:  state.elapsedSeconds,
        detectionMethod: 'manual_tap',
        confidenceScore: state.confidence,
      });
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
  const methodLabel    = METHOD_LABELS[state.detectionMethod] ?? 'Accel + Mic'; // task 2.24

  function handleCancel() {
    // P.11 -- unblock is handled by the useEffect cleanup on unmount;
    // do NOT call it here to avoid a race with the new screen's block().
    navigation.goBack();
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
          <MaterialCommunityIcons name="star-four-points" size={22} color={Colors.primary} />
          <Text style={styles.headerTitle}>Permissions required</Text>
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
      {/* DND permission modal — shown once when permission hasn't been granted */}
      <Modal
        visible={showDndModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDndModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enable Do Not Disturb</Text>
            <Text style={styles.modalBody}>
              Smart Nap Timer can silence all interruptions during your nap for a
              deeper sleep experience. Grant Do Not Disturb access in Settings to
              activate this feature.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowDndModal(false)}
                style={styles.modalBtnSecondary}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnSecondaryText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  setShowDndModal(false);
                  await DndService.requestPermission();
                }}
                style={styles.modalBtnPrimary}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnPrimaryText}>Grant access</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="star-four-points" size={22} color={Colors.primary} />
          <Text style={styles.headerTitle}>Detecting sleep...</Text>
        </View>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account-circle" size={28} color={Colors.on_surface_variant} />
        </View>
      </View>

      {/* Main */}
      <View style={styles.main}>
        <View style={styles.glow} pointerEvents="none" />

        {/* Elapsed time — sleep latency counter (task 2.23) */}
        <View style={styles.timerSection}>
          <Text style={styles.timerLabel}>Time since start</Text>
          <Text style={styles.timerDisplay}>{timeStr}</Text>
        </View>

        {/* Confidence bar (task 2.22) */}
        <View style={styles.confidenceCard}>
          <View style={styles.confidenceTop}>
            <Text style={styles.confidenceTitle}>Sleep confidence</Text>
            <Text style={styles.confidenceValue}>{confInt}%</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${confInt}%` as any }]} />
          </View>
        </View>

        {/* Sensor status */}
        <View style={styles.sensorList}>
          <View style={styles.sensorRow}>
            <View style={styles.sensorLeft}>
              <View style={styles.sensorIconBox}>
                <MaterialCommunityIcons name="vibrate" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.sensorName}>Accelerometer</Text>
            </View>
            <View style={styles.sensorStatus}>
              <Text style={styles.sensorStatusText}>
                {state.accelActive ? 'Active' : 'Starting'}
              </Text>
              <View style={[styles.statusDot, !state.accelActive && styles.statusDotOff]} />
            </View>
          </View>

          <View style={styles.sensorRow}>
            <View style={styles.sensorLeft}>
              <View style={styles.sensorIconBox}>
                <MaterialCommunityIcons name="microphone" size={20} color={Colors.primary} />
              </View>
              <Text style={styles.sensorName}>Microphone</Text>
            </View>
            <View style={styles.sensorStatus}>
              <Text style={styles.sensorStatusText}>
                {permissions.micStatus === 'denied'
                  ? 'Denied'
                  : state.micActive ? 'Active' : 'Starting'}
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
            <Text style={styles.methodLabel}>Detection method</Text>
            <Text style={styles.methodValue}>{methodLabel}</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {/* White noise indicator */}
        <View style={styles.whiteNoiseBar}>
          <MaterialCommunityIcons name="sine-wave" size={16} color={Colors.primary} />
          <Text style={styles.whiteNoiseText}>White noise playing</Text>
          <View style={styles.waveViz}>
            {[2, 3, 4, 3, 2].map((h, i) => (
              <View key={i} style={[styles.waveLine, { height: h * 3 }]} />
            ))}
          </View>
        </View>

        {/* Manual tap fallback (task 2.15) */}
        <TouchableOpacity onPress={onManualTap} style={styles.tapFallbackBtn} activeOpacity={0.7}>
          <Text style={styles.tapFallbackText}>Tap when drifting off</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.on_surface, letterSpacing: -0.3 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surface_container_high,
    alignItems: 'center', justifyContent: 'center',
  },

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
