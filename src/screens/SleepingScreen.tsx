/**
 * SleepingScreen — Countdown screen while the user is sleeping
 *
 * Responsible for:
 * - Counting down nap time from targetMinutes to 0
 * - Playing white noise (rain) with volume adjustable via slider
 * - Scheduling an alarm notification as a backup (in case the app is killed)
 * - Dimming the screen to minimum brightness to not disturb sleep
 * - On countdown end: saving NapSession and navigating to WakeScreen
 *
 * Used by:
 * - AppNavigator: "Sleeping" screen in the stack
 * - MonitoringScreen: navigates here when sleep is detected
 *
 * Notes:
 * - PanResponder used instead of Slider component to avoid heavy dependency
 * - trackWidthRef measured via onLayout for accurate volume ratio calculation
 * - Alarm is cancelled in cleanup to avoid extra notifications if the user
 *   closes the app before time runs out
 *
 * Tasks wired here:
 *   2.20 — Volume slider wired to audioService.setVolume()
 *   2.21 — Screen brightness dimmed via useScreenDim hook
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp }          from '@react-navigation/native-stack';
import { Colors }                             from '../constants';
import { useLanguage }                        from '../contexts/LanguageContext';
import { RootStackParamList }                 from '../navigation/AppNavigator';
import { audioService }                       from '../services/AudioService';
import { alarmService }                       from '../services/AlarmService';
import { sessionService }                     from '../services/SessionService';
import { usageService }                       from '../services/UsageService';
import { useScreenDim }                       from '../hooks/useScreenDim';
import type { NapSession }                    from '../models/Session';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Sleeping'>;

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const INITIAL_VOLUME = 0.4;

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

export default function SleepingScreen() {
  const { strings: Strings } = useLanguage();
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const {
    targetMinutes,
    sleepStartTime,
    placement,
    latencySeconds,
    detectionMethod,
    confidenceScore,
  } = route.params;
  // P.10 -- multi-placement array from MonitoringScreen (optional in Sleeping params)
  const routePlacements: import('../models/Session').PhonePlacement[] | undefined = route.params.placements;

  // ── Task 2.21 — dim screen while sleeping ─────────────────────────────────
  useScreenDim();

  // ── Countdown state ───────────────────────────────────────────────────────
  const totalSeconds  = targetMinutes * 60;
  const [remaining, setRemaining] = useState(totalSeconds);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Task 2.20 — volume wired to audioService ──────────────────────────────
  const [volume, setVolume] = useState(INITIAL_VOLUME);
  const trackWidthRef       = useRef(0); // measured width of the slider track

  // Start audio + schedule alarm on mount
  useEffect(() => {
    // 5.2 — Record that a session has started (increments daily counter)
    usageService.recordSessionStart().catch(() => {});

    // Start white noise audio
    audioService.play('rain', INITIAL_VOLUME).catch(() => {});

    // Schedule a notification alarm as a safety net (in case app is killed)
    alarmService.scheduleAlarm(targetMinutes).catch(() => {});

    // Countdown
    intervalRef.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!);
          // P.8 — build and save NapSession, then navigate to Wake
          const now = new Date();
          const sessionId = `session_${sleepStartTime}`;
          const actualSleepMinutes = targetMinutes; // full countdown elapsed
          const session: NapSession = {
            session_id:          sessionId,
            date:                now.toISOString(),
            hour:                now.getHours(),
            day_of_week:         now.getDay(),
            time_of_day:         sessionService.getTimeOfDay(now.getHours()),
            target_minutes:      targetMinutes,
            actual_sleep_minutes: actualSleepMinutes,
            latency_minutes:     Math.round((latencySeconds / 60) * 10) / 10,
            threshold_T_used:    targetMinutes,
            detection_method:    detectionMethod,
            placement,
            placements:          routePlacements && routePlacements.length > 0
                                   ? routePlacements
                                   : [placement],
            wake_rating:         null,
            is_insufficient:     sessionService.isInsufficient(actualSleepMinutes, targetMinutes),
            confidence_score:    confidenceScore,
          };
          sessionService.save(session).catch(() => {});
          navigation.replace('Wake', { sessionId });
          return 0;
        }
        return s - 1;
      });
    }, 1_000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      audioService.stop().catch(() => {});
      alarmService.cancelAlarm().catch(() => {});
    };
  }, []);

  // ── Volume change handler (task 2.20) ────────────────────────────────────
  const handleVolumeChange = useCallback((newVolume: number) => {
    const clamped = Math.max(0, Math.min(1, newVolume));
    setVolume(clamped);
    audioService.setVolume(clamped).catch(() => {});
  }, []);

  // PanResponder for the slider track
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        if (trackWidthRef.current > 0) {
          const ratio = e.nativeEvent.locationX / trackWidthRef.current;
          handleVolumeChange(ratio);
        }
      },
      onPanResponderMove: (e) => {
        if (trackWidthRef.current > 0) {
          const ratio = e.nativeEvent.locationX / trackWidthRef.current;
          handleVolumeChange(ratio);
        }
      },
    }),
  ).current;

  function onTrackLayout(e: LayoutChangeEvent) {
    trackWidthRef.current = e.nativeEvent.layout.width;
  }

  // ── Timer display ─────────────────────────────────────────────────────────
  const mins   = Math.floor(remaining / 60);
  const secs   = remaining % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Subtle top glow */}
      <View style={styles.topGlow} pointerEvents="none" />

      {/* Top label */}
      <View style={styles.topArea}>
        <Text style={styles.topLabel}>{Strings.sleeping_title}</Text>
      </View>

      {/* Countdown (task 2.21: dim via useScreenDim, not opacity in JSX) */}
      <View style={styles.centerArea}>
        <Text style={styles.countdown}>{timeStr}</Text>
        <Text style={styles.countdownLabel}>{Strings.sleeping_countdown}</Text>
      </View>

      {/* Bottom: audio + volume slider (task 2.20) */}
      <View style={styles.bottomArea}>
        {/* Audio type indicator */}
        <View style={styles.audioRow}>
          <Text style={[{ fontSize: 16 }, styles.dimIcon]}>〰️</Text>
          <Text style={styles.audioText}>{Strings.sleeping_audio_rain}</Text>
        </View>

        {/* Volume slider wired to audioService.setVolume() (task 2.20) */}
        <View style={styles.volumeRow}>
          <Text style={[{ fontSize: 12 }, styles.dimIcon]}>🔇</Text>
          <View
            style={styles.sliderTrack}
            onLayout={onTrackLayout}
            {...panResponder.panHandlers}
          >
            <View style={[styles.sliderFill, { width: `${volume * 100}%` as any }]} />
            <View
              style={[
                styles.sliderThumb,
                { left: `${Math.max(0, volume * 100 - 2)}%` as any },
              ]}
            />
          </View>
          <Text style={[{ fontSize: 12 }, styles.dimIcon]}>🔊</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: '#0a0a0f',
    alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 80, paddingHorizontal: 32,
  },
  topGlow: {
    position: 'absolute', top: '-10%', left: '-10%',
    width: '120%', height: '40%',
    backgroundColor: 'rgba(168,164,255,0.02)', borderRadius: 999,
  },

  topArea: { alignItems: 'center' },
  topLabel: {
    fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
    color: Colors.on_surface_variant, opacity: 0.15, fontWeight: '500',
  },

  centerArea: { alignItems: 'center', gap: 8 },
  countdown: {
    fontSize: 80, fontWeight: '800', letterSpacing: -2,
    color: Colors.on_surface, opacity: 0.15,
  },
  countdownLabel: {
    fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
    color: Colors.on_surface_variant, opacity: 0.15, fontWeight: '500',
  },

  bottomArea: { alignItems: 'center', gap: 48, width: '100%' },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dimIcon: { opacity: 0.3 },
  audioText: {
    fontSize: 13, letterSpacing: 1,
    color: Colors.on_surface_variant, opacity: 0.3,
  },

  // Slider (task 2.20)
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 16, width: 200 },
  sliderTrack: {
    flex: 1, height: 2, position: 'relative',
    backgroundColor: 'rgba(37,37,45,0.2)', borderRadius: 1,
  },
  sliderFill: {
    position: 'absolute', left: 0, top: 0, height: '100%',
    backgroundColor: 'rgba(72,71,77,0.3)', borderRadius: 1,
  },
  sliderThumb: {
    position: 'absolute', top: -5, marginLeft: -5,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: 'rgba(72,71,77,0.4)',
  },
});
