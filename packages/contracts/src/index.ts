import { z } from "zod";

export const vehicleIdSchema = z.string().uuid();

export const createVehicleSchema = z.object({
  registrationNumber: z.string().trim().min(1).max(16).transform((value) => value.toUpperCase()),
  vin: z.string().trim().min(5).max(32).optional().or(z.literal("")),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  variant: z.string().trim().max(120).optional(),
  modelYear: z.number().int().min(1886).max(2200).optional(),
  color: z.string().trim().max(80).optional(),
  currentOdometerKm: z.number().int().nonnegative().optional(),
});

export const vehicleSummarySchema = z.object({
  id: vehicleIdSchema,
  registrationNumber: z.string(),
  make: z.string(),
  model: z.string(),
  variant: z.string().nullable(),
  modelYear: z.number().int().nullable(),
  currentOdometerKm: z.number().int().nonnegative().nullable(),
  coverImageUrl: z.string().url().nullable(),
});

export type CreateVehicle = z.input<typeof createVehicleSchema>;
export type VehicleSummary = z.infer<typeof vehicleSummarySchema>;

export const odometerReadingSchema = z.object({
  id: vehicleIdSchema,
  valueKm: z.number().int().nonnegative(),
  recordedAt: z.string().datetime(),
  sourceType: z.string(),
});

export const vehicleDetailSchema = vehicleSummarySchema.extend({
  vin: z.string().nullable(),
  color: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  odometerReadings: z.array(odometerReadingSchema).max(50),
  hasMoreReadings: z.boolean(),
});
export type VehicleDetail = z.infer<typeof vehicleDetailSchema>;
