import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import { Colors } from '../constants';
import { RootStackParamList } from '../navigation/AppNavigator';
import { tierService } from '../services/TierService';
import { TierName } from '../models/Tier';

type Nav   = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Paywall'>;

// TODO: Replace with your real Terms of Service URL before App Store submission
const TERMS_URL = 'https://smartnaptimer.app/terms';
const PRICE = {
  pro: { vnd: '79.000 ₫', usd: '$2.99' },
  max: { vnd: '169.000 ₫', usd: '$6.99' },
};

// ── Feature lists ──────────────────────────────────────────────────────────────
const FREE_FEATURES = [
  '2 naps per day',
  '7-session history',
  '1 sound (Rain)',
  '1 phone placement',
  'Science-based suggestions',
];

const PRO_FEATURES = [
  '5 naps per day',
  '30-session history',
  '4 sounds (Rain, Fan, Static...)',
  '2 phone placements (combo fusion)',
  'AI predictions active',
  'Full insufficient sleep report',
];

const MAX_FEATURES = [
  'Unlimited naps',
  'Full history tracking',
  'All sounds & ambient library',
  '4 phone placements (quad fusion)',
  'AI + confidence % analysis',
  'Session data export (JSON/CSV)',
];

export default function PaywallScreen() {
  const navigation = useNavigation<Nav>();
  const route      = useRoute<Route>();
  const reason     = route.params?.reason;

  const isVN = tierService.isVietnamese;

  const [loading, setLoading]   = useState<'pro' | 'max' | 'restore' | null>(null);
  const [currentTier, setCurrentTier] = useState<TierName>('free');
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef  = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    tierService.getCurrentTier().then((t) => {
      if (mountedRef.current) setCurrentTier(t);
    }).catch(() => {});
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleUpgrade(tier: 'pro' | 'max') {
    if (loading) return;
    setLoading(tier);
    try {
      if (isVN) {
        // Vietnamese: PayOS flow
        const userId = `user_${Date.now()}`;
        const { checkoutUrl, orderCode } = await tierService.createPayOSLink(tier, userId);

        await WebBrowser.openBrowserAsync(checkoutUrl);

        // Poll for payment confirmation
        let attempts = 0;
        pollRef.current = setInterval(async () => {
          attempts++;
          const status = await tierService.pollPayOSStatus(orderCode);

          if (status === 'paid') {
            clearInterval(pollRef.current!);
            if (!mountedRef.current) return;
            await tierService.setTier(tier);
            setCurrentTier(tier);
            setLoading(null);
            Alert.alert(
              'Payment Successful',
              `Welcome to ${tier === 'pro' ? 'Pro' : 'Max'}! Your plan is now active.`,
              [{ text: 'OK', onPress: () => navigation.goBack() }],
            );
          } else if (status === 'cancelled' || attempts >= 40) {
            clearInterval(pollRef.current!);
            if (!mountedRef.current) return;
            setLoading(null);
            if (status === 'cancelled') {
              Alert.alert('Payment Cancelled', 'Your payment was cancelled.');
            } else {
              // Poll timed out -- notify user so they are not left confused
              Alert.alert(
                'Payment Pending',
                'We could not confirm your payment yet. If you completed payment, your plan will activate shortly.',
              );
            }
          }
        }, 3000);
      } else {
        // International: RevenueCat IAP
        const userId = `user_${Date.now()}`;
        const newTier = await tierService.purchase(tier, userId);
        if (!mountedRef.current) return;
        setCurrentTier(newTier);
        setLoading(null);
        Alert.alert(
          'Upgrade Successful',
          `Welcome to ${newTier === 'pro' ? 'Pro' : 'Max'}!`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      setLoading(null);
      Alert.alert('Purchase Failed', err?.message ?? 'Something went wrong. Please try again.');
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
        'Purchases Restored',
        restored === 'free'
          ? 'No active purchases found.'
          : `Your ${restored === 'pro' ? 'Pro' : 'Max'} plan has been restored!`,
        [{ text: 'OK', onPress: () => { if (restored !== 'free') navigation.goBack(); } }],
      );
    } catch (err: any) {
      if (!mountedRef.current) return;
      setLoading(null);
      Alert.alert('Restore Failed', err?.message ?? 'Could not restore purchases.');
    }
  }

  function priceLabel(tier: 'pro' | 'max') {
    return isVN ? PRICE[tier].vnd : PRICE[tier].usd;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      {/* Decorative glows */}
      <View style={styles.glowLeft}  pointerEvents="none" />
      <View style={styles.glowRight} pointerEvents="none" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons name="crown" size={22} color={Colors.primary} />
          <Text style={styles.headerBrand}>Sleep Luxe</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.maybeLater}>Maybe later</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            {'Unlock \n'}
            <Text style={styles.heroAccent}>{'Smart Nap'}</Text>
            {' Timer'}
          </Text>
          <Text style={styles.heroSub}>
            Choose the plan that fits your sleep needs and optimize your rest.
          </Text>
          {reason && (
            <View style={styles.reasonBadge}>
              <MaterialCommunityIcons name="information-outline" size={14} color={Colors.primary} />
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          )}
        </View>

        {/* FREE card */}
        <View style={styles.cardFree}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.tierLabel}>Baseline</Text>
              <Text style={styles.tierName}>FREE</Text>
            </View>
            <Text style={styles.priceMain}>$0</Text>
          </View>
          <FeatureList features={FREE_FEATURES} iconName="check-circle-outline" iconColor={Colors.outline} />
          <View style={styles.currentPlanBtn}>
            <Text style={styles.currentPlanText}>
              {currentTier === 'free' ? 'Current Plan' : 'Free tier'}
            </Text>
          </View>
        </View>

        {/* PRO card */}
        <View style={styles.cardPro}>
          {/* Most popular badge */}
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>Most Popular</Text>
          </View>

          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.tierLabel, { color: Colors.primary }]}>Optimized Rest</Text>
              <Text style={styles.tierName}>Pro</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={styles.priceMain}>{priceLabel('pro')}</Text>
              <Text style={styles.priceSub}>/ month</Text>
            </View>
          </View>

          <FeatureList features={PRO_FEATURES} iconName="star-four-points" iconColor={Colors.primary} />

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
                {currentTier === 'pro' ? 'Current Plan' : 'Upgrade to Pro'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* MAX card */}
        <View style={styles.cardMax}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.tierLabel, { color: Colors.secondary }]}>Elite Tier</Text>
              <Text style={styles.tierName}>Max</Text>
            </View>
            <View style={styles.priceBlock}>
              <Text style={[styles.priceMain, { color: Colors.secondary }]}>{priceLabel('max')}</Text>
              <Text style={styles.priceSub}>/ month</Text>
            </View>
          </View>

          <FeatureList features={MAX_FEATURES} iconName="diamond-stone" iconColor={Colors.secondary} />

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
                {currentTier === 'max' ? 'Current Plan' : 'Upgrade to Max'}
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
              <MaterialCommunityIcons name="restore" size={20} color={Colors.on_surface_variant} />
              <Text style={styles.footerBtnText}>Restore purchases</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerBtn}
          onPress={() => Linking.openURL(TERMS_URL)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="shield-check-outline" size={20} color={Colors.on_surface_variant} />
          <Text style={styles.footerBtnText}>Terms of Service</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── FeatureList sub-component ─────────────────────────────────────────────────
function FeatureList({
  features, iconName, iconColor,
}: {
  features: string[];
  iconName: string;
  iconColor: string;
}) {
  return (
    <View style={featureStyles.list}>
      {features.map((f) => (
        <View key={f} style={featureStyles.row}>
          <MaterialCommunityIcons name={iconName as any} size={18} color={iconColor} />
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
  maybeLater:  {
    fontSize: 11, fontWeight: '700', letterSpacing: 2,
    textTransform: 'uppercase', color: Colors.on_surface_variant,
  },

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
