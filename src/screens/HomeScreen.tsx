/**
 * HomeScreen — Main screen for starting a nap session
 *
 * Responsible for:
 * - Allowing selection of nap duration (20 / 60 / 90 min or custom)
 * - Selecting phone placement (mattress, hand, chest, pocket) gated by tier
 * - Displaying smart duration suggestions from AI (useDurationSuggestion)
 * - Displaying latency predictions from the AI model (useAIModel)
 * - Displaying the phone placement reminder tip (usePlacementReminder)
 * - Displaying AI placement recommendation from PlacementHabitAnalyzer (P.12)
 * - Checking tier gate (daily nap limit) before starting
 * - Configuring maxFallAsleepMinutes separately from targetMinutes
 *
 * Used by:
 * - AppNavigator: "Home" tab in MainTabs
 *
 * Notes:
 * - useFocusEffect reloads AI recommendation on every tab focus
 *   to reflect the latest data after completing a nap
 * - Tier limit is checked in both HomeScreen and MonitoringScreen (defence in depth)
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { DURATION_SUGGESTIONS, PLACEMENT_PROFILES, getLocalizedPlacementProfiles, getLocalizedDurationSuggestions, DETECTION } from '../constants/config';
import { useAdaptiveThreshold } from '../hooks/useAdaptiveThreshold';
import { usePlacementReminder } from '../hooks/usePlacementReminder';
import { useDurationSuggestion } from '../hooks/useDurationSuggestion';
import { useAIModel } from '../hooks/useAIModel';
import { usePlacement } from '../hooks/usePlacement';
import { useTier } from '../hooks/useTier';
import { useTierGate } from '../hooks/useTierGate';
import type { PhonePlacement, PlacementRecommendation } from '../models/Session';
import { placementHabitAnalyzer } from '../services/PlacementHabitAnalyzer';
import { useStreak } from '../hooks/useStreak';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const FALL_ASLEEP_PRESETS = [3, 5, 10, 15, 20, 30];

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function clampToPreset(value: number): number {
  return FALL_ASLEEP_PRESETS.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
  );
}

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

export default function HomeScreen() {
  const { strings: Strings } = useLanguage();
  const navigation = useNavigation<Nav>();
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [customInput, setCustomInput] = useState('');
  // Feature 1 — max fall-asleep time. null = follow thresholdMinutes default.
  const [fallAsleepOverride, setFallAsleepOverride] = useState<number | null>(null);

  // P.12 -- AI placement habit recommendation
  const [habitRecommendation, setHabitRecommendation] = useState<PlacementRecommendation | null>(null);

  // P.5 / P.6 / P.10 — persisted placement selection (multi)
  const { placements, placement, togglePlacement, setPlacements, profile: placementProfile } = usePlacement();

  // 5.4 — Tier limits (for maxPlacements gating)
  const { limits: tierLimits } = useTier();

  // P.12 — Reload AI habit recommendation each time screen is focused
  // (ensures fresh data after a nap completes)
  useFocusEffect(
    useCallback(() => {
      placementHabitAnalyzer.loadRecommendation().then(setHabitRecommendation).catch(() => {});
    }, [])
  );

  // 3.4 / 3.5 / 3.6 / 3.7 + P.9 — adaptive threshold, keyed per placement
  const { thresholdMinutes, isFirstSession, sessionCount } = useAdaptiveThreshold(placement);

  // 3.11 — persistent placement reminder
  const { visible: placementVisible, dismiss: dismissPlacement } = usePlacementReminder();

  // 3.14 — AI-enhanced duration suggestion
  const suggestion = useDurationSuggestion();

  // 4.3 / 4.4 / 4.7 — AI latency prediction + confidence
  const { isAIActive, predictedLatency, confidence } = useAIModel();

  // 5.2 — Tier gate (daily nap limit)
  const { canStart, upgradeReason, dailyCount, dailyLimit } = useTierGate();

  // 7.2 — Streak & habit tracking
  const streak = useStreak();

  const effectiveMinutes = customInput ? parseInt(customInput, 10) || 20 : selectedMinutes;

  // Derive the effective fall-asleep limit: user override → nearest preset to thresholdMinutes
  const effectiveFallAsleep = fallAsleepOverride ?? clampToPreset(
    Math.min(30, Math.max(3, thresholdMinutes))
  );

  function handleStart() {
    if (!canStart) {
      navigation.navigate('Paywall', { reason: upgradeReason });
      return;
    }
    const mins = effectiveMinutes > 0 ? effectiveMinutes : 20;
    navigation.navigate('Monitoring', {
      targetMinutes: mins,
      placement,
      placements,
      maxFallAsleepMinutes: effectiveFallAsleep,
    });
  }

  const aiLabel = isFirstSession
    ? Strings.home_learning_initial
    : sessionCount < 5
    ? Strings.home_learning_collecting(sessionCount, 5)
    : Strings.home_ai_active;

  const aiLabelColor = sessionCount >= 5 ? Colors.primary : Colors.on_surface_variant;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Ambient glows */}
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      {/* 3.11 — Placement reminder modal */}
      <Modal visible={placementVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📱</Text>
            <Text style={styles.modalTitle}>{Strings.home_placement_tip_title}</Text>
            <Text style={styles.modalBody}>{Strings.home_placement_tip_body}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={dismissPlacement} activeOpacity={0.85}>
              <Text style={styles.modalBtnText}>{Strings.home_placement_tip_got_it}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissPlacement} style={{ marginTop: 8 }}>
              <Text style={styles.modalDismiss}>{Strings.home_placement_tip_dont_show}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Header — fixed above scroll */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={{ fontSize: 22 }}>✨</Text>
          <Text style={styles.headerTitle}>{Strings.app_name}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.aiBadge}>
            <View style={[styles.aiBadgeDot, { backgroundColor: aiLabelColor }]} />
            <Text style={[styles.aiBadgeText, { color: aiLabelColor }]}>{aiLabel.toUpperCase()}</Text>
          </View>
          <Text style={styles.heroTitle}>{Strings.app_name}</Text>
          <Text style={styles.heroSubtitle}>{Strings.home_subtitle}</Text>
        </View>

        {/* 7.2 — Streak & weekly goal strip */}
        <View style={styles.streakCard}>
          {/* Streak counter */}
          <View style={styles.streakCell}>
            <Text style={styles.streakEmoji}>
              {streak.currentStreak > 0 ? '🔥' : '💤'}
            </Text>
            <Text style={styles.streakValue}>
              {streak.currentStreak > 0 ? streak.currentStreak : '—'}
            </Text>
            <Text style={styles.streakLabel}>
              {streak.currentStreak === 1 ? 'day streak' : streak.currentStreak > 1 ? 'day streak' : 'no streak yet'}
            </Text>
          </View>

          <View style={styles.streakDivider} />

          {/* Weekly goal */}
          <View style={styles.streakCell}>
            <Text style={styles.streakEmoji}>📅</Text>
            <Text style={styles.streakValue}>
              {streak.weeklyCount}
              <Text style={styles.streakValueMuted}>/{streak.weeklyGoal}</Text>
            </Text>
            <Text style={styles.streakLabel}>this week</Text>
            <View style={styles.streakBar}>
              <View
                style={[
                  styles.streakBarFill,
                  { width: `${Math.min(100, (streak.weeklyCount / streak.weeklyGoal) * 100)}%` as any },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Duration Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{Strings.home_title}</Text>

          <View style={styles.optionList}>
            {getLocalizedDurationSuggestions(Strings).map((opt) => {
              const active = selectedMinutes === opt.value && !customInput;
              const isRecommended = opt.value === suggestion.recommendedMinutes;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionCard, active && styles.optionCardActive]}
                  onPress={() => { setSelectedMinutes(opt.value); setCustomInput(''); }}
                  activeOpacity={0.8}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                        {opt.label}
                      </Text>
                      {/* 3.14 — recommended badge */}
                      {isRecommended && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedText}>{`✨ ${Strings.home_recommended_badge}`}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.optionDesc, active && styles.optionDescActive]}>
                      {opt.description}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 22 }}>
                    {opt.value === 20 ? '⚡' : opt.value === 60 ? '😴' : '🔄'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom input */}
          <View style={styles.customRow}>
            <Text style={styles.customLabel}>{Strings.home_custom_label}</Text>
            <TextInput
              style={styles.customInput}
              placeholder={Strings.home_custom_placeholder}
              placeholderTextColor={Colors.surface_variant}
              keyboardType="numeric"
              value={customInput}
              onChangeText={setCustomInput}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Feature 1 — Max fall-asleep time picker */}
        <View style={styles.fallAsleepSection}>
          <Text style={styles.sectionLabel}>{Strings.home_fall_asleep_limit_label}</Text>
          <Text style={styles.fallAsleepHint}>{Strings.home_fall_asleep_limit_hint}</Text>
          <View style={styles.fallAsleepRow}>
            {FALL_ASLEEP_PRESETS.map((min) => {
              const active = effectiveFallAsleep === min;
              return (
                <TouchableOpacity
                  key={min}
                  style={[styles.fallAsleepChip, active && styles.fallAsleepChipActive]}
                  onPress={() => setFallAsleepOverride(min)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.fallAsleepChipText, active && styles.fallAsleepChipTextActive]}>
                    {min} {Strings.common_minutes_short}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Feature 2 — AI suggestion (MAX tier only: confidenceEnabled is MAX-exclusive) */}
          {tierLimits.confidenceEnabled && isAIActive && (
            <TouchableOpacity
              style={styles.aiSuggestRow}
              onPress={() => {
                const clamped = Math.min(30, Math.max(3, Math.round(predictedLatency)));
                setFallAsleepOverride(clampToPreset(clamped));
              }}
              activeOpacity={0.8}
            >
              <View style={[styles.aiBadgeDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.aiSuggestText}>
                {Strings.home_ai_fall_asleep_suggest(
                  clampToPreset(Math.min(30, Math.max(3, Math.round(predictedLatency))))
                )}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* AI Insights card (5.4: locked overlay when AI disabled) */}
        <View style={styles.insightCard}>
          {tierLimits.aiEnabled ? (
            <>
              <View style={styles.insightTop}>
                <View style={styles.insightIconBox}>
                  <Text style={{ fontSize: 20 }}>🧠</Text>
                </View>
                <View style={styles.insightRight}>
                  <Text style={styles.insightConfLabel}>{Strings.home_est_fall_asleep}</Text>
                  <View style={styles.insightPredRow}>
                    <Text style={styles.insightConfValue}>
                      ~{isAIActive ? predictedLatency : thresholdMinutes} min
                    </Text>
                    {isAIActive && tierLimits.confidenceEnabled && (
                      <Text style={styles.insightConfPct}>{confidence}% {Strings.home_ai_conf_suffix}</Text>
                    )}
                  </View>
                </View>
              </View>
              <Text style={styles.insightText}>
                {isFirstSession ? Strings.home_first_session_hint : suggestion.reason}
              </Text>
              <View style={styles.insightBar}>
                <View style={[styles.insightBarFill, { width: `${Math.min(100, sessionCount * 20)}%` as any }]} />
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={styles.lockedOverlay}
              onPress={() => navigation.navigate('Paywall', { reason: Strings.paywall_reason_ai })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 28 }}>👑</Text>
              <Text style={styles.lockedTitle}>{Strings.home_ai_predictions_label}</Text>
              <Text style={styles.lockedSubtitle}>{Strings.home_ai_upgrade_hint}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* P.12 — AI Habit Recommendation Card */}
        {habitRecommendation && habitRecommendation.confidence === 'confident' && (
          <View style={styles.habitCard}>
            <View style={styles.habitTop}>
              <View style={styles.habitIconBox}>
                <Text style={{ fontSize: 18 }}>🧠</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.habitLabel}>{Strings.home_best_placement_badge}</Text>
                <Text style={styles.habitCombo}>
                  {habitRecommendation.placements
                    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                    .join(' + ')}
                </Text>
              </View>
              <View style={styles.habitScoreBadge}>
                <Text style={styles.habitScoreText}>{habitRecommendation.score}</Text>
                <Text style={styles.habitScoreUnit}>/100</Text>
              </View>
            </View>
            <Text style={styles.habitReason}>{habitRecommendation.reason}</Text>
            <TouchableOpacity
              style={styles.habitApplyBtn}
              onPress={() => setPlacements(habitRecommendation.placements.slice(0, tierLimits.maxPlacements))}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 14 }}>✅</Text>
              <Text style={styles.habitApplyText}>{Strings.home_habit_apply_btn}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* P.6 — Phone placement picker */}
        <View style={styles.placementSection}>
          <View style={styles.placementHeader}>
            <Text style={styles.sectionLabel}>{Strings.home_phone_placement_section}</Text>
            {tierLimits.maxPlacements > 1 && (
              <View style={styles.placementBadge}>
                <Text style={styles.placementBadgeText}>{Strings.home_placements_active(placements.length, tierLimits.maxPlacements)}</Text>
              </View>
            )}
          </View>
          {tierLimits.maxPlacements > 1 && (
            <Text style={styles.placementHint}>
              {tierLimits.maxPlacements === 2
                ? Strings.home_placement_pro_hint
                : Strings.home_placement_max_hint}
            </Text>
          )}
          <View style={styles.placementGrid}>
            {(['mattress', 'hand', 'chest', 'pocket'] as PhonePlacement[]).map((p) => {
              const prof = getLocalizedPlacementProfiles(Strings)[p];
              const active = placements.includes(p);
              const isPrimary = placements[0] === p && placements.length > 1;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.placementChip, active && styles.placementChipActive]}
                  onPress={() => togglePlacement(p, tierLimits.maxPlacements)}
                  activeOpacity={0.8}
                >
                  {isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryBadgeText}>{Strings.home_placement_primary_label}</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 20 }}>{prof.icon}</Text>
                  <Text style={[styles.placementChipLabel, active && styles.placementChipLabelActive]}>
                    {prof.label}
                  </Text>
                  <View style={styles.placementStars}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Text key={i} style={{ fontSize: 9 }}>
                        {i < prof.accuracyStars ? '★' : '☆'}
                      </Text>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.placementTip}>{getLocalizedPlacementProfiles(Strings)[placement].tip}</Text>
          {tierLimits.maxPlacements === 1 && (
            <TouchableOpacity
              style={styles.upgradeMultiBtn}
              onPress={() => navigation.navigate('Paywall', { reason: Strings.paywall_reason_placements })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13 }}>👑</Text>
              <Text style={styles.upgradeMultiText}>{Strings.home_upgrade_placements_hint}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Start Button */}
        <View style={styles.startWrap}>
          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.startText}>{Strings.home_start_button}</Text>
          </TouchableOpacity>
          {dailyLimit < 999 && (
            <Text style={styles.napCountText}>
              {Strings.home_naps_remaining(Math.max(0, dailyLimit - dailyCount))}
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 120 },

  glowTop: {
    position: 'absolute', top: -80, left: -60,
    width: 300, height: 200,
    backgroundColor: 'rgba(168,164,255,0.04)',
    borderRadius: 999,
  },
  glowBottom: {
    position: 'absolute', bottom: 0, right: 0,
    width: 240, height: 200,
    backgroundColor: 'rgba(170,143,253,0.04)',
    borderRadius: 999,
  },

  // Modal (3.11)
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  modalCard: {
    backgroundColor: Colors.surface_container, borderRadius: 20,
    padding: 28, alignItems: 'center', width: '100%',
  },
  modalTitle: {
    fontSize: 18, fontWeight: '700', color: Colors.on_surface, marginBottom: 8,
  },
  modalBody: {
    fontSize: 14, color: Colors.on_surface_variant, textAlign: 'center', lineHeight: 20, marginBottom: 20,
  },
  modalBtn: {
    backgroundColor: Colors.primary_dim, borderRadius: 99,
    paddingVertical: 14, paddingHorizontal: 40, width: '100%', alignItems: 'center',
  },
  modalBtnText: { color: Colors.on_primary, fontSize: 15, fontWeight: '700' },
  modalDismiss: { fontSize: 12, color: Colors.on_surface_variant, textDecorationLine: 'underline' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 16,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: Colors.on_surface, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.surface_container_high,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(72,71,77,0.2)',
  },

  // Hero
  hero: { paddingTop: 24, gap: 8, marginBottom: 32 },
  aiBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99,
    backgroundColor: 'rgba(78,50,155,0.3)',
    borderWidth: 1, borderColor: 'rgba(78,50,155,0.5)',
  },
  aiBadgeDot: { width: 8, height: 8, borderRadius: 4 },
  aiBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 2 },
  heroTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, color: Colors.on_surface, marginTop: 4 },
  heroSubtitle: { fontSize: 13, color: Colors.on_surface_variant, lineHeight: 18 },

  // Section
  section: { gap: 16, marginBottom: 24 },
  sectionLabel: {
    fontSize: 11, fontWeight: '500', letterSpacing: 1.5,
    color: Colors.on_surface_variant, textTransform: 'uppercase',
  },
  optionList: { gap: 12 },
  optionCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderRadius: 12, backgroundColor: Colors.surface_container,
  },
  optionCardActive: {
    backgroundColor: Colors.primary_dim,
    shadowColor: Colors.primary_dim,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  optionLabel: { fontSize: 15, fontWeight: '700', color: Colors.on_surface },
  optionLabelActive: { color: Colors.on_primary },
  optionDesc: { fontSize: 12, color: Colors.on_surface_variant, marginTop: 2 },
  optionDescActive: { color: 'rgba(30,0,159,0.7)' },
  recommendedBadge: {
    backgroundColor: 'rgba(168,164,255,0.15)',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  recommendedText: { fontSize: 9, color: Colors.primary, fontWeight: '600' },
  customRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface_container_lowest, borderRadius: 12, overflow: 'hidden',
  },
  customLabel: { color: Colors.on_surface_variant, fontSize: 13, paddingLeft: 16, paddingRight: 4 },
  customInput: { flex: 1, paddingVertical: 16, paddingRight: 16, color: Colors.on_surface, fontSize: 14 },

  // Insight card
  insightCard: {
    padding: 20, borderRadius: 16,
    backgroundColor: 'rgba(31,31,38,0.85)',
    borderWidth: 1, borderColor: 'rgba(72,71,77,0.1)',
    marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
  },
  insightTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 12,
  },
  insightIconBox: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(168,164,255,0.1)' },
  insightRight: { alignItems: 'flex-end' },
  insightConfLabel: { fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: Colors.on_surface_variant },
  insightPredRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  insightConfValue: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  insightConfPct: { fontSize: 11, color: Colors.on_surface_variant, fontWeight: '500' },
  insightText: { fontSize: 13, color: Colors.on_surface, lineHeight: 20 },
  insightBar: {
    marginTop: 12, height: 4, backgroundColor: Colors.surface_container_high,
    borderRadius: 4, overflow: 'hidden',
  },
  insightBarFill: { height: '100%', backgroundColor: Colors.primary_dim, borderRadius: 4 },
  lockedOverlay: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  lockedTitle: { fontSize: 16, fontWeight: '700', color: Colors.on_surface },
  lockedSubtitle: { fontSize: 13, color: Colors.on_surface_variant },

  // Placement picker (P.6 / P.10)
  placementSection: { gap: 10, marginBottom: 24 },
  placementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placementBadge: { backgroundColor: 'rgba(168,164,255,0.15)', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 },
  placementBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '700' },
  placementHint: { fontSize: 11, color: Colors.on_surface_variant, lineHeight: 16, paddingHorizontal: 2 },
  placementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  placementChip: {
    width: '47%',
    padding: 14, borderRadius: 12,
    backgroundColor: Colors.surface_container,
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'transparent',
    position: 'relative' as const,
  },
  placementChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(168,164,255,0.1)',
  },
  placementChipLabel: { fontSize: 13, fontWeight: '600', color: Colors.on_surface },
  placementChipLabelActive: { color: Colors.primary },
  placementStars: { flexDirection: 'row', gap: 1 },
  placementTip: {
    fontSize: 12, color: Colors.on_surface_variant, lineHeight: 18,
    paddingHorizontal: 4,
  },
  primaryBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: Colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  primaryBadgeText: { fontSize: 8, color: Colors.on_primary, fontWeight: '700' },
  upgradeMultiBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'rgba(168,164,255,0.08)', borderWidth: 1, borderColor: 'rgba(168,164,255,0.2)', alignSelf: 'flex-start', marginTop: 2 },
  upgradeMultiText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },

  // P.12 -- habit recommendation card
  habitCard: {
    backgroundColor: 'rgba(168,164,255,0.08)',
    borderRadius: 16, padding: 18, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(168,164,255,0.25)',
    gap: 10,
  },
  habitTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  habitIconBox: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(168,164,255,0.1)' },
  habitLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, color: Colors.on_surface_variant, textTransform: 'uppercase' },
  habitCombo: { fontSize: 16, fontWeight: '800', color: Colors.on_surface, letterSpacing: -0.3, marginTop: 1 },
  habitScoreBadge: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(168,164,255,0.15)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  habitScoreText: { fontSize: 20, fontWeight: '800', color: Colors.primary, lineHeight: 22 },
  habitScoreUnit: { fontSize: 9, color: Colors.on_surface_variant, fontWeight: '500' },
  habitReason: { fontSize: 12, color: Colors.on_surface_variant, lineHeight: 18 },
  habitApplyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(168,164,255,0.1)', borderWidth: 1, borderColor: 'rgba(168,164,255,0.3)' },
  habitApplyText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },

  // 7.2 — Streak card
  streakCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface_container,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(168,164,255,0.12)',
    overflow: 'hidden',
  },
  streakCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    gap: 2,
  },
  streakDivider: {
    width: 1,
    backgroundColor: 'rgba(168,164,255,0.12)',
    marginVertical: 12,
  },
  streakEmoji: { fontSize: 20, lineHeight: 26 },
  streakValue: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.on_surface,
    letterSpacing: -0.5,
  },
  streakValueMuted: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.on_surface_variant,
  },
  streakLabel: {
    fontSize: 10,
    color: Colors.on_surface_variant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
    marginTop: 2,
  },
  streakBar: {
    width: '80%',
    height: 3,
    backgroundColor: Colors.surface_container_high,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
  },
  streakBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

  // Feature 1 — fall-asleep limit picker
  fallAsleepSection: { gap: 10, marginBottom: 24 },
  fallAsleepHint: { fontSize: 11, color: Colors.on_surface_variant, lineHeight: 16, paddingHorizontal: 2 },
  fallAsleepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fallAsleepChip: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
    backgroundColor: Colors.surface_container,
    borderWidth: 1, borderColor: 'transparent',
  },
  fallAsleepChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(168,164,255,0.12)',
  },
  fallAsleepChipText: { fontSize: 13, fontWeight: '600', color: Colors.on_surface_variant },
  fallAsleepChipTextActive: { color: Colors.primary },
  // Feature 2 — AI suggestion
  aiSuggestRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6, paddingHorizontal: 10,
    borderRadius: 8, alignSelf: 'flex-start',
    backgroundColor: 'rgba(168,164,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(168,164,255,0.2)',
  },
  aiSuggestText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },

  // Start button
  startWrap: { paddingTop: 4 },
  startBtn: {
    paddingVertical: 20, borderRadius: 99, backgroundColor: Colors.primary_dim,
    alignItems: 'center',
    shadowColor: '#1e009f', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35, shadowRadius: 24, elevation: 8,
  },
  startText: { color: Colors.on_primary, fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  napCountText: {
    textAlign: 'center', marginTop: 10,
    fontSize: 12, color: Colors.on_surface_variant,
  },
});
