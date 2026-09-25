# SEC-004 — Remove the fixed MFA/OTP bypass

**Severity:** Critical  
**OWASP:** Authentication Cheat Sheet, ASVS V2

## Problem

`accounts/account.service.js:84` accepts a fixed code for accounts matching
special email patterns. This creates a bypass and exposes differential behavior.

## Acceptance criteria

- Delete the bypass and all pattern-based authentication exceptions.
- Ensure MFA codes are unique, short-lived, one-time, rate-limited, and bound to the intended account/authentication transaction.
- Use generic authentication responses and do not reveal bypass/MFA state.
- Add regression tests that reject the historical fixed code for every account.
- Review audit logs for past bypass use after credential rotation.
