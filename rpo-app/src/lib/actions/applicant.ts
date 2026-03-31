"use server";

import { auth } from "@/auth";
import { db, schema } from "@/db";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { normalizeCompanyName, normalizeCompanyNameForMatch, isCompanyNameUniqueConstraintError } from "@/lib/company-name";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getApplicant(id: string) {
    const applicantId = id?.trim()
    if (!applicantId) {
        return null
    }

    const applicant = await db.select().from(schema.applicants).where(eq(schema.applicants.id, applicantId)).get();
    if (!applicant) return null;
    const [company, interviews, callLogs] = await Promise.all([
        db.select({ id: schema.companies.id, name: schema.companies.name }).from(schema.companies).where(eq(schema.companies.id, applicant.companyId)).get(),
        db.select().from(schema.interviews).where(eq(schema.interviews.applicantId, applicantId)).all(),
        db
            .select({
                id: schema.callLogs.id,
                calledAt: schema.callLogs.calledAt,
                callerId: schema.callLogs.callerId,
                callerName: schema.users.name,
                callCount: schema.callLogs.callCount,
                isConnected: schema.callLogs.isConnected,
                note: schema.callLogs.note,
            })
            .from(schema.callLogs)
            .leftJoin(schema.users, eq(schema.callLogs.callerId, schema.users.id))
            .where(eq(schema.callLogs.applicantId, applicantId))
            .all(),
    ]);

    const callLogsWithUser = callLogs.map((log) => ({
        ...log,
        callerName: log.callerName || "Unknown",
    }));

    return { ...applicant, company, interviews, callLogs: callLogsWithUser };
}

export async function updateApplicant(id: string, data: Partial<typeof schema.applicants.$inferInsert>) {
    await db.update(schema.applicants).set({ ...data, updatedAt: new Date() }).where(eq(schema.applicants.id, id));
    revalidatePath(`/applicants/${id}`);
    revalidatePath("/applicants");
    revalidatePath("/companies");
    return { success: true };
}

export async function addInterview(data: Omit<typeof schema.interviews.$inferInsert, "id">) {
    const id = crypto.randomUUID();
    await db.insert(schema.interviews).values({ ...data, id, interviewDate: new Date(data.interviewDate) });
    revalidatePath(`/applicants/${data.applicantId}`);
    return { success: true };
}

export type CallLogApplicantOption = {
    id: string
    name: string
    companyName: string
}

type AddCallLogInput = {
    applicantId: string;
    isConnected: boolean;
    note: string | null;
    calledAt?: Date | number | string;
};

// 認証撤廃中の暫定実行ユーザー。環境変数があればそちらを優先する。
const DEFAULT_ACTOR_ID = "local-dev-user";
const DEFAULT_ACTOR_NAME = "ローカルユーザー";
const DEFAULT_ACTOR_EMAIL = "local-dev-user@rpo.invalid";

async function resolveCallerUserId() {
    const session = await auth();
    const sessionUserId = session?.user?.id?.trim();
    const sessionUserName = session?.user?.name?.trim();
    const sessionUserEmail = session?.user?.email?.trim().toLowerCase();

    const callerId = sessionUserId || getRuntimeEnv("DEV_ACTOR_ID")?.trim() || DEFAULT_ACTOR_ID;
    const callerName = sessionUserName || getRuntimeEnv("DEV_ACTOR_NAME")?.trim() || DEFAULT_ACTOR_NAME;
    const callerEmail = sessionUserEmail || getRuntimeEnv("DEV_ACTOR_EMAIL")?.trim() || DEFAULT_ACTOR_EMAIL;

    const userById = await db
        .select({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
        })
        .from(schema.users)
        .where(eq(schema.users.id, callerId))
        .get();
    if (userById) {
        if (userById.name !== callerName || userById.email !== callerEmail) {
            await db
                .update(schema.users)
                .set({ name: callerName, email: callerEmail })
                .where(eq(schema.users.id, callerId));
        }

        return callerId;
    }

    const userByEmail = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, callerEmail))
        .get();
    if (userByEmail) {
        await db
            .update(schema.users)
            .set({ name: callerName, email: callerEmail })
            .where(eq(schema.users.id, userByEmail.id));
        return userByEmail.id;
    }

    await db.insert(schema.users).values({
        id: callerId,
        name: callerName,
        email: callerEmail,
        emailVerified: new Date(),
        image: null,
    });

    return callerId;
}

export async function searchApplicantsForCallLog(keyword: string): Promise<CallLogApplicantOption[]> {
    const query = keyword?.trim()

    if (!query) {
        return []
    }

    const pattern = `%${query}%`
    const rows = await db
        .select({
            id: schema.applicants.id,
            name: schema.applicants.name,
            companyName: schema.companies.name,
        })
        .from(schema.applicants)
        .leftJoin(schema.companies, eq(schema.applicants.companyId, schema.companies.id))
        .where(
            or(
                like(schema.applicants.name, pattern),
                like(schema.companies.name, pattern)
            )
        )
        .orderBy(asc(schema.applicants.name))
        .limit(20)
        .all()

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        companyName: row.companyName || "Unknown"
    }))
}

export async function addCallLog(data: AddCallLogInput) {
    const id = crypto.randomUUID();
    const callerId = await resolveCallerUserId();
    const calledAt = data.calledAt ? new Date(data.calledAt) : new Date();
    if (Number.isNaN(calledAt.getTime())) {
        throw new Error("架電日時が不正です。")
    }
    const latest = await db
        .select({ callCount: sql<number>`coalesce(max(${schema.callLogs.callCount}), 0)` })
        .from(schema.callLogs)
        .where(eq(schema.callLogs.applicantId, data.applicantId))
        .get();

    const nextCallCount = ((latest?.callCount) || 0) + 1;

    await db.insert(schema.callLogs).values({
        ...data,
        id,
        callCount: nextCallCount,
        callerId,
        calledAt,
    });
    if (data.isConnected) {
        await synchronizeApplicantConnectedAt(data.applicantId)
    }
    revalidatePath(`/applicants/${data.applicantId}`);
    revalidatePath(`/calls`);
    return { success: true };
}

export async function updateCallLogCalledAt(callLogId: string, calledAt: string) {
    const targetId = callLogId?.trim();
    if (!targetId) {
        throw new Error("架電ログIDが不正です。");
    }

    const newDate = new Date(calledAt);
    if (Number.isNaN(newDate.getTime())) {
        throw new Error("架電日時が不正です。");
    }

    const target = await db
        .select({ applicantId: schema.callLogs.applicantId })
        .from(schema.callLogs)
        .where(eq(schema.callLogs.id, targetId))
        .get();

    if (!target) {
        throw new Error("対象の架電ログが見つかりません。");
    }

    await db
        .update(schema.callLogs)
        .set({ calledAt: newDate })
        .where(eq(schema.callLogs.id, targetId));

    revalidatePath(`/applicants/${target.applicantId}`);
    revalidatePath("/calls");
    return { success: true };
}

export async function deleteCallLog(callLogId: string) {
    const targetId = callLogId?.trim();
    if (!targetId) {
        throw new Error("削除対象の架電ログIDが不正です。");
    }

    const target = await db
        .select({
            applicantId: schema.callLogs.applicantId,
            isConnected: schema.callLogs.isConnected,
        })
        .from(schema.callLogs)
        .where(eq(schema.callLogs.id, targetId))
        .get();

    if (!target) {
        throw new Error("対象の架電ログが見つかりませんでした。");
    }

    await db.delete(schema.callLogs).where(eq(schema.callLogs.id, targetId));
    if (target.isConnected) {
        await synchronizeApplicantConnectedAt(target.applicantId)
    }
    revalidatePath(`/applicants/${target.applicantId}`);
    revalidatePath("/calls");
    return { success: true };
}

async function synchronizeApplicantConnectedAt(applicantId: string) {
    const latestConnectedCall = await db
        .select({ calledAt: schema.callLogs.calledAt })
        .from(schema.callLogs)
        .where(
            and(
                eq(schema.callLogs.applicantId, applicantId),
                eq(schema.callLogs.isConnected, true),
            )
        )
        .orderBy(desc(schema.callLogs.calledAt))
        .get();

    await db
        .update(schema.applicants)
        .set({
            connectedAt: latestConnectedCall?.calledAt || null,
            updatedAt: new Date(),
        })
        .where(eq(schema.applicants.id, applicantId));
}

export async function deleteApplicant(applicantId: string) {
    const targetId = applicantId?.trim();
    if (!targetId) {
        throw new Error("削除対象の応募者IDが不正です。");
    }

    const target = await db
        .select({ id: schema.applicants.id })
        .from(schema.applicants)
        .where(eq(schema.applicants.id, targetId))
        .get();

    if (!target) {
        throw new Error("対象の応募者が見つかりません。");
    }

    await db.delete(schema.callLogs).where(eq(schema.callLogs.applicantId, targetId));
    await db.delete(schema.interviews).where(eq(schema.interviews.applicantId, targetId));
    await db.delete(schema.applicants).where(eq(schema.applicants.id, targetId));

    revalidatePath(`/applicants/${targetId}`);
    revalidatePath("/applicants");
    revalidatePath("/companies");
    revalidatePath("/calls");
    return { success: true };
}

export type CreateApplicantInput = {
    name: string;
    furigana?: string;
    companyName: string;
    appliedAt: string; // ISO date string
    caseName?: string;
    appliedJob?: string;
    appliedLocation?: string;
    email?: string;
    phone?: string;
    gender?: string;
};

export async function createApplicant(input: CreateApplicantInput) {
    const name = input.name?.trim();
    if (!name) throw new Error("氏名は必須です。");

    const rawCompanyName = input.companyName?.trim();
    if (!rawCompanyName) throw new Error("会社名は必須です。");

    const appliedAt = new Date(input.appliedAt);
    if (Number.isNaN(appliedAt.getTime())) throw new Error("応募日が不正です。");

    // 会社名の正規化・マッチング（inbound/indeedと同じロジック）
    const normalized = normalizeCompanyName(rawCompanyName);
    let company = await db
        .select({ id: schema.companies.id, name: schema.companies.name })
        .from(schema.companies)
        .where(eq(schema.companies.name, normalized))
        .get();

    if (!company) {
        const byAlias = await db
            .select({ id: schema.companies.id, name: schema.companies.name })
            .from(schema.companyAliases)
            .innerJoin(schema.companies, eq(schema.companyAliases.companyId, schema.companies.id))
            .where(eq(schema.companyAliases.alias, normalized))
            .get();
        company = byAlias ?? undefined;
    }

    if (!company) {
        const normalizedForMatch = normalizeCompanyNameForMatch(normalized);
        if (normalizedForMatch.length >= 2) {
            const allCompanies = await db
                .select({ id: schema.companies.id, name: schema.companies.name })
                .from(schema.companies)
                .all();
            const fuzzy = allCompanies.find(
                (c) => normalizeCompanyNameForMatch(c.name) === normalizedForMatch
            );
            if (fuzzy) {
                company = fuzzy;
            }
        }
    }

    if (!company) {
        const newId = crypto.randomUUID();
        try {
            const inserted = await db
                .insert(schema.companies)
                .values({ id: newId, name: normalized })
                .returning();
            company = inserted[0];
        } catch (error) {
            if (!isCompanyNameUniqueConstraintError(error)) throw error;
            const existing = await db
                .select({ id: schema.companies.id, name: schema.companies.name })
                .from(schema.companies)
                .where(eq(schema.companies.name, normalized))
                .get();
            if (!existing) throw new Error("会社の作成に失敗しました。");
            company = existing;
        }
    }

    const applicantId = crypto.randomUUID();
    await db.insert(schema.applicants).values({
        id: applicantId,
        companyId: company.id,
        name,
        furigana: input.furigana?.trim() || null,
        appliedAt,
        caseName: input.caseName?.trim() || null,
        appliedJob: input.appliedJob?.trim() || null,
        appliedLocation: input.appliedLocation?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        phone: input.phone?.trim() || null,
        gender: input.gender?.trim() || null,
    });

    revalidatePath("/applicants");
    revalidatePath("/companies");
    return { success: true, applicantId, companyId: company.id };
}
