# Chawla Plywood — Offline Billing PWA

Fully offline-first billing app. All data is stored locally in the browser via IndexedDB (Dexie). No backend, no cloud, no accounts.

## Features
- PIN login (default `0000`, change in Settings). Auto-locks after 5 min.
- Dashboard with today's sales, pending dues, and last 7 days chart.
- Customers (CRUD, CSV/VCF export, CSV import).
- Products (image gallery + camera capture).
- Bills (auto bill numbers per year, customer/product autocomplete, PDF + print).
- **Snap-to-Bill** — point your camera, on-device MobileNet v2 matches products from a live feed.
- Reports (date range, charts, PDF/CSV export).
- Backup / Restore (single JSON file).
- Dark mode, offline indicator, mobile bottom nav + desktop sidebar.

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173 (or whatever port is shown). On first launch, enter PIN `0000`.

## Build the web app

```bash
npm run build
```

Static output goes to `dist/`. The app is fully usable offline once loaded once.

## Build the Android APK

### Option 1: GitHub Actions (recommended)
Push to `main`. The workflow at `.github/workflows/build.yml` runs:
1. `npm install && npm run build`
2. `npx cap add android` (first time only)
3. `npx cap sync android`
4. `./gradlew assembleRelease`

Download the APK from the workflow's "Artifacts" section.

### Option 2: Local (Android Studio)

Prereqs: JDK 17, Android Studio (with SDK 34+), Node 20+.

```bash
npm install
npm run build
npx cap add android      # first time only
npx cap sync android
npx cap open android     # opens Android Studio
```

In Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

### Signed APK / Play Store

1. Generate a keystore:
   ```bash
   keytool -genkey -v -keystore chawla-release.keystore \
     -alias chawla -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Add to `android/app/build.gradle`:
   ```gradle
   android {
     signingConfigs {
       release {
         storeFile file("../../chawla-release.keystore")
         storePassword "YOUR_PASSWORD"
         keyAlias "chawla"
         keyPassword "YOUR_PASSWORD"
       }
     }
     buildTypes {
       release { signingConfig signingConfigs.release }
     }
   }
   ```
3. `cd android && ./gradlew assembleRelease`
4. Signed APK is at `android/app/build/outputs/apk/release/app-release.apk`.

## Permissions used (AndroidManifest.xml — added by Capacitor plugins)
- CAMERA — product capture + Snap-to-Bill
- READ/WRITE_EXTERNAL_STORAGE — backup + share
- INTERNET — only used to load the bundled JS on first install (the app works without network thereafter)
- VIBRATE — haptic feedback on snap

## Data
Everything is stored in IndexedDB on the device. Use **Settings → Backup** regularly and copy the JSON file off-device. Restoring overwrites all current data on the device.

## Tech
React 19 · TanStack Router · Vite · Tailwind v4 · Dexie · TanStack Query · TensorFlow.js + MobileNet v2 · jsPDF · Recharts · Framer Motion · Capacitor 8.
