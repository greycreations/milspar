# Milspår — Product Specification v1.0

**Status:** Baseline  
**Produkt:** Milspår  
**Tagline:** Hela bilens historia.

## 1. Vision

Milspår ska vara ett komplett digitalt fordonsarkiv och en aktiv servicebok för privatpersoner och hushåll med ett eller flera fordon. Appen ska göra det snabbt att registrera vad som händer med bilen och enkelt att i efterhand förstå dess historik, skick, kostnader och kommande behov.

Appen ska vara självhostad och körbar via Docker Compose.

## 2. Produktprinciper

1. **Fordonet är navet.** All information ska kunna härledas till ett fordon.
2. **Händelsen binder ihop historiken.** Service, kostnader, dokument, bilder, mätarställning och komponenter ska kunna kopplas till samma händelse.
3. **Registrering ska vara snabb.** Mobil användning vid bilen är ett primärt scenario.
4. **Historiken ska vara spårbar.** Importerade värden ska kunna härledas till källdokument.
5. **Original bevaras.** Dokument och bilder ska lagras i original; derivat får genereras för webbvisning.
6. **Automatik föreslår — användaren beslutar.** Dokumenttolkning får inte permanent skapa osäkra poster utan granskningssteg.
7. **Local first.** Kärnfunktionerna får inte kräva extern molntjänst.

## 3. Fordon

Systemet ska stödja flera fordon. Ett fordonskort ska minst kunna innehålla:

- Registreringsnummer
- VIN/chassinummer
- Märke, modell och variant
- Årsmodell/modellår
- Drivlina och bränsle/energislag
- Effekt
- Färg
- Första registrering
- Inköpsdatum
- Mätarställning vid köp
- Inköpspris
- Aktuell mätarställning
- Profilbild
- Anteckningar

Valfria uppgifter kan inkludera batteristorlek/tankvolym, finansiering, leasing och försäkringsinformation.

## 4. Händelser och tidslinje

Fordonets historik presenteras kronologiskt. Händelsetyper ska minst omfatta:

- Service
- Verkstadsbesök
- Reparation
- Underhåll
- Besiktning
- Däckbyte
- Mätarställning
- Tillbehör/uppgradering
- Skada/försäkringsärende
- Tvätt/rekond
- Programvaruuppdatering
- Återkallelse/kampanj
- Kostnad
- Anteckning

En händelse kan ha datum/tid, mätarställning, leverantör, kostnader, anteckningar, bilder, dokument och relaterade komponenter.

## 5. Mätarställning

Mätarställningar ska lagras historiskt, inte bara som ett aktuellt värde. Systemet ska kunna beräkna körsträcka per period, uppskattad årskörning och distans mellan händelser. Motstridiga eller minskande värden ska flaggas för granskning.

## 6. Service och underhåll

Användaren ska kunna registrera genomförd service och skapa underhållsregler baserade på datum, körsträcka eller båda. Status ska minst stödja `OK`, `Kommande`, `Snart` och `Förfallen`.

Exempel: bromsvätska vartannat år; kupéfilter var 30 000 km eller 24 månader; besiktning före ett visst datum.

## 7. Däck och hjul

Däck/hjuluppsättningar ska vara egna objekt. Systemet ska kunna lagra dimension, fabrikat/modell, DOT, inköpsdatum, pris, lufttryck och mönsterdjup.

Montering och demontering registreras med datum och mätarställning. Total körsträcka för respektive uppsättning ska beräknas automatiskt över flera säsonger. Däckrotation och individuella mönsterdjup ska kunna registreras.

## 8. Ekonomi

Kostnader ska kunna kopplas till fordon, händelser och dokument. Kategorier inkluderar minst finansiering/leasing, försäkring, skatt, energi/bränsle, service, reparation, däck, besiktning, tillbehör och övrigt.

Appen ska kunna visa månad, YTD, år, kostnad per km/mil samt fasta kontra rörliga kostnader. Månatliga kostnadsunderlag i PDF ska kunna sparas som originalkällor och deras värden registreras strukturerat.

På sikt ska Total Cost of Ownership kunna beräknas inklusive värdeminskning.

## 9. Dokumentinkorg

Användaren ska kunna ladda upp en eller många filer samtidigt. Dokument kan vara fakturor, kvitton, serviceprotokoll, besiktningsunderlag, försäkringshandlingar och månadsrapporter.

Importflöde:

`Uploaded → Analyzed → Needs review/Ready → Approved → Imported`

Analysen ska kunna föreslå fordon, datum, mätarställning, leverantör, händelsetyp, kostnad och poster. Systemet ska försöka gruppera flera dokument som beskriver samma verkliga händelse.

Varje extraherat värde ska kunna bära provenance/källreferens och confidence. Originaldokumentet ska förbli länkat till skapade poster.

AI/document extraction ska vara provider-oberoende och inte krävas för manuell användning.

## 10. Bilder och galleri

Varje fordon ska ha ett galleri. En bild kan användas som profil/cover och tillhöra ett eller flera album utan fysisk duplicering.

Vid uppladdning ska tillgänglig metadata läsas, bland annat `captured_at`, GPS, kamera/enhet och orientering. `captured_at` ska hållas separat från `uploaded_at`. Originalmetadata ska bevaras så långt formatet tillåter.

Bilder ska kunna kopplas till händelser och visas i tidslinjen. Platsdata ska vara frivillig och kunna döljas/raderas separat.

## 11. Dokument och filer

Originalfiler ska lagras persistent. Webboptimerade derivat/thumbnails får skapas separat. Dokument ska kunna kopplas direkt till fordon eller till specifika händelser, kostnader och komponenter.

## 12. Leverantörer

Verkstäder, däckfirmor och andra leverantörer ska kunna återanvändas mellan händelser. Historik och total kostnad per leverantör ska kunna visas.

## 13. Sökning

Global sökning ska kunna hitta fordon, registreringsnummer, händelser, däck, leverantörer, dokument och relevanta metadata. Desktop ska stödja command palette, exempelvis `Ctrl/Cmd + K`.

## 14. Dashboard

Dashboarden ska primärt besvara:

1. Hur mår fordonen?
2. Behöver något göras?
3. Vad har hänt nyligen?
4. Vad kostar fordonen?

Den ska inte fyllas med grafer som saknar beslutssyfte.

## 15. Import/export och portabilitet

Data ska kunna exporteras i maskinläsbart format. På sikt ska en bil kunna exporteras som ett komplett överlämningspaket/PDF inför försäljning. Backup ska omfatta både databas och originalfiler.

## 16. API och integrationer

Domänfunktionerna ska exponeras genom ett stabilt API så att framtida integrationer kan byggas utan att UI eller databas kringgås. Möjliga framtida integrationer inkluderar fordons-API:er, Home Assistant och ladd-/energikällor.

## 17. Icke-funktionella krav

- Docker Compose för installation
- Responsivt webbgränssnitt
- Fungerar på modern desktop, tablet och mobil
- Persistent databas och fillagring
- Tydlig backup/restore
- Ingen extern AI- eller molntjänst krävs för kärnfunktionerna
- Tillgänglighetsmål: WCAG 2.2 AA där rimligt
- Svenska som första språk, struktur för framtida i18n
