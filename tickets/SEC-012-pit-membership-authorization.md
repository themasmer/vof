# SEC-012 — Enforce PIT membership authorization

**Severity:** Medium  
**OWASP:** ASVS V4 access control

## Problem

Regular users can query another user's PIT memberships through
`clients/pitusers.controller.js:12` and `clients/pitusers.service.js:114`.

## Acceptance criteria

- Define resource ownership and role rules for every PIT membership action.
- Allow a non-privileged user to read only their own membership unless explicit delegated access exists.
- Derive subject identity from the authenticated session, not a caller-supplied user ID.
- Add positive/negative cross-user and cross-tenant authorization tests.
- Log denied access decisions without leaking target details.
