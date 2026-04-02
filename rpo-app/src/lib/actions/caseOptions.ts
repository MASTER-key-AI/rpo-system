"use server"

import { db, schema } from "@/db"
import { asc, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getAllCompanyCaseOptions(): Promise<
    Record<string, { id: string; caseName: string; displayOrder: number }[]>
> {
    const rows = await db
        .select({
            id: schema.companyCaseOptions.id,
            companyId: schema.companyCaseOptions.companyId,
            caseName: schema.companyCaseOptions.caseName,
            displayOrder: schema.companyCaseOptions.displayOrder,
        })
        .from(schema.companyCaseOptions)
        .orderBy(
            asc(schema.companyCaseOptions.companyId),
            asc(schema.companyCaseOptions.displayOrder),
            asc(schema.companyCaseOptions.caseName)
        )

    const result: Record<string, { id: string; caseName: string; displayOrder: number }[]> = {}
    for (const row of rows) {
        if (!result[row.companyId]) result[row.companyId] = []
        result[row.companyId].push({ id: row.id, caseName: row.caseName, displayOrder: row.displayOrder })
    }
    return result
}

export async function getCompanyCaseOptions(
    companyId: string
): Promise<{ id: string; caseName: string; displayOrder: number }[]> {
    return db
        .select({
            id: schema.companyCaseOptions.id,
            caseName: schema.companyCaseOptions.caseName,
            displayOrder: schema.companyCaseOptions.displayOrder,
        })
        .from(schema.companyCaseOptions)
        .where(eq(schema.companyCaseOptions.companyId, companyId))
        .orderBy(asc(schema.companyCaseOptions.displayOrder), asc(schema.companyCaseOptions.caseName))
}

export async function addCompanyCaseOption(companyId: string, caseName: string): Promise<void> {
    const trimmed = caseName.trim()
    if (!trimmed) throw new Error("職種名を入力してください")

    // compute next display_order
    const existing = await db
        .select({ displayOrder: schema.companyCaseOptions.displayOrder })
        .from(schema.companyCaseOptions)
        .where(eq(schema.companyCaseOptions.companyId, companyId))
        .orderBy(asc(schema.companyCaseOptions.displayOrder))

    const maxOrder = existing.length > 0 ? Math.max(...existing.map((r) => r.displayOrder)) : -1

    await db.insert(schema.companyCaseOptions).values({
        id: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
        companyId,
        caseName: trimmed,
        displayOrder: maxOrder + 1,
    })

    revalidatePath("/job-types")
    revalidatePath("/applicants")
}

export async function deleteCompanyCaseOption(id: string): Promise<void> {
    await db.delete(schema.companyCaseOptions).where(eq(schema.companyCaseOptions.id, id))
    revalidatePath("/job-types")
    revalidatePath("/applicants")
}

export async function reorderCompanyCaseOption(id: string, direction: "up" | "down"): Promise<void> {
    const option = await db
        .select()
        .from(schema.companyCaseOptions)
        .where(eq(schema.companyCaseOptions.id, id))
        .then((r) => r[0])
    if (!option) return

    const siblings = await db
        .select()
        .from(schema.companyCaseOptions)
        .where(eq(schema.companyCaseOptions.companyId, option.companyId))
        .orderBy(asc(schema.companyCaseOptions.displayOrder))

    const idx = siblings.findIndex((s) => s.id === id)
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= siblings.length) return

    const swapTarget = siblings[swapIdx]
    await db
        .update(schema.companyCaseOptions)
        .set({ displayOrder: swapTarget.displayOrder })
        .where(eq(schema.companyCaseOptions.id, id))
    await db
        .update(schema.companyCaseOptions)
        .set({ displayOrder: option.displayOrder })
        .where(eq(schema.companyCaseOptions.id, swapTarget.id))

    revalidatePath("/job-types")
}
