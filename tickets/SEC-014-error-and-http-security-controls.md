# SEC-014 — Remove error disclosure and add HTTP security controls

**Severity:** Medium  
**OWASP:** Error Handling, HTTP Headers Cheat Sheet, ASVS V7/V9

## Problem

The error handler can return internal error details (`_middleware/error-handler.js:13`).
The app does not establish a security-header policy.

## Acceptance criteria

- Return a generic correlation ID/message to clients and retain detailed stack/error context only in protected logs.
- Add and configure Helmet or equivalent headers, including no-sniff, frame protection, referrer policy, and a deliberate CSP.
- Enable HSTS only for HTTPS production endpoints after validating subdomain impact.
- Disable framework fingerprinting and ensure errors are not cached by shared proxies.
- Add response-header and production-error regression tests.
