import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
});

export const accounts = sqliteTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  })
);

export const sessions = sqliteTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const companyGroups = sqliteTable("company_group", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const companies = sqliteTable("company", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  groupId: text("group_id").references(() => companyGroups.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const applicants = sqliteTable("applicant", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  furigana: text("furigana"),
  email: text("email"),
  phone: text("phone"),
  gender: text("gender"),
  assigneeUserId: text("assignee_user_id").references(() => users.id, { onDelete: "set null" }),
  assigneeName: text("assignee_name"),
  responseStatus: text("response_status"),
  birthDate: integer("birth_date", { mode: "timestamp" }),
  address: text("address"),
  caseName: text("case_name"),
  appliedJob: text("applied_job"),
  appliedLocation: text("applied_location"),
  age: integer("age"),
  notes: text("notes"),
  connectedAt: integer("connected_at", { mode: "timestamp" }),
  nextActionDate: integer("next_action_date", { mode: "timestamp" }),
  nextActionContent: text("next_action_content"),
  sourceGmailMessageId: text("source_gmail_message_id").unique(),
  sourceGmailThreadId: text("source_gmail_thread_id"),
  appliedAt: integer("applied_at", { mode: "timestamp" }).notNull(),

  // 歩留まりの各要素（フラグとして管理）
  isUniqueApplicant: integer("is_unique_applicant", { mode: "boolean" }).default(false),
  isValidApplicant: integer("is_valid_applicant", { mode: "boolean" }).default(false),
  docDeclined: integer("doc_declined", { mode: "boolean" }).default(false),
  docRejectedMK: integer("doc_rejected_mk", { mode: "boolean" }).default(false),
  docRejectedClient: integer("doc_rejected_client", { mode: "boolean" }).default(false),

  schedulingInterview: integer("scheduling_interview", { mode: "boolean" }).default(false),
  interviewDeclinedBefore: integer("interview_declined_before", { mode: "boolean" }).default(false),

  // 1次面接関連
  primaryNoShow: integer("primary_no_show", { mode: "boolean" }).default(false),
  primaryScheduled: integer("primary_scheduled", { mode: "boolean" }).default(false),
  primaryScheduledDate: integer("primary_scheduled_date", { mode: "timestamp" }),
  primaryConducted: integer("primary_conducted", { mode: "boolean" }).default(false),
  primaryConductedDate: integer("primary_conducted_date", { mode: "timestamp" }),
  primaryDeclinedAfter: integer("primary_declined_after", { mode: "boolean" }).default(false),
  primaryRejected: integer("primary_rejected", { mode: "boolean" }).default(false),

  // 2次/最終面接関連
  secScheduled: integer("sec_scheduled", { mode: "boolean" }).default(false),
  secScheduledDate: integer("sec_scheduled_date", { mode: "timestamp" }),
  secDeclinedBefore: integer("sec_declined_before", { mode: "boolean" }).default(false),
  secNoShow: integer("sec_no_show", { mode: "boolean" }).default(false),
  secConducted: integer("sec_conducted", { mode: "boolean" }).default(false),
  secConductedDate: integer("sec_conducted_date", { mode: "timestamp" }),
  secDeclinedAfter: integer("sec_declined_after", { mode: "boolean" }).default(false),
  secRejected: integer("sec_rejected", { mode: "boolean" }).default(false),

  // 最終面接関連
  finalScheduled: integer("final_scheduled", { mode: "boolean" }).default(false),
  finalScheduledDate: integer("final_scheduled_date", { mode: "timestamp" }),
  finalDeclinedBefore: integer("final_declined_before", { mode: "boolean" }).default(false),
  finalNoShow: integer("final_no_show", { mode: "boolean" }).default(false),
  finalConducted: integer("final_conducted", { mode: "boolean" }).default(false),
  finalConductedDate: integer("final_conducted_date", { mode: "timestamp" }),
  finalDeclinedAfter: integer("final_declined_after", { mode: "boolean" }).default(false),
  finalRejected: integer("final_rejected", { mode: "boolean" }).default(false),

  // 内定・入社関連
  offered: integer("offered", { mode: "boolean" }).default(false),
  offerDeclined: integer("offer_declined", { mode: "boolean" }).default(false),
  joined: integer("joined", { mode: "boolean" }).default(false),
  joinedDate: integer("joined_date", { mode: "timestamp" }),

  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const companySheets = sqliteTable("company_sheet", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  spreadsheetId: text("spreadsheet_id").notNull(),
  gid: integer("gid").default(0),
  sheetName: text("sheet_name"),
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const companyAliases = sqliteTable("company_alias", {
  id: text("id").primaryKey(),
  companyId: text("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  alias: text("alias").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const interviews = sqliteTable("interview", {
  id: text("id").primaryKey(),
  applicantId: text("applicant_id")
    .notNull()
    .references(() => applicants.id, { onDelete: "cascade" }),
  phase: text("phase").notNull(), // '1次' or '2次/最終'
  interviewDate: integer("interview_date", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});

export const callLogs = sqliteTable("call_log", {
  id: text("id").primaryKey(),
  applicantId: text("applicant_id")
    .notNull()
    .references(() => applicants.id, { onDelete: "cascade" }),
  callerId: text("caller_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  callCount: integer("call_count").notNull(),
  isConnected: integer("is_connected", { mode: "boolean" }).default(false),
  note: text("note"),
  calledAt: integer("called_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`),
});
