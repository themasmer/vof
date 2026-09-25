# OWASP gap and conflict register — 2026-09-25

This register maps the assessment to OWASP guidance.  “Missing” means a required
control is absent or materially incomplete.  “Conflict” means code/comments or
configuration disagree with the security property the guidance requires.

| Area | Status | Gap or conflict | Remediation ticket |
| --- | --- | --- | --- |
| ASVS V2 authentication | Missing | MFA bypass, weak password minimum, no safe login throttling, enumeration, and incomplete session revocation. | SEC-003, SEC-004, SEC-008, SEC-010 |
| ASVS V3 session management | Missing | Refresh cookie is not explicitly hardened; logout/reset/deactivation do not invalidate all credentials. | SEC-003, SEC-006, SEC-013 |
| ASVS V4 access control | Missing | PIT membership IDOR and global Jitsi room authorization violate least privilege. | SEC-007, SEC-012 |
| ASVS V5 validation/injection | Missing | SQL interpolation, permissive validation, and unsafe HTML-template data paths. | SEC-005, SEC-016 |
| ASVS V7 error handling/logging | Missing | Internal errors are disclosed; secrets are logged; audit data is spoofable/unreliable. | SEC-014, SEC-015 |
| ASVS V8 data protection | Missing | Credentials/private keys are committed; lifecycle tokens are stored plaintext. | SEC-002, SEC-013 |
| ASVS V9 communications | Missing | No demonstrated TLS/HSTS security-header policy; arbitrary credentialed CORS. | SEC-006, SEC-014 |
| OWASP CSRF Cheat Sheet | Missing | No signed CSRF token, origin validation, Fetch Metadata policy, or strict credentialed CORS allowlist. | SEC-006 |
| OWASP Forgot Password | Conflict | The reset URL trusts a request-supplied origin, whereas guidance requires a trusted configured URL; reset does not revoke active sessions. | SEC-001, SEC-003, SEC-013 |
| OWASP Authentication Cheat Sheet | Conflict | Code comments express enumeration protection, but distinct errors leak account state; password policy and lockout implementation conflict with guidance. | SEC-008, SEC-010 |
| OWASP Secrets Management | Missing | Secrets reside in source/config/image context and no rotation/history-removal procedure is present. | SEC-002, SEC-011 |
| OWASP SQL Injection Prevention | Missing | Dynamic string SQL is used where bound parameters/query builders are required. | SEC-005 |
| OWASP Docker Security | Missing | Docker build copies sensitive files, installs unreproducibly, and runs the service as root. | SEC-011 |

## Explicit configuration conflicts to resolve

- Authentication comments indicate anti-enumeration intent, but reset/login
  paths return account-specific outcomes.
- A comment/setting describes seven-day refresh-cookie lifetime while the stored
  refresh-token configuration is eight hours; define one authoritative session
  policy and enforce it server-side.
- Role values and validation schemas must use one representation and a single
  authorization policy, rather than accepting incompatible numeric/string forms.
- QA and production configuration omit authentication sections that exist in
  other environments; fail startup when required security settings are absent.

## Verification baseline

Adopt OWASP ASVS as the release checklist, beginning with Level 2 requirements
for authentication, session management, access control, validation, error
handling, and data protection.  Each ticket contains concrete acceptance
criteria; add automated regression coverage before closing it.

## Sources

- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
