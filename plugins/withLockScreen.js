// Lets the app open over the lock screen and turn the screen on when a full-screen alarm fires.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withLockScreen(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application && cfg.modResults.manifest.application[0];
    const activity =
      app && app.activity && app.activity.find((a) => a.$['android:name'] === '.MainActivity');
    if (activity) {
      activity.$['android:showWhenLocked'] = 'true';
      activity.$['android:turnScreenOn'] = 'true';
    }
    return cfg;
  });
};
