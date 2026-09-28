# Milspår — Roadmap

Aktuell leveransplan: [Nästa samlade leverans](NEXT-RELEASE-PLAN.md). Grundläggande sommar-/vinterhjul och hjulbyten ingår nu i nästa leverans; live-data planeras konceptuellt men anslutningar kommer senare.

Roadmapen prioriterar en användbar kärna framför att bygga alla integrations- och AI-idéer samtidigt.

## Phase 0 — Baseline

- Produkt- och datamodell
- Design System v1.0 LOCKED
- Responsiv UI-spec
- Arkitekturprinciper
- Docker Compose-baseline

## Phase 1 — MVP: Digital servicebok

- Fordonsregister för flera fordon
- Profilbild
- Mätarhistorik
- Händelser/tidslinje
- Service, verkstadsbesök och reparation
- Grundläggande underhållsregler
- Kostnader
- Dokumentuppladdning och manuell koppling
- Bildgalleri + EXIF captured date
- Responsiv dashboard
- Backup/export av kärndata

**MVP success:** användaren kan sköta den löpande serviceboken helt i Milspår från mobil och desktop utan AI.

## Phase 2 — Fördjupad däckhantering & ekonomi

- TireSet/TireFitment och grundläggande körsträcka flyttas till nästa leverans enligt NEXT-RELEASE-PLAN.md
- Mönsterdjup/rotation
- Månadsunderlag och kategorier
- Fasta/rörliga kostnader
- Kostnad/km och kostnad/mil
- Årsjämförelser

## Phase 3 — Smart dokumentinkorg

- Batch upload
- Extraction provider interface
- PDF/image extraction
- Föreslagna händelser/kostnader/mätarställningar
- Confidence och field provenance
- Review/approval UI
- Dubblett- och same-event-förslag

## Phase 4 — Media & search

- Album
- GPS metadata/kartvy med privacy controls
- Smart event association för bilder
- Global fulltext search
- Command palette

## Phase 5 — Integrationer

- Stabilt integrations-API
- Home Assistant-adapter
- Fordonsdata-provider adapters
- Ladd-/energidata
- Automatisk mätaruppdatering med provenance

## Phase 6 — Ownership/TCO & portability

- Värdeminskning
- Full TCO
- Försäljnings-/överlämningsrapport
- Komplett fordons-export
- Förbättrat restore/import-flöde

## Ej prioriterat i tidig version

- Sociala funktioner
- Publika fordonsprofiler
- Fleet/enterprise workflows
- Avancerad multi-tenant administration
- Dekorativa dashboards utan konkret användarnytta

## Release gate

Varje framtida release ska installeras med en enda Compose-fil och publicerade versionslåsta images, utan Git eller .env. Se docs/RELEASE-CHECKLIST.md.
