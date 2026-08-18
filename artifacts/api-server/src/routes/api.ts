import { Router } from "express";
import { asc, count, desc, eq, ilike, or, sql, and, ne } from "drizzle-orm";
import {
  certifiedStudentsTable,
  studentImportBatchesTable,
  eventsTable,
  attendanceSessionsTable,
  attendanceRecordsTable,
  eventQrTokensTable,
  officersTable,
  systemSettingsTable,
  auditLogsTable,
  attendanceQrCodesTable,
  qrAssignmentsTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import crypto from "node:crypto";
import * as XLSX from "xlsx";

const router = Router();

function sanitizeProfilePhoto(photo?: string | null): string | null {
  if (!photo || typeof photo !== "string") return null;
  const trimmed = photo.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  if (
    trimmed.startsWith("file:") ||
    trimmed.startsWith("ph:") ||
    trimmed.startsWith("content:") ||
    trimmed.startsWith("blob:")
  ) {
    return null;
  }
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  return null;
}

// Auto-ensure required schema columns and tables exist in physical database
(async () => {
  try {
    await db.execute(sql`ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS late_threshold_minutes INTEGER NOT NULL DEFAULT 15;`);
    await db.execute(sql`ALTER TABLE officers ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'officer';`);
    await db.execute(sql`ALTER TABLE officers ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS attendance_qr_codes (
        id SERIAL PRIMARY KEY,
        qr_name TEXT NOT NULL,
        secure_token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS qr_assignments (
        id SERIAL PRIMARY KEY,
        qr_code_id INTEGER NOT NULL,
        event_id INTEGER NOT NULL,
        session_id INTEGER,
        activated_by INTEGER,
        activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deactivated_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'active'
      );
    `);

    // Ensure default Permanent Attendance QR Code exists
    const existing = await db
      .select()
      .from(attendanceQrCodesTable)
      .where(eq(attendanceQrCodesTable.secureToken, "ZDSPGC_PERMANENT_QR_01"))
      .limit(1);

    if (!existing[0]) {
      await db.insert(attendanceQrCodesTable).values({
        qrName: "Attendance QR #01",
        secureToken: "ZDSPGC_PERMANENT_QR_01",
        status: "active",
      });
    }
  } catch (err) {
    console.error("Startup migration check error:", err);
  }
})();

// ─── UTILITY HELPERS ─────────────────────────────────────────────────────────

function parseMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getManilaTime(): { hours: number; minutes: number; currentMinutes: number; timeString: string; dateString: string } {
  const now = new Date();
  const manilaFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = manilaFormatter.formatToParts(now);
  const hours = Number(parts.find((p) => p.type === "hour")?.value ?? now.getHours());
  const minutes = Number(parts.find((p) => p.type === "minute")?.value ?? now.getMinutes());
  const currentMinutes = hours * 60 + minutes;

  const displayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const timeString = displayFormatter.format(now);

  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateString = dateFormatter.format(now);

  return { hours, minutes, currentMinutes, timeString, dateString };
}

function resolveCurrentSession(
  sessions: (typeof attendanceSessionsTable.$inferSelect)[],
  isManualMode: boolean,
  lateThresholdMinutes: number = 30
): { session: (typeof attendanceSessionsTable.$inferSelect) | null; error?: string } {
  if (!sessions || !sessions.length) {
    return { session: null, error: "No attendance sessions found for this event." };
  }

  const enabledSessions = sessions.filter((s) => s.enabled);
  if (!enabledSessions.length) {
    return { session: null, error: "All attendance sessions for this event are currently disabled." };
  }

  // 1. In manual mode: use the session explicitly marked active by admin
  if (isManualMode) {
    const manuallyActive = enabledSessions.find((s) => s.active);
    if (manuallyActive) return { session: manuallyActive };
    return {
      session: null,
      error: "Manual session mode is enabled, but no session is currently activated by the Admin in Event Settings.",
    };
  }

  // 2. In automatic mode: dynamically resolve based on Philippine Standard Time (Asia/Manila)
  const { currentMinutes, timeString } = getManilaTime();

  // Check which session window is currently open (startTime to endTime + lateThresholdMinutes)
  const activeMatch = enabledSessions.find((s) => {
    const startMins = parseMinutes(s.startTime);
    const endMins = parseMinutes(s.endTime);
    if (endMins >= startMins) {
      return currentMinutes >= startMins && currentMinutes <= (endMins + lateThresholdMinutes);
    }
    // Overnight session (e.g. 21:00 to 02:00)
    return currentMinutes >= startMins || currentMinutes <= (endMins + lateThresholdMinutes);
  });

  if (activeMatch) {
    return { session: activeMatch };
  }

  // If outside all session windows, give an exact helpful reason with session times and current time
  const upcoming = enabledSessions
    .map((s) => ({ s, startMins: parseMinutes(s.startTime) }))
    .filter((x) => x.startMins > currentMinutes)
    .sort((a, b) => a.startMins - b.startMins)[0];

  if (upcoming) {
    return {
      session: null,
      error: `No attendance session is open right now (${timeString}). Next session "${upcoming.s.name}" opens at ${upcoming.s.startTime}.`,
    };
  }

  const lastSession = enabledSessions[enabledSessions.length - 1];
  return {
    session: null,
    error: `Attendance is closed for today (${timeString}). The last session "${lastSession.name}" (${lastSession.startTime} – ${lastSession.endTime}) has ended.`,
  };
}

// ─── AUTH / STUDENT LOOKUP (dry-run validation, no side effects) ──────────────
router.post("/auth/student/lookup", async (req, res, next) => {
  try {
    const { studentId, fullName } = req.body as { studentId?: string; fullName?: string };

    if (!studentId || !studentId.trim()) {
      res.status(400).json({ error: "Student ID is required." });
      return;
    }

    const cleanStudentId = studentId.trim();
    const cleanFullName = (fullName || "").trim();

    const certifiedList = await db
      .select()
      .from(certifiedStudentsTable)
      .where(ilike(certifiedStudentsTable.studentId, cleanStudentId))
      .limit(1);

    const student = certifiedList[0];
    if (!student) {
      res.status(400).json({ error: "Student ID is not included in the certified student list." });
      return;
    }

    if (student.isRegistered || student.passwordHash) {
      res.status(400).json({ error: "This Student ID is already registered." });
      return;
    }

    if (cleanFullName && student.fullName.toLowerCase().trim() !== cleanFullName.toLowerCase()) {
      res.status(400).json({
        error: `Name mismatch. Certified record for ${student.studentId} is "${student.fullName}".`,
      });
      return;
    }

    res.json({
      student: {
        studentId: student.studentId,
        fullName: student.fullName,
        yearLevel: student.yearLevel,
        program: student.program,
        sex: student.sex,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── AUTH / STUDENT REGISTRATION ──────────────────────────────────────────────
router.post("/auth/student/register", async (req, res, next) => {
  try {
    const { studentId, fullName, password } = req.body as {
      studentId?: string;
      fullName?: string;
      password?: string;
    };

    if (!studentId || !studentId.trim()) {
      res.status(400).json({ error: "Student ID is required." });
      return;
    }

    const cleanStudentId = studentId.trim();
    const cleanFullName = (fullName || "").trim();

    // 1. Check if Student ID exists in certified student list
    const certifiedList = await db
      .select()
      .from(certifiedStudentsTable)
      .where(ilike(certifiedStudentsTable.studentId, cleanStudentId))
      .limit(1);

    const student = certifiedList[0];
    if (!student) {
      res.status(400).json({ error: "Student ID is not included in the certified student list." });
      return;
    }

    // 2. Check if student is already registered
    if (student.isRegistered || student.passwordHash) {
      res.status(400).json({ error: "This Student ID is already registered." });
      return;
    }

    // 3. Optional: Verify full name match if provided
    if (cleanFullName && student.fullName.toLowerCase().trim() !== cleanFullName.toLowerCase()) {
      res.status(400).json({
        error: `Name mismatch. Certified record for ${student.studentId} is "${student.fullName}".`,
      });
      return;
    }

    // 4. Complete registration
    const [updated] = await db
      .update(certifiedStudentsTable)
      .set({
        isRegistered: true,
        passwordHash: password || "student123",
        updatedAt: new Date(),
      })
      .where(eq(certifiedStudentsTable.id, student.id))
      .returning();

    // Log audit
    await db.insert(auditLogsTable).values({
      action: "STUDENT_REGISTER",
      entityType: "student",
      entityId: String(updated.studentId),
      details: `Student registered: ${updated.fullName} (${updated.studentId})`,
    });

    res.status(201).json({
      message: "Registration successful",
      student: {
        id: updated.id,
        studentId: updated.studentId,
        fullName: updated.fullName,
        yearLevel: updated.yearLevel,
        program: updated.program,
        sex: updated.sex,
        status: updated.status,
        profilePhoto: updated.profilePhoto,
        profileUploadCount: updated.profileUploadCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/auth/student/login", async (req, res, next) => {
  try {
    const { studentId, password } = req.body as { studentId?: string; password?: string };

    if (!studentId || !studentId.trim()) {
      res.status(400).json({ error: "Student ID is required." });
      return;
    }

    const cleanStudentId = studentId.trim();

    const certifiedList = await db
      .select()
      .from(certifiedStudentsTable)
      .where(ilike(certifiedStudentsTable.studentId, cleanStudentId))
      .limit(1);

    const student = certifiedList[0];
    if (!student) {
      res.status(400).json({ error: "Student ID is not included in the certified student list." });
      return;
    }

    if (!student.isRegistered) {
      res.status(400).json({ error: "Student account not registered. Please register first." });
      return;
    }

    if (password && student.passwordHash && student.passwordHash !== password) {
      res.status(401).json({ error: "Invalid password." });
      return;
    }

    res.json({
      student: {
        id: student.id,
        studentId: student.studentId,
        fullName: student.fullName,
        yearLevel: student.yearLevel,
        program: student.program,
        sex: student.sex,
        status: student.status,
        profilePhoto: student.profilePhoto,
        profileUploadCount: student.profileUploadCount,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── STUDENT PROFILE & PHOTO UPLOAD ──────────────────────────────────────────

router.get("/student/profile", async (req, res, next) => {
  try {
    const studentId = req.query["studentId"] as string;
    if (!studentId) {
      res.status(400).json({ error: "studentId query parameter is required." });
      return;
    }

    const rows = await db
      .select()
      .from(certifiedStudentsTable)
      .where(ilike(certifiedStudentsTable.studentId, studentId.trim()))
      .limit(1);

    const student = rows[0];
    if (!student) {
      res.status(404).json({ error: "Student record not found." });
      return;
    }

    const settingsRows = await db.select().from(systemSettingsTable).limit(1);
    const maxPhotoUploads = settingsRows[0]?.maxPhotoUploads ?? 2;

    res.json({
      ...student,
      maxPhotoUploads,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/student/photo", async (req, res, next) => {
  try {
    const { studentId, profilePhoto } = req.body as { studentId?: string; profilePhoto?: string };

    if (!studentId || !profilePhoto) {
      res.status(400).json({ error: "studentId and profilePhoto are required." });
      return;
    }

    const rows = await db
      .select()
      .from(certifiedStudentsTable)
      .where(ilike(certifiedStudentsTable.studentId, studentId.trim()))
      .limit(1);

    const student = rows[0];
    if (!student) {
      res.status(404).json({ error: "Student record not found." });
      return;
    }

    const settingsRows = await db.select().from(systemSettingsTable).limit(1);
    const maxPhotoUploads = settingsRows[0]?.maxPhotoUploads ?? 2;

    if (student.profileUploadCount >= maxPhotoUploads) {
      res.status(400).json({
        error: "Maximum profile photo changes reached. Please contact the Admin.",
        uploadCount: student.profileUploadCount,
        maxPhotoUploads,
      });
      return;
    }

    const newUploadCount = student.profileUploadCount + 1;
    const [updated] = await db
      .update(certifiedStudentsTable)
      .set({
        profilePhoto,
        profileUploadCount: newUploadCount,
        updatedAt: new Date(),
      })
      .where(eq(certifiedStudentsTable.id, student.id))
      .returning();

    await db.insert(auditLogsTable).values({
      action: "PROFILE_PHOTO_UPLOAD",
      entityType: "student",
      entityId: updated.studentId,
      details: `Profile photo updated (${newUploadCount}/${maxPhotoUploads})`,
    });

    res.json({
      message: "Profile photo updated successfully",
      profilePhoto: updated.profilePhoto,
      profileUploadCount: updated.profileUploadCount,
      maxPhotoUploads,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/students/:id/reset-photo-count", async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);

    const [updated] = await db
      .update(certifiedStudentsTable)
      .set({ profileUploadCount: 0, updatedAt: new Date() })
      .where(eq(certifiedStudentsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    await db.insert(auditLogsTable).values({
      action: "RESET_PHOTO_COUNT",
      entityType: "student",
      entityId: updated.studentId,
      details: `Photo upload count reset to 0 for ${updated.fullName}`,
    });

    res.json({
      message: "Photo upload count reset successfully.",
      studentId: updated.studentId,
      profileUploadCount: updated.profileUploadCount,
    });
  } catch (err) {
    next(err);
  }
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

router.get("/dashboard", async (_req, res, next) => {
  try {
    const [{ value: studentCount }] = await db.select({ value: count() }).from(certifiedStudentsTable);
    const [{ value: eventCount }] = await db.select({ value: count() }).from(eventsTable);
    const [{ value: attendanceCount }] = await db.select({ value: count() }).from(attendanceRecordsTable);

    const activeSession = await db
      .select({ name: eventsTable.name })
      .from(attendanceSessionsTable)
      .innerJoin(eventsTable, eq(eventsTable.id, attendanceSessionsTable.eventId))
      .where(eq(attendanceSessionsTable.active, true))
      .limit(1);

    const latestEvents = await db
      .select()
      .from(eventsTable)
      .orderBy(desc(eventsTable.createdAt))
      .limit(1);

    const latestEvent = latestEvents[0];
    type SessionPayload = { id: number; name: string; startTime: string; endTime: string; enabled: boolean; active: boolean };
    let latestEventPayload: { id: number; name: string; description: string; eventDate: string; venue: string; status: string; qrStatus: string; sessions: SessionPayload[]; totalStudents: number; presentCount: number } = {
      id: 0,
      name: "No events yet",
      description: "",
      eventDate: new Date().toISOString().split("T")[0]!,
      venue: "",
      status: "draft",
      qrStatus: "not_generated",
      sessions: [],
      totalStudents: 0,
      presentCount: 0,
    };

    if (latestEvent) {
      const sessions = await db
        .select()
        .from(attendanceSessionsTable)
        .where(eq(attendanceSessionsTable.eventId, latestEvent.id));

      const [{ value: totalStudents }] = await db
        .select({ value: count() })
        .from(certifiedStudentsTable);

      const [{ value: presentCount }] = await db
        .select({ value: count() })
        .from(attendanceRecordsTable)
        .where(eq(attendanceRecordsTable.eventId, latestEvent.id));

      latestEventPayload = {
        id: latestEvent.id,
        name: latestEvent.name,
        description: latestEvent.description,
        eventDate: latestEvent.eventDate,
        venue: latestEvent.venue,
        status: latestEvent.status,
        qrStatus: latestEvent.qrStatus,
        sessions: sessions.map((s) => ({
          id: s.id,
          name: s.name,
          startTime: s.startTime,
          endTime: s.endTime,
          enabled: s.enabled,
          active: s.active,
        })),
        totalStudents: Number(totalStudents),
        presentCount: Number(presentCount),
      };
    }

    res.json({
      studentCount: Number(studentCount),
      eventCount: Number(eventCount),
      attendanceCount: Number(attendanceCount),
      activeSession: activeSession[0]?.name ?? null,
      latestEvent: latestEventPayload,
    });
  } catch (err) {
    next(err);
  }
});

// ─── CERTIFIED STUDENTS REGISTRY (ALPHABETICAL + FILTERS) ────────────────────

router.get("/students", async (req, res, next) => {
  try {
    const { search, yearLevel, program, sort = "name", limit } = req.query as {
      search?: string;
      yearLevel?: string;
      program?: string;
      sort?: "name" | "studentId" | "yearLevel" | "program";
      limit?: string;
    };

    const sortMap = {
      name: certifiedStudentsTable.fullName,
      studentId: certifiedStudentsTable.studentId,
      yearLevel: certifiedStudentsTable.yearLevel,
      program: certifiedStudentsTable.program,
    } as const;

    const orderCol = sortMap[sort] ?? certifiedStudentsTable.fullName;

    const conditions = [];
    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(certifiedStudentsTable.fullName, `%${search.trim()}%`),
          ilike(certifiedStudentsTable.studentId, `%${search.trim()}%`),
        ),
      );
    }
    if (yearLevel && yearLevel.trim() && yearLevel !== "all") {
      conditions.push(eq(certifiedStudentsTable.yearLevel, yearLevel.trim()));
    }
    if (program && program.trim() && program !== "all") {
      conditions.push(eq(certifiedStudentsTable.program, program.trim()));
    }

    const maxRows = limit && !isNaN(Number(limit)) ? Math.min(Number(limit), 10000) : 5000;

    const rows = await db
      .select()
      .from(certifiedStudentsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(orderCol))
      .limit(maxRows);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.delete("/students/clear-all", async (_req, res, next) => {
  try {
    const [{ value: countBefore }] = await db
      .select({ value: count() })
      .from(certifiedStudentsTable);

    await db.delete(certifiedStudentsTable);

    await db.insert(auditLogsTable).values({
      action: "CLEAR_ALL_STUDENTS",
      entityType: "certified_student_registry",
      entityId: String(countBefore),
      details: `Cleared all ${countBefore} certified student records from registry`,
    });

    res.json({ message: `Successfully cleared all ${countBefore} student records.`, count: Number(countBefore) });
  } catch (err) {
    next(err);
  }
});

router.delete("/students/:id", async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid student ID." });
      return;
    }

    const rows = await db
      .select()
      .from(certifiedStudentsTable)
      .where(eq(certifiedStudentsTable.id, id))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    await db.delete(certifiedStudentsTable).where(eq(certifiedStudentsTable.id, id));

    await db.insert(auditLogsTable).values({
      action: "REMOVE_STUDENT",
      entityType: "student",
      entityId: String(rows[0].studentId),
      details: `Removed certified student: ${rows[0].fullName} (${rows[0].studentId})`,
    });

    res.json({ message: "Student removed from certified roster.", studentId: rows[0].studentId });
  } catch (err) {
    next(err);
  }
});

router.patch("/students/:id", async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid student ID." });
      return;
    }

    const { fullName, yearLevel, program, sex, profilePhoto } = req.body as {
      fullName?: string;
      yearLevel?: string;
      program?: string;
      sex?: string;
      profilePhoto?: string | null;
    };

    const rows = await db
      .select()
      .from(certifiedStudentsTable)
      .where(eq(certifiedStudentsTable.id, id))
      .limit(1);

    const student = rows[0];
    if (!student) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    const updateFields: Record<string, any> = { updatedAt: new Date() };
    if (fullName !== undefined && fullName.trim()) updateFields.fullName = fullName.trim();
    if (yearLevel !== undefined && yearLevel.trim()) updateFields.yearLevel = yearLevel.trim();
    if (program !== undefined && program.trim()) updateFields.program = program.trim();
    if (sex !== undefined && sex.trim()) updateFields.sex = sex.trim();
    if (profilePhoto !== undefined) updateFields.profilePhoto = sanitizeProfilePhoto(profilePhoto);

    const [updated] = await db
      .update(certifiedStudentsTable)
      .set(updateFields)
      .where(eq(certifiedStudentsTable.id, id))
      .returning();

    await db.insert(auditLogsTable).values({
      action: "UPDATE_STUDENT",
      entityType: "student",
      entityId: String(updated.studentId),
      details: `Updated student record for ${updated.fullName} (${updated.studentId}): Year ${updated.yearLevel}, Program ${updated.program}`,
    });

    res.json({ message: "Student record updated successfully.", student: updated });
  } catch (err) {
    next(err);
  }
});

router.post("/students/import", async (req, res, next) => {
  try {
    const { rows } = req.body as {
      rows: {
        fullName?: string;
        studentId?: string;
        yearLevel?: string;
        program?: string;
        sex?: string;
      }[];
    };

    if (!Array.isArray(rows)) {
      res.status(400).json({ error: "Invalid rows data format." });
      return;
    }

    const total = rows.length;
    let valid = 0;
    let duplicates = 0;
    let invalid = 0;
    let missing = 0;

    const validRowsToInsert: {
      fullName: string;
      studentId: string;
      yearLevel: string;
      program: string;
      sex: string;
    }[] = [];

    const existingList = await db
      .select({ studentId: certifiedStudentsTable.studentId })
      .from(certifiedStudentsTable);
    const existingDbSet = new Set(existingList.map((s) => s.studentId.toUpperCase().trim()));
    const seenIdsInBatch = new Set<string>();

    for (const row of rows) {
      const name = (row.fullName || "").trim();
      const sId = (row.studentId || "").trim();
      const yr = (row.yearLevel || "1").trim();
      const prog = (row.program || "ACT-AD").trim();
      const sexVal = (row.sex || "Male").trim();

      if (!name || !sId) {
        missing++;
        invalid++;
        continue;
      }

      const upperId = sId.toUpperCase();

      if (seenIdsInBatch.has(upperId) || existingDbSet.has(upperId)) {
        duplicates++;
        continue;
      }

      seenIdsInBatch.add(upperId);

      validRowsToInsert.push({
        fullName: name,
        studentId: sId,
        yearLevel: yr || "1",
        program: prog || "ACT-AD",
        sex: sexVal || "Male",
      });

      valid++;
    }

    // Sort valid rows alphabetically by Full Name before bulk insert
    validRowsToInsert.sort((a, b) => a.fullName.localeCompare(b.fullName));

    // Chunked batch insertion
    const chunkSize = 200;
    for (let i = 0; i < validRowsToInsert.length; i += chunkSize) {
      const chunk = validRowsToInsert.slice(i, i + chunkSize);
      await db
        .insert(certifiedStudentsTable)
        .values(chunk)
        .onConflictDoNothing({ target: certifiedStudentsTable.studentId });
    }

    await db.insert(studentImportBatchesTable).values({
      total,
      valid,
      duplicates,
      missing,
      invalid,
    });

    await db.insert(auditLogsTable).values({
      action: "EXCEL_IMPORT",
      entityType: "student_import_batch",
      entityId: String(total),
      details: `Imported ${valid} valid certified students (${duplicates} duplicates, ${invalid} invalid)`,
    });

    res.status(201).json({ total, valid, duplicates, missing, invalid });
  } catch (err) {
    next(err);
  }
});

// ─── STUDENT PROFILE & PHOTO (Mobile App Sync) ────────────────────────────────

// GET /api/student/profile?studentId=xxx
// Returns live certified student profile data for syncing to the mobile app
router.get("/student/profile", async (req, res, next) => {
  try {
    const studentId = req.query["studentId"] as string;
    if (!studentId?.trim()) {
      res.status(400).json({ error: "studentId query param is required." });
      return;
    }

    const rows = await db
      .select()
      .from(certifiedStudentsTable)
      .where(eq(certifiedStudentsTable.studentId, studentId.trim().toUpperCase()))
      .limit(1);

    if (!rows[0]) {
      res.status(404).json({ error: "Student not found." });
      return;
    }

    const s = rows[0];
    res.json({
      studentId: s.studentId,
      fullName: s.fullName,
      yearLevel: s.yearLevel,
      program: s.program,
      sex: s.sex,
      profilePhoto: s.profilePhoto ?? null,
      profileUploadCount: s.profileUploadCount ?? 0,
      status: s.status,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/student/photo
// Called by mobile app when student uploads or changes their profile photo.
// Saves the photo URL to the certified student record and increments upload count.
router.post("/student/photo", async (req, res, next) => {
  try {
    const { studentId, profilePhoto } = req.body as {
      studentId?: string;
      profilePhoto?: string;
    };

    if (!studentId?.trim() || !profilePhoto?.trim()) {
      res.status(400).json({ error: "studentId and profilePhoto are required." });
      return;
    }

    const rows = await db
      .select()
      .from(certifiedStudentsTable)
      .where(eq(certifiedStudentsTable.studentId, studentId.trim().toUpperCase()))
      .limit(1);

    const student = rows[0];
    if (!student) {
      res.status(404).json({ error: "Student not found in certified roster." });
      return;
    }

    const settingsRows = await db.select().from(systemSettingsTable).limit(1);
    const maxUploads = settingsRows[0]?.maxPhotoUploads ?? 2;
    const currentCount = student.profileUploadCount ?? 0;

    if (currentCount >= maxUploads) {
      res.status(403).json({ error: "Maximum profile photo uploads reached. Contact the admin to reset." });
      return;
    }

    const newCount = currentCount + 1;

    await db
      .update(certifiedStudentsTable)
      .set({
        profilePhoto: profilePhoto.trim(),
        profileUploadCount: newCount,
        updatedAt: new Date(),
      })
      .where(eq(certifiedStudentsTable.studentId, studentId.trim().toUpperCase()));

    await db.insert(auditLogsTable).values({
      action: "STUDENT_PHOTO_UPLOAD",
      entityType: "student",
      entityId: student.studentId,
      details: `Student ${student.fullName} (${student.studentId}) uploaded profile photo (${newCount}/${maxUploads})`,
    });

    res.json({ message: "Profile photo saved successfully.", profileUploadCount: newCount, maxPhotoUploads: maxUploads });
  } catch (err) {
    next(err);
  }
});

// ─── EVENTS MANAGEMENT ────────────────────────────────────────────────────────


async function buildEventPayload(event: typeof eventsTable.$inferSelect) {
  const sessions = await db
    .select()
    .from(attendanceSessionsTable)
    .where(eq(attendanceSessionsTable.eventId, event.id));

  const [{ value: totalStudents }] = await db
    .select({ value: count() })
    .from(certifiedStudentsTable);

  const [{ value: presentCount }] = await db
    .select({ value: count() })
    .from(attendanceRecordsTable)
    .where(eq(attendanceRecordsTable.eventId, event.id));

  return {
    id: event.id,
    name: event.name,
    description: event.description,
    eventDate: event.eventDate,
    venue: event.venue,
    status: event.status,
    qrStatus: event.qrStatus,
    sessions: sessions.map((s) => ({
      id: s.id,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      enabled: s.enabled,
      active: s.active,
    })),
    totalStudents: Number(totalStudents),
    presentCount: Number(presentCount),
  };
}

router.get("/events", async (_req, res, next) => {
  try {
    const events = await db
      .select()
      .from(eventsTable)
      .orderBy(desc(eventsTable.createdAt));

    const payload = await Promise.all(events.map(buildEventPayload));
    res.json(payload);
  } catch (err) {
    next(err);
  }
});

router.post("/events", async (req, res, next) => {
  try {
    const { name, description, eventDate, venue, startTime, endTime, sessions } = req.body as {
      name: string;
      description: string;
      eventDate: string;
      venue: string;
      startTime: string;
      endTime: string;
      sessions: { name: string; startTime: string; endTime: string; enabled: boolean }[];
    };

    const defaultSessions = sessions?.length
      ? sessions
      : [
        { name: "Morning IN", startTime: "07:00", endTime: "09:00", enabled: true },
        { name: "Morning OUT", startTime: "11:00", endTime: "12:00", enabled: true },
        { name: "Afternoon IN", startTime: "12:30", endTime: "14:00", enabled: true },
        { name: "Afternoon OUT", startTime: "16:00", endTime: "17:00", enabled: true },
        { name: "Evening IN", startTime: "18:00", endTime: "19:00", enabled: true },
        { name: "Evening OUT", startTime: "21:00", endTime: "22:00", enabled: true },
      ];

    const [event] = await db
      .insert(eventsTable)
      .values({
        name,
        description: description || "",
        eventDate,
        venue,
        startTime: startTime || "07:00",
        endTime: endTime || "22:00",
      })
      .returning();

    await db.insert(attendanceSessionsTable).values(
      defaultSessions.map((s) => ({
        eventId: event.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        enabled: s.enabled,
        active: false,
      })),
    );

    await db.insert(auditLogsTable).values({
      action: "CREATE_EVENT",
      entityType: "event",
      entityId: String(event.id),
      details: `Created event: ${event.name} (${defaultSessions.length} sessions)`,
    });

    res.status(201).json(await buildEventPayload(event));
  } catch (err) {
    next(err);
  }
});

router.put("/events/:id", async (req, res, next) => {
  try {
    const eventId = Number(req.params["id"]);
    const { name, description, eventDate, venue, status, sessions } = req.body as {
      name?: string;
      description?: string;
      eventDate?: string;
      venue?: string;
      status?: string;
      sessions?: { id?: number; name: string; startTime: string; endTime: string; enabled: boolean; active?: boolean }[];
    };

    const existingRows = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!existingRows[0]) {
      res.status(404).json({ error: "Event not found." });
      return;
    }

    const [updatedEvent] = await db
      .update(eventsTable)
      .set({
        name: name ?? existingRows[0].name,
        description: description ?? existingRows[0].description,
        eventDate: eventDate ?? existingRows[0].eventDate,
        venue: venue ?? existingRows[0].venue,
        status: status ?? existingRows[0].status,
        updatedAt: new Date(),
      })
      .where(eq(eventsTable.id, eventId))
      .returning();

    if (sessions && Array.isArray(sessions)) {
      for (const s of sessions) {
        if (s.id) {
          await db
            .update(attendanceSessionsTable)
            .set({
              name: s.name,
              startTime: s.startTime,
              endTime: s.endTime,
              enabled: s.enabled,
              active: s.active ?? false,
            })
            .where(eq(attendanceSessionsTable.id, s.id));
        } else {
          await db.insert(attendanceSessionsTable).values({
            eventId,
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            enabled: s.enabled,
            active: s.active ?? false,
          });
        }
      }
    }

    await db.insert(auditLogsTable).values({
      action: "UPDATE_EVENT",
      entityType: "event",
      entityId: String(eventId),
      details: `Updated event: ${updatedEvent.name} (Status: ${updatedEvent.status})`,
    });

    res.json(await buildEventPayload(updatedEvent));
  } catch (err) {
    next(err);
  }
});

router.patch("/events/:id/status", async (req, res, next) => {
  try {
    const eventId = Number(req.params["id"]);
    const { status } = req.body as { status: string };

    if (!status) {
      res.status(400).json({ error: "status is required." });
      return;
    }

    const [updated] = await db
      .update(eventsTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(eventsTable.id, eventId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Event not found." });
      return;
    }

    await db.insert(auditLogsTable).values({
      action: "CHANGE_EVENT_STATUS",
      entityType: "event",
      entityId: String(eventId),
      details: `Changed event #${eventId} status to "${status}"`,
    });

    res.json(await buildEventPayload(updated));
  } catch (err) {
    next(err);
  }
});

router.delete("/events/:id", async (req, res, next) => {
  try {
    const eventId = Number(req.params["id"]);

    const existingRows = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.id, eventId))
      .limit(1);

    if (!existingRows[0]) {
      res.status(404).json({ error: "Event not found." });
      return;
    }

    const eventName = existingRows[0].name;

    // Delete cascading references
    await db.delete(qrAssignmentsTable).where(eq(qrAssignmentsTable.eventId, eventId));
    await db.delete(attendanceRecordsTable).where(eq(attendanceRecordsTable.eventId, eventId));
    await db.delete(attendanceSessionsTable).where(eq(attendanceSessionsTable.eventId, eventId));
    await db.delete(eventQrTokensTable).where(eq(eventQrTokensTable.eventId, eventId));
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));

    await db.insert(auditLogsTable).values({
      action: "DELETE_EVENT",
      entityType: "event",
      entityId: String(eventId),
      details: `Deleted event #${eventId}: "${eventName}" and all associated session records`,
    });

    res.json({ success: true, message: `Event "${eventName}" deleted successfully.` });
  } catch (err) {
    next(err);
  }
});

router.post("/events/:eventId/qr", async (req, res, next) => {
  try {
    const eventId = Number(req.params["eventId"]);
    const { forceNew } = (req.body || {}) as { forceNew?: boolean };

    // Reuse existing token unless caller explicitly requests a fresh one
    const existing = await db
      .select()
      .from(eventQrTokensTable)
      .where(and(eq(eventQrTokensTable.eventId, eventId), eq(eventQrTokensTable.status, "active")))
      .limit(1);

    if (existing[0] && !forceNew) {
      // Return the stable token without rotating it
      res.json({ eventId: existing[0].eventId, token: existing[0].token, status: existing[0].status });
      return;
    }

    // Only delete + regenerate when explicitly requested
    await db.delete(eventQrTokensTable).where(eq(eventQrTokensTable.eventId, eventId));

    const token = crypto.randomBytes(24).toString("hex");

    const [qr] = await db
      .insert(eventQrTokensTable)
      .values({ eventId, token, status: "active" })
      .returning();

    await db
      .update(eventsTable)
      .set({ qrStatus: "generated", status: "active" })
      .where(eq(eventsTable.id, eventId));

    // Also automatically assign/activate default Permanent QR Code #01 to this event
    const permQrs = await db.select().from(attendanceQrCodesTable).limit(1);
    if (permQrs[0]) {
      // Deactivate older active assignments for this QR code
      await db
        .update(qrAssignmentsTable)
        .set({ status: "inactive", deactivatedAt: new Date() })
        .where(eq(qrAssignmentsTable.qrCodeId, permQrs[0].id));

      await db.insert(qrAssignmentsTable).values({
        qrCodeId: permQrs[0].id,
        eventId,
        status: "active",
      });
    }

    await db.insert(auditLogsTable).values({
      action: "GENERATE_EVENT_QR",
      entityType: "event",
      entityId: String(eventId),
      details: `Activated Permanent QR Code for event #${eventId}`,
    });

    res.json({ eventId: qr.eventId, token: qr.token, status: qr.status, permanentToken: permQrs[0]?.secureToken || qr.token });
  } catch (err) {
    next(err);
  }
});

// ─── PERMANENT ATTENDANCE QR CODES ─────────────────────────────────────────────

router.get("/qr-codes", async (_req, res, next) => {
  try {
    const qrCodes = await db.select().from(attendanceQrCodesTable).orderBy(asc(attendanceQrCodesTable.id));

    const result = await Promise.all(
      qrCodes.map(async (qr) => {
        const activeAssignment = await db
          .select()
          .from(qrAssignmentsTable)
          .where(and(eq(qrAssignmentsTable.qrCodeId, qr.id), eq(qrAssignmentsTable.status, "active")))
          .orderBy(desc(qrAssignmentsTable.activatedAt))
          .limit(1);

        let event = null;
        let session = null;

        if (activeAssignment[0]) {
          const evRows = await db
            .select()
            .from(eventsTable)
            .where(eq(eventsTable.id, activeAssignment[0].eventId))
            .limit(1);
          event = evRows[0] || null;

          if (activeAssignment[0].sessionId) {
            const sessRows = await db
              .select()
              .from(attendanceSessionsTable)
              .where(eq(attendanceSessionsTable.id, activeAssignment[0].sessionId))
              .limit(1);
            session = sessRows[0] || null;
          }
        }

        return {
          id: qr.id,
          qrName: qr.qrName,
          secureToken: qr.secureToken,
          status: qr.status,
          createdAt: qr.createdAt,
          activeAssignment: activeAssignment[0]
            ? {
              id: activeAssignment[0].id,
              eventId: activeAssignment[0].eventId,
              eventName: event?.name || "Unknown Event",
              sessionId: activeAssignment[0].sessionId,
              sessionName: session?.name || "Auto (By Schedule)",
              activatedAt: activeAssignment[0].activatedAt,
            }
            : null,
        };
      })
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/qr-codes/active", async (_req, res, next) => {
  try {
    const activeAssignment = await db
      .select()
      .from(qrAssignmentsTable)
      .innerJoin(attendanceQrCodesTable, eq(attendanceQrCodesTable.id, qrAssignmentsTable.qrCodeId))
      .innerJoin(eventsTable, eq(eventsTable.id, qrAssignmentsTable.eventId))
      .where(and(eq(qrAssignmentsTable.status, "active"), eq(eventsTable.status, "active")))
      .orderBy(desc(qrAssignmentsTable.activatedAt))
      .limit(1);

    if (!activeAssignment[0]) {
      // Return default permanent QR code info if available
      const defaultQr = await db.select().from(attendanceQrCodesTable).limit(1);
      res.json({
        qrName: defaultQr[0]?.qrName || "Attendance QR #01",
        secureToken: defaultQr[0]?.secureToken || "ZDSPGC_PERMANENT_QR_01",
        event: null,
        session: null,
      });
      return;
    }

    const { qr_assignments, attendance_qr_codes, attendance_events } = activeAssignment[0];

    let session = null;
    if (qr_assignments.sessionId) {
      const sessRows = await db
        .select()
        .from(attendanceSessionsTable)
        .where(eq(attendanceSessionsTable.id, qr_assignments.sessionId))
        .limit(1);
      session = sessRows[0] || null;
    }

    res.json({
      qrName: attendance_qr_codes.qrName,
      secureToken: attendance_qr_codes.secureToken,
      event: {
        id: attendance_events.id,
        name: attendance_events.name,
        date: attendance_events.eventDate,
        venue: attendance_events.venue,
      },
      session: session ? { id: session.id, name: session.name } : null,
      activatedAt: qr_assignments.activatedAt,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/qr-codes", async (req, res, next) => {
  try {
    const { qrName } = req.body as { qrName?: string };
    const name = (qrName || "").trim() || `Attendance QR #${Date.now().toString().slice(-2)}`;
    const secureToken = `ZDSPGC_PERMANENT_QR_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const [created] = await db
      .insert(attendanceQrCodesTable)
      .values({
        qrName: name,
        secureToken,
        status: "active",
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.post("/qr-codes/:id/activate", async (req, res, next) => {
  try {
    const qrCodeId = Number(req.params["id"]);
    const { eventId, sessionId } = req.body as { eventId?: number; sessionId?: number };

    if (!eventId) {
      res.status(400).json({ error: "eventId is required to activate QR code." });
      return;
    }

    // Deactivate previous active assignments for this QR code
    await db
      .update(qrAssignmentsTable)
      .set({ status: "inactive", deactivatedAt: new Date() })
      .where(eq(qrAssignmentsTable.qrCodeId, qrCodeId));

    const [assignment] = await db
      .insert(qrAssignmentsTable)
      .values({
        qrCodeId,
        eventId,
        sessionId: sessionId || null,
        status: "active",
      })
      .returning();

    // Mark event as active
    await db
      .update(eventsTable)
      .set({ status: "active", qrStatus: "generated" })
      .where(eq(eventsTable.id, eventId));

    await db.insert(auditLogsTable).values({
      action: "ACTIVATE_PERMANENT_QR",
      entityType: "qr_assignment",
      entityId: String(assignment.id),
      details: `Assigned Permanent QR #${qrCodeId} to event #${eventId}${sessionId ? ` (session #${sessionId})` : ""}`,
    });

    res.json({ message: "Permanent QR code assigned & activated successfully", assignment });
  } catch (err) {
    next(err);
  }
});

router.post("/qr-codes/:id/deactivate", async (req, res, next) => {
  try {
    const qrCodeId = Number(req.params["id"]);

    await db
      .update(qrAssignmentsTable)
      .set({ status: "inactive", deactivatedAt: new Date() })
      .where(and(eq(qrAssignmentsTable.qrCodeId, qrCodeId), eq(qrAssignmentsTable.status, "active")));

    res.json({ message: "Permanent QR code assignment deactivated." });
  } catch (err) {
    next(err);
  }
});

// ─── HIGH-SPEED SCAN & VERIFICATION CACHE & RESOLVERS ─────────────────────────
interface ActiveContextCache {
  event: typeof eventsTable.$inferSelect;
  sessions: (typeof attendanceSessionsTable.$inferSelect)[];
  assignedSessionId: number | null;
  timestamp: number;
}

let activeContextCache: { [tokenKey: string]: ActiveContextCache } = {};
let systemSettingsCache: { isManualMode: boolean; lateThresholdMinutes: number; timestamp: number } | null = null;

export function invalidateActiveContextCache() {
  activeContextCache = {};
  systemSettingsCache = null;
}

async function getCachedSettings() {
  const now = Date.now();
  if (systemSettingsCache && now - systemSettingsCache.timestamp < 10000) {
    return systemSettingsCache;
  }
  const settingsRows = await db.select().from(systemSettingsTable).limit(1);
  const data = {
    isManualMode: settingsRows[0]?.manualSessionMode ?? false,
    lateThresholdMinutes: settingsRows[0]?.lateThresholdMinutes ?? 15,
    timestamp: now,
  };
  systemSettingsCache = data;
  return data;
}

async function getStudentFast(cleanStudentId: string) {
  const upper = cleanStudentId.toUpperCase().trim();
  // 1. Try exact match on unique index (instant B-tree lookup)
  const exact = await db
    .select()
    .from(certifiedStudentsTable)
    .where(eq(certifiedStudentsTable.studentId, upper))
    .limit(1);
  if (exact[0]) return exact[0];

  // 2. Fallback to case-insensitive ilike
  const fallback = await db
    .select()
    .from(certifiedStudentsTable)
    .where(ilike(certifiedStudentsTable.studentId, cleanStudentId))
    .limit(1);
  return fallback[0] || null;
}

async function resolveActiveEventAndSessions(cleanToken: string): Promise<{
  eventId: number | null;
  event: typeof eventsTable.$inferSelect | null;
  sessions: (typeof attendanceSessionsTable.$inferSelect)[];
  assignedSessionId: number | null;
}> {
  const cacheKey = cleanToken || "_DEFAULT_";
  const now = Date.now();
  const cached = activeContextCache[cacheKey];

  if (cached && now - cached.timestamp < 3000) {
    return {
      eventId: cached.event.id,
      event: cached.event,
      sessions: cached.sessions,
      assignedSessionId: cached.assignedSessionId,
    };
  }

  let eventId: number | null = null;
  let assignedSessionId: number | null = null;

  if (cleanToken) {
    // Check Permanent QR codes first
    const permQrRows = await db
      .select()
      .from(attendanceQrCodesTable)
      .where(eq(attendanceQrCodesTable.secureToken, cleanToken))
      .limit(1);

    if (permQrRows[0]) {
      const activeAssign = await db
        .select()
        .from(qrAssignmentsTable)
        .innerJoin(eventsTable, eq(eventsTable.id, qrAssignmentsTable.eventId))
        .where(
          and(
            eq(qrAssignmentsTable.qrCodeId, permQrRows[0].id),
            eq(qrAssignmentsTable.status, "active"),
            eq(eventsTable.status, "active"),
          ),
        )
        .orderBy(desc(qrAssignmentsTable.activatedAt))
        .limit(1);

      if (activeAssign[0]) {
        eventId = activeAssign[0].qr_assignments.eventId;
        assignedSessionId = activeAssign[0].qr_assignments.sessionId;
      }
    }

    // Check eventQrTokensTable
    if (!eventId) {
      const tokenRows = await db
        .select()
        .from(eventQrTokensTable)
        .innerJoin(eventsTable, eq(eventsTable.id, eventQrTokensTable.eventId))
        .where(and(eq(eventQrTokensTable.token, cleanToken), eq(eventsTable.status, "active")))
        .limit(1);

      if (tokenRows[0]) {
        eventId = tokenRows[0].event_qr_tokens.eventId;
      }
    }
  }

  // Fallback: Check any active assignment for active events
  if (!eventId) {
    const activeAssignRows = await db
      .select()
      .from(qrAssignmentsTable)
      .innerJoin(eventsTable, eq(eventsTable.id, qrAssignmentsTable.eventId))
      .where(and(eq(qrAssignmentsTable.status, "active"), eq(eventsTable.status, "active")))
      .orderBy(desc(qrAssignmentsTable.activatedAt))
      .limit(1);

    if (activeAssignRows[0]) {
      eventId = activeAssignRows[0].qr_assignments.eventId;
      assignedSessionId = activeAssignRows[0].qr_assignments.sessionId;
    }
  }

  // Fallback: Find currently active event
  if (!eventId) {
    const activeEv = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.status, "active"))
      .orderBy(desc(eventsTable.createdAt))
      .limit(1);

    if (activeEv[0]) {
      eventId = activeEv[0].id;
    }
  }

  if (!eventId) {
    return { eventId: null, event: null, sessions: [], assignedSessionId: null };
  }

  const [eventRows, sessionRows] = await Promise.all([
    db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1),
    db.select().from(attendanceSessionsTable).where(eq(attendanceSessionsTable.eventId, eventId)),
  ]);

  const event = eventRows[0] || null;
  if (event && event.status === "active") {
    activeContextCache[cacheKey] = {
      event,
      sessions: sessionRows,
      assignedSessionId,
      timestamp: now,
    };
  }

  return { eventId, event, sessions: sessionRows, assignedSessionId };
}

// ─── ATTENDANCE SCANNING & CONFIRMATION ────────────────────────────────────────

router.get("/attendance", async (req, res, next) => {
  try {
    const { search, eventId, session } = req.query as {
      search?: string;
      eventId?: string;
      session?: string;
    };

    const conditions = [];
    if (search && search.trim()) {
      conditions.push(
        or(
          ilike(certifiedStudentsTable.fullName, `%${search.trim()}%`),
          ilike(certifiedStudentsTable.studentId, `%${search.trim()}%`),
          ilike(eventsTable.name, `%${search.trim()}%`),
        ),
      );
    }
    if (eventId) {
      conditions.push(eq(attendanceRecordsTable.eventId, Number(eventId)));
    }
    if (session && session !== "all") {
      conditions.push(ilike(attendanceSessionsTable.name, `%${session.trim()}%`));
    }

    const rows = await db
      .select({
        id: attendanceRecordsTable.id,
        studentName: certifiedStudentsTable.fullName,
        studentId: certifiedStudentsTable.studentId,
        yearLevel: certifiedStudentsTable.yearLevel,
        eventName: eventsTable.name,
        sessionName: attendanceSessionsTable.name,
        scannedAt: attendanceRecordsTable.scannedAt,
        officerName: officersTable.fullName,
        status: attendanceRecordsTable.status,
      })
      .from(attendanceRecordsTable)
      .innerJoin(certifiedStudentsTable, eq(certifiedStudentsTable.id, attendanceRecordsTable.studentId))
      .innerJoin(eventsTable, eq(eventsTable.id, attendanceRecordsTable.eventId))
      .innerJoin(attendanceSessionsTable, eq(attendanceSessionsTable.id, attendanceRecordsTable.sessionId))
      .leftJoin(officersTable, eq(officersTable.id, attendanceRecordsTable.officerId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(attendanceRecordsTable.scannedAt))
      .limit(1000);

    res.json(
      rows.map((r) => ({
        ...r,
        officerName: r.officerName ?? "Officer 01",
        scannedAt: r.scannedAt.toISOString(),
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/attendance/scan", async (req, res, next) => {
  try {
    let { eventToken, studentId } = req.body as { eventToken?: string; studentId?: string };

    if (!eventToken && !studentId) {
      res.status(400).json({ error: "eventToken or studentId is required." });
      return;
    }

    let cleanToken = (eventToken || "").trim();
    let cleanStudentId = (studentId || "").trim();

    // Support composite "TOKEN:STUDENTID" passed as eventToken field
    if (cleanToken.includes(":") && !cleanStudentId) {
      const colonIdx = cleanToken.indexOf(":");
      cleanStudentId = cleanToken.substring(colonIdx + 1).trim();
      cleanToken = cleanToken.substring(0, colonIdx).trim();
    } else if (cleanToken.includes("|") && !cleanStudentId) {
      const parts = cleanToken.split("|");
      cleanToken = parts[0].trim();
      cleanStudentId = parts[1].trim();
    }

    // If the scanned QR is only a studentId (no token part), use the auto-loaded token
    if (!cleanStudentId && cleanToken) {
      if (cleanToken.length <= 20) {
        cleanStudentId = cleanToken;
        cleanToken = "";
      }
    }

    if (!cleanStudentId) {
      res.status(400).json({ error: "Student ID could not be resolved from the QR code." });
      return;
    }

    // 1. Concurrent resolution of Active Event/Sessions and Student Record
    const [eventContext, student, settings] = await Promise.all([
      resolveActiveEventAndSessions(cleanToken),
      getStudentFast(cleanStudentId),
      getCachedSettings(),
    ]);

    if (!eventContext.eventId || !eventContext.event) {
      res.status(400).json({
        error: "No active event found. Please go to Event Management and activate an event before scanning attendance.",
      });
      return;
    }

    if (!student) {
      res.status(404).json({
        error: `Student ID "${cleanStudentId}" is not in the certified student roster. Please import the student roster first.`,
      });
      return;
    }

    const { event, sessions, assignedSessionId } = eventContext;

    // 2. Resolve Active Attendance Session according to mode and Manila time
    let activeSession = null;
    if (assignedSessionId) {
      activeSession = sessions.find((s) => s.id === assignedSessionId) || null;
    }

    if (!activeSession) {
      const resolved = resolveCurrentSession(sessions, settings.isManualMode, settings.lateThresholdMinutes);
      if (!resolved.session) {
        res.status(400).json({ error: resolved.error || "No attendance session is currently open for scanning." });
        return;
      }
      activeSession = resolved.session;
    }

    // 3. Fast Duplicate Scan Guard for (eventId, sessionId, studentId)
    const existingRecord = await db
      .select({ id: attendanceRecordsTable.id })
      .from(attendanceRecordsTable)
      .where(
        and(
          eq(attendanceRecordsTable.eventId, event.id),
          eq(attendanceRecordsTable.sessionId, activeSession.id),
          eq(attendanceRecordsTable.studentId, student.id),
        ),
      )
      .limit(1);

    const alreadyRecorded = !!existingRecord[0];

    res.json({
      studentId: student.studentId,
      studentName: student.fullName,
      yearLevel: student.yearLevel,
      program: student.program,
      profilePhoto: sanitizeProfilePhoto(student.profilePhoto),
      eventName: event.name,
      sessionName: activeSession.name,
      alreadyRecorded,
      message: alreadyRecorded
        ? `Attendance already recorded for ${activeSession.name}.`
        : `Ready to verify for ${activeSession.name}.`,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/attendance/confirm", async (req, res, next) => {
  try {
    let { eventToken, studentId } = req.body as { eventToken?: string; studentId?: string };

    if (!eventToken && !studentId) {
      res.status(400).json({ error: "eventToken or studentId is required." });
      return;
    }

    let cleanToken = (eventToken || "").trim();
    let cleanStudentId = (studentId || "").trim();

    if (cleanToken.includes(":") && !cleanStudentId) {
      const colonIdx = cleanToken.indexOf(":");
      cleanStudentId = cleanToken.substring(colonIdx + 1).trim();
      cleanToken = cleanToken.substring(0, colonIdx).trim();
    } else if (cleanToken.includes("|") && !cleanStudentId) {
      const parts = cleanToken.split("|");
      cleanToken = parts[0].trim();
      cleanStudentId = parts[1].trim();
    }

    if (!cleanStudentId && cleanToken) {
      if (cleanToken.length <= 20) {
        cleanStudentId = cleanToken;
        cleanToken = "";
      }
    }

    if (!cleanStudentId) {
      res.status(400).json({ error: "Student ID is required." });
      return;
    }

    // 1. Concurrent resolution of Active Event/Sessions and Student Record
    const [eventContext, student, settings] = await Promise.all([
      resolveActiveEventAndSessions(cleanToken),
      getStudentFast(cleanStudentId),
      getCachedSettings(),
    ]);

    if (!eventContext.eventId || !eventContext.event) {
      res.status(400).json({
        error: "No active event found. Please activate an event in Event Management before scanning.",
      });
      return;
    }

    if (!student) {
      res.status(404).json({ error: `Student ID "${cleanStudentId}" not found in certified registry.` });
      return;
    }

    const { event, sessions, assignedSessionId } = eventContext;

    // 2. Resolve active session
    let session = null;
    if (assignedSessionId) {
      session = sessions.find((s) => s.id === assignedSessionId) || null;
    }

    if (!session) {
      const resolved = resolveCurrentSession(sessions, settings.isManualMode, settings.lateThresholdMinutes);
      if (!resolved.session) {
        res.status(400).json({ error: resolved.error || "No attendance session is open right now." });
        return;
      }
      session = resolved.session;
    }

    // 3. Determine status (present vs late based on lateThresholdMinutes and Manila time)
    let scanStatus = "present";
    const { currentMinutes } = getManilaTime();

    if (session.startTime) {
      const sessionStartMinutes = parseMinutes(session.startTime);
      if (currentMinutes > sessionStartMinutes + settings.lateThresholdMinutes) {
        scanStatus = "late";
      }
    }

    // 4. Insert record with unique constraint protection
    const [record] = await db
      .insert(attendanceRecordsTable)
      .values({
        eventId: event.id,
        sessionId: session.id,
        studentId: student.id,
        status: scanStatus,
      })
      .onConflictDoNothing()
      .returning();

    // Async audit log non-blocking for response speed
    db.insert(auditLogsTable).values({
      action: "RECORD_ATTENDANCE",
      entityType: "attendance_record",
      entityId: String(record?.id ?? 0),
      details: `Confirmed attendance for ${student.fullName} (${student.studentId}) in ${session.name}`,
    }).catch((err) => console.error("Audit log record error:", err));

    res.status(201).json({
      id: record?.id ?? 0,
      studentName: student.fullName,
      studentId: student.studentId,
      yearLevel: student.yearLevel,
      program: student.program,
      profilePhoto: sanitizeProfilePhoto(student.profilePhoto),
      eventName: event.name,
      sessionName: session.name,
      scannedAt: (record?.scannedAt ?? new Date()).toISOString(),
      officerName: "Officer 01",
      status: record?.status ?? scanStatus,
    });
  } catch (err) {
    next(err);
  }
});

// ─── OFFICERS MANAGEMENT ──────────────────────────────────────────────────────

router.get("/officers", async (_req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(officersTable)
      .orderBy(desc(officersTable.createdAt));

    res.json(
      rows.map((o) => ({
        id: o.id,
        officerId: o.officerId,
        fullName: o.fullName,
        email: o.email,
        role: o.role || "officer",
        status: o.status,
        createdAt: o.createdAt,
      })),
    );
  } catch (err) {
    next(err);
  }
});

router.post("/officers", async (req, res, next) => {
  try {
    const { officerId, fullName, email, role, password } = req.body as {
      officerId?: string;
      fullName: string;
      email: string;
      role?: string;
      password?: string;
    };

    const autoId = officerId || `OFF-${Date.now().toString().slice(-4)}`;

    const [officer] = await db
      .insert(officersTable)
      .values({
        officerId: autoId,
        fullName,
        email,
        role: role || "officer",
        passwordHash: password || "officer123",
        status: "active",
      })
      .returning();

    await db.insert(auditLogsTable).values({
      action: "ADD_OFFICER",
      entityType: "officer",
      entityId: String(officer.id),
      details: `Added officer: ${officer.fullName} (${officer.officerId}) with role ${officer.role}`,
    });

    res.status(201).json({
      id: officer.id,
      officerId: officer.officerId,
      fullName: officer.fullName,
      email: officer.email,
      role: officer.role,
      status: officer.status,
      createdAt: officer.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

router.put("/officers/:id", async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    const { fullName, email, role, password } = req.body as {
      fullName?: string;
      email?: string;
      role?: string;
      password?: string;
    };

    const updateData: Record<string, unknown> = {};
    if (fullName) updateData["fullName"] = fullName;
    if (email) updateData["email"] = email;
    if (role) updateData["role"] = role;
    if (password) updateData["passwordHash"] = password;

    const [updated] = await db
      .update(officersTable)
      .set(updateData)
      .where(eq(officersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Officer not found" });
      return;
    }

    await db.insert(auditLogsTable).values({
      action: "EDIT_OFFICER",
      entityType: "officer",
      entityId: String(updated.id),
      details: `Updated officer: ${updated.fullName} (${updated.email})`,
    });

    res.json({
      id: updated.id,
      officerId: updated.officerId,
      fullName: updated.fullName,
      email: updated.email,
      role: updated.role,
      status: updated.status,
      createdAt: updated.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/officers/:id", async (req, res, next) => {
  try {
    const id = Number(req.params["id"]);
    await db.delete(officersTable).where(eq(officersTable.id, id));

    await db.insert(auditLogsTable).values({
      action: "DELETE_OFFICER",
      entityType: "officer",
      entityId: String(id),
      details: `Deleted officer ID ${id}`,
    });

    res.json({ message: "Officer deleted successfully" });
  } catch (err) {
    next(err);
  }
});

// Staff Authentication Endpoint (Login for Officers and Admins)
router.post("/auth/staff/login", async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required." });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    // Default Admin login check
    if (cleanEmail === "admin@attenda.edu" && password === "admin123") {
      res.json({
        user: {
          id: 0,
          fullName: "Admin",
          email: cleanEmail,
          role: "super_admin",
        },
      });
      return;
    }

    // Database lookup for Officer or Admin
    const rows = await db
      .select()
      .from(officersTable)
      .where(ilike(officersTable.email, cleanEmail))
      .limit(1);

    const officer = rows[0];
    if (!officer) {
      res.status(401).json({ error: "Invalid work email or password." });
      return;
    }

    if (officer.passwordHash && officer.passwordHash !== password) {
      res.status(401).json({ error: "Invalid password." });
      return;
    }

    res.json({
      user: {
        id: officer.id,
        officerId: officer.officerId,
        fullName: officer.fullName,
        email: officer.email,
        role: officer.role || "officer",
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── SYSTEM SETTINGS ──────────────────────────────────────────────────────────

function formatSettings(s: typeof systemSettingsTable.$inferSelect) {
  return {
    schoolName: s.schoolName,
    campusName: s.campusName,
    maxPhotoUploads: s.maxPhotoUploads,
    lateThresholdMinutes: s.lateThresholdMinutes ?? 15,
    automaticSessions: s.automaticSessions,
    manualSessionMode: s.manualSessionMode,
    duplicateProtection: s.duplicateProtection,
    attendanceConfirmation: s.attendanceConfirmation,
  };
}

router.get("/settings", async (_req, res, next) => {
  try {
    const rows = await db.select().from(systemSettingsTable).limit(1);

    if (rows[0]) {
      res.json(formatSettings(rows[0]));
      return;
    }

    const [settings] = await db
      .insert(systemSettingsTable)
      .values({
        schoolName: "ZDSPGC – Dimataling Campus",
        campusName: "Dimataling Campus",
        maxPhotoUploads: 2,
        lateThresholdMinutes: 15,
        automaticSessions: true,
        manualSessionMode: false,
        duplicateProtection: true,
        attendanceConfirmation: true,
      })
      .returning();

    res.json(formatSettings(settings));
  } catch (err) {
    next(err);
  }
});

router.patch("/settings", async (req, res, next) => {
  try {
    const rows = await db.select().from(systemSettingsTable).limit(1);
    const body = req.body as Partial<{
      schoolName: string;
      campusName: string;
      maxPhotoUploads: number;
      lateThresholdMinutes: number;
      automaticSessions: boolean;
      manualSessionMode: boolean;
      duplicateProtection: boolean;
      attendanceConfirmation: boolean;
    }>;

    let updatedRow;
    if (rows[0]) {
      const [updated] = await db
        .update(systemSettingsTable)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(systemSettingsTable.id, rows[0].id))
        .returning();
      updatedRow = updated;
    } else {
      const [created] = await db.insert(systemSettingsTable).values(body).returning();
      updatedRow = created;
    }

    invalidateActiveContextCache();
    res.json(formatSettings(updatedRow));
  } catch (err) {
    next(err);
  }
});

export default router;
