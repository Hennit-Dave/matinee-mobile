const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const STRIPE_PROGUARD = `
# @stripe/stripe-react-native references optional push-provisioning (issuing) classes that
# aren't bundled; stop R8 from failing on them in release builds. We don't use that feature.
-dontwarn com.stripe.android.pushProvisioning.**
-keep class com.stripe.android.pushProvisioning.** { *; }
-keep class com.reactnativestripesdk.** { *; }
`;

// 1) Append Stripe keep/dontwarn rules to proguard-rules.pro so R8 (minifyRelease) passes.
function withStripeProguard(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
      const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!existing.includes('com.stripe.android.pushProvisioning')) {
        fs.writeFileSync(file, existing + STRIPE_PROGUARD, 'utf8');
      }
      return cfg;
    },
  ]);
}

// 2) Skip the vital release lint (it can't resolve the same Stripe transitive dep).
function withReleaseLintDisabled(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') return cfg;
    if (!cfg.modResults.contents.includes('checkReleaseBuilds false')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /^android\s*\{/m,
        'android {\n    lint {\n        checkReleaseBuilds false\n        abortOnError false\n    }'
      );
    }
    return cfg;
  });
}

module.exports = function (config) {
  return withReleaseLintDisabled(withStripeProguard(config));
};
