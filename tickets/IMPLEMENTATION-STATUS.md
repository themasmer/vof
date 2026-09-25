# Security ticket implementation status — 2026-09-25

The tickets were executed in priority order. No provider credential was rotated
from this workspace; the required external action is recorded in
`docs/security-operations-required.md`.

| Ticket | Status | Result |
| --- | --- | --- |
| SEC-001 | Implemented | Reset/verification links use the trusted configured client URL only. |
| SEC-002 | Code complete; external action required | Committed values/private key were removed and environment-only secret loading added. Provider rotation, history/image purge, and deployed-session invalidation remain operational actions. |
| SEC-003 | Implemented | Standard JWT expiry/issuer/audience, active-session enforcement, hashed refresh tokens, rotation, and revocation on logout/reset/deactivation are in place. |
| SEC-004 | Implemented | Removed the fixed OTP/test-account bypass. |
| SEC-005 | Implemented | Reachable account/PIT list and assignment paths no longer interpolate SQL; legacy raw-SQL helpers are no longer exported. |
| SEC-006 | Implemented | Exact CORS allowlist, hardened production cookie names/attributes, signed CSRF tokens, origin/Fetch-Metadata validation, and CSRF tests added. |
| SEC-007 | Implemented | Jitsi tokens are member-scoped to one active PIT, have no lobby bypass, and expire after 15 minutes. |
| SEC-008 | Implemented baseline | Generic auth responses, atomic counters, and per-account/source in-memory throttling added. Production should supply a shared rate-limit store and monitoring integration. |
| SEC-009 | Implemented with documented exception | Removed unused vulnerable runtime packages and updated direct dependencies. Production audit fell from 46 findings to 2 moderate Sequelize-transitive UUID findings; the only offered remediation is an unsafe downgrade to Sequelize 3, so it was not applied. |
| SEC-010 | Implemented | 12-character policy, adaptive bcrypt cost increase, common-password blocklist, and production k-anonymity breached-password check added. |
| SEC-011 | Implemented baseline | Multi-stage, non-root, lockfile-based container build and restrictive context added. Pin the selected Node image by digest in the deployment system before release. |
| SEC-012 | Implemented | Users can retrieve only their own PIT memberships; administrators retain cross-user access. |
| SEC-013 | Implemented | Reset/verification/OTP/refresh values are protected, bounded, expired, single-use, and not serialized in account responses. |
| SEC-014 | Implemented | Generic 500 errors and a security-header/HSTS policy added. |
| SEC-015 | Implemented | Removed database-password logging; audit logger uses trusted proxy configuration and critical flows await persistence. |
| SEC-016 | Implemented baseline | Unknown request fields are rejected, key route schemas were tightened, and email-template variables are escaped. |
| SEC-017 | Implemented | PIT assignments are transactional, awaited, validated, and failure-visible. |
| SEC-018 | Implemented | Diagnostic routes were removed and the legacy CRUD server refuses production startup; it is excluded from the production image. |
| SEC-019 | Implemented | Environment configuration is typed/fail-fast in production, an environment template exists, tests are runnable, and uncaught exceptions terminate the process. |

## Verification

- `npm test` passes.
- Syntax checks pass for application, middleware, helper, client, account, and security-test JavaScript files.
- `npm audit --omit=dev` reports two moderate vulnerabilities, both from Sequelize's bundled transitive UUID. The audit tool recommends a breaking downgrade to Sequelize 3.30.0; that recommendation was rejected as unsafe.
