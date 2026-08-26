// Download targets for the Class Mode mobile app, surfaced on /app.
//
// None of these are hard-coded: the Android APK lives behind an EAS
// internal-distribution URL that changes per build, and the store listings do
// not exist until the Play/App Store releases are published. Each link is
// supplied at build time and the page renders an honest "not yet available"
// state for whichever ones are unset — never a dead store badge.

export type AppPlatform = "android" | "ios" | "web";

export interface AppDownload {
  /** Where the download actually goes. `null` means "not published yet". */
  href: string | null;
  /** Shown on the button when `href` is set. */
  cta: string;
  /** Shown instead of the button when `href` is null. */
  pending: string;
}

const env = import.meta.env;

/** Play Store listing, else the direct APK from the EAS internal build. */
const androidHref = env.VITE_PLAY_STORE_URL || env.VITE_ANDROID_APK_URL || null;

export const androidDownload: AppDownload = {
  href: androidHref,
  cta: env.VITE_PLAY_STORE_URL ? "Get it on Google Play" : "Download the APK",
  pending:
    "Android builds are going out to pilot schools first. Ask your school for the install link, or use the web app below.",
};

export const iosDownload: AppDownload = {
  href: env.VITE_IOS_APP_STORE_URL || env.VITE_IOS_TESTFLIGHT_URL || null,
  cta: env.VITE_IOS_APP_STORE_URL ? "Download on the App Store" : "Join the TestFlight beta",
  pending:
    "The iPhone build is not out yet — Android ships first. The web app works on iPhone today.",
};

export const webApp: AppDownload = {
  href: "/login",
  cta: "Open the web app",
  pending: "",
};

/** Best guess at the visitor's platform, used only to reorder/highlight cards. */
export const detectPlatform = (): AppPlatform => {
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  // iPadOS 13+ reports a desktop UA, so check for touch as well.
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  return "web";
};
