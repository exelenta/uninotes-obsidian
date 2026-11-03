// Generate src/api-types.ts from the server's API contract (../contract/openapi.json).
// The contract is owned by stage 1: regenerate it with `python -m uninotes.cli export-openapi`
// in server/, then run `npm run gen:api` here. Never edit src/api-types.ts by hand.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const here = path.dirname(fileURLToPath(import.meta.url));
const spec = path.resolve(here, "../../contract/openapi.json");
const out = path.resolve(here, "../src/api-types.ts");

const ast = await openapiTS(pathToFileURL(spec));
const header =
  "// GENERATED from contract/openapi.json by plugin/scripts/gen-api-types.mjs. Do not edit.\n" +
  "// Regenerate: (server) python -m uninotes.cli export-openapi  ->  (plugin) npm run gen:api\n\n";
fs.writeFileSync(out, header + astToString(ast).replace(/\r\n/g, "\n"));
console.log(`wrote ${path.relative(process.cwd(), out)}`);
