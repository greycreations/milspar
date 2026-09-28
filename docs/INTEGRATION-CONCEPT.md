# Future vehicle data integrations — conceptual contract

No manufacturer connection is implemented or required by the manual service book.

An adapter will expose supported observation types, discover vehicles after explicit owner authorization, and fetch observations since a cursor. Normalize to vehicle identity, kind, value, unit, observedAt, receivedAt, source/provider and externalId. Define a stable deduplication key per provider/vehicle/externalId; distinguish provider retry from a genuinely separate manual entry.

Pass normalized historical mileage through the same domain validation as manual reading events. Out-of-order, decreasing or contradictory observations must be reviewed; never overwrite manual history or silently accept the largest number. Keep received time separate from observed time, and show source/freshness. Ephemeral battery/charging values should use a latest-observation store, not fill the service timeline.

First implementation milestone: select one manufacturer's officially available access method, verify terms and capabilities, implement read-only mileage with replay/deduplication tests and stale/error states. Only then consider other makes, battery/charging and Home Assistant. Do not assume all brands expose real-time updates.

Keep credentials server-side in protected installation secrets; never commit tokens or log them. Back off after errors/rate limits, preserve cursors and support disconnection/revocation. No remote vehicle control or location collection is part of the current plan. Avoid speculative provider frameworks or queue infrastructure until an actual adapter requires them.
