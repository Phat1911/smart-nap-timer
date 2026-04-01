/**
 * WakeScreen
 *
 * Tasks wired here: P.7 / P.8 / 3.8 / 3.15 / 3.16 / 4.9 / 5.6b / P.12
 *
 * Alarm:  expo-av audio + Vibration on mount; volume ramps 0.1→1.0 over
 *         ALARM_RAMP_SECONDS using setInterval.
 * Snooze: in-screen countdown (no navigation back to Monitoring); restarts
 *         alarm when countdown reaches zero.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants';
import { RootStackParamList } from '../navigation/AppNavigator';
import { SNOOZE_MINUTES, ALARM_RAMP_SECONDS, ALARM_SOUNDS } from '../constants/config';
import { getAlarmSound } from '../services/SettingsService';
import { sessionService } from '../services/SessionService';
import { buildSessionSummary, useInsufficientSuggestion } from '../hooks/useSessionSummary';
import { useTier } from '../hooks/useTier';
import { NapSession, WakeRating, PlacementEvaluation } from '../models/Session';
import type { DetectionMethod } from '../models/Session';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Wake'>;

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

const METHOD_LABEL: Record<DetectionMethod, string> = {
  accelerometer: 'Accelerometer',
  mic:           'Microphone',
  combo:         'Accel + Mic',
  manual_tap:    'Manual tap',
};

export default function WakeScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const { sessionId } = route.params;

  // ── Session / rating state ────────────────────────────────────────────────
  const [session,        setSession]        = useState<NapSession | null>(null);
  const [rating,         setRating]         = useState<WakeRating>(4);
  const [saved,          setSaved]          = useState(false);

  // P.12 -- placement evaluation state
  const [evalComfortable, setEvalComfortable] = useState<boolean | null>(null);
  const [evalAccuracy,    setEvalAccuracy]    = useState<PlacementEvaluation['accuracyPerceived'] | null>(null);
  const [evalSubmitted,   setEvalSubmitted]   = useState(false);

  // ── Alarm refs ────────────────────────────────────────────────────────────
  const soundRef        = useRef<Audio.Sound | null>(null);
  const rampRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef      = useRef(true);
  const vibrateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Current time display (HH:mm, ticks every second) ─────────────────────
  const [currentTime, setCurrentTime] = useState(() => {
    const n = new Date();
    return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
  });

  // ── Snooze countdown (null = not snoozing) ────────────────────────────────
  const [snoozeSecondsLeft, setSnoozeSecondsLeft] = useState<number | null>(null);

  // 4.9 — Shorter-target suggestion
  const { shouldSuggestShorterTarget, suggestedTargetMinutes } = useInsufficientSuggestion();

  // 5.6b — Tier limits for full report gating
  const { limits } = useTier();

  // ── Alarm helpers ─────────────────────────────────────────────────────────

  const stopAlarm = useCallback(() => {
    if (vibrateTimerRef.current) { clearTimeout(vibrateTimerRef.current); vibrateTimerRef.current = null; }
    if (rampRef.current) { clearInterval(rampRef.current); rampRef.current = null; }
    const s = soundRef.current;
    soundRef.current = null;
    if (s) {
      s.stopAsync().catch(() => {});
      s.unloadAsync().catch(() => {});
    }
  }, []);

  const startAlarm = useCallback(async () => {
    stopAlarm(); // clean slate before (re-)starting
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      const soundId   = await getAlarmSound();
      const soundEntry = ALARM_SOUNDS.find((s) => s.id === soundId) ?? ALARM_SOUNDS[0];
      const { sound } = await Audio.Sound.createAsync(
        soundEntry.file,
        { isLooping: true, volume: 0.1 },
      );
      if (!mountedRef.current) { await sound.unloadAsync(); return; }
      soundRef.current = sound;
      await sound.playAsync();
      let elapsed = 0;
      rampRef.current = setInterval(() => {
        if (!mountedRef.current) { clearInterval(rampRef.current!); rampRef.current = null; return; }
        elapsed++;
        const vol = Math.min(1.0, 0.1 + (0.9 * elapsed / ALARM_RAMP_SECONDS));
        soundRef.current?.setVolumeAsync(vol).catch(() => {});
        if (elapsed >= ALARM_RAMP_SECONDS) { clearInterval(rampRef.current!); rampRef.current = null; }
      }, 1_000);
    } catch {
      // Audio unavailable (e.g. Expo Go without native build) — vibrate only
    }
    const vibrateLoop = () => {
      if (!mountedRef.current) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      vibrateTimerRef.current = setTimeout(vibrateLoop, 1000);
    };
    vibrateLoop();
  }, [stopAlarm]);

  // ── Mount: start alarm; unmount: stop everything ──────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    startAlarm();
    return () => {
      mountedRef.current = false;
      stopAlarm();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Current time ticker ───────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (!mountedRef.current) return;
      const n = new Date();
      setCurrentTime(`${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`);
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  // ── Snooze countdown tick (uses recursive setTimeout for clean cancellation)
  useEffect(() => {
    if (snoozeSecondsLeft === null) return;
    if (snoozeSecondsLeft <= 0) {
      // Countdown over — restart alarm and restore buttons
      setSnoozeSecondsLeft(null);
      startAlarm();
      return;
    }
    const id = setTimeout(() => {
      if (mountedRef.current) setSnoozeSecondsLeft((s) => (s !== null ? s - 1 : null));
    }, 1_000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snoozeSecondsLeft]);

  // ── 3.8 — Load session by ID on mount ────────────────────────────────────
  useEffect(() => {
    async function load() {
      const all   = await sessionService.loadAll();
      const found = all.find((s) => s.session_id === sessionId) ?? null;
      if (!mountedRef.current) return;
      setSession(found);
      if (found?.wake_rating) setRating(found.wake_rating);
    }
    load();
  }, [sessionId]);

  // ── 3.8 / 3.15 / 3.16 — Build summary ───────────────────────────────────
  const summary = session
    ? buildSessionSummary(
        session.target_minutes,
        session.actual_sleep_minutes,
        session.latency_minutes,
        session.detection_method,
      )
    : null;

  // ── Save rating + navigate home ───────────────────────────────────────────
  const handleDone = useCallback(async () => {
    stopAlarm();
    if (session && !saved) {
      setSaved(true);
      const updated: NapSession = { ...session, wake_rating: rating };
      const all = await sessionService.loadAll();
      const idx = all.findIndex((s) => s.session_id === sessionId);
      if (idx >= 0) {
        all[idx] = updated;
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        await AsyncStorage.setItem('@smart_nap_timer:sessions', JSON.stringify(all));
      }
      if (evalComfortable !== null && evalAccuracy !== null && !evalSubmitted) {
        setEvalSubmitted(true);
        const evaluation: PlacementEvaluation = {
          comfortable:       evalComfortable,
          accuracyPerceived: evalAccuracy,
        };
        await sessionService.updatePlacementEvaluation(sessionId, evaluation).catch(() => {});
      }
    }
    navigation.navigate('Main');
  }, [session, saved, rating, sessionId, navigation, evalComfortable, evalAccuracy, evalSubmitted, stopAlarm]);

  // ── Snooze actions ────────────────────────────────────────────────────────
  function handleSnooze() {
    stopAlarm();
    setSnoozeSecondsLeft(SNOOZE_MINUTES * 60);
  }

  function handleCancelSnooze() {
    setSnoozeSecondsLeft(null);
    navigation.navigate('Main');
  }

  // ── Derived display values ────────────────────────────────────────────────
  const target     = summary?.targetMinutes ?? 0;
  const actual     = summary?.actualMinutes ?? 0;
  const latency    = summary?.latencyMinutes ?? 0;
  const method     = session?.detection_method ?? 'combo';
  const qualityPct = Math.round(((rating / 5) * 0.6 + (actual / (target || 1)) * 0.4) * 100);

  const snoozeMins = snoozeSecondsLeft !== null ? Math.floor(snoozeSecondsLeft / 60) : 0;
  const snoozeSecs = snoozeSecondsLeft !== null ? snoozeSecondsLeft % 60 : 0;
  const snoozeStr  = `${String(snoozeMins).padStart(2, '0')}:${String(snoozeSecs).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Restored</Text>
        <TouchableOpacity onPress={handleDone} activeOpacity={0.7}>
          <MaterialCommunityIcons name="close" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Time to Wake Up</Text>
          <Text style={styles.heroTime}>{currentTime}</Text>
          <Text style={styles.heroSub}>How do you feel?</Text>
        </View>

        {/* Star Rating */}
        <View style={styles.ratingRow}>
          <View style={styles.stars}>
            {([1, 2, 3, 4, 5] as WakeRating[]).map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} activeOpacity={0.7}>
                <MaterialCommunityIcons
                  name={s <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={s <= rating ? Colors.primary : Colors.outline_variant}
                  style={s <= rating ? styles.starGlow : undefined}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingValue}>{rating}.0</Text>
        </View>

        {/* 3.8 — Summary Card (real data) */}
        <View style={styles.summaryCard}>
          <View style={styles.cardGlow} pointerEvents="none" />
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Target</Text>
              <Text style={styles.summaryItemValue}>{target} min</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Actual sleep</Text>
              <Text style={[styles.summaryItemValue, { color: Colors.primary }]}>{actual} min</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Time to fall asleep</Text>
              <Text style={styles.summaryItemValue}>{latency} min</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Detected via</Text>
              <View style={styles.detectedRow}>
                <MaterialCommunityIcons name="access-point" size={14} color={Colors.on_surface} />
                <Text style={styles.summaryItemValueSm}>{METHOD_LABEL[method]}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3.15 / 3.16 / 5.6b — Insufficient sleep warning */}
        {summary?.isInsufficient && (
          limits.fullReportEnabled ? (
            <View style={styles.warningCard}>
              <View style={styles.warningIconBox}>
                <MaterialCommunityIcons name="alert" size={20} color={Colors.on_error_container} />
              </View>
              <View style={styles.warningText}>
                <Text style={styles.warningTitle}>You didn't get enough sleep</Text>
                <Text style={styles.warningBody}>
                  You got {actual} min (target: {target} min). Missing: {summary.missingMinutes} min.
                </Text>
                <View style={styles.warnProgress}>
                  <View style={[styles.warnProgressFill, { width: `${summary.progressPercent}%` as any }]} />
                </View>
                <Text style={styles.warnReasons}>Possible reasons: woke earlier than planned, try a quieter environment.</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.warningCard}
              onPress={() => navigation.navigate('Paywall', { reason: 'Upgrade to Pro for full sleep analysis' })}
              activeOpacity={0.8}
            >
              <View style={styles.warningIconBox}>
                <MaterialCommunityIcons name="alert" size={20} color={Colors.on_error_container} />
              </View>
              <View style={styles.warningText}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.warningTitle}>You didn't sleep enough.</Text>
                  <MaterialCommunityIcons name="crown" size={14} color={Colors.primary} />
                </View>
                <Text style={styles.warningBody}>Upgrade to Pro for full sleep analysis.</Text>
              </View>
            </TouchableOpacity>
          )
        )}

        {/* 4.9 — Shorter target suggestion (shown after 3+ insufficient streak) */}
        {shouldSuggestShorterTarget && (
          <View style={styles.suggestionCard}>
            <View style={styles.suggestionIconBox}>
              <MaterialCommunityIcons name="lightbulb-outline" size={20} color={Colors.primary} />
            </View>
            <View style={styles.suggestionText}>
              <Text style={styles.suggestionTitle}>Try a shorter target</Text>
              <Text style={styles.suggestionBody}>
                Your last few naps came up short. Consider a {suggestedTargetMinutes}-minute
                target next time — it better matches your recent sleep patterns.
              </Text>
            </View>
          </View>
        )}

        {/* P.12 -- Placement Evaluation Card */}
        {session && (
          <View style={styles.evalCard}>
            <View style={styles.evalHeader}>
              <MaterialCommunityIcons name="cellphone-settings" size={18} color={Colors.primary} />
              <Text style={styles.evalTitle}>How was your placement?</Text>
            </View>

            <Text style={styles.evalQuestion}>Was it comfortable?</Text>
            <View style={styles.evalRow}>
              {([true, false] as const).map((val) => (
                <TouchableOpacity
                  key={String(val)}
                  style={[styles.evalChip, evalComfortable === val && styles.evalChipActive]}
                  onPress={() => setEvalComfortable(val)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.evalChipText, evalComfortable === val && styles.evalChipTextActive]}>
                    {val ? 'Yes' : 'No'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.evalQuestion}>Did it detect sleep accurately?</Text>
            <View style={styles.evalRow}>
              {(['good', 'late', 'too_early', 'unknown'] as const).map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[styles.evalChip, evalAccuracy === val && styles.evalChipActive]}
                  onPress={() => setEvalAccuracy(val)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.evalChipText, evalAccuracy === val && styles.evalChipTextActive]}>
                    {val === 'good' ? 'Yes' : val === 'late' ? 'Too late' : val === 'too_early' ? 'Too early' : 'Not sure'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Quality Score */}
        <View style={styles.qualityCard}>
          <View style={styles.qualityCenter}>
            <Text style={styles.qualityLabel}>Quality Score</Text>
            <Text style={styles.qualityValue}>{qualityPct}%</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer — snooze countdown OR action buttons */}
      <View style={styles.footer}>
        {snoozeSecondsLeft !== null ? (
          <>
            <Text style={styles.snoozeCountdownText}>Snooze: {snoozeStr}</Text>
            <TouchableOpacity style={styles.cancelSnoozeBtn} onPress={handleCancelSnooze} activeOpacity={0.85}>
              <Text style={styles.cancelSnoozeBtnText}>Cancel Snooze</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.85}>
              <Text style={styles.doneBtnText}>Dismiss</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.snoozeBtn} onPress={handleSnooze} activeOpacity={0.85}>
              <Text style={styles.snoozeBtnText}>Snooze {SNOOZE_MINUTES} min</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg_base },
  scroll: { paddingHorizontal: 24, paddingBottom: 160 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: Colors.bg_base,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: Colors.on_surface, letterSpacing: -0.3 },
  headerTime:  { fontSize: 12, color: Colors.on_surface_variant, marginTop: 1 },

  hero:      { gap: 8, paddingTop: 8, paddingBottom: 16 },
  heroTitle: { fontSize: 32, fontWeight: '800', color: Colors.text_primary, letterSpacing: -0.5 },
  heroTime:  { fontSize: 64, fontWeight: '200', color: Colors.text_primary, letterSpacing: -2, lineHeight: 72 },
  heroSub:   { fontSize: 14, fontWeight: '500', color: Colors.on_surface_variant },

  ratingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, marginBottom: 8,
  },
  stars:       { flexDirection: 'row', gap: 8 },
  starGlow:    { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6 },
  ratingValue: { fontSize: 14, fontWeight: '700', color: Colors.primary, letterSpacing: 2 },

  summaryCard: {
    backgroundColor: Colors.surface_container, borderRadius: 12,
    padding: 24, gap: 24, position: 'relative', overflow: 'hidden', marginBottom: 16,
  },
  cardGlow: {
    position: 'absolute', top: -48, right: -48,
    width: 128, height: 128, borderRadius: 64,
    backgroundColor: 'rgba(168,164,255,0.1)',
  },
  summaryGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 24 },
  summaryItem:       { width: '45%', gap: 4 },
  summaryItemLabel:  { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: Colors.on_surface_variant, fontWeight: '700' },
  summaryItemValue:  { fontSize: 20, fontWeight: '700', color: Colors.on_surface },
  summaryItemValueSm:{ fontSize: 13, fontWeight: '600', color: Colors.on_surface },
  detectedRow:       { flexDirection: 'row', alignItems: 'center', gap: 4 },

  warningCard: {
    backgroundColor: 'rgba(167,1,56,0.2)', borderRadius: 12, padding: 20,
    flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16,
  },
  warningIconBox: { backgroundColor: Colors.error_container, padding: 8, borderRadius: 8 },
  warningText:    { flex: 1, gap: 6 },
  warningTitle:   { fontSize: 13, fontWeight: '700', color: Colors.on_error_container },
  warningBody:    { fontSize: 11, color: Colors.on_surface_variant, lineHeight: 16 },
  warnProgress:   { height: 4, backgroundColor: Colors.surface_container_high, borderRadius: 2, overflow: 'hidden' },
  warnProgressFill: { height: '100%', backgroundColor: '#f97316', borderRadius: 2 },
  warnReasons:    { fontSize: 10, color: Colors.on_surface_variant, fontStyle: 'italic' },

  suggestionCard: {
    backgroundColor: 'rgba(168,164,255,0.12)', borderRadius: 12, padding: 20,
    flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(168,164,255,0.25)',
  },
  suggestionIconBox: { backgroundColor: 'rgba(168,164,255,0.15)', padding: 8, borderRadius: 8 },
  suggestionText:    { flex: 1, gap: 6 },
  suggestionTitle:   { fontSize: 13, fontWeight: '700', color: Colors.primary },
  suggestionBody:    { fontSize: 11, color: Colors.on_surface_variant, lineHeight: 16 },

  qualityCard:   { height: 128, borderRadius: 12, overflow: 'hidden', backgroundColor: Colors.surface_container_high },
  qualityCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  qualityLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 3, color: Colors.on_surface_variant, textTransform: 'uppercase' },
  qualityValue:  { fontSize: 28, fontWeight: '800', color: Colors.on_surface },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, backgroundColor: 'rgba(14,14,19,0.85)', gap: 12,
  },
  doneBtn:     { paddingVertical: 18, borderRadius: 99, alignItems: 'center', backgroundColor: Colors.primary },
  doneBtnText: { color: Colors.on_primary, fontSize: 17, fontWeight: '700' },
  snoozeBtn:   { paddingVertical: 18, borderRadius: 99, alignItems: 'center', backgroundColor: Colors.bg_elevated },
  snoozeBtnText: { color: Colors.text_secondary, fontSize: 15, fontWeight: '600' },

  snoozeCountdownText: {
    fontSize: 32, fontWeight: '800', color: Colors.primary,
    textAlign: 'center', letterSpacing: -1,
  },
  cancelSnoozeBtn:     { paddingVertical: 18, borderRadius: 99, alignItems: 'center', borderWidth: 1, borderColor: Colors.outline_variant },
  cancelSnoozeBtnText: { color: Colors.on_surface, fontSize: 15, fontWeight: '600' },

  // P.12 -- Placement evaluation card
  evalCard:          { backgroundColor: Colors.surface_container, borderRadius: 12, padding: 20, marginBottom: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(168,164,255,0.15)' },
  evalHeader:        { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  evalTitle:         { fontSize: 13, fontWeight: '700', color: Colors.on_surface },
  evalQuestion:      { fontSize: 11, color: Colors.on_surface_variant, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 },
  evalRow:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  evalChip:          { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface_container_high, borderWidth: 1, borderColor: 'transparent' },
  evalChipActive:    { borderColor: Colors.primary, backgroundColor: 'rgba(168,164,255,0.12)' },
  evalChipText:      { fontSize: 12, fontWeight: '500', color: Colors.on_surface_variant },
  evalChipTextActive:{ color: Colors.primary, fontWeight: '700' },
});
