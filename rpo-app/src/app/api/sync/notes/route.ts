import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

import { db, schema } from "@/db"
import { getRuntimeEnv } from "@/lib/runtime-env"

const API_KEY_HEADER = "x-rpo-api-key"
const API_KEY_ENV_NAME = "RPO_API_KEY"
const API_KEY_ENV_NAME_LEGACY = "INBOUND_API_KEY"

export const runtime = "nodejs"

type SyncNotesRequestPayload = {
    applicantId?: unknown
    notes?: unknown
}

type ParseBodyResult = { ok: true; value: SyncNotesRequestPayload } | { ok: false; error: string }

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

        const providedApiKey = request.headers.get(API_KEY_HEADER)
        if (!providedApiKey || providedApiKey !== configuredApiKey) {
            return NextResponse.json(
                { success: false, error: "Unauthorized" },
                { status: 401 }
            )
        }

        const parsed = await parseBody(request)
        if (!parsed.ok) {
            return NextResponse.json(
                { success: false, error: parsed.error },
                { status: 400 }
            )
        }

        const { applicantId, notes } = parsed.value

        if (!applicantId || typeof applicantId !== "string") {
            return NextResponse.json(
                { success: false, error: "applicantId is required and must be a string" },
                { status: 400 }
            )
        }

        const notesValue = typeof notes === "string" ? notes.trim() : ""

        const existing = await db
            .select({ id: schema.applicants.id })
            .from(schema.applicants)
            .where(eq(schema.applicants.id, applicantId))
            .get()

        if (!existing) {
            return NextResponse.json(
                { success: false, error: `Applicant not found: ${applicantId}` },
                { status: 404 }
            )
        }

        await db.update(schema.applicants)
            .set({ 
                notes: notesValue,
                updatedAt: new Date(),
            })
            .where(eq(schema.applicants.id, applicantId))

        return NextResponse.json({
            success: true,
            data: {
                applicantId,
                notes: notesValue,
                updatedAt: new Date().toISOString(),
            }
        })

    } catch (error) {
        console.error("[Notes Sync API] Error processing request:", error)
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        )
    }
}

async function parseBody(request: NextRequest): Promise<ParseBodyResult> {
    try {
        const text = await request.text()
        if (!text) {
            return { ok: false, error: "Empty request body" }
        }

        try {
            const json = JSON.parse(text)
            if (typeof json !== "object" || json === null) {
                return { ok: false, error: "Request body must be a JSON object" }
            }
            return { ok: true, value: json as SyncNotesRequestPayload }
        } catch {
            return { ok: false, error: "Invalid JSON body" }
        }
    } catch (e: any) {
        return { ok: false, error: e.message || "Failed to read request body" }
    }
}
