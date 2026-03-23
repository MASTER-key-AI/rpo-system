import { NextRequest, NextResponse } from "next/server"

import { db, schema } from "@/db"
import { getRuntimeEnv } from "@/lib/runtime-env"
import { eq, isNotNull } from "drizzle-orm"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
    const configuredApiKey = getRuntimeEnv("RPO_API_KEY") || getRuntimeEnv("INBOUND_API_KEY")
    const providedApiKey = request.headers.get("x-rpo-api-key")?.trim()
    if (!configuredApiKey || !providedApiKey || providedApiKey !== configuredApiKey) {
        return NextResponse.json(
            { success: false, error: "Unauthorized" },
            { status: 401 }
        )
    }
    try {
        const applicants = await db
            .select({
                id: schema.applicants.id,
                birthDate: schema.applicants.birthDate,
                age: schema.applicants.age,
            })
            .from(schema.applicants)
            .where(isNotNull(schema.applicants.birthDate))
            .all()

        let updated = 0
        const now = new Date()

        for (const applicant of applicants) {
            if (!applicant.birthDate) continue

            const birth = new Date(applicant.birthDate)
            if (Number.isNaN(birth.getTime())) continue

            let age = now.getFullYear() - birth.getFullYear()
            const monthDiff = now.getMonth() - birth.getMonth()
            const dayDiff = now.getDate() - birth.getDate()
            if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
                age -= 1
            }

            if (age >= 0 && age !== applicant.age) {
                await db
                    .update(schema.applicants)
                    .set({ age })
                    .where(eq(schema.applicants.id, applicant.id))
                updated++
            }
        }

        return NextResponse.json({
            success: true,
            processed: applicants.length,
            updated,
        })
    } catch (error) {
        console.error("cron/update-ages failed", error instanceof Error ? error.stack || error.message : String(error))
        return NextResponse.json(
            { success: false, error: "Internal Server Error" },
            { status: 500 }
        )
    }
}
