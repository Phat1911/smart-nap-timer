const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Map all native-only modules to mock implementations
const mockModules = [
  'react-native-purchases',
  'expo-notifications',
  'expo-haptics',
  'expo-brightness',
  'expo-sensors',
  'expo-file-system',
  'expo-sharing',
  'expo-document-picker',
  'expo-store-review',
  'expo-web-browser',
  'expo-background-fetch',
  'expo-task-manager',
];

config.resolver.extraNodeModules = {
  ...mockModules.reduce((acc, mod) => {
    acc[mod] = path.resolve(__dirname, 'mocks/' + mod.replace(/\//g, '_') + '.js');
    return acc;
  }, {}),
};

// Redirect react-native imports to react-native-web on web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/react-native-web/dist/index.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
