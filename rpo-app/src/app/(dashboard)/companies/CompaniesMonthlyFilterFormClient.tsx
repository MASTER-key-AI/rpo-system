"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { Download, Filter } from "lucide-react"

type Props = {
    startDate?: string
    endDate?: string
    year?: number
    month?: number
    week?: number
    availableYears: number[]
    monthOptions: number[]
    weekOptions: number[]
    csvExportHref: string
}

type FilterState = {
    startDate: string
    endDate: string
    year: string
    month: string
    week: string
}

export default function CompaniesMonthlyFilterFormClient({
    startDate,
    endDate,
    year,
    month,
    week,
    availableYears,
    monthOptions,
    weekOptions,
    csvExportHref,
}: Props) {
    const router = useRouter()
    const [, startTransition] = useTransition()

    const [state, setState] = useState<FilterState>({
        startDate: startDate ?? "",
        endDate: endDate ?? "",
        year: year ? String(year) : "",
        month: month ? String(month) : "",
        week: week ? String(week) : "",
    })

    const hasCustomRange = Boolean(state.startDate || state.endDate)
    const hasAnyFilter = hasCustomRange || Boolean(state.year || state.month || state.week)

    const applyFilter = (next: FilterState) => {
        setState(next)

        const params = new URLSearchParams()
        params.set("view", "monthly")

        if (next.startDate) params.set("startDate", next.startDate)
        if (next.endDate) params.set("endDate", next.endDate)

        if (!next.startDate && !next.endDate) {
            if (next.year) params.set("year", next.year)
            if (next.month) params.set("month", next.month)
            if (next.week && next.month) params.set("week", next.week)
        }

        startTransition(() => {
            router.replace(`/companies?${params.toString()}`)
        })
    }

    const handlers = useMemo(() => {
        return {
            onStartDateChange: (value: string) => {
                applyFilter({
                    ...state,
                    startDate: value,
                })
            },
            onEndDateChange: (value: string) => {
                applyFilter({
                    ...state,
                    endDate: value,
                })
            },
            onYearChange: (value: string) => {
                applyFilter({
                    ...state,
                    year: value,
                })
            },
            onMonthChange: (value: string) => {
                applyFilter({
                    ...state,
                    month: value,
                    week: value ? state.week : "",
                })
            },
            onWeekChange: (value: string) => {
                applyFilter({
                    ...state,
                    week: value,
                })
            },
            onClearDateRange: () => {
                applyFilter({
                    ...state,
                    startDate: "",
                    endDate: "",
                })
            },
        }
    }, [state])

    return (
        <div className="flex flex-wrap items-center gap-2 bg-card p-2 rounded-xl border border-border w-fit" style={{ boxShadow: "var(--shadow-soft)" }}>
            <div className="h-8 px-3 rounded-lg bg-muted/40 text-[12px] font-medium text-muted-foreground inline-flex items-center gap-2">
                <Filter className="w-3.5 h-3.5" />
                フィルタ
            </div>
            <input
                type="date"
                value={state.startDate}
                onChange={(event) => handlers.onStartDateChange(event.target.value)}
                className="h-8 px-2 text-[13px] bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-muted-foreground text-xs">〜</span>
            <input
                type="date"
                value={state.endDate}
                onChange={(event) => handlers.onEndDateChange(event.target.value)}
                className="h-8 px-2 text-[13px] bg-transparent border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {hasCustomRange && (
                <button
                    type="button"
                    onClick={handlers.onClearDateRange}
                    className="h-8 px-2 rounded-md border border-input text-[12px] font-medium hover:bg-muted transition-colors duration-150"
                >
                    日付クリア
                </button>
            )}
            <span className="mx-0.5 text-muted-foreground text-xs">/</span>
            <select
                value={state.year}
                onChange={(event) => handlers.onYearChange(event.target.value)}
                disabled={hasCustomRange}
                className="text-[13px] bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer disabled:opacity-50"
            >
                <option value="">全ての年</option>
                {availableYears.map((optionYear) => (
                    <option key={optionYear} value={optionYear}>
                        {optionYear}年
                    </option>
                ))}
            </select>
            <select
                value={state.month}
                onChange={(event) => handlers.onMonthChange(event.target.value)}
                disabled={hasCustomRange}
                className="text-[13px] bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer disabled:opacity-50"
            >
                <option value="">全ての月</option>
                {monthOptions.map((optionMonth) => (
                    <option key={optionMonth} value={optionMonth}>
                        {optionMonth}月
                    </option>
                ))}
            </select>
            <select
                value={state.week}
                onChange={(event) => handlers.onWeekChange(event.target.value)}
                disabled={hasCustomRange || !state.month}
                className="text-[13px] bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer disabled:opacity-50"
            >
                <option value="">全ての週</option>
                {weekOptions.map((optionWeek) => (
                    <option key={optionWeek} value={optionWeek}>
                        第{optionWeek}週
                    </option>
                ))}
            </select>
            <a
                href={csvExportHref}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-foreground text-[12px] font-medium hover:bg-muted transition-colors duration-150 cursor-pointer"
            >
                <Download className="w-3.5 h-3.5" />
                CSVエクスポート
            </a>
            {hasAnyFilter && (
                <Link
                    href="/companies?view=monthly"
                    className="h-8 px-3 rounded-md border border-input text-xs font-medium hover:bg-muted transition-colors inline-flex items-center"
                >
                    リセット
                </Link>
            )}
        </div>
    )
}
