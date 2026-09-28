# ADR 0008: Shared manual service book and seasonal wheels

Status: accepted, 2026-09-28. Implements NEXT-RELEASE-PLAN.md.

## Events and consistency

One Event model drives notes, odometer updates, service, repair, workshop visits and wheel changes. Relational IDs and foreign keys own vehicle, file and reading links; type-dependent event fields use JSONB validated by shared Zod contracts. Costs are integer minor units with explicit currency. Aggregate currencies separately and derive totals from events once; tire purchase price is informational until registered as an event cost.

Migration 0002 backfills original odometer history into events without changing IDs, timestamps or deleted state of readings. Each event has at most one linked reading. Vehicle mutations lock the active parent row in a transaction. Revision checks protect edits from stale forms; audit_log preserves prior/new content and deletion. Authentication/actor identity remains future work. Odometer anomalies require explicit confirmation; do not silently clamp decreases to zero.

## Wheels

WheelSet owns rim identity/dimensions/color/season. TireBatch is a separate tire generation linked to those rims; acquiring replacement tires creates a new batch. Correction edits are audited. Wheel-change events reference the batch, or null for removal only.

TireFitment is a derived read model, replayed chronologically from active wheel-change events inside the vehicle transaction. This intentionally avoids storing a second mutable copy of the same periods. Before writes or deletions, replay the candidate history and reject invalid duplicate/overlapping states, missing/foreign batches and impossible acquisition dates. A change atomically closes the prior period, opens the next and synchronizes its odometer reading by changing the single source event. Unknown endpoints yield unknown distance; decreasing endpoints are flagged. Concurrent changes serialize on the vehicle row.

## Maintenance

Rules may use date, km or both. "Soon" is within 30 days or 1,000 km, documented in the UI. Missing mileage is explicitly shown. Completion creates a service event and, for recurring rules, a successor with originEventId. Calendar month addition clamps to the month's last day. Correcting the completion's date/km requires explicit acknowledgement and reschedules the successor. Removing it reopens the source rule and removes the pending successor. Completed downstream rules must be corrected first.

## Files

LocalStorage implements StorageProvider with server-generated UUID keys. Uploads support JPEG/PNG/WebP/PDF, at most 20 MB; image decoding is bounded to 40 megapixels. Validate content, normalize orientation and generate a separate WebP preview. Preserve the original bytes and SHA-256. Extract available EXIF capture time; GPS stays in the original and is not copied to searchable metadata. EXIF without a timezone may not establish an exact UTC instant; the original remains authoritative.

A file belongs to a vehicle and can currently link to one event at a time; a profile image references that same stored asset. Removing an event detaches its file links to the vehicle archive. Removing an asset hides it and clears its cover reference while retaining original storage for traceability. Original responses force download and disable MIME sniffing. Serving requires an active vehicle and active asset. There is no public file listing, external storage dependency or automatic file merge. HEIC, multiple simultaneous event links, and permanent purge remain future extensions.

## Delivery

Keep the locked design and one-file Compose installation. Test real nginx/PostgreSQL/browser workflows and the prior installed release upgrade. Backup/restore must include PostgreSQL, original/preview files and the version/configuration. CI restores into an isolated stack and verifies original bytes. No automatic merge into main is implied by publishing a preview.
