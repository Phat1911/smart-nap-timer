/**
 * BatteryOptimizationService — Detects and alerts about battery optimization on Xiaomi/Redmi
 *
 * Responsible for:
 * - Checking if the device is Xiaomi/Redmi with active battery optimization
 * - Managing the alert display flag so it only shows once per app session
 * - Providing instructions for disabling battery optimization
 *
 * Used by:
 * - SleepingScreen: calls checkAndShowAlert() after nap starts
 *
 * Notes:
 * - Only works on Android (returns false on iOS)
 * - The alert is shown only once per app session
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules, Alert, Linking } from 'react-native';
import { Strings } from '../constants/strings';

class BatteryOptimizationService {
  private alertShownThisSession = false;

  /**
   * Checks if battery optimization is active on this device
   * @returns true if the device is Xiaomi/Redmi with battery optimization enabled
   */
  async isBatteryOptimizationActive(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
      if (!NativeModules.NativeAlarm) return false;
      return await NativeModules.NativeAlarm.isBatteryOptimizationActive();
    } catch {
      return false;
    }
  }

  /**
   * Shows the battery optimization alert if conditions are met
   * - Only shows once per session
   * - Only if battery optimization is active
   */
  async checkAndShowAlert(strings: typeof Strings): Promise<void> {
    // Already shown in this session
    if (this.alertShownThisSession) return;

    const isActive = await this.isBatteryOptimizationActive();
    if (!isActive) return;

    this.alertShownThisSession = true;

    return new Promise((resolve) => {
      Alert.alert(
        strings.battery_optimization_alert_title,
        strings.battery_optimization_alert_body,
        [
          {
            text: strings.battery_optimization_alert_settings,
            onPress: () => {
              // Open Android battery settings for the app
              Linking.openSettings()
                .catch(() => {
                  // If openSettings fails, try to open general battery settings
                  Linking.openURL('android-app://com.android.settings/').catch(() => {});
                })
                .finally(() => resolve());
            },
          },
          {
            text: strings.battery_optimization_alert_dismiss,
            onPress: () => resolve(),
            style: 'cancel',
          },
        ],
        { cancelable: false },
      );
    });
  }

  /**
   * Resets the session flag (for testing or manual reset)
   */
  resetSessionFlag(): void {
    this.alertShownThisSession = false;
  }
}

export const batteryOptimizationService = new BatteryOptimizationService();
