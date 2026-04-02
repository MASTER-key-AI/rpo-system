"use server"

import { db, schema } from "@/db"
import { eq, isNull } from "drizzle-orm"
import { getCaseTargetMetrics, type CaseTargetMetrics } from "./yields"
import { revalidatePath } from "next/cache"

// ====================================================================
// 型定義
// ====================================================================

export type CompanyStatus = "good" | "alert" | "no_data"

export type WeeklyCriteria = {
    id: string
    companyId: string | null
    weekNum: 1 | 2 | 3 | 4   // フェーズ番号として使用（1〜4 = Phase1〜4）
    condition1Metric: string
    condition1Value: number
    condition2Metric: string | null
    condition2Value: number
    logic: "OR" | "AND"
}

export type CaseTarget = {
    id: string
    companyId: string
    companyName: string
    caseName: string
    startDate: string
    endDate: string
    targetHires: number
}

export type PeriodPace = {
    totalDays: number
    elapsedDays: number
    elapsedPercent: number
    currentHires: number
    targetHires: number
    hirePercent: number
    onPace: boolean
    projected: number
}

export type CompanyAssessment = {
    // 識別
    companyId: string
    companyName: string
    caseName: string | null        // null = 支援期間未設定
    supportStatus: string
    // 判定
    status: CompanyStatus
    reason: string
    phaseNumber: 1 | 2 | 3 | 4 | null  // null = 支援期間未設定
    elapsedPercent: number | null        // null = 未設定
    // 目標・ペース
    targetHires: number
    periodPace?: PeriodPace
    // メトリクス
    metrics: {
        totalApplicants: number
        validApplicants: number
        interviewScheduledCount: number
        interviewConductedCount: number
        offered: number
        joined: number
        connectedApplicantCount: number
    }
}

export type AnalysisSummary = {
    good: CompanyAssessment[]
    alert: CompanyAssessment[]
    noData: CompanyAssessment[]  // データなし + 支援期間未設定
    defaultCriteria: WeeklyCriteria[]
}

export type StaffSummary = {
    name: string
    totalApp: number
    totalOffer: number
    totalJoined: number
    companies: string[]
}

// ====================================================================
// フェーズ・ペース計算
// ====================================================================

function getPhaseNumber(startDate: string, endDate: string, today: Date): 1 | 2 | 3 | 4 {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalMs = Math.max(1, end.getTime() - start.getTime())
    const elapsedMs = Math.max(0, today.getTime() - start.getTime())
    const pct = Math.min(1, elapsedMs / totalMs)

    if (pct < 0.25) return 1
    if (pct < 0.5) return 2
    if (pct < 0.75) return 3
    return 4
}

function getElapsedPercent(startDate: string, endDate: string, today: Date): number {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const totalMs = Math.max(1, end.getTime() - start.getTime())
    const elapsedMs = Math.max(0, today.getTime() - start.getTime())
    return Math.min(1, elapsedMs / totalMs)
}

function calculatePeriodPace(
    startDate: string,
    endDate: string,
    targetHires: number,
    currentHires: number
): PeriodPace {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const today = new Date()
    const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))))
    const elapsedPercent = elapsedDays / totalDays
    const hirePercent = targetHires > 0 ? currentHires / targetHires : 0
    const projected = elapsedDays > 0 ? Math.round((currentHires / elapsedDays) * totalDays * 10) / 10 : 0
    return { totalDays, elapsedDays, elapsedPercent, currentHires, targetHires, hirePercent, onPace: hirePercent >= elapsedPercent, projected }
}

// ====================================================================
// 判定ロジック
// ====================================================================

const METRIC_MAP: Record<string, keyof CaseTargetMetrics> = {
    "有効応募": "validApplicants",
    "面接設定": "interviewScheduledCount",
    "面接実施": "interviewConductedCount",
    "内定": "offered",
    "入社": "joined",
    "応募": "totalApplicants",
    "通電": "connectedApplicantCount",
}

function scaleThreshold(base: number, targetHires: number): number {
    return Math.max(1, Math.round(base * targetHires))
}

function evaluateCriteria(metrics: CaseTargetMetrics, criteria: WeeklyCriteria, targetHires: number): boolean {
    const key1 = METRIC_MAP[criteria.condition1Metric]
    if (!key1) return false
    const threshold1 = scaleThreshold(criteria.condition1Value, targetHires)
    const met1 = (metrics[key1] as number) >= threshold1

    if (!criteria.condition2Metric) return met1

    const key2 = METRIC_MAP[criteria.condition2Metric]
    if (!key2) return met1
    const threshold2 = scaleThreshold(criteria.condition2Value, targetHires)
    const met2 = (metrics[key2] as number) >= threshold2

    return criteria.logic === "OR" ? (met1 || met2) : (met1 && met2)
}

function formatCriteriaReason(
    metrics: CaseTargetMetrics,
    criteria: WeeklyCriteria,
    targetHires: number
): string {
    const key1 = METRIC_MAP[criteria.condition1Metric]
    const val1 = key1 ? (metrics[key1] as number) : 0
    const thresh1 = scaleThreshold(criteria.condition1Value, targetHires)

    if (!criteria.condition2Metric) {
        return `${criteria.condition1Metric}${val1}件（基準: ${thresh1}件以上）`
    }

    const key2 = METRIC_MAP[criteria.condition2Metric]
    const val2 = key2 ? (metrics[key2] as number) : 0
    const thresh2 = scaleThreshold(criteria.condition2Value, targetHires)
    const logic = criteria.logic === "OR" ? "または" : "かつ"
    return `${criteria.condition1Metric}${val1}件 ${logic} ${criteria.condition2Metric}${val2}件（基準: ${thresh1}件/${thresh2}件）`
}

function assessCaseTarget(
    metrics: CaseTargetMetrics,
    phaseNumber: 1 | 2 | 3 | 4,
    targetHires: number,
    criteria: WeeklyCriteria[]
): { status: CompanyStatus; reason: string } {
    if (metrics.totalApplicants === 0) {
        return { status: "no_data", reason: "応募データなし" }
    }

    const phaseCriteria = criteria.find((c) => c.weekNum === phaseNumber)
    if (!phaseCriteria) {
        return { status: "no_data", reason: "判定基準未設定" }
    }

    const passed = evaluateCriteria(metrics, phaseCriteria, targetHires)
    const reason = formatCriteriaReason(metrics, phaseCriteria, targetHires)
    return { status: passed ? "good" : "alert", reason }
}

// ====================================================================
// criteria 管理アクション
// ====================================================================

export async function getAnalysisCriteria(): Promise<WeeklyCriteria[]> {
    const rows = await db.select().from(schema.analysisCriteria)
    return rows.map((r) => ({
        id: r.id,
        companyId: r.companyId ?? null,
        weekNum: r.weekNum as 1 | 2 | 3 | 4,
        condition1Metric: r.condition1Metric,
        condition1Value: r.condition1Value,
        condition2Metric: r.condition2Metric ?? null,
        condition2Value: r.condition2Value ?? 0,
        logic: (r.logic ?? "OR") as "OR" | "AND",
    }))
}

export async function saveDefaultCriteria(criteriaList: Array<{
    weekNum: 1 | 2 | 3 | 4
    condition1Metric: string
    condition1Value: number
    condition2Metric: string | null
    condition2Value: number
    logic: "OR" | "AND"
}>): Promise<void> {
    await db.delete(schema.analysisCriteria).where(isNull(schema.analysisCriteria.companyId))
    for (const c of criteriaList) {
        await db.insert(schema.analysisCriteria).values({
            id: `default-w${c.weekNum}-${Date.now()}-${c.weekNum}`,
            companyId: null,
            weekNum: c.weekNum,
            condition1Metric: c.condition1Metric,
            condition1Value: c.condition1Value,
            condition2Metric: c.condition2Metric,
            condition2Value: c.condition2Value,
            logic: c.logic,
        })
    }
    revalidatePath("/analysis")
}

// ====================================================================
// 支援期間目標アクション
// ====================================================================

export async function getAllCaseTargets(): Promise<CaseTarget[]> {
    const rows = await db
        .select({
            id: schema.companyCaseTargets.id,
            companyId: schema.companyCaseTargets.companyId,
            companyName: schema.companies.name,
            caseName: schema.companyCaseTargets.caseName,
            startDate: schema.companyCaseTargets.startDate,
            endDate: schema.companyCaseTargets.endDate,
            targetHires: schema.companyCaseTargets.targetHires,
        })
        .from(schema.companyCaseTargets)
        .innerJoin(schema.companies, eq(schema.companyCaseTargets.companyId, schema.companies.id))
    return rows
}

export async function upsertCompanyCaseTarget(data: {
    id?: string
    companyId: string
    caseName: string
    startDate: string
    endDate: string
    targetHires: number
}): Promise<void> {
    if (data.id) {
        await db
            .update(schema.companyCaseTargets)
            .set({ caseName: data.caseName, startDate: data.startDate, endDate: data.endDate, targetHires: data.targetHires })
            .where(eq(schema.companyCaseTargets.id, data.id))
    } else {
        await db.insert(schema.companyCaseTargets).values({
            id: `ct-${data.companyId}-${Date.now()}`,
            companyId: data.companyId,
            caseName: data.caseName,
            startDate: data.startDate,
            endDate: data.endDate,
            targetHires: data.targetHires,
        })
    }
    revalidatePath("/analysis")
}

export async function deleteCompanyCaseTarget(id: string): Promise<void> {
    await db.delete(schema.companyCaseTargets).where(eq(schema.companyCaseTargets.id, id))
    revalidatePath("/analysis")
}

// ====================================================================
// 支援ステータス管理
// ====================================================================

export async function updateCompanySupportStatus(
    companyId: string,
    status: "支援中" | "支援終了"
): Promise<void> {
    await db.update(schema.companies).set({ supportStatus: status }).where(eq(schema.companies.id, companyId))
    revalidatePath("/analysis")
}

// ====================================================================
// 担当者別サマリー
// ====================================================================

export async function getStaffSummary(year?: number, month?: number): Promise<StaffSummary[]> {
    const now = new Date()
    const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const targetYear = year ?? jstNow.getUTCFullYear()
    const targetMonth = month ?? (jstNow.getUTCMonth() + 1)
    const startAt = Math.floor(Date.UTC(targetYear, targetMonth - 1, 1, 0, 0, 0) / 1000)
    const endAt = Math.floor(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0) / 1000)

    const { sql: sqlTag } = await import("drizzle-orm")

    const rows = await db
        .select({
            assigneeName: schema.applicants.assigneeName,
            companyName: schema.companies.name,
            totalApp: sqlTag<number>`count(*)`.as("totalApp"),
            totalOffer: sqlTag<number>`sum(case when ${schema.applicants.offered} = 1 then 1 else 0 end)`.as("totalOffer"),
            totalJoined: sqlTag<number>`sum(case when ${schema.applicants.joined} = 1 then 1 else 0 end)`.as("totalJoined"),
        })
        .from(schema.applicants)
        .innerJoin(schema.companies, eq(schema.applicants.companyId, schema.companies.id))
        .where(sqlTag`${schema.applicants.appliedAt} >= ${startAt} AND ${schema.applicants.appliedAt} < ${endAt}`)
        .groupBy(schema.applicants.assigneeName, schema.companies.name)

    const staffMap: Record<string, StaffSummary> = {}
    for (const row of rows) {
        const name = row.assigneeName || "未設定"
        if (!staffMap[name]) staffMap[name] = { name, totalApp: 0, totalOffer: 0, totalJoined: 0, companies: [] }
        staffMap[name].totalApp += Number(row.totalApp)
        staffMap[name].totalOffer += Number(row.totalOffer)
        staffMap[name].totalJoined += Number(row.totalJoined)
        if (!staffMap[name].companies.includes(row.companyName)) staffMap[name].companies.push(row.companyName)
    }
    return Object.values(staffMap).sort((a, b) => b.totalApp - a.totalApp)
}

// ====================================================================
// メイン分析サマリー（支援期間ベース）
// ====================================================================

export async function getAnalysisSummary(options?: { showAll?: boolean }): Promise<AnalysisSummary> {
    const today = new Date()
    const jstToday = new Date(today.getTime() + 9 * 60 * 60 * 1000)

    // 企業一覧（support_status 含む）
    const companiesData = await db.select({
        id: schema.companies.id,
        name: schema.companies.name,
        supportStatus: schema.companies.supportStatus,
    }).from(schema.companies)

    const companyStatusMap = new Map(companiesData.map((c) => [c.id, c.supportStatus]))

    // 支援中フィルタ適用
    const targetCompanyIds = options?.showAll
        ? companiesData.map((c) => c.id)
        : companiesData.filter((c) => c.supportStatus === "支援中").map((c) => c.id)

    // 判定基準取得
    const allCriteria = await getAnalysisCriteria()
    const defaultCriteria = allCriteria.filter((c) => c.companyId === null)

    // 支援期間目標取得
    const caseTargets = await getAllCaseTargets()
    const caseTargetCompanyIds = new Set(caseTargets.map((t) => t.companyId))

    const assessments: CompanyAssessment[] = []

    // case_target がある企業: 各 case_target ごとに判定
    const activeCaseTargets = caseTargets.filter((ct) => targetCompanyIds.includes(ct.companyId))

    await Promise.all(
        activeCaseTargets.map(async (ct) => {
            const startDateUnix = Math.floor(new Date(ct.startDate).getTime() / 1000)
            const metrics = await getCaseTargetMetrics(ct.companyId, ct.caseName, startDateUnix)

            const phaseNumber = getPhaseNumber(ct.startDate, ct.endDate, jstToday)
            const elapsedPercent = getElapsedPercent(ct.startDate, ct.endDate, jstToday)
            const periodPace = calculatePeriodPace(ct.startDate, ct.endDate, ct.targetHires, metrics.joined)

            // 企業固有の判定基準があればそれを使う、なければデフォルト
            const companyCriteria = allCriteria.filter((c) => c.companyId === ct.companyId)
            const criteriaToUse = companyCriteria.length > 0 ? companyCriteria : defaultCriteria

            const { status, reason } = assessCaseTarget(metrics, phaseNumber, ct.targetHires, criteriaToUse)

            assessments.push({
                companyId: ct.companyId,
                companyName: ct.companyName,
                caseName: ct.caseName,
                supportStatus: companyStatusMap.get(ct.companyId) ?? "支援中",
                status,
                reason,
                phaseNumber,
                elapsedPercent,
                targetHires: ct.targetHires,
                periodPace,
                metrics: {
                    totalApplicants: metrics.totalApplicants,
                    validApplicants: metrics.validApplicants,
                    interviewScheduledCount: metrics.interviewScheduledCount,
                    interviewConductedCount: metrics.interviewConductedCount,
                    offered: metrics.offered,
                    joined: metrics.joined,
                    connectedApplicantCount: metrics.connectedApplicantCount,
                },
            })
        })
    )

    // case_target がない企業: 「支援期間未設定」として表示
    const companiesWithoutTarget = targetCompanyIds.filter((id) => !caseTargetCompanyIds.has(id))
    for (const companyId of companiesWithoutTarget) {
        const company = companiesData.find((c) => c.id === companyId)
        if (!company) continue
        assessments.push({
            companyId,
            companyName: company.name,
            caseName: null,
            supportStatus: companyStatusMap.get(companyId) ?? "支援中",
            status: "no_data",
            reason: "支援期間目標未設定",
            phaseNumber: null,
            elapsedPercent: null,
            targetHires: 0,
            metrics: { totalApplicants: 0, validApplicants: 0, interviewScheduledCount: 0, interviewConductedCount: 0, offered: 0, joined: 0, connectedApplicantCount: 0 },
        })
    }

    return {
        good: assessments.filter((a) => a.status === "good").sort((a, b) => b.metrics.joined - a.metrics.joined),
        alert: assessments.filter((a) => a.status === "alert").sort((a, b) => a.metrics.validApplicants - b.metrics.validApplicants),
        noData: assessments.filter((a) => a.status === "no_data"),
        defaultCriteria,
    }
}

// ====================================================================
// 企業別 支援期間目標履歴（結果付き）
// ====================================================================

export type CaseTargetWithResult = {
    id: string
    companyId: string
    caseName: string
    startDate: string
    endDate: string
    targetHires: number
    isActive: boolean   // today between start and end
    isEnded: boolean    // today > end
    result: {
        totalApplicants: number
        validApplicants: number
        interviewScheduledCount: number
        offered: number
        joined: number
    }
}

export async function getCompanyCaseTargetHistory(companyId: string): Promise<CaseTargetWithResult[]> {
    const targets = await db
        .select()
        .from(schema.companyCaseTargets)
        .where(eq(schema.companyCaseTargets.companyId, companyId))
        .orderBy(schema.companyCaseTargets.startDate)

    const today = new Date()
    const jstToday = new Date(today.getTime() + 9 * 60 * 60 * 1000)
    const todayUnix = Math.floor(jstToday.getTime() / 1000)

    const results = await Promise.all(
        targets.map(async (t) => {
            const startMs = new Date(t.startDate).getTime()
            const endMs = new Date(t.endDate).getTime()
            const startUnix = Number.isFinite(startMs) ? Math.floor(startMs / 1000) : 0
            const endUnix = Number.isFinite(endMs) ? Math.floor(endMs / 1000) : 0
            const isActive = todayUnix >= startUnix && todayUnix <= endUnix
            const isEnded = todayUnix > endUnix

            let metrics: Awaited<ReturnType<typeof getCaseTargetMetrics>>
            if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
                console.error("[analysis] invalid case target period", {
                    companyId,
                    caseTargetId: t.id,
                    startDate: t.startDate,
                    endDate: t.endDate,
                })
                metrics = {
                    companyId,
                    companyName: "",
                    totalApplicants: 0,
                    validApplicants: 0,
                    connectedApplicantCount: 0,
                    interviewScheduledCount: 0,
                    interviewConductedCount: 0,
                    offered: 0,
                    joined: 0,
                }
            } else {
                try {
                    metrics = await getCaseTargetMetrics(companyId, t.caseName, startUnix, endUnix)
                } catch (error) {
                    console.error("[analysis] failed to load case target metrics", {
                        companyId,
                        caseTargetId: t.id,
                        error: error instanceof Error ? error.message : String(error),
                    })
                    metrics = {
                        companyId,
                        companyName: "",
                        totalApplicants: 0,
                        validApplicants: 0,
                        connectedApplicantCount: 0,
                        interviewScheduledCount: 0,
                        interviewConductedCount: 0,
                        offered: 0,
                        joined: 0,
                    }
                }
            }

            return {
                id: t.id,
                companyId: t.companyId,
                caseName: t.caseName,
                startDate: t.startDate,
                endDate: t.endDate,
                targetHires: t.targetHires,
                isActive,
                isEnded,
                result: {
                    totalApplicants: metrics.totalApplicants,
                    validApplicants: metrics.validApplicants,
                    interviewScheduledCount: metrics.interviewScheduledCount,
                    offered: metrics.offered,
                    joined: metrics.joined,
                },
            } satisfies CaseTargetWithResult
        })
    )

    // Sort: active first, then pending (not started), then ended
    return results.sort((a, b) => {
        const rank = (x: CaseTargetWithResult) => (x.isActive ? 0 : x.isEnded ? 2 : 1)
        return rank(a) - rank(b)
    })
}
