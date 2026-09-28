import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, ne, or } from "drizzle-orm";
import { eventInputSchema, wheelSetSchema, tireBatchSchema, maintenanceSchema, updateVehicleSchema, type BookEvent, type EventInput, type ServiceBook, type TireBatch } from "@milspar/contracts";
import { db } from "../db/client.js";
import { assets, auditLog, events, maintenanceRules, odometerReadings, tireBatches, vehicles, wheelSets } from "../db/schema.js";
import { addMonths, deriveFitments, DomainError, maintenanceStatus, requireRevision } from "./book-domain.js";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function lockVehicle(tx: Transaction, id: string) {
  const [vehicle] = await tx.select().from(vehicles).where(and(eq(vehicles.id, id), isNull(vehicles.deletedAt))).for("update");
  if (!vehicle) throw new DomainError(404, "Fordonet finns inte.");
  return vehicle;
}
export async function audit(tx: Transaction, vehicleId: string, entityId: string, kind: string, action: string, before: unknown, after: unknown) {
  await tx.insert(auditLog).values({ vehicleId, entityId, kind, action, before, after });
}
function eventView(row: typeof events.$inferSelect): BookEvent {
  return { ...row.data, id: row.id, vehicleId: row.vehicleId, revision: row.revision, anomaly: row.anomaly, occurredAt: row.occurredAt.toISOString(), createdAt: row.createdAt.toISOString() };
}
async function activeEvents(tx: Transaction, vehicleId: string) {
  return (await tx.select().from(events).where(and(eq(events.vehicleId, vehicleId), isNull(events.deletedAt))).orderBy(desc(events.occurredAt), desc(events.createdAt))).map(eventView);
}
async function activeBatches(tx: Transaction, vehicleId: string): Promise<TireBatch[]> {
  return (await tx.select().from(tireBatches).where(and(eq(tireBatches.vehicleId, vehicleId), isNull(tireBatches.deletedAt)))).map(r => ({ ...r.data, id: r.id, revision: r.revision }));
}
export const bookService = {
  async get(vehicleId: string): Promise<ServiceBook> {
    return db.transaction(async tx => {
      // A consistent snapshot across events, fitments, linked readings and totals.
      await lockVehicle(tx, vehicleId);
      const history = await activeEvents(tx, vehicleId);
      const batches = await activeBatches(tx, vehicleId);
      const latest = (await tx.select().from(odometerReadings).where(and(eq(odometerReadings.vehicleId, vehicleId), isNull(odometerReadings.deletedAt))).orderBy(desc(odometerReadings.recordedAt), desc(odometerReadings.createdAt), desc(odometerReadings.id)).limit(1))[0];
      const sets = await tx.select().from(wheelSets).where(and(eq(wheelSets.vehicleId, vehicleId), isNull(wheelSets.deletedAt)));
      const rules = await tx.select().from(maintenanceRules).where(and(eq(maintenanceRules.vehicleId, vehicleId), isNull(maintenanceRules.deletedAt)));
      const files = await tx.select().from(assets).where(and(eq(assets.vehicleId, vehicleId), isNull(assets.deletedAt))).orderBy(desc(assets.createdAt));
      const totals = new Map<string, number>();
      const year = new Date().getUTCFullYear();
      for (const e of history) if (new Date(e.occurredAt).getUTCFullYear() === year && e.costMinor !== null) totals.set(e.currency, (totals.get(e.currency) ?? 0) + e.costMinor);
      return {
        events: history, wheelSets: sets.map(r => ({ ...r.data, id: r.id, revision: r.revision })), tireBatches: batches,
        fitments: deriveFitments(history, batches, latest),
        maintenance: rules.map(r => ({ ...r.data, id: r.id, revision: r.revision, completedEventId: r.completedEventId, status: maintenanceStatus(r.data, Boolean(r.completedEventId), latest?.valueKm ?? null), mileageUnknown: r.data.dueKm !== null && !latest })),
        assets: files.map(r => ({ id: r.id, filename: r.filename, mime: r.mime, size: r.size, sha256: r.sha256, uploadedAt: r.createdAt.toISOString(), capturedAt: r.capturedAt?.toISOString() ?? null, eventId: r.eventId, url: `/api/v1/vehicles/${vehicleId}/assets/${r.id}/original`, previewUrl: r.previewKey ? `/api/v1/vehicles/${vehicleId}/assets/${r.id}/preview` : null })),
        totals: [...totals].map(([currency, amountMinor]) => ({ currency, amountMinor })),
      };
    });
  },
  async updateVehicle(vehicleId: string, body: unknown) {
    const input = updateVehicleSchema.parse(body);
    return db.transaction(async tx => {
      const previous = await lockVehicle(tx, vehicleId);
      if (previous.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new DomainError(409, "Fordonet har ändrats. Ladda om innan du sparar.");
      const { expectedUpdatedAt, ...data } = input;
      const [next] = await tx.update(vehicles).set({ ...data, updatedAt: new Date() }).where(eq(vehicles.id, vehicleId)).returning();
      await audit(tx, vehicleId, vehicleId, "vehicle", "update", previous, next);
      return { id: vehicleId };
    });
  },
  async saveEvent(vehicleId: string, body: unknown, id?: string) {
    const input = eventInputSchema.parse(body);
    return db.transaction(async tx => {
      await lockVehicle(tx, vehicleId);
      return saveEvent(tx, vehicleId, input, id);
    });
  },
  async removeEvent(vehicleId: string, id: string, revision: number) {
    return db.transaction(async tx => {
      await lockVehicle(tx, vehicleId);
      return removeEvent(tx, vehicleId, id, revision);
    });
  },
  async saveSet(vehicleId: string, body: unknown, id?: string) {
    const data = wheelSetSchema.parse(body);
    return db.transaction(async tx => {
      await lockVehicle(tx, vehicleId);
      const previous = id ? (await tx.select().from(wheelSets).where(and(eq(wheelSets.id, id), eq(wheelSets.vehicleId, vehicleId), isNull(wheelSets.deletedAt))))[0] : undefined;
      if (id && !previous) throw new DomainError(404, "Hjuluppsättningen finns inte.");
      if (previous) requireRevision(data.revision, previous.revision);
      const [next] = previous ? await tx.update(wheelSets).set({ data, revision: previous.revision + 1 }).where(eq(wheelSets.id, previous.id)).returning() : await tx.insert(wheelSets).values({ vehicleId, data }).returning();
      await audit(tx, vehicleId, next!.id, "wheel_set", previous ? "update" : "create", previous, next);
      return { id: next!.id };
    });
  },
  async saveBatch(vehicleId: string, body: unknown, id?: string) {
    const data = tireBatchSchema.parse(body);
    return db.transaction(async tx => {
      await lockVehicle(tx, vehicleId);
      const [set] = await tx.select().from(wheelSets).where(and(eq(wheelSets.id, data.wheelSetId), eq(wheelSets.vehicleId, vehicleId), isNull(wheelSets.deletedAt)));
      if (!set) throw new DomainError(404, "Hjuluppsättningen finns inte på fordonet.");
      const previous = id ? (await tx.select().from(tireBatches).where(and(eq(tireBatches.id, id), eq(tireBatches.vehicleId, vehicleId), isNull(tireBatches.deletedAt))))[0] : undefined;
      if (id && !previous) throw new DomainError(404, "Däckomgången finns inte.");
      if (previous) {
        requireRevision(data.revision, previous.revision);
        if (data.wheelSetId !== previous.wheelSetId) throw new DomainError(409, "En däckomgång kan inte flyttas till andra fälgar. Skapa en ny omgång.");
      }
      const candidateId = id ?? randomUUID();
      const batches = (await activeBatches(tx, vehicleId)).filter(b => b.id !== candidateId);
      batches.push({ ...data, id: candidateId, revision: (previous?.revision ?? 0) + 1 });
      deriveFitments(await activeEvents(tx, vehicleId), batches, undefined);
      const [next] = previous ? await tx.update(tireBatches).set({ data, revision: previous.revision + 1 }).where(eq(tireBatches.id, previous.id)).returning() : await tx.insert(tireBatches).values({ id: candidateId, vehicleId, wheelSetId: data.wheelSetId, data }).returning();
      await audit(tx, vehicleId, candidateId, "tire_batch", previous ? "update" : "create", previous, next);
      return { id: candidateId };
    });
  },
  async saveMaintenance(vehicleId: string, body: unknown, id?: string) {
    const data = maintenanceSchema.parse(body);
    return db.transaction(async tx => {
      await lockVehicle(tx, vehicleId);
      const previous = id ? (await tx.select().from(maintenanceRules).where(and(eq(maintenanceRules.id, id), eq(maintenanceRules.vehicleId, vehicleId), isNull(maintenanceRules.deletedAt))))[0] : undefined;
      if (id && !previous) throw new DomainError(404, "Underhållsregeln finns inte.");
      if (previous) requireRevision(data.revision, previous.revision);
      const [next] = previous ? await tx.update(maintenanceRules).set({ data, revision: previous.revision + 1 }).where(eq(maintenanceRules.id, previous.id)).returning() : await tx.insert(maintenanceRules).values({ vehicleId, data }).returning();
      await audit(tx, vehicleId, next!.id, "maintenance", previous ? "update" : "create", previous, next);
      return { id: next!.id };
    });
  },
  async completeMaintenance(vehicleId: string, id: string, body: unknown) {
    const input = eventInputSchema.parse(body);
    return db.transaction(async tx => {
      await lockVehicle(tx, vehicleId);
      const [rule] = await tx.select().from(maintenanceRules).where(and(eq(maintenanceRules.id, id), eq(maintenanceRules.vehicleId, vehicleId), isNull(maintenanceRules.deletedAt)));
      if (!rule) throw new DomainError(404, "Underhållsregeln finns inte.");
      if (rule.completedEventId === input.requestId) return saveEvent(tx, vehicleId, { ...input, revision: undefined });
      if (rule.completedEventId) throw new DomainError(409, "Åtgärden är redan genomförd.");
      requireRevision(input.revision, rule.revision);
      if (!["service", "repair", "workshop"].includes(input.type)) throw new DomainError(400, "Välj service, reparation eller verkstadsbesök.");
      if (rule.data.intervalKm !== null && input.odometerKm === null) throw new DomainError(400, "Mätarställning behövs för nästa kilometerintervall.");
      const created = await saveEvent(tx, vehicleId, { ...input, revision: undefined });
      await tx.update(maintenanceRules).set({ completedEventId: created.id, revision: rule.revision + 1 }).where(eq(maintenanceRules.id, id));
      if (rule.data.intervalKm !== null || rule.data.intervalMonths !== null) {
        const data = { ...rule.data, revision: undefined, dueOn: rule.data.intervalMonths ? addMonths(input.occurredAt.slice(0, 10), rule.data.intervalMonths) : null, dueKm: rule.data.intervalKm !== null ? input.odometerKm! + rule.data.intervalKm : null };
        maintenanceSchema.parse(data);
        await tx.insert(maintenanceRules).values({ vehicleId, data, originEventId: created.id });
      }
      await audit(tx, vehicleId, id, "maintenance", "complete", rule, { eventId: created.id });
      return created;
    });
  },
  async removeResource(vehicleId: string, kind: "wheel_sets" | "tire_batches" | "maintenance_rules", id: string, revision: number) {
    return db.transaction(async tx => {
      await lockVehicle(tx, vehicleId);
      const table = kind === "wheel_sets" ? wheelSets : kind === "tire_batches" ? tireBatches : maintenanceRules;
      const [row] = await tx.select().from(table).where(and(eq(table.id, id), eq(table.vehicleId, vehicleId), isNull(table.deletedAt)));
      if (!row) throw new DomainError(404, "Posten finns inte.");
      requireRevision(revision, row.revision);
      if (kind === "wheel_sets" && (await activeBatches(tx, vehicleId)).some(b => b.wheelSetId === id)) throw new DomainError(409, "Uppsättningen har däckomgångar. Ta bort okopplade omgångar först; historiska omgångar bevaras.");
      if (kind === "tire_batches" && (await activeEvents(tx, vehicleId)).some(e => e.wheelBatchId === id)) throw new DomainError(409, "Däckomgången används i hjulhistoriken. Korrigera de kopplade bytena först.");
      await tx.update(table).set({ deletedAt: new Date(), revision: row.revision + 1 }).where(eq(table.id, id));
      await audit(tx, vehicleId, id, kind, "delete", row, null);
    });
  },
};

async function saveEvent(tx: Transaction, vehicleId: string, input: EventInput, id?: string) {
  if (!id && input.requestId) {
    const [existing] = await tx.select().from(events).where(eq(events.id, input.requestId));
    if (existing) {
      const { revision: _revision, requestId: _request, ...sent } = input;
      const { revision: _oldRevision, requestId: _oldRequest, ...stored } = eventInputSchema.parse(existing.data);
      if (existing.vehicleId !== vehicleId || existing.deletedAt || JSON.stringify(sent) !== JSON.stringify(stored)) throw new DomainError(409, "Den här registreringen har redan behandlats med andra uppgifter. Ladda om och kontrollera historiken.");
      return { id: existing.id };
    }
  }
  if (new Date(input.occurredAt).getTime() > Date.now() + 60000) throw new DomainError(400, "En genomförd händelse kan inte ligga i framtiden. Använd underhåll för planerade åtgärder.");
  const previous = id ? (await tx.select().from(events).where(and(eq(events.id, id), eq(events.vehicleId, vehicleId), isNull(events.deletedAt))))[0] : undefined;
  if (id && !previous) throw new DomainError(404, "Händelsen finns inte.");
  if (previous) requireRevision(input.revision, previous.revision);
  const candidateId = id ?? input.requestId ?? randomUUID();
  const others = await tx.select().from(odometerReadings).where(and(eq(odometerReadings.vehicleId, vehicleId), isNull(odometerReadings.deletedAt), or(isNull(odometerReadings.eventId), ne(odometerReadings.eventId, candidateId)))).orderBy(asc(odometerReadings.recordedAt));
  const anomaly = input.odometerKm !== null && others.some(r => r.recordedAt.toISOString() <= input.occurredAt ? r.valueKm > input.odometerKm! : r.valueKm < input.odometerKm!);
  if (anomaly && !input.confirmOdometer) throw new DomainError(409, "Mätarställningen avviker från tidigare eller senare avläsningar. Kontrollera värdet och bekräfta avvikelsen för att spara.", "odometer_conflict");
  const candidate: BookEvent = { ...input, wheelBatchId: input.type === "wheel_change" ? input.wheelBatchId : null, id: candidateId, vehicleId, revision: (previous?.revision ?? 0) + 1, anomaly, createdAt: previous?.createdAt.toISOString() ?? new Date().toISOString() };
  const history = (await activeEvents(tx, vehicleId)).filter(e => e.id !== candidateId);
  history.push(candidate);
  deriveFitments(history, await activeBatches(tx, vehicleId), undefined);
  const [completion] = await tx.select().from(maintenanceRules).where(and(eq(maintenanceRules.completedEventId, candidateId), isNull(maintenanceRules.deletedAt))).limit(1);
  if (completion && previous && (previous.occurredAt.toISOString() !== input.occurredAt || previous.data.odometerKm !== input.odometerKm)) {
    if (!input.confirmSchedule) throw new DomainError(409, "Ändringen räknar om nästa underhåll. Bekräfta omräkningen för att fortsätta.");
    const [successor] = await tx.select().from(maintenanceRules).where(and(eq(maintenanceRules.originEventId, candidateId), isNull(maintenanceRules.deletedAt)));
    if (successor?.completedEventId) throw new DomainError(409, "Nästa underhåll är redan genomfört. Korrigera senare händelser först.");
    if (completion.data.intervalKm !== null && input.odometerKm === null) throw new DomainError(400, "Nästa kilometerintervall kräver en mätarställning.");
    if (successor) {
      const updated = maintenanceSchema.parse({ ...successor.data, dueOn: completion.data.intervalMonths ? addMonths(input.occurredAt.slice(0, 10), completion.data.intervalMonths) : null, dueKm: completion.data.intervalKm !== null ? input.odometerKm! + completion.data.intervalKm : null });
      await tx.update(maintenanceRules).set({ data: updated, revision: successor.revision + 1 }).where(eq(maintenanceRules.id, successor.id));
      await audit(tx, vehicleId, successor.id, "maintenance", "reschedule", successor.data, updated);
    }
  }
  const { id: _id, vehicleId: _vehicle, anomaly: _anomaly, createdAt: _created, ...data } = candidate;
  if (previous) await tx.update(events).set({ data, occurredAt: new Date(input.occurredAt), anomaly, revision: candidate.revision }).where(eq(events.id, candidateId));
  else await tx.insert(events).values({ id: candidateId, vehicleId, data, occurredAt: new Date(input.occurredAt), anomaly });
  const [existingReading] = await tx.select().from(odometerReadings).where(eq(odometerReadings.eventId, candidateId));
  if (input.odometerKm !== null) {
    const values = { valueKm: input.odometerKm, recordedAt: new Date(input.occurredAt), deletedAt: null };
    if (existingReading) await tx.update(odometerReadings).set(values).where(eq(odometerReadings.id, existingReading.id));
    else await tx.insert(odometerReadings).values({ ...values, vehicleId, eventId: candidateId, sourceType: "manual" });
  } else if (existingReading) await tx.update(odometerReadings).set({ deletedAt: new Date() }).where(eq(odometerReadings.id, existingReading.id));
  await audit(tx, vehicleId, candidateId, "event", previous ? "update" : "create", previous, candidate);
  return { id: candidateId };
}
export async function removeEvent(tx: Transaction, vehicleId: string, id: string, revision: number) {
  const [previous] = await tx.select().from(events).where(and(eq(events.id, id), eq(events.vehicleId, vehicleId), isNull(events.deletedAt)));
  if (!previous) throw new DomainError(404, "Händelsen finns inte.");
  requireRevision(revision, previous.revision);
  const [completedRule] = await tx.select().from(maintenanceRules).where(and(eq(maintenanceRules.completedEventId, id), isNull(maintenanceRules.deletedAt)));
  const [successor] = await tx.select().from(maintenanceRules).where(and(eq(maintenanceRules.originEventId, id), isNull(maintenanceRules.deletedAt)));
  if (successor?.completedEventId) throw new DomainError(409, "Ett senare underhåll är genomfört. Ta bort eller korrigera senare händelser först.");
  if (successor) {
    await tx.update(maintenanceRules).set({ deletedAt: new Date(), revision: successor.revision + 1 }).where(eq(maintenanceRules.id, successor.id));
    await audit(tx, vehicleId, successor.id, "maintenance", "cancel_successor", successor, null);
  }
  if (completedRule) {
    await tx.update(maintenanceRules).set({ completedEventId: null, revision: completedRule.revision + 1 }).where(eq(maintenanceRules.id, completedRule.id));
    await audit(tx, vehicleId, completedRule.id, "maintenance", "reopen", completedRule, null);
  }
  deriveFitments((await activeEvents(tx, vehicleId)).filter(e => e.id !== id), await activeBatches(tx, vehicleId), undefined);
  await tx.update(events).set({ deletedAt: new Date(), revision: previous.revision + 1 }).where(eq(events.id, id));
  await tx.update(odometerReadings).set({ deletedAt: new Date() }).where(eq(odometerReadings.eventId, id));
  // Keep attachments accessible in the vehicle archive when their event is removed.
  await tx.update(assets).set({ eventId: null }).where(and(eq(assets.vehicleId, vehicleId), eq(assets.eventId, id)));
  await audit(tx, vehicleId, id, "event", "delete", previous, null);
  return { id };
}
