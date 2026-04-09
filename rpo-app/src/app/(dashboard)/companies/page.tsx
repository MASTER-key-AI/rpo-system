import { getApplicantAppliedYears, getCompanyMonthlyTotals, getCompanyMonthlyWeeklyTotals, getCompanyYields, getCompanyCaseYields } from "@/lib/actions/yields"
import { getCompanySheetMap } from "@/lib/actions/sheets"
import { getCompanyCaseTargetHistory } from "@/lib/actions/analysis"
import { getCompanyYieldCustomDateRange } from "@/lib/company-yield-period"
import { Building2 } from "lucide-react"
import CompaniesYieldTableClient from "./CompaniesYieldTableClient"
import CompaniesMonthlyTotalsClient from "./CompaniesMonthlyTotalsClient"
import CompaniesYieldFilterFormClient from "./CompaniesYieldFilterFormClient"
import CompaniesMonthlyFilterFormClient from "./CompaniesMonthlyFilterFormClient"
import CompanyContextBar from "@/components/CompanyContextBar"
import SupportPeriodHistory from "./SupportPeriodHistory"
import Link from "next/link"

type SearchParamValue = string | string[] | undefined

function getLastParam(value: SearchParamValue) {
    if (Array.isArray(value)) return value[value.length - 1]
    return value
}

function getDisplayedPeriodLabel({
    startDate,
    endDate,
    year,
    month,
    week,
}: {
    startDate?: string
    endDate?: string
    year?: number
    month?: number
    week?: number
}) {
    if (startDate && endDate) return `${startDate} 〜 ${endDate}`
    if (startDate) return `${startDate} 以降`
    if (endDate) return `${endDate} まで`
    if (year && month && week) return `${year}年${month}月 第${week}週`
    if (year && month) return `${year}年${month}月`
    if (month && week) return `${month}月 第${week}週（全期間対象）`
    if (year) return `${year}年`
    if (month) return `${month}月（全期間対象）`
    return "全期間"
}

export default async function CompaniesYieldPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, SearchParamValue>>
}) {
    const params = await searchParams
    const view = getLastParam(params.view) === "monthly" ? "monthly" : "company"
    const dateType = (getLastParam(params.dateType) || "applied") as "applied" | "event"
    const customDateRange = getCompanyYieldCustomDateRange(getLastParam(params.startDate), getLastParam(params.endDate))
    const periodStartAt = customDateRange.startAt
    const periodEndAt = customDateRange.endAt
    const parsedYear = Number.parseInt(getLastParam(params.year) || "", 10)
    const parsedMonth = Number.parseInt(getLastParam(params.month) || "", 10)
    const parsedWeek = Number.parseInt(getLastParam(params.week) || "", 10)
    const year = Number.isInteger(parsedYear) ? parsedYear : undefined
    const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : undefined
    const week = Number.isInteger(parsedWeek) && parsedWeek >= 1 && parsedWeek <= 5 ? parsedWeek : undefined
    const companyId = getLastParam(params.companyId)?.trim() || undefined
    const displayedPeriodLabel = getDisplayedPeriodLabel({
        startDate: customDateRange.startDate,
        endDate: customDateRange.endDate,
        year,
        month,
        week,
    })

    const availableYears = await getApplicantAppliedYears()
    const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)
    const weekOptions = Array.from({ length: 5 }, (_, index) => index + 1)

    if (view === "monthly") {
        const [monthlyRows, weeklyRows] = await Promise.all([
            getCompanyMonthlyTotals(year, { month, week, periodStartAt, periodEndAt }),
            getCompanyMonthlyWeeklyTotals(year, { month, week, periodStartAt, periodEndAt }),
        ])
        const monthlyCsvParams = new URLSearchParams()
        if (customDateRange.hasCustomRange) {
            if (customDateRange.startDate) monthlyCsvParams.set("startDate", customDateRange.startDate)
            if (customDateRange.endDate) monthlyCsvParams.set("endDate", customDateRange.endDate)
        } else {
            if (year) monthlyCsvParams.set("year", String(year))
            if (month) monthlyCsvParams.set("month", String(month))
            if (week && month) monthlyCsvParams.set("week", String(week))
        }
        const monthlyCsvExportHref = `/api/companies/monthly-yields/csv${monthlyCsvParams.toString() ? `?${monthlyCsvParams.toString()}` : ""}`
        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Building2 className="w-6 h-6 text-primary" />
                            歩留まり管理
                        </h1>
                        <p className="text-muted-foreground mt-0.5 text-[13px]">
                            全企業累計（月次）を月単位で俯瞰し、状態変化を素早く把握できます
                        </p>
                    </div>

                    <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50">
                        <Link
                            href={`/companies?view=company${year ? `&year=${year}` : ""}`}
                            className="h-7 px-3 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-150 inline-flex items-center cursor-pointer"
                        >
                            企業別
                        </Link>
                        <span className="h-7 px-3 rounded-md bg-background text-foreground text-[12px] font-medium inline-flex items-center" style={{ boxShadow: "var(--shadow-soft)" }}>
                            KPIサマリー
                        </span>
                    </div>
                </div>

                <CompaniesMonthlyFilterFormClient
                    startDate={customDateRange.startDate}
                    endDate={customDateRange.endDate}
                    year={year}
                    month={month}
                    week={week}
                    availableYears={availableYears}
                    monthOptions={monthOptions}
                    weekOptions={weekOptions}
                    csvExportHref={monthlyCsvExportHref}
                />

                <p className="text-xs text-muted-foreground -mt-3">
                    現在の表示期間: <span className="font-medium text-foreground">{displayedPeriodLabel}</span>
                </p>

                <CompaniesMonthlyTotalsClient rows={monthlyRows} weeklyRows={weeklyRows} year={year} month={month} />
            </div>
        )
    }

    const [yields, sheetMap, caseYields] = await Promise.all([
        getCompanyYields(year, month, dateType, { companyId, week, periodStartAt, periodEndAt }),
        getCompanySheetMap(),
        getCompanyCaseYields(year, month, dateType, { companyId, week, periodStartAt, periodEndAt }),
    ])
    let caseTargetHistory: Awaited<ReturnType<typeof getCompanyCaseTargetHistory>> = []
    if (companyId) {
        try {
            caseTargetHistory = await getCompanyCaseTargetHistory(companyId)
        } catch (error) {
            console.error("[companies/page] failed to load company case target history", {
                companyId,
                error: error instanceof Error ? error.message : String(error),
            })
            caseTargetHistory = []
        }
    }

    const csvParams = new URLSearchParams()
    csvParams.set("dateType", dateType)
    if (customDateRange.hasCustomRange) {
        if (customDateRange.startDate) csvParams.set("startDate", customDateRange.startDate)
        if (customDateRange.endDate) csvParams.set("endDate", customDateRange.endDate)
    } else {
        if (year) csvParams.set("year", String(year))
        if (month) csvParams.set("month", String(month))
        if (week) csvParams.set("week", String(week))
    }
    if (companyId) csvParams.set("companyId", companyId)
    const csvExportHref = `/api/companies/yields/csv?${csvParams.toString()}`

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-primary" />
                        歩留まり管理
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-[13px]">企業ごとの応募・選考ステータス集計表</p>
                </div>

                <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50">
                    <span className="h-7 px-3 rounded-md bg-background text-foreground text-[12px] font-medium inline-flex items-center" style={{ boxShadow: "var(--shadow-soft)" }}>
                        企業別
                    </span>
                    <Link
                        href={`/companies?view=monthly${year ? `&year=${year}` : ""}`}
                        className="h-7 px-3 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-background transition-all duration-150 inline-flex items-center cursor-pointer"
                    >
                        KPIサマリー
                    </Link>
                </div>
            </div>

            <CompaniesYieldFilterFormClient
                dateType={dateType}
                startDate={customDateRange.startDate}
                endDate={customDateRange.endDate}
                year={year}
                month={month}
                week={week}
                companyId={companyId}
                availableYears={availableYears}
                monthOptions={monthOptions}
                weekOptions={weekOptions}
                csvExportHref={csvExportHref}
            />

            <p className="text-xs text-muted-foreground -mt-3">
                現在の表示期間: <span className="font-medium text-foreground">{displayedPeriodLabel}</span>
            </p>

            {companyId && yields.length > 0 && (
                <CompanyContextBar
                    companyId={companyId}
                    companyName={yields[0].companyName}
                    sheetEntry={sheetMap[companyId]}
                    activePage="companies"
                />
            )}

            {companyId && caseTargetHistory.length > 0 && (
                <SupportPeriodHistory history={caseTargetHistory} />
            )}

            <CompaniesYieldTableClient yields={yields} companyId={companyId} sheetMap={sheetMap} caseYields={caseYields} />
        </div>
    )
}
