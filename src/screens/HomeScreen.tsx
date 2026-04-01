import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants';
import { RootStackParamList } from '../navigation/AppNavigator';
import { DURATION_SUGGESTIONS, PLACEMENT_PROFILES } from '../constants/config';
import { useAdaptiveThreshold } from '../hooks/useAdaptiveThreshold';
import { usePlacementReminder } from '../hooks/usePlacementReminder';
import { useDurationSuggestion } from '../hooks/useDurationSuggestion';
import { useAIModel } from '../hooks/useAIModel';
import { usePlacement } from '../hooks/usePlacement';
import { useTier } from '../hooks/useTier';
import { useTierGate } from '../hooks/useTierGate';
import type { PhonePlacement, PlacementRecommendation } from '../models/Session';
import { placementHabitAnalyzer } from '../services/PlacementHabitAnalyzer';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [selectedMinutes, setSelectedMinutes] = useState(60);
  const [customInput, setCustomInput] = useState('');

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

  const effectiveMinutes = customInput ? parseInt(customInput, 10) || 20 : selectedMinutes;

  function handleStart() {
    if (!canStart) {
      navigation.navigate('Paywall', { reason: upgradeReason });
      return;
    }
    const mins = effectiveMinutes > 0 ? effectiveMinutes : 20;
    navigation.navigate('Monitoring', { targetMinutes: mins, placement, placements });
  }

  const aiLabel = isFirstSession
    ? 'Learning your pattern'
    : sessionCount < 5
    ? `Collecting data (${sessionCount}/5)`
    : 'AI active';

  const aiLabelColor = sessionCount >= 5 ? Colors.primary : Colors.on_surface_variant;

  return (
    <SafeAreaView style={styles.root}>
      {/* Ambient glows */}
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      {/* 3.11 — Placement reminder modal */}
      <Modal visible={placementVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="cellphone" size={40} color={Colors.primary} style={{ marginBottom: 12 }} />
            <Text style={styles.modalTitle}>Phone placement tip</Text>
            <Text style={styles.modalBody}>
              Place your phone face-down on the mattress beside your hip.
              You don't need to hold it.
            </Text>
            <TouchableOpacity style={styles.modalBtn} onPress={dismissPlacement} activeOpacity={0.85}>
              <Text style={styles.modalBtnText}>Got it</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismissPlacement} style={{ marginTop: 8 }}>
              <Text style={styles.modalDismiss}>Don't show again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialCommunityIcons name="star-four-points" size={22} color={Colors.primary} />
            <Text style={styles.headerTitle}>Smart Nap Timer</Text>
          </View>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="account-circle" size={28} color={Colors.on_surface_variant} />
          </View>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.aiBadge}>
            <View style={[styles.aiBadgeDot, { backgroundColor: aiLabelColor }]} />
            <Text style={[styles.aiBadgeText, { color: aiLabelColor }]}>{aiLabel.toUpperCase()}</Text>
          </View>
          <Text style={styles.heroTitle}>Smart Nap Timer</Text>
          <Text style={styles.heroSubtitle}>
            Optimizing your circadian rhythm through restorative micro-sleeps.
          </Text>
        </View>

        {/* Duration Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>How long do you want to sleep?</Text>

          <View style={styles.optionList}>
            {DURATION_SUGGESTIONS.map((opt) => {
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
                          <Text style={styles.recommendedText}>✨ Recommended</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.optionDesc, active && styles.optionDescActive]}>
                      {opt.description}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={opt.value === 20 ? 'lightning-bolt' : opt.value === 60 ? 'sleep' : 'refresh'}
                    size={22}
                    color={active ? Colors.on_primary : Colors.outline_variant}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom input */}
          <View style={styles.customRow}>
            <Text style={styles.customLabel}>Custom:</Text>
            <TextInput
              style={styles.customInput}
              placeholder="___ min"
              placeholderTextColor={Colors.surface_variant}
              keyboardType="numeric"
              value={customInput}
              onChangeText={setCustomInput}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* AI Insights card (5.4: locked overlay when AI disabled) */}
        <View style={styles.insightCard}>
          {tierLimits.aiEnabled ? (
            <>
              <View style={styles.insightTop}>
                <View style={styles.insightIconBox}>
                  <MaterialCommunityIcons name="brain" size={20} color={Colors.primary} />
                </View>
                <View style={styles.insightRight}>
                  <Text style={styles.insightConfLabel}>Est. fall-asleep</Text>
                  <View style={styles.insightPredRow}>
                    <Text style={styles.insightConfValue}>
                      ~{isAIActive ? predictedLatency : thresholdMinutes} min
                    </Text>
                    {isAIActive && tierLimits.confidenceEnabled && (
                      <Text style={styles.insightConfPct}>{confidence}% conf.</Text>
                    )}
                  </View>
                </View>
              </View>
              <Text style={styles.insightText}>
                {isFirstSession
                  ? 'First session — using science defaults. The app will personalise after a few naps.'
                  : suggestion.reason}
              </Text>
              <View style={styles.insightBar}>
                <View style={[styles.insightBarFill, { width: `${Math.min(100, sessionCount * 20)}%` as any }]} />
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={styles.lockedOverlay}
              onPress={() => navigation.navigate('Paywall', { reason: 'Upgrade to Pro for AI sleep predictions' })}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="crown" size={28} color={Colors.primary} />
              <Text style={styles.lockedTitle}>AI Predictions</Text>
              <Text style={styles.lockedSubtitle}>Upgrade to Pro to unlock</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* P.12 — AI Habit Recommendation Card */}
        {habitRecommendation && habitRecommendation.confidence === 'confident' && (
          <View style={styles.habitCard}>
            <View style={styles.habitTop}>
              <View style={styles.habitIconBox}>
                <MaterialCommunityIcons name="brain" size={18} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.habitLabel}>BEST PLACEMENT FOR YOU</Text>
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
              <MaterialCommunityIcons name="check-circle-outline" size={14} color={Colors.primary} />
              <Text style={styles.habitApplyText}>Apply this setup</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* P.6 — Phone placement picker */}
        <View style={styles.placementSection}>
          <View style={styles.placementHeader}>
            <Text style={styles.sectionLabel}>Phone placement</Text>
            {tierLimits.maxPlacements > 1 && (
              <View style={styles.placementBadge}>
                <Text style={styles.placementBadgeText}>{placements.length}/{tierLimits.maxPlacements} active</Text>
              </View>
            )}
          </View>
          {tierLimits.maxPlacements > 1 && (
            <Text style={styles.placementHint}>
              {tierLimits.maxPlacements === 2
                ? 'Pro: combine 2 placements for better accuracy'
                : 'Max: combine up to 4 placements for maximum accuracy'}
            </Text>
          )}
          <View style={styles.placementGrid}>
            {(['mattress', 'hand', 'chest', 'pocket'] as PhonePlacement[]).map((p) => {
              const prof = PLACEMENT_PROFILES[p];
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
                      <Text style={styles.primaryBadgeText}>Primary</Text>
                    </View>
                  )}
                  <MaterialCommunityIcons
                    name={prof.icon as any}
                    size={20}
                    color={active ? Colors.primary : Colors.on_surface_variant}
                  />
                  <Text style={[styles.placementChipLabel, active && styles.placementChipLabelActive]}>
                    {prof.label}
                  </Text>
                  <View style={styles.placementStars}>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <MaterialCommunityIcons
                        key={i}
                        name={i < prof.accuracyStars ? 'star' : 'star-outline'}
                        size={9}
                        color={active ? Colors.primary : Colors.outline_variant}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.placementTip}>{placementProfile.tip}</Text>
          {tierLimits.maxPlacements === 1 && (
            <TouchableOpacity
              style={styles.upgradeMultiBtn}
              onPress={() => navigation.navigate('Paywall', { reason: 'Upgrade to Pro to combine placements' })}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name='crown' size={13} color={Colors.primary} />
              <Text style={styles.upgradeMultiText}>Upgrade to combine placements</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Start Button */}
        <View style={styles.startWrap}>
          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.startText}>Start Nap</Text>
          </TouchableOpacity>
          {dailyLimit < 999 && (
            <Text style={styles.napCountText}>
              {Math.max(0, dailyLimit - dailyCount)} nap{dailyLimit - dailyCount === 1 ? '' : 's'} remaining today
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: 24, paddingBottom: 120 },

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
