import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import exifr from "exifr";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { assets, events, vehicles } from "../db/schema.js";
import { audit, lockVehicle } from "../services/book.js";
import { DomainError } from "../services/book-domain.js";
import { LocalStorage } from "../services/storage.js";

const uuid = z.string().uuid();
export async function assetRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 1, fields: 0, parts: 1 } });
  const storage = new LocalStorage();
  type Params = { id: string; assetId: string };
  app.addHook("preHandler", async r => { for (const value of Object.values(r.params as Record<string, string>)) uuid.parse(value); });
  app.post<{ Params: Params; Querystring: { eventId?: string } }>("/vehicles/:id/assets", async (r, reply) => {
    const eventId = r.query.eventId ? uuid.parse(r.query.eventId) : null;
    const file = await r.file();
    if (!file) throw new DomainError(400, "Välj en fil.");
    const buffer = await file.toBuffer();
    if (!buffer.length) throw new DomainError(400, "Filen är tom.");
    const id = randomUUID(), originalKey = `${id}.bin`;
    let mime: string, preview: Buffer | undefined, capturedAt: Date | null = null;
    if (buffer.subarray(0, 5).toString() === "%PDF-") mime = "application/pdf";
    else {
      try {
        const image = sharp(buffer, { limitInputPixels: 40000000, animated: false, failOn: "error" });
        const metadata = await image.metadata();
        if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) throw new Error("Unsupported image");
        mime = metadata.format === "jpeg" ? "image/jpeg" : `image/${metadata.format}`;
        preview = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        // Original EXIF stays in the original file; only capture date is stored, never GPS.
        try { const metadataDate = await exifr.parse(buffer, { pick: ["DateTimeOriginal"] }); if (metadataDate?.DateTimeOriginal instanceof Date && !Number.isNaN(metadataDate.DateTimeOriginal.getTime())) capturedAt = metadataDate.DateTimeOriginal; } catch { /* Missing EXIF is valid. */ }
      } catch { throw new DomainError(400, "Filen måste vara en läsbar JPEG-, PNG-, WebP-bild eller PDF (högst 20 MB och 40 megapixlar)."); }
    }
    if (file.mimetype !== mime && file.mimetype !== "application/octet-stream") throw new DomainError(400, "Filtypen stämmer inte med filens innehåll.");
    const previewKey = preview ? `${id}.webp` : null;
    const written: string[] = [];
    try {
      await storage.put(originalKey, buffer); written.push(originalKey);
      if (preview && previewKey) { await storage.put(previewKey, preview); written.push(previewKey); }
      await db.transaction(async tx => {
        await lockVehicle(tx, r.params.id);
        if (eventId && !(await tx.select().from(events).where(and(eq(events.id, eventId), eq(events.vehicleId, r.params.id), isNull(events.deletedAt)))).length) throw new DomainError(404, "Händelsen finns inte på fordonet.");
        const filename = file.filename.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 200) || "bilaga";
        await tx.insert(assets).values({ id, vehicleId: r.params.id, eventId, filename, mime, size: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex"), originalKey, previewKey, capturedAt });
        await audit(tx, r.params.id, id, "asset", "upload", null, { filename, eventId });
      });
    } catch (error) { await Promise.allSettled(written.map(key => storage.remove(key))); throw error; }
    return reply.code(201).send({ id });
  });
  for (const variant of ["original", "preview"] as const) app.get<{ Params: Params }>(`/vehicles/:id/assets/:assetId/${variant}`, async (r, reply) => {
    const [file] = await db.select({ asset: assets }).from(assets).innerJoin(vehicles, eq(vehicles.id, assets.vehicleId)).where(and(eq(assets.id, r.params.assetId), eq(assets.vehicleId, r.params.id), isNull(assets.deletedAt), isNull(vehicles.deletedAt)));
    const key = variant === "preview" ? file?.asset.previewKey : file?.asset.originalKey;
    if (!file || !key) throw new DomainError(404, "Filen finns inte.");
    reply.header("X-Content-Type-Options", "nosniff").header("Cache-Control", "private, no-store");
    reply.type(variant === "preview" ? "image/webp" : file.asset.mime);
    reply.header("Content-Disposition", variant === "preview" ? "inline" : `attachment; filename*=UTF-8''${encodeURIComponent(file.asset.filename)}`);
    return reply.send(storage.read(key));
  });
  app.put<{ Params: Params }>("/vehicles/:id/assets/:assetId", async r => {
    const input = z.object({ eventId: uuid.nullable() }).parse(r.body);
    await db.transaction(async tx => {
      await lockVehicle(tx, r.params.id);
      const [file] = await tx.select().from(assets).where(and(eq(assets.id, r.params.assetId), eq(assets.vehicleId, r.params.id), isNull(assets.deletedAt)));
      if (!file) throw new DomainError(404, "Filen finns inte.");
      if (input.eventId && !(await tx.select().from(events).where(and(eq(events.id, input.eventId), eq(events.vehicleId, r.params.id), isNull(events.deletedAt)))).length) throw new DomainError(404, "Händelsen finns inte på fordonet.");
      await tx.update(assets).set({ eventId: input.eventId }).where(eq(assets.id, file.id));
      await audit(tx, r.params.id, file.id, "asset", "link", { eventId: file.eventId }, input);
    });
    return { id: r.params.assetId };
  });
  app.put<{ Params: Params }>("/vehicles/:id/cover", async r => {
    const input = z.object({ assetId: uuid.nullable() }).parse(r.body);
    await db.transaction(async tx => {
      const vehicle = await lockVehicle(tx, r.params.id);
      if (input.assetId && !(await tx.select().from(assets).where(and(eq(assets.id, input.assetId), eq(assets.vehicleId, r.params.id), isNull(assets.deletedAt)))).some(a => a.previewKey)) throw new DomainError(400, "Välj en bild från fordonets galleri.");
      await tx.update(vehicles).set({ coverAssetId: input.assetId, updatedAt: new Date() }).where(eq(vehicles.id, r.params.id));
      await audit(tx, r.params.id, r.params.id, "vehicle", "cover", { assetId: vehicle.coverAssetId }, input);
    });
    return { id: r.params.id };
  });
  app.delete<{ Params: Params }>("/vehicles/:id/assets/:assetId", async (r, reply) => {
    await db.transaction(async tx => {
      const vehicle = await lockVehicle(tx, r.params.id);
      const [file] = await tx.select().from(assets).where(and(eq(assets.id, r.params.assetId), eq(assets.vehicleId, r.params.id), isNull(assets.deletedAt)));
      if (!file) throw new DomainError(404, "Filen finns inte.");
      await tx.update(assets).set({ deletedAt: new Date() }).where(eq(assets.id, file.id));
      if (vehicle.coverAssetId === file.id) await tx.update(vehicles).set({ coverAssetId: null, updatedAt: new Date() }).where(eq(vehicles.id, vehicle.id));
      await audit(tx, r.params.id, file.id, "asset", "delete", { eventId: file.eventId, filename: file.filename }, null);
    });
    return reply.code(204).send();
  });
}
