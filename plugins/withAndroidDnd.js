/**
 * withAndroidDnd — Expo config plugin for Android Do Not Disturb support.
 *
 * What it does at prebuild / EAS Build time:
 *   1. Adds android.permission.ACCESS_NOTIFICATION_POLICY to AndroidManifest.xml
 *   2. Writes DndModule.kt + DndPackage.kt into the Android source tree
 *   3. Registers DndPackage in MainApplication.kt
 */

const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── Kotlin source templates ──────────────────────────────────────────────────

function getDndModuleKotlin(packageName) {
  return `package ${packageName}

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DndModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DndModule"

    private val notificationManager: NotificationManager
        get() = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    @ReactMethod
    fun isPermissionGranted(promise: Promise) {
        try {
            val granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
                notificationManager.isNotificationPolicyAccessGranted
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.reject("DND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun requestPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("DND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun enable(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (notificationManager.isNotificationPolicyAccessGranted) {
                    notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE)
                    promise.resolve(true)
                } else {
                    promise.reject("DND_PERMISSION_DENIED", "Notification Policy Access not granted")
                }
            } else {
                // Pre-M: DND controlled via AudioManager ringer mode; resolve as no-op
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("DND_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun disable(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
                notificationManager.isNotificationPolicyAccessGranted) {
                notificationManager.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DND_ERROR", e.message, e)
        }
    }
}
`;
}

function getDndPackageKotlin(packageName) {
  return `package ${packageName}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class DndPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(DndModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;
}

// ─── Step 1: Permission ───────────────────────────────────────────────────────

function withAndroidDndPermission(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    const alreadyAdded = manifest['uses-permission'].some(
      (p) => p.$?.['android:name'] === 'android.permission.ACCESS_NOTIFICATION_POLICY'
    );
    if (!alreadyAdded) {
      manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.ACCESS_NOTIFICATION_POLICY' },
      });
    }
    return config;
  });
}

// ─── Step 2: Kotlin source files ─────────────────────────────────────────────

function withAndroidDndModule(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const packageName = config.android?.package ?? 'com.example.app';
      const packagePath = packageName.replace(/\./g, '/');
      const sourceDir = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java',
        packagePath
      );
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDir, 'DndModule.kt'),
        getDndModuleKotlin(packageName)
      );
      fs.writeFileSync(
        path.join(sourceDir, 'DndPackage.kt'),
        getDndPackageKotlin(packageName)
      );
      return config;
    },
  ]);
}

// ─── Step 3: Register package in MainApplication.kt ──────────────────────────

function withAndroidDndMainApplication(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const packageName = config.android?.package ?? 'com.example.app';
      const packagePath = packageName.replace(/\./g, '/');
      const mainAppPath = path.join(
        config.modRequest.platformProjectRoot,
        'app/src/main/java',
        packagePath,
        'MainApplication.kt'
      );

      if (!fs.existsSync(mainAppPath)) return config;

      let contents = fs.readFileSync(mainAppPath, 'utf-8');
      if (contents.includes('DndPackage')) return config; // idempotent

      // Expo/RN generated MainApplication.kt uses PackageList(this).packages.apply { ... }
      // Insert our package registration inside that block.
      const target = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (target.test(contents)) {
        contents = contents.replace(
          target,
          'PackageList(this).packages.apply {\n                add(DndPackage())'
        );
        fs.writeFileSync(mainAppPath, contents);
      }

      return config;
    },
  ]);
}

// ─── Composed plugin ─────────────────────────────────────────────────────────

module.exports = function withAndroidDnd(config) {
  config = withAndroidDndPermission(config);
  config = withAndroidDndModule(config);
  config = withAndroidDndMainApplication(config);
  return config;
};
