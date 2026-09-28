import { z } from "zod";

const text = z.string().trim().max(4000);
const short = z.string().trim().max(160);
export const kmSchema = z.number().int().min(0).max(2147483647);
const money = z.number().int().min(0).max(2147483647);
const date = z.iso.date();
export const eventInputSchema = z.object({
  type: z.enum(["odometer", "note", "service", "repair", "workshop", "wheel_change"]),
  title: short.min(1), occurredAt: z.iso.datetime().transform(v => new Date(v).toISOString()), description: text.default(""),
  odometerKm: kmSchema.nullable().default(null), vendor: short.default(""),
  items: z.array(short.min(1)).max(100).default([]),
  costMinor: money.nullable().default(null), currency: z.enum(["SEK", "EUR", "NOK", "DKK"]).default("SEK"),
  wheelBatchId: z.string().uuid().nullable().default(null),
  confirmOdometer: z.boolean().default(false),
  confirmSchedule: z.boolean().default(false),
  revision: z.number().int().positive().optional(),
  requestId: z.string().uuid().optional(),
}).refine(v => v.type !== "odometer" || v.odometerKm !== null, { message: "Mätarställning krävs", path: ["odometerKm"] });
export type EventInput = z.infer<typeof eventInputSchema>;
export type BookEvent = EventInput & { id: string; vehicleId: string; revision: number; anomaly: boolean; createdAt: string };

export const wheelSetSchema = z.object({
  name: short.min(1), season: z.enum(["summer", "winter", "all_season"]),
  rimName: short.default(""), rimMake: short.default(""), rimModel: short.default(""),
  rimDiameter: z.number().min(8).max(40).nullable().default(null),
  rimWidth: z.number().min(2).max(20).nullable().default(null),
  rearDiameter: z.number().min(8).max(40).nullable().default(null),
  rearWidth: z.number().min(2).max(20).nullable().default(null),
  color: short.default(""), offset: short.default(""), boltPattern: short.default(""), notes: text.default(""),
  revision: z.number().int().positive().optional(),
});
export type WheelSetInput = z.infer<typeof wheelSetSchema>;
export type WheelSet = WheelSetInput & { id: string; revision: number };
export const tireBatchSchema = z.object({
  wheelSetId: z.string().uuid(), make: short.min(1), model: short.min(1),
  dimension: short.default(""), rearDimension: short.default(""),
  acquiredOn: date.nullable().default(null), kind: z.enum(["studded", "friction", "summer", "all_season", "unknown"]).default("unknown"),
  dot: short.default(""), costMinor: money.nullable().default(null), notes: text.default(""),
  revision: z.number().int().positive().optional(),
});
export type TireBatchInput = z.infer<typeof tireBatchSchema>;
export type TireBatch = TireBatchInput & { id: string; revision: number };
export type Fitment = { eventId: string; batchId: string; wheelSetId: string; mountedAt: string; removedAt: string | null; mountedKm: number | null; removedKm: number | null; distanceKm: number | null; anomaly: boolean };

export const maintenanceSchema = z.object({
  title: short.min(1), dueOn: date.nullable().default(null), dueKm: kmSchema.nullable().default(null),
  intervalMonths: z.number().int().min(1).max(120).nullable().default(null),
  intervalKm: kmSchema.min(1).nullable().default(null), notes: text.default(""),
  revision: z.number().int().positive().optional(),
}).refine(v => v.dueOn !== null || v.dueKm !== null, { message: "Ange datum eller mätarställning för nästa åtgärd" });
export type MaintenanceInput = z.infer<typeof maintenanceSchema>;
export type MaintenanceRule = MaintenanceInput & { id: string; revision: number; completedEventId: string | null; status: "overdue" | "soon" | "upcoming" | "done"; mileageUnknown: boolean };
export type Asset = { id: string; filename: string; mime: string; size: number; sha256: string; uploadedAt: string; capturedAt: string | null; eventId: string | null; url: string; previewUrl: string | null };
export type ServiceBook = { events: BookEvent[]; wheelSets: WheelSet[]; tireBatches: TireBatch[]; fitments: Fitment[]; maintenance: MaintenanceRule[]; assets: Asset[]; totals: { currency: string; amountMinor: number }[] };
export const updateVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(16).transform(v => v.toUpperCase()),
  make: short.min(1), model: short.min(1), variant: short.nullable(), vin: z.string().trim().min(5).max(32).nullable(),
  modelYear: z.number().int().min(1886).max(2200).nullable(), color: short.nullable(), notes: text.nullable(),
  expectedUpdatedAt: z.iso.datetime(),
});
