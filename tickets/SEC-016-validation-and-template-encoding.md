# SEC-016 — Tighten input validation and email-template encoding

**Severity:** Medium  
**OWASP:** Input Validation, XSS Prevention, ASVS V5

## Problem

Validation schemas allow unknown/incomplete data paths, and user-controlled
values can reach HTML email templates without a demonstrated encoding boundary.

## Acceptance criteria

- Apply schema validation to every route with reject-by-default fields, type/length/range/format limits, and normalized canonical input.
- Use explicit allowlists for identifiers, sort fields, and state transitions.
- HTML-escape template variables by default; prohibit unsafe/raw interpolation except reviewed static markup.
- Validate and safely encode URLs used in links and email bodies.
- Add injection, malformed payload, oversized input, and HTML template tests.
