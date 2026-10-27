import fs from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  try {
    const possiblePaths = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "../../.env"),
    ];
    for (const envPath of possiblePaths) {
      if (fs.existsSync(envPath)) {
        if (typeof process.loadEnvFile === "function") {
          process.loadEnvFile(envPath);
        } else {
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
        if (process.env.DATABASE_URL) break;
      }
    }
  } catch {
    // ignore
  }
}

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isRemoteDb = process.env.DATABASE_URL.includes("neon.tech") || process.env.DATABASE_URL.includes("sslmode=require");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isRemoteDb ? { ssl: { rejectUnauthorized: false } } : {}),
  // Keep connections alive and prevent dead socket hangs on Neon / cloud poolers
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  connectionTimeoutMillis: 7000, // Fail/reconnect fast (7s) instead of hanging for minutes if TCP dropped
  idleTimeoutMillis: 15000, // Prune idle pooler connections after 15s to avoid stale sockets
  max: 10,
});

pool.on("error", (err) => {
  // Prevent unhandled errors from breaking the process when idle pooler connections drop
  console.warn("[db:pool] Unexpected idle database client error (will auto-reconnect):", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
