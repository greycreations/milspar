# ADR 0006: Vehicle detail and initial read-only timeline

Status: accepted, 2026-09-28.

Vehicle cards link to #vehicles/:id and #vehicles/:id/timeline. Hash navigation keeps direct links, reload and browser back compatible with the existing static nginx deployment. No server rewrite or additional router dependency is required for this small slice. A larger navigation tree may justify a routing library later.

The detail API extends the existing vehicle response with a shared, runtime-validated contract. Current mileage is derived using the same recorded-at/created-at/id ordering as the list. Return up to 50 readings with an explicit hasMoreReadings indicator; older records remain stored. No schema change is necessary.

This timeline initially shows odometer readings only. It does not create an alternative event model. The next writing workflows must implement the planned shared Event model and decreasing/conflicting mileage review. Do not present missing cost or maintenance support as zero or a healthy status.

Use the locked design and navigation breakpoints: mobile below 768 px, collapsible tablet navigation to 1199 px, permanent desktop sidebar from 1200 px. Cover upload and full event registration remain separate slices.
