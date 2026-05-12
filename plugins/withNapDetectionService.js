const { withMainApplication } = require('expo/config-plugins');

/**
 * Config plugin for NapDetectionService.
 *
 * Automatically registers NapDetectionPackage in MainApplication
 * when running expo prebuild or eas build.
 */
module.exports = function withNapDetectionService(config) {
  return withMainApplication(config, (cfg) => {
    const mainApplication = cfg.modResults;
    const contents = mainApplication.contents || '';

    if (!contents.includes('import com.hongphat.smartnaptimer.NapDetectionPackage')) {
      mainApplication.contents = mainApplication.contents.replace(
        /import com\.facebook\.react\.bridge\.NativeModule;\n/,
        'import com.facebook.react.bridge.NativeModule;\nimport com.hongphat.smartnaptimer.NapDetectionPackage;\n'
      );
    }

    if (!mainApplication.contents.includes('new NapDetectionPackage()')) {
      mainApplication.contents = mainApplication.contents.replace(
        /packages\.add\(new RNSharedElementPackage\(\)\);/,
        'packages.add(new RNSharedElementPackage());\n    packages.add(new NapDetectionPackage());'
      );
    }

    return cfg;
  });
};
