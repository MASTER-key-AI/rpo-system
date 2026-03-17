"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { Clock, ExternalLink, PhoneCall, Flame, Gauge, MapPin } from "lucide-react"
import { searchApplicantsForCallLog, type CallLogApplicantOption } from "@/lib/actions/applicant"
import { type CallHeatmapAnalytics } from "@/lib/actions/calls"
import Link from "next/link"
import CallLogsFilterBar from "./CallLogsFilterBar"

type CallLog = {
    id: string
    calledAt: string | number | Date | null
    applicantId: string
    applicantName: string
    companyName: string
    companyId: string | null
    callerName: string
    callCount: number
    isConnected: boolean | null
    note: string | null
}

type SheetEntry = {
    spreadsheetId: string
    gid: number
    sheetName: string | null
}

type Company = {
    id: string
    name: string
}

type User = {
    id: string
    name: string | null
    email: string | null
}

type ViewMode = "register" | "history" | "analysis"

type CallLogsClientProps = {
    logs: CallLog[]
    companies: Company[]
    users: User[]
    selectedCompanyId?: string
    selectedCallerId?: string
    viewMode: ViewMode
    analytics?: CallHeatmapAnalytics
    sheetMap?: Record<string, SheetEntry>
    createCallLogAction: (formData: FormData) => Promise<void>
    deleteCallLogAction: (formData: FormData) => Promise<void>
}

function formatRate(rate: number) {
    return `${Math.round(rate * 100)}%`
}

function formatSlotLabel(start: number, end: number) {
    const paddedStart = String(start).padStart(2, "0")
    const paddedEnd = String(end).padStart(2, "0")

    return `${paddedStart}:00-${paddedEnd}:00`
}

function getHeatStyle(rate: number, hasSample: boolean) {
    if (!hasSample) {
        return {
            backgroundColor: "var(--color-muted)",
            color: "var(--color-muted-foreground)",
        } as const
    }

    const clampedRate = Math.max(0, Math.min(1, rate))
    const hue = Math.round(10 + clampedRate * 120)
    const saturation = 80
    const lightness = Math.round(88 - clampedRate * 42)

    return {
        backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
        color: clampedRate > 0.6 ? "hsl(0 0% 100% / 0.95)" : "hsl(220 35% 20%)",
    } as const
}

function getRateColorClass(rate: number, hasSample: boolean) {
    if (!hasSample) return "text-muted-foreground"
    if (rate >= 0.7) return "text-white"
    if (rate >= 0.4) return "text-emerald-950"
    return "text-foreground"
}

function renderRegisterForm(props: {
    applicantQuery: string
    applicantOptions: CallLogApplicantOption[]
    selectedApplicantId: string
    isLoadingOptions: boolean
    isSuggestionOpen: boolean
    formError: string
    defaultCalledAt: string
    onApplicantChange: (value: string) => void
    onSelectApplicant: (option: CallLogApplicantOption) => void
    onSubmit: (event: FormEvent<HTMLFormElement>) => void
    createCallLogAction: (formData: FormData) => Promise<void>
    onSuggestionOpen: (next: boolean) => void
}) {
    const {
        applicantQuery,
        applicantOptions,
        selectedApplicantId,
        isLoadingOptions,
        isSuggestionOpen,
        formError,
        defaultCalledAt,
        onApplicantChange,
        onSelectApplicant,
        onSubmit,
        createCallLogAction,
        onSuggestionOpen,
    } = props

    return (
        <form onSubmit={onSubmit} action={createCallLogAction} className="bg-muted/20 border-b border-border p-5 space-y-4">
            <h2 className="text-[13px] font-semibold text-foreground">架電登録</h2>

            <div className="grid gap-3 md:grid-cols-3 items-start">
                <div className="space-y-1.5 relative">
                    <label htmlFor="callLogApplicant" className="text-xs font-medium text-muted-foreground">
                        応募者（部分一致で検索）
                    </label>
                    <input
                        id="callLogApplicant"
                        name="applicantKeyword"
                        value={applicantQuery}
                        onChange={(event) => onApplicantChange(event.target.value)}
                        onFocus={() => onSuggestionOpen(applicantOptions.length > 0)}
                        onBlur={() => setTimeout(() => onSuggestionOpen(false), 120)}
                        autoComplete="off"
                        placeholder="応募者名・企業名で検索"
                        required
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200"
                    />
                    <input type="hidden" name="applicantId" value={selectedApplicantId} />

                    {isSuggestionOpen && (
                        <div className="absolute z-20 left-0 right-0 mt-1 bg-popover border border-border rounded-lg max-h-60 overflow-auto text-popover-foreground" style={{ boxShadow: "var(--shadow-premium)" }}>
                            {isLoadingOptions ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">候補を検索しています...</div>
                            ) : applicantOptions.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">一致する候補がありません</div>
                            ) : (
                                <ul className="divide-y divide-border/50">
                                    {applicantOptions.map((option) => (
                                        <li key={option.id}>
                                            <button
                                                type="button"
                                                onMouseDown={(event) => event.preventDefault()}
                                                onClick={() => onSelectApplicant(option)}
                                                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted/50 transition-colors"
                                            >
                                                <span className="font-medium">{option.name}</span>
                                                <span className="ml-2 text-muted-foreground">（{option.companyName}）</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center gap-2 h-10">
                        <input
                            id="callLogIsConnected"
                            name="isConnected"
                            type="checkbox"
                            value="true"
                            className="h-4 w-4 rounded border-input text-primary focus:ring-ring/50"
                        />
                        <label htmlFor="callLogIsConnected" className="text-sm text-foreground font-medium">
                            通電
                        </label>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="calledAt" className="text-xs font-medium text-muted-foreground">
                        架電日時（任意）
                    </label>
                    <input
                        id="calledAt"
                        name="calledAt"
                        type="datetime-local"
                        defaultValue={defaultCalledAt}
                        className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200"
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label htmlFor="callLogNote" className="text-xs font-medium text-muted-foreground">
                    メモ
                </label>
                <input
                    id="callLogNote"
                    name="note"
                    type="text"
                    required
                    placeholder="架電メモを入力..."
                    className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200"
                />
            </div>

            <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all duration-200 active:scale-[0.98] cursor-pointer"
            >
                登録
            </button>
        </form>
    )
}

function renderHistoryTable(props: {
    logs: CallLog[]
    sheetMap: Record<string, SheetEntry>
    deleteCallLogAction: (formData: FormData) => Promise<void>
}) {
    const { logs, sheetMap, deleteCallLogAction } = props

    return (
        <div className="w-full overflow-auto">
            <table className="w-full text-sm text-left">
                <thead className="text-[11px] text-muted-foreground uppercase tracking-wider bg-muted/30 border-b border-border">
                    <tr>
                        <th className="px-5 py-3 font-semibold">架電日時</th>
                        <th className="px-5 py-3 font-semibold">応募者</th>
                        <th className="px-5 py-3 font-semibold">企業名</th>
                        <th className="px-5 py-3 font-semibold">担当者</th>
                        <th className="px-5 py-3 font-semibold text-center">回数</th>
                        <th className="px-5 py-3 font-semibold text-center">通電</th>
                        <th className="px-5 py-3 font-semibold">結果・メモ</th>
                        <th className="px-5 py-3 font-semibold text-center">操作</th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-border/40">
                    {logs.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                                <div className="flex flex-col items-center justify-center">
                                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                                        <PhoneCall className="w-6 h-6 text-muted-foreground/50" />
                                    </div>
                                    <p>架電記録がありません</p>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        logs.map((log) => (
                                <tr key={log.id} className="even:bg-muted/10 hover:bg-muted/25 transition-colors duration-100 group">
                                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap tabular-nums">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-muted-foreground/70" />
                                        {new Date(log.calledAt || 0).toLocaleString("ja-JP", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-medium text-foreground">
                                    <Link href={`/applicants/${log.applicantId}`} className="hover:underline text-primary transition-colors">
                                        {log.applicantName}
                                    </Link>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground max-w-[150px]">
                                    <span className="inline-flex items-center gap-1 truncate">
                                        {log.companyName}
                                        {log.companyId && sheetMap[log.companyId] && (
                                            <a
                                                href={`https://docs.google.com/spreadsheets/d/${sheetMap[log.companyId].spreadsheetId}/edit#gid=${sheetMap[log.companyId].gid}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={`${log.companyName} のスプレッドシートを開く`}
                                                className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors duration-150"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        )}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold ring-1 ring-primary/20">
                                            {log.callerName.charAt(0)}
                                        </div>
                                        {log.callerName}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center font-medium text-foreground">{log.callCount}</td>
                                <td className="px-6 py-4 text-center">
                                    {log.isConnected ? (
                                        <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md text-xs ring-1 ring-emerald-200/60">通電</span>
                                    ) : (
                                        <span className="text-muted-foreground/40 px-2 py-0.5 text-xs">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-foreground break-words max-w-[300px]">{log.note}</td>
                                <td className="px-6 py-4 text-center">
                                    <form action={deleteCallLogAction} className="inline">
                                        <input type="hidden" name="callLogId" value={log.id} />
                                        <button
                                            type="submit"
                                            className="inline-flex items-center text-xs text-destructive/80 hover:text-destructive hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            削除
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}

function renderAnalysisPanel(analytics?: CallHeatmapAnalytics) {
    if (!analytics) {
        return (
            <div className="p-6 text-sm text-muted-foreground">
                分析を表示するには、最新の架電履歴データが必要です。
            </div>
        )
    }

    return (
        <div className="w-full">
            <div className="border-b border-border/40">
                <div className="p-4 space-y-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">通電しやすさ分析</h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                DB内の架電履歴を曜日・時間帯で集約し、通電率が高い時間帯を可視化しています。
                            </p>
                        </div>
                        <div className="text-xs px-3 py-2 bg-muted/70 rounded-md border border-border">
                            <p><strong>対象件数:</strong> {analytics.totalCalls} 件</p>
                            <p><strong>通電率:</strong> {formatRate(analytics.overallRate)}</p>
                            <p><strong>母数基準:</strong> {analytics.sampleThreshold}件以上</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-soft)" }}>
                            <p className="text-xs text-muted-foreground">全通話数</p>
                            <p className="text-2xl font-bold mt-1 text-foreground">{analytics.totalCalls}</p>
                            <p className="text-xs text-muted-foreground mt-1">該当フィルタ条件の対象データ</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-soft)" }}>
                            <p className="text-xs text-muted-foreground">通電数</p>
                            <p className="text-2xl font-bold mt-1 text-emerald-700 dark:text-emerald-300">{analytics.connectedCalls}</p>
                            <p className="text-xs text-muted-foreground mt-1">通電率 {formatRate(analytics.overallRate)}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-soft)" }}>
                            <p className="text-xs text-muted-foreground">通電しやすい時間帯</p>
                            <div className="mt-1 flex items-center gap-2">
                                <Flame className="w-4 h-4 text-amber-500" />
                                <p className="font-semibold text-sm text-foreground">
                                    {analytics.top[0]
                                        ? `${analytics.top[0].weekdayLabel} ${formatSlotLabel(
                                            analytics.top[0].slotStart,
                                            analytics.top[0].slotEnd,
                                        )}`
                                        : "-"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                            <thead className="bg-muted/30 text-muted-foreground">
                                <tr>
                                    <th className="px-3 py-2 text-left font-semibold whitespace-nowrap">曜日</th>
                                    {analytics.slots.map((slotStart) => (
                                        <th key={slotStart} className="px-3 py-2 text-center font-semibold whitespace-nowrap">
                                            {formatSlotLabel(slotStart, Math.min(slotStart + analytics.slotHours, 24))}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {analytics.rows.map((row) => (
                                    <tr key={row.weekday}>
                                        <td className="px-3 py-2.5 text-muted-foreground font-medium bg-muted/15 whitespace-nowrap">{row.weekdayLabel}</td>
                                        {row.rates.map((rate, slotIndex) => {
                                            const total = row.totals[slotIndex]
                                            const hasSample = total >= analytics.sampleThreshold
                                            const style = getHeatStyle(rate, hasSample)

                                            return (
                                                <td
                                                    key={slotIndex}
                                                    className="p-2 text-center align-middle border-l border-border/30 min-w-24 transition-colors"
                                                    style={{
                                                        backgroundColor: style.backgroundColor,
                                                    }}
                                                >
                                                    <div className={`text-[11px] leading-tight ${getRateColorClass(rate, hasSample)}`}>
                                                        {hasSample ? formatRate(rate) : "—"}
                                                    </div>
                                                    <div className={`text-[10px] mt-1 ${getRateColorClass(rate, hasSample)}`}>
                                                        {total > 0 ? `${row.connected[slotIndex]}/${total}` : "（母数不足）"}
                                                    </div>
                                                </td>
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                        <section className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-soft)" }}>
                            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                                <Gauge className="w-4 h-4 text-emerald-600" />
                                通電率が高い順（上位）
                            </h3>
                            <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
                                {analytics.top.length === 0 ? (
                                    <li className="text-muted-foreground">母数基準を満たす時間帯がありません。</li>
                                ) : (
                                    analytics.top.map((cell) => (
                                        <li
                                            key={`${cell.weekday}-${cell.slotStart}`}
                                            className="flex justify-between items-center rounded-md border border-border/70 bg-muted/20 px-2 py-1.5"
                                        >
                                            <span>
                                                {cell.weekdayLabel} {formatSlotLabel(cell.slotStart, cell.slotEnd)}
                                            </span>
                                            <span className="font-semibold text-foreground">
                                                {formatRate(cell.rate)}（{cell.connected}/{cell.total}）
                                            </span>
                                        </li>
                                    ))
                                )}
                            </ul>
                        </section>

                        <section className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-soft)" }}>
                            <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-sky-600" />
                                通電率が低い順（参考）
                            </h3>
                            <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
                                {analytics.bottom.length === 0 ? (
                                    <li className="text-muted-foreground">母数基準を満たす時間帯がありません。</li>
                                ) : (
                                    analytics.bottom.map((cell) => (
                                        <li
                                            key={`${cell.weekday}-${cell.slotStart}-low`}
                                            className="flex justify-between items-center rounded-md border border-border/70 bg-muted/20 px-2 py-1.5"
                                        >
                                            <span>
                                                {cell.weekdayLabel} {formatSlotLabel(cell.slotStart, cell.slotEnd)}
                                            </span>
                                            <span className="font-semibold text-foreground">
                                                {formatRate(cell.rate)}（{cell.connected}/{cell.total}）
                                            </span>
                                        </li>
                                    ))
                                )}
                            </ul>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function CallLogsClient({
    logs,
    companies,
    users,
    selectedCompanyId,
    selectedCallerId,
    viewMode,
    analytics,
    sheetMap = {},
    createCallLogAction,
    deleteCallLogAction,
}: CallLogsClientProps) {
    const [applicantQuery, setApplicantQuery] = useState("")
    const [applicantOptions, setApplicantOptions] = useState<CallLogApplicantOption[]>([])
    const [selectedApplicantId, setSelectedApplicantId] = useState("")
    const [isLoadingOptions, setIsLoadingOptions] = useState(false)
    const [isSuggestionOpen, setIsSuggestionOpen] = useState(false)
    const [formError, setFormError] = useState("")
    const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const isRegisterMode = viewMode === "register"
    const isAnalysisMode = viewMode === "analysis"

    const defaultCalledAt = new Date().toISOString().slice(0, 16)

    useEffect(() => {
        if (suggestionTimer.current) {
            clearTimeout(suggestionTimer.current)
        }

        if (!applicantQuery.trim()) {
            setApplicantOptions([])
            setIsSuggestionOpen(false)
            return
        }

        suggestionTimer.current = setTimeout(async () => {
            setIsLoadingOptions(true)

            try {
                const candidates = await searchApplicantsForCallLog(applicantQuery)
                setApplicantOptions(candidates)
                setIsSuggestionOpen(candidates.length > 0)
            } catch (error) {
                console.error(error)
                setApplicantOptions([])
                setIsSuggestionOpen(false)
            } finally {
                setIsLoadingOptions(false)
            }
        }, 250)

        return () => {
            if (suggestionTimer.current) {
                clearTimeout(suggestionTimer.current)
            }
        }
    }, [applicantQuery])

    const handleApplicantQueryChange = (value: string) => {
        setApplicantQuery(value)
        setSelectedApplicantId("")
        setFormError("")
        setIsSuggestionOpen(Boolean(value.trim()))
    }

    const handleSelectApplicant = (option: CallLogApplicantOption) => {
        setSelectedApplicantId(option.id)
        setApplicantQuery(`${option.name}（${option.companyName}）`)
        setIsSuggestionOpen(false)
    }

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        if (!selectedApplicantId) {
            event.preventDefault()
            setFormError("応募者を候補から選択してください。")
            return
        }

        setFormError("")
    }

    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
            {isRegisterMode && (
                renderRegisterForm({
                    applicantQuery,
                    applicantOptions,
                    selectedApplicantId,
                    isLoadingOptions,
                    isSuggestionOpen,
                    formError,
                    defaultCalledAt,
                    onApplicantChange: handleApplicantQueryChange,
                    onSelectApplicant: handleSelectApplicant,
                    onSubmit: handleSubmit,
                    createCallLogAction,
                    onSuggestionOpen: setIsSuggestionOpen,
                })
            )}

            {!isRegisterMode && (
                <>
                    <CallLogsFilterBar
                        companies={companies}
                        users={users}
                        selectedCompanyId={selectedCompanyId}
                        selectedCallerId={selectedCallerId}
                    />

                    {isAnalysisMode ? renderAnalysisPanel(analytics) : renderHistoryTable({ logs, sheetMap, deleteCallLogAction })}
                </>
            )}
        </div>
    )
}
