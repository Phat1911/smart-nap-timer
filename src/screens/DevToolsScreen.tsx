/**
 * DevToolsScreen — Developer tools screen (used for testing only)
 *
 * Responsible for:
 * - Allowing tier override (free / pro / max) without purchasing
 * - Resetting the usage counter (daily nap count)
 * - Viewing current tier and usage count
 * - Overriding the sleep score trigger threshold (dev-only runtime)
 * - Resetting all session data
 *
 * Used by:
 * - AppNavigator: "DevTools" screen as a modal
 * - SettingsScreen: opened by tapping the version text 5 times in a row
 *
 * Notes:
 * - Never shown to end users — no link from the normal UI
 * - Does not affect App Store / Play Store since it only overwrites local AsyncStorage
 * - _devOverrides in config.ts allows changing SLEEP_SCORE_TRIGGER at runtime
 */
// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, SafeAreaView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../constants';
import { tierService } from '../services/TierService';
import { usageService } from '../services/UsageService';
import { sessionService } from '../services/SessionService';
import { TierName, TIER_LIMITS } from '../models/Tier';
import { _devOverrides } from '../constants/config';

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

export default function DevToolsScreen() {
  const navigation = useNavigation();
  const [tier, setTier]             = useState<TierName>('free');
  const [dailyCount, setDailyCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [trigger, setTrigger]       = useState(_devOverrides.sleepScoreTrigger);

  // Defense-in-depth: block access in production even if deep-linked
  useEffect(() => {
    if (!__DEV__) { navigation.goBack(); }
  }, [navigation]);

  async function refresh() {
    const [t, count, sessions] = await Promise.all([
      tierService.getCurrentTier(),
      usageService.getDailyCount(),
      sessionService.loadAll(),
    ]);
    setTier(t);
    setDailyCount(count);
    setSessionCount(sessions.length);
  }

  useEffect(() => { refresh(); }, []);

  async function setTierTo(t: TierName) {
    await tierService.setTier(t);
    await refresh();
    Alert.alert('Done', `Tier set to ${t.toUpperCase()}`);
  }

  async function resetUsage() {
    await usageService.resetToday();
    await refresh();
    Alert.alert('Done', 'Daily usage counter reset to 0');
  }

  async function clearAllData() {
    Alert.alert(
      'Clear All Data',
      'This deletes all sessions and resets everything. Cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
          onPress: async () => {
            await sessionService.reset();
            await usageService.resetToday();
            await tierService.setTier('free');
            await refresh();
            Alert.alert('Done', 'All data cleared');
          },
        },
      ],
    );
  }

  const limits = TIER_LIMITS[tier];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={{ fontSize: 22 }}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Dev Tools</Text>
          <Text style={styles.subtitle}>Testing only -- not visible to users</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Current state */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Current State</Text>
          <View style={styles.card}>
            <Row label="Active tier"       value={tier.toUpperCase()} valueColor={tier === 'free' ? Colors.outline : tier === 'pro' ? Colors.primary : Colors.secondary} />
            <Row label="Daily nap limit"   value={limits.dailyNapLimit === Infinity ? 'Unlimited' : String(limits.dailyNapLimit)} />
            <Row label="Naps used today"   value={String(dailyCount)} />
            <Row label="Remaining today"   value={limits.dailyNapLimit === Infinity ? 'Unlimited' : String(Math.max(0, limits.dailyNapLimit - dailyCount))} />
            <Row label="Total sessions"    value={String(sessionCount)} />
            <Row label="AI enabled"        value={limits.aiEnabled ? 'Yes' : 'No'} />
            <Row label="Export enabled"    value={limits.exportEnabled ? 'Yes' : 'No'} />
          </View>
        </View>

        {/* Set tier */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Override Tier</Text>
          <View style={styles.btnRow}>
            {(['free', 'pro', 'max'] as TierName[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.tierBtn, tier === t && styles.tierBtnActive]}
                onPress={() => setTierTo(t)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tierBtnText, tier === t && styles.tierBtnTextActive]}>
                  {t.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Usage actions */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Usage Controls</Text>
          <TouchableOpacity style={styles.actionBtn} onPress={resetUsage} activeOpacity={0.8}>
            <Text style={{ fontSize: 18 }}>🔄</Text>
            <Text style={styles.actionBtnText}>Reset daily usage counter</Text>
          </TouchableOpacity>
        </View>

        {/* Threshold tuning */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Threshold Tuning</Text>
          <Text style={styles.tuningHint}>Sleep score trigger (current: {trigger}). Changes live — no restart needed.</Text>
          <View style={styles.btnRow}>
            {[60, 65, 70, 75, 80, 85].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.tierBtn, trigger === v && styles.tierBtnActive]}
                onPress={() => { _devOverrides.sleepScoreTrigger = v; setTrigger(v); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tierBtnText, trigger === v && styles.tierBtnTextActive]}>
                  {v}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Danger zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: Colors.error }]}>Danger Zone</Text>
          <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={clearAllData} activeOpacity={0.8}>
            <Text style={{ fontSize: 18 }}>🗑️</Text>
            <Text style={[styles.actionBtnText, { color: Colors.error }]}>Clear all data + reset to Free</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────

const rowStyles = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  label: { fontSize: 13, color: Colors.on_surface_variant },
  value: { fontSize: 13, fontWeight: '700', color: Colors.on_surface },
});

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.outline_variant,
  },
  back: { padding: 4 },
  title:    { fontSize: 18, fontWeight: '800', color: Colors.on_surface },
  subtitle: { fontSize: 11, color: Colors.on_surface_variant, marginTop: 2 },
  scroll:   { padding: 20, gap: 24 },
  section:  { gap: 10 },
  sectionLabel: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', color: Colors.on_surface_variant,
  },
  card: {
    backgroundColor: Colors.surface_container,
    borderRadius: 12, paddingHorizontal: 16,
    borderWidth: 1, borderColor: Colors.outline_variant,
  },
  btnRow: { flexDirection: 'row', gap: 10 },
  tierBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    backgroundColor: Colors.surface_container,
    borderWidth: 1, borderColor: Colors.outline_variant,
  },
  tierBtnActive: {
    backgroundColor: Colors.secondary_container,
    borderColor: Colors.primary,
  },
  tierBtnText:       { fontSize: 12, fontWeight: '700', color: Colors.on_surface_variant },
  tierBtnTextActive: { color: Colors.on_secondary_container },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.surface_container, borderRadius: 10,
    padding: 14, borderWidth: 1, borderColor: Colors.outline_variant,
  },
  dangerBtn:     { borderColor: 'rgba(255,100,100,0.3)' },
  actionBtnText: { fontSize: 14, fontWeight: '500', color: Colors.on_surface },
  tuningHint: {
    fontSize: 11, color: Colors.on_surface_variant, lineHeight: 16,
  },
});
