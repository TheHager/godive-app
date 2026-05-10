# GoDive App Store & Play Store Checklist

## 1. PWA vs Native Wrapper
- **Decision:** Since GoDive is a Vite/React web app, choose a wrapper like **Capacitor** or **PWABuilder** (Bubblewrap) to create native binaries. Capacitor is recommended for easiest camera and location integration.

## 2. Icons & Splash Screens
- Generate app icons for iOS and Android in the required sizes (e.g., 1024x1024 base icon).
- Use a tool like `@capacitor/assets` or `cordova-res` to automatically generate all required icon and splash screen dimensions for both platforms.

## 3. Permissions & Metadata
- **Android (`AndroidManifest.xml`):**
  - `<uses-permission android:name="android.permission.INTERNET" />`
  - `<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />` (for dive map locations)
  - `<uses-permission android:name="android.permission.CAMERA" />` (if adding photo uploads)
- **iOS (`Info.plist`):**
  - `NSLocationWhenInUseUsageDescription`: Needs a clear, user-facing reason (e.g., "GoDive uses your location to map dive sites.").
  - `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription`: Required if users can upload photos.

## 4. Security & Environment Variables
- Ensure backend API keys (`GEMINI_API_KEY`) remain securely on the server and are NOT exposed to the client bundle.
- Ensure Firestore Security Rules prevent unauthorized reads/writes to sensitive user data.

## 5. Review Guidelines
- **Apple App Store:** Ensure the app has a standard end-user license agreement (EULA) and a privacy policy linked in the app store metadata. The minimalist UI and features should easily pass Human Interface Guidelines (HIG). Include a report/block feature for user-generated content (e.g. comments/posts) since it's a social app.
- **Google Play Store:** Provide a privacy policy URL and complete the data safety questionnaire detailing what user data is collected and why.
