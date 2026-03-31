import { auth } from "@/auth"
import { db, schema } from "@/db"
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

type ApplicantCsvRow = {
    id: string
    appliedAt: string | number | Date
    companyName: string | null
    caseName: string | null
    name: string
    email: string | null
    appliedJob: string | null
    appliedLocation: string | null
    phone: string | null
    age: number | null
    birthDate: string | number | Date | null
    gender: string | null
    assigneeName: string | null
    isValidApplicant: boolean | null
    responseStatus: string | null
    notes: string | null
    nextActionDate: string | number | Date | null
    connectedAt: string | number | Date | null
    primaryScheduledDate: string | number | Date | null
    primaryConducted: boolean | null
    secScheduledDate: string | number | Date | null
    secConducted: boolean | null
    offered: boolean | null
    joinedDate: string | number | Date | null
}

const CSV_HEADERS = [
    "応募者ID",
    "応募日",
    "企業名",
    "案件名",
    "氏名",
    "mail",
    "応募案件名",
    "勤務地",
    "電話番号",
    "年齢",
    "生年月日",
    "性別",
    "担当者名",
    "有効応募",
    "対応ステータス",
    "備考",
    "次回アクション日",
    "通電日",
    "面接日程",
    "面接実施",
    "二次/最終面接日程",
    "二次/最終面接実施",
    "内定可否",
    "入社日",
]
export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const params = request.nextUrl.searchParams
    const keyword = params.get("q")?.trim()
    const companyId = params.get("companyId")?.trim()
    const companyIdsRaw = params.get("companyIds")?.trim() || ""
    const companyIds = Array.from(
        new Set(
            companyIdsRaw
                .split(",")
                .map((id) => id.trim())
                .filter((id) => id.length > 0),
        ),
    )
    const assigneeName = params.get("assigneeName")?.trim()
    const responseStatus = params.get("responseStatus")?.trim()
    const isValidApplicant = params.get("isValidApplicant")?.trim()
    const gender = params.get("gender")?.trim()
    const offered = params.get("offered")?.trim()
    const appliedDateFrom = parseAppliedDateFilter(params.get("appliedDateFrom")?.trim())
    const appliedDateTo = parseAppliedDateFilter(params.get("appliedDateTo")?.trim())

    const whereClauses = []
    if (companyId) {
        whereClauses.push(eq(schema.applicants.companyId, companyId))
    } else if (companyIds.length > 0) {
        whereClauses.push(inArray(schema.applicants.companyId, companyIds))
    }
    if (keyword) {
        const keywordPattern = `%${keyword}%`
        whereClauses.push(
            or(
                like(schema.applicants.name, keywordPattern),
                like(schema.applicants.furigana, keywordPattern),
                like(schema.companies.name, keywordPattern),
                like(schema.applicants.caseName, keywordPattern),
                like(schema.applicants.email, keywordPattern),
                like(schema.applicants.phone, keywordPattern),
                like(schema.applicants.appliedJob, keywordPattern),
                like(schema.applicants.appliedLocation, keywordPattern),
                like(schema.applicants.gender, keywordPattern),
                like(schema.applicants.responseStatus, keywordPattern),
                like(schema.applicants.notes, keywordPattern),
                sql`coalesce(${schema.applicants.assigneeName}, ${schema.users.name}, '') like ${keywordPattern}`,
                sql`cast(${schema.applicants.age} as text) like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.appliedAt}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.birthDate}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.nextActionDate}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.connectedAt}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.primaryScheduledDate}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.secScheduledDate}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.joinedDate}, 'unixepoch') like ${keywordPattern}`,
            )!,
        )
    }
    if (assigneeName) {
        whereClauses.push(
            sql`coalesce(${schema.applicants.assigneeName}, ${schema.users.name}) = ${assigneeName}`,
        )
    }
    if (responseStatus) {
        whereClauses.push(eq(schema.applicants.responseStatus, responseStatus))
    }
    if (isValidApplicant === "true") {
        whereClauses.push(eq(schema.applicants.isValidApplicant, true))
    } else if (isValidApplicant === "false") {
        whereClauses.push(
            or(
                eq(schema.applicants.isValidApplicant, false),
                sql`${schema.applicants.isValidApplicant} IS NULL`,
            )!,
        )
    }
    if (gender) {
        whereClauses.push(eq(schema.applicants.gender, gender))
    }
    if (offered === "true") {
        whereClauses.push(eq(schema.applicants.offered, true))
    } else if (offered === "false") {
        whereClauses.push(
            or(
                eq(schema.applicants.offered, false),
                sql`${schema.applicants.offered} IS NULL`,
            )!,
        )
    }
    if (appliedDateFrom) {
        whereClauses.push(sql`${schema.applicants.appliedAt} >= ${appliedDateFrom.startUnix}`)
    }
    if (appliedDateTo) {
        whereClauses.push(sql`${schema.applicants.appliedAt} < ${appliedDateTo.endUnix}`)
    }

    const query = db
        .select({
            id: schema.applicants.id,
            appliedAt: schema.applicants.appliedAt,
            companyName: schema.companies.name,
            caseName: schema.applicants.caseName,
            name: schema.applicants.name,
            email: schema.applicants.email,
            appliedJob: schema.applicants.appliedJob,
            appliedLocation: schema.applicants.appliedLocation,
            phone: schema.applicants.phone,
            age: schema.applicants.age,
            birthDate: schema.applicants.birthDate,
            gender: schema.applicants.gender,
            assigneeName: sql<string | null>`coalesce(${schema.applicants.assigneeName}, ${schema.users.name})`,
            isValidApplicant: schema.applicants.isValidApplicant,
            responseStatus: schema.applicants.responseStatus,
            notes: schema.applicants.notes,
            nextActionDate: schema.applicants.nextActionDate,
            connectedAt: schema.applicants.connectedAt,
            primaryScheduledDate: schema.applicants.primaryScheduledDate,
            primaryConducted: schema.applicants.primaryConducted,
            secScheduledDate: schema.applicants.secScheduledDate,
            secConducted: schema.applicants.secConducted,
            offered: schema.applicants.offered,
            joinedDate: schema.applicants.joinedDate,
        })
        .from(schema.applicants)
        .leftJoin(schema.companies, eq(schema.applicants.companyId, schema.companies.id))
        .leftJoin(schema.users, eq(schema.applicants.assigneeUserId, schema.users.id))

    const rows = await (whereClauses.length === 0
        ? query.orderBy(desc(schema.applicants.appliedAt), desc(schema.applicants.createdAt))
        : query.where(whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses)).orderBy(desc(schema.applicants.appliedAt), desc(schema.applicants.createdAt))
    ).all() as ApplicantCsvRow[]

    const body = rows
        .map((row) => ([
            row.id,
            toDateText(row.appliedAt),
            row.companyName || "",
            row.caseName || "",
            row.name,
            row.email || "",
            row.appliedJob || "",
            row.appliedLocation || "",
            row.phone || "",
            row.age == null ? "" : String(row.age),
            toDateText(row.birthDate),
            row.gender || "",
            row.assigneeName || "",
            toBoolText(row.isValidApplicant),
            row.responseStatus || "",
            row.notes || "",
            toDateText(row.nextActionDate),
            toDateText(row.connectedAt),
            toDateText(row.primaryScheduledDate),
            toBoolText(row.primaryConducted),
            toDateText(row.secScheduledDate),
            toBoolText(row.secConducted),
            toBoolText(row.offered),
            toDateText(row.joinedDate),
        ].map((value) => escapeCsv(value)).join(",")))
        .join("\n")

    const csv = `\uFEFF${CSV_HEADERS.map((header) => escapeCsv(header)).join(",")}\n${body}\n`
    const filename = `applicants_${buildTimestamp()}.csv`

    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename=\"${filename}\"`,
            "Cache-Control": "no-store",
        },
    })
}

function toDateText(value: string | number | Date | null | undefined) {
    if (!value) return ""
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

function toBoolText(value: boolean | null | undefined) {
    if (value == null) return ""
    return value ? "TRUE" : "FALSE"
}

function escapeCsv(value: string) {
    if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
        return `"${value.replaceAll("\"", "\"\"")}"`
    }
    return value
}

function buildTimestamp() {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, "0")
    const dd = String(now.getDate()).padStart(2, "0")
    const hh = String(now.getHours()).padStart(2, "0")
    const mi = String(now.getMinutes()).padStart(2, "0")
    const ss = String(now.getSeconds()).padStart(2, "0")
    return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`
}

function parseAppliedDateFilter(value?: string) {
    const raw = value?.trim()
    if (!raw) return null

    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!match) return null

    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

    const startMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
    if (!Number.isFinite(startMs)) return null

    const parsed = new Date(startMs)
    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        return null
    }

    const endMs = Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0)
    return {
        startUnix: Math.floor(startMs / 1000),
        endUnix: Math.floor(endMs / 1000),
    }
}

