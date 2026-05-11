/**
 * AppNavigator — Navigation configuration for the entire app
 *
 * Responsible for:
 * - Defining RootStackParamList (all stack screens + params)
 * - Defining TabParamList (3 main tabs: Home, Dashboard, Settings)
 * - Creating the Bottom Tab Navigator with custom icons and styles
 * - Creating the outer Stack Navigator for navigating between nap flow screens
 *
 * Used by:
 * - App.tsx: renders <AppNavigator /> inside providers
 *
 * Notes:
 * - Stack starts at "Onboarding" — will replace to "Main" if already onboarded
 * - DevTools only opens as a modal (no back navigation bar)
 * - Tab bar is positioned absolute at the bottom of the screen with blur effect
 */

// ─────────────────────────────────────────
// Imports
// ─────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PhonePlacement, DetectionMethod } from '../models/Session';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import PaywallScreen from '../screens/PaywallScreen';
import DevToolsScreen from '../screens/DevToolsScreen';
import GuideScreen from '../screens/GuideScreen';
import HomeScreen from '../screens/HomeScreen';
import MonitoringScreen from '../screens/MonitoringScreen';
import SleepingScreen from '../screens/SleepingScreen';
import WakeScreen from '../screens/WakeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import { Colors } from '../constants';
import { navigationRef } from './navigationRef';
import { wakeFlowService } from '../services/WakeFlowService';

// ─────────────────────────────────────────
// Types / Interfaces
// ─────────────────────────────────────────

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Monitoring: { targetMinutes: number; placement: PhonePlacement; placements: PhonePlacement[]; maxFallAsleepMinutes: number };
  Sleeping: {
    targetMinutes: number;
    sleepStartTime: number;
    placement: PhonePlacement;
    /** P.10 -- all active placements passed through for session recording */
    placements?: PhonePlacement[];
    /** Seconds elapsed in MonitoringScreen before sleep was detected */
    latencySeconds: number;
    detectionMethod: DetectionMethod;
    confidenceScore: number;
  };
  Wake: { sessionId: string; fallAsleepTimeout?: boolean };
  Paywall: { reason?: string };
  DevTools: undefined;
  Guide: undefined;
};

export type TabParamList = {
  Home: undefined;
  Dashboard: undefined;
  Settings: undefined;
};

// ─────────────────────────────────────────
// Constants
// ─────────────────────────────────────────

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_EMOJI: Record<string, string> = {
  Home: '🏠',
  Dashboard: '📊',
  Settings: '⚙️',
};

// ─────────────────────────────────────────
// Render
// ─────────────────────────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.on_surface,
        tabBarInactiveTintColor: Colors.on_surface_variant,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, size }) => {
          const emoji = TAB_EMOJI[route.name];
          if (focused) {
            return (
              <Text style={{ fontSize: size - 2, backgroundColor: Colors.secondary_container, borderRadius: 16, paddingHorizontal: 20, paddingVertical: 4, }}>{emoji}</Text>
            );
          }
          return <Text style={{ fontSize: size - 2 }}>{emoji}</Text>;
        },
        tabBarBackground: () => <View style={styles.tabBarBg} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

/**
 * Root navigation component — wraps the entire app in NavigationContainer
 */
export default function AppNavigator() {
  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        wakeFlowService.consumePendingWakeIntent().catch(() => {});
      }}
    >
      <Stack.Navigator
        initialRouteName="Onboarding"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
          animationDuration: 250,
        }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Monitoring" component={MonitoringScreen} />
        <Stack.Screen name="Sleeping" component={SleepingScreen} />
        <Stack.Screen name="Wake" component={WakeScreen} />
        <Stack.Screen name="Paywall" component={PaywallScreen} />
        <Stack.Screen name="DevTools" component={DevToolsScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="Guide" component={GuideScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─────────────────────────────────────────
// Styles
// ─────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(19,19,25,0.85)',
    borderTopWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    position: 'absolute',
    elevation: 0,
    shadowOpacity: 0,
    height: 72,
    paddingBottom: 12,
    paddingTop: 8,
  },
  tabBarBg: {
    flex: 1,
    backgroundColor: 'rgba(19,19,25,0.85)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  tabActiveIcon: {
    backgroundColor: Colors.secondary_container,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 4,
    opacity: 0.3,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 2,
  },
});
