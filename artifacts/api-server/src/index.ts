import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  const currentDir = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
  const possiblePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(currentDir, "../../.env"),
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

process.env.NODE_ENV = process.env.NODE_ENV || "development";

const { default: app } = await import("./app");
const { logger } = await import("./lib/logger");

const rawPort = process.env["PORT"] || "5000";

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
