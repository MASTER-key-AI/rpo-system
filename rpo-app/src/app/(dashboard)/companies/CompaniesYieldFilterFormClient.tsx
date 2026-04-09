"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { Download, Filter } from "lucide-react"

type DateType = "applied" | "event"

type Props = {
    dateType: DateType
    startDate?: string
    endDate?: string
    year?: number
    month?: number
    week?: number
    companyId?: string
    availableYears: number[]
    monthOptions: number[]
    weekOptions: number[]
    csvExportHref: string
}

type FilterState = {
    dateType: DateType
    startDate: string
    endDate: string
    year: string
    month: string
    week: string
}

export default function CompaniesYieldFilterFormClient({
    dateType,
    startDate,
    endDate,
    year,
    month,
    week,
    companyId,
    availableYears,
    monthOptions,
    weekOptions,
    csvExportHref,
}: Props) {
    const router = useRouter()
    const [, startTransition] = useTransition()

    const [state, setState] = useState<FilterState>({
        dateType,
        startDate: startDate ?? "",
        endDate: endDate ?? "",
        year: year ? String(year) : "",
        month: month ? String(month) : "",
        week: week ? String(week) : "",
    })

    const hasCustomRange = Boolean(state.startDate || state.endDate)

    const applyFilter = (next: FilterState) => {
        setState(next)
        const params = new URLSearchParams()
        params.set("view", "company")
        params.set("dateType", next.dateType)
        if (companyId) params.set("companyId", companyId)

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
            onDateTypeChange: (value: string) => {
                applyFilter({
                    ...state,
                    dateType: value === "event" ? "event" : "applied",
                })
            },
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
        <div className="flex items-center gap-3 bg-card p-2 rounded-xl border border-border" style={{ boxShadow: "var(--shadow-soft)" }}>
            <Filter className="w-3.5 h-3.5 text-muted-foreground ml-2" />
            <select
                value={state.dateType}
                onChange={(event) => handlers.onDateTypeChange(event.target.value)}
                className="text-[13px] bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer"
            >
                <option value="applied">応募日起点</option>
                <option value="event">発生日起点</option>
            </select>
            <div className="w-px h-4 bg-border mx-1"></div>
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
            <div className="w-px h-4 bg-border mx-1"></div>
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
        </div>
    )
}
