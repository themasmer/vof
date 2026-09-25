# SEC-019 — Enforce configuration parity and a security-test baseline

**Severity:** Low  
**OWASP:** ASVS V1 verification requirements

## Problem

QA/production configuration omits authentication sections present elsewhere,
including OTP, session, and password-reset settings. The project has no `npm`
test script and lacks regression tests for key security boundaries. The process
also logs `uncaughtException` and continues.

## Acceptance criteria

- Define a typed configuration schema with secure defaults and fail-fast startup for missing or invalid security settings.
- Keep dev/QA/production configuration keys consistent while allowing only values to differ.
- Add a documented `npm test` command and CI coverage for all SEC tickets' acceptance tests.
- Treat uncaught exceptions as fatal after controlled logging/cleanup; use monitored restart policy.
- Add a release security checklist based on the OWASP gap register.
