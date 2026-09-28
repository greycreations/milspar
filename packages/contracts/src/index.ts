import { z } from "zod";

export const vehicleIdSchema = z.string().uuid();

export const vehicleSummarySchema = z.object({
  id: vehicleIdSchema,
  registrationNumber: z.string().min(1),
  make: z.string().min(1),
  model: z.string().min(1),
  currentOdometerKm: z.number().int().nonnegative().nullable(),
  coverImageUrl: z.string().url().nullable(),
});

export type VehicleSummary = z.infer<typeof vehicleSummarySchema>;
