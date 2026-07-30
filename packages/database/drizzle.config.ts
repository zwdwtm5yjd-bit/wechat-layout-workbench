import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  strict: true,
  verbose: true,
  migrations: {
    prefix: "index",
    table: "__drizzle_migrations",
    schema: "drizzle",
  },
});
