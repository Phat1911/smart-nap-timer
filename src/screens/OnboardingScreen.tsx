/**
 * OnboardingScreen — Introduction screen and initial phone placement selection
 *
 * Responsible for:
 * - Displaying feature introduction slides (horizontal FlatList)
 * - Allowing the user to select their preferred phone placement during onboarding
 * - On completion: saving the selected placement and navigating to the Main screen
 * - Registering the "Skip" or "Done" button in the top-right via TopRightContext
 *
 * Used by:
 * - AppNavigator: first screen in the stack (initialRouteName: "Onboarding")
 *
 * Notes:
 * - Onboarding is shown only once — after completion, the stack is replaced with "Main"
 * - If the user has opened the app before, OnboardingScreen still shows but can be
 *   skipped via an AsyncStorage check (if implemented)
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { useTopRight } from '../contexts/TopRightContext';
import { RootStackParamList } from '../navigation/AppNavigator';
import { PLACEMENT_PROFILES, getLocalizedPlacementProfiles } from '../constants/config';
import { usePlacement } from '../hooks/usePlacement';
import type { PhonePlacement } from '../models/Session';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');

const PLACEMENT_ORDER: PhonePlacement[] = ['mattress', 'hand', 'chest', 'pocket'];

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

export default function OnboardingScreen() {
  const { strings: Strings } = useLanguage();
  const navigation = useNavigation<Nav>();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const SLIDES = [
    {
      icon: '😴',
      iconColor: Colors.primary,
      title: Strings.onboarding_welcome_title,
      body: Strings.onboarding_welcome_body,
    },
    {
      // Slide 2 is replaced by the placement picker — these values are unused
      icon: '📱',
      iconColor: Colors.secondary,
      title: Strings.onboarding_placement_title,
      body: Strings.onboarding_placement_body,
    },
    {
      icon: '🔓',
      iconColor: Colors.tertiary,
      title: Strings.onboarding_permissions_title,
      body: Strings.onboarding_permissions_body,
    },
    {
      icon: '🧠',
      iconColor: Colors.primary,
      title: Strings.onboarding_how_title,
      body: Strings.onboarding_how_body,
    },
    {
      icon: '⏳',
      iconColor: Colors.secondary,
      title: Strings.onboarding_fallasleep_title,
      body: Strings.onboarding_fallasleep_body,
    },
    {
      icon: '📈',
      iconColor: Colors.primary,
      title: Strings.onboarding_ai_title,
      body: Strings.onboarding_ai_body,
    },
  ];

  const { setButton } = useTopRight();

  // 6.1 — Persisted placement selection (set during onboarding slide 2)
  const { placement, setPlacements } = usePlacement();

  async function goNext() {
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    } else {
      // 6.1 — Save selected placement before leaving onboarding
      await setPlacements([placement]);
      navigation.replace('Main');
    }
  }

  function skip() {
    navigation.replace('Main');
  }

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  // Register/unregister Skip button in the global top-right overlay
  useEffect(() => {
    if (isLast) {
      setButton(null);
    } else {
      setButton({ type: 'text', label: Strings.onboarding_skip, onPress: skip });
    }
    return () => setButton(null);
  }, [isLast, Strings.onboarding_skip]);

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Top glow */}
      <View style={styles.glow} pointerEvents="none" />


      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index: slideIndex }) => {
          // 6.1 — Slide 2 (index 1): replace icon+body with placement picker
          if (slideIndex === 1) {
            return (
              <View style={styles.slide}>
                <Text style={styles.slideTitle}>{item.title}</Text>
                <Text style={styles.slideBody}>{item.body}</Text>
                <View style={styles.placementGrid}>
                  {PLACEMENT_ORDER.map((p) => {
                    const prof = getLocalizedPlacementProfiles(Strings)[p];
                    const active = placement === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.placementChip, active && styles.placementChipActive]}
                        onPress={() => setPlacements([p])}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 24 }}>{prof.icon}</Text>
                        <Text style={[styles.placementLabel, active && styles.placementLabelActive]}>
                          {prof.label}
                        </Text>
                        <View style={styles.placementStars}>
                          {Array.from({ length: 4 }).map((_, i) => (
                            <Text key={i} style={{ fontSize: 10 }}>
                              {i < prof.accuracyStars ? '★' : '☆'}
                            </Text>
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.placementTip}>
                  {getLocalizedPlacementProfiles(Strings)[placement].tip}
                </Text>
              </View>
            );
          }

          return (
            <View style={styles.slide}>
              <View style={styles.iconCircle}>
                <Text style={{ fontSize: 64 }}>{item.icon}</Text>
              </View>
              <Text style={styles.slideTitle}>{item.title}</Text>
              <Text style={styles.slideBody}>{item.body}</Text>
            </View>
          );
        }}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
          setIndex(newIndex);
        }}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.nextBtn} onPress={goNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>
            {isLast ? Strings.onboarding_get_started : Strings.onboarding_next}
          </Text>
          <Text style={{ fontSize: 18 }}>→</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  glow: {
    position: 'absolute', top: '-5%', left: '-20%',
    width: '80%', height: '30%',
    backgroundColor: 'rgba(168,164,255,0.05)',
    borderRadius: 999,
  },

  topBar: {
    paddingHorizontal: 24, paddingTop: 8, alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 13, color: Colors.on_surface_variant, fontWeight: '500',
  },

  slide: {
    width: SCREEN_W,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconCircle: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.surface_container,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.outline_variant,
  },
  slideTitle: {
    fontSize: 26, fontWeight: '800', color: Colors.on_surface,
    textAlign: 'center', letterSpacing: -0.5,
  },
  slideBody: {
    fontSize: 14, color: Colors.on_surface_variant,
    textAlign: 'center', lineHeight: 22,
  },

  // Placement picker (6.1)
  placementGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 10, width: '100%', justifyContent: 'center',
  },
  placementChip: {
    width: '46%', padding: 14, borderRadius: 12,
    backgroundColor: Colors.surface_container,
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  placementChipActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(168,164,255,0.1)',
  },
  placementLabel: { fontSize: 13, fontWeight: '600', color: Colors.on_surface },
  placementLabelActive: { color: Colors.primary },
  placementStars: { flexDirection: 'row', gap: 1 },
  placementTip: {
    fontSize: 12, color: Colors.on_surface_variant,
    textAlign: 'center', lineHeight: 18, paddingHorizontal: 8,
  },

  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingBottom: 24 },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.surface_container_high,
  },
  dotActive: {
    width: 24, backgroundColor: Colors.primary,
  },

  footer: { paddingHorizontal: 24, paddingBottom: 24 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.primary_dim,
    paddingVertical: 18, borderRadius: 99,
    shadowColor: '#1e009f',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 6,
  },
  nextBtnText: { color: Colors.on_primary, fontSize: 16, fontWeight: '700' },
});
