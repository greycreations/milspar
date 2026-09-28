# Milspår — Architecture Baseline v1.0

## 1. Mål

Arkitekturen ska vara enkel att självhosta, lätt att säkerhetskopiera och möjlig att vidareutveckla utan att kärndata binds till en extern leverantör.

## 2. Logiska lager

```text
Browser / PWA-ready Web UI
          │
          ▼
       HTTP API
          │
   ┌──────┴─────────┐
   ▼                ▼
PostgreSQL      File Storage
                    │
             originals/previews

Optional workers/providers:
- document extraction
- image metadata/thumbnailing
- future integrations
```

## 3. Docker Compose

Första implementationen ska minst bestå av:

- `milspar-web` — responsiv frontend
- `milspar-api` — backend/domain API
- `milspar-db` — PostgreSQL
- persistent volume för uploads/originalfiler

Workers kan initialt köras i API-processen eller separat när behov uppstår. Arkitekturen ska inte införa message broker innan faktisk nytta finns.

## 4. Frontend

Rekommenderad riktning: TypeScript + React-baserad webbfrontend. Val av konkret framework görs i implementationens ADR. UI ska konsumera API, inte databasen direkt.

Design tokens från `docs/design/DESIGN-SYSTEM.md` ska implementeras centralt och vara enda källan för färg/radius/spacing-semantic styling.

## 5. Backend

Backend ansvarar för domänregler, validering, provenance, filmetadata, importflöden och framtida integrationer. API ska versionshanteras när publikt kontrakt etableras.

## 6. Databas

PostgreSQL är baseline. Schemaändringar ska ske via migrations. Backup måste kunna återställa databas tillsammans med motsvarande filstorage.

## 7. Fillagring

V1 använder lokal persistent storage via Docker volume/bind mount. Domänen ska använda en storage abstraction så att S3-kompatibel lagring kan läggas till senare.

Original och derivat ska ha separata storage keys. SHA-256 eller motsvarande hash bör registreras vid ingest.

## 8. Dokumentanalys

Extraction ska vara provider-adapterbaserad:

```text
Document
  → Extraction service
     → Provider adapter (local/API/future)
        → normalized extraction
           → ProposedRecords
              → human review
                 → domain records
```

Kärnappen ska fungera utan provider konfigurerad.

## 9. Bildpipeline

Upload → validate MIME/size → hash → persist original → extract metadata → normalize orientation → generate preview/thumbnail → create MediaAsset.

HEIC/HEIF-stöd ska utvärderas i implementation eftersom browser/server codec-stöd varierar. Originalfilen bevaras oavsett preview-format.

## 10. Säkerhet

V1 ska designas som privat självhostad tjänst men inte anta att lokalt nät är säkert. Grundkrav:

- inga secrets i repo
- secure session/auth när auth införs
- filtyp/size validation
- path traversal-säker storage
- parametriserade DB-frågor/ORM
- CSRF/XSS-skydd enligt valt framework
- upload endpoints behandlas som untrusted input

Extern exponering bör ske bakom HTTPS reverse proxy.

## 11. Auth

Första privata MVP kan börja med en enda household/admin-kontext, men databasen och API:t ska inte göra globala singleton-antaganden som blockerar framtida users/households. Multi-user/auth specificeras innan extern/public deployment.

## 12. Backup/restore

En backup är inte komplett utan både:

1. PostgreSQL-data
2. original/derivative file storage
3. relevant app configuration/version metadata

Restore ska dokumenteras och testas.

## 13. Observability

Structured logs till stdout/stderr. Health endpoints för web/api/db dependency. Inga personliga dokumentinnehåll eller GPS-koordinater ska loggas som standard.

## 14. API/integration

Framtida integrationer (fordonsdata, Home Assistant, laddning) ska gå genom adapters och domän-API. Extern telemetri ska skapa/updatera spårbara domänposter och inte skriva direkt i tabeller.

## 15. ADR

Betydande implementationstekniska val ska dokumenteras under `docs/adr/`, exempelvis frontend framework, backend runtime, ORM, auth, storage och extraction provider.
