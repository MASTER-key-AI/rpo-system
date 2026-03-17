"use server";

import { db, schema } from "@/db";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type CompanyGroupRow = {
    id: string
    name: string
    memberCount: number
}

export type CompanyGroupWithMembers = {
    id: string
    name: string
    memberCompanyIds: string[]
}

export type GroupMember = {
    id: string
    name: string
    applicantCount: number
}

export async function getCompanyGroups(): Promise<CompanyGroupRow[]> {
    const rows = await db
        .select({
            id: schema.companyGroups.id,
            name: schema.companyGroups.name,
            memberCount: sql<number>`count(${schema.companies.id})`,
        })
        .from(schema.companyGroups)
        .leftJoin(schema.companies, eq(schema.companies.groupId, schema.companyGroups.id))
        .groupBy(schema.companyGroups.id, schema.companyGroups.name)
        .orderBy(schema.companyGroups.name)
        .all()

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        memberCount: Number(row.memberCount || 0),
    }))
}

export async function getCompanyGroupsWithMembers(): Promise<CompanyGroupWithMembers[]> {
    const groups = await db
        .select({
            id: schema.companyGroups.id,
            name: schema.companyGroups.name,
        })
        .from(schema.companyGroups)
        .orderBy(schema.companyGroups.name)
        .all()

    const members = await db
        .select({
            companyId: schema.companies.id,
            groupId: schema.companies.groupId,
        })
        .from(schema.companies)
        .where(sql`${schema.companies.groupId} IS NOT NULL`)
        .all()

    const memberMap = new Map<string, string[]>()
    for (const m of members) {
        if (!m.groupId) continue
        const list = memberMap.get(m.groupId) || []
        list.push(m.companyId)
        memberMap.set(m.groupId, list)
    }

    return groups.map((g) => ({
        id: g.id,
        name: g.name,
        memberCompanyIds: memberMap.get(g.id) || [],
    }))
}

export async function createCompanyGroup(name: string): Promise<{ id: string }> {
    const trimmed = name.trim()
    if (!trimmed) {
        throw new Error("グループ名を入力してください。")
    }

    const existing = await db
        .select({ id: schema.companyGroups.id })
        .from(schema.companyGroups)
        .where(eq(schema.companyGroups.name, trimmed))
        .get()

    if (existing) {
        throw new Error("同名のグループが既に存在します。")
    }

    const id = crypto.randomUUID()
    await db.insert(schema.companyGroups).values({ id, name: trimmed })
    revalidatePath("/companies")
    return { id }
}

export async function deleteCompanyGroup(groupId: string): Promise<void> {
    const trimmed = groupId.trim()
    if (!trimmed) {
        throw new Error("グループIDが不正です。")
    }

    // ON DELETE SET NULL により、メンバー企業の group_id は自動的に null になる
    await db.delete(schema.companyGroups).where(eq(schema.companyGroups.id, trimmed))
    revalidatePath("/companies")
}

export async function addCompanyToGroup(companyId: string, groupId: string): Promise<void> {
    await db
        .update(schema.companies)
        .set({ groupId })
        .where(eq(schema.companies.id, companyId))
    revalidatePath("/companies")
}

export async function removeCompanyFromGroup(companyId: string): Promise<void> {
    await db
        .update(schema.companies)
        .set({ groupId: null })
        .where(eq(schema.companies.id, companyId))
    revalidatePath("/companies")
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const rows = await db
        .select({
            id: schema.companies.id,
            name: schema.companies.name,
            applicantCount: sql<number>`count(${schema.applicants.id})`,
        })
        .from(schema.companies)
        .leftJoin(schema.applicants, eq(schema.applicants.companyId, schema.companies.id))
        .where(eq(schema.companies.groupId, groupId))
        .groupBy(schema.companies.id, schema.companies.name)
        .orderBy(schema.companies.name)
        .all()

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        applicantCount: Number(row.applicantCount || 0),
    }))
}

export async function getGroupById(groupId: string) {
    return db
        .select({
            id: schema.companyGroups.id,
            name: schema.companyGroups.name,
        })
        .from(schema.companyGroups)
        .where(eq(schema.companyGroups.id, groupId))
        .get()
}
