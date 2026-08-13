import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use((req, res, next) => {
  if (process.env.CLERK_SECRET_KEY || process.env.CLERK_PUBLISHABLE_KEY) {
    try {
      clerkMiddleware()(req, res, (err) => {
        if (err) {
          logger.warn({ err }, "Clerk auth warning");
        }
        next();
      });
    } catch (e) {
      logger.warn({ err: e }, "Clerk middleware execution warning");
      next();
    }
  } else {
    next();
  }
});

app.use("/api", router);

// Serve static frontend files if built (e.g. attendance-console dist)
const currentDir = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
const consoleDistPath = path.resolve(currentDir, "../../attendance-console/dist/public");
const fallbackConsoleDistPath = path.resolve(currentDir, "../../attendance-console/dist");

const staticPath = fs.existsSync(consoleDistPath)
  ? consoleDistPath
  : fs.existsSync(fallbackConsoleDistPath)
  ? fallbackConsoleDistPath
  : null;

// Serve the student-attendance Expo web export under /student
const studentDistPath = path.resolve(currentDir, "../../student-attendance/dist");
if (fs.existsSync(studentDistPath)) {
  app.use("/student", express.static(studentDistPath));
  // SPA fallback — deep links inside the student app all resolve to its index.html
  app.get("/student/{*path}", (_req, res, next) => {
    const indexPath = path.join(studentDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

if (staticPath) {
  app.use(express.static(staticPath));
  // Express 5 / path-to-regexp v8 requires named wildcards — "/{*path}" instead of "*"
  app.get("/{*path}", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/student")) return next();
    const indexPath = path.join(staticPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Unhandled API error");
  res.status(err?.status || err?.statusCode || 500).json({
    error: err?.message || "Internal Server Error",
  });
});

export default app;
