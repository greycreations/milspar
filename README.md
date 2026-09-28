# Milspår

**Hela bilens historia.**

En självhostad digital servicebok för flera fordon, med mobile-first registrering och desktop-first överblick.

## Nuvarande funktioner

Skapa och lista fordon med valfri första mätarställning. Öppna ett fordonskort för fordonsuppgifter, aktuell mätarställning och en tidslinje med de 50 senaste avläsningarna. Fordonsvyer har direktlänkar som fungerar efter omladdning. Fordon och avläsning sparas atomiskt i PostgreSQL. UI visar laddningsfel med återförsök och begripliga sparfel.

Servicehändelser, registrering av nya avläsningar, dokument, bilder, däck, kostnader och inloggning är kommande funktioner. Dashboardens Att göra/Senaste och övrig navigation är fortfarande platshållare.

## Provstart med Docker

Krav: Docker Engine/Desktop och Docker Compose **2.20+**.

1. Ladda ner [docker-compose.yml för v0.1.0-preview.3](https://github.com/greycreations/milspar/releases/download/v0.1.0-preview.3/docker-compose.yml) till en egen katalog. Ingen Git-kloning eller källkod behövs. Förhandsreleasen stöder Linux amd64 (vanliga Intel/AMD-servrar).
2. Inställningarna finns direkt i `docker-compose.yml`; ingen `.env` behövs. Standardporten är 3080. Om du ändrar databaslösenord, ändra både DATABASE_URL och POSTGRES_PASSWORD till samma URL-säkra lösenord.
3. Kör:

```sh
docker compose up -d --wait
```

Öppna **http://localhost:3080**. På mobilen används **http://VÄRDDATORNS-LAN-IP:3080** på samma nätverk; brandväggen måste tillåta vald webbport. Ändra `3080:80` under web/ports direkt i Compose-filen vid behov. Webb och API använder samma origin; inga frontend-URL:er behöver byggas om.

Detta är en privat provinstallation utan inloggning. Exponera inte installationen publikt innan åtkomstkontroll införts.

```sh
docker compose ps
docker compose logs -f api migrate
docker compose stop
docker compose start
```

Webben publicerar port 3080 (eller vald port i Compose). API och PostgreSQL är endast åtkomliga inom Compose-nätverket. Web/API liveness: intern /health; API readiness: intern /ready. Readiness kontrollerar databas och tabeller. Upload-volymen är förberedd, men uppladdning är ännu inte implementerad.

För utveckling från klonad källkod: `docker compose -f docker-compose.dev.yml up -d --build --wait`. Den filen bygger lokala images; den är inte en hot-reload-miljö. Rootens Compose-fil använder publicerade images låsta med version och digest.

## Uppgradera utan att förlora data

Behåll samma katalog/Compose-projektnamn som tidigare. Standardnamngivna volymer är projektspecifika. Om katalogen byts, använd samma `-p PROJEKTNAMN` på alla kommandon.

Ta backup av databasen och eventuella filer före uppgradering. Exempel på databasdump:

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/milspar.dump'
docker compose cp db:/tmp/milspar.dump ./milspar.dump
docker compose down
docker compose up -d --wait
```

`down` utan `-v` behåller data. **Använd inte `down -v` för uppgradering.**

Migreringsservicen körs före API-start. Den första journalförda migrationen kan både skapa en tom databas och ta över det ursprungliga init-SQL-schemat från fordonsbranchen utan att radera data. Om migrationen misslyckas startar inte API:t; läs `docker compose logs migrate` och åtgärda orsaken innan nytt försök. Kör inte manuell journalmarkering för okända schemaavvikelser.

POSTGRES_USER/PASSWORD/DB måste motsvara en befintlig volyms konfiguration. Att ändra Compose ändrar inte lösenord i en redan initierad databas. Vid uppgradering från .env: för över dina befintliga värden till både DB-konfigurationen och API:ts DATABASE_URL i Compose innan start. Gamla .env-värden används inte längre av Compose.

Full backup omfattar PostgreSQL, uploads och konfiguration/version. Se [installations- och återställningsanvisningar](release/INSTALL.md).

## Lokal utveckling utan Docker-webb

Node.js 22+ och pnpm **10.17.1**:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm test` kör API-/databastester med PGlite utan separat server. `pnpm test:e2e` startar Vite och testar desktop/mobil med kontrollerade API-svar. Sätt `E2E_BASE_URL=http://localhost:3080` för samma registreringsflöde mot en riktig Compose-stack. CI kör dessutom PostgreSQL 17, omstart och uppgradering.

För `pnpm dev` behövs en nåbar PostgreSQL-instans. Exportera DATABASE_URL i API-processens miljö (en .env-fil laddas inte automatiskt), kör `pnpm --filter @milspar/api db:migrate`, och starta sedan `pnpm dev`. Vite skickar /api till localhost:3001. Compose-databasen publicerar ingen hostport; använd en separat lokal utvecklingsdatabas eller en uttrycklig lokal Compose-override.

## Schemaändringar

Redigera `apps/api/src/db/schema.ts`, kör `pnpm --filter @milspar/api db:generate` och granska/committa både SQL och metadata. Kör sedan `db:migrate` med rätt DATABASE_URL. Ändra aldrig en redan tillämpad migration.

## Dokumentation och design

Läs `docs/PRODUCT-SPEC.md`, `docs/DATA-MODEL.md`, `docs/ROADMAP.md` och `docs/adr/`.

**Design System v1.0 är LOCKED.** Följ `docs/design/DESIGN-SYSTEM.md` och `docs/design/UI-SPEC.md`; ändra inte grafisk profil som en del av en teknisk rättning.

## Framtida releaser

En release ska kunna installeras med endast en Compose-fil och färdigpublicerade images, utan Git, källkod eller .env. Se [releasekraven](docs/RELEASE-CHECKLIST.md). Publiceringsflödet i `.github/workflows/release.yml` bygger och publicerar images, genererar en versions- och digestlåst Compose-fil och verifierar anonym nedladdning, start, browserflöden, portbyte, beständighet och uppgradering från det ursprungliga schemat samt den installerade releasen innan GitHub-releasen skapas.
