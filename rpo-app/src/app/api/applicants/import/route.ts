import { auth } from "@/auth"
import { db, schema } from "@/db"
import { isCompanyNameUniqueConstraintError, normalizeCompanyName } from "@/lib/company-name"
import { revalidatePath } from "next/cache"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export async function POST(request: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: "CSVファイルが指定されていません。" }, { status: 400 })
    }
    if (file.size <= 0) {
        return NextResponse.json({ success: false, error: "CSVファイルが空です。" }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ success: false, error: "CSVファイルサイズが大きすぎます（10MB以下）。" }, { status: 400 })
    }

    const csvText = await file.text()
    const rows = parseCsvRows(csvText)
    if (rows.length < 2) {
        return NextResponse.json({ success: false, error: "ヘッダー行とデータ行を含むCSVを指定してください。" }, { status: 400 })
    }

    const headers = rows[0].map(normalizeHeader)
    const indexMap = new Map(headers.map((header, index) => [header, index]))

    const companyCache = new Map<string, string>()
    let created = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || []
        if (row.every((value) => !String(value).trim())) {
            skipped += 1
            continue
        }

        const rowNo = i + 1
        const applicantId = getCell(row, indexMap, ["応募者ID", "id"])
        const companyName = getCell(row, indexMap, ["会社名", "企業名"])
        const name = getCell(row, indexMap, ["氏名", "名前", "name"])

        if (!companyName || !name) {
            skipped += 1
            errors.push(`行${rowNo}: 会社名または氏名が不足しています。`)
            continue
        }

        try {
            const companyId = await resolveCompanyId(companyName, companyCache)
            const appliedAt = parseDateValue(getCell(row, indexMap, ["応募日", "appliedAt"]))

            const baseValues: Partial<typeof schema.applicants.$inferInsert> = {
                companyId,
                name,
                caseName: toNullableString(getCell(row, indexMap, ["案件名", "caseName"])),
                email: toNullableString(getCell(row, indexMap, ["mail", "Mail", "email"])),
                appliedJob: toNullableString(getCell(row, indexMap, ["応募職種名", "appliedJob"])),
                appliedLocation: toNullableString(getCell(row, indexMap, ["勤務地", "appliedLocation"])),
                phone: toNullableString(getCell(row, indexMap, ["電話番号", "TEL", "phone"])),
                gender: toNullableString(getCell(row, indexMap, ["性別", "gender"])),
                assigneeName: toNullableString(getCell(row, indexMap, ["担当者名", "assigneeName"])),
                responseStatus: toNullableString(getCell(row, indexMap, ["対応状況", "responseStatus"])),
                notes: toNullableString(getCell(row, indexMap, ["備考", "notes"])),
                age: parseAge(getCell(row, indexMap, ["年齢", "age"])),
                birthDate: parseDateValue(getCell(row, indexMap, ["生年月日", "birthDate"])),
                nextActionDate: parseDateValue(getCell(row, indexMap, ["次回アクション日", "nextActionDate"])),
                connectedAt: parseDateValue(getCell(row, indexMap, ["通電日", "connectedAt"])),
                primaryScheduledDate: parseDateValue(getCell(row, indexMap, ["面接予定日", "primaryScheduledDate"])),
                secScheduledDate: parseDateValue(getCell(row, indexMap, ["二次/最終面接予定日", "secScheduledDate"])),
                joinedDate: parseDateValue(getCell(row, indexMap, ["入社日", "joinedDate"])),
                updatedAt: new Date(),
            }

            const isValidApplicant = parseBoolean(getCell(row, indexMap, ["有効応募", "isValidApplicant"]))
            if (isValidApplicant !== undefined) {
                baseValues.isValidApplicant = isValidApplicant
            }

            const primaryConducted = parseBoolean(getCell(row, indexMap, ["実施可否", "primaryConducted"]))
            if (primaryConducted !== undefined) {
                baseValues.primaryConducted = primaryConducted
            }

            const secConducted = parseBoolean(getCell(row, indexMap, ["二次/最終実施可否", "secConducted"]))
            if (secConducted !== undefined) {
                baseValues.secConducted = secConducted
            }

            const offered = parseBoolean(getCell(row, indexMap, ["内定可否", "offered"]))
            if (offered !== undefined) {
                baseValues.offered = offered
            }

            if (applicantId) {
                const existing = await db
                    .select({ id: schema.applicants.id })
                    .from(schema.applicants)
                    .where(eq(schema.applicants.id, applicantId))
                    .get()

                if (existing) {
                    const updateValues = { ...baseValues }
                    if (appliedAt) {
                        updateValues.appliedAt = appliedAt
                    }
                    await db
                        .update(schema.applicants)
                        .set(updateValues)
                        .where(eq(schema.applicants.id, applicantId))
                    updated += 1
                    continue
                }
            }

            const id = applicantId || crypto.randomUUID()
            const insertValues: typeof schema.applicants.$inferInsert = {
                id,
                companyId,
                name,
                appliedAt: appliedAt || new Date(),
                ...baseValues,
            }
            await db.insert(schema.applicants).values(insertValues)
            created += 1
        } catch (error) {
            skipped += 1
            const message = error instanceof Error ? error.message : String(error)
            errors.push(`行${rowNo}: ${message}`)
        }
    }

    if (created > 0 || updated > 0) {
        revalidatePath("/applicants")
        revalidatePath("/companies")
        revalidatePath("/calls")
    }

    return NextResponse.json({
        success: true,
        created,
        updated,
        skipped,
        errors: errors.slice(0, 50),
    })
}

async function resolveCompanyId(companyName: string, cache: Map<string, string>) {
    const normalized = normalizeCompanyName(companyName)
    if (!normalized) {
        throw new Error("会社名が空です。")
    }

    if (cache.has(normalized)) {
        return cache.get(normalized)!
    }

    const existing = await db
        .select({ id: schema.companies.id })
        .from(schema.companies)
        .where(eq(schema.companies.name, normalized))
        .get()
    if (existing) {
        cache.set(normalized, existing.id)
        return existing.id
    }

    const id = crypto.randomUUID()
    try {
        await db.insert(schema.companies).values({ id, name: normalized })
        cache.set(normalized, id)
        return id
    } catch (error) {
        if (!isCompanyNameUniqueConstraintError(error)) {
            throw error
        }

        const raced = await db
            .select({ id: schema.companies.id })
            .from(schema.companies)
            .where(eq(schema.companies.name, normalized))
            .get()
        if (!raced) {
            throw new Error("会社情報の作成に失敗しました。")
        }
        cache.set(normalized, raced.id)
        return raced.id
    }
}

function parseCsvRows(content: string): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let field = ""
    let inQuotes = false

    for (let i = 0; i < content.length; i++) {
        const char = content[i]

        if (inQuotes) {
            if (char === "\"") {
                if (content[i + 1] === "\"") {
                    field += "\""
                    i += 1
                } else {
                    inQuotes = false
                }
            } else {
                field += char
            }
            continue
        }

        if (char === "\"") {
            inQuotes = true
            continue
        }
        if (char === ",") {
            row.push(field)
            field = ""
            continue
        }
        if (char === "\n") {
            row.push(field)
            rows.push(row)
            row = []
            field = ""
            continue
        }
        if (char === "\r") {
            continue
        }

        field += char
    }

    row.push(field)
    if (row.some((value) => value.length > 0) || rows.length === 0) {
        rows.push(row)
    }

    return rows
}

function normalizeHeader(value: string) {
    return String(value || "").replace(/^\uFEFF/, "").trim()
}

function getCell(row: string[], indexMap: Map<string, number>, names: string[]) {
    for (const name of names) {
        const index = indexMap.get(normalizeHeader(name))
        if (typeof index === "number") {
            return String(row[index] || "").trim()
        }
    }
    return ""
}

function toNullableString(value: string) {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
}

function parseAge(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return null
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0) return null
    return Math.floor(parsed)
}

function parseDateValue(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed) return null

    if (/^\d{8}$/.test(trimmed)) {
        const yyyy = Number(trimmed.slice(0, 4))
        const mm = Number(trimmed.slice(4, 6))
        const dd = Number(trimmed.slice(6, 8))
        const date = new Date(Date.UTC(yyyy, mm - 1, dd))
        if (!Number.isNaN(date.getTime())) return date
    }

    const asNumber = Number(trimmed)
    if (Number.isFinite(asNumber)) {
        if (asNumber >= 20_000 && asNumber <= 80_000) {
            // Excel serial date: days since 1899-12-30.
            const excelEpoch = Date.UTC(1899, 11, 30)
            const date = new Date(excelEpoch + asNumber * 24 * 60 * 60 * 1000)
            if (!Number.isNaN(date.getTime())) {
                return date
            }
        }

        const asUnixMs = asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000
        const date = new Date(asUnixMs)
        if (!Number.isNaN(date.getTime())) {
            return date
        }
    }

    const normalized = trimmed.replace(/\./g, "/")
    const date = new Date(normalized)
    if (Number.isNaN(date.getTime())) return null
    return date
}

function parseBoolean(raw: string): boolean | undefined {
    const normalized = raw.trim().toLowerCase()
    if (!normalized) return undefined

    const truthy = new Set(["true", "1", "yes", "y", "on", "○", "◯", "はい", "有効", "済"])
    const falsy = new Set(["false", "0", "no", "n", "off", "×", "✕", "いいえ", "無効", "未"])

    if (truthy.has(normalized)) return true
    if (falsy.has(normalized)) return false
    return undefined
}
