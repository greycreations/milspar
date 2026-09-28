import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  read(key: string): ReturnType<typeof createReadStream>;
  remove(key: string): Promise<void>;
}
export class LocalStorage implements StorageProvider {
  constructor(private root = process.env.UPLOAD_PATH ?? "./uploads") {}
  private resolve(key: string) {
    if (!/^[a-f0-9-]{36}\.(bin|webp)$/.test(key)) throw new Error("Invalid storage key");
    return path.join(path.resolve(this.root), key);
  }
  async put(key: string, data: Buffer) { await mkdir(this.root, { recursive: true }); await writeFile(this.resolve(key), data, { flag: "wx" }); }
  read(key: string) { return createReadStream(this.resolve(key)); }
  async remove(key: string) { await unlink(this.resolve(key)); }
}
