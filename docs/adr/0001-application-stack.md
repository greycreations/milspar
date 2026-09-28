# ADR 0001 — Application stack

**Status:** Accepted  
**Date:** 2026-09-28

## Context

Milspår behöver en modern responsiv webbapp, ett tydligt domän-API, bra stöd för filuppladdning/bakgrundsarbete och en stack som är lätt att utveckla och köra med Docker Compose. Projektet är TypeScript-vänligt och bör minimera onödig teknikspridning.

## Decision

Vi använder en TypeScript-baserad monorepo-stack:

- **Web:** React + Vite + TypeScript
- **API:** Node.js + Fastify + TypeScript
- **Database:** PostgreSQL
- **ORM/migrations:** Drizzle ORM + drizzle-kit
- **Validation/contracts:** Zod
- **Package manager:** pnpm
- **Workspace:** pnpm workspaces
- **Testing:** Vitest för unit/integration; Playwright för kritiska browserflöden

UI byggs med egna Milspår-komponenter/design tokens. En headless komponentgrund får användas selektivt för accessibility/primitives, men får inte introducera en konkurrerande grafisk profil.

## Rationale

React/Vite ger ett enkelt client-first gränssnitt för en självhostad app utan krav på SSR. Fastify är lättviktigt, snabbt och passar ett explicit API. En gemensam TypeScript-stack gör det möjligt att dela scheman/typer utan att koppla frontend till databasen. Drizzle håller SQL/datamodell synlig och migrationsstyrd.

## Consequences

- Web och API deployas som separata containers.
- Delade kontrakt kan ligga i `packages/contracts`.
- Server-only databasmodell får inte importeras i web.
- Ingen Next.js/server components-arkitektur behövs i baseline.
- Frameworkval kan omprövas endast genom ny ADR.
