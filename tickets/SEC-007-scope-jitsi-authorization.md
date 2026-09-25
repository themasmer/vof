# SEC-007 — Scope Jitsi tokens to authorized rooms

**Severity:** High  
**OWASP:** ASVS V4

## Problem

Jitsi token generation grants `room: "*"` and `lobby_bypass: "true"` in
`accounts/account.service.js:1113`, allowing broad conference access.

## Acceptance criteria

- Resolve the requested room to an application resource and authorize membership before issuing a token.
- Issue one-room, short-lived tokens with the minimum role/feature claims.
- Remove unconditional lobby bypass; permit it only when a documented policy authorizes it.
- Audit issuance with actor, target resource, and outcome (no tokens in logs).
- Add cross-tenant, wrong-room, expired-token, and privilege tests.
