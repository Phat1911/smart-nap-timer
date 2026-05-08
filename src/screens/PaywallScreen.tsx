/**
 * PaywallScreen — Tier upgrade screen (Free → Pro / Max)
 *
 * Responsible for:
 * - Displaying Free / Pro / Max feature comparison
 * - Handling payment via two flows:
 *   + RevenueCat / App Store / Play Store (international and mandatory for iOS)
 *   + PayOS (Vietnam, Android only) — opens browser, polls status
 * - After successful payment: fetches tier from server and updates AsyncStorage
 * - Restore purchases (RevenueCat path only)
 * - Displaying the reason passed from the previous screen (e.g. "Upgrade to view full report")
 *
 * Used by:
 * - AppNavigator: "Paywall" screen in the stack
 * - Many screens navigate here when a gated feature is accessed
 *
 * Notes:
 * - iOS: always uses RevenueCat (App Store Review Guideline 3.1.1)
 * - Android + Vietnamese locale: uses PayOS, opens WebBrowser
 * - Polls PayOS status every 3 seconds for up to 5 minutes
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { useTopRight } from '../contexts/TopRightContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { tierService } from '../services/TierService';
import { TierName } from '../models/Tier';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Paywall'>;

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

// TODO: Replace with your real Terms of Service URL before App Store submission
const TERMS_URL = 'https://smartnaptimer.app/terms';
const PRICE = {
  pro: { vnd: '59.000 ₫', usd: '$2.99' },
  max: { vnd: '109.000 ₫', usd: '$6.99' },
};


// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

export default function PaywallScreen() {
  const { strings: Strings } = useLanguage();
  const { setButton } = useTopRight();
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const reason     = route.params?.reason;

  // Register "Maybe Later" in global top-right overlay
  useEffect(() => {
    setButton({ type: 'text', label: Strings.paywall_maybe_later, onPress: () => navigation.goBack() });
    return () => setButton(null);
  }, [Strings.paywall_maybe_later]);

  const isVN = tierService.isVietnamese;

  const [loading, setLoading]   = useState<'pro' | 'max' | 'restore' | null>(null);
  const [currentTier, setCurrentTier] = useState<TierName>('free');
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef     = useRef(true);
  const isUpgradingRef = useRef(false);

  // Initialize current tier on mount, with cleanup for unmount
  // Also handles cancellation of any active PayOS polling
  useEffect(() => {
    mountedRef.current = true;
    
    // Fetch the current user's tier from the service
    tierService.getCurrentTier().then((t) => {
      // Only update state if component is still mounted (prevents memory leak warnings)
      if (mountedRef.current) setCurrentTier(t);
    }).catch(() => {});
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      // If a PayOS polling interval is active, stop it
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []); // Run only once on mount

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleUpgrade(tier: 'pro' | 'max') {
    if (isUpgradingRef.current) return;
    isUpgradingRef.current = true;
    setLoading(tier);
    try {
      if (isVN) {
        // Vietnamese: PayOS flow
        const userId = await tierService.getOrCreateDeviceId();
        const { checkoutUrl, orderCode } = await tierService.createPayOSLink(tier, userId);

        await WebBrowser.openBrowserAsync(checkoutUrl);

        // Poll for payment confirmation
        let attempts = 0;
        pollRef.current = setInterval(async () => {
          if (!mountedRef.current) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            return;
          }
          attempts++;
          const status = await tierService.pollPayOSStatus(orderCode);

          if (status === 'paid') {
            clearInterval(pollRef.current!);
            // Fetch tier from server -- backend webhook is the only authority
            const userId = await tierService.getOrCreateDeviceId();
            const serverTier = await tierService.fetchTierFromServer(userId);
            isUpgradingRef.current = false;
            if (!mountedRef.current) return;
            setCurrentTier(serverTier);
            setLoading(null);
            Alert.alert(
              Strings.paywall_alert_success_title(tier === 'pro' ? 'Pro' : 'Max'),
              Strings.paywall_alert_success_body,
              [{ text: Strings.common_ok, onPress: () => navigation.goBack() }],
            );
          } else if (status === 'cancelled' || attempts >= 40) {
            clearInterval(pollRef.current!);
            isUpgradingRef.current = false;
            if (!mountedRef.current) return;
            setLoading(null);
            if (status === 'cancelled') {
              Alert.alert(Strings.paywall_alert_cancelled_title, Strings.paywall_alert_cancelled_body);
            } else {
              // Poll timed out -- notify user so they are not left confused
              Alert.alert(
                Strings.paywall_alert_pending_title,
                Strings.paywall_alert_pending_body,
              );
            }
          }
        }, 3000);
      } else {
        // International: RevenueCat IAP
        const userId = await tierService.getOrCreateDeviceId();
        const newTier = await tierService.purchase(tier, userId);
        isUpgradingRef.current = false;
        if (!mountedRef.current) return;
        setCurrentTier(newTier);
        setLoading(null);
        Alert.alert(
          Strings.paywall_alert_success_title(newTier === 'pro' ? 'Pro' : 'Max'),
          Strings.paywall_alert_success_body,
          [{ text: Strings.common_ok, onPress: () => navigation.goBack() }],
        );
      }
    } catch (err: any) {
      isUpgradingRef.current = false;
      if (!mountedRef.current) return;
      setLoading(null);
      Alert.alert(Strings.paywall_alert_failed_title, err?.message ?? Strings.paywall_alert_failed_body);
    }
  }

  async function handleRestore() {
    if (loading) return;
    setLoading('restore');
    try {
      const restored = await tierService.restorePurchases();
      if (!mountedRef.current) return;
      setCurrentTier(restored);
      setLoading(null);
      Alert.alert(
        Strings.paywall_alert_restored_title,
        restored === 'free'
          ? Strings.paywall_alert_restored_none
          : Strings.paywall_alert_restored_body(restored === 'pro' ? 'Pro' : 'Max'),
        [{ text: Strings.common_ok, onPress: () => { if (restored !== 'free') navigation.goBack(); } }],
      );
    } catch (err: any) {
      if (!mountedRef.current) return;
      setLoading(null);
      Alert.alert(Strings.paywall_alert_restore_failed_title, err?.message ?? Strings.paywall_alert_restore_failed_body);
    }
  }

  function priceLabel(tier: 'pro' | 'max') {
    return isVN ? PRICE[tier].vnd : PRICE[tier].usd;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Decorative glows */}
      <View style={styles.glowLeft}  pointerEvents="none" />
      <View style={styles.glowRight} pointerEvents="none" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={{ fontSize: 22 }}>👑</Text>
          <Text style={styles.headerBrand}>{Strings.paywall_header_brand}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            {Strings.paywall_hero_unlock + ' \n'}
            <Text style={styles.heroAccent}>{'Smart Nap'}</Text>
            {' Timer'}
          </Text>
          <Text style={styles.heroSub}>
            {Strings.paywall_hero_sub}
          </Text>
          {reason && (
            <View style={styles.reasonBadge}>
              <Text style={{ fontSize: 14 }}>ℹ️</Text>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          )}
        </View>

        {/* FREE card */}
        <View style={styles.cardFree}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.tierLabel}>{Strings.paywall_free_tier_label}</Text>
              <Text style={styles.tierName}>{Strings.paywall_free_tier_name}</Text>
            </View>
            <Text style={styles.priceMain}>{Strings.paywall_free_price}</Text>
          </View>
          <FeatureList features={Strings.paywall_free_features} emoji="✅" />
          <View style={styles.currentPlanBtn}>
            <Text style={styles.currentPlanText}>
              {currentTier === 'free' ? Strings.paywall_current_plan : Strings.paywall_free_downgrade_label}
            </Text>
          </View>
        </View>

        {/* PRO card */}
        <View style={styles.cardPro}>
          {/* Most popular badge */}
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>{Strings.paywall_most_popular}</Text>
          </View>

          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.tierLabel, { color: Colors.primary }]}>{Strings.paywall_pro_tier_label}</Text>
              <Text style={styles.tierName}>Pro</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.priceMain}>{priceLabel('pro')}</Text>
              <Text style={styles.priceSub}>{Strings.paywall_per_month}</Text>
            </View>
          </View>

          <FeatureList features={Strings.paywall_pro_features} emoji="✨" />

          <TouchableOpacity
            style={[styles.upgradeBtn, styles.upgradeBtnPro, currentTier === 'pro' && styles.disabledBtn]}
            onPress={() => handleUpgrade('pro')}
            activeOpacity={0.85}
            disabled={!!loading || currentTier === 'pro' || currentTier === 'max'}
          >
            {loading === 'pro' ? (
              <ActivityIndicator color={Colors.on_primary_container} />
            ) : (
              <Text style={styles.upgradeBtnTextPro}>
                {currentTier === 'pro' ? Strings.paywall_current_plan : Strings.paywall_upgrade_pro}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* MAX card */}
        <View style={styles.cardMax}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.tierLabel, { color: Colors.secondary }]}>{Strings.paywall_max_tier_label}</Text>
              <Text style={styles.tierName}>Max</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={[styles.priceMain, { color: Colors.secondary }]}>{priceLabel('max')}</Text>
              <Text style={styles.priceSub}>{Strings.paywall_per_month}</Text>
            </View>
          </View>

          <FeatureList features={Strings.paywall_max_features} emoji="💎" />

          <TouchableOpacity
            style={[styles.upgradeBtn, styles.upgradeBtnMax, currentTier === 'max' && styles.disabledBtn]}
            onPress={() => handleUpgrade('max')}
            activeOpacity={0.85}
            disabled={!!loading || currentTier === 'max'}
          >
            {loading === 'max' ? (
              <ActivityIndicator color={Colors.secondary} />
            ) : (
              <Text style={styles.upgradeBtnTextMax}>
                {currentTier === 'max' ? Strings.paywall_current_plan : Strings.paywall_upgrade_max}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerBtn}
          onPress={handleRestore}
          activeOpacity={0.7}
          disabled={!!loading}
        >
          {loading === 'restore' ? (
            <ActivityIndicator size="small" color={Colors.on_surface_variant} />
          ) : (
            <>
              <Text style={{ fontSize: 20 }}>🔄</Text>
              <Text style={styles.footerBtnText}>{Strings.paywall_restore}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerBtn}
          onPress={() => Linking.openURL(TERMS_URL)}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20 }}>🛡️</Text>
          <Text style={styles.footerBtnText}>{Strings.paywall_terms}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── FeatureList sub-component ─────────────────────────────────────────────────
function FeatureList({
  features, emoji,
}: {
  features: string[];
  emoji: string;
}) {
  return (
    <View style={featureStyles.list}>
      {features.map((f) => (
        <View key={f} style={featureStyles.row}>
          <Text style={{ fontSize: 18 }}>{emoji}</Text>
          <Text style={featureStyles.text}>{f}</Text>
        </View>
      ))}
    </View>
  );
}

const featureStyles = StyleSheet.create({
  list: { gap: 12, marginBottom: 24 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { fontSize: 14, color: Colors.on_surface, flex: 1 },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const SECONDARY = '#ffb957';

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.background },
  glowLeft: {
    position: 'absolute', top: '30%', left: '-15%',
    width: '60%', height: '40%',
    backgroundColor: 'rgba(196,192,255,0.04)',
    borderRadius: 999,
  },
  glowRight: {
    position: 'absolute', bottom: 0, right: '-15%',
    width: '60%', height: '40%',
    backgroundColor: 'rgba(255,185,87,0.04)',
    borderRadius: 999,
  },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBrand: { fontSize: 20, fontWeight: '800', color: Colors.primary, letterSpacing: -0.3 },

  // Scroll
  scroll: { paddingHorizontal: 24, paddingBottom: 120, gap: 16 },

  // Hero
  hero:      { gap: 12, paddingBottom: 8 },
  heroTitle: { fontSize: 38, fontWeight: '800', color: Colors.on_surface, lineHeight: 44, letterSpacing: -1 },
  heroAccent:{ color: Colors.primary },
  heroSub:   { fontSize: 15, color: Colors.on_surface_variant, lineHeight: 22, maxWidth: 280 },
  reasonBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(196,192,255,0.1)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start',
  },
  reasonText: { fontSize: 12, color: Colors.primary },

  // Cards shared
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  tierLabel:  { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', color: Colors.outline, marginBottom: 4 },
  tierName:   { fontSize: 20, fontWeight: '800', color: Colors.on_surface },
  priceBlock: { alignItems: 'flex-end' },
  priceMain:  { fontSize: 24, fontWeight: '800', color: Colors.on_surface },
  priceSub:   { fontSize: 11, color: Colors.on_surface_variant, marginTop: 2 },

  // FREE card
  cardFree: {
    backgroundColor: Colors.surface_container_lowest,
    borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: 'rgba(70,69,85,0.2)',
  },
  currentPlanBtn: {
    paddingVertical: 16, borderRadius: 999,
    backgroundColor: Colors.surface_container_high,
    alignItems: 'center',
  },
  currentPlanText: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: Colors.outline,
  },

  // PRO card
  cardPro: {
    backgroundColor: Colors.surface_container_high,
    borderRadius: 16, padding: 24,
    borderWidth: 1.5, borderColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2, shadowRadius: 24, elevation: 8,
    overflow: 'hidden',
  },
  popularBadge: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14, paddingVertical: 6,
    borderBottomLeftRadius: 12,
  },
  popularText: {
    fontSize: 9, fontWeight: '700', letterSpacing: 1.5,
    textTransform: 'uppercase', color: Colors.on_primary_container,
  },

  // MAX card
  cardMax: {
    backgroundColor: Colors.surface_container_highest,
    borderRadius: 16, padding: 24,
    borderWidth: 2, borderColor: 'rgba(255,185,87,0.4)',
  },

  // Buttons
  upgradeBtn: {
    paddingVertical: 18, borderRadius: 999, alignItems: 'center',
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16,
  },
  upgradeBtnPro: {
    backgroundColor: Colors.primary_container,
    shadowColor: Colors.primary,
  },
  upgradeBtnMax: {
    backgroundColor: 'transparent',
    borderWidth: 2, borderColor: SECONDARY,
  },
  disabledBtn: { opacity: 0.5 },
  upgradeBtnTextPro: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: Colors.on_primary_container,
  },
  upgradeBtnTextMax: {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: SECONDARY,
  },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingHorizontal: 32, paddingBottom: 32, paddingTop: 16,
    backgroundColor: 'rgba(10,10,15,0.85)',
    borderTopWidth: 0,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 24,
  },
  footerBtn:     { alignItems: 'center', gap: 4 },
  footerBtnText: {
    fontSize: 10, fontWeight: '700', letterSpacing: 1,
    textTransform: 'uppercase', color: Colors.on_surface_variant,
  },
});
