# SEC-006 — Enforce strict CORS, hardened cookies, and CSRF protection

**Severity:** High  
**OWASP:** CSRF Prevention Cheat Sheet, ASVS V3/V9

## Problem

The application permits arbitrary credentialed CORS origins and has no CSRF
control for the refresh-cookie surface. Refresh-cookie attributes are not an
explicit secure policy.

## Acceptance criteria

- Configure an exact per-environment CORS origin allowlist; never reflect arbitrary origins when credentials are enabled.
- Use a host-only, `Secure`, `HttpOnly`, explicit `SameSite`, `Path=/` refresh cookie; use `__Host-` naming where deployment allows.
- Require a session-bound signed double-submit CSRF token in `X-CSRF-Token` for refresh/logout and all cookie-authenticated unsafe operations.
- Verify Origin/Referer and apply `Sec-Fetch-Site` policy as defence in depth.
- Test valid, missing, forged, stale, and cross-origin CSRF requests.
- Document same-site/cross-site frontend integration requirements.
