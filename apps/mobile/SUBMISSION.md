# Termlnk Mobile — App Store / Play Store Submission Notes

This document is the source-of-truth checklist for shipping `apps/mobile`
to the iOS App Store and Google Play Store. It pairs with `eas.json`
(build + submit profiles) and `app.json` (manifest). Update both when
this file changes.

## 1. App Identity

| Field | Value |
|------|-------|
| Display name | Termlnk |
| Bundle ID (iOS) | `io.termlnk.app` |
| Application ID (Android) | `io.termlnk.app` |
| Marketing version | tracks `app.json` `expo.version` |
| Build number / version code | auto-incremented by EAS Submit |

## 2. Category & Audience

- Apple primary category: **Developer Tools**. Secondary: **Utilities**.
- Google primary category: **Tools**.
- Age rating: 4+ on Apple, 3+ / Everyone on Google (no UGC, no
  adult content; the SSH terminal renders arbitrary remote shell output
  but Termlnk does not host or moderate it).

## 3. Apple App Review — 2.3.1 / 4.2 (Minimum Functionality)

SSH / terminal clients are reviewed historically as legitimate by
precedents Termius, Blink Shell, Echo, La Terminal. Reviewer enablement:

- **Demo server credentials** (per launch): drop into the field in
  App Store Connect → App Review Information. Keep them rotating from
  the staging vault so review failures do not require shipping new
  credentials in a release. A scratch SSH server with the canned demo
  banner `Welcome — termlnk reviewer host. \n\n run \`ls\` to test.` is
  enough.
- **Demo account**: a free-tier account on `staging.termlnk.io` whose
  vault contains exactly the demo server entry; review explicitly asks
  for sign-in plus terminal use.
- **Notes field** copy:
  > Termlnk is an SSH/SFTP terminal client. To exercise the core flow:
  > 1. Tap "Sign in" with the demo account credentials supplied below.
  > 2. Tap the demo host in the list.
  > 3. Tap "Open terminal" and enter the demo password.
  > 4. Type `ls` in the prompt. Output renders inside an xterm view.

Apple submission profile (`eas.json` → submit.production.ios) refers
secrets via `eas secret`; never check them into git.

## 4. Apple App Review — 4.7 (Apps that Provide Software)

This rule applies because Termlnk executes user-supplied commands on
remote servers. The client itself does not download executable code:

- No JavaScript code download path; the WebView's xterm.js comes from
  the immutable bundle inside the `expo prebuild`-produced binary or
  from CDN with subresource integrity.
- No remote scripting / plug-in system. Skills sync metadata only;
  actual skill execution is desktop-side.

## 5. Apple App Review — 5.1.1 / 5.1.2 (Privacy / Data Use)

- iOS Privacy Manifest (`app.json` → `extra.privacyManifest`, to be
  added before submission): declare data types `Contacts: none`,
  `User Content: none`, `Health & Fitness: none`, `Crash Data: none`.
- Two API uses required to declare:
  - `NSPrivacyAccessedAPICategoryUserDefaults` (expo-secure-store
    occasionally falls back to UserDefaults on edge cases).
  - `NSPrivacyAccessedAPICategoryFileTimestamp` (expo-file-system).
- Tracking: **none**. Termlnk does not use IDFA, does not load any
  third-party analytics SDK, and the cloud sync server only stores
  ciphertext (zero-knowledge).

## 6. Google Play — Data Safety form

| Question | Answer |
|---|---|
| Does the app collect or share user data? | Yes — account email and
  encrypted vault payload are uploaded for sync. |
| Data types | Email (account identifier); App Activity (sync timestamps). |
| Encrypted in transit | Yes — HTTPS / WSS. |
| Encrypted at rest | Yes — server stores ciphertext only (E2EE). |
| Data deletion request | https://termlnk.io/account/delete |

## 7. Privacy Policy

See `PRIVACY_POLICY.md` for the canonical text. Submission forms need a
public URL — host the policy at
`https://termlnk.io/legal/privacy` before pressing submit.

## 8. EAS Build / Submit usage

```sh
# One-time login
eas login

# Native config + secrets
eas project:init
eas secret:create --scope project --name APPLE_APP_SPECIFIC_PASSWORD --value '...'
eas secret:create --scope project --name GOOGLE_SERVICE_ACCOUNT_KEY --type file --value ./google-service-account.json

# Builds
eas build --profile development --platform ios
eas build --profile preview --platform android
eas build --profile production --platform all

# Submission
eas submit --profile production --platform ios   # uploads to App Store Connect
eas submit --profile production --platform android  # uploads to Play Console
```

## 9. Pre-submission smoke checklist

- [ ] Real-device smoke on iOS (physical) and Android (physical or BlueStacks):
  vault pull → host list → SSH terminal connect → back hides the terminal without
  disconnecting → close terminates the SSH connection.
- [ ] EAS prebuild `apps/mobile` succeeds on macOS runners.
- [ ] All EAS secrets present (run `eas secret:list`).
- [ ] Privacy policy live at the public URL.
- [ ] Reviewer demo account exists on staging and contains the demo host.
- [ ] iOS Privacy Manifest declared in `app.json` extra (above).
- [ ] Play Data Safety form answered.
- [ ] Crash reporting / analytics SDKs: still **none** (do not enable Sentry et al. before privacy review).
