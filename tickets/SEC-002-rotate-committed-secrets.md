# SEC-002 — Rotate and remove committed credentials and keys

**Severity:** Critical  
**OWASP:** Secrets Management, ASVS V8

## Problem

The repository includes JWT/signing material, SMTP/Twilio credentials, a private
key, and hard-coded service secrets in configuration/source files including
`config-*.json`, `jwk-meta.json`, `_helpers/send-sms.js`, and
`accounts/account.service.js`.

## Acceptance criteria

- Inventory every exposed credential/key and rotate it with each provider.
- Revoke existing JWT/key material and invalidate sessions as appropriate.
- Remove secrets from current files and repository history using an approved history-rewrite/rotation runbook; do not merely delete current copies.
- Load secrets from the deployment secret manager or injected environment only.
- Add secret scanning to pre-commit/CI and a build check preventing secret files from entering images.
- Record rotation completion without recording secret values.
