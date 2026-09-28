# Milspår — Domain & Data Model v1.0

Detta är en logisk modell, inte ett låst SQL-schema. Implementation får normalisera detaljer men ska bevara domänens relationer och provenance.

## Kärnobjekt

### Vehicle

Fordonets identitet och masterdata.

Relationer: många Events, OdometerReadings, TireSets, Documents, MediaAssets, Expenses och MaintenanceRules.

### Event

Den centrala historiknoden.

Fält: `id`, `vehicle_id`, `type`, `title`, `description`, `occurred_at`, optional `odometer_reading_id`, `vendor_id`, timestamps.

En Event kan länka många Documents, MediaAssets, Expenses, ServiceItems och Components.

### OdometerReading

`vehicle_id`, `value_km`, `recorded_at`, `source_type`, optional `source_document_id`, `event_id`, provenance/confidence.

Aktuell mätarställning ska härledas från giltig historik, inte lagras som enda sanningskälla.

### ServiceItem

En konkret utförd åtgärd inom en service-/verkstadshändelse: namn, kategori, parts/labor-data, optional cost.

### MaintenanceRule

Regel för framtida behov. Stödjer intervall i tid, distans eller båda, samt explicit due date/odometer.

### TireSet

En hjuluppsättning med namn, säsong och fälguppgifter: benämning, fabrikat/modell, diameter/bredd, färg och valfria ET/bultmönster. Dimensioner kan skilja fram/bak. Se NEXT-RELEASE-PLAN.md för nästa leverans.

### TireBatch (däckomgång)

Tillhör TireSet och bevarar däckens fabrikat, modell, dimensioner, införskaffningsdatum och valfria DOT/typ/inköpspris. Byte av slitna däck skapar en ny omgång så tidigare historik inte skrivs om.

### TireFitment

Period då en TireSet med en bestämd TireBatch är monterad på ett Vehicle. Kopplas till hjulbytets Event. Högst en aktiv period per fordon/uppsättning; saknade km ger ofullständig distans och överlapp/negativa differenser kräver granskning. `mounted_at`, `mounted_odometer`, `removed_at`, `removed_odometer`. Distans summeras över avslutade perioder och pågående period mot senaste odometer.

### TireMeasurement

Mönsterdjup/tryck vid ett datum och mätarställning. Ska kunna stödja per-position measurements.

### Expense

Strukturerad kostnad: `vehicle_id`, optional `event_id`, category, amount, currency, date, fixed/variable classification, vendor och source document.

### MonthlyCostStatement

Representerar ett månatligt kostnadsunderlag. Kan länka original-PDF och flera Expenses samt periodstart/slut.

### Document

Originalfil med metadata: filnamn, MIME, storlek, hash, storage key, uploaded_at. Dokument kan länkas many-to-many till Events och andra domänobjekt via associationer.

### DocumentExtraction

Ett analysförsök mot Document: provider/version, status, raw/normalized extraction, started/completed timestamps.

### ProposedRecord

Förslag skapat från extraction före permanent import. Innehåller target type, normalized payload, confidence, field-level provenance och review state.

### Provenance

För ett importerat värde ska det vid behov gå att härleda `document → extraction → proposed field → approved domain value`. Provenance kan lagras per fält för viktiga importerade värden.

### MediaAsset

Originalbild/media med MIME, hash, dimensions, storage key, uploaded_at och captured_at. EXIF/metadata lagras separat/strukturerat. GPS är optional och privacy-sensitive.

### Album

Tillhör Vehicle. MediaAsset ↔ Album är many-to-many. Ett MediaAsset kan vara Vehicle cover utan duplicerad fil.

### Vendor

Verkstad, däckfirma, försäkringsaktör eller annan leverantör. Återanvänds mellan Events/Expenses.

### Component

Spårbar komponent/tillbehör på bilen, exempelvis 12 V-batteri, torkarblad eller dragkrok. Kan ha installation/removal events, inköpskostnad och garanti.

## Viktiga relationer

```text
Vehicle 1 ── * Event
Vehicle 1 ── * OdometerReading
Vehicle 1 ── * TireSet
Vehicle 1 ── * MaintenanceRule
Vehicle 1 ── * Expense
Vehicle 1 ── * Document
Vehicle 1 ── * MediaAsset

Event * ── * Document
Event * ── * MediaAsset
Event 1 ── * Expense
Event 1 ── * ServiceItem

TireSet 1 ── * TireFitment
Document 1 ── * DocumentExtraction
DocumentExtraction 1 ── * ProposedRecord
Album * ── * MediaAsset
```

## Datainvarianter

1. Alla fordonsrelaterade poster ska ha en entydig Vehicle-koppling, direkt eller härledd.
2. Odometer lagras internt i kilometer; UI kan senare konvertera enhet.
3. Monetära värden lagras som decimal/minor units, aldrig binary float.
4. Timestamps lagras timezone-aware; `captured_at`/`occurred_at` behåller relevant tidszon när känd.
5. Originalfil ersätts inte av thumbnail/preview.
6. Filhash används för dedupliceringsvarning men systemet får inte automatiskt slå ihop semantiskt olika poster.
7. AI-extraktion är aldrig den enda representationen av originalkällan.
8. En ProposedRecord får inte bli permanent domändata utan explicit eller policy-styrd approval; v1 utgår från explicit approval.
9. Historiska poster ska normalt soft-delete/auditeras hellre än försvinna utan spår.

## Indexeringsbehov

Indexera minst Vehicle registration/VIN, Event occurred_at/type, Odometer vehicle/date/value, Expense vehicle/date/category, Document hash, Media captured_at samt fulltextsökbara titlar/anteckningar/leverantörer.

## Framtida utökning

Modellen ska kunna utökas med användare/households, permissions, fuel/charging sessions, trips, external telemetry och import providers utan att Event-modellen behöver ersättas.
