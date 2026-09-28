# Milspår — aktuell Codex-handoff

Uppdaterad 2026-09-28. Repository: https://github.com/greycreations/milspar.

## Produkt och beslut

Milspår är en privat, självhostad digital servicebok för flera fordon: **Hela bilens historia.** Fordonet är navet; Event ska förena historik, dokument, bilder, kostnader och mätaravläsningar. Original bevaras. AI är frivilligt och föreslagen import ska godkännas av användaren.

Läs före implementation:
- docs/PRODUCT-SPEC.md och docs/ROADMAP.md
- docs/design/DESIGN-SYSTEM.md (**v1.0 LOCKED**) och docs/design/UI-SPEC.md
- docs/DATA-MODEL.md och docs/ARCHITECTURE.md
- docs/adr/0001–0006

Behåll React/Vite/TypeScript, Fastify, PostgreSQL/Drizzle, Zod och pnpm workspace. Följ ljust UI med grafit och gul accent #F5C518 samt mobile-first input + desktop-first overview. Betydande teknikval kräver ADR; ändra inte designidentitet lokalt.

## Branch och leverans

PR #1 och PR #2 är squash-mergade till main. Nästa slice utvecklas på feat/vehicle-detail. Kontrollera alltid aktuell head och CI innan fortsatt arbete.

Den här uppdateringen inför fordonsöversikt, direktlänkar och läsning av mätarhistorik. Utförda lokala kontroller: typecheck, build, nio API-/databastester med PGlite och tolv browserfall (desktop/mobil med kontrollerade API-svar). Docker finns inte i den lokala arbetsmiljön. GitHub-workflow verifierar riktig Compose/PostgreSQL, beständighet och uppgradering; använd dess faktiska status, inte detta dokument, som bevis på containerkörningen.

## Vad som finns

- Skapa/lista fordon och öppna fordonsöversikt via klickbart kort eller direktlänk.
- Detaljkontrakt med VIN, färg, aktuellt mätarvärde och högst 50 senaste avläsningar (äldre data bevaras).
- Läsbar mätartidslinje, ärliga tomlägen och återförsök. Desktop-sidebar, tabletmeny och mobilnavigation.
- Valfri initial mätarställning och korrekt härledd mätarvisning.
- Gemensam transaktion för fordon och första avläsning.
- Zod-input/UUID-validering, separat 409 vid unikhetskonflikt och generiskt serverfel för övriga fel.
- UI med laddningsfel/återförsök, sparfel och modal med fokusfångst, Escape och fokusåterställning.
- Standard-Compose med nginx same-origin /api-proxy; endast webport publiceras.
- Drizzle-journal/snapshot, migreringsservice före API och advisory lock. Första idempotenta migrationen kan ta över känt original-init-schema utan radering.
- pnpm 10.17.1, lockfile, tester och CI.

Fysiska tabeller: vehicles och odometer_readings. Mätarvärden är heltal i km, tidsstämplar har tidszon. SQL/schema bevarar unika fordonsidentiteter, FK, icke-negativ mätarställning och index.

## Vad som återstår

Profilbild/StorageProvider, redigering, separat mätarregistrering, gemensam Event-modell och full tidslinje, service, underhåll, kostnader, dokument, galleri, däck, inkorg/extraction, sök och auth. Att göra/Senaste och flera navigationslänkar är placeholders.

Fordonsvyn följer brytpunkterna <768, 768–1199 och >=1200 px. Design System v1.0 är fortsatt låst.

## Exakt nästa steg

1. Kontrollera aktuell fordonsvy-PR och CI. Åtgärda eventuella fel i Compose-start/legacy-upgrade innan grunden kallas verifierad.
2. Låt PR vara kontrollpunkt; merge först på användarens aktuella instruktion.
3. Fordonssida och läsning av mätarhistorik är implementerade; nästa användarflöde är registrering av nya avläsningar med avvikelsehantering och gemensam Event-koppling.
4. Lägg till cover via lokal StorageProvider och MediaAsset: original, hash, metadata och separat preview.
5. Bygg gemensam Event-modell och första manuella antecknings-/mätarflöden, därefter service/verkstad/reparation. Testa kronologi, avvikande värden och Vehicle-koppling.
6. Slutför manuell MVP med dokument, kostnader, underhåll, galleri och backup/restore. AI/däckdjup/TCO/integrationer följer roadmapen senare.

Utveckla schema/migration → kontrakt → domän/API → UI → relevanta tester. Domänlogik ligger i services, inte route handlers. Ingen frontend-import av DB-internals. Pengar använder decimal/minor units. Ingen automatisk sammanslagning av historik eller destruktiv originalhantering.

## Drift

Följ README för start och uppgradering. Alla Compose-inställningar finns direkt i docker-compose.yml (webbport 3080); ingen .env behövs. Läs även docs/RELEASE-CHECKLIST.md: rootens Compose-fil använder publicerade images för v0.1.0-preview.3 och kräver varken Git eller lokal byggning. Startkommando: docker compose up -d --wait. Lokal källkodsbyggning använder docker-compose.dev.yml. Release-workflow verifierar anonym nedladdning före publicering. Förhandsreleasen stöder Linux amd64. Samma webbadress används från desktop och LAN-mobil.

Behåll projektnamn/volymer vid uppgradering. Gör backup och använd aldrig down -v som uppgraderingslösning. Ändringar i Compose ändrar inte redan lagrade DB-lösenord; flytta över befintliga anpassade värden från äldre .env vid uppgradering. Auth saknas; privat testinstallation tills åtkomstkontroll införts.
