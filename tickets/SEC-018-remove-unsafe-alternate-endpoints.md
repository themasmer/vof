# SEC-018 — Remove or lock down alternate and diagnostic endpoints

**Severity:** Medium  
**OWASP:** ASVS V1/V4/V14

## Problem

`src/index.js:12` exposes an alternative CRUD server that could be deployed
without application authentication. Public diagnostic and dead endpoints also
remain, including an IP-revealing authenticate route and a broken password-hash
route.

## Acceptance criteria

- Remove the alternate server from production artifacts, or place it behind the same authentication/authorization and deployment controls as the primary API.
- Remove or restrict diagnostic, debugging, and obsolete routes; return 404 rather than detailed behavior.
- Inventory all bound listeners and production entry points in CI/deployment manifests.
- Add route-level authorization tests and a production build test confirming only approved entry points exist.
