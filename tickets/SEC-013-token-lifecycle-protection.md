# SEC-013 — Protect lifecycle tokens end to end

**Severity:** Medium  
**OWASP:** ASVS V2/V3/V8

## Problem

Verification/reset/refresh/OTP tokens are exposed or stored with an incomplete
lifecycle. `basicDetails()` returns `verificationToken`; verification has no
expiry; reset randomness is only 10 bytes; server storage is plaintext.

## Acceptance criteria

- Never serialize verification, reset, refresh, or OTP token values in account/API responses.
- Generate tokens with a cryptographically secure generator and sufficient entropy (at least 128 bits for bearer reset/refresh tokens).
- Store only a keyed hash/verifier; use constant-time verification where applicable.
- Apply explicit expiry, one-time use, purpose, account, and session binding.
- Expire/revoke tokens on password change, reset, account deactivation, and rotation.
- Add token-replay, expiry, response-serialization, and storage tests.
