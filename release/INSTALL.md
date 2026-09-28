# Milspår — installation

Denna förhandsrelease innehåller fordonsöversikt och registrering. Service/tidslinje och inloggning återstår. Använd en privat testmiljö.

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

Ta backup före uppgradering och behåll en kopia av gamla Compose-filen. Databasbackup:

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/milspar.dump'
docker compose cp db:/tmp/milspar.dump ./milspar.dump
docker compose down
```

Ersätt Compose-filen med den nya versionen. För över eventuell egen port och befintliga DB-uppgifter. Kör:

```sh
docker compose pull
docker compose up -d --wait
```

Använd aldrig `down -v` vid uppgradering: det tar bort datavolymerna. Migreringscontainern avslutas normalt med status 0 när arbetet är klart.

## Återställning

Stoppa appen innan data återställs. Spara även uploads-volymen om den innehåller filer. Återställ till en separat installation för kontroll innan befintliga data ersätts.

Med samma databasuppgifter som backupen och endast DB startad:

```sh
docker compose up -d db --wait
docker compose cp ./milspar.dump db:/tmp/milspar.dump
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/milspar.dump'
docker compose up -d --wait
```

Återställning ersätter innehållet i mål-DB. Kör den bara mot den avsedda återställningsinstallationen. Migrera framåt med samma eller kompatibel appversion; anta inte att ett äldre schema stöder en nedgradering.

## Felsökning

`docker compose ps -a` och `docker compose logs api migrate web`.

Om porten är upptagen: ändra bara värdet före kolon i webbporten och kör startkommandot igen.
