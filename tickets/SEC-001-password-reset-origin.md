# SEC-001 — Remove attacker control of password-reset URLs

**Severity:** Critical  
**OWASP:** Forgot Password, ASVS V2/V3

## Problem

Password-reset links are built from the request `Origin` header in
`accounts/account.service.js:467` and `:1048`. An attacker can request a reset
for a victim while supplying an attacker-controlled origin, causing the valid
token to be delivered in a link to the attacker’s site.

## Acceptance criteria

- Use an environment-specific, HTTPS application base URL from validated configuration; never construct security links from `Origin` or `Host`.
- Reject startup when the base URL is absent, malformed, or non-HTTPS outside local development.
- Send generic reset responses and avoid logging raw tokens.
- Add tests proving hostile Origin/Host headers cannot change the email link.
- Coordinate with SEC-003 and SEC-013 so reset completion invalidates old access.
