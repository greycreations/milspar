# ADR 0002 — Repository structure

**Status:** Accepted  
**Date:** 2026-09-28

## Context

Web, API och delade kontrakt ska utvecklas tillsammans men deployas separat.

## Decision

Repositoryt organiseras som pnpm workspace:

```text
apps/
  web/                 # React/Vite UI
  api/                 # Fastify API
packages/
  contracts/           # Zod schemas och transporttyper
  ui/                  # Milspår UI primitives/design tokens när återanvändning motiverar paket
  config/              # delad lint/ts config vid behov
docs/
  adr/
  design/
```

Databas/schema/migrations ägs av API:t, initialt under `apps/api/src/db` och `apps/api/drizzle`.

## Rules

- `apps/web` får bero på `packages/contracts` och `packages/ui`, aldrig på API-internals eller DB-schema.
- `apps/api` får bero på contracts men domänlogik ska inte placeras i route handlers.
- `packages/contracts` ska vara transport-/valideringskontrakt, inte en dump av alla interna domäntyper.
- Ett nytt shared package skapas först när faktisk delning finns.

## Consequences

Strukturen är enkel i början men kan växa utan att frontend och backend blir ett enda deploybart block.
