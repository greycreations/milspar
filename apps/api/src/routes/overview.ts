import type { FastifyInstance } from "fastify";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { events, maintenanceRules, vehicles } from "../db/schema.js";
import { vehicleService } from "../services/vehicles.js";
import { maintenanceStatus } from "../services/book-domain.js";

export async function overviewRoutes(app: FastifyInstance) {
  app.get("/overview", async () => {
    const summaries = await vehicleService.list();
    const latest = await db.select({ event: events, registration: vehicles.registrationNumber }).from(events).innerJoin(vehicles, eq(events.vehicleId, vehicles.id)).where(and(isNull(events.deletedAt), isNull(vehicles.deletedAt))).orderBy(desc(events.occurredAt)).limit(20);
    const rules = await db.select({ rule: maintenanceRules, registration: vehicles.registrationNumber }).from(maintenanceRules).innerJoin(vehicles, eq(maintenanceRules.vehicleId, vehicles.id)).where(and(isNull(maintenanceRules.deletedAt), isNull(vehicles.deletedAt), isNull(maintenanceRules.completedEventId)));
    return { events: latest.map(({ event, registration }) => ({ id: event.id, vehicleId: event.vehicleId, registration, title: event.data.title, occurredAt: event.occurredAt.toISOString() })),
      maintenance: rules.map(({ rule, registration }) => {
        const km = summaries.find(v => v.id === rule.vehicleId)?.currentOdometerKm ?? null;
        return { id: rule.id, vehicleId: rule.vehicleId, registration, title: rule.data.title, dueOn: rule.data.dueOn, dueKm: rule.data.dueKm, status: maintenanceStatus(rule.data, false, km), mileageUnknown: rule.data.dueKm !== null && km === null };
      }).sort((a, b) => ["overdue", "soon", "upcoming"].indexOf(a.status) - ["overdue", "soon", "upcoming"].indexOf(b.status) || (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999")) };
  });
}
