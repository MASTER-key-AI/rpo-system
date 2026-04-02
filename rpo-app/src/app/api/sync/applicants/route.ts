import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

import { db, schema } from "@/db"
import { normalizeCompanyNameForMatch } from "@/lib/company-name"
import { getRuntimeEnv } from "@/lib/runtime-env"

const API_KEY_HEADER = "x-rpo-api-key"
const API_KEY_ENV_NAME = "RPO_API_KEY"
const API_KEY_ENV_NAME_LEGACY = "INBOUND_API_KEY"
const MAX_PAGE_SIZE = 500
const DEFAULT_PAGE_SIZE = 200

export const runtime = "nodejs"

type SyncRequestPayload = {
    companyId?: unknown
    company_id?: unknown
    companyCode?: unknown
    companyName?: unknown
    name?: unknown
    company?: unknown
    company_name?: unknown
    updatedAfter?: unknown
    updated_after?: unknown
    cursor?: unknown
    nextCursor?: unknown
    limit?: unknown
    pageSize?: unknown
}

type ParseBodyResult = { ok: true; value: SyncRequestPayload } | { ok: false; error: string }
type CompanyRow = { id: string; name: string }
type CompanyResolutionRule = {
    key: string
    mode: "exact" | "contains"
    include: string[]
    exclude?: string[]
    allowMultiple?: boolean
}
type CompanyResolutionResult = {
    companies: CompanyRow[]
    allowMultiple: boolean
    strategy: string
}

export async function GET() {
    return NextResponse.json(
        { success: false, error: "Method Not Allowed" },
        { status: 405 }
    )
}

export async function POST(request: NextRequest) {
    try {
        const configuredApiKey = getRuntimeEnv(API_KEY_ENV_NAME) || getRuntimeEnv(API_KEY_ENV_NAME_LEGACY)

        if (!configuredApiKey) {
            return NextResponse.json(
                { success: false, error: "RPO_API_KEY is not configured" },
                { status: 500 }
            )
        }

        const providedApiKey = request.headers.get(API_KEY_HEADER)?.trim()
        if (!providedApiKey || providedApiKey !== configuredApiKey) {
            return NextResponse.json(
                { success: false, error: "Invalid API key" },
                { status: 401 }
            )
        }

        const payloadResult = await parseRequestBody_(request)
        if (!payloadResult.ok) {
            return NextResponse.json(
                { success: false, error: payloadResult.error },
                { status: 400 }
            )
        }

        const payload = payloadResult.value
        const companyId = normalizeText_(payload.companyId ?? payload.company_id)
        const companyName = normalizeText_(
            payload.companyName ?? payload.name ?? payload.company ?? payload.company_name ?? null
        )
        const companyCode = normalizeText_(payload.companyCode)

        if (!companyId && !companyName) {
            return NextResponse.json(
                { success: false, error: "companyId or company is required" },
                { status: 400 }
            )
        }

        let resolution: CompanyResolutionResult = {
            companies: [],
            allowMultiple: false,
            strategy: "",
        }
        let resolvedCompanies: CompanyRow[] = []

        if (companyId) {
            const companyById = await db
                .select({ id: schema.companies.id, name: schema.companies.name })
                .from(schema.companies)
                .where(eq(schema.companies.id, companyId))
                .get()
            if (!companyById) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Company not found by id: ${companyId}`,
                        companyId,
                        matchedCompanies: [],
                        resolutionStrategy: "exact_id",
                    },
                    { status: 404 }
                )
            }
            resolvedCompanies = [companyById]
            resolution = {
                companies: resolvedCompanies,
                allowMultiple: false,
                strategy: "exact_id",
            }
        } else {
            const allCompanies = await db
                .select({ id: schema.companies.id, name: schema.companies.name })
                .from(schema.companies)
                .all()

            resolution = resolveCompanies_(allCompanies, companyName, companyCode)
            resolvedCompanies = resolution.companies
            if (!resolvedCompanies.length) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Company not found: ${companyName}`,
                        companyName,
                        companyCode,
                        matchedCompanies: [],
                        resolutionStrategy: resolution.strategy,
                    },
                    { status: 404 }
                )
            }

            if (!resolution.allowMultiple && resolvedCompanies.length > 1) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `Ambiguous company mapping: ${companyName}`,
                        companyName,
                        companyCode,
                        matchedCompanies: resolvedCompanies.map((company) => company.name),
                        resolutionStrategy: resolution.strategy,
                    },
                    { status: 409 }
                )
            }
        }

        const updatedAfter = parseDate_(payload.updatedAfter || payload.updated_after)
        const cursor = parseCursor_(payload.cursor || payload.nextCursor)
        const pageSize = parsePageSize_(payload.limit, payload.pageSize)

        const where = buildWhereClause_(
            resolvedCompanies.map((company) => company.id),
            updatedAfter,
            cursor
        )

        const rows = await db
            .select({
                id: schema.applicants.id,
                name: schema.applicants.name,
                furigana: schema.applicants.furigana,
                email: schema.applicants.email,
                phone: schema.applicants.phone,
                address: schema.applicants.address,
                gender: schema.applicants.gender,
                birthDate: schema.applicants.birthDate,
                caseName: schema.applicants.caseName,
                appliedJob: schema.applicants.appliedJob,
                appliedLocation: schema.applicants.appliedLocation,
                age: schema.applicants.age,
                notes: schema.applicants.notes,
                assigneeName: schema.applicants.assigneeName,
                responseStatus: schema.applicants.responseStatus,
                connectedAt: schema.applicants.connectedAt,
                nextActionDate: schema.applicants.nextActionDate,
                appliedAt: schema.applicants.appliedAt,
                primaryScheduledDate: schema.applicants.primaryScheduledDate,
                primaryConducted: schema.applicants.primaryConducted,
                secScheduledDate: schema.applicants.secScheduledDate,
                secConducted: schema.applicants.secConducted,
                offered: schema.applicants.offered,
                joinedDate: schema.applicants.joinedDate,
                updatedAt: schema.applicants.updatedAt,
                isValidApplicant: schema.applicants.isValidApplicant,
                primaryNoShow: schema.applicants.primaryNoShow,
                secNoShow: schema.applicants.secNoShow,
                finalNoShow: schema.applicants.finalNoShow,
                primaryScheduled: schema.applicants.primaryScheduled,
                secScheduled: schema.applicants.secScheduled,
                finalScheduled: schema.applicants.finalScheduled,
                finalConducted: schema.applicants.finalConducted,
                docDeclined: schema.applicants.docDeclined,
                docRejectedMK: schema.applicants.docRejectedMK,
                docRejectedClient: schema.applicants.docRejectedClient,
                interviewDeclinedBefore: schema.applicants.interviewDeclinedBefore,
                primaryDeclinedAfter: schema.applicants.primaryDeclinedAfter,
                primaryRejected: schema.applicants.primaryRejected,
                secDeclinedBefore: schema.applicants.secDeclinedBefore,
                secDeclinedAfter: schema.applicants.secDeclinedAfter,
                secRejected: schema.applicants.secRejected,
                finalDeclinedBefore: schema.applicants.finalDeclinedBefore,
                finalDeclinedAfter: schema.applicants.finalDeclinedAfter,
                finalRejected: schema.applicants.finalRejected,
                offerDeclined: schema.applicants.offerDeclined,
                joined: schema.applicants.joined,
            })
            .from(schema.applicants)
            .where(where)
            .orderBy(desc(schema.applicants.updatedAt), desc(schema.applicants.id))
            .limit(pageSize)
            .all()

        const records = rows.map(mapApplicantToRecord_)
        const nextCursor = buildNextCursor_(rows, pageSize)

        return NextResponse.json(
            {
                success: true,
                data: {
                    records,
                    nextCursor,
                    matchedCompanies: resolvedCompanies.map((company) => company.name),
                    resolvedCompanies: resolvedCompanies.map((company) => company.name),
                    resolutionStrategy: resolution.strategy,
                    companyId: resolvedCompanies[0]?.id || "",
                },
            },
            { status: 200 }
        )
    } catch (error) {
        console.error("sync/applicants failed", errorToMessage_(error))
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        )
    }
}

function buildWhereClause_(companyIds: string[], updatedAfter: Date | null, cursor: { updatedAt: Date; id: string } | null) {
    const companyCondition =
        companyIds.length === 1
            ? eq(schema.applicants.companyId, companyIds[0]!)
            : inArray(schema.applicants.companyId, companyIds)
    const conditions = [companyCondition]

    if (updatedAfter) {
        const updatedAfterUnix = toUnixSeconds_(updatedAfter)
        if (updatedAfterUnix > 0) {
            conditions.push(sql`${schema.applicants.updatedAt} > ${updatedAfterUnix}`)
        }
    }

    if (cursor?.updatedAt && cursor.id) {
        const cursorUpdatedAtUnix = toUnixSeconds_(cursor.updatedAt)
        if (cursorUpdatedAtUnix > 0) {
            conditions.push(
                sql`(${schema.applicants.updatedAt} < ${cursorUpdatedAtUnix} OR (${schema.applicants.updatedAt} = ${cursorUpdatedAtUnix} AND ${schema.applicants.id} < ${cursor.id}))`
            )
        }
    }

    return conditions.length === 1 ? conditions[0] : and(...conditions)
}

function mapApplicantToRecord_(row: {
    id: string
    name: string
    furigana: string | null
    email: string | null
    phone: string | null
    address: string | null
    gender: string | null
    birthDate: string | number | Date | null
    caseName: string | null
    appliedJob: string | null
    appliedLocation: string | null
    age: number | null
    notes: string | null
    assigneeName: string | null
    responseStatus: string | null
    connectedAt: string | number | Date | null
    nextActionDate: string | number | Date | null
    appliedAt: string | number | Date
    primaryScheduledDate: string | number | Date | null
    primaryConducted: boolean | null
    secScheduledDate: string | number | Date | null
    secConducted: boolean | null
    offered: boolean | null
    joinedDate: string | number | Date | null
    updatedAt: string | number | Date | null
    isValidApplicant: boolean | null
    primaryNoShow: boolean | null
    secNoShow: boolean | null
    finalNoShow: boolean | null
    primaryScheduled: boolean | null
    secScheduled: boolean | null
    finalScheduled: boolean | null
    finalConducted: boolean | null
    docDeclined: boolean | null
    docRejectedMK: boolean | null
    docRejectedClient: boolean | null
    interviewDeclinedBefore: boolean | null
    primaryDeclinedAfter: boolean | null
    primaryRejected: boolean | null
    secDeclinedBefore: boolean | null
    secDeclinedAfter: boolean | null
    secRejected: boolean | null
    finalDeclinedBefore: boolean | null
    finalDeclinedAfter: boolean | null
    finalRejected: boolean | null
    offerDeclined: boolean | null
    joined: boolean | null
}) {
    const birthDate = normalizeDate_(row.birthDate)
    const age = resolveAge_(row.age, row.birthDate)

    const validApply = boolTo01_(row.isValidApplicant)
    const absent = boolTo01_(row.primaryNoShow || row.secNoShow || row.finalNoShow)
    const connected = boolTo01_(Boolean(row.connectedAt))
    const interviewSet = boolTo01_(
        row.primaryScheduled || row.secScheduled || row.finalScheduled
    )
    const seated = boolTo01_(row.primaryConducted || row.secConducted || row.finalConducted)
    const rejected = boolTo01_(
        row.docDeclined ||
            row.docRejectedMK ||
            row.docRejectedClient ||
            row.interviewDeclinedBefore ||
            row.primaryDeclinedAfter ||
            row.primaryRejected ||
            row.secDeclinedBefore ||
            row.secDeclinedAfter ||
            row.secRejected ||
            row.finalDeclinedBefore ||
            row.finalDeclinedAfter ||
            row.finalRejected
    )
    const offer = boolTo01_(row.offered)
    const offerDeclined = boolTo01_(row.offerDeclined)
    const joined = boolTo01_(row.joined)

    return {
        applicantId: row.id,
        applicant_id: row.id,
        id: row.id,
        name: row.name,
        email: row.email || "",
        furigana: row.furigana || "",
        phone: row.phone || "",
        address: row.address || "",
        gender: row.gender || "",
        birthDate,
        caseName: row.caseName || "",
        appliedJob: row.appliedJob || "",
        appliedLocation: row.appliedLocation || "",
        age,
        notes: row.notes || "",
        assigneeName: row.assigneeName || "",
        responseStatus: row.responseStatus || "",
        connectedAt: toIsoString_(row.connectedAt),
        nextActionDate: normalizeDate_(row.nextActionDate),
        appliedAt: toIsoString_(row.appliedAt),
        primaryScheduledDate: normalizeDate_(row.primaryScheduledDate),
        primaryConducted: boolTo01_(row.primaryConducted),
        secScheduledDate: normalizeDate_(row.secScheduledDate),
        secConducted: boolTo01_(row.secConducted),
        joinedDate: normalizeDate_(row.joinedDate),
        updatedAt: toIsoString_(row.updatedAt),
        validApply,
        absent,
        connected,
        interviewSet,
        seated,
        rejected,
        offer,
        offerDeclined,
        joined,
        left: 0,
    }
}

function resolveAge_(age: number | null, birthDateRaw: string | number | Date | null): number | null {
    if (typeof age === "number" && Number.isFinite(age) && age >= 0) {
        return Math.floor(age)
    }

    if (!birthDateRaw) {
        return null
    }

    const birthDate = birthDateRaw instanceof Date ? birthDateRaw : new Date(birthDateRaw)
    if (Number.isNaN(birthDate.getTime())) {
        return null
    }

    const now = new Date()
    let resolved = now.getFullYear() - birthDate.getFullYear()
    const monthDiff = now.getMonth() - birthDate.getMonth()
    const dayDiff = now.getDate() - birthDate.getDate()
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        resolved -= 1
    }

    return resolved >= 0 ? resolved : null
}

function buildNextCursor_(
    rows: Array<{
        id: string
        updatedAt: string | number | Date | null
    }>,
    pageSize: number
) {
    if (!rows.length || rows.length < pageSize) {
        return ""
    }

    const row = rows[rows.length - 1]
    if (!row?.id || !row.updatedAt) {
        return ""
    }

    const updatedAt = toIsoString_(row.updatedAt)
    if (!updatedAt) return ""

    return JSON.stringify({
        updatedAt,
        id: row.id,
    })
}

async function parseRequestBody_(request: NextRequest): Promise<ParseBodyResult> {
    try {
        const raw: unknown = await request.json()
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            return { ok: false, error: "Invalid JSON payload" }
        }
        return { ok: true, value: raw as SyncRequestPayload }
    } catch {
        return { ok: false, error: "Invalid JSON payload" }
    }
}

function parseDate_(value: unknown): Date | null {
    if (!value) return null

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }

    if (typeof value === "number") {
        const parsed = Number.isFinite(value)
            ? new Date(value > 1_000_000_000_000 ? value : value * 1000)
            : null
        return parsed && Number.isFinite(parsed.getTime()) ? parsed : null
    }

    if (typeof value === "string") {
        const trimmed = value.trim()
        if (!trimmed) return null

        const parsedAsNumber = Number(trimmed)
        if (Number.isFinite(parsedAsNumber)) {
            const parsed =
                parsedAsNumber > 1_000_000_000_000
                    ? new Date(parsedAsNumber)
                    : new Date(parsedAsNumber * 1000)
            return Number.isFinite(parsed.getTime()) ? parsed : null
        }

        const parsed = new Date(trimmed)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }

    return null
}

function parseCursor_(raw: unknown): { updatedAt: Date; id: string } | null {
    if (typeof raw !== "string") {
        return null
    }

    const text = raw.trim()
    if (!text) return null

    try {
        const parsed = JSON.parse(text)
        if (!parsed || typeof parsed !== "object") return null

        const parsedUpdatedAt = parseDate_(parsed.updatedAt)
        const id = typeof parsed.id === "string" ? parsed.id.trim() : ""
        if (!parsedUpdatedAt || !id) return null

        return { updatedAt: parsedUpdatedAt, id }
    } catch {
        return null
    }
}

function parsePageSize_(limit: unknown, pageSize: unknown): number {
    const raw = limit ?? pageSize
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_PAGE_SIZE
    return Math.min(Math.floor(n), MAX_PAGE_SIZE)
}

function boolTo01_(value: boolean | null | undefined): 0 | 1 {
    return value ? 1 : 0
}

function toIsoString_(value: string | number | Date | null | undefined): string {
    if (!value) return ""
    const d = value instanceof Date ? value : new Date(value)
    return Number.isNaN(d.getTime()) ? "" : d.toISOString()
}

function normalizeDate_(value: string | number | Date | null | undefined): string {
    if (!value) return ""
    const d = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(d.getTime())) return ""
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

function normalizeText_(value: unknown): string {
    return typeof value === "string" ? value.trim() : ""
}

function toUnixSeconds_(value: Date): number {
    const ms = value.getTime()
    if (!Number.isFinite(ms) || ms <= 0) return 0
    return Math.floor(ms / 1000)
}

function errorToMessage_(error: unknown): string {
    if (!error) return "unknown error"
    if (error instanceof Error) {
        return error.stack || error.message || String(error)
    }
    return String(error)
}

function resolveCompanies_(companies: CompanyRow[], requestedName: string, companyCode: string): CompanyResolutionResult {
    const exactMatches = companies.filter((company) => company.name === requestedName)
    if (exactMatches.length > 0) {
        return {
            companies: sortCompanies_(exactMatches),
            allowMultiple: exactMatches.length > 1,
            strategy: "exact_name",
        }
    }

    const normalizedRequestedName = normalizeCompanyNameForMatch(requestedName)
    const rule = buildCompanyResolutionRule_(companyCode, requestedName, normalizedRequestedName)
    if (rule) {
        const matchedByRule = companies.filter((company) => {
            const normalizedCompanyName = normalizeCompanyNameForMatch(company.name)
            if (!normalizedCompanyName) return false
            return matchesRule_(normalizedCompanyName, rule)
        })
        return {
            companies: sortCompanies_(matchedByRule),
            allowMultiple: !!rule.allowMultiple,
            strategy: `rule:${rule.key}`,
        }
    }

    const keywords = buildCompanyKeywords_(requestedName, companyCode)
    if (!keywords.length) {
        return {
            companies: [],
            allowMultiple: false,
            strategy: "no_keywords",
        }
    }

    const matched = companies.filter((company) => {
        const normalizedCompanyName = normalizeCompanyNameForMatch(company.name)
        if (!normalizedCompanyName) return false

        for (const keyword of keywords) {
            if (normalizedCompanyName === keyword) {
                return true
            }
            if (keyword.length >= 3 && normalizedCompanyName.includes(keyword)) {
                return true
            }
        }
        return false
    })

    const splitCount = requestedName.split(/[\/／]/g).filter((value) => value.trim()).length
    return {
        companies: sortCompanies_(matched),
        allowMultiple: splitCount >= 2,
        strategy: "generic_keywords",
    }
}

function buildCompanyResolutionRule_(
    companyCode: string,
    requestedName: string,
    normalizedRequestedName: string
): CompanyResolutionRule | null {
    const tokyoHeartsKeyword = normalizeCompanyNameForMatch("東京ハーツ")
    const heartsKeyword = normalizeCompanyNameForMatch("ハーツ")
    const anytimeKeyword = normalizeCompanyNameForMatch("エニタイム")
    const tkcKeyword = normalizeCompanyNameForMatch("TKC")
    const ymdKeyword = normalizeCompanyNameForMatch("YMD")

    if (
        companyCode === "company_012" ||
        normalizedRequestedName === tokyoHeartsKeyword ||
        requestedName.includes("東京ハーツ")
    ) {
        return {
            key: "tokyo_hearts_exact",
            mode: "exact",
            include: [tokyoHeartsKeyword],
            allowMultiple: false,
        }
    }

    if (companyCode === "company_005") {
        return {
            key: "hearts_without_tokyo",
            mode: "contains",
            include: [heartsKeyword],
            exclude: [tokyoHeartsKeyword],
            allowMultiple: true,
        }
    }

    if (companyCode === "company_002") {
        return {
            key: "tkc_ymd_group",
            mode: "contains",
            include: [tkcKeyword, ymdKeyword],
            allowMultiple: true,
        }
    }

    if (companyCode === "company_014") {
        return {
            key: "anytime_group",
            mode: "contains",
            include: [anytimeKeyword],
            allowMultiple: true,
        }
    }

    return null
}

function matchesRule_(normalizedCompanyName: string, rule: CompanyResolutionRule): boolean {
    if (rule.exclude && rule.exclude.length > 0) {
        for (const excluded of rule.exclude) {
            if (!excluded) continue
            if (normalizedCompanyName === excluded || normalizedCompanyName.includes(excluded)) {
                return false
            }
        }
    }

    if (rule.mode === "exact") {
        for (const token of rule.include) {
            if (normalizedCompanyName === token) {
                return true
            }
        }
        return false
    }

    for (const token of rule.include) {
        if (!token) continue
        if (normalizedCompanyName === token || normalizedCompanyName.includes(token)) {
            return true
        }
    }
    return false
}

function sortCompanies_(companies: CompanyRow[]): CompanyRow[] {
    const uniqueById = new Map<string, CompanyRow>()
    for (const company of companies) {
        uniqueById.set(company.id, company)
    }
    return Array.from(uniqueById.values()).sort((a, b) => a.name.localeCompare(b.name, "ja"))
}

function buildCompanyKeywords_(requestedName: string, companyCode: string): string[] {
    const keywords = new Set<string>()
    const add = (value: string) => {
        const normalized = normalizeCompanyNameForMatch(value)
        if (normalized.length >= 2) {
            keywords.add(normalized)
        }
    }

    add(requestedName)
    add(companyCode)

    for (const part of requestedName.split(/[\/／]/g)) {
        add(part)
    }

    const withoutParentheses = requestedName.replace(/[（(][^（）()]*[）)]/g, "")
    add(withoutParentheses)

    const parenthesizedParts = requestedName.match(/[（(]([^（）()]+)[）)]/g) || []
    for (const token of parenthesizedParts) {
        add(token.replace(/[（()）]/g, ""))
    }

    return Array.from(keywords)
}

