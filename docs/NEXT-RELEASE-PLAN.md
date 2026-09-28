# Nästa samlade leverans — användbar servicebok och hjulhantering

Uppdaterad 2026-09-28. Detta är beslutad plan, inte en lista över färdig funktionalitet. Planen ersätter tidigare prioritering som lade grundläggande däckhantering efter servicebokens MVP. Design System v1.0 och kravet på en enda Compose-fil gäller fortsatt.

## Mål och nuläge

Användaren ska kunna sköta fordonets löpande historik manuellt från telefonen: ändra fordonsuppgifter, registrera service och mätarställning, bifoga kvitto, planera nästa åtgärd och byta mellan sommar- och vinterhjul.

Preview.4 innehåller fordonsregister, fordonsöversikt, läsning av mätarhistorik samt bekräftad borttagning av fordon/avläsningar. Full registrering/redigering, bilagor, underhåll och däckflöden återstår. Befintlig PR #3 är en separat granskningspunkt; kontrollera dess status innan nästa kodarbete. Att publicera en preview betyder inte automatiskt att den är mergad till main.

## Leveransomfattning

- Redigera fordonsuppgifter och välja profilbild.
- Registrera, redigera och ta bort mätarställning, anteckning, service, reparation och verkstadsbesök.
- Gemensam tidslinje med datum, mätarställning, utförda åtgärder, verkstad, kostnad och bilagor.
- Bilder och dokument direkt till fordon eller händelse; bevarade original och separat bildpreview. Manuell koppling utan dokumenttolkning.
- Enkla underhållsregler i datum och/eller km, inklusive avslut/genomförd åtgärd och nästa förfallodatum.
- Sommar-/vinterhjul, fälg- och däckuppgifter, monteringshistorik och beräknad körsträcka när underlaget räcker.
- Verkliga senaste händelser och kommande åtgärder på översikten. Navigation öppnar rätt vy; ej levererade funktioner märks tydligt som kommande.
- En gemensam versionslåst Compose-release med testad uppgradering och backup/restore-anvisningar.

## Hjuluppsättningar och däckbyten

En uppsättning hör initialt till ett fordon och kan heta exempelvis ”Sommar 19 tum” eller ”Vinter original”. Säsong är sommar, vinter eller året runt. Tillåt flera uppsättningar av samma säsong; härled status monterad/förvarad ur monteringsperioderna.

Fälguppgifter: benämning, fabrikat/modell om känt, diameter i tum, bredd, färg samt valfria ET/inpressning, bultmönster och anteckningar. Stöd olika dimensioner fram/bak utan att kräva fyra separata hjulobjekt i första versionen.

Däckuppgifter: fabrikat, modell, dimension fram/bak, införskaffningsdatum samt valfri typ dubb/friktion, DOT/tillverkningskod, inköpspris och anteckningar. Inköpsdatum och tillverkningsdatum är skilda uppgifter. Okända värden får lämnas tomma.

Behåll fälguppsättningens identitet när slitna däck ersätts: en separat däckomgång har egna uppgifter och giltighetsperiod. Monteringshistoriken refererar till rätt däckomgång. Att byta däckmodell får inte skriva om tidigare säsongers historik. Full individuell hjulrotation och lagerhantering ingår inte nu.

Flödet ”Byt hjul” visar fordon, datum, avläst km, nuvarande uppsättning och uppsättningen som monteras. Samma transaktion avslutar föregående period, öppnar nästa och skapar en tidslinjehändelse med eventuell avläsning. Första montering och enbart demontering ska också fungera. En redan monterad uppsättning kan inte monteras igen utan ett verkligt byte.

Datum krävs. Mätarställning rekommenderas men kan vara okänd; visa då ofullständigt underlag i stället för att anta noll. Beräkna distans för avslutade perioder med kända ändpunkter; pågående period använder senaste giltiga avläsning efter monteringen. Summera känd distans och markera om totalen är ofullständig. Negativa differenser ska flaggas, inte döljas med noll.

Högst en aktiv montering per fordon och uppsättning. Bakdatering, redigering och borttagning måste kontrollera angränsande perioder och undvika överlapp. Visa följderna innan ett byte korrigeras; uppdatera händelse, monteringsperioder och härledda värden atomiskt. Radera inte en kopplad mätaravläsning eller uppsättning isolerat om det lämnar historiken motsägelsefull.

## Implementationsordning och färdigkriterier

| Del | Bygg | Kontroll innan nästa del |
| --- | --- | --- |
| 1. Gemensam historik | Event, redigering med ändringsspår, manuella avläsningar/anteckningar, fordonsredigering och riktig navigation | Spara–öppna–redigera–ta bort från mobil; avvikande km granskas; äldre data fungerar |
| 2. Service och kostnad | Händelsetyper, utförda åtgärder, verkstad och enkel kostnad i minor units/valuta | Service med flera åtgärder visas korrekt; ingen dubbelräkning av kostnad |
| 3. Filer | Lokal StorageProvider, filmetadata, original/preview, profilbild och länkar till Event/Vehicle | Storlek/filtyp/path-validering, kvarvarande original och fungerande backup/restore; raderad länk raderar inte delat original |
| 4. Hjul | Uppsättning, däckomgång, monteringsperiod och hjulbytesformulär ovan | Sommar → vinter → sommar; distans över flera perioder; okända km; korrigering, borttagning och samtidiga byten |
| 5. Underhåll och översikt | Enkla datum-/km-regler, kommande åtgärder, senaste händelser och navigationsstatus | Rätt förfallostatus efter ändrade avläsningar/händelser; inga falska nollor eller döda knappar |
| 6. Samlad leverans | Regression, migrationskedja, images och Compose | Ren installation och uppgradering från använd version med fordon, historik och filer bevarade |

Varje del ska fungera genom databas → API → UI innan nästa breddas. Dessa är interna kontrollpunkter; användaren får en samlad funktionell release. Fråga bara om nya produktbeslut eller blockerande uppgifter, inte om rutinval inom planen.

## Live-data: koncept nu, märkesintegrationer senare

Manuell inmatning är primär och ska fungera utan konto hos biltillverkare, externa API:er eller bakgrundsjobb. Ingen faktisk märkesintegration ingår i denna leverans. Val av första märke och åtkomstmetod görs när integrationsarbetet börjar; verifiera då officiell åtkomst, villkor och tillgängliga datapunkter.

Planerat flöde: märkesadapter → normaliserad observation → validering/dubblettkontroll → samma domäntjänster som manuell registrering. En observation bär fordon, typ, värde, enhet, observationstid, mottagningstid, källa och extern identitet för idempotens. Skilj historiska avläsningar från senaste telemetrivärde så att framtida batterinivå eller laddstatus inte skapar tusentals tidslinjehändelser.

Första kandidaten är mätarställning; batterinivå, räckvidd och laddstatus följer efter faktisk leverantörskapacitet. Visa källa och när värdet observerades. Äldre eller avvikande observationer får inte tyst ersätta giltiga aktuella värden. Ingen automatisk sammanslagning med manuella poster. Planera för fördröjningar, återförsök med backoff, rate limits, återkallad åtkomst och dubbletter.

I nästa leverans införs endast de proveniensfält och domängränser som den manuella historiken behöver. Dokumentera adapterkontraktet; bygg inte ett oanvänt plugin-system, kökluster eller märkesspecifika anslutningar. Framtida autentiseringstokens lagras som skyddade installationshemligheter, inte i versionshanterad Compose eller loggar. Fordonsstyrning och platsinsamling är utanför nuvarande scope.

## Effektiv användning av tokens, tid och arbete

- Behåll befintlig teknik, design och komponenter. Bygg ett delat händelseformulär med typberoende fält, ett filflöde och gemensamma bekräftelse-/felmönster.
- Låt mätarvärden, hjuldistans, kostnader och dashboard härledas från samma domänposter. Undvik parallella lagringar och synkroniseringskod.
- Läs relevanta specifikationsdelar en gång per arbetsdel. Uppdatera handoff med konkreta beslut och kvarstående arbete så att nästa session slipper återutreda allt.
- Gruppera relaterade schemaändringar per färdig domändel; generera migrationer och metadata tillsammans. Ändra aldrig en redan publicerad migration.
- Kör riktade tester under arbetet. Kör hela regressionssviten vid integrationspunkter och full Docker-/uppgraderingskontroll före release, inte efter varje text- eller CSS-ändring.
- Bygg/pusha images när en sammanhängande releasekandidat är klar. Använd cache och versionslåsta images; undvik en publik release per liten intern ändring.
- Anpassa insats efter testresultat och faktisk komplexitet. Ge ingen påhittad exakt tids- eller tokenprognos; rapportera färdiga arbetsdelar och konkreta hinder.

Avancerad ekonomi/TCO, automatisk dokumenttolkning, individuella hjulpositioner/rotation, avancerade album och faktiska live-integrationer ligger efter denna leverans. Grundläggande kostnad per händelse och hjulhantering ingår enligt ovan.
