import { NextRequest, NextResponse } from "next/server"

import { db, schema } from "@/db"
import { eq } from "drizzle-orm"
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
            .where(eq(schema.companySheets.enabled, true))
            .all()

        const sheets = rows
            .map((row) => ({
                id: row.id,
                companyId: row.companyId,
                companyName: row.companyName || "",
                spreadsheetId: row.spreadsheetId,
                gid: row.gid ?? 0,
                sheetName: row.sheetName || "",
            }))
            .sort((a, b) => a.companyName.localeCompare(b.companyName, "ja"))

        return NextResponse.json(
            {
                success: true,
                data: { sheets, total: sheets.length },
            },
            { status: 200 }
        )
    } catch (error) {
        console.error("sync/company-sheets failed", error instanceof Error ? (error.stack || error.message) : String(error))
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
