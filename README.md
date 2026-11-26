# IRRITATOR: alarm test build (spike 1)

This build tests the riskiest part first: does an alarm, a countdown and escalating nags survive on your Samsung S24 Ultra?

What works:
- Its own alarm (rings over the lock screen), dismiss to start your countdown (5 to 30 min, steps of 5)
- Nags: a quiet one at half time, loud ones at leave-by, +3, +6, +9 minutes, then a full-screen motivation screen at +10
- Skip needs a 30-second wait and a typed reason (streak resets)
- "Test: I'm at the gym" stands in for gym check-in until location and steps exist

Not built yet: gym check-in (location and steps), app locking, progress screen, decay estimate.

## Set up the phone (once)
1. Settings > About phone > Software information, tap Build number 7 times.
2. Settings > Developer options > turn on USB debugging.
3. Plug the phone into your computer and accept the "Allow USB debugging" prompt.

## Build and install
Needs Node 20 or newer and Android Studio (for the Android SDK and its bundled JDK).

    cd irritator-app
    npm install
    npx expo run:android

The first build takes 5 to 15 minutes. It installs a development build on your phone. This will not work in Expo Go.
If it says it can't find the SDK, set ANDROID_HOME to your Android SDK folder (Android Studio > Settings > Languages & Frameworks > Android SDK shows the path).

## Allow things on the phone
1. Open IRRITATOR, press "Set alarm". Allow notifications.
2. When "Alarms & reminders" opens, turn it on for IRRITATOR, go back, press "Set alarm" again.
3. Settings > Battery > Background usage limits > Never sleeping apps > add IRRITATOR. Also Settings > Apps > IRRITATOR > Battery > Unrestricted.
4. If the alarm doesn't light up the lock screen, check Settings > Apps > IRRITATOR > Notifications and allow lock screen and full-screen notifications.

## Tests to run (and tell me what happened)
Use the 5-minute countdown. Use "Test: ring in 30 seconds" each time.
1. Phone locked, screen off: does the alarm screen appear on time? Is there sound?
2. Same, but swipe IRRITATOR away from recent apps first.
3. Same, but restart the phone after pressing the button.
4. Same, but leave the phone untouched for 30 minutes before pressing nothing (set alarm, then wait).
5. After dismissing: do the nags arrive at the right times, and does the full screen appear at +10 minutes?
For anything that fails, note how late it was or whether it never came. Keep your normal Samsung Clock alarm as a backup for the first few mornings.

## Build the APK in the cloud (GitHub Actions)
Every push to `main` builds a release APK (arm64, no computer needed to run it) and publishes it as a GitHub release named "Build N". You can also run it by hand: repo > Actions > Build Android APK > Run workflow.

Get the APK on your phone:
1. Open the repo's Releases page in your phone browser (signed in to GitHub) and download the .apk.
2. Allow "Install unknown apps" for the browser when Android asks, then install.

Get an email when a build is ready (optional):
- Easiest: on the repo, Watch > Custom > Releases. GitHub emails you for each new release.
- Or send the email yourself: repo > Settings > Secrets and variables > Actions, add `MAIL_USERNAME` (your Gmail address), `MAIL_PASSWORD` (a Gmail app password, not your normal password) and `MAIL_TO` (where to send). The workflow then emails the download link. The APK itself is too large to attach to an email.
