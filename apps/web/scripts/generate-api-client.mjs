import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

import openapiTS, { astToString } from "openapi-typescript";

const schemaSource = process.env.OPENAPI_SCHEMA_URL ?? "http://127.0.0.1:3001/api/openapi.json";
const schemaUrl = URL.canParse(schemaSource)
  ? new URL(schemaSource)
  : new URL(schemaSource, import.meta.url);
const outputUrl = new URL("../lib/api/openapi.generated.ts", import.meta.url);
const outputPath = fileURLToPath(outputUrl);
const syntaxTree = await openapiTS(schemaUrl, {
  alphabetize: true,
});
const source = `// 此文件由 pnpm api:generate 自动生成，请勿手工编辑。\n${astToString(syntaxTree)}`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, source, "utf8");
process.stdout.write(`OpenAPI types generated from ${schemaUrl.origin}\n`);
