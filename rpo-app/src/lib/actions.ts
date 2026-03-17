"use server";

import { db, schema } from "@/db";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { isCompanyNameUniqueConstraintError, normalizeCompanyName } from "@/lib/company-name";

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
    searchKeyword?: string
    assigneeName?: string
    responseStatus?: string
    isValidApplicant?: "true" | "false"
    gender?: string
}

export async function getApplicants(
    filters: ApplicantFilters = {},
    page = 1,
    pageSize = 50
): Promise<ApplicantListResult> {
    const keyword = filters.searchKeyword?.trim()
    const currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const currentPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.max(Math.floor(pageSize), 1), 200) : 50

    const conditions = []

    if (filters.companyId) {
        conditions.push(eq(schema.applicants.companyId, filters.companyId))
    }

    if (keyword) {
        conditions.push(
            or(
                like(schema.applicants.name, `%${keyword}%`),
                like(schema.applicants.furigana, `%${keyword}%`)
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
        .leftJoin(schema.users, eq(schema.applicants.assigneeUserId, schema.users.id));

    const countedQuery = whereCondition ? countQuery.where(whereCondition) : countQuery;
    const listedQuery = whereCondition ? dataQuery.where(whereCondition) : dataQuery;

    const total = Number((await countedQuery.get())?.total || 0)
    const totalPages = Math.max(1, Math.ceil(total / currentPageSize))
    const safePage = total === 0 ? 1 : Math.min(currentPage, totalPages)
    const safeOffset = (safePage - 1) * currentPageSize

    const applicants = await listedQuery
        .orderBy(desc(schema.applicants.appliedAt), desc(schema.applicants.createdAt))
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

    const linkedApplicantCount = await db
        .select({ count: sql<number>`count(${schema.applicants.id})` })
        .from(schema.applicants)
        .where(eq(schema.applicants.companyId, trimmedCompanyId))
        .get()

    const applicantCount = Number(linkedApplicantCount?.count || 0)
    if (applicantCount > 0) {
        throw new Error(`応募者が${applicantCount}件紐づいているため、削除できません。`)
    }

    await db.delete(schema.companies).where(eq(schema.companies.id, trimmedCompanyId))
    revalidatePath("/companies")
    revalidatePath("/applicants")
    revalidatePath("/calls")
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
