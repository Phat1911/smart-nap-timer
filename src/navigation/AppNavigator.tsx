import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { PhonePlacement, DetectionMethod } from '../models/Session';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import PaywallScreen from '../screens/PaywallScreen';
import DevToolsScreen from '../screens/DevToolsScreen';
import HomeScreen from '../screens/HomeScreen';
import MonitoringScreen from '../screens/MonitoringScreen';
import SleepingScreen from '../screens/SleepingScreen';
import WakeScreen from '../screens/WakeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SettingsScreen from '../screens/SettingsScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import { Colors } from '../constants';

export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Monitoring: { targetMinutes: number; placement: PhonePlacement };
  Sleeping: {
    targetMinutes: number;
    sleepStartTime: number;
    placement: PhonePlacement;
    /** Seconds elapsed in MonitoringScreen before sleep was detected */
    latencySeconds: number;
    detectionMethod: DetectionMethod;
    confidenceScore: number;
  };
  Wake: { sessionId: string };
  Paywall: { reason?: string };
  DevTools: undefined;
};

export type TabParamList = {
  Home: undefined;
  Dashboard: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type TabIconName = 'sleep' | 'chart-line' | 'cog';

const TAB_ICONS: Record<string, TabIconName> = {
  Home: 'sleep',
  Dashboard: 'chart-line',
  Settings: 'cog',
};

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
        tabBarIcon: ({ focused, color, size }) => {
          const iconName = TAB_ICONS[route.name];
          if (focused) {
            return (
              <View style={styles.tabActiveIcon}>
                <MaterialCommunityIcons name={iconName} size={size} color={color} />
              </View>
            );
          }
          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
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

export default function AppNavigator() {
  return (
    <NavigationContainer>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

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
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0,
    marginTop: 2,
  },
});
