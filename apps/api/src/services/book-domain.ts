import type { BookEvent, Fitment, MaintenanceInput, TireBatch } from "@milspar/contracts";

export class DomainError extends Error {
  constructor(public statusCode: number, message: string, public code = "invalid_operation") { super(message); }
}
export function requireRevision(expected: number | undefined, actual: number) {
  if (expected !== actual) throw new DomainError(409, "Uppgifterna har ändrats. Ladda om sidan innan du sparar.", "stale_revision");
}
export function deriveFitments(events: BookEvent[], batches: TireBatch[], latest: { valueKm: number; recordedAt: Date } | undefined): Fitment[] {
  const periods: Fitment[] = [];
  let active: Fitment | undefined;
  let previousTime = "";
  const changes = events.filter(e => e.type === "wheel_change").sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  for (const event of changes) {
    if (event.occurredAt === previousTime) throw new DomainError(409, "Två hjulbyten kan inte ha samma tidpunkt.");
    previousTime = event.occurredAt;
    const batch = event.wheelBatchId ? batches.find(b => b.id === event.wheelBatchId) : undefined;
    if (event.wheelBatchId && !batch) throw new DomainError(409, "Däckomgången finns inte på fordonet.");
    if (batch?.acquiredOn && event.occurredAt.slice(0, 10) < batch.acquiredOn) throw new DomainError(409, "Monteringen kan inte ske före däckens införskaffningsdatum.");
    if (active?.batchId === batch?.id && active) throw new DomainError(409, "Den däckomgången är redan monterad vid tidpunkten.");
    if (!active && !batch) throw new DomainError(409, "Det finns inga monterade hjul att demontera vid tidpunkten.");
    if (active) {
      active.removedAt = event.occurredAt; active.removedKm = event.odometerKm;
      if (active.mountedKm !== null && active.removedKm !== null) {
        active.distanceKm = active.removedKm - active.mountedKm;
        active.anomaly = active.distanceKm < 0;
      }
    }
    active = batch ? { eventId: event.id, batchId: batch.id, wheelSetId: batch.wheelSetId, mountedAt: event.occurredAt, mountedKm: event.odometerKm, removedAt: null, removedKm: null, distanceKm: null, anomaly: false } : undefined;
    if (active) periods.push(active);
  }
  if (active && latest && latest.recordedAt.toISOString() >= active.mountedAt && active.mountedKm !== null) {
    active.distanceKm = latest.valueKm - active.mountedKm;
    active.anomaly = active.distanceKm < 0;
  }
  return periods;
}
export function maintenanceStatus(rule: MaintenanceInput, completed: boolean, currentKm: number | null, today = new Date().toISOString().slice(0, 10)) {
  if (completed) return "done" as const;
  if ((rule.dueOn && rule.dueOn < today) || (rule.dueKm !== null && currentKm !== null && currentKm >= rule.dueKm)) return "overdue" as const;
  const soon = new Date(today + "T12:00:00Z"); soon.setUTCDate(soon.getUTCDate() + 30);
  if ((rule.dueOn && rule.dueOn <= soon.toISOString().slice(0, 10)) || (rule.dueKm !== null && currentKm !== null && rule.dueKm - currentKm <= 1000)) return "soon" as const;
  return "upcoming" as const;
}
export function addMonths(day: string, months: number) {
  const source = new Date(day + "T12:00:00Z"), target = new Date(source);
  target.setUTCDate(1); target.setUTCMonth(target.getUTCMonth() + months);
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(source.getUTCDate(), last)); return target.toISOString().slice(0, 10);
}
