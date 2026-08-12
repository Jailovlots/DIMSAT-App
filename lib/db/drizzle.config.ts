import { defineConfig } from "drizzle-kit";

import fs from "node:fs";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  try {
    const envPath = path.resolve(process.cwd(), "../../.env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const [key, ...vals] = trimmed.split("=");
          if (key && !(key.trim() in process.env)) {
            process.env[key.trim()] = vals.join("=").trim();
          }
        }
      }
    }
  } catch {}
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
