# Milspår — installation

Denna förhandsrelease innehåller fordonsredigering, servicebok/tidslinje, manuella mätarställningar, bilder/PDF, sommar-/vinterhjul och återkommande underhåll. Inloggning och live-integrationer återstår. Använd en privat testmiljö.

## Första start

Krav: Docker med Docker Compose v2 på Linux x86-64 (amd64). Endast denna plattform är testad i första releasen.

1. Ladda ner docker-compose.yml från SAMMA GitHub-release som denna fil, till en egen katalog.
2. Kör i katalogen: `docker compose up -d --wait`.
3. Öppna http://SERVERNS-IP:3080.

Inga andra filer, Git, .env, källkod eller docker login behövs. Images laddas ner automatiskt. Webbporten kan ändras direkt från "3080:80" till exempelvis "3081:80" i filen.

## Inställningar

All konfiguration finns i Compose-filen. DB är intern. Om databaslösenord ändras måste både POSTGRES_PASSWORD och lösenordet i DATABASE_URL uppdateras tillsammans (använd bokstäver/siffror/-/_). Ändrade värden i filen ändrar inte lösenordet i en redan initierad databas.

## Befintlig installation eller uppgradering

Behåll samma katalog och Compose-projektnamn så att befintliga volymer återanvänds. Från den tidigare Git-installationen: kör fortfarande från katalogen app, eller ange samma projektnamn med `-p app`. Kör inte två installationer samtidigt mot samma datavolym.

Ta backup före uppgradering och behåll en kopia av gamla Compose-filen. Stoppa webb/API så att databas och filer inte ändras under backup. Följande kommandon är avsedda för Linux-terminalen:

```sh
docker compose stop web api
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/milspar.dump'
docker compose cp db:/tmp/milspar.dump ./milspar.dump
docker compose run --rm --no-deps -T api tar -C /data/uploads -cf - . > uploads.tar
docker compose down
```

Ersätt Compose-filen med den nya versionen. För över eventuell egen port och befintliga DB-uppgifter. Kör:

```sh
docker compose pull
docker compose up -d --wait
```

Använd aldrig `down -v` vid uppgradering: det tar bort datavolymerna. Migreringscontainern avslutas normalt med status 0 när arbetet är klart.

## Återställning

Återställ till en separat installation med nytt projektnamn och tomma volymer för kontroll innan befintliga data ersätts. Kopiera rätt Compose-version, milspar.dump och uploads.tar till den katalogen. Anpassa webbporten om den ordinarie installationen körs samtidigt. Databasdumpen och filarkivet måste komma från samma backup.

Med samma databasuppgifter som backupen och endast DB startad (nedan används det separata projektnamnet milspar-restore):

```sh
docker compose -p milspar-restore up -d db --wait
docker compose -p milspar-restore cp ./milspar.dump db:/tmp/milspar.dump
docker compose -p milspar-restore exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --exit-on-error /tmp/milspar.dump'
docker compose -p milspar-restore run --rm --no-deps -T api tar -C /data/uploads -xf - < uploads.tar
docker compose -p milspar-restore up -d --wait
```

Kommandona kräver en tom mål-DB; de är inte avsedda att slå samman installationer. Kontrollera fordonsdata, servicehistorik, profilbilder och nedladdning av original. Migrera framåt med samma eller kompatibel appversion; anta inte att ett äldre schema stöder en nedgradering. CI testar återställning av både databas och originalfiler.

## Hjul, underhåll och borttagning

Lägg till en fälguppsättning under Däck, sedan en däckomgång. Registrera hjulbyten med datum och helst km; ofullständiga värden ger ingen påhittad körsträcka. Nya däck på samma fälgar läggs till som ny omgång. Korrigera hjulbytet i tidslinjen för att ändra monteringshistoriken.

Återkommande underhåll skapar nästa regel när det markeras genomfört. Om den avslutande händelsen korrigeras måste omräkning bekräftas; borttagning öppnar den tidigare regeln igen och tar bort nästa väntande regel. Senare genomförda åtgärder behöver korrigeras först.

Borttagna poster/original bevaras i databasen och uploads för spårbarhet; detta är inte permanent radering. Det finns ännu ingen papperskorg/återställningsvy. Bilder kan väljas som profilbild i Galleri. Bilagor kan kopplas till en händelse åt gången eller endast till fordonet.

## Felsökning

`docker compose ps -a` och `docker compose logs api migrate web`.

Om porten är upptagen: ändra bara värdet före kolon i webbporten och kör startkommandot igen.
