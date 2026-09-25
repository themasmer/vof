# SEC-010 — Strengthen password policy and credential handling

**Severity:** High  
**OWASP:** Authentication Cheat Sheet, ASVS V2

## Problem

Registration and password-change validation accept passwords as short as four
characters (`accounts/accounts.controller.js:216`, `:231`).

## Acceptance criteria

- Require a modern length-based policy (at least 12 characters unless SSO/MFA policy formally justifies a different minimum), allow long passphrases, and reject known-breached passwords.
- Preserve secure hashing with an approved adaptive KDF and calibrated cost.
- Avoid arbitrary composition rules and silently truncating passwords.
- Add validation, breach-check fallback, reset, and migration tests.
- Communicate password-policy changes without exposing account existence.
