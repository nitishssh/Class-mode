/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
  /** Play Store listing for the mobile app. Unset until the Play release is public. */
  readonly VITE_PLAY_STORE_URL?: string;
  /** Direct APK URL from the EAS internal-distribution build, used before Play. */
  readonly VITE_ANDROID_APK_URL?: string;
  /** App Store listing. Unset until the iOS release is public. */
  readonly VITE_IOS_APP_STORE_URL?: string;
  /** Public TestFlight invite link, used before the App Store release. */
  readonly VITE_IOS_TESTFLIGHT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
