import { auth } from "@/auth"
import { db, schema } from "@/db"
import { isCompanyNameUniqueConstraintError, normalizeCompanyName } from "@/lib/company-name"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const HEADER_ALIASES = {
    applicantId: ["応募者ID", "id", "applicantId"],
    appliedAt: ["応募日", "appliedAt"],
    companyName: ["企業名", "会社名", "companyName", "company"],
    caseName: ["案件名", "caseName"],
    name: ["氏名", "名前", "name"],
    email: ["mail", "Mail", "email", "メールアドレス"],
    appliedJob: ["応募案件名", "職種名", "appliedJob", "job"],
    appliedLocation: ["勤務地", "appliedLocation", "location"],
    phone: ["電話番号", "TEL", "phone"],
    age: ["年齢", "age"],
    birthDate: ["生年月日", "birthDate"],
    gender: ["性別", "gender"],
    assigneeName: ["担当者名", "担当者", "assigneeName"],
    isValidApplicant: ["有効応募", "isValidApplicant"],
    responseStatus: ["対応ステータス", "ステータス", "responseStatus"],
    notes: ["備考", "notes"],
    nextActionDate: ["次回アクション日", "nextActionDate"],
    connectedAt: ["通電日", "connectedAt"],
    primaryScheduledDate: ["面接日程", "primaryScheduledDate"],
    primaryConducted: ["面接実施", "primaryConducted"],
    secScheduledDate: ["二次/最終面接日程", "secScheduledDate"],
    secConducted: ["二次/最終面接実施", "secConducted"],
    offered: ["内定可否", "offered", "内定"],
    joinedDate: ["入社日", "joinedDate"],
} as const

const ENCODING_CANDIDATES = ["utf-8", "shift_jis"] as const

export async function POST(request: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: "CSVファイルが送信されていません。" }, { status: 400 })
    }
    if (file.size <= 0) {
        return NextResponse.json({ success: false, error: "CSVファイルが空です。" }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json({ success: false, error: "CSVファイルサイズが大きすぎます（10MBまで）。" }, { status: 400 })
    }

    const csvText = await readCsvText(file)
    const rows = parseCsvRows(csvText)
    if (rows.length < 2) {
        return NextResponse.json({ success: false, error: "ヘッダー行とデータ行を含むCSVを指定してください。" }, { status: 400 })
    }

    const headers = rows[0].map(normalizeHeader)
    const indexMap = buildIndexMap(headers)
    const hasCompanyHeader = hasAnyHeader(indexMap, HEADER_ALIASES.companyName)
    const hasNameHeader = hasAnyHeader(indexMap, HEADER_ALIASES.name)
    if (!hasCompanyHeader || !hasNameHeader) {
        return NextResponse.json(
            { success: false, error: "必須列（企業名・氏名）が見つかりません。CSVヘッダーを確認してください。" },
            { status: 400 },
        )
    }

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
        const applicantId = getCell(row, indexMap, HEADER_ALIASES.applicantId)
        const companyName = getCell(row, indexMap, HEADER_ALIASES.companyName)
        const name = getCell(row, indexMap, HEADER_ALIASES.name)

        if (!companyName || !name) {
            skipped += 1
            errors.push(`行${rowNo}: 企業名または氏名が不足しています。`)
            continue
        }

        try {
            const companyId = await resolveCompanyId(companyName, companyCache)
            const appliedAt = parseDateValue(getCell(row, indexMap, HEADER_ALIASES.appliedAt))

            const baseValues: Partial<typeof schema.applicants.$inferInsert> = {
                companyId,
                name,
                caseName: toNullableString(getCell(row, indexMap, HEADER_ALIASES.caseName)),
                email: toNullableString(getCell(row, indexMap, HEADER_ALIASES.email)),
                appliedJob: toNullableString(getCell(row, indexMap, HEADER_ALIASES.appliedJob)),
                appliedLocation: toNullableString(getCell(row, indexMap, HEADER_ALIASES.appliedLocation)),
                phone: toNullableString(getCell(row, indexMap, HEADER_ALIASES.phone)),
                gender: toNullableString(getCell(row, indexMap, HEADER_ALIASES.gender)),
                assigneeName: toNullableString(getCell(row, indexMap, HEADER_ALIASES.assigneeName)),
                responseStatus: toNullableString(getCell(row, indexMap, HEADER_ALIASES.responseStatus)),
                notes: toNullableString(getCell(row, indexMap, HEADER_ALIASES.notes)),
                age: parseAge(getCell(row, indexMap, HEADER_ALIASES.age)),
                birthDate: parseDateValue(getCell(row, indexMap, HEADER_ALIASES.birthDate)),
                nextActionDate: parseDateValue(getCell(row, indexMap, HEADER_ALIASES.nextActionDate)),
                connectedAt: parseDateValue(getCell(row, indexMap, HEADER_ALIASES.connectedAt)),
                primaryScheduledDate: parseDateValue(getCell(row, indexMap, HEADER_ALIASES.primaryScheduledDate)),
                secScheduledDate: parseDateValue(getCell(row, indexMap, HEADER_ALIASES.secScheduledDate)),
                joinedDate: parseDateValue(getCell(row, indexMap, HEADER_ALIASES.joinedDate)),
                updatedAt: new Date(),
            }

            const isValidApplicant = parseBoolean(getCell(row, indexMap, HEADER_ALIASES.isValidApplicant))
            if (isValidApplicant !== undefined) {
                baseValues.isValidApplicant = isValidApplicant
            }

            const primaryConducted = parseBoolean(getCell(row, indexMap, HEADER_ALIASES.primaryConducted))
            if (primaryConducted !== undefined) {
                baseValues.primaryConducted = primaryConducted
            }

            const secConducted = parseBoolean(getCell(row, indexMap, HEADER_ALIASES.secConducted))
            if (secConducted !== undefined) {
                baseValues.secConducted = secConducted
            }

            const offered = parseBoolean(getCell(row, indexMap, HEADER_ALIASES.offered))
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
        throw new Error("企業名が空です。")
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
            throw new Error("企業情報の登録に失敗しました。")
        }
        cache.set(normalized, raced.id)
        return raced.id
    }
}

async function readCsvText(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer())

    let bestText = new TextDecoder("utf-8").decode(bytes)
    let bestScore = scoreCsvText(bestText)

    for (const encoding of ENCODING_CANDIDATES) {
        try {
            const text = new TextDecoder(encoding).decode(bytes)
            const score = scoreCsvText(text)
            if (score > bestScore) {
                bestText = text
                bestScore = score
            }
        } catch {
            // Unsupported encoding in runtime.
        }
    }

    return bestText
}

function scoreCsvText(text: string) {
    const rows = parseCsvRows(text)
    if (rows.length === 0) return -1

    const headers = rows[0].map(normalizeHeader)
    const indexMap = buildIndexMap(headers)
    let score = 0

    for (const aliases of Object.values(HEADER_ALIASES)) {
        if (hasAnyHeader(indexMap, aliases)) {
            score += 1
        }
    }

    return score
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
    return String(value || "")
        .replace(/^\uFEFF/, "")
        .replace(/\s+/g, "")
        .trim()
}

function buildIndexMap(headers: string[]) {
    const indexMap = new Map<string, number>()
    headers.forEach((header, index) => {
        const normalized = normalizeHeader(header)
        if (!normalized) return
        indexMap.set(normalized, index)
    })
    return indexMap
}

function hasAnyHeader(indexMap: Map<string, number>, names: readonly string[]) {
    return names.some((name) => indexMap.has(normalizeHeader(name)))
}

function getCell(row: string[], indexMap: Map<string, number>, names: readonly string[]) {
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

    const truthy = new Set(["true", "1", "yes", "y", "on", "○", "◯", "はい", "有効", "済", "実施", "あり"])
    const falsy = new Set(["false", "0", "no", "n", "off", "×", "✕", "いいえ", "無効", "未", "未実施", "なし"])

    if (truthy.has(normalized)) return true
    if (falsy.has(normalized)) return false
    return undefined
}
