import { ConfigPlugin, withMainApplication } from 'expo/config-plugins';

/**
 * Config plugin for NapDetectionService
 * 
 * Automatically registers NapDetectionPackage in MainApplication
 * when running expo prebuild or eas build.
 */

const withNapDetectionService: ConfigPlugin = (config) => {
  return withMainApplication(config, async (cfg) => {
    const mainApplication = cfg.modResults;

    // Add import statement if not already present
    if (
      mainApplication.contents &&
      !mainApplication.contents.includes('import com.hongphat.smartnaptimer.NapDetectionPackage')
    ) {
      mainApplication.contents = mainApplication.contents.replace(
        /import com\.facebook\.react\.bridge\.NativeModule;/,
        `import com.facebook.react.bridge.NativeModule;
import com.hongphat.smartnaptimer.NapDetectionPackage;`
      );
    }

    // Add NapDetectionPackage to getPackages() method
    if (
      mainApplication.contents &&
      !mainApplication.contents.includes('new NapDetectionPackage()')
    ) {
      mainApplication.contents = mainApplication.contents.replace(
        /packages\.add\(new RNSharedElementPackage\(\)\);/,
        `packages.add(new RNSharedElementPackage());
    packages.add(new NapDetectionPackage());`
      );
    }

    return mainApplication;
  });
};

export default withNapDetectionService;
