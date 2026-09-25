# SEC-009 — Remediate vulnerable production dependencies

**Severity:** High  
**OWASP:** ASVS V1/V14 supply-chain controls

## Problem

The production lockfile has 46 vulnerable packages (6 critical, 23 high, 14
moderate, 3 low) across 114 advisories. `latest@0.2.0 -> npm@2.15.12` is an
obsolete high-risk dependency chain. Details are in
`docs/npm-vulnerability-exploit-review-2026-09-25.md`.

## Acceptance criteria

- Remove `latest` from runtime dependencies and confirm obsolete npm transitive packages are absent.
- Upgrade `body-parser`, `joi`, `mysql2`, and `nodemailer` to supported patched releases; validate each change in tests.
- Review Sequelize advisory scope and select a supported upgrade path; do not accept an automatic downgrade as a remediation.
- Regenerate/commit the lockfile and produce a clean `npm audit --omit=dev`, or document time-bound exceptions with compensating controls and owner.
- Add CI dependency audit/SBOM generation and a recurring KEV/OSV review.
