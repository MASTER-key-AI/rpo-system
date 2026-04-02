"use client"

import type { CaseTargetWithResult } from "@/lib/actions/analysis"
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react"

function formatDate(dateStr: string) {
    const d = new Date(dateStr)
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`
}

function ProgressBar({ value, max }: { value: number; max: number }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-[11px] text-muted-foreground w-8 text-right">{pct}%</span>
        </div>
    )
}

export default function SupportPeriodHistory({ history }: { history: CaseTargetWithResult[] }) {
    return (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">支援期間目標・履歴</h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {history.map((item) => {
                    const achieved = item.result.joined >= item.targetHires

                    let borderClass = "border-border"
                    let bgClass = "bg-card"
                    let badge: React.ReactNode = null
                    let icon: React.ReactNode = null

                    if (item.isActive) {
                        borderClass = "border-primary"
                        bgClass = "bg-primary/5"
                        badge = (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground">
                                適用中
                            </span>
                        )
                    } else if (item.isEnded) {
                        borderClass = "border-border"
                        bgClass = "bg-muted/30"
                        badge = (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                終了済み
                            </span>
                        )
                        icon = achieved
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    } else {
                        badge = (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                                支援開始前
                            </span>
                        )
                        icon = <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    }

                    return (
                        <div
                            key={item.id}
                            className={`rounded-xl border p-4 space-y-3 ${borderClass} ${bgClass}`}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="space-y-0.5 min-w-0">
                                    <p className="text-[13px] font-semibold text-foreground truncate">{item.caseName}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {formatDate(item.startDate)} 〜 {formatDate(item.endDate)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    {icon}
                                    {badge}
                                </div>
                            </div>

                            {/* Target & result */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-[12px]">
                                    <span className="text-muted-foreground">目標採用数</span>
                                    <span className="font-semibold text-foreground">{item.targetHires}名</span>
                                </div>
                                {(item.isActive || item.isEnded) && (
                                    <>
                                        <div className="flex items-center justify-between text-[12px]">
                                            <span className="text-muted-foreground">入社</span>
                                            <span className={`font-semibold ${item.isEnded && achieved ? "text-emerald-600" : "text-foreground"}`}>
                                                {item.result.joined}名
                                                {item.targetHires > 0 && (
                                                    <span className="text-muted-foreground font-normal ml-1">
                                                        ({Math.round((item.result.joined / item.targetHires) * 100)}%達成)
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                        {item.isActive && (
                                            <ProgressBar value={item.result.joined} max={item.targetHires} />
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Metrics row */}
                            {(item.isActive || item.isEnded) && (
                                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-border/50">
                                    {[
                                        { label: "応募", value: item.result.totalApplicants },
                                        { label: "有効", value: item.result.validApplicants },
                                        { label: "面接", value: item.result.interviewScheduledCount },
                                        { label: "内定", value: item.result.offered },
                                        { label: "入社", value: item.result.joined },
                                    ].map(({ label, value }) => (
                                        <div key={label} className="flex items-center gap-1 text-[11px]">
                                            <span className="text-muted-foreground">{label}</span>
                                            <span className="font-medium text-foreground">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
