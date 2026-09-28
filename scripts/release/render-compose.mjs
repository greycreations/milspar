import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const [output] = process.argv.slice(2);
assert.ok(output, "Pass output directory");
const { WEB_IMAGE, API_IMAGE, DB_IMAGE, RELEASE_VERSION } = process.env;
for (const image of [WEB_IMAGE, API_IMAGE, DB_IMAGE]) {
  assert.match(image ?? "", /^[a-z0-9./:_-]+@sha256:[a-f0-9]{64}$/, "Images must be pinned by digest");
}
assert.match(RELEASE_VERSION ?? "", /^v\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/);
let yaml = readFileSync(new URL("../../release/docker-compose.template.yml", import.meta.url), "utf8");
for (const [key, value] of Object.entries({ WEB_IMAGE, API_IMAGE, DB_IMAGE, RELEASE_VERSION })) {
  yaml = yaml.replaceAll("__" + key + "__", value);
}
assert.ok(!/__[A-Z_]+__|\bbuild:|env_file:|include:|\$\{/.test(yaml), "Release must be self-contained");
mkdirSync(output, { recursive: true });
writeFileSync(output + "/docker-compose.yml", yaml);
console.log("Generated standalone Compose for", RELEASE_VERSION);
