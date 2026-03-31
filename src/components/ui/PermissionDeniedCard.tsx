/**
 * Task 2.16 — PermissionDeniedCard
 *
 * Shown in MonitoringScreen when one or more required permissions are denied.
 * Lists which permissions are missing and provides:
 *   • "Open Settings" — deep-links into device Settings so the user can grant them
 *   • "Continue without mic" (optional) — lets the user proceed with accel-only
 *     detection when the microphone is denied but notifications are granted
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../constants';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PermissionDeniedCardProps {
  micDenied:          boolean;
  notifDenied:        boolean;
  /** If provided, a secondary "Continue without mic" action is shown */
  onContinueWithoutMic?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PermissionDeniedCard({
  micDenied,
  notifDenied,
  onContinueWithoutMic,
}: PermissionDeniedCardProps) {
  function openSettings() {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  }

  return (
    <View style={styles.card}>
      {/* Icon */}
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name="lock-outline" size={28} color={Colors.error} />
      </View>

      {/* Title */}
      <Text style={styles.title}>Permissions needed</Text>
      <Text style={styles.subtitle}>
        Grant the following to enable sleep detection:
      </Text>

      {/* Missing permissions list */}
      <View style={styles.list}>
        {micDenied && (
          <View style={styles.listItem}>
            <MaterialCommunityIcons name="microphone-off" size={16} color={Colors.error} />
            <Text style={styles.listText}>Microphone — breathing detection</Text>
          </View>
        )}
        {notifDenied && (
          <View style={styles.listItem}>
            <MaterialCommunityIcons name="bell-off-outline" size={16} color={Colors.error} />
            <Text style={styles.listText}>Notifications — wake alarm</Text>
          </View>
        )}
      </View>

      {/* Open Settings */}
      <TouchableOpacity style={styles.settingsBtn} onPress={openSettings} activeOpacity={0.8}>
        <MaterialCommunityIcons name="cog-outline" size={16} color={Colors.on_primary} />
        <Text style={styles.settingsBtnText}>Open Settings</Text>
      </TouchableOpacity>

      {/* Continue without mic (only when mic is the sole blocker and notif is ok) */}
      {onContinueWithoutMic && micDenied && !notifDenied && (
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={onContinueWithoutMic}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>
            Continue with motion-only detection
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    margin: 24,
    padding: 24,
    borderRadius: 16,
    backgroundColor: Colors.surface_container,
    borderWidth: 1,
    borderColor: 'rgba(255,110,132,0.2)',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,110,132,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.on_surface,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: Colors.on_surface_variant,
    textAlign: 'center',
    lineHeight: 18,
  },
  list: {
    width: '100%',
    gap: 8,
    marginVertical: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,110,132,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  listText: {
    fontSize: 13,
    color: Colors.on_surface,
    flex: 1,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary_dim,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 99,
    marginTop: 4,
  },
  settingsBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.on_primary,
  },
  secondaryBtn: {
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontSize: 12,
    color: Colors.on_surface_variant,
    textDecorationLine: 'underline',
  },
});
