# ADR 0007: Removing vehicles and individual readings

Status: accepted, 2026-09-28.

Users need to remove vehicles and incorrect individual entries. Removal uses a timestamp rather than physical deletion, following the domain requirement to retain historical records. Removed rows are excluded from normal API reads, history and current mileage calculations. The UI requires a confirmation naming the vehicle and, for readings, value and date. Cancel receives initial focus; failures permit retry. A missing resource on retry is treated as already removed.

DELETE /api/v1/vehicles/:id hides the vehicle and its history. DELETE /api/v1/vehicles/:id/odometer-readings/:readingId removes only that vehicle's active reading. The latter locks the active parent vehicle so a concurrent vehicle removal cannot be bypassed. Invalid IDs return 400, absent/removed or mismatched resources 404, successful removal 204.

Migration 0001 adds deleted_at and replaces global registration/VIN uniqueness with partial unique indexes for active vehicles. Reusing an identity creates a new vehicle ID and does not inherit removed history. Existing records and readings remain intact. Database readiness requires the new columns. Back up before upgrading; rolling back to an older application is not a supported restore procedure.

This is removal from the application, not permanent data erasure. Restore and permanent purge are not exposed in the UI. There is no authenticated actor to record yet. Future Event/document/cost removal must follow the same confirmation and traceability principles, with explicit rules for shared links; do not cascade-delete shared originals.
