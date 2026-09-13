#!/usr/bin/env node
/**
 * Points prisma/schema.prisma at the right database engine before `prisma
 * generate` runs.
 *
 * Prisma does not accept env() for a datasource provider, but the schema is
 * otherwise identical for SQLite and Postgres — so instead of keeping two
 * schemas in sync, this rewrites the single provider line from the
 * DATABASE_PROVIDER environment variable.
 *
 *   (unset) | sqlite   -> local development, file-backed database
 *   postgresql         -> hosted deployments (Vercel, Render, Fly, …)
 *
 * Writing nothing when the provider already matches keeps the file out of
 * `git status` during normal local work.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED = new Set(["sqlite", "postgresql"]);

const schemaPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "prisma",
  "schema.prisma",
);

const requested = (process.env.DATABASE_PROVIDER ?? "sqlite").trim().toLowerCase();

if (!SUPPORTED.has(requested)) {
  console.error(
    `[db] DATABASE_PROVIDER="${requested}" is not supported. Use one of: ${[...SUPPORTED].join(", ")}.`,
  );
  process.exit(1);
}

const schema = readFileSync(schemaPath, "utf8");
const providerLine = /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")([a-z]+)(")/s;
const match = schema.match(providerLine);

if (!match) {
  console.error("[db] Could not find the datasource provider in prisma/schema.prisma.");
  process.exit(1);
}

if (match[2] === requested) {
  console.log(`[db] provider already set to "${requested}"`);
  process.exit(0);
}

writeFileSync(schemaPath, schema.replace(providerLine, `$1${requested}$3`));
console.log(`[db] provider switched from "${match[2]}" to "${requested}"`);
