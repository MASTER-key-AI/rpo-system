"use server";

import { db, schema } from "@/db";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isCompanyNameUniqueConstraintError, normalizeCompanyName } from "@/lib/company-name";

export type ApplicantSortField =
    | "appliedAt"
    | "nextActionDate"
    | "connectedAt"
    | "primaryScheduledDate"
    | "secScheduledDate"
    | "joinedDate"
export type ApplicantSortOrder = "asc" | "desc"

export type ApplicantListResult = {
    applicants: {
        id: string
        name: string
        furigana: string | null
        companyId: string
        companyName: string
        caseName: string | null
        email: string | null
        appliedAt: string | number | Date
        phone: string | null
        appliedJob: string | null
        appliedLocation: string | null
        age: number | null
        birthDate: string | number | Date | null
        gender: string | null
        notes: string | null
        assigneeUserId: string | null
        assigneeName: string | null
        responseStatus: string | null
        isValidApplicant: boolean | null
        connectedAt: string | number | Date | null
        nextActionDate: string | number | Date | null
        nextActionContent: string | null
        primaryScheduledDate: string | number | Date | null
        primaryConductedDate: string | number | Date | null
        primaryConducted: boolean | null
        secScheduledDate: string | number | Date | null
        secConductedDate: string | number | Date | null
        secConducted: boolean | null
        offered: boolean | null
        joinedDate: string | number | Date | null
    }[]
    total: number
    page: number
    pageSize: number
    totalPages: number
}

export type ApplicantFilters = {
    companyId?: string
    companyIds?: string[]
    searchKeyword?: string
    assigneeName?: string
    responseStatus?: string
    isValidApplicant?: "true" | "false"
    gender?: string
    offered?: "true" | "false"
    appliedDateFrom?: string
    appliedDateTo?: string
    sortField?: ApplicantSortField
    sortOrder?: ApplicantSortOrder
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

export async function getApplicants(
    filters: ApplicantFilters = {},
    page = 1,
    pageSize = 50
): Promise<ApplicantListResult> {
    const keyword = filters.searchKeyword?.trim()
    const companyIds = (filters.companyIds || [])
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    const normalizedCompanyIds = Array.from(new Set(companyIds))
    const currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const currentPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.max(Math.floor(pageSize), 1), 200) : 50
    const appliedDateFrom = parseAppliedDateFilter(filters.appliedDateFrom)
    const appliedDateTo = parseAppliedDateFilter(filters.appliedDateTo)
    const sortOrder: ApplicantSortOrder = filters.sortOrder === "asc" ? "asc" : "desc"

    const conditions = []

    if (filters.companyId) {
        conditions.push(eq(schema.applicants.companyId, filters.companyId))
    } else if (normalizedCompanyIds.length > 0) {
        conditions.push(inArray(schema.applicants.companyId, normalizedCompanyIds))
    }

    if (keyword) {
        const keywordPattern = `%${keyword}%`
        conditions.push(
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
                like(schema.applicants.nextActionContent, keywordPattern),
                sql`coalesce(${schema.applicants.assigneeName}, ${schema.users.name}, '') like ${keywordPattern}`,
                sql`cast(${schema.applicants.age} as text) like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.appliedAt}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.birthDate}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.nextActionDate}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.connectedAt}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.primaryScheduledDate}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.secScheduledDate}, 'unixepoch') like ${keywordPattern}`,
                sql`strftime('%Y-%m-%d', ${schema.applicants.joinedDate}, 'unixepoch') like ${keywordPattern}`
            )!
        )
    }

    if (filters.assigneeName) {
        conditions.push(
            sql`coalesce(${schema.applicants.assigneeName}, ${schema.users.name}) = ${filters.assigneeName}`
        )
    }

    if (filters.responseStatus) {
        conditions.push(eq(schema.applicants.responseStatus, filters.responseStatus))
    }

    if (filters.isValidApplicant === "true") {
        conditions.push(eq(schema.applicants.isValidApplicant, true))
    } else if (filters.isValidApplicant === "false") {
        conditions.push(
            or(
                eq(schema.applicants.isValidApplicant, false),
                sql`${schema.applicants.isValidApplicant} IS NULL`
            )!
        )
    }

    if (filters.gender) {
        conditions.push(eq(schema.applicants.gender, filters.gender))
    }

    if (filters.offered === "true") {
        conditions.push(eq(schema.applicants.offered, true))
    } else if (filters.offered === "false") {
        conditions.push(
            or(
                eq(schema.applicants.offered, false),
                sql`${schema.applicants.offered} IS NULL`,
            )!,
        )
    }

    if (appliedDateFrom) {
        conditions.push(sql`${schema.applicants.appliedAt} >= ${appliedDateFrom.startUnix}`)
    }
    if (appliedDateTo) {
        conditions.push(sql`${schema.applicants.appliedAt} < ${appliedDateTo.endUnix}`)
    }

    const whereCondition = conditions.length > 0 ? and(...conditions) : undefined

    const dataQuery = db
        .select({
            id: schema.applicants.id,
            name: schema.applicants.name,
            furigana: schema.applicants.furigana,
            companyId: schema.applicants.companyId,
            caseName: schema.applicants.caseName,
            email: schema.applicants.email,
            appliedAt: schema.applicants.appliedAt,
            phone: schema.applicants.phone,
            appliedJob: schema.applicants.appliedJob,
            appliedLocation: schema.applicants.appliedLocation,
            age: schema.applicants.age,
            birthDate: schema.applicants.birthDate,
            gender: schema.applicants.gender,
            notes: schema.applicants.notes,
            assigneeUserId: schema.applicants.assigneeUserId,
            assigneeName: sql<string>`coalesce(${schema.applicants.assigneeName}, ${schema.users.name})`,
            responseStatus: schema.applicants.responseStatus,
            isValidApplicant: schema.applicants.isValidApplicant,
            connectedAt: schema.applicants.connectedAt,
            nextActionDate: schema.applicants.nextActionDate,
            nextActionContent: schema.applicants.nextActionContent,
            primaryScheduledDate: schema.applicants.primaryScheduledDate,
            primaryConductedDate: schema.applicants.primaryConductedDate,
            primaryConducted: schema.applicants.primaryConducted,
            secScheduledDate: schema.applicants.secScheduledDate,
            secConductedDate: schema.applicants.secConductedDate,
            secConducted: schema.applicants.secConducted,
            offered: schema.applicants.offered,
            joinedDate: schema.applicants.joinedDate,
            companyName: schema.companies.name,
        })
        .from(schema.applicants)
        .leftJoin(schema.companies, eq(schema.applicants.companyId, schema.companies.id))
        .leftJoin(schema.users, eq(schema.applicants.assigneeUserId, schema.users.id));

    const countQuery = db
        .select({ total: sql<number>`count(${schema.applicants.id})` })
        .from(schema.applicants)
        .leftJoin(schema.companies, eq(schema.applicants.companyId, schema.companies.id))
        .leftJoin(schema.users, eq(schema.applicants.assigneeUserId, schema.users.id));

    const countedQuery = whereCondition ? countQuery.where(whereCondition) : countQuery;
    const listedQuery = whereCondition ? dataQuery.where(whereCondition) : dataQuery;

    const total = Number((await countedQuery.get())?.total || 0)
    const totalPages = Math.max(1, Math.ceil(total / currentPageSize))
    const safePage = total === 0 ? 1 : Math.min(currentPage, totalPages)
    const safeOffset = (safePage - 1) * currentPageSize

    const dateSortColumn =
        filters.sortField === "appliedAt"
            ? schema.applicants.appliedAt
            : filters.sortField === "nextActionDate"
            ? schema.applicants.nextActionDate
            : filters.sortField === "connectedAt"
                ? schema.applicants.connectedAt
                : filters.sortField === "primaryScheduledDate"
                    ? schema.applicants.primaryScheduledDate
                    : filters.sortField === "secScheduledDate"
                        ? schema.applicants.secScheduledDate
                        : filters.sortField === "joinedDate"
                            ? schema.applicants.joinedDate
                            : null

    const applicants = await (
        dateSortColumn
            ? listedQuery.orderBy(
                // Keep rows without date at the bottom for both asc/desc.
                sql`${dateSortColumn} IS NULL`,
                sortOrder === "asc" ? asc(dateSortColumn) : desc(dateSortColumn),
                desc(schema.applicants.appliedAt),
                desc(schema.applicants.createdAt),
            )
            : listedQuery.orderBy(
                // Default sort: latest applied date first.
                desc(schema.applicants.appliedAt),
                desc(schema.applicants.createdAt),
            )
    )
        .limit(currentPageSize)
        .offset(safeOffset)
        .all();

    return {
        applicants: applicants.map((app) => ({
            id: app.id,
            name: app.name,
            furigana: app.furigana ?? null,
            companyId: app.companyId,
            caseName: app.caseName ?? null,
            email: app.email ?? null,
            appliedAt: app.appliedAt || 0,
            phone: app.phone ?? null,
            appliedJob: app.appliedJob ?? null,
            appliedLocation: app.appliedLocation ?? null,
            age: app.age ?? null,
            birthDate: app.birthDate ?? null,
            gender: app.gender ?? null,
            notes: app.notes ?? null,
            assigneeUserId: app.assigneeUserId ?? null,
            assigneeName: app.assigneeName ?? null,
            responseStatus: app.responseStatus ?? null,
            isValidApplicant: app.isValidApplicant ?? null,
            connectedAt: app.connectedAt ?? null,
            nextActionDate: app.nextActionDate ?? null,
            nextActionContent: app.nextActionContent ?? null,
            primaryScheduledDate: app.primaryScheduledDate ?? null,
            primaryConductedDate: app.primaryConductedDate ?? null,
            primaryConducted: app.primaryConducted ?? null,
            secScheduledDate: app.secScheduledDate ?? null,
            secConductedDate: app.secConductedDate ?? null,
            secConducted: app.secConducted ?? null,
            offered: app.offered ?? null,
            joinedDate: app.joinedDate ?? null,
            companyName: app.companyName || "Unknown",
        })),
        total,
        page: safePage,
        pageSize: currentPageSize,
        totalPages,
    }
}

export async function getCompanies() {
    return await db.select().from(schema.companies).orderBy(schema.companies.name);
}

export type CompanyManagementRow = {
    id: string
    name: string
    applicantCount: number
    groupId: string | null
}

export type CaseManagementRow = {
    companyId: string
    companyName: string
    caseName: string
    applicantCount: number
}

export async function getCompanyManagementList(): Promise<CompanyManagementRow[]> {
    const rows = await db
        .select({
            id: schema.companies.id,
            name: schema.companies.name,
            groupId: schema.companies.groupId,
            applicantCount: sql<number>`count(${schema.applicants.id})`,
        })
        .from(schema.companies)
        .leftJoin(schema.applicants, eq(schema.applicants.companyId, schema.companies.id))
        .groupBy(schema.companies.id, schema.companies.name, schema.companies.groupId)
        .orderBy(schema.companies.name)
        .all()

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        applicantCount: Number(row.applicantCount || 0),
        groupId: row.groupId,
    }))
}

export async function getCaseManagementList(): Promise<CaseManagementRow[]> {
    const rows = await db
        .select({
            companyId: schema.companies.id,
            companyName: schema.companies.name,
            caseName: schema.applicants.caseName,
            applicantCount: sql<number>`count(${schema.applicants.id})`,
        })
        .from(schema.applicants)
        .innerJoin(schema.companies, eq(schema.applicants.companyId, schema.companies.id))
        .where(sql`nullif(trim(${schema.applicants.caseName}), '') is not null`)
        .groupBy(schema.companies.id, schema.companies.name, schema.applicants.caseName)
        .orderBy(schema.companies.name, schema.applicants.caseName)
        .all()

    return rows.map((row) => ({
        companyId: row.companyId,
        companyName: row.companyName,
        caseName: row.caseName ?? "",
        applicantCount: Number(row.applicantCount || 0),
    }))
}

export async function createCompany(name: string) {
    const normalizedName = normalizeCompanyName(name)
    if (!normalizedName) {
        throw new Error("企業名を入力してください。")
    }

    const existing = await db
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(eq(schema.companies.name, normalizedName))
        .get()

    if (existing) {
        return { success: true };
    }

    const id = crypto.randomUUID();
    try {
        await db.insert(schema.companies).values({ id, name: normalizedName });
    } catch (error) {
        if (!isCompanyNameUniqueConstraintError(error)) {
            throw error
        }
    }
    revalidatePath("/companies");
    return { success: true };
}

export async function deleteCompany(companyId: string) {
    const trimmedCompanyId = companyId.trim()
    if (!trimmedCompanyId) {
        throw new Error("企業IDが不正です。")
    }

    try {
        // Fetch applicant IDs first so we can clean up child tables that reference applicants
        const applicantRows = await db
            .select({ id: schema.applicants.id })
            .from(schema.applicants)
            .where(eq(schema.applicants.companyId, trimmedCompanyId))
        const applicantIds = applicantRows.map((r) => r.id)

        // Delete child rows of applicants before deleting applicants
        if (applicantIds.length > 0) {
            await db.delete(schema.callLogs).where(inArray(schema.callLogs.applicantId, applicantIds))
            await db.delete(schema.interviews).where(inArray(schema.interviews.applicantId, applicantIds))
        }
        // Delete company-level related rows
        await db.delete(schema.companyCaseTargets).where(eq(schema.companyCaseTargets.companyId, trimmedCompanyId))
        await db.delete(schema.analysisCriteria).where(eq(schema.analysisCriteria.companyId, trimmedCompanyId))
        await db.delete(schema.applicants).where(eq(schema.applicants.companyId, trimmedCompanyId))
        await db.delete(schema.companyAliases).where(eq(schema.companyAliases.companyId, trimmedCompanyId))
        await db.delete(schema.companySheets).where(eq(schema.companySheets.companyId, trimmedCompanyId))
        await db.delete(schema.companyCaseOptions).where(eq(schema.companyCaseOptions.companyId, trimmedCompanyId))
        await db.delete(schema.companies).where(eq(schema.companies.id, trimmedCompanyId))
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        console.error("[deleteCompany] failed", { companyId: trimmedCompanyId, detail })
        throw new Error(detail)
    }

    revalidatePath("/companies")
    revalidatePath("/companies/manage")
    revalidatePath("/companies/groups")
    revalidatePath("/applicants")
    revalidatePath("/calls")
    revalidatePath("/calls/history")
    revalidatePath("/calls/analysis")
    revalidatePath("/analysis")
    return { success: true }
}

export async function deleteCase(companyId: string, caseName: string) {
    const trimmedCompanyId = companyId.trim()
    const rawCaseName = caseName
    const trimmedCaseName = rawCaseName.trim()

    if (!trimmedCompanyId) {
        throw new Error("企業IDが不正です。")
    }
    if (!trimmedCaseName) {
        throw new Error("案件名が不正です。")
    }

    await db
        .update(schema.applicants)
        .set({
            caseName: null,
            updatedAt: sql`(strftime('%s', 'now'))`,
        })
        .where(
            and(
                eq(schema.applicants.companyId, trimmedCompanyId),
                eq(schema.applicants.caseName, rawCaseName),
            ),
        )

    revalidatePath("/companies")
    revalidatePath("/companies/manage")
    revalidatePath("/applicants")
    return { success: true }
}

export async function createApplicant(data: { name: string, companyId: string, appliedAt: number }) {
    const id = crypto.randomUUID();
    await db.insert(schema.applicants).values({
        id,
        name: data.name,
        companyId: data.companyId,
        appliedAt: new Date(data.appliedAt),
    });
    revalidatePath("/applicants");
    return { success: true };
}
