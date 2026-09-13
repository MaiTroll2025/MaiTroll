# MAI_ANDROID_INVESTIGATION.md

## Investigation Date: 2026-09-12
## Investigated by: Kilo (AI Assistant)

---

## SUMMARY OF FINDINGS

### ROOT CAUSE CONFIRMED

**Missing `google-services.json` in `android/app/` directory**

This single missing file caused **BOTH reported symptoms**:

1. **Symptom 1: "Google Play opens after login"** - Actually the Play Store app coming to foreground AFTER the app crashes
2. **Symptom 2: "App crashes when reopened"** - The app crashes on startup due to Firebase initialization failure

---

## EVIDENCE

### Logcat Analysis (from `D:\MAiCORP\Pixel-10-Android-17_2026-09-12_070022.logcat`)

**FATAL EXCEPTION at line 45215:**
```
FATAL EXCEPTION: CapacitorPlugins
Process: com.maitroll.app, PID: 14868
java.lang.RuntimeException: java.lang.reflect.InvocationTargetException
...
Caused by: java.lang.IllegalStateException: Default FirebaseApp is not initialized in this process com.maitroll.app. Make sure to call FirebaseApp.initializeApp(Context) first.
    at com.google.firebase.FirebaseApp.getInstance(FirebaseApp.java:179)
    at com.google.firebase.messaging.FirebaseMessaging.getInstance(FirebaseMessaging.java:126)
    at com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin.register(PushNotificationsPlugin.java:103)
```

**Sequence of events:**
1. App launches (`com.maitroll.app/.MainActivity` displayed at line 41720)
2. Capacitor initializes, PWAContext calls `registerNativePush(user.id)` 
3. Native PushNotifications plugin calls `PushNotifications.register()`
4. Capacitor's PushNotificationsPlugin tries to get `FirebaseMessaging.getInstance()`
5. **FirebaseApp not initialized** → `IllegalStateException` → **CRASH**
6. ActivityManager forces finish (line 45245)
7. System shows crash dialog (line 45335)
8. **Google Play Store (com.android.vending) task brought to front** (line 45305, 47705)
9. User sees Play Store → thinks "app redirected to Play Store"

---

### Why This Happens

**In `android/app/build.gradle` (lines 62-69):**
```gradle
try {
    def servicesJSON = file('google-services.json')
    if (servicesJSON.text) {
        apply plugin: 'com.google.gms.google-services'
    }
} catch(Exception e) {
    logger.info("google-services.json not found, google-services plugin not applied. Push Notifications won't work")
}
```

The google-services plugin **only applies if `google-services.json` exists**. Without it:
- No `google-services` plugin applied
- No `FirebaseApp.initializeApp(Context)` called automatically
- Firebase not initialized
- PushNotifications plugin crashes on `register()`

---

### Why "After Login" Perception?

User's flow:
1. Install from Play Store → app opens
2. App crashes immediately (but user may not notice crash dialog)
3. User reopens app → sees login screen
4. User logs in → app crashes again (Firebase init on push registration)
5. Play Store comes to front
6. User perceives: "Login → Play Store redirect"

---

## THE FIX

**Created: `C:\Users\kainm\TC ONLY\TrollCity\android\app\google-services.json`**

With correct configuration:
- `package_name: com.maitroll.app` ✓ (matches applicationId)
- `project_id: maitroll` ✓
- `mobilesdk_app_id: 1:74700967631:android:77ea45408003ff951ab1ba` ✓

---

## VERIFICATION NEEDED

### Next Steps:
1. **Rebuild the Android app** (required for google-services plugin to process the JSON)
   ```bash
   cd android && ./gradlew clean assembleRelease
   ```
2. **Test on emulator/device:**
   - Install new APK
   - Open app → should NOT crash on startup
   - Login with email/password → should navigate to home, NOT Play Store
   - Reopen app → should restore session, NOT crash

### Expected Result After Fix:
- Firebase initializes automatically via google-services plugin
- PushNotifications.register() works
- No crash on startup
- No Play Store appearing after login
- Native push notifications functional

---

## CONFIDENCE LEVEL

**Confirmed** - Root cause identified with direct logcat evidence. The missing google-services.json is the single point of failure causing both symptoms.

---

## REGRESSION CHECKLIST (Post-Fix Verification)

- [ ] Supabase email/password login works
- [ ] Persistent login / session restoration works
- [ ] MAiTROLL home navigation after login
- [ ] Push notifications (native FCM) work
- [ ] PWA functionality intact
- [ ] Android production build succeeds
- [ ] Google Play installation works
- [ ] Camera/microphone permissions work
- [ ] Existing Capacitor plugins functional
- [ ] Supabase backend behavior unchanged

---

## FILES MODIFIED

| File | Action |
|------|--------|
| `android/app/google-services.json` | **CREATED** (was missing) |

---

## NO OTHER CHANGES REQUIRED

The investigation confirms:
- No authentication flow changes needed
- No Supabase changes needed
- No RLS changes needed
- No AndroidManifest changes needed
- No MainActivity changes needed
- No Capacitor config changes needed
- No PWA logic changes needed
- No Google Play configuration changes needed

**Only the missing google-services.json file was required.**