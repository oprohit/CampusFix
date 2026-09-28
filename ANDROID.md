# LostMate AI - Android App Guide (Capacitor)

This guide provides complete instructions for running, debugging, building, and testing the LostMate AI Android application.

---

## 1. Prerequisites

Before running the Android project, ensure you have installed:

1. **Node.js**: Node 20+ or 24+ (currently installed: `v24.15.0`).
2. **JDK (Java Development Kit)**:
   - JDK 17 or JDK 21 (recommended for Android Gradle Plugin 8+).
   - Verify with `java -version`.
   - Ensure `JAVA_HOME` environment variable points to your JDK directory.
3. **Android Studio**:
   - Install [Android Studio Hedgehog, Iguana, Jellyfish, or newer](https://developer.android.com/studio).
   - In Android Studio SDK Manager (`Settings > Languages & Frameworks > Android SDK`):
     - **SDK Platforms**: Android 14 (API 34) and Android 13 (API 33).
     - **SDK Tools**: Android SDK Build-Tools, Android SDK Command-line Tools, Android SDK Platform-Tools.
4. **Android Phone**:
   - Any Android phone running Android 8.0+ (API 26+).
   - Enable **Developer Options**: Go to `Settings > About phone` and tap `Build number` 7 times.
   - Enable **USB Debugging** in `Settings > System > Developer options`.

---

## 2. Essential Commands

All commands should be executed from the `/web` directory:

```bash
cd web

# 1. Install dependencies
npm install

# 2. Build web assets & sync into Android native project
npm run android:sync

# 3. Open the native project in Android Studio
npm run android:open
```

Alternative individual commands:
```bash
# Compile TypeScript and bundle with Vite
npm run build

# Copy web dist assets and update native Capacitor plugins
npx cap sync android

# Open Android Studio
npx cap open android
```

---

## 3. How to Open the Project in Android Studio

1. Launch Android Studio.
2. Click **Open** (or `File > Open...`).
3. Navigate to and select the folder:
   ```
   c:\FixMyCampus\web\android
   ```
4. Wait for Android Studio to index files and run the initial **Gradle Sync**.
5. Once Gradle Sync finishes successfully (message: *"BUILD SUCCESSFUL"* in the build tab), the project is ready.

---

## 4. How to Run on a USB-Connected Phone

1. Connect your Android phone to your computer via a USB cable.
2. On your phone, accept the prompt: **"Allow USB debugging from this computer?"** (select *Always allow*).
3. In Android Studio, look at the device selector dropdown in the top toolbar. Your phone's model name should appear.
4. Click the green **Run** button (or press `Shift + F10`).
5. Android Studio will compile the app and install it directly onto your phone. The app will launch automatically.

---

## 5. How to Build a Debug APK & Output Location

### Option A: Using Android Studio
1. In Android Studio, go to the top menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
2. When the build completes, a popup appears at the bottom-right corner: *"Build APK(s): APK(s) generated successfully."*
3. Click **locate** to open the folder containing the APK.

### Option B: Using Command Line (Terminal)
Navigate to the `web/android` directory:
```bash
cd web/android
gradlew assembleDebug
```

### Output File Location
The compiled debug APK will be created at:
```
c:\FixMyCampus\web\android\app\build\outputs\apk\debug\app-debug.apk
```
You can transfer this `.apk` directly to any Android device and tap it to install.

---

## 6. Troubleshooting Guide

### 1. Blank White / Dark Screen on Startup
- **Cause**: Web build assets were not synced or JavaScript runtime error occurred before React mounted.
- **Solution**:
  1. Run `cd web && npm run android:sync`.
  2. In Chrome on your PC, navigate to `chrome://inspect/#devices` while your phone is plugged in.
  3. Inspect the WebView console to read any runtime errors.

### 2. Network Errors (`Network Error` / `Failed to fetch`)
- **Cause**: Production build cannot reach `localhost`, or CORS is blocking the request.
- **Solution**:
  1. The app runs under `https://localhost` inside Capacitor WebView. In production builds, `VITE_API_URL` cannot be `localhost`. Ensure `VITE_API_URL` points to your public deployed API (e.g. Vercel deployment URL).
  2. Verify that the backend CORS in `api/index.py` allows `https://localhost` and `capacitor://localhost`.
  3. If testing against a local dev backend on your computer from a physical phone, ensure your phone and PC are on the same Wi-Fi network and use your computer's local LAN IP (e.g. `http://192.168.1.X:8000`), or run `adb reverse tcp:8000 tcp:8000`.

### 3. Gradle Sync Failure in Android Studio
- **Cause**: JDK version mismatch or missing Android SDK tools.
- **Solution**:
  1. In Android Studio, go to `Settings > Build, Execution, Deployment > Build Tools > Gradle`.
  2. Ensure **Gradle JDK** is set to **JDK 17** or **JDK 21** (embedded JDK from Android Studio is recommended).
  3. Click `File > Invalidate Caches / Restart...` and re-sync Gradle.

### 4. Camera Not Opening / Permission Denied
- **Cause**: Android permissions missing from `AndroidManifest.xml` or user clicked "Deny".
- **Solution**:
  1. Ensure `android.permission.CAMERA` and `android.permission.READ_MEDIA_IMAGES` are in `web/android/app/src/main/AndroidManifest.xml`.
  2. On your phone, go to `Settings > Apps > LostMate AI > Permissions` and enable Camera and Photos/Storage.
  3. The app displays an in-app error banner if permission is denied.

---

## 7. Manual Testing Checklist (Phone)

Use this checklist to verify native behavior on your device:

- [ ] **1. Sign Up**: Open the app, switch to Sign Up on `/auth`, enter a new campus email & password, and verify success message.
- [ ] **2. Log In**: Sign in with your credentials and confirm automatic redirect to the Chat screen (`/chat`).
- [ ] **3. Native Auth Cleanliness**: Verify the Google OAuth button is completely hidden on native Android (preventing WebView block).
- [ ] **4. Send Text Message**: Type a message (e.g. *"I lost my black wallet in the student union"*) and send. Check bot typing indicator and response.
- [ ] **5. Keyboard Behavior**: Tap the chat input and ensure the input bar stays visible above the keyboard, and the message list scrolls to the newest message.
- [ ] **6. Attach Photo**: Tap the camera/photo icon. Select **Take Photo** to capture with camera or **Choose from Gallery**. Verify the preview appears, downscaling works smoothly, and photo uploads with the message.
- [ ] **7. Match Cards**: When a high confidence match is found, verify match cards render with photos, badges (% match), and item details.
- [ ] **8. Open Match / Report Item**: Tap *"Report Found"* modal. Verify the modal opens smoothly.
- [ ] **9. Android Hardware Back Button**:
  - With the modal open, press the physical/gesture Android Back button: **verify it closes the modal** instead of exiting the app.
  - From `/dashboard`, press Back: verify it returns to `/chat`.
  - From the main `/chat` screen, press Back: verify the app exits gracefully.
- [ ] **10. Session Persistence**: Completely close (swipe away) LostMate AI from the Android recent apps switcher. Reopen the app: **verify you remain logged in and open directly into the Chat screen without returning to the sign-in screen**.
- [ ] **11. Compact Tab Bar**: On native Android, verify the bottom navigation bar (Chat, Reports, Alerts, Profile) is visible, with safe-area spacing and tap targets >= 44px.
