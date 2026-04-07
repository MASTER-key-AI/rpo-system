"use client"

import { useMemo } from "react"

type CompanyMonthlyTotalRow = {
    month: number
    totalApplicants: number
    uniqueApplicants: number
    validApplicants: number
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
    validApplicantRate: string
    connectedApplicantRate: string
    interviewScheduledRate: string
    interviewConductedRate: string
    offerRate: string
    joinRate: string
    preInterviewDeclineRate: string
    offerDeclineRate: string
}

type Props = {
    rows: CompanyMonthlyTotalRow[]
    year?: number
    month?: number
}

type SummaryTone = "default" | "info" | "success" | "muted" | "warning"

function formatYear(year?: number) {
    if (!year) {
        return "全期間"
    }
    return `${year}年`
}

function formatPeriod(year?: number, month?: number) {
    if (!year && !month) return "全期間"
    if (!month) return `${year}年`
    if (!year) return `${month}月(全期間対象)`
    return `${year}年${String(month).padStart(2, "0")}月`
}

function getPeriodRows(rows: CompanyMonthlyTotalRow[], month?: number) {
    if (!month) {
        return [...rows]
    }
    return rows.filter((row) => row.month === month)
}

export default function CompaniesMonthlyTotalsClient({ rows, year, month }: Props) {
    const filteredRows = useMemo(
        () => getPeriodRows(rows, month).sort((left, right) => left.month - right.month),
        [rows, month],
    )

    const total = useMemo(() => {
        const aggregate = filteredRows.reduce(
            (acc, row) => {
                acc.totalApplicants += row.totalApplicants
                acc.uniqueApplicants += row.uniqueApplicants
                acc.validApplicants += row.validApplicants
                acc.connectedApplicantCount += row.connectedApplicantCount
                acc.notConnectedCount += row.notConnectedCount
                acc.phoneAppointmentCount += row.phoneAppointmentCount
                acc.interviewScheduledCount += row.interviewScheduledCount
                acc.interviewConductedCount += row.interviewConductedCount
                acc.offered += row.offered
                acc.offerPendingCount += row.offerPendingCount
                acc.joined += row.joined
                acc.preInterviewDeclinedCount += row.preInterviewDeclinedCount
                acc.offerDeclined += row.offerDeclined
                return acc
            },
            {
                totalApplicants: 0,
                uniqueApplicants: 0,
                validApplicants: 0,
                connectedApplicantCount: 0,
                notConnectedCount: 0,
                phoneAppointmentCount: 0,
                interviewScheduledCount: 0,
                interviewConductedCount: 0,
                offered: 0,
                offerPendingCount: 0,
                joined: 0,
                preInterviewDeclinedCount: 0,
                offerDeclined: 0,
            },
        )

        return {
            month: 0,
            ...aggregate,
            validApplicantRate: toRate(aggregate.validApplicants, aggregate.uniqueApplicants),
            connectedApplicantRate: toRate(aggregate.connectedApplicantCount, aggregate.validApplicants),
            interviewScheduledRate: toRate(aggregate.interviewScheduledCount, aggregate.validApplicants),
            interviewConductedRate: toRate(aggregate.interviewConductedCount, aggregate.validApplicants),
            offerRate: toRate(aggregate.offered, aggregate.validApplicants),
            joinRate: toRate(aggregate.joined, aggregate.validApplicants),
            preInterviewDeclineRate: toRate(aggregate.preInterviewDeclinedCount, aggregate.interviewScheduledCount),
            offerDeclineRate: toRate(aggregate.offerDeclined, aggregate.offered),
        }
    }, [filteredRows])

    const keyIndicators: { label: string; value: string | number; tone: SummaryTone }[] = [
        { label: "応募数", value: total.totalApplicants, tone: "default" as SummaryTone },
        { label: "ユニーク応募数", value: total.uniqueApplicants, tone: "default" },
        { label: "有効応募数", value: total.validApplicants, tone: "info" },
        { label: "通電数", value: total.connectedApplicantCount, tone: "default" },
        { label: "不通数", value: total.notConnectedCount, tone: "muted" },
        { label: "電話予定数", value: total.phoneAppointmentCount, tone: "default" },
        { label: "面接設定数", value: total.interviewScheduledCount, tone: "default" },
        { label: "面接実施数", value: total.interviewConductedCount, tone: "success" },
        { label: "内定数", value: total.offered, tone: "success" },
        { label: "内定承諾待ち", value: total.offerPendingCount, tone: "warning" },
        { label: "入社数", value: total.joined, tone: "success" },
    ]

    const conversionIndicators: { label: string; value: string; tone: SummaryTone }[] = [
        { label: "有効応募率", value: total.validApplicantRate, tone: "info" as SummaryTone },
        { label: "通電率", value: total.connectedApplicantRate, tone: "info" },
        { label: "有効応募からの面接設定率", value: total.interviewScheduledRate, tone: "info" },
        { label: "有効応募からの着席率", value: total.interviewConductedRate, tone: "info" },
        { label: "有効応募からの内定率", value: total.offerRate, tone: "success" },
        { label: "有効応募からの入社率", value: total.joinRate, tone: "success" },
        { label: "面接前辞退率", value: total.preInterviewDeclineRate, tone: "warning" },
        { label: "内定後/入社前辞退率", value: total.offerDeclineRate, tone: "warning" },
    ]

    return (
        <div className="space-y-5">
            <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card to-muted/20 shadow-card">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-transparent" />
                <div className="relative px-4 py-4 sm:px-6 sm:py-5">
                    <p className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold">
                        {formatPeriod(year, month)}
                    </p>
                    <h2 className="mt-3 text-lg font-bold text-foreground">{formatYear(year)} 全企業累計サマリー</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        応募・通電・面接・内定・入社の流れを一枚で確認できます
                    </p>

                    <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">主要KPI</p>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-sm">
                            {keyIndicators.map((card) => (
                                <SummaryCard key={card.label} label={card.label} value={card.value} tone={card.tone} />
                            ))}
                        </div>
                    </div>
                    <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">転換率KPI</p>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 text-sm">
                            {conversionIndicators.map((card) => (
                                <SummaryCard key={card.label} label={card.label} value={card.value} tone={card.tone} />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <div className="bg-card rounded-2xl border border-border/70 shadow-card overflow-hidden">
                <div className="w-full overflow-auto">
                    <table className="w-full min-w-[980px] text-sm text-left whitespace-nowrap">
                        <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
                            <tr>
                                <th className="px-3 py-3">月</th>
                                <th className="px-3 py-3">応募数</th>
                                <th className="px-3 py-3">ユニーク応募数</th>
                                <th className="px-3 py-3">有効応募数</th>
                                <th className="px-3 py-3">通電数</th>
                                <th className="px-3 py-3">不通数</th>
                                <th className="px-3 py-3">電話予定数</th>
                                <th className="px-3 py-3">面接設定数</th>
                                <th className="px-3 py-3">面接実施数</th>
                                <th className="px-3 py-3">内定数</th>
                                <th className="px-3 py-3">内定承諾待ち</th>
                                <th className="px-3 py-3">入社数</th>
                                <th className="px-3 py-3">通電率</th>
                                <th className="px-3 py-3">有効応募からの面接設定率</th>
                                <th className="px-3 py-3">有効応募からの面接実施率</th>
                                <th className="px-3 py-3">有効応募からの内定率</th>
                                <th className="px-3 py-3">有効応募からの入社率</th>
                                <th className="px-3 py-3">面接前辞退率</th>
                                <th className="px-3 py-3">内定後/入社前辞退率</th>
                                <th className="px-3 py-3">有効応募率</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={20} className="px-4 py-8">
                                        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                                            <p className="font-semibold">表示対象のデータがありません。</p>
                                            <p className="mt-1 text-xs">
                                                年・月の絞り込み条件を変更して、再度対象データを絞り込んでください。
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row.month} className="border-b border-border/60 hover:bg-muted/20">
                                        <td className="px-3 py-2 font-semibold">{row.month}月</td>
                                        <td className="px-3 py-2">{row.totalApplicants}</td>
                                        <td className="px-3 py-2">{row.uniqueApplicants}</td>
                                        <td className="px-3 py-2">{row.validApplicants}</td>
                                        <td className="px-3 py-2">{row.connectedApplicantCount}</td>
                                        <td className="px-3 py-2">{row.notConnectedCount}</td>
                                        <td className="px-3 py-2">{row.phoneAppointmentCount}</td>
                                        <td className="px-3 py-2">{row.interviewScheduledCount}</td>
                                        <td className="px-3 py-2">{row.interviewConductedCount}</td>
                                        <td className="px-3 py-2">{row.offered}</td>
                                        <td className="px-3 py-2">{row.offerPendingCount}</td>
                                        <td className="px-3 py-2">{row.joined}</td>
                                        <td className="px-3 py-2">{row.connectedApplicantRate}</td>
                                        <td className="px-3 py-2">{row.interviewScheduledRate}</td>
                                        <td className="px-3 py-2">{row.interviewConductedRate}</td>
                                        <td className="px-3 py-2">{row.offerRate}</td>
                                        <td className="px-3 py-2">{row.joinRate}</td>
                                        <td className="px-3 py-2">{row.preInterviewDeclineRate}</td>
                                        <td className="px-3 py-2">{row.offerDeclineRate}</td>
                                        <td className="px-3 py-2">{row.validApplicantRate}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function SummaryCard({
    label,
    value,
    tone = "default",
}: {
    label: string
    value: string | number
    tone?: SummaryTone
}) {
    const toneClasses: Record<SummaryTone, string> = {
        default: "border-border/70 bg-muted/10 text-muted-foreground",
        info: "border-primary/30 bg-primary/5 text-primary-foreground",
        success: "border-emerald-300/40 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300",
        muted: "border-slate-300/40 bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-300",
        warning: "border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300",
    }

    const valueClasses: Record<SummaryTone, string> = {
        default: "text-foreground",
        info: "text-primary",
        success: "text-emerald-700 dark:text-emerald-300",
        muted: "text-slate-700 dark:text-slate-300",
        warning: "text-amber-700 dark:text-amber-300",
    }

    return (
        <div className={`rounded-lg border ${toneClasses[tone]} px-3 py-2.5 h-full`}>
            <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
            <p className={`mt-1 text-base font-bold tracking-tight ${valueClasses[tone]}`}>{value}</p>
        </div>
    )
}

function toRate(numerator: number, denominator: number) {
    if (denominator <= 0) return "0.0% (0/0)"
    const percent = (numerator / denominator) * 100
    return `${percent.toFixed(1)}% (${numerator}/${denominator})`
}
