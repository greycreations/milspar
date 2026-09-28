# Milspår — aktuell Codex-handoff

Uppdaterad 2026-09-28. Repository: https://github.com/greycreations/milspar.

## Produkt och beslut

Milspår är en privat, självhostad digital servicebok för flera fordon: **Hela bilens historia.** Fordonet är navet; Event ska förena historik, dokument, bilder, kostnader och mätaravläsningar. Original bevaras. AI är frivilligt och föreslagen import ska godkännas av användaren.

Läs före implementation:
- docs/PRODUCT-SPEC.md och docs/ROADMAP.md
- docs/design/DESIGN-SYSTEM.md (**v1.0 LOCKED**) och docs/design/UI-SPEC.md
- docs/DATA-MODEL.md och docs/ARCHITECTURE.md
- docs/adr/0001–0004

Behåll React/Vite/TypeScript, Fastify, PostgreSQL/Drizzle, Zod och pnpm workspace. Följ ljust UI med grafit och gul accent #F5C518 samt mobile-first input + desktop-first overview. Betydande teknikval kräver ADR; ändra inte designidentitet lokalt.

## Branch och leverans

PR #1 är squash-mergad till main. PR #2 är kontrollpunkten för feat/vehicle-foundation; den är inte mergad vid dokumentets uppdatering. Kontrollera alltid aktuell head och CI innan fortsatt arbete.

Den här uppdateringen stabiliserar PR #2 och inför vanlig Compose-start. Utförda lokala kontroller: typecheck, build, sju API-/databastester med PGlite och sex browserfall (desktop/mobil med kontrollerade API-svar). Docker finns inte i den lokala arbetsmiljön. GitHub-workflow verifierar riktig Compose/PostgreSQL, beständighet och uppgradering; använd dess faktiska status, inte detta dokument, som bevis på containerkörningen.

## Vad som finns

- Skapa/lista fordon, API för att hämta ett fordon.
- Valfri initial mätarställning och korrekt härledd mätarvisning.
- Gemensam transaktion för fordon och första avläsning.
- Zod-input/UUID-validering, separat 409 vid unikhetskonflikt och generiskt serverfel för övriga fel.
- UI med laddningsfel/återförsök, sparfel och modal med fokusfångst, Escape och fokusåterställning.
- Standard-Compose med nginx same-origin /api-proxy; endast webport publiceras.
- Drizzle-journal/snapshot, migreringsservice före API och advisory lock. Första idempotenta migrationen kan ta över känt original-init-schema utan radering.
- pnpm 10.17.1, lockfile, tester och CI.

Fysiska tabeller: vehicles och odometer_readings. Mätarvärden är heltal i km, tidsstämplar har tidszon. SQL/schema bevarar unika fordonsidentiteter, FK, icke-negativ mätarställning och index.

## Vad som återstår

Fordonssida/routning, profilbild/StorageProvider, redigering, separat mätarregistrering, Event/tidslinje, service, underhåll, kostnader, dokument, galleri, däck, inkorg/extraction, sök och auth. Att göra/Senaste och flera navigationslänkar är placeholders.

Designens exakta tablet-/mobilbrytpunkter är ännu inte fullt genomförda i det ursprungliga dashboard-skalet. Ändra inte designkontraktet för att legitimera detta.

## Exakt nästa steg

1. Kontrollera PR #2 och CI. Åtgärda eventuella fel i Compose-start/legacy-upgrade innan grunden kallas verifierad.
2. Låt PR vara kontrollpunkt; merge först på användarens aktuella instruktion.
3. Bygg riktig fordonssida: routning/direktlänk, detaljkontrakt inklusive mätarvärde, fordonsheader, sekundär navigation, ärliga tomma KPI-lägen och responsive regler.
4. Lägg till cover via lokal StorageProvider och MediaAsset: original, hash, metadata och separat preview.
5. Bygg gemensam Event-modell och första manuella antecknings-/mätarflöden, därefter service/verkstad/reparation. Testa kronologi, avvikande värden och Vehicle-koppling.
6. Slutför manuell MVP med dokument, kostnader, underhåll, galleri och backup/restore. AI/däckdjup/TCO/integrationer följer roadmapen senare.

Utveckla schema/migration → kontrakt → domän/API → UI → relevanta tester. Domänlogik ligger i services, inte route handlers. Ingen frontend-import av DB-internals. Pengar använder decimal/minor units. Ingen automatisk sammanslagning av historik eller destruktiv originalhantering.

## Drift

Följ README för .env, start och uppgradering. Avsett startkommando: docker compose up -d --build --wait. Compose 2.20+ behövs för det kompatibla dev-filnamnet. Samma webbadress används från desktop och LAN-mobil.

Behåll projektnamn/volymer vid uppgradering. Gör backup och använd aldrig down -v som uppgraderingslösning. .env ändrar inte redan lagrade DB-lösenord. Auth saknas; privat testinstallation tills åtkomstkontroll införts.
