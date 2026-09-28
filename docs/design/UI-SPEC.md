# Milspår — UI/UX Specification v1.0

## 1. Informationsarkitektur

Tre nivåer:

`Global app → Fordon → Funktion/innehåll`

Global navigation:

- Översikt
- Fordon
- Underhåll
- Däck
- Ekonomi
- Inkorg
- Dokument
- Inställningar

Fordonsnavigation:

- Översikt
- Tidslinje
- Underhåll
- Däck
- Ekonomi
- Galleri
- Dokument
- Mer

## 2. Responsiv strategi

Milspår använder **mobile-first input + desktop-first overview**.

### Mobile `<768px`

- En kolumn
- Bottom navigation för primära destinationer
- Central `+` för snabbregistrering
- Bottom sheets framför stora modaler
- Minst 44×44 px touch targets
- Sekundär fordonsnavigation får vara horisontellt scrollbar
- Tabeller transformeras normalt till list/card-layout

Rekommenderad bottom navigation: `Hem | Bil | + | Inkorg | Mer`.

### Tablet `768–1199px`

- Kollapsbar sidebar/drawer
- En eller två kolumner beroende på innehåll
- Touchvänliga kontroller
- Split view endast när utrymme räcker

### Desktop `>=1200px`

- Permanent vänstersidebar
- Flera kolumner
- Datatabeller där de ger nytta
- Split-view för dokumentgranskning
- Drag-and-drop
- Hover states
- Command palette `Ctrl/Cmd + K`

## 3. Dashboard

Dashboarden ska visa:

- Fordonskort med profilbild, mätarställning och status
- Att göra/kommande underhåll
- Senaste händelser
- Ett litet antal relevanta ekonomiska KPI:er

Dashboarden ska inte vara ett BI-verktyg.

## 4. Fordonsöversikt

Header innehåller profilbild/hero, namn, registreringsnummer, aktuell mätarställning, status och primär `+ Lägg till`.

KPI-kort kan visa aktuell mätarställning, nästa åtgärd och kostnad innevarande år. Under detta visas senaste historik och relevanta upcoming actions.

## 5. Snabbregistrering

`+ Lägg till` ska alltid vara lättåtkomlig. Menyn ska minst erbjuda:

- Mätarställning
- Service
- Verkstadsbesök
- Däckbyte
- Kostnad
- Tillbehör
- Bild
- Dokument
- Anteckning

Systemet ska komma ihåg aktivt fordon som default men alltid göra fordonsvalet synligt innan sparande.

## 6. Tidslinje

Tidslinjen är en signaturvy och ska kombinera text, bilder, dokument och kostnader. Kort ska kunna expandera till full händelse. Filter: `Alla`, `Service`, `Däck`, `Kostnader`, `Bilder`, `Mätarställning` samt framtida typer.

## 7. Inkorg

Desktop använder split-view: originaldokument/bild vänster, föreslagna data höger. Mobil använder vertikal layout.

Varje analys visar tydligt:

- föreslaget fordon
- datum
- mätarställning
- typ
- leverantör
- kostnader
- confidence/osäkerheter
- vilka poster som kommer skapas

Användaren ska kunna korrigera innan `Godkänn import`.

Batchläge ska ge översikt över `Analyserade`, `Redo`, `Behöver granskas` och `Importerade`.

## 8. Däck

Översikten visar varje uppsättning som ett objekt med status `Monterad/Förvarad`, total körsträcka, dimension och senaste mönsterdjup. Byte ska vara ett optimerat snabbflöde: datum + mätarställning + från/till uppsättning, med avancerade fält valfria.

## 9. Ekonomi

Ekonomivyn ska kunna växla mellan månad, år och total. Primära KPI:er: total kostnad, genomsnitt/månad och kostnad per km/mil. Kostnadskategorier ska vara drill-down, inte bara diagram.

## 10. Galleri

Galleri stödjer `Alla bilder`, album och tidsbaserad visning. Profilbild kan väljas från galleri. Bilddetalj visar captured time, upload time, plats om tillåtet, metadata, album och kopplade händelser.

## 11. Global sökning

Desktop: `Ctrl/Cmd + K`. Mobil: sökikon/overlay. Resultat grupperas per typ och ska kunna hoppa direkt till rätt fordon och kontext.

## 12. Empty states

Tomma vyer ska förklara nyttan och erbjuda nästa handling. Exempel: `Inga däckuppsättningar ännu` + `Lägg till däckuppsättning`. Undvik tomma tabeller utan vägledning.

## 13. Loading/error

Använd skeletons för normala laddningar. Spara-operationer ska ge tydlig progress och resultat. Uppladdning/import får aldrig tappa användarens filer tyst. Fel ska beskriva vad som gick fel och om åtgärden kan försökas igen.

## 14. Tillgänglighet

- Tangentbordsnavigation på desktop
- Synlig focus state
- Semantiska labels
- Färg är aldrig enda statusbärare
- Tillräcklig kontrast
- Respektera `prefers-reduced-motion`

## 15. Navigation invariant

Implementation får inte lägga till nya globala huvudnavigationer för enskilda features utan produktbeslut. Funktioner ska i första hand placeras under befintlig informationsarkitektur.
