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

function resolveCurrentSession(sessions: (typeof attendanceSessionsTable.$inferSelect)[]) {
  if (!sessions || !sessions.length) return null;

  // 1. If any session is manually marked active, use that
  const manuallyActive = sessions.find((s) => s.active);
  if (manuallyActive) return manuallyActive;

  const enabledSessions = sessions.filter((s) => s.enabled);
  if (!enabledSessions.length) return sessions[0];

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // 2. Exact time window match with 30-minute grace period after endTime
  const timeMatch = enabledSessions.find((s) => {
    const startMins = parseMinutes(s.startTime);
    const endMins = parseMinutes(s.endTime);
    if (endMins >= startMins) {
      return currentMinutes >= startMins && currentMinutes <= endMins + 30;
    }
    return currentMinutes >= startMins || currentMinutes <= endMins;
  });

  if (timeMatch) return timeMatch;

  // 3. Proximity match: pick session whose start/end window is closest to current time
  let closest = enabledSessions[0];
  let minDiff = Infinity;

  for (const s of enabledSessions) {
    const startMins = parseMinutes(s.startTime);
    const endMins = parseMinutes(s.endTime);
    const midPoint = (startMins + endMins) / 2;
    const diff = Math.abs(currentMinutes - midPoint);
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }

  return closest;
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
      defaultSessions.map((s, idx) => ({
        eventId: event.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        enabled: s.enabled,
        active: idx === 0, // set first session active by default
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
      // Treat the whole value as a student ID if it doesn't look like a token
      if (cleanToken.length <= 20) {
        cleanStudentId = cleanToken;
        cleanToken = "";
      }
    }

    if (!cleanStudentId) {
      res.status(400).json({ error: "Student ID could not be resolved from the QR code." });
      return;
    }

    // 1. Resolve token -> Active Event (Support permanent CSC QR code & fallback to active event)
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
          .where(and(eq(qrAssignmentsTable.qrCodeId, permQrRows[0].id), eq(qrAssignmentsTable.status, "active")))
          .orderBy(desc(qrAssignmentsTable.activatedAt))
          .limit(1);

        if (activeAssign[0]) {
          const assignedEv = await db
            .select()
            .from(eventsTable)
            .where(and(eq(eventsTable.id, activeAssign[0].eventId), eq(eventsTable.status, "active")))
            .limit(1);

          if (assignedEv[0]) {
            eventId = activeAssign[0].eventId;
            assignedSessionId = activeAssign[0].sessionId;
          }
        }
      }

      // Check eventQrTokensTable for active event match
      if (!eventId) {
        const tokenRows = await db
          .select()
          .from(eventQrTokensTable)
          .where(eq(eventQrTokensTable.token, cleanToken))
          .limit(1);

        if (tokenRows[0]) {
          const tokenEv = await db
            .select()
            .from(eventsTable)
            .where(and(eq(eventsTable.id, tokenRows[0].eventId), eq(eventsTable.status, "active")))
            .limit(1);

          if (tokenEv[0]) {
            eventId = tokenRows[0].eventId;
          }
        }
      }
    }

    // Fallback: Use active assignment of any permanent QR code or latest active event
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
      const latestEv = await db
        .select()
        .from(eventsTable)
        .where(ne(eventsTable.status, "cancelled"))
        .orderBy(desc(eventsTable.createdAt))
        .limit(1);

      if (latestEv[0]) {
        eventId = latestEv[0].id;
      }
    }

    if (!eventId) {
      res.status(404).json({ error: "No active event found. Please create or start an event in the Admin Console." });
      return;
    }

    // 2. Resolve Student in Certified Student Registry
    const studentRows = await db
      .select()
      .from(certifiedStudentsTable)
      .where(ilike(certifiedStudentsTable.studentId, cleanStudentId))
      .limit(1);

    const student = studentRows[0];
    if (!student) {
      res.status(404).json({ error: `Student ID "${cleanStudentId}" is not in the certified student roster. Please import the student roster first.` });
      return;
    }

    // 3. Resolve Event
    const eventRows = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    const event = eventRows[0];
    if (!event || event.status === "cancelled") {
      res.status(400).json({ error: `Event "${event?.name || 'Selected Event'}" is cancelled.` });
      return;
    }

    // 4. Resolve Active Attendance Session
    const settingsRows = await db.select().from(systemSettingsTable).limit(1);
    const isManualMode = settingsRows[0]?.manualSessionMode ?? false;

    let activeSession = null;

    const sessions = await db
      .select()
      .from(attendanceSessionsTable)
      .where(eq(attendanceSessionsTable.eventId, eventId));

    if (assignedSessionId) {
      activeSession = sessions.find((s) => s.id === assignedSessionId) || null;
    }

    if (!activeSession) {
      if (isManualMode) {
        activeSession = sessions.find((s) => s.active) || null;
      } else {
        // Automatic time-based mode: dynamically resolve session matching current time of day
        activeSession = resolveCurrentSession(sessions);
      }
    }

    if (!activeSession) {
      res.status(400).json({ error: "No active attendance session available for this event." });
      return;
    }

    // 5. Duplicate Scan Guard for (eventId, sessionId, studentId)
    const existingRecord = await db
      .select()
      .from(attendanceRecordsTable)
      .where(
        and(
          eq(attendanceRecordsTable.eventId, eventId),
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
      profilePhoto: student.profilePhoto,
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

    if (!cleanStudentId) {
      res.status(400).json({ error: "Student ID is required." });
      return;
    }

    // 1. Resolve token -> Active Event (Support permanent CSC QR code & fallback to active event)
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
          .where(and(eq(qrAssignmentsTable.qrCodeId, permQrRows[0].id), eq(qrAssignmentsTable.status, "active")))
          .orderBy(desc(qrAssignmentsTable.activatedAt))
          .limit(1);

        if (activeAssign[0]) {
          const assignedEv = await db
            .select()
            .from(eventsTable)
            .where(and(eq(eventsTable.id, activeAssign[0].eventId), eq(eventsTable.status, "active")))
            .limit(1);

          if (assignedEv[0]) {
            eventId = activeAssign[0].eventId;
            assignedSessionId = activeAssign[0].sessionId;
          }
        }
      }

      // Check eventQrTokensTable for active event match
      if (!eventId) {
        const tokenRows = await db
          .select()
          .from(eventQrTokensTable)
          .where(eq(eventQrTokensTable.token, cleanToken))
          .limit(1);

        if (tokenRows[0]) {
          const tokenEv = await db
            .select()
            .from(eventsTable)
            .where(and(eq(eventsTable.id, tokenRows[0].eventId), eq(eventsTable.status, "active")))
            .limit(1);

          if (tokenEv[0]) {
            eventId = tokenRows[0].eventId;
          }
        }
      }
    }

    // Fallback: Use active assignment of any permanent QR code or latest active event
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
      const latestEv = await db
        .select()
        .from(eventsTable)
        .where(ne(eventsTable.status, "cancelled"))
        .orderBy(desc(eventsTable.createdAt))
        .limit(1);

      if (latestEv[0]) {
        eventId = latestEv[0].id;
      }
    }

    if (!eventId) {
      res.status(404).json({ error: "No active event found. Please create or start an event in the Admin Console." });
      return;
    }

    const studentRows = await db
      .select()
      .from(certifiedStudentsTable)
      .where(ilike(certifiedStudentsTable.studentId, cleanStudentId))
      .limit(1);

    const student = studentRows[0];
    if (!student) {
      res.status(404).json({ error: `Student ID "${cleanStudentId}" not found in certified registry.` });
      return;
    }

    // Dynamically resolve active session matching current time of day
    const sessionRows = await db
      .select()
      .from(attendanceSessionsTable)
      .where(eq(attendanceSessionsTable.eventId, eventId));

    const session = resolveCurrentSession(sessionRows);
    if (!session) {
      res.status(400).json({ error: "No attendance session found for event." });
      return;
    }

    // Determine status (present vs late based on lateThresholdMinutes)
    const settingsRows = await db.select().from(systemSettingsTable).limit(1);
    const lateThresholdMinutes = settingsRows[0]?.lateThresholdMinutes ?? 15;

    let scanStatus = "present";
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (session.startTime) {
      const [sh, sm] = session.startTime.split(":").map(Number);
      if (!isNaN(sh) && !isNaN(sm)) {
        const sessionStartMinutes = sh * 60 + sm;
        if (currentMinutes > sessionStartMinutes + lateThresholdMinutes) {
          scanStatus = "late";
        }
      }
    }

    // Auto-record 'absent' for any earlier enabled sessions that have already passed and were NOT scanned by this student
    const earlierSessions = sessionRows.filter((s) => {
      if (!s.enabled || s.id === session.id) return false;
      const sessionEndMins = parseMinutes(s.endTime);
      return currentMinutes > sessionEndMins + 15;
    });

    for (const earlier of earlierSessions) {
      const rec = await db
        .select()
        .from(attendanceRecordsTable)
        .where(
          and(
            eq(attendanceRecordsTable.eventId, eventId),
            eq(attendanceRecordsTable.sessionId, earlier.id),
            eq(attendanceRecordsTable.studentId, student.id),
          ),
        )
        .limit(1);

      if (!rec[0]) {
        await db
          .insert(attendanceRecordsTable)
          .values({
            eventId,
            sessionId: earlier.id,
            studentId: student.id,
            status: "absent",
          })
          .onConflictDoNothing();
      }
    }

    // Insert record with unique constraint protection
    const [record] = await db
      .insert(attendanceRecordsTable)
      .values({
        eventId,
        sessionId: session.id,
        studentId: student.id,
        status: scanStatus,
      })
      .onConflictDoNothing()
      .returning();

    const eventRows = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);

    await db.insert(auditLogsTable).values({
      action: "RECORD_ATTENDANCE",
      entityType: "attendance_record",
      entityId: String(record?.id ?? 0),
      details: `Confirmed attendance for ${student.fullName} (${student.studentId}) in ${session.name}`,
    });

    res.status(201).json({
      id: record?.id ?? 0,
      studentName: student.fullName,
      studentId: student.studentId,
      yearLevel: student.yearLevel,
      eventName: eventRows[0]?.name ?? "",
      sessionName: session.name,
      scannedAt: (record?.scannedAt ?? new Date()).toISOString(),
      officerName: "Officer 01",
      status: record?.status ?? "present",
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

    // Default System Admin login check
    if (cleanEmail === "admin@attenda.edu" && password === "admin123") {
      res.json({
        user: {
          id: 0,
          fullName: "System Admin",
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

    res.json(formatSettings(updatedRow));
  } catch (err) {
    next(err);
  }
});

export default router;
