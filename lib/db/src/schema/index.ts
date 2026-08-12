import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const appUsersTable = pgTable(
  "app_users",
  {
    id: serial("id").primaryKey(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    role: text("role").notNull().default("officer"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clerkUserIdIdx: uniqueIndex("app_users_clerk_user_id_idx").on(table.clerkUserId),
  }),
);

export const certifiedStudentsTable = pgTable(
  "certified_students",
  {
    id: serial("id").primaryKey(),
    studentId: text("student_id").notNull(),
    fullName: text("full_name").notNull(),
    yearLevel: text("year_level").notNull(),
    program: text("program").notNull(),
    sex: text("sex").notNull(),
    status: text("status").notNull().default("certified"),
    profilePhoto: text("profile_photo"),
    profileUploadCount: integer("profile_upload_count").notNull().default(0),
    isRegistered: boolean("is_registered").notNull().default(false),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    studentIdIdx: uniqueIndex("certified_students_student_id_idx").on(table.studentId),
  }),
);

export const studentImportBatchesTable = pgTable("student_import_batches", {
  id: serial("id").primaryKey(),
  importedBy: integer("imported_by"),
  total: integer("total").notNull(),
  valid: integer("valid").notNull(),
  duplicates: integer("duplicates").notNull(),
  missing: integer("missing").notNull(),
  invalid: integer("invalid").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const officersTable = pgTable(
  "officers",
  {
    id: serial("id").primaryKey(),
    officerId: text("officer_id").notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull().default("officer"),
    passwordHash: text("password_hash"),
    status: text("status").notNull().default("active"),
    appUserId: integer("app_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    officerIdIdx: uniqueIndex("officers_officer_id_idx").on(table.officerId),
  }),
);

export const eventsTable = pgTable("attendance_events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  eventDate: date("event_date", { mode: "string" }).notNull(),
  venue: text("venue").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  status: text("status").notNull().default("scheduled"),
  qrStatus: text("qr_status").notNull().default("not_generated"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const eventQrTokensTable = pgTable(
  "event_qr_tokens",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull(),
    token: text("token").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventIdx: uniqueIndex("event_qr_tokens_event_id_idx").on(table.eventId),
    tokenIdx: uniqueIndex("event_qr_tokens_token_idx").on(table.token),
  }),
);

export const attendanceSessionsTable = pgTable("attendance_sessions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  active: boolean("active").notNull().default(false),
});

export const attendanceRecordsTable = pgTable(
  "attendance_records",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull(),
    sessionId: integer("session_id").notNull(),
    studentId: integer("student_id").notNull(),
    officerId: integer("officer_id"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull().default("present"),
  },
  (table) => ({
    uniqueAttendanceIdx: uniqueIndex("attendance_event_session_student_idx").on(
      table.eventId,
      table.sessionId,
      table.studentId,
    ),
  }),
);

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorUserId: integer("actor_user_id"),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const systemSettingsTable = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  schoolName: text("school_name").notNull().default("ZDSPGC – Dimataling Campus"),
  campusName: text("campus_name").notNull().default("Dimataling Campus"),
  maxPhotoUploads: integer("max_photo_uploads").notNull().default(2),
  lateThresholdMinutes: integer("late_threshold_minutes").notNull().default(15),
  automaticSessions: boolean("automatic_sessions").notNull().default(true),
  manualSessionMode: boolean("manual_session_mode").notNull().default(false),
  duplicateProtection: boolean("duplicate_protection").notNull().default(true),
  attendanceConfirmation: boolean("attendance_confirmation").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendanceQrCodesTable = pgTable(
  "attendance_qr_codes",
  {
    id: serial("id").primaryKey(),
    qrName: text("qr_name").notNull(),
    secureToken: text("secure_token").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("attendance_qr_codes_token_idx").on(table.secureToken),
  }),
);

export const qrAssignmentsTable = pgTable("qr_assignments", {
  id: serial("id").primaryKey(),
  qrCodeId: integer("qr_code_id").notNull(),
  eventId: integer("event_id").notNull(),
  sessionId: integer("session_id"),
  activatedBy: integer("activated_by"),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  status: text("status").notNull().default("active"),
});

export type AppUser = typeof appUsersTable.$inferSelect;
export type CertifiedStudent = typeof certifiedStudentsTable.$inferSelect;
export type Officer = typeof officersTable.$inferSelect;
export type AttendanceEvent = typeof eventsTable.$inferSelect;
export type AttendanceSession = typeof attendanceSessionsTable.$inferSelect;
export type AttendanceRecord = typeof attendanceRecordsTable.$inferSelect;
export type SystemSettings = typeof systemSettingsTable.$inferSelect;
export type AttendanceQrCode = typeof attendanceQrCodesTable.$inferSelect;
export type QrAssignment = typeof qrAssignmentsTable.$inferSelect;