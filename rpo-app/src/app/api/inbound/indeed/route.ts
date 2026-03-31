import { NextRequest, NextResponse } from "next/server"

import { db, schema } from "@/db"
import { eq } from "drizzle-orm"
import { isCompanyNameUniqueConstraintError, normalizeCompanyName, normalizeCompanyNameForMatch } from "@/lib/company-name"
import { getRuntimeEnv } from "@/lib/runtime-env"

const API_KEY_HEADER = "x-rpo-api-key"
const API_KEY_ENV_NAME = "INBOUND_API_KEY"

export const runtime = "nodejs"

export async function GET() {
    return NextResponse.json(
        { success: false, error: "Method Not Allowed" },
        { status: 405 }
    )
}

export async function POST(request: NextRequest) {
    try {
        const configuredApiKey = getRuntimeEnv(API_KEY_ENV_NAME)

        if (!configuredApiKey) {
            return NextResponse.json(
                { success: false, error: "INBOUND_API_KEY is not configured" },
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

        let payload: Record<string, unknown>
        try {
            const raw = await request.json()
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
                throw new Error("invalid payload")
            }
            payload = raw as Record<string, unknown>
        } catch {
            return NextResponse.json(
                { success: false, error: "Invalid JSON payload" },
                { status: 400 }
            )
        }

        const name = normalizeText(payload.name)
        const companyName = normalizeText(
            payload.company ??
                payload.companyName ??
                payload.applicantCompany
        )
        const caseName = normalizeText(payload.caseName ?? payload.case_name ?? payload.projectName ?? payload.project_name)
        const appliedJob = normalizeText(payload.job ?? payload.position ?? payload.applicantJob)
        const appliedLocation = normalizeText(payload.location ?? payload.pref ?? payload.workLocation ?? payload.jobLocation)
        const email = normalizeEmail(payload.email)

        const messageId = normalizeText(payload.gmailMessageId ?? payload.messageId ?? payload.message_id)
        const threadId = normalizeText(payload.threadId ?? payload.gmailThreadId ?? payload.thread_id)

        const appliedAt = parseDate(payload.receivedAt ?? payload.appliedAt ?? payload.appliedDate ?? payload.createdAt)

        if (!name) {
            return NextResponse.json({ success: false, error: "name is required" }, { status: 400 })
        }

        if (!companyName) {
            return NextResponse.json({ success: false, error: "company is required" }, { status: 400 })
        }

        if (!appliedAt) {
            return NextResponse.json({ success: false, error: "appliedAt is required and must be a valid date" }, { status: 400 })
        }

        const company = await getOrCreateCompany(companyName)

        if (messageId) {
            const existed = await db
                .select({ id: schema.applicants.id })
                .from(schema.applicants)
                .where(eq(schema.applicants.sourceGmailMessageId, messageId))
                .get()

            if (existed) {
                await db
                    .update(schema.applicants)
                    .set({
                        companyId: company.id,
                        name,
                        caseName: caseName || null,
                        appliedAt,
                        appliedJob: appliedJob || null,
                        appliedLocation: appliedLocation || null,
                        email,
                        sourceGmailThreadId: threadId || null,
                        updatedAt: new Date(),
                    })
                    .where(eq(schema.applicants.id, existed.id))

                return NextResponse.json(
                    {
                        success: true,
                        status: "already_imported_updated",
                        applicantId: existed.id,
                    },
                    { status: 200 }
                )
            }
        }

        const applicantId = crypto.randomUUID()

        await db.insert(schema.applicants).values({
            id: applicantId,
            companyId: company.id,
            name,
            caseName: caseName || null,
            appliedAt,
            appliedJob: appliedJob || null,
            appliedLocation: appliedLocation || null,
            email,
            sourceGmailMessageId: messageId || null,
            sourceGmailThreadId: threadId || null,
        })

        return NextResponse.json(
            {
                success: true,
                status: "created",
                applicantId,
                companyId: company.id,
                companyName,
            },
            { status: 201 }
        )
    } catch (error) {
        console.error("inbound/indeed POST failed", error)
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        )
    }
}

function normalizeText(value: unknown): string {
    if (typeof value !== "string") return ""
    return value.trim()
}

function normalizeEmail(value: unknown): string | null {
    if (typeof value !== "string") return null

    const raw = value.trim().toLowerCase()
    if (!raw) return null

    return raw
}

function parseDate(value: unknown): Date | null {
    if (!value) return null

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) return null

        // 秒 or ミリ秒どちらでも受ける
        const base = value > 1_000_000_000_000 ? value : value * 1000
        const d = new Date(base)
        return Number.isNaN(d.getTime()) ? null : d
    }

    if (typeof value === "string") {
        const trimmed = value.trim()
        if (!trimmed) return null

        const d = new Date(trimmed)
        if (!Number.isNaN(d.getTime())) return d

        const asNumber = Number(trimmed)
        if (Number.isFinite(asNumber)) {
            const fallback = new Date(asNumber > 1_000_000_000_000 ? asNumber : asNumber * 1000)
            return Number.isNaN(fallback.getTime()) ? null : fallback
        }
    }

    return null
}

async function getOrCreateCompany(name: string) {
    const normalized = normalizeCompanyName(name)

    // Phase 1a: company.name 完全一致
    const byExactName = await db
        .select({ id: schema.companies.id, name: schema.companies.name })
        .from(schema.companies)
        .where(eq(schema.companies.name, normalized))
        .get()

    if (byExactName) {
        return byExactName
    }

    // Phase 1b: company_alias.alias 完全一致
    const byAlias = await db
        .select({ id: schema.companies.id, name: schema.companies.name })
        .from(schema.companyAliases)
        .innerJoin(schema.companies, eq(schema.companyAliases.companyId, schema.companies.id))
        .where(eq(schema.companyAliases.alias, normalized))
        .get()

    if (byAlias) {
        return byAlias
    }

    // Phase 2: 正規化マッチング（法人格除去・全角半角統一等でファジーマッチ）
    const normalizedForMatch = normalizeCompanyNameForMatch(normalized)
    if (normalizedForMatch.length >= 2) {
        const allCompanies = await db
            .select({ id: schema.companies.id, name: schema.companies.name })
            .from(schema.companies)
            .all()

        const fuzzyMatch = allCompanies.find(
            (c) => normalizeCompanyNameForMatch(c.name) === normalizedForMatch,
        )

        if (fuzzyMatch) {
            // Phase 3: エイリアス自動登録（次回以降 Phase 1b で即ヒット）
            await registerAliasIfNotExists(fuzzyMatch.id, normalized)
            return fuzzyMatch
        }
    }

    // 新規企業作成
    const id = crypto.randomUUID()
    try {
        const inserted = await db.insert(schema.companies).values({ id, name: normalized }).returning()

        if (!inserted.length) {
            const retry = await db
                .select({ id: schema.companies.id, name: schema.companies.name })
                .from(schema.companies)
                .where(eq(schema.companies.id, id))
                .get()

            if (retry) return retry
            throw new Error("failed to create company")
        }

        return inserted[0]
    } catch (error) {
        if (!isCompanyNameUniqueConstraintError(error)) {
            throw error
        }

        const existing = await db
            .select({ id: schema.companies.id, name: schema.companies.name })
            .from(schema.companies)
            .where(eq(schema.companies.name, normalized))
            .get()

        if (existing) return existing
        throw new Error("failed to create company")
    }
}

async function registerAliasIfNotExists(companyId: string, alias: string) {
    try {
        await db.insert(schema.companyAliases).values({
            id: crypto.randomUUID(),
            companyId,
            alias,
        })
    } catch (error) {
        // UNIQUE制約違反は無視（既に登録済み）
        const msg = error instanceof Error ? error.message : String(error)
        if (!msg.includes("UNIQUE constraint failed")) {
            console.error("Failed to register company alias", { companyId, alias, error: msg })
        }
    }
}
