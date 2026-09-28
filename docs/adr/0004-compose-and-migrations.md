# ADR 0004 — Same-origin web/API and startup migrations

**Status:** Accepted
**Date:** 2026-09-28

## Context

The initial Compose file referenced placeholder images. Browser requests to localhost:3001 failed on other devices, and PostgreSQL init scripts could not upgrade existing volumes.

## Decision

- The web container serves the SPA and proxies /api/ to Fastify on the internal Docker network. Only the web port is published. Vite provides the corresponding development proxy.
- Standard Compose builds the application. The old dev filename includes it for compatibility (Compose 2.20+); it is not a hot-reload stack.
- A one-shot migration service runs the versioned Drizzle journal before API startup. PostgreSQL advisory locking on a single connection serializes migration runners.
- The first migration retains the original idempotent CREATE IF NOT EXISTS statements, adding only Drizzle statement separators. It can adopt the known original two-table init-SQL database without deleting existing records. The snapshot uses the original constraint names.
- API readiness verifies access to both required tables, separately from process liveness.
- Pin pnpm and commit its lockfile; container installs use frozen-lockfile.
- PGlite runs local database integration tests; CI also verifies real PostgreSQL 17, nginx, browser flows, recreation and legacy upgrade via Docker Compose.

## Consequences

No browser-specific API hostname or CORS setup is necessary for Compose/LAN usage. Future SQL changes must be new migrations with committed metadata, never edits to previously applied migrations. The initial adoption is only for the known original schema, not arbitrary manually modified schemas.

Keep the existing Compose project name when upgrading so named volumes are reused. Back up before upgrading. Changing database credentials in .env does not change credentials already stored in a volume. Authentication is not yet implemented; use a private test environment.
