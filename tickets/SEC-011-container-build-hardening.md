# SEC-011 — Harden the container build and runtime

**Severity:** High  
**OWASP:** Docker Security Cheat Sheet, ASVS V14

## Problem

The Docker build can copy committed secrets into the image, uses a floating base
and `npm install`, and runs the application as root.

## Acceptance criteria

- Use a pinned digest/base image and `npm ci` with the committed lockfile.
- Add a strict `.dockerignore` that excludes configs, keys, `.git`, tests, and other non-runtime artifacts; use multi-stage build where appropriate.
- Inject runtime secrets through the platform secret mechanism, never image layers or build args.
- Run as a dedicated non-root user with read-only/minimal filesystem permissions.
- Add image scanning, SBOM generation, and a CI check that no secret appears in the built image.
