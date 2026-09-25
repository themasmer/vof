# Security assessment — 2026-09-25

## Scope and method

This assessment reviewed the Node/Express application source, configuration files,
container build files, and production dependency tree. It was a source and
configuration review, not a penetration test. The implementation follow-up is
tracked in `tickets/IMPLEMENTATION-STATUS.md`.

## Executive summary

The application has several paths to account takeover or privilege abuse.  The
most urgent are an attacker-controlled password-reset origin, committed secrets
and private keys, incomplete session revocation, a hard-coded MFA bypass, and
SQL injection in administrative functions.  The application also lacks an
appropriate CSRF boundary for credentialed cookies and permits arbitrary
credentialed CORS origins.

Resolve tickets in the order in `tickets/README.md`.  Credentials must be
rotated before relying on any source-control cleanup.

## Findings

| ID | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| SEC-001 | Critical | Password-reset URL uses a caller-controlled `Origin`, enabling reset-link theft/account takeover. | `accounts/account.service.js:467`, `accounts/account.service.js:1048` |
| SEC-002 | Critical | Secrets, SMTP/Twilio credentials, JWT material, and a private key are committed. | `config-stock.json:22`, `config-aws-qa.json:9`, `config-aws-prod.json:9`, `jwk-meta.json:2`, `_helpers/send-sms.js:4`, `accounts/account.service.js:12` |
| SEC-003 | Critical | Logout, deactivation, and password reset do not reliably revoke all active access; JWT expiry is non-standard. | `accounts/account.service.js:341`, `:364`, `:519`, `:949`; `_middleware/authorize.js:48` |
| SEC-004 | Critical | A fixed MFA/OTP code is enabled for email-pattern matches. | `accounts/account.service.js:84` |
| SEC-005 | High | Administrative listing and PIT assignment use string-built SQL. | `accounts/account.service.js:550`, `clients/client.service.js:89`, `clients/pitusers.service.js:84` |
| SEC-006 | High | Any origin can make credentialed cross-origin requests; no CSRF protection/hardened refresh-cookie policy exists. | `app.js:15`, `accounts/accounts.controller.js:467` |
| SEC-007 | High | Jitsi tokens authorize every room and bypass the lobby. | `accounts/account.service.js:1113` |
| SEC-008 | High | Authentication endpoints are unthrottled; failed attempts can permanently deactivate an account; errors enumerate accounts. | `accounts/account.service.js:64` |
| SEC-009 | High | Production npm dependency tree has 46 vulnerable packages, including 6 critical and 23 high. | `package-lock.json`; audit evidence in `docs/npm-vulnerability-exploit-review-2026-09-25.md` |
| SEC-010 | High | Password policy permits four-character passwords. | `accounts/accounts.controller.js:216`, `:231` |
| SEC-011 | High | Container build copies secrets, uses an unpinned base/install, and runs as root. | `Dockerfile:1`, `.dockerignore` |
| SEC-012 | Medium | A regular user can retrieve another user's PIT memberships (IDOR). | `clients/pitusers.controller.js:12`, `clients/pitusers.service.js:114` |
| SEC-013 | Medium | Verification/reset/refresh/OTP tokens lack a robust lifecycle: exposed token field, no verification expiry, plaintext storage, and short random reset tokens. | `accounts/account.service.js:966`, `:970` |
| SEC-014 | Medium | Detailed internal errors can be returned; security response headers are absent. | `_middleware/error-handler.js:13`, `app.js` |
| SEC-015 | Medium | Database password is logged; audit IP is client-spoofable and logging is not reliably awaited. | `_helpers/db.js:18`, `_middleware/audit-log.js:13` |
| SEC-016 | Medium | Request validation is permissive/incomplete and template data can reach email HTML unsafely. | controller validation schemas and email templates |
| SEC-017 | Medium | PIT-user writes use asynchronous `forEach`, swallow failures, and have no transaction. | `clients/pitusers.service.js:35`, `:59` |
| SEC-018 | Medium | An alternate CRUD server can be deployed without authentication; diagnostic/dead public endpoints remain. | `src/index.js:12`, account routes |
| SEC-019 | Low | Environment configuration is inconsistent and lacks authentication settings in QA/production; tests do not cover security boundaries. | `config-aws-qa.json`, `config-aws-prod.json`, `package.json` |

## CSRF implementation boundary

CSRF protection must be deployed with a strict CORS policy rather than as a
standalone middleware change.  The desired design is:

1. Allow credentialed CORS only for an explicit, environment-specific origin
   allowlist.  Never reflect arbitrary origins.
2. Build security-sensitive links from a trusted application base URL in
   configuration, never `Origin` or `Host` request headers.
3. Replace the refresh cookie with a `Secure`, `HttpOnly`, explicit `SameSite`,
   `Path=/`, host-only cookie (prefer a `__Host-` name where deployment permits).
4. Issue a session-bound, signed double-submit CSRF token and require it in an
   `X-CSRF-Token` header for refresh/logout and every cookie-authenticated unsafe
   route.  Do not use the bare double-submit-cookie pattern.
5. On unsafe browser requests, validate `Origin` (or `Referer` as a fallback)
   and use Fetch Metadata (`Sec-Fetch-Site`) as defence in depth.
6. Add tests for missing, invalid, cross-origin, stale, and valid CSRF tokens.

Bearer-header-only API calls are not, by themselves, cookie-CSRF exposures. The
refresh endpoint and any route that accepts the browser credential cookie are in
scope immediately.

## Required operational response

1. Revoke/rotate exposed secrets and invalidate deployed JWT/signing material.
2. Disable the OTP bypass and password-reset flow until SEC-001 through SEC-004
   are remediated and tested.
3. Restrict administration access while SQL injection fixes are developed.
4. Rebuild and redeploy only from a clean, secret-free image after SEC-011.

## Implementation update

The source-level controls described by SEC-001 through SEC-019 were implemented
on 2026-09-25. Credential rotation, history/image purging, distributed
rate-limiting/monitoring, base-image digest selection, and deployment-session
invalidation require operator access and remain mandatory before release. See
`docs/security-operations-required.md` and `tickets/IMPLEMENTATION-STATUS.md`.

## Reference guidance

- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)
- [Express production security best practices](https://expressjs.com/en/advanced/best-practice-security.html)
