"use server"

import { auth } from "@/auth"
import { db, schema } from "@/db"
import { isAdminUser } from "@/lib/userAccess"
import { normalizeCompanyName, isCompanyNameUniqueConstraintError } from "@/lib/company-name"
import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { copyTemplateSpreadsheet } from "@/lib/google-sheets"

async function requireAdmin() {
    const session = await auth()
    if (!isAdminUser(session?.user?.email)) {
        throw new Error("Unauthorized")
    }
}

export type CompanySheetRow = {
    id: string
    companyId: string
    companyName: string
    spreadsheetId: string
    gid: number
    sheetName: string | null
    enabled: boolean
}

export async function getCompanySheets(): Promise<CompanySheetRow[]> {
    const rows = await db
        .select({
            id: schema.companySheets.id,
            companyId: schema.companySheets.companyId,
            companyName: schema.companies.name,
            spreadsheetId: schema.companySheets.spreadsheetId,
            gid: schema.companySheets.gid,
            sheetName: schema.companySheets.sheetName,
            enabled: schema.companySheets.enabled,
        })
        .from(schema.companySheets)
        .leftJoin(schema.companies, eq(schema.companySheets.companyId, schema.companies.id))
        .all()

    return rows
        .map((row) => ({
            id: row.id,
            companyId: row.companyId,
            companyName: row.companyName || "Unknown",
            spreadsheetId: row.spreadsheetId,
            gid: row.gid ?? 0,
            sheetName: row.sheetName,
            enabled: row.enabled ?? true,
        }))
        .sort((a, b) => a.companyName.localeCompare(b.companyName, "ja"))
}

export async function createCompanySheet(data: {
    companyName: string
    spreadsheetId: string
    gid?: number
    sheetName?: string
}) {
    await requireAdmin()

    const normalizedName = normalizeCompanyName(data.companyName)
    if (!normalizedName) {
        throw new Error("企業名を入力してください。")
    }

    // 企業を検索、存在しなければ自動作成
    let company = await db
        .select({ id: schema.companies.id, name: schema.companies.name })
        .from(schema.companies)
        .where(eq(schema.companies.name, normalizedName))
        .get()

    if (!company) {
        const companyId = crypto.randomUUID()
        try {
            await db.insert(schema.companies).values({ id: companyId, name: normalizedName })
        } catch (error) {
            if (!isCompanyNameUniqueConstraintError(error)) {
                throw error
            }
            // レースコンディション: 他で作成済み → 再取得
            company = await db
                .select({ id: schema.companies.id, name: schema.companies.name })
                .from(schema.companies)
                .where(eq(schema.companies.name, normalizedName))
                .get()
        }
        if (!company) {
            company = { id: companyId, name: normalizedName }
        }
    }

    const id = crypto.randomUUID()
    await db.insert(schema.companySheets).values({
        id,
        companyId: company.id,
        spreadsheetId: data.spreadsheetId,
        gid: data.gid ?? 0,
        sheetName: data.sheetName || null,
    })
    revalidatePath("/admin/sheets")
    revalidatePath("/companies")
    return { success: true, id, companyId: company.id, companyName: company.name }
}

export async function createCompanySheetWithAutoSpreadsheet(data: {
    companyName: string
}) {
    try {
        await requireAdmin()

        const normalizedName = normalizeCompanyName(data.companyName)
        if (!normalizedName) {
            return { success: false as const, error: "企業名を入力してください。" }
        }

        // 企業を検索、存在しなければ自動作成
        let company = await db
            .select({ id: schema.companies.id, name: schema.companies.name })
            .from(schema.companies)
            .where(eq(schema.companies.name, normalizedName))
            .get()

        if (!company) {
            const companyId = crypto.randomUUID()
            try {
                await db.insert(schema.companies).values({ id: companyId, name: normalizedName })
            } catch (error) {
                if (!isCompanyNameUniqueConstraintError(error)) {
                    throw error
                }
                company = await db
                    .select({ id: schema.companies.id, name: schema.companies.name })
                    .from(schema.companies)
                    .where(eq(schema.companies.name, normalizedName))
                    .get()
            }
            if (!company) {
                company = { id: companyId, name: normalizedName }
            }
        }

        // テンプレートからスプレッドシートを自動作成
        const sheet = await copyTemplateSpreadsheet(normalizedName)

        const id = crypto.randomUUID()
        await db.insert(schema.companySheets).values({
            id,
            companyId: company.id,
            spreadsheetId: sheet.spreadsheetId,
            gid: sheet.gid,
            sheetName: sheet.sheetName,
        })
        revalidatePath("/admin/sheets")
        revalidatePath("/companies")
        return {
            success: true as const,
            id,
            companyId: company.id,
            companyName: company.name,
            spreadsheetId: sheet.spreadsheetId,
            gid: sheet.gid,
            sheetName: sheet.sheetName,
            spreadsheetUrl: sheet.spreadsheetUrl,
        }
    } catch (error) {
        return {
            success: false as const,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

export async function updateCompanySheet(
    id: string,
    data: {
        spreadsheetId?: string
        gid?: number
        sheetName?: string
        enabled?: boolean
    }
) {
    await requireAdmin()
    await db
        .update(schema.companySheets)
        .set(data)
        .where(eq(schema.companySheets.id, id))
    revalidatePath("/admin/sheets")
    return { success: true }
}

export async function deleteCompanySheet(id: string) {
    await requireAdmin()
    await db.delete(schema.companySheets).where(eq(schema.companySheets.id, id))
    revalidatePath("/admin/sheets")
    return { success: true }
}

export type UnlinkedCompany = {
    id: string
    name: string
    applicantCount: number
}

export type CompanyAliasRow = {
    id: string
    companyId: string
    alias: string
}

export async function getCompanyAliases(): Promise<CompanyAliasRow[]> {
    const rows = await db
        .select({
            id: schema.companyAliases.id,
            companyId: schema.companyAliases.companyId,
            alias: schema.companyAliases.alias,
        })
        .from(schema.companyAliases)
        .all()

    return rows
}

export async function addCompanyAlias(companyId: string, alias: string) {
    await requireAdmin()

    const normalized = normalizeCompanyName(alias)
    if (!normalized) {
        return { success: false, error: "エイリアスを入力してください。" }
    }

    // 正規名との重複チェック
    const existingCompany = await db
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(eq(schema.companies.name, normalized))
        .get()

    if (existingCompany) {
        return { success: false, error: `「${normalized}」は既に企業名として登録されています。` }
    }

    const id = crypto.randomUUID()
    try {
        await db.insert(schema.companyAliases).values({ id, companyId, alias: normalized })
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        if (msg.includes("UNIQUE constraint failed")) {
            return { success: false, error: `「${normalized}」は既に別のエイリアスとして登録されています。` }
        }
        throw error
    }

    revalidatePath("/admin/sheets")
    return { success: true, id }
}

export async function deleteCompanyAlias(aliasId: string) {
    await requireAdmin()
    await db.delete(schema.companyAliases).where(eq(schema.companyAliases.id, aliasId))
    revalidatePath("/admin/sheets")
    return { success: true }
}

export type CompanySheetMapEntry = {
    spreadsheetId: string
    gid: number
    sheetName: string | null
}

export async function getCompanySheetMap(): Promise<Record<string, CompanySheetMapEntry>> {
    const rows = await db
        .select({
            companyId: schema.companySheets.companyId,
            spreadsheetId: schema.companySheets.spreadsheetId,
            gid: schema.companySheets.gid,
            sheetName: schema.companySheets.sheetName,
        })
        .from(schema.companySheets)
        .where(eq(schema.companySheets.enabled, true))
        .all()

    const map: Record<string, CompanySheetMapEntry> = {}
    for (const row of rows) {
        map[row.companyId] = {
            spreadsheetId: row.spreadsheetId,
            gid: row.gid ?? 0,
            sheetName: row.sheetName,
        }
    }
    return map
}

export async function getUnlinkedCompanies(): Promise<UnlinkedCompany[]> {
    const rows = await db
        .select({
            id: schema.companies.id,
            name: schema.companies.name,
            applicantCount: sql<number>`count(${schema.applicants.id})`,
        })
        .from(schema.companies)
        .leftJoin(schema.applicants, eq(schema.applicants.companyId, schema.companies.id))
        .where(
            sql`${schema.companies.id} NOT IN (
                SELECT ${schema.companySheets.companyId} FROM ${schema.companySheets} WHERE ${schema.companySheets.enabled} = 1
            )`
        )
        .groupBy(schema.companies.id, schema.companies.name)
        .having(sql`count(${schema.applicants.id}) > 0`)
        .all()

    return rows
        .map((row) => ({
            id: row.id,
            name: row.name,
            applicantCount: Number(row.applicantCount),
        }))
        .sort((a, b) => b.applicantCount - a.applicantCount)
}

