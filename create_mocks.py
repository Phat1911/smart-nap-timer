import os

mocks_dir = '/home/hong_phat/my_project/smart-nap-timer/mocks'
os.makedirs(mocks_dir, exist_ok=True)

mocks = {
    'react-native-purchases.js': '''module.exports = {
  Purchases: {
    configure: () => Promise.resolve(),
    getCustomerInfo: () => Promise.resolve({ entitlements: { all: {}, active: {} }, offerings: { current: null, all: {} } }),
    getOfferings: () => Promise.resolve({ current: null, all: {} }),
    purchasePackage: () => Promise.resolve({ customerInfo: {}, productIdentifier: '' }),
    restorePurchases: () => Promise.resolve({ entitlements: { all: {}, active: {} } }),
    logIn: () => Promise.resolve({ customerInfo: {}, created: false }),
    logOut: () => Promise.resolve(),
    setLogLevel: () => {},
    addCustomerInfoUpdateListener: () => {},
    removeCustomerInfoUpdateListener: () => {},
  },
};
''',
    'expo-notifications.js': '''module.exports = {
  requestPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
  scheduleNotificationAsync: () => Promise.resolve('mock-id'),
  cancelAllScheduledNotificationsAsync: () => Promise.resolve(),
  cancelScheduledNotificationAsync: () => Promise.resolve(),
  setNotificationHandler: () => {},
  addNotificationReceivedListener: () => ({ remove: () => {} }),
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  getBadgeCountAsync: () => Promise.resolve(0),
  setBadgeCountAsync: () => Promise.resolve(),
  dismissNotificationAsync: () => Promise.resolve(),
  dismissAllNotificationsAsync: () => Promise.resolve(),
  setNotificationChannelGroupAsync: () => Promise.resolve(),
  setNotificationCategoryAsync: () => Promise.resolve(),
  getNotificationPermissionsAsync: () => Promise.resolve({ canAlert: true, canBadge: true, canSound: true, canInterrupts: true }),
  setNotificationChannelAsync: () => Promise.resolve(),
};
''',
    'expo-haptics.js': '''module.exports = {
  notificationAsync: () => Promise.resolve(),
  selectionAsync: () => Promise.resolve(),
  impactAsync: () => Promise.resolve(),
};
''',
    'expo-brightness.js': '''module.exports = {
  setBrightnessAsync: () => Promise.resolve(),
  setSystemBrightnessAsync: () => Promise.resolve(),
  getSystemBrightnessAsync: () => Promise.resolve(0.5),
  getBrightnessAsync: () => Promise.resolve(0.5),
  getSystemBrightnessModeAsync: () => Promise.resolve(0),
};
''',
    'expo-sensors.js': '''module.exports = {
  Accelerometer: {
    addListener: () => ({ remove: () => {} }),
    isAvailableAsync: () => Promise.resolve(false),
    setUpdateInterval: () => {},
    removeAllListeners: () => {},
  },
  Gyroscope: {
    addListener: () => ({ remove: () => {} }),
    isAvailableAsync: () => Promise.resolve(false),
    setUpdateInterval: () => {},
    removeAllListeners: () => {},
  },
  Barometer: {
    addListener: () => ({ remove: () => {} }),
    isAvailableAsync: () => Promise.resolve(false),
  },
  Magnetometer: {
    addListener: () => ({ remove: () => {} }),
    isAvailableAsync: () => Promise.resolve(false),
  },
};
''',
    'expo-av.js': '''module.exports = {
  Audio: {
    Sound: {
      createAsync: () => Promise.resolve({ sound: { playAsync: () => Promise.resolve(), stopAsync: () => Promise.resolve(), pauseAsync: () => Promise.resolve(), setOnPlaybackStatusUpdate: () => {} } }),
      unloadAsync: () => Promise.resolve(),
    },
    setAudioModeAsync: () => Promise.resolve(),
    getPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
    requestPermissionsAsync: () => Promise.resolve({ granted: true, status: 'granted' }),
    getAudioFocusAsync: () => Promise.resolve(),
    setAudioFocusAsync: () => Promise.resolve(),
  },
};
''',
    'expo-file-system.js': '''module.exports = {
  StorageAccessFramework: {
    createFileAsync: () => Promise.resolve('mock-uri'),
    deleteAsync: () => Promise.resolve(),
    readAsStringAsync: () => Promise.resolve(''),
    writeAsStringAsync: () => Promise.resolve(),
  },
  documentDirectory: 'mock:///',
  cacheDirectory: 'mock:///cache',
  writeAsStringAsync: () => Promise.resolve(),
  readAsStringAsync: () => Promise.resolve(''),
  deleteAsync: () => Promise.resolve(),
  getInfoAsync: () => Promise.resolve({ exists: true, size: 0 }),
  downloadAsync: () => Promise.resolve({ uri: 'mock:///' }),
  moveAsync: () => Promise.resolve(),
  copyAsync: () => Promise.resolve(),
  makeDirectoryAsync: () => Promise.resolve(),
  readDirectoryAsync: () => Promise.resolve([]),
  isAvailableAsync: () => Promise.resolve(false),
};
''',
    'expo-sharing.js': '''module.exports = {
  shareAsync: () => Promise.resolve(),
  isAvailableAsync: () => Promise.resolve(false),
};
''',
    'expo-document-picker.js': '''module.exports = {
  getDocumentAsync: () => Promise.resolve({ assets: [] }),
  getTypeAsync: () => Promise.resolve(''),
};
''',
    'expo-store-review.js': '''module.exports = {
  requestReview: () => Promise.resolve(),
  hasAction: () => Promise.resolve(false),
  openStoreListing: () => Promise.resolve(),
  isAvailableAsync: () => Promise.resolve(false),
};
''',
    'expo-web-browser.js': '''module.exports = {
  openBrowserAsync: () => Promise.resolve({ type: 'dismiss' }),
  dismissBrowser: () => {},
  warmUpAsync: () => Promise.resolve(),
  mayInitWithUrlAsync: () => Promise.resolve(),
};
''',
    'expo-background-fetch.js': '''module.exports = {
  registerTaskAsync: () => Promise.resolve(),
  unregisterTaskAsync: () => Promise.resolve(),
  getRegisteredTasksAsync: () => Promise.resolve([]),
  getStatusAsync: () => Promise.resolve(1),
};
''',
    'expo-task-manager.js': '''module.exports = {
  isAvailableAsync: () => Promise.resolve(false),
  defineTask: () => {},
  unregisterTaskAsync: () => Promise.resolve(),
  getRegisteredTasksAsync: () => Promise.resolve([]),
  getStatusAsync: () => Promise.resolve(1),
};
''',
}

for filename, content in mocks.items():
    filepath = os.path.join(mocks_dir, filename)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f'Created {filename}')

print(f'Total: {len(mocks)} mock files created')
