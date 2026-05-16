# Termlnk Privacy Policy (Draft for App Store / Play Store submission)

**Last updated:** 2026-05-12 (placeholder — refresh before publishing)

This document is the canonical text for the Termlnk Mobile privacy
policy. Before submission, publish it at
`https://termlnk.io/legal/privacy` and reference that URL from App Store
Connect and Google Play Console.

## Plain-language summary

- Termlnk is an SSH/SFTP terminal client. Your work happens between you
  and the servers you choose to connect to.
- We do not sell, share, or rent your data.
- We do not track you. Termlnk does not contain advertising, analytics,
  or behavioural fingerprinting SDKs.
- When you enable cloud sync, your vault (server entries, credentials,
  AI provider config, MCP server config, skills metadata) is uploaded
  **end-to-end encrypted**. Our servers store and forward ciphertext
  only; they cannot read your data even if compelled to.

## 1. What we collect

| Category | What | When | Why |
|---------|------|------|-----|
| Account identity | Email address; optional display name | Account creation | To let you sign in across devices and recover access. |
| Encrypted vault | Opaque ciphertext blob containing your server list, credentials, and config | Each sync | To synchronise across devices. |
| Device push token | Opaque APNs / FCM / Expo Push token | When you grant notification permission | To deliver collaboration invitations to your phone. |
| Diagnostic logs (local) | Crash backtraces in `~/.local/share/termlnk/logs/` (desktop) or the OS crash report folder (mobile) | On crash | Local only — never uploaded automatically. |

We do **not** collect:

- The contents of your SSH sessions or SFTP transfers.
- Your master password (it derives keys client-side; we only see a
  zero-knowledge SRP6a verifier).
- Plaintext passwords, private keys, or API keys.
- Your contacts, photos, microphone, camera, location, advertising ID,
  or browsing history.

## 2. How encryption works

When you set up sync, Termlnk derives three keys from your master
password using Argon2id and HKDF-SHA256:

- **Auth key** — used as the SRP6a verifier; the server stores the
  hashed form only and never sees the password.
- **Encryption key** — XChaCha20-Poly1305 over every vault entry before
  it leaves your device. Servers see ciphertext.
- **Index key** — HMAC-SHA256 for one-way lookup keys when needed.

The encryption key never leaves your device. If you forget your master
password, your vault is unrecoverable; we cannot help with reset.

## 3. How we use the data

- **Sync**: deliver ciphertext between your authenticated devices.
- **Authentication**: SRP6a verifier check; access / refresh JWTs to
  authorise sync requests.
- **Push notifications**: deliver collaboration invitations to the
  devices you opt in.

We do not use your data for advertising, retargeting, model training,
or any analytics derived from your activity.

## 4. Who can see your data

- **You**, on devices where you have signed in with your master
  password.
- **Anyone you invite** to a collaborative terminal session (path-B of
  the Termlnk architecture). Invitation links contain an ephemeral
  X25519 private key, which is *not* sent to our servers.
- **Termlnk staff**: visibility is limited to ciphertext, metadata
  (email, last-active-at), and audit logs. We never decrypt vault
  contents.

We do not sell your data, share it with advertisers, or transfer it to
data brokers.

## 5. Third parties

- **Hosting**: we currently run termlnk-server on Hetzner Cloud (EU).
  Database (PostgreSQL) and message queue (Redis) are managed by us, in
  the same provider, in the same region.
- **Push delivery**: Apple Push Notification service (APNs), Google
  Firebase Cloud Messaging (FCM), or Expo Push Service. They see the
  device token and the encrypted notification payload only.
- **Email delivery**: SendGrid (for account verification). Only your
  email address transits SendGrid.

When law-enforcement requests are received, we comply with the legal
process applicable to our jurisdiction. Because our servers are
zero-knowledge, the data we can produce is limited to ciphertext +
metadata.

## 6. Self-hosting

If you self-host termlnk-server, you own your data end-to-end. This
policy applies only to the managed termlnk.io service.

## 7. Children

Termlnk is a developer tool. It is not directed at children under 13;
we do not knowingly collect personal information from them.

## 8. Data retention and deletion

- Account: kept while active. You can delete it at
  `https://termlnk.io/account/delete` — the deletion cascades to all
  sync data, refresh tokens, and push tokens.
- Encrypted vault: kept until you delete the account or revoke devices.
- Push tokens: deleted when you sign out of the device or revoke the
  notification permission.

## 9. Your rights (GDPR / CCPA)

- Access, rectification, deletion of your data via the account settings
  page on https://termlnk.io.
- Data portability: export your vault from any desktop client (the
  ciphertext is yours — you hold the only decryption key).
- Object / restrict: email privacy@termlnk.io.

## 10. Changes to this policy

Material changes are announced in-app at least 30 days before they
take effect. Routine clarifications take effect immediately.

## 11. Contact

privacy@termlnk.io — please include the device platform and the
Termlnk version (visible in Settings) when reporting an issue.
