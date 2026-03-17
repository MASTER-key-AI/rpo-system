"use server";

import { db, schema } from "@/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

export type CompanyYieldRow = {
    companyId: string
    companyName: string
    totalApplicants: number
    uniqueApplicants: number
    validApplicants: number
    validApplicantRate: string
    connectedApplicantCount: number
    notConnectedCount: number
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
    interviewScheduledCount: number
    interviewConductedCount: number
    offered: number
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

type BaseDateFilter = {
    year: number | undefined
    month: number | undefined
}

function normalizeDateFilter(year: number | undefined, month: number | undefined): BaseDateFilter {
    const yearValue = year && Number.isFinite(year) ? Math.floor(year) : undefined
    const monthValue = month && Number.isFinite(month) ? Math.floor(month) : undefined
    const safeMonth = monthValue && monthValue >= 1 && monthValue <= 12 ? monthValue : undefined
    return { year: yearValue, month: safeMonth }
}

function buildAppliedTimeFilter({ year, month }: BaseDateFilter) {
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
    },
) {
    // NOTE: `event` filtering is reserved for future support.
    void dateType

    const filter = normalizeDateFilter(year, month)
    const timeFilter = buildAppliedTimeFilter(filter)
    const targetCompanyId = options?.companyId?.trim()
    const targetCompanyIds = options?.companyIds?.length ? options.companyIds : undefined

    const companyWhereClause = targetCompanyId
        ? eq(schema.companies.id, targetCompanyId)
        : targetCompanyIds
            ? inArray(schema.companies.id, targetCompanyIds)
            : undefined

    const applicantsJoinCondition = companyWhereClause
        ? and(
            eq(schema.companies.id, schema.applicants.companyId),
            timeFilter,
            companyWhereClause,
        )
        : and(
            eq(schema.companies.id, schema.applicants.companyId),
            timeFilter,
        )

    const [results, callMetrics] = await Promise.all([
        db
            .select({
                companyId: schema.companies.id,
                companyName: schema.companies.name,
                totalApplicants: sql<number>`count(${schema.applicants.id})`,
                uniqueApplicants: sql<number>`sum(coalesce(${schema.applicants.isUniqueApplicant},0))`,
                validApplicants: sql<number>`sum(coalesce(${schema.applicants.isValidApplicant},0))`,
                docDeclined: sql<number>`sum(coalesce(${schema.applicants.docDeclined},0))`,
                docRejectedMK: sql<number>`sum(coalesce(${schema.applicants.docRejectedMK},0))`,
                docRejectedClient: sql<number>`sum(coalesce(${schema.applicants.docRejectedClient},0))`,
                docRejected: sql<number>`sum(coalesce(${schema.applicants.docRejectedMK},0) + coalesce(${schema.applicants.docRejectedClient},0))`,
                schedulingInterview: sql<number>`sum(coalesce(${schema.applicants.schedulingInterview},0))`,
                interviewDeclinedBefore: sql<number>`sum(coalesce(${schema.applicants.interviewDeclinedBefore},0) + coalesce(${schema.applicants.secDeclinedBefore},0) + coalesce(${schema.applicants.finalDeclinedBefore},0))`,
                priScheduled: sql<number>`sum(coalesce(${schema.applicants.primaryScheduled},0))`,
                priConducted: sql<number>`sum(coalesce(${schema.applicants.primaryConducted},0))`,
                priNoShow: sql<number>`sum(coalesce(${schema.applicants.primaryNoShow},0))`,
                primaryDeclinedAfter: sql<number>`sum(coalesce(${schema.applicants.primaryDeclinedAfter},0))`,
                primaryRejected: sql<number>`sum(coalesce(${schema.applicants.primaryRejected},0))`,
                secScheduled: sql<number>`sum(coalesce(${schema.applicants.secScheduled},0))`,
                secConducted: sql<number>`sum(coalesce(${schema.applicants.secConducted},0))`,
                secDeclinedBefore: sql<number>`sum(coalesce(${schema.applicants.secDeclinedBefore},0))`,
                secNoShow: sql<number>`sum(coalesce(${schema.applicants.secNoShow},0))`,
                secDeclinedAfter: sql<number>`sum(coalesce(${schema.applicants.secDeclinedAfter},0))`,
                secRejected: sql<number>`sum(coalesce(${schema.applicants.secRejected},0))`,
                finalScheduled: sql<number>`sum(coalesce(${schema.applicants.finalScheduled},0))`,
                finalConducted: sql<number>`sum(coalesce(${schema.applicants.finalConducted},0))`,
                finalDeclinedBefore: sql<number>`sum(coalesce(${schema.applicants.finalDeclinedBefore},0))`,
                finalNoShow: sql<number>`sum(coalesce(${schema.applicants.finalNoShow},0))`,
                finalDeclinedAfter: sql<number>`sum(coalesce(${schema.applicants.finalDeclinedAfter},0))`,
                finalRejected: sql<number>`sum(coalesce(${schema.applicants.finalRejected},0))`,
                interviewScheduledCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryScheduled}, 0) = 1 or coalesce(${schema.applicants.secScheduled}, 0) = 1 or coalesce(${schema.applicants.finalScheduled}, 0) = 1 then 1 else 0 end)`,
                interviewPlannedCount: sql<number>`sum(coalesce(${schema.applicants.primaryScheduled},0) + coalesce(${schema.applicants.secScheduled},0) + coalesce(${schema.applicants.finalScheduled},0))`,
                interviewConductedCount: sql<number>`sum(coalesce(${schema.applicants.primaryConducted},0) + coalesce(${schema.applicants.secConducted},0) + coalesce(${schema.applicants.finalConducted},0))`,
                interviewConductedUniqueCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted}, 0) = 1 or coalesce(${schema.applicants.secConducted}, 0) = 1 or coalesce(${schema.applicants.finalConducted}, 0) = 1 then 1 else 0 end)`,
                interviewDateSetCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null or ${schema.applicants.secScheduledDate} is not null or ${schema.applicants.finalScheduledDate} is not null then 1 else 0 end)`,
                preInterviewDeclinedCount: sql<number>`sum(case when coalesce(${schema.applicants.interviewDeclinedBefore}, 0) = 1 or coalesce(${schema.applicants.secDeclinedBefore}, 0) = 1 or coalesce(${schema.applicants.finalDeclinedBefore}, 0) = 1 then 1 else 0 end)`,
                interviewNoShowCount: sql<number>`sum(coalesce(${schema.applicants.primaryNoShow},0) + coalesce(${schema.applicants.secNoShow},0) + coalesce(${schema.applicants.finalNoShow},0))`,
                interviewDeclinedAfterCount: sql<number>`sum(coalesce(${schema.applicants.primaryDeclinedAfter},0) + coalesce(${schema.applicants.secDeclinedAfter},0) + coalesce(${schema.applicants.finalDeclinedAfter},0))`,
                interviewRejectedCount: sql<number>`sum(coalesce(${schema.applicants.primaryRejected},0) + coalesce(${schema.applicants.secRejected},0) + coalesce(${schema.applicants.finalRejected},0))`,
                offered: sql<number>`sum(coalesce(${schema.applicants.offered},0))`,
                offerDeclined: sql<number>`sum(coalesce(${schema.applicants.offerDeclined},0))`,
                joined: sql<number>`sum(coalesce(${schema.applicants.joined},0))`,
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
                    count(
                        distinct case
                            when coalesce(${schema.callLogs.isConnected}, 0) = 1
                                and coalesce(${schema.applicants.isValidApplicant}, 0) = 1
                            then ${schema.callLogs.applicantId}
                            end
                    )
                `,
                notConnectedCount: sql<number>`
                    count(
                        distinct case
                            when coalesce(${schema.callLogs.isConnected}, 0) = 0
                                and coalesce(${schema.applicants.isValidApplicant}, 0) = 1
                            then ${schema.callLogs.applicantId}
                            end
                    )
                `,
            })
            .from(schema.companies)
            .where(companyWhereClause)
            .leftJoin(schema.applicants, applicantsJoinCondition)
            .leftJoin(schema.callLogs, eq(schema.callLogs.applicantId, schema.applicants.id))
            .groupBy(schema.companies.id),
    ])

    const callMetricMap = new Map(
        callMetrics.map((row) => [
            row.companyId,
            {
                connectedApplicantCount: Number(row.connectedApplicantCount || 0),
                notConnectedCount: Number(row.notConnectedCount || 0),
            },
        ]),
    )

    return results.map((row) => {
        const validApplicants = Number(row.validApplicants || 0)
        const totalApplicants = Number(row.totalApplicants || 0)
        const connectedApplicantCount = callMetricMap.get(row.companyId)?.connectedApplicantCount || 0
        const notConnectedCount = callMetricMap.get(row.companyId)?.notConnectedCount || 0
        const interviewScheduledCount = Number(row.interviewScheduledCount || 0)
        const interviewDateSetCount = Number(row.interviewDateSetCount || 0)
        const interviewConductedUniqueCount = Number(row.interviewConductedUniqueCount || 0)
        const offered = Number(row.offered || 0)
        const offerDeclined = Number(row.offerDeclined || 0)
        const joined = Number(row.joined || 0)

        return {
            companyId: row.companyId,
            companyName: row.companyName,
            totalApplicants,
            uniqueApplicants: Number(row.uniqueApplicants || 0),
            validApplicants,
            validApplicantRate: formatRate(validApplicants, totalApplicants),
            connectedApplicantCount,
            notConnectedCount,
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

export async function getCompanyMonthlyTotals(year: number | undefined) {
    const normalizedYear = normalizeDateFilter(year, undefined).year
    const filter = buildAppliedTimeFilter({ year: normalizedYear, month: undefined })
    const monthExpr = sql<string>`strftime('%m', ${schema.applicants.appliedAt}, 'unixepoch')`

    const [baseRows, callMetricRows] = await Promise.all([
        db
            .select({
                month: monthExpr,
                totalApplicants: sql<number>`count(${schema.applicants.id})`,
                uniqueApplicants: sql<number>`sum(coalesce(${schema.applicants.isUniqueApplicant},0))`,
                validApplicants: sql<number>`sum(coalesce(${schema.applicants.isValidApplicant},0))`,
                interviewScheduledCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryScheduled}, 0) = 1 or coalesce(${schema.applicants.secScheduled}, 0) = 1 or coalesce(${schema.applicants.finalScheduled}, 0) = 1 then 1 else 0 end)`,
                interviewConductedCount: sql<number>`sum(case when coalesce(${schema.applicants.primaryConducted}, 0) = 1 or coalesce(${schema.applicants.secConducted}, 0) = 1 or coalesce(${schema.applicants.finalConducted}, 0) = 1 then 1 else 0 end)`,
                offered: sql<number>`sum(coalesce(${schema.applicants.offered},0))`,
                joined: sql<number>`sum(coalesce(${schema.applicants.joined},0))`,
                preInterviewDeclinedCount: sql<number>`sum(case when coalesce(${schema.applicants.interviewDeclinedBefore}, 0) = 1 or coalesce(${schema.applicants.secDeclinedBefore}, 0) = 1 or coalesce(${schema.applicants.finalDeclinedBefore}, 0) = 1 then 1 else 0 end)`,
                offerDeclined: sql<number>`sum(coalesce(${schema.applicants.offerDeclined},0))`,
                interviewDateSetCount: sql<number>`sum(case when ${schema.applicants.primaryScheduledDate} is not null or ${schema.applicants.secScheduledDate} is not null or ${schema.applicants.finalScheduledDate} is not null then 1 else 0 end)`,
            })
            .from(schema.applicants)
            .where(filter)
            .groupBy(monthExpr)
            .orderBy(monthExpr),
        db
            .select({
                month: monthExpr,
                connectedApplicantCount: sql<number>`
                    count(
                        distinct case
                            when coalesce(${schema.callLogs.isConnected}, 0) = 1
                                and coalesce(${schema.applicants.isValidApplicant}, 0) = 1
                            then ${schema.callLogs.applicantId}
                            end
                    )
                `,
                notConnectedCount: sql<number>`
                    count(
                        distinct case
                            when coalesce(${schema.callLogs.isConnected}, 0) = 0
                                and coalesce(${schema.applicants.isValidApplicant}, 0) = 1
                            then ${schema.callLogs.applicantId}
                            end
                    )
                `,
            })
            .from(schema.applicants)
            .leftJoin(schema.callLogs, eq(schema.callLogs.applicantId, schema.applicants.id))
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
                notConnectedCount: Number(row.notConnectedCount || 0),
            },
        ]),
    )

    const months = Array.from({ length: 12 }, (_, index) => index + 1)
    return months.map((month) => {
        const base = baseMap.get(month) || {
            totalApplicants: 0,
            uniqueApplicants: 0,
            validApplicants: 0,
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
            notConnectedCount: 0,
        }

        return {
            month,
            totalApplicants: base.totalApplicants,
            uniqueApplicants: base.uniqueApplicants,
            validApplicants: base.validApplicants,
            validApplicantRate: formatRate(base.validApplicants, base.totalApplicants),
            connectedApplicantCount: callMetric.connectedApplicantCount,
            notConnectedCount: callMetric.notConnectedCount,
            interviewScheduledCount: base.interviewScheduledCount,
            interviewConductedCount: base.interviewConductedCount,
            offered: base.offered,
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
