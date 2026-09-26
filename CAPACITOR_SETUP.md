# Wrapping the web app as an APK (Capacitor)

Do this only after the Vercel deployment is live — the wrapper just points
a native shell at your deployed URL.

## 1. Add Capacitor to the repo
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Youth Party CBM" "org.youthparty.cbm"
```
(`capacitor.config.ts` is already in this repo — update the `server.url`
to your real Vercel domain once you have it.)

## 2. Add the Android platform
```bash
npx cap add android
npx cap sync android
```

## 3. Build the APK
- Debug (fast, for client testing):
  ```bash
  cd android
  ./gradlew assembleDebug
  # output: android/app/build/outputs/apk/debug/app-debug.apk
  ```
- Release (required for Play Store): use Android Studio → Build → Generate
  Signed Bundle/APK, or `./gradlew assembleRelease` with a keystore configured
  in `android/app/build.gradle`.

## 4. Send the client a test build
Debug APK can go straight over WhatsApp/email/direct link. Android will
warn about "unknown sources" — expected for a pre-Play-Store build.

## 5. Before Google Play submission
- Use a real release keystore, and back it up (losing it blocks future updates).
- Add a `/privacy` page on the Vercel deployment — required because the app
  collects names, photos, phone/email, and ward/polling-unit data.
- Fill in the Play Console Data Safety form to match.
- Prepare listing assets: icon, feature graphic, 2–8 screenshots, descriptions.
