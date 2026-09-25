# SEC-015 — Protect logs and audit integrity

**Severity:** Medium  
**OWASP:** Logging Cheat Sheet, ASVS V7

## Problem

The startup path logs the database password (`_helpers/db.js:18`). Audit logging
trusts a client-controllable `X-Real-IP` and may not be awaited.

## Acceptance criteria

- Remove secrets, tokens, passwords, authorization headers, and sensitive PII from all logs.
- Redact centrally and test redaction paths.
- Trust forwarded client IP headers only from configured reverse proxies; otherwise use the transport peer address.
- Make audit-event persistence reliable, ordered where required, and failure-visible without blocking unsafe continuation.
- Record actor, action, target, outcome, and trusted request context; make records tamper-evident or centrally protected.
