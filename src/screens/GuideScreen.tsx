/**
 * GuideScreen — Step-by-step guide for getting the best nap experience
 *
 * Responsible for:
 * - Explaining each placement option with tips and accuracy info
 * - Teaching users how the confidence score and detection work
 * - Providing environment tips for better detection accuracy
 * - Explaining the hand placement put-down workflow
 * - Describing how the AI learns and adapts over sessions
 *
 * Used by:
 * - SettingsScreen: navigates here via "Best Experience Guide" row
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function Stars({ count, max = 4 }: { count: number; max?: number }) {
  return (
    <Text style={styles.stars}>
      {'★'.repeat(count)}{'☆'.repeat(max - count)}
    </Text>
  );
}

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

export default function GuideScreen() {
  const navigation = useNavigation();
  const { strings: S } = useLanguage();

  // ── Build data arrays from strings ───────────────────────────────────────

  const PLACEMENTS = [
    {
      icon: '✋',
      label: S.placement_hand_label,
      stars: 4,
      best: S.guide_placement_hand_best,
      steps: [
        S.guide_placement_hand_step1,
        S.guide_placement_hand_step2,
        S.guide_placement_hand_step3,
        S.guide_placement_hand_step4,
      ],
      warning: S.guide_placement_hand_warning,
    },
    {
      icon: '🧍',
      label: S.placement_chest_label,
      stars: 4,
      best: S.guide_placement_chest_best,
      steps: [
        S.guide_placement_chest_step1,
        S.guide_placement_chest_step2,
        S.guide_placement_chest_step3,
        S.guide_placement_chest_step4,
      ],
      warning: null,
    },
    {
      icon: '🛏️',
      label: S.placement_mattress_label,
      stars: 3,
      best: S.guide_placement_mattress_best,
      steps: [
        S.guide_placement_mattress_step1,
        S.guide_placement_mattress_step2,
        S.guide_placement_mattress_step3,
        S.guide_placement_mattress_step4,
      ],
      warning: S.guide_placement_mattress_warning,
    },
    {
      icon: '🪑',
      label: S.placement_pocket_label,
      stars: 2,
      best: S.guide_placement_pocket_best,
      steps: [
        S.guide_placement_pocket_step1,
        S.guide_placement_pocket_step2,
        S.guide_placement_pocket_step3,
      ],
      warning: S.guide_placement_pocket_warning,
    },
  ];

  const CONFIDENCE_STEPS = [
    { range: '0–40%', label: S.guide_conf_awake_label, color: Colors.error, desc: S.guide_conf_awake_desc },
    { range: '41–65%', label: S.guide_conf_drowsy_label, color: Colors.warning, desc: S.guide_conf_drowsy_desc },
    { range: '66–79%', label: S.guide_conf_almost_label, color: Colors.primary, desc: S.guide_conf_almost_desc },
    { range: '80%+', label: S.guide_conf_detected_label, color: Colors.success, desc: S.guide_conf_detected_desc },
  ];

  const ENV_TIPS = [
    { icon: '🔇', tip: S.guide_env_quiet },
    { icon: '🌡️', tip: S.guide_env_cool },
    { icon: '💡', tip: S.guide_env_dark },
    { icon: '📅', tip: S.guide_env_schedule },
    { icon: '⭐', tip: S.guide_env_rate },
    { icon: '🔁', tip: S.guide_env_ai },
  ];

  const MIN_TIMES = [
    { icon: '✋', label: S.placement_hand_label, time: S.guide_time_hand_time, note: S.guide_time_hand_note },
    { icon: '🧍', label: S.placement_chest_label, time: S.guide_time_chest_time, note: S.guide_time_chest_note },
    { icon: '🛏️', label: S.placement_mattress_label, time: S.guide_time_mattress_time, note: S.guide_time_mattress_note },
    { icon: '🪑', label: S.placement_pocket_label, time: S.guide_time_pocket_time, note: S.guide_time_pocket_note },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header — right side is a spacer so LangToggle overlay doesn't overlap */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.backBtn}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{S.guide_title}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Intro ── */}
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            {S.guide_intro_pre}{' '}
            <Text style={styles.highlight}>{S.guide_intro_sensors}</Text>
            {' '}{S.guide_intro_post}
          </Text>
        </View>

        {/* ── Section 1: Placements ── */}
        <SectionHeader emoji="📱" title={S.guide_section_placements} />

        {PLACEMENTS.map((p) => (
          <View key={p.label} style={styles.card}>
            {/* Placement header */}
            <View style={styles.placementHeader}>
              <Text style={styles.placementIcon}>{p.icon}</Text>
              <View style={styles.placementMeta}>
                <Text style={styles.placementLabel}>{p.label}</Text>
                <Stars count={p.stars} />
              </View>
              <View style={styles.bestBadge}>
                <Text style={styles.bestBadgeText}>{p.best}</Text>
              </View>
            </View>

            {/* Steps */}
            <View style={styles.stepList}>
              {p.steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            {/* Warning */}
            {p.warning && (
              <View style={styles.warningRow}>
                <Text style={styles.warningIcon}>⚠️</Text>
                <Text style={styles.warningText}>{p.warning}</Text>
              </View>
            )}
          </View>
        ))}

        {/* ── Section 2: Confidence Score ── */}
        <SectionHeader emoji="📊" title={S.guide_section_confidence} />

        <View style={styles.card}>
          <Text style={styles.bodyText}>{S.guide_conf_body}</Text>
          <View style={styles.divider} />
          {CONFIDENCE_STEPS.map((s) => (
            <View key={s.range} style={styles.confRow}>
              <View style={[styles.confBadge, { backgroundColor: s.color + '22', borderColor: s.color + '66' }]}>
                <Text style={[styles.confRange, { color: s.color }]}>{s.range}</Text>
              </View>
              <View style={styles.confRight}>
                <Text style={[styles.confLabel, { color: s.color }]}>{s.label}</Text>
                <Text style={styles.confDesc}>{s.desc}</Text>
              </View>
            </View>
          ))}
          <View style={styles.divider} />
          <Text style={styles.bodyText}>
            {S.guide_conf_guard_pre}{' '}
            <Text style={styles.highlight}>{S.guide_conf_guard_highlight}</Text>
            {' '}{S.guide_conf_guard_post}
          </Text>
        </View>

        {/* ── Section 3: Minimum Detection Times ── */}
        <SectionHeader emoji="⏱️" title={S.guide_section_min_time} />

        <View style={styles.card}>
          <Text style={styles.bodyText}>{S.guide_time_body}</Text>
          <View style={styles.divider} />
          {MIN_TIMES.map((row) => (
            <View key={row.label} style={styles.timeRow}>
              <Text style={styles.timeIcon}>{row.icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.timeTop}>
                  <Text style={styles.timeLabel}>{row.label}</Text>
                  <Text style={styles.timeValue}>{row.time}</Text>
                </View>
                <Text style={styles.timeNote}>{row.note}</Text>
              </View>
            </View>
          ))}
          <View style={styles.divider} />
          <Text style={styles.bodyText}>{S.guide_time_movement_body}</Text>
        </View>

        {/* ── Section 4: Environment ── */}
        <SectionHeader emoji="🌙" title={S.guide_section_environment} />

        <View style={styles.card}>
          {ENV_TIPS.map((t, i) => (
            <React.Fragment key={i}>
              <View style={styles.tipRow}>
                <Text style={styles.tipIcon}>{t.icon}</Text>
                <Text style={styles.tipText}>{t.tip}</Text>
              </View>
              {i < ENV_TIPS.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── Section 5: AI ── */}
        <SectionHeader emoji="🧠" title={S.guide_section_ai} />

        <View style={styles.card}>
          <View style={styles.aiRow}>
            <View style={styles.aiStep}>
              <Text style={styles.aiStepNum}>1</Text>
              <Text style={styles.aiStepLabel}>{S.guide_ai_step_nap}</Text>
            </View>
            <Text style={styles.aiArrow}>→</Text>
            <View style={styles.aiStep}>
              <Text style={styles.aiStepNum}>⭐</Text>
              <Text style={styles.aiStepLabel}>{S.guide_ai_step_rate}</Text>
            </View>
            <Text style={styles.aiArrow}>→</Text>
            <View style={styles.aiStep}>
              <Text style={styles.aiStepNum}>5+</Text>
              <Text style={styles.aiStepLabel}>{S.guide_ai_step_sessions}</Text>
            </View>
            <Text style={styles.aiArrow}>→</Text>
            <View style={styles.aiStep}>
              <Text style={styles.aiStepNum}>🧠</Text>
              <Text style={styles.aiStepLabel}>{S.guide_ai_step_active}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <Text style={styles.bodyText}>
            {S.guide_ai_body1_pre}{' '}
            <Text style={styles.highlight}>{S.guide_ai_body1_highlight}</Text>
            {S.guide_ai_body1_post}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.bodyText}>{S.guide_ai_body2}</Text>
        </View>

        {/* Bottom spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, gap: 12,
  },
  backBtn: { fontSize: 22, color: Colors.on_surface, fontWeight: '300' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: Colors.on_surface, letterSpacing: -0.3 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },

  // Intro card
  introCard: {
    backgroundColor: Colors.primary_dim + '22',
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: Colors.primary + '33',
  },
  introText: { fontSize: 14, lineHeight: 22, color: Colors.on_surface },
  highlight: { color: Colors.primary, fontWeight: '600' },

  // Section headers
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 8,
  },
  sectionEmoji: { fontSize: 18 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.on_surface, letterSpacing: -0.2 },

  // Card
  card: {
    backgroundColor: Colors.surface_container,
    borderRadius: 14, padding: 16, gap: 12,
  },
  divider: { height: 1, backgroundColor: Colors.outline_variant, opacity: 0.4 },
  bodyText: { fontSize: 13, lineHeight: 20, color: Colors.on_surface_variant },

  // Placement card
  placementHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placementIcon: { fontSize: 28 },
  placementMeta: { flex: 1, gap: 2 },
  placementLabel: { fontSize: 15, fontWeight: '700', color: Colors.on_surface },
  stars: { fontSize: 11, color: Colors.warning, letterSpacing: 1 },
  bestBadge: {
    backgroundColor: Colors.secondary_container,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  bestBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.on_secondary_container },

  // Steps
  stepList: { gap: 8 },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNumber: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary_dim + '33',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: { fontSize: 11, fontWeight: '700', color: Colors.primary },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19, color: Colors.on_surface_variant },

  // Warning
  warningRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: Colors.error + '11',
    borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: Colors.error + '33',
  },
  warningIcon: { fontSize: 14 },
  warningText: { flex: 1, fontSize: 12, lineHeight: 18, color: Colors.error },

  // Confidence rows
  confRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  confBadge: {
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, minWidth: 72, alignItems: 'center',
  },
  confRange: { fontSize: 11, fontWeight: '700' },
  confRight: { flex: 1, gap: 2 },
  confLabel: { fontSize: 13, fontWeight: '700' },
  confDesc: { fontSize: 12, lineHeight: 17, color: Colors.on_surface_variant },

  // Min time rows
  timeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  timeIcon: { fontSize: 20, marginTop: 2 },
  timeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timeLabel: { fontSize: 14, fontWeight: '600', color: Colors.on_surface },
  timeValue: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  timeNote: { fontSize: 12, color: Colors.on_surface_variant, marginTop: 2 },

  // Environment tips
  tipRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tipIcon: { fontSize: 20, marginTop: 1 },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, color: Colors.on_surface_variant },

  // AI section
  aiRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 8,
  },
  aiStep: { alignItems: 'center', gap: 4 },
  aiStepNum: { fontSize: 20, fontWeight: '700', color: Colors.primary },
  aiStepLabel: { fontSize: 10, color: Colors.on_surface_variant, fontWeight: '500' },
  aiArrow: { fontSize: 16, color: Colors.outline, marginBottom: 12 },
});
