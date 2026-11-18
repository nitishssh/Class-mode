# Release and distribution

Class Mode ships Android first. The preview profile produces an installable APK for the pilot;
the production profile produces an AAB for Google Play internal testing. iOS remains covered by
the bundle check until the pilot proves enough demand to justify TestFlight.

EAS Build and EAS Submit use Expo-hosted services. Builds can consume plan minutes, and store
submission requires the relevant paid developer account.

## Build profiles

| Profile | Artifact | Distribution | Update channel | Purpose |
| --- | --- | --- | --- | --- |
| `development` | Development client | Internal | None | Physical-device debugging, including push |
| `preview` | Android APK | Internal URL | `preview` | Production-like pilot QA without Play Console |
| `production` | Android AAB / iOS archive | Store | `production` | Play internal track, later TestFlight |

All non-development builds use `https://classmode.inmodel.in` unless
`EXPO_PUBLIC_API_URL` is explicitly set while bundling.

## One-time EAS link

This repository is not linked to an Expo account yet. Do this once with the Expo account that
will own Class Mode:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest update:configure
```

Commit the resulting `extra.eas.projectId`, `updates.url`, and any EAS CLI changes. The project
ID is public configuration, not a secret. Do not invent or copy a project ID from another app.

`eas update:configure` must retain the `fingerprint` runtime policy and the `preview` and
`production` channels already defined in `eas.json`.

## Preflight

The server must be deployed before a mobile build that consumes a new API contract.

```bash
curl --fail https://classmode.inmodel.in/api/health
npm ci
npm run release:check
npx eas-cli@latest config --platform android --profile preview
npx eas-cli@latest config --platform android --profile production
```

Also verify that `Constants.expoConfig.extra.eas.projectId` is present in the public Expo config;
push registration intentionally returns an unavailable state without it.

## Android pilot

Start with a direct, production-like APK:

```bash
npm run build:android:preview
```

Install the EAS internal-distribution URL on one physical Android device. Test login, biometric
unlock, attendance offline/reconnect, parent child claim, fee details, notification permission,
and receipt of an absence push. Record the EAS build ID, git commit, device model, Android version,
tester, and result in the release evidence table below.

For Play internal testing:

```bash
npm run build:android:production
```

The first AAB must be uploaded manually after the Play Console app is created. Later uploads can
use `npm run submit:android:internal` after a least-privilege Play service account is configured.
Keep its JSON key outside git; matching key names are ignored by `.gitignore`.

The Play release remains a draft so the release owner can review declarations and tester access
before publishing it to the internal track.

## OTA policy

EAS Update is allowed only when every changed file is JavaScript/TypeScript, styling, or a bundled
asset and the update passes `npm run release:check`. A change to Expo SDK packages, config plugins,
permissions, `app.json` native fields, or any other native dependency requires a new store build.

Publish to preview first:

```bash
npm run update:preview -- --message "Describe the tested fix"
```

After the preview APK has applied the update and the affected flow passes on a physical device:

```bash
npm run update:production -- --message "Describe the approved fix"
```

Rollback by republishing the last known-good commit to the same channel. Never use an update to
cross a runtime fingerprint or to compensate for an incompatible server contract.

## Release evidence

| Gate | Evidence | Owner | Status |
| --- | --- | --- | --- |
| Release checks | `npm run release:check` passed locally 2026-07-10 at 35b0de5 (drift, expo doctor deps, lint, tests, tsc, dual-platform export). Evidence goes stale as the branch moves — re-run at the final release-candidate commit before building. | Engineer | Passed |
| Preview APK installed | EAS build ID + device | Pilot lead | Pending |
| Real-device push received | Timestamp + notification screenshot | Pilot lead | Pending |
| Play declarations reviewed | Play Console review | Release owner | Pending |
| Play internal install | Tester + installed version | Pilot lead | Pending |
| Rollback route rehearsed | Known-good update/build ID | Engineer | Pending |

Do not call T9 complete until a named pilot tester installs the Play internal build. Repository
configuration alone is not distribution evidence.

## Store artifacts

- Listing copy: `store/google-play/listing.md`
- Data safety and minors checklist: `store/google-play/data-safety.md`
- Screenshot capture requirements: `store/google-play/screenshots/README.md`
- Public privacy policy: `https://classmode.inmodel.in/privacy`
