"use client"

import Link from "next/link"
import { Fragment, useMemo, useState } from "react"
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react"
import type { CaseYieldRow } from "@/lib/actions/yields"

type CompanyYieldRow = {
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

type SheetEntry = {
    spreadsheetId: string
    gid: number
    sheetName: string | null
}


type Props = {
    yields: CompanyYieldRow[]
    companyId?: string
    sheetMap?: Record<string, SheetEntry>
    caseYields?: CaseYieldRow[]
}

type DisplayRow =
    | { key: string; type: "summary"; row: CompanyYieldRow }
    | { key: string; type: "company-parent"; groupKey: string; row: CompanyYieldRow }
    | { key: string; type: "company-child"; groupKey: string; branchLabel: string; row: CompanyYieldRow }
    | { key: string; type: "normal"; row: CompanyYieldRow }

type Column = {
    key: keyof CompanyYieldRow
    label: string
}

const COLUMNS: Column[] = [
    { key: "totalApplicants", label: "応募数" },
    { key: "uniqueApplicants", label: "ユニーク応募数" },
    { key: "validApplicants", label: "有効応募数" },
    { key: "notConnectedCount", label: "不通数" },
    { key: "phoneAppointmentCount", label: "電話予定数" },
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
    { key: "offerPendingCount", label: "内定承諾待ち" },
    { key: "offerDeclined", label: "内定後/入社前辞退数" },
    { key: "joined", label: "入社数" },
    { key: "connectedApplicantRate", label: "有効応募からの通電率" },
    { key: "interviewScheduledRate", label: "有効応募からの面接設定率" },
    { key: "interviewConductedRate", label: "有効応募からの着席率" },
    { key: "offerRate", label: "有効応募からの内定率" },
    { key: "joinRate", label: "有効応募からの入社率" },
    { key: "preInterviewDeclineRate", label: "面接前辞退率" },
    { key: "offerDeclineRate", label: "内定後/入社前辞退率" },
    { key: "validApplicantRate", label: "有効応募率" },
]

const NUMERIC_KEYS: Array<keyof CompanyYieldRow> = [
    "totalApplicants",
    "uniqueApplicants",
    "validApplicants",
    "connectedApplicantCount",
    "connectedValidApplicantCount",
    "notConnectedCount",
    "phoneAppointmentCount",
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
    "offerPendingCount",
    "offerDeclined",
    "joined",
]

export default function CompaniesYieldTableClient({ yields, companyId, sheetMap = {}, caseYields = [] }: Props) {
    const [expandedCompanyIds, setExpandedCompanyIds] = useState<Set<string>>(new Set())
    const [expandedGroupKeys, setExpandedGroupKeys] = useState<Set<string>>(new Set())

    const caseYieldsByCompany = useMemo(() => {
        const map = new Map<string, CaseYieldRow[]>()
        for (const row of caseYields) {
            const existing = map.get(row.companyId) ?? []
            existing.push(row)
            map.set(row.companyId, existing)
        }
        return map
    }, [caseYields])

    const toggleCompany = (id: string) => {
        setExpandedCompanyIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const toggleCompanyGroup = (groupKey: string) => {
        setExpandedGroupKeys((prev) => {
            const next = new Set(prev)
            if (next.has(groupKey)) {
                next.delete(groupKey)
            } else {
                next.add(groupKey)
            }
            return next
        })
    }

    const displayRows = useMemo<DisplayRow[]>(() => {
        const sortedYields = yields
            .slice()
            .sort((a, b) => a.companyName.localeCompare(b.companyName, "ja"))

        if (companyId) {
            return sortedYields.map((row): DisplayRow => ({
                key: `company-${row.companyId}`,
                type: "normal",
                row,
            }))
        }

        const rows: DisplayRow[] = [
            {
                key: "summary",
                type: "summary",
                row: createSummaryRow(sortedYields, `全企業累計（${sortedYields.length}社）`),
            },
        ]

        const groupedByBase = new Map<string, Array<{ row: CompanyYieldRow; branchName: string | null }>>()
        for (const row of sortedYields) {
            const { baseName, branchName } = splitCompanyName(row.companyName)
            const existing = groupedByBase.get(baseName) ?? []
            existing.push({ row, branchName })
            groupedByBase.set(baseName, existing)
        }

        const sortedGroupKeys = Array.from(groupedByBase.keys()).sort((a, b) => a.localeCompare(b, "ja"))
        for (const groupKey of sortedGroupKeys) {
            const members = groupedByBase.get(groupKey) ?? []
            if (members.length <= 1) {
                const single = members[0]
                if (single) {
                    rows.push({
                        key: `company-${single.row.companyId}`,
                        type: "normal",
                        row: single.row,
                    })
                }
                continue
            }

            const parentSummary = createSummaryRow(
                members.map((member) => member.row),
                `${groupKey}（${members.length}拠点）`,
            )
            rows.push({
                key: `parent-${groupKey}`,
                type: "company-parent",
                groupKey,
                row: parentSummary,
            })

            if (!expandedGroupKeys.has(groupKey)) {
                continue
            }

            const sortedMembers = members
                .slice()
                .sort((a, b) => a.row.companyName.localeCompare(b.row.companyName, "ja"))
            for (const member of sortedMembers) {
                rows.push({
                    key: `child-${groupKey}-${member.row.companyId}`,
                    type: "company-child",
                    groupKey,
                    branchLabel: member.branchName || member.row.companyName,
                    row: member.row,
                })
            }
        }

        return rows
    }, [yields, companyId, expandedGroupKeys])

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
                            <th className="px-3 py-3 text-left sticky left-0 z-30 bg-muted/95 backdrop-blur min-w-[180px] max-w-[210px] border-r border-border/50 whitespace-normal break-words leading-snug">企業名 / 案件名</th>
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
                                    : item.type === "company-parent"
                                        ? "bg-emerald-50/60 dark:bg-emerald-950/10 font-semibold"
                                        : item.type === "company-child"
                                            ? "bg-muted/15 hover:bg-muted/30"
                                            : "hover:bg-muted/30"

                            const hasCases =
                                (item.type === "normal" || item.type === "company-child") &&
                                (caseYieldsByCompany.get(item.row.companyId)?.length ?? 0) > 0
                            const isExpanded = expandedCompanyIds.has(item.row.companyId)
                            const caseRows = hasCases ? (caseYieldsByCompany.get(item.row.companyId) ?? []) : []
                            const stickyCellClass =
                                item.type === "summary"
                                    ? "bg-primary/5"
                                    : item.type === "company-parent"
                                        ? "bg-emerald-50/80 dark:bg-emerald-950/20"
                                        : item.type === "company-child"
                                            ? "bg-muted/20"
                                            : "bg-background/95"
                            const caseIndentClass = item.type === "company-child" ? "pl-12" : "pl-8"

                            return (
                                <Fragment key={item.key}>
                                    <tr
                                        className={`${baseClass} border-b border-border/50`}
                                    >
                                        <td className={`px-3 py-2 sticky left-0 z-10 backdrop-blur min-w-[180px] max-w-[210px] border-r border-border/50 whitespace-normal break-words ${stickyCellClass}`}>
                                            {item.type === "company-parent" ? (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCompanyGroup(item.groupKey)}
                                                    className="flex items-start gap-1.5 w-full text-left text-primary hover:underline cursor-pointer"
                                                    title={expandedGroupKeys.has(item.groupKey) ? "支店一覧を折りたたむ" : "支店一覧を展開する"}
                                                >
                                                    {expandedGroupKeys.has(item.groupKey)
                                                        ? <ChevronDown className="w-4 h-4" />
                                                        : <ChevronRight className="w-4 h-4" />
                                                    }
                                                    <span className="whitespace-normal break-words leading-snug">{item.row.companyName}</span>
                                                </button>
                                            ) : item.type === "summary" ? (
                                                <span className="whitespace-normal break-words leading-snug">{item.row.companyName}</span>
                                            ) : (
                                                <span className={`flex items-start gap-1 ${item.type === "company-child" ? "pl-4" : ""}`}>
                                                    {hasCases ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCompany(item.row.companyId)}
                                                            className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors duration-150"
                                                            title={isExpanded ? "案件名を折りたたむ" : "案件名を展開する"}
                                                        >
                                                            {isExpanded
                                                                ? <ChevronDown className="w-3.5 h-3.5" />
                                                                : <ChevronRight className="w-3.5 h-3.5" />
                                                            }
                                                        </button>
                                                    ) : (
                                                        <span className="shrink-0 w-5" />
                                                    )}
                                                    <Link
                                                        href={`/applicants?companyId=${item.row.companyId}`}
                                                        className="text-primary hover:underline whitespace-normal break-words leading-snug"
                                                    >
                                                        {item.type === "company-child" ? item.branchLabel : item.row.companyName}
                                                    </Link>
                                                    {sheetMap[item.row.companyId] && (
                                                        <a
                                                            href={`https://docs.google.com/spreadsheets/d/${sheetMap[item.row.companyId].spreadsheetId}/edit#gid=${sheetMap[item.row.companyId].gid}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            title={`${item.row.companyName} のスプレッドシートを開く`}
                                                            className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors duration-150"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                        </a>
                                                    )}
                                                </span>
                                            )}
                                        </td>
                                        {COLUMNS.map((column) => (
                                            <td key={`${item.row.companyId}-${column.key}`} className="px-3 py-2 text-center">
                                                {String(item.row[column.key])}
                                            </td>
                                        ))}
                                    </tr>
                                    {hasCases && isExpanded && caseRows.map((caseRow, caseIndex) => (
                                        <tr
                                            key={`case-${item.row.companyId}-${caseRow.caseName}-${caseIndex}`}
                                            className="border-b border-border/30 bg-sky-50/40 hover:bg-sky-50/70"
                                        >
                                            <td className="py-1.5 sticky left-0 z-10 bg-sky-50/60 backdrop-blur min-w-[180px] max-w-[210px] border-r border-border/30">
                                                <span className={`inline-flex items-center gap-1.5 pr-2 ${caseIndentClass}`}>
                                                    <span className="text-[11px] font-medium text-sky-700 bg-sky-100 rounded px-1.5 py-0.5 max-w-[160px] truncate" title={caseRow.caseName}>
                                                        {caseRow.caseName}
                                                    </span>
                                                </span>
                                            </td>
                                            {COLUMNS.map((column) => (
                                                <td key={`case-${item.row.companyId}-${caseRow.caseName}-${column.key}`} className="px-3 py-1.5 text-center text-[12px] text-muted-foreground">
                                                    {String((caseRow as Record<string, unknown>)[column.key] ?? "")}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </Fragment>
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
            connectedValidApplicantCount: 0,
            notConnectedCount: 0,
            phoneAppointmentCount: 0,
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
            offerPendingCount: 0,
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
    total.offerPendingCount = Math.max(0, total.offered - (total.offerDeclined + total.joined))
    total.joinRate = toRate(total.joined, total.validApplicants)
    total.preInterviewDeclineRate = toRate(total.interviewDeclinedBefore, total.interviewScheduledCount)
    total.offerDeclineRate = toRate(total.offerDeclined, total.offered)
    total.validApplicantRate = toRate(total.validApplicants, total.uniqueApplicants)

    return total
}

function splitCompanyName(companyName: string) {
    const normalized = companyName
        .replace(/　/g, " ")
        .replace(/\s+/g, " ")
        .trim()

    const corporatePrefixPattern = /^(株式会社|有限会社|合同会社|合名会社|合資会社|（株）|\(株\)|㈱)\s*/
    const stripCorporatePrefix = (value: string) => value.replace(corporatePrefixPattern, "").trim()

    const bracketMatch = normalized.match(/^(.*?)[\s]*[（(]\s*(.+?)\s*[）)]$/)
    if (bracketMatch) {
        const baseName = stripCorporatePrefix(bracketMatch[1].trim())
        const branchName = bracketMatch[2].trim()
        return {
            baseName: baseName || normalized,
            branchName: branchName || null,
        }
    }

    const spaceIndex = normalized.indexOf(" ")
    if (spaceIndex > 0) {
        const firstToken = normalized.slice(0, spaceIndex).trim()
        const branchName = normalized.slice(spaceIndex + 1).trim()
        if (corporatePrefixPattern.test(firstToken)) {
            const baseName = stripCorporatePrefix(normalized)
            return {
                baseName: baseName || normalized,
                branchName: null,
            }
        }
        const baseName = stripCorporatePrefix(firstToken)
        return {
            baseName: baseName || normalized,
            branchName: branchName || null,
        }
    }

    return {
        baseName: stripCorporatePrefix(normalized) || normalized,
        branchName: null,
    }
}

function toRate(numerator: number, denominator: number) {
    if (denominator <= 0) return "0.0% (0/0)"
    const percent = (numerator / denominator) * 100
    return `${percent.toFixed(1)}% (${numerator}/${denominator})`
}
