import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors } from '../constants';
import { Strings } from '../constants/strings';
import { RootStackParamList } from '../navigation/AppNavigator';
import { PLACEMENT_PROFILES } from '../constants/config';
import { usePlacement } from '../hooks/usePlacement';
import type { PhonePlacement } from '../models/Session';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_W } = Dimensions.get('window');

const SLIDES = [
  {
    icon: 'sleep' as const,
    iconColor: Colors.primary,
    title: Strings.onboarding_welcome_title,
    body: Strings.onboarding_welcome_body,
  },
  {
    // Slide 2 is replaced by the placement picker — these values are unused
    icon: 'cellphone' as const,
    iconColor: Colors.secondary,
    title: Strings.onboarding_placement_title,
    body: Strings.onboarding_placement_body,
  },
  {
    icon: 'lock-open-check-outline' as const,
    iconColor: Colors.tertiary,
    title: Strings.onboarding_permissions_title,
    body: Strings.onboarding_permissions_body,
  },
  {
    icon: 'brain' as const,
    iconColor: Colors.primary,
    title: Strings.onboarding_how_title,
    body: Strings.onboarding_how_body,
  },
];

const PLACEMENT_ORDER: PhonePlacement[] = ['mattress', 'hand', 'chest', 'pocket'];

export default function OnboardingScreen() {
  const navigation = useNavigation<Nav>();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  // 6.1 — Persisted placement selection (set during onboarding slide 2)
  const { placement, setPlacement } = usePlacement();

  async function goNext() {
    if (index < SLIDES.length - 1) {
      const next = index + 1;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      setIndex(next);
    } else {
      // 6.1 — Save selected placement before leaving onboarding
      await setPlacement(placement);
      navigation.replace('Main');
    }
  }

  function skip() {
    navigation.replace('Main');
  }

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.root}>
      {/* Top glow */}
      <View style={styles.glow} pointerEvents="none" />

      {/* Skip */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={skip} activeOpacity={0.7}>
          <Text style={styles.skipText}>{isLast ? '' : Strings.onboarding_skip}</Text>
        </TouchableOpacity>
      </View>

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
                    const prof = PLACEMENT_PROFILES[p];
                    const active = placement === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.placementChip, active && styles.placementChipActive]}
                        onPress={() => setPlacement(p)}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name={prof.icon as any}
                          size={24}
                          color={active ? Colors.primary : Colors.on_surface_variant}
                        />
                        <Text style={[styles.placementLabel, active && styles.placementLabelActive]}>
                          {prof.label}
                        </Text>
                        <View style={styles.placementStars}>
                          {Array.from({ length: 4 }).map((_, i) => (
                            <MaterialCommunityIcons
                              key={i}
                              name={i < prof.accuracyStars ? 'star' : 'star-outline'}
                              size={10}
                              color={active ? Colors.primary : Colors.outline_variant}
                            />
                          ))}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.placementTip}>
                  {PLACEMENT_PROFILES[placement].tip}
                </Text>
              </View>
            );
          }

          return (
            <View style={styles.slide}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name={item.icon} size={64} color={item.iconColor} />
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
          <MaterialCommunityIcons name="arrow-right" size={18} color={Colors.on_primary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

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
