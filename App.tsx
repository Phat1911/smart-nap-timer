/**
 * App.tsx — Component gốc của ứng dụng Smart Nap Timer
 *
 * Chịu trách nhiệm:
 * - Load font icon MaterialCommunityIcons trước khi render (tránh icon rỗng)
 * - Ẩn thanh điều hướng Android để màn hình ngủ không bị gián đoạn
 * - Khởi tạo tier service và lên lịch thông báo thông minh khi app mở
 * - Bọc toàn bộ app trong các context providers: Language, TopRight, SafeArea
 * - Hiển thị overlay nút ngôn ngữ + nút tùy chỉnh góc trên phải (LangOverlay)
 *
 * Được dùng bởi:
 * - index.ts: registerRootComponent(App)
 *
 * Lưu ý:
 * - Early return (khi font chưa load) phải đặt SAU tất cả hooks (rules of hooks)
 * - NavigationBar chỉ import trong production để tránh crash Expo Go
 * - ErrorBoundary bắt toàn bộ lỗi runtime và hiển thị stack trace thay vì crash
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';

// ─────────────────────────────────────────
// Error Boundary
// ─────────────────────────────────────────

// ── Debug error boundary (remove after finding the crash) ─────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <ScrollView style={eb.scroll} contentContainerStyle={eb.content}>
        <Text style={eb.title}>💥 Runtime Error</Text>
        <Text style={eb.message}>{error.message}</Text>
        <Text style={eb.stack}>{error.stack}</Text>
      </ScrollView>
    );
  }
}
const eb = StyleSheet.create({
  scroll:   { flex: 1, backgroundColor: '#0a0a0f' },
  content:  { padding: 24, paddingTop: 60, gap: 16 },
  title:    { fontSize: 20, fontWeight: '800', color: '#ff6b6b' },
  message:  { fontSize: 14, fontWeight: '600', color: '#fff', lineHeight: 20 },
  stack:    { fontSize: 11, color: '#aaa', lineHeight: 16, fontFamily: 'monospace' },
});
// ─────────────────────────────────────────
// Additional Imports
// ─────────────────────────────────────────

import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
let NavigationBar: any = null;
try {
  NavigationBar = require('expo-navigation-bar');
} catch {
  // Not available on this platform
}
import AppNavigator from './src/navigation/AppNavigator';
import { tierService } from './src/services/TierService';
import { scheduleSmartNudge } from './src/services/SmartNotificationService';
import { alarmService } from './src/services/AlarmService';
import { notifeeBackgroundHandler } from './src/services/NotifeeBackgroundHandler';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { TopRightProvider, useTopRight } from './src/contexts/TopRightContext';
import LangToggleButton from './src/components/ui/LangToggleButton';
import { Colors } from './src/constants';

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function LangOverlay() {
  const insets = useSafeAreaInsets();
  const { button } = useTopRight();

  return (
    <View
      style={[styles.langOverlay, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      {button && (
        button.type === 'icon' ? (
          <TouchableOpacity onPress={button.onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.extraBtn}>
            <Text style={{ fontSize: 22 }}>{button.iconName}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={button.onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.extraBtn}>
            <Text style={styles.extraBtnText}>{button.label}</Text>
          </TouchableOpacity>
        )
      )}
      <LangToggleButton />
    </View>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────

const styles = StyleSheet.create({
  langOverlay: {
    position: 'absolute',
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  extraBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  extraBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Colors.on_surface_variant,
  },
});

// ─────────────────────────────────────────
// Root Component
// ─────────────────────────────────────────

/**
 * Component gốc của app — khởi tạo font, tier, thông báo và navigation
 */
export default function App() {
  // Ẩn navigation bar Android để UI ngủ chiếm toàn màn hình
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar?.setVisibilityAsync('hidden');
      NavigationBar?.setBehaviorAsync('overlay-swipe');
    }
  }, []);

  useEffect(() => {
    // Initialize alarm service for reliable background alarm scheduling
    alarmService.initialize().catch((e) => console.error('Failed to initialize alarm service:', e));
    
    // Setup Notifee background handlers for when alarm fires
    notifeeBackgroundHandler.setupListeners();
    
    // Warm-up RevenueCat SDK để tránh độ trễ khi mở PaywallScreen lần đầu
    tierService.warmUp();
    scheduleSmartNudge().catch(() => {});
    // Ping backend để Render instance không bị sleep (cold start ~30s)
    fetch('https://smart-nap-timer-backend.onrender.com/health')
      .catch(() => {});

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        tierService.getOrCreateDeviceId()
          .then((userId) => tierService.fetchTierFromServer(userId))
          .catch(() => {});
        scheduleSmartNudge().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <TopRightProvider>
          <SafeAreaProvider>
            <StatusBar style="light" hidden />
            <AppNavigator />
            <LangOverlay />
          </SafeAreaProvider>
        </TopRightProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
