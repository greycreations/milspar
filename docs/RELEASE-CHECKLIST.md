# Releasekrav — installation med en enda Compose-fil

Beslutat av användaren 2026-09-28 efter problem med Git, images och portkonflikter.

## Obligatoriskt före varje framtida release

- Användaren behöver endast Docker med Compose och releasefilen docker-compose.yml.
- Ingen Git-kloning, Node, pnpm, lokal källkod eller lokal image-byggning krävs.
- Ingen separat .env, env_file, inkluderad YAML eller konfigurationsfil krävs.
- Web-, API- och migrationsimages publiceras före releasen i ett registry som målgruppen kan hämta från utan extra registry-inloggning.
- Compose använder image-referenser med samma versionsnummer för web/API/migrate, helst även digest. Inga opublicerade namn, dev-taggar, latest eller build-contexts i releasefilen.
- Användarinställningar finns direkt i Compose: webbport (standard 3080), tidszon och databaskonfiguration. Dokumentera vilka lösenordsvärden som måste ändras tillsammans och använd URL-säkert lösenord.
- Endast webbporten publiceras. API/databas är interna; browsern använder relativ /api-URL.
- Migrationer körs före API. Uppgraderingar bevarar data och använder samma volymer/projektnamn.
- CI laddar ner ENDAST releasefilen till en tom katalog utan .env och kör docker compose up -d --wait. Detta måste testas mot publicerade images, inte en lokal byggcache.
- Verifiera första start, fordonsregistrering, mobilvy, ändrad webbport, omstart samt uppgradering från föregående release med bevarade poster.
- Publicera versionsspecifik Compose-fil och kort installations-/uppgraderingsinstruktion tillsammans. Beskriv backup, restore och eventuella manuella migrationssteg.
- Release notes anger testade plattformar och begränsningar; kalla inte tjänsten redo för publik exponering innan auth/åtkomstkontroll är klar.

## Implementation

Release-workflow publicerar web/API till GHCR och använder samma API-image för migrering. Den genererade Compose-filen låser alla images med digest, även PostgreSQL. En separat runner hämtar images utan registry-inloggning och verifierar start från en tom katalog med endast Compose-filen, browserflöden, portbyte, beständighet och uppgradering från originalschemat. Först efter godkända tester skapas en GitHub-förhandsrelease med Compose, installationsanvisningar och SHA256SUMS.

Rootens Compose-fil är installationen för v0.1.0-preview.3. docker-compose.dev.yml bygger källkod för utveckling och vanlig CI. Plattform: Linux amd64. Releasekontrollen verifierar också uppgradering från den publicerade version som rootens Compose-fil pekar på vid bygget. Publicering startas manuellt via workflow_dispatch eller vid ändringar i releaseflödet/mallarna på main eller feat/vehicle-foundation.
