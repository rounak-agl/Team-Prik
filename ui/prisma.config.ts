import path from "node:path";
import { defineConfig } from "prisma/config";

const dbPath = path.resolve(process.cwd(), "prisma/dev.db");

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: `file:${dbPath}`,
  },
});
