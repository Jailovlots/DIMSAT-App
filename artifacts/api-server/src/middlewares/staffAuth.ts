import { getAuth } from "@clerk/express";
import { and, count, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { appUsersTable } from "@workspace/db";
import { db } from "@workspace/db";

export type StaffRequest = Request & {
  staff?: {
    id: number;
    clerkUserId: string;
    role: string;
    fullName: string;
  };
};

async function resolveStaff(req: Request) {
  const auth = getAuth(req);
  const clerkUserId = auth.userId;
  if (!clerkUserId) return null;

  const claims = auth.sessionClaims as Record<string, unknown> | undefined;
  const email =
    (typeof claims?.email === "string" && claims.email) ||
    `${clerkUserId}@attenda.local`;
  const fullName =
    (typeof claims?.name === "string" && claims.name) ||
    (typeof claims?.firstName === "string" && claims.firstName) ||
    "Staff user";

  const existing = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.clerkUserId, clerkUserId))
    .limit(1);
  if (existing[0]) return existing[0];

  const [{ value }] = await db.select({ value: count() }).from(appUsersTable);
  const [created] = await db
    .insert(appUsersTable)
    .values({
      clerkUserId,
      email,
      fullName,
      role: Number(value) === 0 ? "admin" : "officer",
    })
    .returning();
  return created;
}

export async function requireStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = await resolveStaff(req);
    if (!staff) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    (req as StaffRequest).staff = staff;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const staff = (req as StaffRequest).staff;
  if (!staff || staff.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function getStaff(req: Request) {
  return (req as StaffRequest).staff;
}