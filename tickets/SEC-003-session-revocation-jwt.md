# SEC-003 — Make session revocation authoritative

**Severity:** Critical  
**OWASP:** ASVS V2/V3

## Problem

Logout, password reset, and account deactivation do not consistently revoke
refresh credentials or active JWT access. Authorization can accept an empty
matching session hash and does not consistently require an active account. JWT
uses a custom `expires` property instead of standard `exp`.

## Acceptance criteria

- Use standard JWT `iat`, `exp`, issuer, audience, and key-rotation claims.
- Require active account state and a non-empty, current session identifier for every authenticated request.
- Revoke all refresh sessions and invalidate access on logout-all, reset, deactivation, credential rotation, and suspected compromise.
- Rotate refresh tokens on use; store only protected token verifiers.
- Reconcile cookie and server-side token expiry to one documented policy.
- Add tests for logout, reset, deactivate, expired JWT, stale refresh, and post-rotation requests.
