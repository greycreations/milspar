# Milspår — handoff efter den samlade serviceboksimplementationen

Projekt: greycreations/milspar. Arbetsbranch feat/vehicle-detail, PR #3. Kontrollera aktuell PR/CI-status: main uppdateras först efter uttrycklig merge-instruktion. Rootens Compose-fil pekar på senaste verifierade release; källkodsbyggen använder docker-compose.dev.yml.

## Implementerat

- Fordonsregister, redigering, profilbild och spårbar borttagning.
- Event för manuella mätarställningar, anteckningar, service, reparation, verkstad och hjulbyte; redigering, borttagning och audit_log.
- Delade Zod-kontrakt, heltalskostnader/valuta, explicit bekräftelse av avvikande mätarvärden, revisionskontroll och transaktioner med lås per fordon.
- Sommar/vinter/året-runt-uppsättningar med fälgdata och separata däckomgångar. Monteringsperioder härleds från händelser; bakdatering/redigering kontrollerar hela ordningen.
- Lokala originalfiler och separata WebP-previews, SHA-256, tillgängligt EXIF-datum, profilbild och manuell händelselänk. JPEG/PNG/WebP/PDF upp till 20 MB; bilder upp till 40 MP.
- Underhåll i datum/km, återkommande intervall, genomförande som servicehändelse, korrigering och återöppning vid borttagning.
- Fungerande fordonsflikar och globala destinationer, sökning bland fordon, riktiga dashboarduppgifter. Inkorg är uttryckligen kommande.
- Migrationer 0000–0003 inklusive konvertering av gamla avläsningar till händelser; ursprungliga värden/tider/deleted-state bevaras.

## Kontrakt och vägledning

Läs docs/NEXT-RELEASE-PLAN.md för accepterad omfattning och docs/adr/0008-service-book-and-wheel-history.md för implementerade beslut. Följ docs/design/DESIGN-SYSTEM.md v1.0 LOCKED. React/Vite, Fastify, Drizzle/PostgreSQL, Zod och pnpm 10.17.1 kvarstår. Inga nya huvudnavigationer eller visuella redesigns utan produktbeslut.

Domänlogik ligger i apps/api/src/services/book.ts och book-domain.ts. Typspecifika data använder Zod-validerad JSONB inom relationella ägar-/länkgränser. Ändra aldrig publicerade migrationer. WheelFitment är ett härlett läsobjekt, inte ytterligare muterbar lagring. Återkommande underhåll använder originEventId för att hålla nästa regel konsekvent.

## Kontroller och leverans

API-/databastester finns i vehicles.test.ts och book.test.ts. Browserregression kör lokalt med kontrollerade svar; hela service/kvitto/hjul/underhållsflödet och konkurrerande byten kör mot riktig Docker/PostgreSQL i CI. scripts/verify-restore.sh är ENDAST för isolerad CI: återställer PostgreSQL och uploads och verifierar originalbytes. Se faktiska CI-statusar, inte dokumentets formulering, som bevis på aktuell head.

Källkodskandidaten 41a788b passerade CI 36479398142 (23 API-/databastester, 18 browserfall samt migration, beständighet och återställning). Preview.5 är publicerad och releasekörning 36479946597 är godkänd, inklusive anonym installation och uppgradering från preview.4. Rootens Compose matchar releasefilen (SHA-256 081cc91168176fd326bc25ac941794ff044a3a8a78a65da7893cc1d57a9e98a3). Den testar anonyma image-pulls, en enda Compose-fil, beständighet, portbyte och uppgradering från rootens tidigare publicerade version. Rootens Compose och versionslänkar är uppdaterade till preview.5. Installations-/backup-/restore-anvisningar finns i release/INSTALL.md. Docker saknas lokalt; containerkontroller körs i GitHub.

## Medvetna begränsningar och nästa arbete

Live-data är enbart koncept: docs/INTEGRATION-CONCEPT.md. Manuell användning kräver inga externa konton. Auth, permanent purge/återställningsvy, automatisk dokumentanalys, individuell hjulrotation, TCO och avancerad ekonomi är framtida arbete. En fil länkar initialt till ett event åt gången; originalet kan även användas som cover. HEIC behöver exporteras till JPEG. EXIF utan tidszon kan inte säkert fastställa ett exakt UTC-ögonblick; originalmetadata bevaras.

Innan ny funktionsutökning: kontrollera release-/PR-status, hantera användarens återkoppling och håll PR-beskrivningen synkroniserad. Undvik ny release per liten ändring och repetera bara tester när nya ändringar/fel motiverar det.
