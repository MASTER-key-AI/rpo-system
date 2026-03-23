import { NextRequest, NextResponse } from "next/server"

import { db, schema } from "@/db"
import { getRuntimeEnv } from "@/lib/runtime-env"

const API_KEY_HEADER = "x-rpo-api-key"
const API_KEY_ENV_NAME = "RPO_API_KEY"
const API_KEY_ENV_NAME_LEGACY = "INBOUND_API_KEY"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
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

        const rows = await db
            .select({
                id: schema.companies.id,
                name: schema.companies.name,
            })
            .from(schema.companies)
            .all()

        const companies = rows
            .map((row) => ({ id: row.id, name: row.name }))
            .sort((a, b) => a.name.localeCompare(b.name, "ja"))

        return NextResponse.json(
            {
                success: true,
                data: { companies, total: companies.length },
            },
            { status: 200 }
        )
    } catch (error) {
        console.error("sync/companies failed", error instanceof Error ? (error.stack || error.message) : String(error))
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        )
    }
}

export async function POST() {
    return NextResponse.json(
        { success: false, error: "Method Not Allowed. Use GET." },
        { status: 405 }
    )
}
