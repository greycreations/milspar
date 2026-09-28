# ADR 0003 — File storage and ingest

**Status:** Accepted  
**Date:** 2026-09-28

## Context

Milspår ska hantera original-PDF:er, kvitton och fordonsbilder. Filer måste överleva containeruppdateringar och kunna migreras till annan storage senare.

## Decision

- V1 använder lokal persistent storage monterad i API-container.
- API använder en `StorageProvider`-abstraktion; lokal disk är första implementationen.
- Databasen lagrar metadata/storage keys, inte stora binärer.
- Originalfiler är immutable i normal drift.
- SHA-256 beräknas vid ingest.
- Preview/thumbnail lagras separat från original.
- S3-compatible provider kan införas senare utan ändrad domänmodell.

Ingest-pipeline:

`upload → validate → hash → persist original → metadata extraction → derivatives → domain link`

## Consequences

Backup måste inkludera både PostgreSQL och storage-volymen. Filsystempaths får inte exponeras som publikt API-kontrakt.
