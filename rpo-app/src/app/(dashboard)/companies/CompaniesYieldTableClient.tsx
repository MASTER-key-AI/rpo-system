"use client"

import Link from "next/link"
import { useMemo } from "react"

type CompanyYieldRow = {
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
    schedulingInterview: number
    interviewScheduledCount: number
    interviewDeclinedBefore: number
    interviewNoShowCount: number
    interviewPlannedCount: number
    interviewConductedCount: number
    interviewDeclinedAfterCount: number
    interviewRejectedCount: number
    secScheduled: number
    secDeclinedBefore: number
    secNoShow: number
    secConducted: number
    secDeclinedAfter: number
    secRejected: number
    finalScheduled: number
    finalDeclinedBefore: number
    finalNoShow: number
    finalConducted: number
    finalDeclinedAfter: number
    finalRejected: number
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

type CompanyGroupWithMembers = {
    id: string
    name: string
    memberCompanyIds: string[]
}

type Props = {
    yields: CompanyYieldRow[]
    companyId?: string
    groups?: CompanyGroupWithMembers[]
}

type DisplayRow =
    | { type: "summary", row: CompanyYieldRow }
    | { type: "group-parent", groupId: string, row: CompanyYieldRow }
    | { type: "normal", row: CompanyYieldRow }

type Column = {
    key: keyof CompanyYieldRow
    label: string
}

const COLUMNS: Column[] = [
    { key: "totalApplicants", label: "応募数" },
    { key: "uniqueApplicants", label: "ユニーク応募数" },
    { key: "validApplicants", label: "有効応募数" },
    { key: "notConnectedCount", label: "不通数" },
    { key: "connectedApplicantCount", label: "通電数" },
    { key: "docDeclined", label: "書類選考中辞退数" },
    { key: "docRejectedMK", label: "書類不採用(MK判断)" },
    { key: "docRejectedClient", label: "書類不採用(クライアント判断)" },
    { key: "schedulingInterview", label: "企業面接日程調整中数" },
    { key: "interviewScheduledCount", label: "面接設定数" },
    { key: "interviewDeclinedBefore", label: "面接前辞退数" },
    { key: "interviewNoShowCount", label: "面接飛び数" },
    { key: "interviewPlannedCount", label: "面接予定数" },
    { key: "interviewConductedCount", label: "面接実施数" },
    { key: "interviewDeclinedAfterCount", label: "面接後辞退数" },
    { key: "interviewRejectedCount", label: "面接不採用数" },
    { key: "secScheduled", label: "二次面接設定数" },
    { key: "secDeclinedBefore", label: "二次面接前辞退数" },
    { key: "secNoShow", label: "二次面接飛び数" },
    { key: "secConducted", label: "二次面接実施数" },
    { key: "secDeclinedAfter", label: "二次面接後辞退数" },
    { key: "secRejected", label: "二次面接不採用数" },
    { key: "finalScheduled", label: "最終面接設定数" },
    { key: "finalDeclinedBefore", label: "最終面接前辞退数" },
    { key: "finalNoShow", label: "最終面接飛び数" },
    { key: "finalConducted", label: "最終面接実施数" },
    { key: "finalDeclinedAfter", label: "最終面接後辞退数" },
    { key: "finalRejected", label: "最終面接不採用数" },
    { key: "offered", label: "内定数" },
    { key: "offerDeclined", label: "内定後/入社前辞退数" },
    { key: "joined", label: "入社数" },
    { key: "connectedApplicantRate", label: "有効応募からの通電率" },
    { key: "interviewScheduledRate", label: "有効応募からの面接設定率" },
    { key: "interviewConductedRate", label: "有効応募からの着席率" },
    { key: "offerRate", label: "有効応募からの内定率" },
    { key: "joinRate", label: "有効応募からの入社率" },
    { key: "preInterviewDeclineRate", label: "面接前辞退率" },
    { key: "offerDeclineRate", label: "内定後辞退率" },
    { key: "validApplicantRate", label: "有効応募率" },
]

const NUMERIC_KEYS: Array<keyof CompanyYieldRow> = [
    "totalApplicants",
    "uniqueApplicants",
    "validApplicants",
    "connectedApplicantCount",
    "notConnectedCount",
    "docDeclined",
    "docRejectedMK",
    "docRejectedClient",
    "schedulingInterview",
    "interviewDeclinedBefore",
    "interviewScheduledCount",
    "interviewPlannedCount",
    "interviewConductedCount",
    "interviewNoShowCount",
    "interviewDeclinedAfterCount",
    "interviewRejectedCount",
    "secScheduled",
    "secDeclinedBefore",
    "secNoShow",
    "secConducted",
    "secDeclinedAfter",
    "secRejected",
    "finalScheduled",
    "finalDeclinedBefore",
    "finalNoShow",
    "finalConducted",
    "finalDeclinedAfter",
    "finalRejected",
    "offered",
    "offerDeclined",
    "joined",
]

export default function CompaniesYieldTableClient({ yields, companyId, groups = [] }: Props) {
    const displayRows = useMemo<DisplayRow[]>(() => {
        if (companyId) {
            return yields
                .slice()
                .sort((a, b) => a.companyName.localeCompare(b.companyName, "ja"))
                .map((row): DisplayRow => ({ type: "normal", row }))
        }

        const summary = createSummaryRow(yields, `全企業累計（${yields.length}社）`)
        const rows: DisplayRow[] = [{ type: "summary", row: summary }]

        // グループに属する企業IDを収集
        const groupedCompanyIds = new Set<string>()
        for (const group of groups) {
            for (const cid of group.memberCompanyIds) {
                groupedCompanyIds.add(cid)
            }
        }

        // 各グループの集約行を生成
        for (const group of groups) {
            const memberYields = yields.filter((row) => group.memberCompanyIds.includes(row.companyId))
            if (memberYields.length > 0) {
                const groupSummary = createSummaryRow(memberYields, `${group.name} (${memberYields.length}社)`)
                rows.push({ type: "group-parent", groupId: group.id, row: groupSummary })
            }
        }

        // グループに属さない企業を通常行として表示
        const ungroupedRows = yields
            .filter((row) => !groupedCompanyIds.has(row.companyId))
            .sort((a, b) => a.companyName.localeCompare(b.companyName, "ja"))
        rows.push(...ungroupedRows.map((row): DisplayRow => ({ type: "normal", row })))

        return rows
    }, [yields, companyId, groups])

    if (displayRows.length === 0) {
        return (
            <div className="bg-card rounded-xl border border-border shadow-card p-6 text-sm text-muted-foreground">
                該当する企業データがありません
            </div>
        )
    }

    return (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <div className="w-full overflow-auto max-h-[75vh]">
                <table className="w-full whitespace-nowrap text-sm">
                    <thead className="sticky top-0 z-20 bg-muted/40 border-b border-border">
                        <tr>
                            <th className="px-4 py-3 text-left sticky left-0 z-30 bg-muted/95 backdrop-blur min-w-[200px] border-r border-border/50">企業名</th>
                            {COLUMNS.map((column) => (
                                <th key={column.key} className="px-3 py-3 text-center">
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((item) => {
                            const baseClass =
                                item.type === "summary"
                                    ? "bg-primary/5 font-semibold"
                                    : item.type === "group-parent"
                                        ? "bg-amber-50/60 font-semibold"
                                        : "hover:bg-muted/30"

                            return (
                                <tr
                                    key={`${item.type}-${item.row.companyId}-${item.row.companyName}`}
                                    className={`${baseClass} border-b border-border/50`}
                                >
                                    <td className="px-4 py-2 sticky left-0 z-10 bg-background/95 backdrop-blur min-w-[200px] border-r border-border/50">
                                        {item.type === "group-parent" ? (
                                            <Link href={`/companies/groups/${item.groupId}`} className="text-primary hover:underline">
                                                {item.row.companyName}
                                            </Link>
                                        ) : item.type === "summary" ? (
                                            <span>{item.row.companyName}</span>
                                        ) : (
                                            <Link
                                                href={`/applicants?companyId=${item.row.companyId}`}
                                                className="text-primary hover:underline"
                                            >
                                                {item.row.companyName}
                                            </Link>
                                        )}
                                    </td>
                                    {COLUMNS.map((column) => (
                                        <td key={`${item.row.companyId}-${column.key}`} className="px-3 py-2 text-center">
                                            {String(item.row[column.key])}
                                        </td>
                                    ))}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function createSummaryRow(rows: CompanyYieldRow[], companyName: string): CompanyYieldRow {
    const total = rows.reduce<CompanyYieldRow>(
        (acc, row) => {
            for (const key of NUMERIC_KEYS) {
                const current = (acc as Record<string, unknown>)[key] as number
                const next = (row as Record<string, unknown>)[key] as number
                ;(acc as Record<string, unknown>)[key] = current + next
            }
            return acc
        },
        {
            companyId: `summary-${companyName}`,
            companyName,
            totalApplicants: 0,
            uniqueApplicants: 0,
            validApplicants: 0,
            validApplicantRate: "0.0% (0/0)",
            connectedApplicantCount: 0,
            notConnectedCount: 0,
            docDeclined: 0,
            docRejectedMK: 0,
            docRejectedClient: 0,
            schedulingInterview: 0,
            interviewScheduledCount: 0,
            interviewDeclinedBefore: 0,
            interviewNoShowCount: 0,
            interviewPlannedCount: 0,
            interviewConductedCount: 0,
            interviewDeclinedAfterCount: 0,
            interviewRejectedCount: 0,
            secScheduled: 0,
            secDeclinedBefore: 0,
            secNoShow: 0,
            secConducted: 0,
            secDeclinedAfter: 0,
            secRejected: 0,
            finalScheduled: 0,
            finalDeclinedBefore: 0,
            finalNoShow: 0,
            finalConducted: 0,
            finalDeclinedAfter: 0,
            finalRejected: 0,
            offered: 0,
            offerDeclined: 0,
            joined: 0,
            connectedApplicantRate: "0.0% (0/0)",
            interviewScheduledRate: "0.0% (0/0)",
            interviewConductedRate: "0.0% (0/0)",
            offerRate: "0.0% (0/0)",
            joinRate: "0.0% (0/0)",
            preInterviewDeclineRate: "0.0% (0/0)",
            offerDeclineRate: "0.0% (0/0)",
        },
    )

    total.connectedApplicantRate = toRate(total.connectedApplicantCount, total.validApplicants)
    total.interviewScheduledRate = toRate(total.interviewScheduledCount, total.validApplicants)
    total.interviewConductedRate = toRate(total.interviewConductedCount, total.validApplicants)
    total.offerRate = toRate(total.offered, total.validApplicants)
    total.joinRate = toRate(total.joined, total.validApplicants)
    total.preInterviewDeclineRate = toRate(total.interviewDeclinedBefore, total.interviewScheduledCount)
    total.offerDeclineRate = toRate(total.offerDeclined, total.offered)
    total.validApplicantRate = toRate(total.validApplicants, total.totalApplicants)

    return total
}

function toRate(numerator: number, denominator: number) {
    if (denominator <= 0) return "0.0% (0/0)"
    const percent = (numerator / denominator) * 100
    return `${percent.toFixed(1)}% (${numerator}/${denominator})`
}
