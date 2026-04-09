"use server";

import { db, schema } from "@/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

const DUPLICATE_APPLICATION_STATUSES = ["重複応募（応募歴あり）", "重複応募(応募歴あり)"] as const
const NOT_CONNECTED_STATUSES = ["連絡不通（不採用）"] as const
const PHONE_APPOINTMENT_FIXED_STATUSES = ["電話アポ日程確定済み"] as const
const DOC_DECLINED_STATUSES = ["書類選考中辞退"] as const
const DOC_REJECTED_MK_STATUSES = ["書類不採用(MK判断)", "書類不採用（MK判断）", "書類不採用（MK対応）"] as const
const DOC_REJECTED_CLIENT_STATUSES = ["書類不採用(クライアント判断)", "書類不採用（クライアント判断）"] as const
const COMPANY_INTERVIEW_SCHEDULING_STATUSES = ["企業面接日程調整中", "企業面接日程調整中数"] as const
const PRIMARY_INTERVIEW_PLANNED_STATUSES = ["面接日程確定済み"] as const
const PRIMARY_INTERVIEW_DECLINED_BEFORE_STATUSES = ["面接前辞退", "面接前辞退数"] as const
const PRIMARY_INTERVIEW_NO_SHOW_STATUSES = ["面接飛び", "面接飛び数"] as const
const PRIMARY_INTERVIEW_DECLINED_AFTER_STATUSES = ["面接後辞退"] as const
const PRIMARY_INTERVIEW_REJECTED_STATUSES = ["面接不採用", "面接不採用数"] as const
const OFFERED_STATUSES = ["内定", "内定数"] as const
const OFFER_DECLINED_STATUSES = ["内定後辞退", "入社前辞退"] as const
const JOINED_STATUSES = ["入社"] as const
const ACTIVE_SUPPORT_STATUS = "支援中" as const

const UNIQUE_APPLICANT_KEY_EXPR = sql<string>`
    coalesce(
        nullif(lower(trim(${schema.applicants.email})), ''),
        nullif(replace(replace(replace(${schema.applicants.phone}, '-', ''), ' ', ''), '　', ''), ''),
        nullif(trim(${schema.applicants.name}), ''),
        ${schema.applicants.id}
    )
`

function statusIn(statuses: readonly string[]) {
    return sql`${schema.applicants.responseStatus} in (${sql.join(statuses.map((status) => sql`${status}`), sql`, `)})`
}

export type CompanyYieldRow = {
    companyId: string
    companyName: string
    totalApplicants: number
    uniqueApplicants: number
    validApplicants: number
    validApplicantRate: string
    connectedApplicantCount: number
    connectedValidApplicantCount: number
    notConnectedCount: number
    phoneAppointmentCount: number
    docDeclined: number
    docRejectedMK: number
    docRejectedClient: number
    docRejected: number
    schedulingInterview: number
    interviewDeclinedBefore: number
    priScheduled: number
    priConducted: number
    priNoShow: number
    primaryDeclinedAfter: number
    primaryRejected: number
    secScheduled: number
    secConducted: number
    secDeclinedBefore: number
    secNoShow: number
    secDeclinedAfter: number
    secRejected: number
    finalScheduled: number
    finalConducted: number
    finalDeclinedBefore: number
    finalNoShow: number
    finalDeclinedAfter: number
    finalRejected: number
    interviewScheduledCount: number
    interviewPlannedCount: number
    interviewConductedCount: number
    interviewConductedUniqueCount: number
    interviewDateSetCount: number
    preInterviewDeclinedCount: number
    interviewNoShowCount: number
    interviewDeclinedAfterCount: number
    interviewRejectedCount: number
    offered: number
    offerPendingCount: number
    offerDeclined: number
    joined: number
    connectedApplicantRate: string
    interviewScheduledRate: string
    interviewConductedRate: string
    offerRate: string
    joinRate: string
    preInterviewDeclineRate: string
    offerDeclineRate: string
}

export type CompanyMonthlyTotalRow = {
    month: number
    totalApplicants: number
    uniqueApplicants: number
    validApplicants: number
    validApplicantRate: string
    connectedApplicantCount: number
    notConnectedCount: number
    phoneAppointmentCount: number
    interviewScheduledCount: number
    interviewConductedCount: number
    offered: number
    offerPendingCount: number
    joined: number
    preInterviewDeclinedCount: number
    offerDeclined: number
    connectedApplicantRate: string
    interviewScheduledRate: string
    interviewConductedRate: string
    offerRate: string
    joinRate: string
    preInterviewDeclineRate: string
    offerDeclineRate: string
}

export type CompanyWeeklyTotalRow = {
    month: number
    week: number
    totalApplicants: number
    uniqueApplicants: number
    validApplicants: number
    validApplicantRate: string
    connectedApplicantCount: number
    notConnectedCount: number
    phoneAppointmentCount: number
    interviewScheduledCount: number
    interviewConductedCount: number
    offered: number
    offerPendingCount: number
    joined: number
    preInterviewDeclinedCount: number
    offerDeclined: number
    connectedApplicantRate: string
    interviewScheduledRate: string
    interviewConductedRate: string
    offerRate: string
    joinRate: string
    preInterviewDeclineRate: string
    offerDeclineRate: string
}

type CompanyMonthlyFilterOptions = {
    month?: number
    week?: number
    periodStartAt?: number
    periodEndAt?: number
}

type BaseDateFilter = {
    year: number | undefined
    month: number | undefined
    week: number | undefined
    periodStartAt?: number
    periodEndAt?: number
}

function normalizeDateFilter(
    year: number | undefined,
    month: number | undefined,
    week: number | undefined,
    periodStartAt?: number,
    periodEndAt?: number,
): BaseDateFilter {
    const yearValue = year && Number.isFinite(year) ? Math.floor(year) : undefined
    const monthValue = month && Number.isFinite(month) ? Math.floor(month) : undefined
    const weekValue = week && Number.isFinite(week) ? Math.floor(week) : undefined
    const safeMonth = monthValue && monthValue >= 1 && monthValue <= 12 ? monthValue : undefined
    const safeWeek = weekValue && weekValue >= 1 && weekValue <= 5 ? weekValue : undefined
    const safePeriodStartAt = typeof periodStartAt === "number" && Number.isFinite(periodStartAt)
        ? Math.floor(periodStartAt)
        : undefined
    const safePeriodEndAt = typeof periodEndAt === "number" && Number.isFinite(periodEndAt)
        ? Math.floor(periodEndAt)
        : undefined

    if (typeof safePeriodStartAt === "number" || typeof safePeriodEndAt === "number") {
        return {
            year: undefined,
            month: undefined,
            week: undefined,
            periodStartAt: safePeriodStartAt,
            periodEndAt: safePeriodEndAt,
        }
    }

    return { year: yearValue, month: safeMonth, week: safeWeek }
}

function buildAppliedTimeFilter({ year, month, week, periodStartAt, periodEndAt }: BaseDateFilter) {
    if (typeof periodStartAt === "number" && typeof periodEndAt === "number") {
        return sql`${schema.applicants.appliedAt} >= ${periodStartAt} AND ${schema.applicants.appliedAt} < ${periodEndAt}`
    }

    if (typeof periodStartAt === "number") {
        return sql`${schema.applicants.appliedAt} >= ${periodStartAt}`
    }

    if (typeof periodEndAt === "number") {
        return sql`${schema.applicants.appliedAt} < ${periodEndAt}`
    }

    if (typeof year === "number" && typeof month === "number" && typeof week === "number") {
        const weekStartDay = 1 + ((week - 1) * 7)
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
        if (weekStartDay > daysInMonth) {
            return sql`0=1`
        }

        const startAt = Math.floor(Date.UTC(year, month - 1, weekStartDay, 0, 0, 0) / 1000)
        const endAt = week === 5
            ? Math.floor(Date.UTC(year, month, 1, 0, 0, 0) / 1000)
            : Math.floor(Date.UTC(year, month - 1, Math.min(weekStartDay + 7, daysInMonth + 1), 0, 0, 0) / 1000)
        return sql`${schema.applicants.appliedAt} >= ${startAt} AND ${schema.applicants.appliedAt} < ${endAt}`
    }

    if (typeof year === "number" && typeof month === "number") {
        const startAt = Math.floor(Date.UTC(year, month - 1, 1, 0, 0, 0) / 1000)
        const endAt = Math.floor(Date.UTC(year, month, 1, 0, 0, 0) / 1000)
        return sql`${schema.applicants.appliedAt} >= ${startAt} AND ${schema.applicants.appliedAt} < ${endAt}`
    }

    if (typeof year === "number") {
        const startAt = Math.floor(Date.UTC(year, 0, 1, 0, 0, 0) / 1000)
        const endAt = Math.floor(Date.UTC(year + 1, 0, 1, 0, 0, 0) / 1000)
        return sql`${schema.applicants.appliedAt} >= ${startAt} AND ${schema.applicants.appliedAt} < ${endAt}`
    }

    if (typeof month === "number") {
        const monthText = String(month).padStart(2, "0")
        if (typeof week === "number") {
            const weekStartDay = 1 + ((week - 1) * 7)
            const weekEndDayExclusive = week === 5 ? 32 : weekStartDay + 7
            return sql`
                strftime('%m', ${schema.applicants.appliedAt}, 'unixepoch') = ${monthText}
                AND cast(strftime('%d', ${schema.applicants.appliedAt}, 'unixepoch') as integer) >= ${weekStartDay}
                AND cast(strftime('%d', ${schema.applicants.appliedAt}, 'unixepoch') as integer) < ${weekEndDayExclusive}
            `
        }
        return sql`strftime('%m', ${schema.applicants.appliedAt}, 'unixepoch') = ${monthText}`
    }

    return sql`1=1`
}

function formatRate(numerator: number, denominator: number) {
    if (denominator <= 0) {
        return "0.0% (0/0)"
    }

    const percent = (numerator / denominator) * 100
    return `${percent.toFixed(1)}% (${numerator}/${denominator})`
}

export async function getCompanyYields(
    year: number | undefined,
    month: number | undefined,
    dateType: "applied" | "event",
    options?: {
        companyId?: string
        companyIds?: string[]
        week?: number
        periodStartAt?: number
        periodEndAt?: number
    },
) {
    // NOTE: `event` filtering is reserved for future support.
    void dateType

    const filter = normalizeDateFilter(year, month, options?.week, options?.periodStartAt, options?.periodEndAt)
    const timeFilter = buildAppliedTimeFilter(filter)
    const targetCompanyId = options?.companyId?.trim()
    const targetCompanyIds = options?.companyIds?.length ? options.companyIds : undefined

    const activeCompanyFilter = eq(schema.companies.supportStatus, ACTIVE_SUPPORT_STATUS)
    const companyWhereClause = targetCompanyId
        ? and(activeCompanyFilter, eq(schema.companies.id, targetCompanyId))
        : targetCompanyIds
            ? and(activeCompanyFilter, inArray(schema.companies.id, targetCompanyIds))
            : activeCompanyFilter

    const applicantsJoinCondition = and(
        eq(schema.companies.id, schema.applicants.companyId),
        timeFilter,
        companyWhereClause,
    )

    const [results, callMetrics] = await Promise.all([
        db
            .select({
                companyId: schema.companies.id,
                companyName: schema.companies.name,
                totalApplicants: sql<number>`count(${schema.applicants.id})`,
                uniqueApplicants: sql<number>`count(${schema.applicants.id}) - sum(case when ${statusIn(DUPLICATE_APPLICATION_STATUSES)} then 1 else 0 end)`,
                validApplicants: sql<number>`sum(coalesce(${schema.applicants.isValidApplicant},0))`,
                docDeclined: sql<number>`sum(case when ${statusIn(DOC_DECLINED_STATUSES)} then 1 else 0 end)`,
                docRejectedMK: sql<number>`sum(case when ${statusIn(DOC_REJECTED_MK_STATUSES)} then 1 else 0 end)`,
                docRejectedClient: sql<number>`sum(case when ${statusIn(DOC_REJECTED_CLIENT_STATUSES)} then 1 else 0 end)`,
                docRejected: sql<number>`sum(case when ${statusIn([...DOC_REJECTED_MK_STATUSES, ...DOC_REJECTED_CLIENT_STATUSES])} then 1 else 0 end)`,
                schedulingInterview: sql<number>`sum(case when ${statusIn(COMPANY_INTERVIEW_SCHEDULING_STATUSES)} then 1 else 0 end)`,
                interviewDeclinedBefore: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_DECLINED_BEFORE_STATUSES)} then 1 else 0 end)`,
                priScheduled: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
                priConducted: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted},0) = 1 then 1 else 0 end)`,
                priNoShow: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_NO_SHOW_STATUSES)} then 1 else 0 end)`,
                primaryDeclinedAfter: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_DECLINED_AFTER_STATUSES)} then 1 else 0 end)`,
                primaryRejected: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_REJECTED_STATUSES)} then 1 else 0 end)`,
                secScheduled: sql<number>`sum(case when ${schema.applicants.secScheduledDate} is not null then 1 else 0 end)`,
                secConducted: sql<number>`sum(case when coalesce(${schema.applicants.secConducted},0) = 1 then 1 else 0 end)`,
                secDeclinedBefore: sql<number>`sum(coalesce(${schema.applicants.secDeclinedBefore},0))`,
                secNoShow: sql<number>`sum(coalesce(${schema.applicants.secNoShow},0))`,
                secDeclinedAfter: sql<number>`sum(coalesce(${schema.applicants.secDeclinedAfter},0))`,
                secRejected: sql<number>`sum(coalesce(${schema.applicants.secRejected},0))`,
                finalScheduled: sql<number>`sum(case when ${schema.applicants.finalScheduledDate} is not null then 1 else 0 end)`,
                finalConducted: sql<number>`sum(case when coalesce(${schema.applicants.finalConducted},0) = 1 then 1 else 0 end)`,
                finalDeclinedBefore: sql<number>`sum(coalesce(${schema.applicants.finalDeclinedBefore},0))`,
                finalNoShow: sql<number>`sum(coalesce(${schema.applicants.finalNoShow},0))`,
                finalDeclinedAfter: sql<number>`sum(coalesce(${schema.applicants.finalDeclinedAfter},0))`,
                finalRejected: sql<number>`sum(coalesce(${schema.applicants.finalRejected},0))`,
                interviewScheduledCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
                interviewPlannedCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_PLANNED_STATUSES)} then 1 else 0 end)`,
                interviewConductedCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted},0) = 1 then 1 else 0 end)`,
                interviewConductedUniqueCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted},0) = 1 then 1 else 0 end)`,
                interviewDateSetCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
                preInterviewDeclinedCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_DECLINED_BEFORE_STATUSES)} then 1 else 0 end)`,
                interviewNoShowCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_NO_SHOW_STATUSES)} then 1 else 0 end)`,
                interviewDeclinedAfterCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_DECLINED_AFTER_STATUSES)} then 1 else 0 end)`,
                interviewRejectedCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_REJECTED_STATUSES)} then 1 else 0 end)`,
                phoneAppointmentCount: sql<number>`sum(case when ${statusIn(PHONE_APPOINTMENT_FIXED_STATUSES)} then 1 else 0 end)`,
                offered: sql<number>`sum(coalesce(${schema.applicants.offered}, 0))`,
                offerDeclined: sql<number>`sum(case when ${statusIn(OFFER_DECLINED_STATUSES)} then 1 else 0 end)`,
                joined: sql<number>`sum(case when ${statusIn(JOINED_STATUSES)} then 1 else 0 end)`,
            })
            .from(schema.companies)
            .where(companyWhereClause)
            .leftJoin(schema.applicants, applicantsJoinCondition)
            .groupBy(schema.companies.id, schema.companies.name)
            .orderBy(schema.companies.name),
        db
            .select({
                companyId: schema.companies.id,
                connectedApplicantCount: sql<number>`
                    sum(
                        case
                            when ${schema.applicants.connectedAt} is not null
                            then 1
                            else 0
                        end
                    )
                `,
                connectedValidApplicantCount: sql<number>`
                    sum(
                        case
                            when ${schema.applicants.connectedAt} is not null
                                and coalesce(${schema.applicants.isValidApplicant}, 0) = 1
                            then 1
                            else 0
                        end
                    )
                `,
                notConnectedCount: sql<number>`
                    sum(
                        case
                            when ${statusIn(NOT_CONNECTED_STATUSES)}
                            then 1
                            else 0
                        end
                    )
                `,
            })
            .from(schema.companies)
            .where(companyWhereClause)
            .leftJoin(schema.applicants, applicantsJoinCondition)
            .groupBy(schema.companies.id),
    ])

    const callMetricMap = new Map(
        callMetrics.map((row) => [
            row.companyId,
            {
                connectedApplicantCount: Number(row.connectedApplicantCount || 0),
                connectedValidApplicantCount: Number(row.connectedValidApplicantCount || 0),
                notConnectedCount: Number(row.notConnectedCount || 0),
            },
        ]),
    )

    return results.map((row) => {
        const validApplicants = Number(row.validApplicants || 0)
        const totalApplicants = Number(row.totalApplicants || 0)
        const connectedApplicantCount = callMetricMap.get(row.companyId)?.connectedApplicantCount || 0
        const connectedValidApplicantCount = callMetricMap.get(row.companyId)?.connectedValidApplicantCount || 0
        const notConnectedCount = callMetricMap.get(row.companyId)?.notConnectedCount || 0
        const interviewScheduledCount = Number(row.interviewScheduledCount || 0)
        const interviewDateSetCount = Number(row.interviewDateSetCount || 0)
        const interviewConductedUniqueCount = Number(row.interviewConductedUniqueCount || 0)
        const offered = Number(row.offered || 0)
        const offerDeclined = Number(row.offerDeclined || 0)
        const joined = Number(row.joined || 0)
        const offerPendingCount = Math.max(0, offered - (offerDeclined + joined))

        return {
            companyId: row.companyId,
            companyName: row.companyName,
            totalApplicants,
            uniqueApplicants: Number(row.uniqueApplicants || 0),
            validApplicants,
            validApplicantRate: formatRate(validApplicants, Number(row.uniqueApplicants || 0)),
            connectedApplicantCount,
            connectedValidApplicantCount,
            notConnectedCount,
            phoneAppointmentCount: Number(row.phoneAppointmentCount || 0),
            docDeclined: Number(row.docDeclined || 0),
            docRejectedMK: Number(row.docRejectedMK || 0),
            docRejectedClient: Number(row.docRejectedClient || 0),
            docRejected: Number(row.docRejected || 0),
            schedulingInterview: Number(row.schedulingInterview || 0),
            interviewDeclinedBefore: Number(row.interviewDeclinedBefore || 0),
            priScheduled: Number(row.priScheduled || 0),
            priConducted: Number(row.priConducted || 0),
            priNoShow: Number(row.priNoShow || 0),
            primaryDeclinedAfter: Number(row.primaryDeclinedAfter || 0),
            primaryRejected: Number(row.primaryRejected || 0),
            secScheduled: Number(row.secScheduled || 0),
            secConducted: Number(row.secConducted || 0),
            secDeclinedBefore: Number(row.secDeclinedBefore || 0),
            secNoShow: Number(row.secNoShow || 0),
            secDeclinedAfter: Number(row.secDeclinedAfter || 0),
            secRejected: Number(row.secRejected || 0),
            finalScheduled: Number(row.finalScheduled || 0),
            finalConducted: Number(row.finalConducted || 0),
            finalDeclinedBefore: Number(row.finalDeclinedBefore || 0),
            finalNoShow: Number(row.finalNoShow || 0),
            finalDeclinedAfter: Number(row.finalDeclinedAfter || 0),
            finalRejected: Number(row.finalRejected || 0),
            interviewScheduledCount,
            interviewPlannedCount: Number(row.interviewPlannedCount || 0),
            interviewConductedCount: Number(row.interviewConductedCount || 0),
            interviewConductedUniqueCount,
            interviewDateSetCount,
            preInterviewDeclinedCount: Number(row.preInterviewDeclinedCount || 0),
            interviewNoShowCount: Number(row.interviewNoShowCount || 0),
            interviewDeclinedAfterCount: Number(row.interviewDeclinedAfterCount || 0),
            interviewRejectedCount: Number(row.interviewRejectedCount || 0),
            offered,
            offerPendingCount,
            offerDeclined,
            joined,
            connectedApplicantRate: formatRate(connectedApplicantCount, validApplicants),
            interviewScheduledRate: formatRate(interviewScheduledCount, validApplicants),
            interviewConductedRate: formatRate(interviewConductedUniqueCount, validApplicants),
            offerRate: formatRate(offered, validApplicants),
            joinRate: formatRate(joined, validApplicants),
            preInterviewDeclineRate: formatRate(Number(row.preInterviewDeclinedCount || 0), interviewDateSetCount),
            offerDeclineRate: formatRate(offerDeclined, offered),
        }
    }) as CompanyYieldRow[]
}

// ====================================================================
// 支援期間ベース：企業×職種の累計メトリクス取得
// ====================================================================

export type CaseTargetMetrics = {
    companyId: string
    companyName: string
    totalApplicants: number
    validApplicants: number
    connectedApplicantCount: number
    interviewScheduledCount: number
    interviewConductedCount: number
    offered: number
    joined: number
}

export async function getCaseTargetMetrics(
    companyId: string,
    caseName: string,
    startDateUnix: number,
    endDateUnix?: number,
): Promise<CaseTargetMetrics> {
    const timeFilter = endDateUnix
        ? sql`${schema.applicants.appliedAt} >= ${startDateUnix} AND ${schema.applicants.appliedAt} <= ${endDateUnix}`
        : sql`${schema.applicants.appliedAt} >= ${startDateUnix}`
    const caseNameFilter = sql`${schema.applicants.caseName} = ${caseName}`
    const companyFilter = eq(schema.companies.id, companyId)

    const joinCondition = and(
        eq(schema.companies.id, schema.applicants.companyId),
        timeFilter,
        caseNameFilter,
    )

    const [mainRow, callRow] = await Promise.all([
        db
            .select({
                companyId: schema.companies.id,
                companyName: schema.companies.name,
                totalApplicants: sql<number>`count(${schema.applicants.id})`,
                validApplicants: sql<number>`sum(coalesce(${schema.applicants.isValidApplicant},0))`,
                interviewScheduledCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
                interviewConductedCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted},0) = 1 then 1 else 0 end)`,
                offered: sql<number>`sum(case when ${statusIn(OFFERED_STATUSES)} then 1 else 0 end)`,
                joined: sql<number>`sum(case when ${statusIn(JOINED_STATUSES)} then 1 else 0 end)`,
            })
            .from(schema.companies)
            .where(companyFilter)
            .leftJoin(schema.applicants, joinCondition)
            .groupBy(schema.companies.id, schema.companies.name)
            .limit(1),
        db
            .select({
                companyId: schema.companies.id,
                connectedApplicantCount: sql<number>`sum(case when ${schema.applicants.connectedAt} is not null then 1 else 0 end)`,
            })
            .from(schema.companies)
            .where(companyFilter)
            .leftJoin(schema.applicants, joinCondition)
            .groupBy(schema.companies.id)
            .limit(1),
    ])

    const row = mainRow[0]
    const callData = callRow[0]

    if (!row) {
        return {
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

    return {
        companyId: row.companyId,
        companyName: row.companyName,
        totalApplicants: Number(row.totalApplicants || 0),
        validApplicants: Number(row.validApplicants || 0),
        connectedApplicantCount: Number(callData?.connectedApplicantCount || 0),
        interviewScheduledCount: Number(row.interviewScheduledCount || 0),
        interviewConductedCount: Number(row.interviewConductedCount || 0),
        offered: Number(row.offered || 0),
        joined: Number(row.joined || 0),
    }
}

export async function getCompanyMonthlyTotals(
    year: number | undefined,
    options?: CompanyMonthlyFilterOptions,
) {
    const normalizedFilter = normalizeDateFilter(
        year,
        options?.month,
        options?.week,
        options?.periodStartAt,
        options?.periodEndAt,
    )
    const filter = buildAppliedTimeFilter(normalizedFilter)
    const monthExpr = sql<string>`strftime('%m', ${schema.applicants.appliedAt}, 'unixepoch')`

    const [baseRows, callMetricRows] = await Promise.all([
        db
            .select({
                month: monthExpr,
                totalApplicants: sql<number>`count(${schema.applicants.id})`,
                uniqueApplicants: sql<number>`count(${schema.applicants.id}) - sum(case when ${statusIn(DUPLICATE_APPLICATION_STATUSES)} then 1 else 0 end)`,
                validApplicants: sql<number>`sum(coalesce(${schema.applicants.isValidApplicant},0))`,
                phoneAppointmentCount: sql<number>`sum(case when ${statusIn(PHONE_APPOINTMENT_FIXED_STATUSES)} then 1 else 0 end)`,
                interviewScheduledCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
                interviewConductedCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted},0) = 1 then 1 else 0 end)`,
                offered: sql<number>`sum(coalesce(${schema.applicants.offered}, 0))`,
                joined: sql<number>`sum(case when ${statusIn(JOINED_STATUSES)} then 1 else 0 end)`,
                preInterviewDeclinedCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_DECLINED_BEFORE_STATUSES)} then 1 else 0 end)`,
                offerDeclined: sql<number>`sum(case when ${statusIn(OFFER_DECLINED_STATUSES)} then 1 else 0 end)`,
                interviewDateSetCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
            })
            .from(schema.applicants)
            .where(filter)
            .groupBy(monthExpr)
            .orderBy(monthExpr),
        db
            .select({
                month: monthExpr,
                connectedApplicantCount: sql<number>`
                    sum(
                        case
                            when ${schema.applicants.connectedAt} is not null
                            then 1
                            else 0
                        end
                    )
                `,
                connectedValidApplicantCount: sql<number>`
                    sum(
                        case
                            when ${schema.applicants.connectedAt} is not null
                                and coalesce(${schema.applicants.isValidApplicant}, 0) = 1
                            then 1
                            else 0
                        end
                    )
                `,
                notConnectedCount: sql<number>`
                    sum(
                        case
                            when ${statusIn(NOT_CONNECTED_STATUSES)}
                            then 1
                            else 0
                        end
                    )
                `,
            })
            .from(schema.applicants)
            .where(filter)
            .groupBy(monthExpr)
            .orderBy(monthExpr),
    ])

    const baseMap = new Map(
        baseRows.map((row) => [
            Number.parseInt(row.month, 10),
            {
                totalApplicants: Number(row.totalApplicants || 0),
                uniqueApplicants: Number(row.uniqueApplicants || 0),
                validApplicants: Number(row.validApplicants || 0),
                phoneAppointmentCount: Number(row.phoneAppointmentCount || 0),
                interviewScheduledCount: Number(row.interviewScheduledCount || 0),
                interviewConductedCount: Number(row.interviewConductedCount || 0),
                offered: Number(row.offered || 0),
                joined: Number(row.joined || 0),
                preInterviewDeclinedCount: Number(row.preInterviewDeclinedCount || 0),
                offerDeclined: Number(row.offerDeclined || 0),
                interviewDateSetCount: Number(row.interviewDateSetCount || 0),
            },
        ]),
    )

    const callMetricMap = new Map(
        callMetricRows.map((row) => [
            Number.parseInt(row.month, 10),
            {
                connectedApplicantCount: Number(row.connectedApplicantCount || 0),
                connectedValidApplicantCount: Number(row.connectedValidApplicantCount || 0),
                notConnectedCount: Number(row.notConnectedCount || 0),
            },
        ]),
    )

    const hasCustomRange =
        typeof normalizedFilter.periodStartAt === "number" ||
        typeof normalizedFilter.periodEndAt === "number"
    const months = typeof normalizedFilter.month === "number"
        ? [normalizedFilter.month]
        : hasCustomRange
            ? Array.from(
                new Set([
                    ...baseMap.keys(),
                    ...callMetricMap.keys(),
                ]),
            ).sort((left, right) => left - right)
            : Array.from({ length: 12 }, (_, index) => index + 1)
    return months.map((month) => {
        const base = baseMap.get(month) || {
            totalApplicants: 0,
            uniqueApplicants: 0,
            validApplicants: 0,
            phoneAppointmentCount: 0,
            interviewScheduledCount: 0,
            interviewConductedCount: 0,
            offered: 0,
            joined: 0,
            preInterviewDeclinedCount: 0,
            offerDeclined: 0,
            interviewDateSetCount: 0,
        }
        const callMetric = callMetricMap.get(month) || {
            connectedApplicantCount: 0,
            connectedValidApplicantCount: 0,
            notConnectedCount: 0,
        }

        return {
            month,
            totalApplicants: base.totalApplicants,
            uniqueApplicants: base.uniqueApplicants,
            validApplicants: base.validApplicants,
            validApplicantRate: formatRate(base.validApplicants, base.uniqueApplicants),
            connectedApplicantCount: callMetric.connectedApplicantCount,
            notConnectedCount: callMetric.notConnectedCount,
            phoneAppointmentCount: base.phoneAppointmentCount,
            interviewScheduledCount: base.interviewScheduledCount,
            interviewConductedCount: base.interviewConductedCount,
            offered: base.offered,
            offerPendingCount: Math.max(0, base.offered - (base.offerDeclined + base.joined)),
            joined: base.joined,
            preInterviewDeclinedCount: base.preInterviewDeclinedCount,
            offerDeclined: base.offerDeclined,
            connectedApplicantRate: formatRate(callMetric.connectedApplicantCount, base.validApplicants),
            interviewScheduledRate: formatRate(base.interviewScheduledCount, base.validApplicants),
            interviewConductedRate: formatRate(base.interviewConductedCount, base.validApplicants),
            offerRate: formatRate(base.offered, base.validApplicants),
            joinRate: formatRate(base.joined, base.validApplicants),
            preInterviewDeclineRate: formatRate(base.preInterviewDeclinedCount, base.interviewDateSetCount),
            offerDeclineRate: formatRate(base.offerDeclined, base.offered),
        }
    }) as CompanyMonthlyTotalRow[]
}

export async function getCompanyMonthlyWeeklyTotals(
    year: number | undefined,
    options?: CompanyMonthlyFilterOptions,
): Promise<CompanyWeeklyTotalRow[]> {
    const normalizedFilter = normalizeDateFilter(
        year,
        options?.month,
        options?.week,
        options?.periodStartAt,
        options?.periodEndAt,
    )
    const filter = buildAppliedTimeFilter(normalizedFilter)
    const monthExpr = sql<string>`strftime('%m', ${schema.applicants.appliedAt}, 'unixepoch')`
    const weekExpr = sql<string>`cast(((cast(strftime('%d', ${schema.applicants.appliedAt}, 'unixepoch') as integer) - 1) / 7) + 1 as integer)`

    const [baseRows, callMetricRows] = await Promise.all([
        db
            .select({
                month: monthExpr,
                week: weekExpr,
                totalApplicants: sql<number>`count(${schema.applicants.id})`,
                uniqueApplicants: sql<number>`count(${schema.applicants.id}) - sum(case when ${statusIn(DUPLICATE_APPLICATION_STATUSES)} then 1 else 0 end)`,
                validApplicants: sql<number>`sum(coalesce(${schema.applicants.isValidApplicant},0))`,
                phoneAppointmentCount: sql<number>`sum(case when ${statusIn(PHONE_APPOINTMENT_FIXED_STATUSES)} then 1 else 0 end)`,
                interviewScheduledCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
                interviewConductedCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted},0) = 1 then 1 else 0 end)`,
                offered: sql<number>`sum(coalesce(${schema.applicants.offered}, 0))`,
                joined: sql<number>`sum(case when ${statusIn(JOINED_STATUSES)} then 1 else 0 end)`,
                preInterviewDeclinedCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_DECLINED_BEFORE_STATUSES)} then 1 else 0 end)`,
                offerDeclined: sql<number>`sum(case when ${statusIn(OFFER_DECLINED_STATUSES)} then 1 else 0 end)`,
                interviewDateSetCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
            })
            .from(schema.applicants)
            .where(filter)
            .groupBy(monthExpr, weekExpr)
            .orderBy(monthExpr, weekExpr),
        db
            .select({
                month: monthExpr,
                week: weekExpr,
                connectedApplicantCount: sql<number>`
                    sum(
                        case
                            when ${schema.applicants.connectedAt} is not null
                            then 1
                            else 0
                        end
                    )
                `,
                connectedValidApplicantCount: sql<number>`
                    sum(
                        case
                            when ${schema.applicants.connectedAt} is not null
                                and coalesce(${schema.applicants.isValidApplicant}, 0) = 1
                            then 1
                            else 0
                        end
                    )
                `,
                notConnectedCount: sql<number>`
                    sum(
                        case
                            when ${statusIn(NOT_CONNECTED_STATUSES)}
                            then 1
                            else 0
                        end
                    )
                `,
            })
            .from(schema.applicants)
            .where(filter)
            .groupBy(monthExpr, weekExpr)
            .orderBy(monthExpr, weekExpr),
    ])

    const baseMap = new Map(
        baseRows.map((row) => {
            const month = Number.parseInt(String(row.month), 10)
            const week = Number.parseInt(String(row.week), 10)
            return [
                `${month}-${week}`,
                {
                    month,
                    week,
                    totalApplicants: Number(row.totalApplicants || 0),
                    uniqueApplicants: Number(row.uniqueApplicants || 0),
                    validApplicants: Number(row.validApplicants || 0),
                    phoneAppointmentCount: Number(row.phoneAppointmentCount || 0),
                    interviewScheduledCount: Number(row.interviewScheduledCount || 0),
                    interviewConductedCount: Number(row.interviewConductedCount || 0),
                    offered: Number(row.offered || 0),
                    joined: Number(row.joined || 0),
                    preInterviewDeclinedCount: Number(row.preInterviewDeclinedCount || 0),
                    offerDeclined: Number(row.offerDeclined || 0),
                    interviewDateSetCount: Number(row.interviewDateSetCount || 0),
                },
            ]
        }),
    )

    const callMetricMap = new Map(
        callMetricRows.map((row) => {
            const month = Number.parseInt(String(row.month), 10)
            const week = Number.parseInt(String(row.week), 10)
            return [
                `${month}-${week}`,
                {
                    connectedApplicantCount: Number(row.connectedApplicantCount || 0),
                    connectedValidApplicantCount: Number(row.connectedValidApplicantCount || 0),
                    notConnectedCount: Number(row.notConnectedCount || 0),
                },
            ]
        }),
    )

    return Array.from(baseMap.values())
        .filter((base) => Number.isFinite(base.month) && Number.isFinite(base.week))
        .sort((left, right) => (left.month - right.month) || (left.week - right.week))
        .map((base) => {
            const key = `${base.month}-${base.week}`
            const callMetric = callMetricMap.get(key) || {
                connectedApplicantCount: 0,
                connectedValidApplicantCount: 0,
                notConnectedCount: 0,
            }

            return {
                month: base.month,
                week: base.week,
                totalApplicants: base.totalApplicants,
                uniqueApplicants: base.uniqueApplicants,
                validApplicants: base.validApplicants,
                validApplicantRate: formatRate(base.validApplicants, base.uniqueApplicants),
                connectedApplicantCount: callMetric.connectedApplicantCount,
                notConnectedCount: callMetric.notConnectedCount,
                phoneAppointmentCount: base.phoneAppointmentCount,
                interviewScheduledCount: base.interviewScheduledCount,
                interviewConductedCount: base.interviewConductedCount,
                offered: base.offered,
                offerPendingCount: Math.max(0, base.offered - (base.offerDeclined + base.joined)),
                joined: base.joined,
                preInterviewDeclinedCount: base.preInterviewDeclinedCount,
                offerDeclined: base.offerDeclined,
                connectedApplicantRate: formatRate(callMetric.connectedApplicantCount, base.validApplicants),
                interviewScheduledRate: formatRate(base.interviewScheduledCount, base.validApplicants),
                interviewConductedRate: formatRate(base.interviewConductedCount, base.validApplicants),
                offerRate: formatRate(base.offered, base.validApplicants),
                joinRate: formatRate(base.joined, base.validApplicants),
                preInterviewDeclineRate: formatRate(base.preInterviewDeclinedCount, base.interviewDateSetCount),
                offerDeclineRate: formatRate(base.offerDeclined, base.offered),
            }
        })
}

export type CaseYieldRow = CompanyYieldRow & {
    caseName: string
}

export async function getCompanyCaseYields(
    year: number | undefined,
    month: number | undefined,
    dateType: "applied" | "event",
    options?: {
        companyId?: string
        companyIds?: string[]
        week?: number
        periodStartAt?: number
        periodEndAt?: number
    },
): Promise<CaseYieldRow[]> {
    void dateType

    const filter = normalizeDateFilter(year, month, options?.week, options?.periodStartAt, options?.periodEndAt)
    const timeFilter = buildAppliedTimeFilter(filter)
    const targetCompanyId = options?.companyId?.trim()
    const targetCompanyIds = options?.companyIds?.length ? options.companyIds : undefined

    const activeCompanyFilter = eq(schema.companies.supportStatus, ACTIVE_SUPPORT_STATUS)
    const companyWhereClause = targetCompanyId
        ? and(activeCompanyFilter, eq(schema.companies.id, targetCompanyId))
        : targetCompanyIds
            ? and(activeCompanyFilter, inArray(schema.companies.id, targetCompanyIds))
            : activeCompanyFilter

    const applicantsJoinCondition = and(
        eq(schema.companies.id, schema.applicants.companyId),
        timeFilter,
        companyWhereClause,
    )

    const caseNameExpr = sql<string>`coalesce(nullif(trim(${schema.applicants.caseName}), ''), '(案件名なし)')`

    const [results, callMetrics] = await Promise.all([
        db
            .select({
                companyId: schema.companies.id,
                companyName: schema.companies.name,
                caseName: caseNameExpr,
                totalApplicants: sql<number>`count(${schema.applicants.id})`,
                uniqueApplicants: sql<number>`count(${schema.applicants.id}) - sum(case when ${statusIn(DUPLICATE_APPLICATION_STATUSES)} then 1 else 0 end)`,
                validApplicants: sql<number>`sum(coalesce(${schema.applicants.isValidApplicant},0))`,
                docDeclined: sql<number>`sum(case when ${statusIn(DOC_DECLINED_STATUSES)} then 1 else 0 end)`,
                docRejectedMK: sql<number>`sum(case when ${statusIn(DOC_REJECTED_MK_STATUSES)} then 1 else 0 end)`,
                docRejectedClient: sql<number>`sum(case when ${statusIn(DOC_REJECTED_CLIENT_STATUSES)} then 1 else 0 end)`,
                docRejected: sql<number>`sum(case when ${statusIn([...DOC_REJECTED_MK_STATUSES, ...DOC_REJECTED_CLIENT_STATUSES])} then 1 else 0 end)`,
                schedulingInterview: sql<number>`sum(case when ${statusIn(COMPANY_INTERVIEW_SCHEDULING_STATUSES)} then 1 else 0 end)`,
                interviewDeclinedBefore: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_DECLINED_BEFORE_STATUSES)} then 1 else 0 end)`,
                priScheduled: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
                priConducted: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted},0) = 1 then 1 else 0 end)`,
                priNoShow: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_NO_SHOW_STATUSES)} then 1 else 0 end)`,
                primaryDeclinedAfter: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_DECLINED_AFTER_STATUSES)} then 1 else 0 end)`,
                primaryRejected: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_REJECTED_STATUSES)} then 1 else 0 end)`,
                secScheduled: sql<number>`sum(case when ${schema.applicants.secScheduledDate} is not null then 1 else 0 end)`,
                secConducted: sql<number>`sum(case when coalesce(${schema.applicants.secConducted},0) = 1 then 1 else 0 end)`,
                secDeclinedBefore: sql<number>`sum(coalesce(${schema.applicants.secDeclinedBefore},0))`,
                secNoShow: sql<number>`sum(coalesce(${schema.applicants.secNoShow},0))`,
                secDeclinedAfter: sql<number>`sum(coalesce(${schema.applicants.secDeclinedAfter},0))`,
                secRejected: sql<number>`sum(coalesce(${schema.applicants.secRejected},0))`,
                finalScheduled: sql<number>`sum(case when ${schema.applicants.finalScheduledDate} is not null then 1 else 0 end)`,
                finalConducted: sql<number>`sum(case when coalesce(${schema.applicants.finalConducted},0) = 1 then 1 else 0 end)`,
                finalDeclinedBefore: sql<number>`sum(coalesce(${schema.applicants.finalDeclinedBefore},0))`,
                finalNoShow: sql<number>`sum(coalesce(${schema.applicants.finalNoShow},0))`,
                finalDeclinedAfter: sql<number>`sum(coalesce(${schema.applicants.finalDeclinedAfter},0))`,
                finalRejected: sql<number>`sum(coalesce(${schema.applicants.finalRejected},0))`,
                interviewScheduledCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
                interviewPlannedCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_PLANNED_STATUSES)} then 1 else 0 end)`,
                interviewConductedCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted},0) = 1 then 1 else 0 end)`,
                interviewConductedUniqueCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted},0) = 1 then 1 else 0 end)`,
                interviewDateSetCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null then 1 else 0 end)`,
                preInterviewDeclinedCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_DECLINED_BEFORE_STATUSES)} then 1 else 0 end)`,
                interviewNoShowCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_NO_SHOW_STATUSES)} then 1 else 0 end)`,
                interviewDeclinedAfterCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_DECLINED_AFTER_STATUSES)} then 1 else 0 end)`,
                interviewRejectedCount: sql<number>`sum(case when ${statusIn(PRIMARY_INTERVIEW_REJECTED_STATUSES)} then 1 else 0 end)`,
                phoneAppointmentCount: sql<number>`sum(case when ${statusIn(PHONE_APPOINTMENT_FIXED_STATUSES)} then 1 else 0 end)`,
                offered: sql<number>`sum(case when ${statusIn(OFFERED_STATUSES)} then 1 else 0 end)`,
                offerDeclined: sql<number>`sum(case when ${statusIn(OFFER_DECLINED_STATUSES)} then 1 else 0 end)`,
                joined: sql<number>`sum(case when ${statusIn(JOINED_STATUSES)} then 1 else 0 end)`,
            })
            .from(schema.companies)
            .where(companyWhereClause)
            .leftJoin(schema.applicants, applicantsJoinCondition)
            .groupBy(schema.companies.id, schema.companies.name, caseNameExpr)
            .orderBy(schema.companies.name),
        db
            .select({
                companyId: schema.companies.id,
                caseName: caseNameExpr,
                connectedApplicantCount: sql<number>`
                    sum(
                        case
                            when ${schema.applicants.connectedAt} is not null
                            then 1
                            else 0
                        end
                    )
                `,
                connectedValidApplicantCount: sql<number>`
                    sum(
                        case
                            when ${schema.applicants.connectedAt} is not null
                                and coalesce(${schema.applicants.isValidApplicant}, 0) = 1
                            then 1
                            else 0
                        end
                    )
                `,
                notConnectedCount: sql<number>`
                    sum(
                        case
                            when ${statusIn(NOT_CONNECTED_STATUSES)}
                            then 1
                            else 0
                        end
                    )
                `,
            })
            .from(schema.companies)
            .where(companyWhereClause)
            .leftJoin(schema.applicants, applicantsJoinCondition)
            .groupBy(schema.companies.id, caseNameExpr),
    ])

    const callMetricMap = new Map(
        callMetrics.map((row) => [
            `${row.companyId}::${row.caseName}`,
            {
                connectedApplicantCount: Number(row.connectedApplicantCount || 0),
                connectedValidApplicantCount: Number(row.connectedValidApplicantCount || 0),
                notConnectedCount: Number(row.notConnectedCount || 0),
            },
        ]),
    )

    return results
        .filter((row) => row.caseName !== null)
        .map((row) => {
            const caseName = row.caseName as string
            const validApplicants = Number(row.validApplicants || 0)
            const totalApplicants = Number(row.totalApplicants || 0)
            const key = `${row.companyId}::${caseName}`
            const connectedApplicantCount = callMetricMap.get(key)?.connectedApplicantCount || 0
            const connectedValidApplicantCount = callMetricMap.get(key)?.connectedValidApplicantCount || 0
            const notConnectedCount = callMetricMap.get(key)?.notConnectedCount || 0
            const interviewScheduledCount = Number(row.interviewScheduledCount || 0)
            const interviewDateSetCount = Number(row.interviewDateSetCount || 0)
            const interviewConductedUniqueCount = Number(row.interviewConductedUniqueCount || 0)
            const offered = Number(row.offered || 0)
            const offerDeclined = Number(row.offerDeclined || 0)
            const joined = Number(row.joined || 0)
            const offerPendingCount = Math.max(0, offered - (offerDeclined + joined))

            return {
                caseName,
                companyId: row.companyId,
                companyName: row.companyName,
                totalApplicants,
                uniqueApplicants: Number(row.uniqueApplicants || 0),
                validApplicants,
                validApplicantRate: formatRate(validApplicants, totalApplicants),
                connectedApplicantCount,
                connectedValidApplicantCount,
                notConnectedCount,
                phoneAppointmentCount: Number(row.phoneAppointmentCount || 0),
                docDeclined: Number(row.docDeclined || 0),
                docRejectedMK: Number(row.docRejectedMK || 0),
                docRejectedClient: Number(row.docRejectedClient || 0),
                docRejected: Number(row.docRejected || 0),
                schedulingInterview: Number(row.schedulingInterview || 0),
                interviewDeclinedBefore: Number(row.interviewDeclinedBefore || 0),
                priScheduled: Number(row.priScheduled || 0),
                priConducted: Number(row.priConducted || 0),
                priNoShow: Number(row.priNoShow || 0),
                primaryDeclinedAfter: Number(row.primaryDeclinedAfter || 0),
                primaryRejected: Number(row.primaryRejected || 0),
                secScheduled: Number(row.secScheduled || 0),
                secConducted: Number(row.secConducted || 0),
                secDeclinedBefore: Number(row.secDeclinedBefore || 0),
                secNoShow: Number(row.secNoShow || 0),
                secDeclinedAfter: Number(row.secDeclinedAfter || 0),
                secRejected: Number(row.secRejected || 0),
                finalScheduled: Number(row.finalScheduled || 0),
                finalConducted: Number(row.finalConducted || 0),
                finalDeclinedBefore: Number(row.finalDeclinedBefore || 0),
                finalNoShow: Number(row.finalNoShow || 0),
                finalDeclinedAfter: Number(row.finalDeclinedAfter || 0),
                finalRejected: Number(row.finalRejected || 0),
                interviewScheduledCount,
                interviewPlannedCount: Number(row.interviewPlannedCount || 0),
                interviewConductedCount: Number(row.interviewConductedCount || 0),
                interviewConductedUniqueCount,
                interviewDateSetCount,
                preInterviewDeclinedCount: Number(row.preInterviewDeclinedCount || 0),
                interviewNoShowCount: Number(row.interviewNoShowCount || 0),
                interviewDeclinedAfterCount: Number(row.interviewDeclinedAfterCount || 0),
                interviewRejectedCount: Number(row.interviewRejectedCount || 0),
                offered,
                offerPendingCount,
                offerDeclined,
                joined,
                connectedApplicantRate: formatRate(connectedValidApplicantCount, validApplicants),
                interviewScheduledRate: formatRate(interviewScheduledCount, validApplicants),
                interviewConductedRate: formatRate(interviewConductedUniqueCount, validApplicants),
                offerRate: formatRate(offered, validApplicants),
                joinRate: formatRate(joined, validApplicants),
                preInterviewDeclineRate: formatRate(Number(row.preInterviewDeclinedCount || 0), interviewDateSetCount),
                offerDeclineRate: formatRate(offerDeclined, offered),
            }
        }) as CaseYieldRow[]
}

export async function getApplicantAppliedYears() {
    const appliedYearExpr = sql<string>`strftime('%Y', ${schema.applicants.appliedAt}, 'unixepoch')`
    const rows = await db
        .select({
            year: appliedYearExpr,
        })
        .from(schema.applicants)
        .groupBy(appliedYearExpr)
        .orderBy(desc(appliedYearExpr))

    const currentYear = new Date().getFullYear()
    const years = rows
        .map((row) => Number.parseInt(row.year, 10))
        .filter((value) => Number.isFinite(value))

    return Array.from(new Set([currentYear, ...years])).sort((a, b) => b - a)
}
