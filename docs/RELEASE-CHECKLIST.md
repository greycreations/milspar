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

## Nuvarande utvecklingsbranch

Rootens docker-compose.yml har inställningarna direkt i filen och kräver ingen .env. Den bygger fortfarande från källkod. Den är en utvecklingsinstallation, inte ännu en release som uppfyller kravet ovan.

Nästa releasearbete är därför registry/image-publicering och en separat genererad, versionslåst releasefil. Publiceringsflödet måste verifiera att images faktiskt går att hämta innan releasen markeras färdig.
