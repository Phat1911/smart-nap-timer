/**
 * DashboardScreen — Nap history statistics summary screen
 *
 * Responsible for:
 * - Displaying SVG line chart of latency across the last 10 sessions
 * - Displaying stats: total sessions, avg latency, avg sleep, avg rating
 * - Displaying streak & weekly count (7.2)
 * - Allowing sharing a weekly summary as text (7.4)
 * - Limiting history by tier (Free: 7 sessions, Pro: 30, Max: unlimited)
 * - Showing a warning when there is an insufficient sleep streak (3.17)
 *
 * Used by:
 * - AppNavigator: "Dashboard" tab in MainTabs
 *
 * Notes:
 * - buildLinePath / buildAreaPath use bezier curves (C command) for smooth curves
 *   instead of straight polylines — requires at least 2 points to draw
 * - useFocusEffect refreshes data every time the tab gains focus (3.10)
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Dimensions, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTier } from '../hooks/useTier';
import { useStreak } from '../hooks/useStreak';
import { sessionService } from '../services/SessionService';
import { RootStackParamList } from '../navigation/AppNavigator';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 96;
const CHART_H = 120;

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function buildLinePath(pts: [number, number][], w: number, h: number): string {
  const mapped = pts.map(([x, y]) => [x * w, y * h] as [number, number]);
  let d = `M${mapped[0][0]} ${mapped[0][1]}`;
  for (let i = 1; i < mapped.length; i++) {
    const [px, py] = mapped[i - 1];
    const [cx, cy] = mapped[i];
    const mx = (px + cx) / 2;
    d += ` C${mx} ${py} ${mx} ${cy} ${cx} ${cy}`;
  }
  return d;
}

function buildAreaPath(pts: [number, number][], w: number, h: number): string {
  return buildLinePath(pts, w, h) + ` L${w} ${h} L0 ${h} Z`;
}

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

export default function DashboardScreen() {
  const { strings: Strings } = useLanguage();
  const navigation = useNavigation<Nav>();
  const { stats, chartPoints, showInsufficientWarning, isEmpty, loading, refresh } =
    useDashboardData();

  // 5.5 — Tier limits for history slicing
  const { limits } = useTier();

  // 7.2 — Streak data (also used by the share card)
  const streak = useStreak();

  // 7.4 — Avg confidence for share text
  const [avgConfidence, setAvgConfidence] = useState(0);

  // Refresh when tab gains focus (3.10) + compute avg confidence (7.4)
  useFocusEffect(
    useCallback(() => {
      refresh();
      sessionService.loadAll().then((sessions) => {
        if (sessions.length === 0) { setAvgConfidence(0); return; }
        const avg = sessions.reduce((s, n) => s + n.confidence_score, 0) / sessions.length;
        setAvgConfidence(Math.round(avg));
      }).catch(() => {});
    }, [refresh])
  );

  // 7.4 — Share a text summary of the weekly stats
  const handleShare = useCallback(async () => {
    const weekOf = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const text = [
      `📊 My Smart Nap Timer — Week of ${weekOf}`,
      `Naps this week: ${streak.weeklyCount}`,
      `Avg sleep confidence: ${avgConfidence}%`,
      `Avg wake rating: ${(stats?.avg_wake_rating ?? 0).toFixed(1)}/5`,
      `Streak: ${streak.currentStreak} days 🔥`,
      '',
      'Tracked with Smart Nap Timer',
    ].join('\n');
    try {
      await Share.share({ message: text });
    } catch {
      // Silent
    }
  }, [streak, avgConfidence, stats]);

  // 5.5 — Apply history limit to chart points
  const historyLimit = limits.historyLimit === Infinity ? chartPoints.length : limits.historyLimit;

  const { visiblePoints, hiddenCount } = React.useMemo(() => {
    const visible = chartPoints.slice(-historyLimit);
    return { visiblePoints: visible, hiddenCount: chartPoints.length - visible.length };
  }, [chartPoints, historyLimit]);

  // Normalize chart points to 0-1 range
  const chartPts: [number, number][] = React.useMemo(() => {
    if (visiblePoints.length < 2) return [];
    const max = Math.max(...visiblePoints.map((p) => p.latency), 1);
    return visiblePoints.map((p, i) => [
      i / (visiblePoints.length - 1),
      1 - p.latency / max,
    ]);
  }, [visiblePoints]);

  const linePath = chartPts.length >= 2 ? buildLinePath(chartPts, CHART_W, CHART_H) : '';
  const areaPath = chartPts.length >= 2 ? buildAreaPath(chartPts, CHART_W, CHART_H) : '';

  const statItems = stats
    ? [
        { icon: '🌙', value: String(stats.total_sessions),               label: Strings.dashboard_total_naps },
        { icon: '⏱️', value: `${stats.avg_latency_minutes}m`,             label: Strings.dashboard_avg_latency },
        { icon: '😴', value: `${stats.avg_actual_sleep_minutes}m`,        label: Strings.dashboard_avg_sleep },
        { icon: '⭐', value: `${stats.avg_wake_rating.toFixed(1)}/5`,     label: Strings.dashboard_best_rating },
      ]
    : [];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={{ fontSize: 22 }}>✨</Text>
          <Text style={styles.headerTitle}>{Strings.dashboard_title}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>😴</Text>
          <Text style={styles.emptyTitle}>{Strings.dashboard_empty_title}</Text>
          <Text style={styles.emptyBody}>{Strings.dashboard_empty_body}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* 3.17 — Insufficient streak warning */}
          {showInsufficientWarning && (
            <View style={styles.warningBanner}>
              <View style={styles.warningIconBox}>
                <Text style={{ fontSize: 20 }}>⚠️</Text>
              </View>
              <View style={styles.warningText}>
                <Text style={styles.warningEyebrow}>{Strings.dashboard_attention_needed}</Text>
                <Text style={styles.warningBody}>
                  {Strings.dashboard_insufficient_warning}
                </Text>
              </View>
            </View>
          )}

          {/* 3.10 — Real stats grid */}
          <View style={styles.statsGrid}>
            {statItems.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <Text style={{ fontSize: 22 }}>{stat.icon}</Text>
                <View style={styles.statBottom}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* 3.9 — Real chart */}
          {chartPts.length >= 2 && (
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={styles.chartTitle}>{Strings.dashboard_trend_title}</Text>
                  <Text style={styles.chartSub}>{Strings.dashboard_chart_sub(visiblePoints.length)}</Text>
                </View>
              </View>
              <Svg width={CHART_W} height={CHART_H}>
                <Defs>
                  <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={Colors.primary} stopOpacity={0.2} />
                    <Stop offset="100%" stopColor={Colors.primary} stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Path d={areaPath} fill="url(#areaGrad)" />
                <Path d={linePath} fill="none" stroke={Colors.primary} strokeWidth={3} strokeLinecap="round" />
                {chartPts.map(([x, y], i) => (
                  <Circle key={i} cx={x * CHART_W} cy={y * CHART_H} r={3} fill={Colors.primary} />
                ))}
              </Svg>
            </View>
          )}

          {/* 5.5 — History limit upgrade banner */}
          {hiddenCount > 0 && (
            <TouchableOpacity
              style={styles.historyBanner}
              onPress={() => navigation.navigate('Paywall', { reason: Strings.dashboard_upgrade_history_hint })}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16 }}>👑</Text>
              <Text style={styles.historyBannerText}>
                {Strings.dashboard_history_banner(visiblePoints.length, hiddenCount)}
              </Text>
            </TouchableOpacity>
          )}

          {/* 7.4 — Share sleep report button */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Text style={{ fontSize: 18 }}>📤</Text>
            <Text style={styles.shareBtnText}>Share Sleep Report</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, backgroundColor: Colors.background,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.on_surface, letterSpacing: -0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.on_surface },
  emptyBody: { fontSize: 13, color: Colors.on_surface_variant, textAlign: 'center' },
  scroll: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 120, gap: 24 },
  warningBanner: {
    backgroundColor: 'rgba(61,42,0,1)', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'flex-start', gap: 16,
    borderWidth: 1, borderColor: 'rgba(249,168,37,0.2)',
  },
  warningIconBox: {
    backgroundColor: '#f9a825', padding: 8, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  warningText: { flex: 1, gap: 4 },
  warningEyebrow: {
    fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 2, color: 'rgba(249,168,37,0.8)',
  },
  warningBody: { fontSize: 13, fontWeight: '500', color: '#fff', lineHeight: 18 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  statCard: {
    width: '46.5%', aspectRatio: 1,
    backgroundColor: Colors.surface_container,
    borderRadius: 12, padding: 20, justifyContent: 'space-between',
  },
  statBottom: { gap: 4 },
  statValue: { fontSize: 30, fontWeight: '800', color: Colors.on_surface, letterSpacing: -1 },
  statLabel: {
    fontSize: 9, fontWeight: '500', textTransform: 'uppercase',
    letterSpacing: 1.5, color: Colors.on_surface_variant,
  },
  chartCard: {
    backgroundColor: Colors.surface_container, borderRadius: 16, padding: 24, gap: 16,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  chartTitle: { fontSize: 16, fontWeight: '700', color: Colors.on_surface, letterSpacing: -0.2 },
  chartSub: { fontSize: 11, color: Colors.on_surface_variant, marginTop: 2 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 16, borderRadius: 99,
    backgroundColor: Colors.primary_dim,
    shadowColor: '#1e009f', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 6,
  },
  shareBtnText: {
    fontSize: 15, fontWeight: '700', color: Colors.on_primary,
  },
  historyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(168,164,255,0.1)',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(168,164,255,0.2)',
  },
  historyBannerText: { fontSize: 12, color: Colors.on_surface_variant, flex: 1 },
});
