# SEC-008 — Add safe authentication abuse controls

**Severity:** High  
**OWASP:** Authentication Cheat Sheet, ASVS V2

## Problem

Login/reset endpoints lack rate limiting. Five failed passwords can permanently
deactivate an account, counters are non-atomic, and account-specific errors
support enumeration.

## Acceptance criteria

- Apply layered per-account and per-source rate limits to login, reset, MFA, refresh, and verification flows.
- Replace permanent automatic deactivation with a time-bounded, recoverable lockout and monitored abuse workflow.
- Make counter updates atomic and reset them only on verified successful login.
- Return uniform public messages and timing for unknown/existing accounts.
- Add alerting for distributed guessing and reset abuse; add regression tests.
