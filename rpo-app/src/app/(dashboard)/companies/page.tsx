import { getApplicantAppliedYears, getCompanyMonthlyTotals, getCompanyYields } from "@/lib/actions/yields"
import { getCompanyGroupsWithMembers } from "@/lib/actions/groups"
import { Building2, CalendarDays, Download, Filter, Settings2 } from "lucide-react"
import CompaniesYieldTableClient from "./CompaniesYieldTableClient"
import CompaniesMonthlyTotalsClient from "./CompaniesMonthlyTotalsClient"
import Link from "next/link"

export default async function CompaniesYieldPage({
    searchParams,
}: {
    searchParams: Promise<{ year?: string, month?: string, dateType?: string, view?: string, companyId?: string }>
}) {
    const params = await searchParams
    const view = params.view === "monthly" ? "monthly" : "company"
    const dateType = (params.dateType || "applied") as "applied" | "event"
    const parsedYear = Number.parseInt(params.year || "", 10)
    const parsedMonth = Number.parseInt(params.month || "", 10)
    const year = Number.isInteger(parsedYear) ? parsedYear : undefined
    const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : undefined
    const companyId = params.companyId?.trim() || undefined

    const availableYears = await getApplicantAppliedYears()
    const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)

    if (view === "monthly") {
        const monthlyRows = await getCompanyMonthlyTotals(year)
        const monthlyCsvParams = new URLSearchParams()
        if (year) monthlyCsvParams.set("year", String(year))
        if (month) monthlyCsvParams.set("month", String(month))
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
                            月別累計
                        </span>
                    </div>
                </div>

                <form method="GET" className="flex flex-wrap items-center gap-2 bg-card p-2 rounded-xl border border-border w-fit" style={{ boxShadow: "var(--shadow-soft)" }}>
                    <input type="hidden" name="view" value="monthly" />
                    <div className="h-8 px-3 rounded-lg bg-muted/40 text-[12px] font-medium text-muted-foreground inline-flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5" />
                        フィルタ
                    </div>
                    <select
                        name="year"
                        defaultValue={year ? String(year) : ""}
                        className="text-[13px] bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer"
                    >
                        <option value="">全ての年</option>
                        {availableYears.map((optionYear) => (
                            <option key={optionYear} value={optionYear}>
                                {optionYear}年
                            </option>
                        ))}
                    </select>
                    <span className="mx-0.5 text-muted-foreground text-xs">/</span>
                    <select
                        name="month"
                        defaultValue={month ? String(month) : ""}
                        className="text-[13px] bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer"
                    >
                        <option value="">全ての月</option>
                        {monthOptions.map((optionMonth) => (
                            <option key={optionMonth} value={optionMonth}>
                                {optionMonth}月
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors duration-150 cursor-pointer"
                    >
                        絞り込み
                    </button>
                    <a
                        href={monthlyCsvExportHref}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-foreground text-[12px] font-medium hover:bg-muted transition-colors duration-150 cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                        CSVエクスポート
                    </a>
                    {(year || month) && (
                        <Link
                            href="/companies?view=monthly"
                            className="h-8 px-3 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors"
                        >
                            リセット
                        </Link>
                    )}
                </form>

                <CompaniesMonthlyTotalsClient rows={monthlyRows} year={year} month={month} />
            </div>
        )
    }

    const [yields, groupsWithMembers] = await Promise.all([
        getCompanyYields(year, month, dateType, { companyId }),
        getCompanyGroupsWithMembers(),
    ])

    const csvParams = new URLSearchParams()
    csvParams.set("dateType", dateType)
    if (year) csvParams.set("year", String(year))
    if (month) csvParams.set("month", String(month))
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
                        月別累計
                    </Link>
                </div>
            </div>

            <form method="GET" className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
                <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2" />
                <input type="hidden" name="view" value="company" />
                {companyId ? <input type="hidden" name="companyId" value={companyId} /> : null}
                <select
                    name="dateType"
                    defaultValue={dateType}
                    className="text-[13px] bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer"
                >
                    <option value="applied">応募日起点</option>
                    <option value="event">発生日起点</option>
                </select>
                <div className="w-px h-4 bg-border mx-1"></div>
                <select
                    name="year"
                    defaultValue={year ? String(year) : ""}
                    className="text-[13px] bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer"
                >
                    <option value="">全ての年</option>
                    {availableYears.map((optionYear) => (
                        <option key={optionYear} value={optionYear}>
                            {optionYear}年
                        </option>
                    ))}
                </select>
                <select
                    name="month"
                    defaultValue={month ? String(month) : ""}
                    className="text-[13px] bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer"
                >
                    <option value="">全ての月</option>
                    {monthOptions.map((optionMonth) => (
                        <option key={optionMonth} value={optionMonth}>
                            {optionMonth}月
                        </option>
                    ))}
                </select>
                <button
                    type="submit"
                    className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors duration-150 cursor-pointer"
                >
                    絞り込み
                </button>
                <a
                    href={csvExportHref}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-foreground text-[12px] font-medium hover:bg-muted transition-colors duration-150 cursor-pointer"
                >
                    <Download className="w-3.5 h-3.5" />
                    CSVエクスポート
                </a>
                <Link
                    href="/companies/manage"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-sky-500 text-white text-[12px] font-medium hover:bg-sky-600 transition-colors duration-150 cursor-pointer"
                >
                    <Settings2 className="w-3.5 h-3.5" />
                    企業グループ管理
                </Link>
            </form>

            <CompaniesYieldTableClient yields={yields} companyId={companyId} groups={groupsWithMembers} />
        </div>
    )
}
