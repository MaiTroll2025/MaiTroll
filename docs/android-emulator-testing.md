# Android emulator testing and Logcat

Use the Android Studio Emulator with a **Google Play** system image. This is the recommended setup for MaiTroll because a Google Play image includes Google Play services used by Firebase Cloud Messaging (FCM). An AOSP-only image may not reproduce push registration or notification behavior accurately.

## One-time setup (Windows)

1. Install Android Studio from the official Android developer site.
2. In **Tools > SDK Manager**, install Android SDK Platform-Tools, Android Emulator, and an Android SDK platform matching the app's supported target (API 35 or 36).
3. In **Tools > Device Manager**, create a Pixel AVD with a **Google Play** system image. Use a recent API level; API 35 is a good compatibility baseline, and API 36 can be added as a second device.
4. Start the AVD and complete Android's initial setup. Sign into a test Google account if the test needs FCM. Do not use a production account for repeatable test runs.
5. From the repository root, confirm the tools are available:

   ```powershell
   .\scripts\android-emulator.ps1 -Action doctor
   ```

The helper checks the standard Windows SDK location (`%LOCALAPPDATA%\Android\Sdk`) and `ANDROID_SDK_ROOT` / `ANDROID_HOME`.

## Build and install the app

Build a debug APK from the current checkout and synchronize the current web assets into the native Android project:

```powershell
npm run cap:sync:android
Push-Location android
.\gradlew.bat assembleDebug
Pop-Location
```

For FCM testing, the real Firebase Android configuration must exist at `android\app\google-services.json`. It is intentionally git-ignored; download it from the Firebase project for package `com.maitroll.app` and keep it local/secure. Without it, Android push registration is skipped in the app, and Gradle now refuses to build a release APK/AAB.

Firebase API-key restrictions are signing-certificate-sensitive. In this environment, Firebase Installations accepted the Play signing SHA-1 shown in the Firebase project, but rejected the local debug certificate with `API_KEY_ANDROID_APP_BLOCKED`. Thus the Firebase project/API key can reach Firebase for the release identity; local debug FCM testing needs the debug package/certificate identity allowed too. Get the local debug SHA-1 without exposing the keystore:

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -list -v `
  -keystore "$HOME\.android\debug.keystore" `
  -storepass android `
  -alias androiddebugkey | Select-String 'SHA1:'
```

In Google Cloud Console, open **APIs & Services > Credentials**, select the API key referenced by this Firebase app, and add `com.maitroll.app` plus that debug SHA-1 to its Android application restrictions. Keep the existing Play signing identity authorized; do not remove restrictions or expose the API key. Reinstall the debug APK and repeat the Logcat test. The Play-distributed APK must be signed with a certificate authorized for the app's API key.

This builds the current working tree, not necessarily the APK that was published to Google Play. In this checkout, `android/app/build.gradle` has a local, uncommitted versionCode 54 change, while the suspected release was versionCode 53. To verify the exact Play release, install that release through the Play Store on the AVD with an authorized test account; use a locally built APK to test source changes, not as proof that the published binary is identical.

Install on the only connected device or emulator:

```powershell
.\scripts\android-emulator.ps1 -Action install
```

If more than one device is connected, first list devices and pass the desired serial:

```powershell
.\scripts\android-emulator.ps1 -Action devices
.\scripts\android-emulator.ps1 -Action install -Serial emulator-5554
```

## Capture a reproducible permission-prompt run

Start a clean full-buffer capture **before** resetting or launching the app. Full Logcat is intentional: a PID-only filter can miss Android framework, WebView, Firebase, or process-death messages.

```powershell
.\scripts\android-emulator.ps1 -Action capture -ClearBuffer
```

In another terminal, clear the app's state, then launch it:

```powershell
.\scripts\android-emulator.ps1 -Action reset
.\scripts\android-emulator.ps1 -Action launch
```

`reset` clears the app's data and sign-in state, revokes `POST_NOTIFICATIONS`, and clears the permission decision flags so the first-run permission request can be tested again. Sign in with a test account and reproduce the crash. Press Ctrl+C in the capture terminal after the app exits. The timestamped log is written under `artifacts\android-logcat\`.

You can open that folder directly and search for `FATAL EXCEPTION`, `AndroidRuntime`, `Process: com.maitroll.app`, `Capacitor`, `PushNotifications`, `FirebaseMessaging`, and `Permission`. Keep the original unfiltered log; it preserves the event ordering around the crash.

## Share logs safely

Logcat can contain account identifiers, URLs, and other device/app data. Review and redact a log before sharing it outside the team. Include the Android version/API level, emulator image name, APK versionCode, and exact reproduction steps. A local emulator is useful for repeatability, but confirm any suspected device-specific issue on at least one physical Android device.
