import { NextRequest, NextResponse } from "next/server"

import { db, schema } from "@/db"
import { getRuntimeEnv } from "@/lib/runtime-env"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"

const API_KEY_HEADER = "x-rpo-api-key"

type UpdateEntry = {
    id: string
    gid: number
}

export async function POST(request: NextRequest) {
    try {
        const configuredApiKey = getRuntimeEnv("RPO_API_KEY") || getRuntimeEnv("INBOUND_API_KEY")
        const providedApiKey = request.headers.get(API_KEY_HEADER)?.trim()
        if (!configuredApiKey || !providedApiKey || providedApiKey !== configuredApiKey) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        const body = await request.json() as { updates?: UpdateEntry[] }
        const updates = body.updates
        if (!Array.isArray(updates) || updates.length === 0) {
            return NextResponse.json({ success: false, error: "updates array is required" }, { status: 400 })
        }

        const results: Array<{ id: string; gid: number; status: string }> = []

        for (const entry of updates) {
            if (!entry.id || typeof entry.gid !== "number") {
                results.push({ id: entry.id || "unknown", gid: entry.gid, status: "invalid" })
                continue
            }

            try {
                await db
                    .update(schema.companySheets)
                    .set({ gid: entry.gid })
                    .where(eq(schema.companySheets.id, entry.id))
                results.push({ id: entry.id, gid: entry.gid, status: "updated" })
            } catch (error) {
                results.push({ id: entry.id, gid: entry.gid, status: "error" })
            }
        }

        return NextResponse.json({
            success: true,
            updated: results.filter(r => r.status === "updated").length,
            results,
        })
    } catch (error) {
        console.error("update-sheet-gids failed", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Internal Server Error" },
            { status: 500 }
        )
    }
}
