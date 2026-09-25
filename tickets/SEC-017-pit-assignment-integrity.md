# SEC-017 — Make PIT assignment writes atomic and observable

**Severity:** Medium  
**OWASP:** ASVS V4/V5 integrity controls

## Problem

PIT-user assignment uses asynchronous `forEach`, does not await all writes,
swallows errors, and has no transaction (`clients/pitusers.service.js:35`, `:59`).

## Acceptance criteria

- Replace asynchronous `forEach` with awaited, bounded operations.
- Perform related assignment/revocation writes in a database transaction.
- Validate every target PIT/user authorization before mutation.
- Return a deterministic success/failure result and do not swallow write errors.
- Add rollback, partial-failure, concurrent-update, and audit-event tests.
