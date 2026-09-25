# SEC-005 — Replace dynamic SQL with safe queries

**Severity:** High  
**OWASP:** SQL Injection Prevention, ASVS V5

## Problem

String-built SQL is present in account listing, PIT listing, and PIT-user
assignment (`accounts/account.service.js:550`, `clients/client.service.js:89`,
`clients/pitusers.service.js:84`).

## Acceptance criteria

- Replace every dynamic value with ORM/query-builder APIs or bound parameters.
- Use explicit allowlists for sort columns/directions and pagination inputs.
- Remove or quarantine disabled raw-SQL helper paths too.
- Add tests containing quote, comment, boolean, and identifier injection payloads.
- Review database account permissions and grant only application-required access.
