import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants';
import { useDashboardData } from '../hooks/useDashboardData';
import { useTier } from '../hooks/useTier';
import { RootStackParamList } from '../navigation/AppNavigator';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 96;
const CHART_H = 120;

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

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<Nav>();
  const { stats, chartPoints, showInsufficientWarning, isEmpty, loading, refresh } =
    useDashboardData();

  // 5.5 — Tier limits for history slicing
  const { limits } = useTier();

  // Refresh when tab gains focus (3.10)
  useFocusEffect(
    React.useCallback(() => { refresh(); }, [refresh])
  );

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
        { icon: 'weather-night', iconColor: Colors.primary,       value: String(stats.total_sessions),               label: 'Total Naps' },
        { icon: 'timer',         iconColor: Colors.secondary,     value: `${stats.avg_latency_minutes}m`,             label: 'Avg to Sleep' },
        { icon: 'sleep',         iconColor: Colors.tertiary,      value: `${stats.avg_actual_sleep_minutes}m`,        label: 'Avg Sleep' },
        { icon: 'star',          iconColor: Colors.primary_fixed, value: `${stats.avg_wake_rating.toFixed(1)}/5`,     label: 'Avg Rating' },
      ]
    : [];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="shimmer" size={22} color={Colors.primary} />
          <Text style={styles.headerTitle}>Your Sleep Stats</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : isEmpty ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="sleep" size={48} color={Colors.outline_variant} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyBody}>Complete your first nap to see stats here.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* 3.17 — Insufficient streak warning */}
          {showInsufficientWarning && (
            <View style={styles.warningBanner}>
              <View style={styles.warningIconBox}>
                <MaterialCommunityIcons name="alert" size={20} color="#000" />
              </View>
              <View style={styles.warningText}>
                <Text style={styles.warningEyebrow}>Attention Needed</Text>
                <Text style={styles.warningBody}>
                  You have had insufficient sleep 3 sessions in a row
                </Text>
              </View>
            </View>
          )}

          {/* 3.10 — Real stats grid */}
          <View style={styles.statsGrid}>
            {statItems.map((stat) => (
              <View key={stat.label} style={styles.statCard}>
                <MaterialCommunityIcons name={stat.icon as any} size={22} color={stat.iconColor} />
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
                  <Text style={styles.chartTitle}>Sleep latency trend</Text>
                  <Text style={styles.chartSub}>Minutes to fall asleep (last {visiblePoints.length} sessions)</Text>
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
              onPress={() => navigation.navigate('Paywall', { reason: 'Upgrade for full session history' })}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="crown" size={16} color={Colors.primary} />
              <Text style={styles.historyBannerText}>
                Showing last {visiblePoints.length} sessions. Upgrade for full history.
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

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
  historyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(168,164,255,0.1)',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(168,164,255,0.2)',
  },
  historyBannerText: { fontSize: 12, color: Colors.on_surface_variant, flex: 1 },
});
