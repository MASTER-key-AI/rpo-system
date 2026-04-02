"use client"

import { useState } from "react"
import Link from "next/link"
import {
    AlertTriangle, CheckCircle2, MinusCircle, TrendingUp,
    Settings, Eye, EyeOff, AlertCircle
} from "lucide-react"
import type { AnalysisSummary, CompanyAssessment, CompanyStatus, StaffSummary, CaseTarget, WeeklyCriteria } from "@/lib/actions/analysis"
import AnalysisSettingsPanel from "./AnalysisSettingsPanel"

const STATUS_CONFIG: Record<CompanyStatus, { label: string; color: string; bg: string; Icon: React.ComponentType<{ className?: string }> }> = {
    good: { label: "好調", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", Icon: CheckCircle2 },
    alert: { label: "要注意", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", Icon: AlertTriangle },
    no_data: { label: "データなし", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", Icon: MinusCircle },
}

const PHASE_LABEL: Record<1 | 2 | 3 | 4, string> = {
    1: "Phase1（〜25%）",
    2: "Phase2（25〜50%）",
    3: "Phase3（50〜75%）",
    4: "Phase4（75%〜）",
}

function StatusBadge({ status }: { status: CompanyStatus }) {
    const { label, color, bg, Icon } = STATUS_CONFIG[status]
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${bg} ${color}`}>
            <Icon className="w-3 h-3" />
            {label}
        </span>
    )
}

function PeriodPaceBar({ pace }: { pace: NonNullable<CompanyAssessment["periodPace"]> }) {
    const elapsedPct = Math.round(pace.elapsedPercent * 100)
    const hirePct = Math.round(pace.hirePercent * 100)
    return (
        <div className="min-w-[130px]">
            <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                <span>経過 {elapsedPct}%</span>
                <span className={pace.onPace ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                    達成 {hirePct}%
                </span>
            </div>
            <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-muted-foreground/30 rounded-full" style={{ width: `${Math.min(100, elapsedPct)}%` }} />
                <div className={`absolute left-0 top-0 h-full rounded-full ${pace.onPace ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, hirePct)}%` }} />
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
                {pace.currentHires}/{pace.targetHires}名 ・ 予測 {pace.projected}名
            </div>
        </div>
    )
}

function CompanyRow({ a }: { a: CompanyAssessment }) {
    const isUnconfigured = a.caseName === null

    if (isUnconfigured) {
        return (
            <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors opacity-60">
                <td className="py-3 px-4">
                    <Link href={`/companies?companyId=${a.companyId}`} className="text-[13px] font-medium text-foreground hover:text-primary hover:underline">
                        {a.companyName}
                    </Link>
                </td>
                <td className="py-3 px-4" colSpan={7}>
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                        支援期間目標が未設定です — 設定パネルから追加してください
                    </span>
                </td>
            </tr>
        )
    }

    return (
        <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
            <td className="py-3 px-4">
                <div className="flex flex-col gap-0.5">
                    <Link href={`/companies?companyId=${a.companyId}`} className="text-[13px] font-medium text-foreground hover:text-primary hover:underline">
                        {a.companyName}
                    </Link>
                    <span className="text-[11px] text-muted-foreground">{a.caseName}</span>
                </div>
            </td>
            <td className="py-3 px-4">
                <div className="flex flex-col gap-1">
                    <StatusBadge status={a.status} />
                    {a.phaseNumber && (
                        <span className="text-[10px] text-muted-foreground">{PHASE_LABEL[a.phaseNumber]}</span>
                    )}
                </div>
            </td>
            <td className="py-3 px-4 text-[12px] text-muted-foreground max-w-[180px] truncate">{a.reason}</td>
            <td className="py-3 px-4 text-center text-[13px] font-medium">{a.metrics.validApplicants}</td>
            <td className="py-3 px-4 text-center text-[13px] font-medium">{a.metrics.interviewScheduledCount}</td>
            <td className="py-3 px-4 text-center text-[13px] font-medium">{a.metrics.offered}</td>
            <td className="py-3 px-4 text-center">
                <div className="flex flex-col items-center">
                    <span className="text-[13px] font-bold text-primary">{a.metrics.joined}</span>
                    <span className="text-[10px] text-muted-foreground">/{a.targetHires}目標</span>
                </div>
            </td>
            <td className="py-3 px-4">
                {a.periodPace ? <PeriodPaceBar pace={a.periodPace} /> : <span className="text-[11px] text-muted-foreground">—</span>}
            </td>
        </tr>
    )
}

function StaffRow({ s }: { s: StaffSummary }) {
    return (
        <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
            <td className="py-3 px-4 text-[13px] font-medium">{s.name}</td>
            <td className="py-3 px-4 text-center text-[13px]">{s.totalApp}</td>
            <td className="py-3 px-4 text-center text-[13px]">{s.totalOffer}</td>
            <td className="py-3 px-4 text-center text-[13px] font-bold text-primary">{s.totalJoined}</td>
            <td className="py-3 px-4 text-[12px] text-muted-foreground">{s.companies.join("、")}</td>
        </tr>
    )
}

type Props = {
    summary: AnalysisSummary
    staffSummary: StaffSummary[]
    caseTargets: CaseTarget[]
    allCriteria: WeeklyCriteria[]
    allCompanies: { id: string; name: string; supportStatus: string }[]
    showAll: boolean
}

export default function AnalysisDashboard({ summary, staffSummary, caseTargets, allCriteria, allCompanies, showAll }: Props) {
    const [activeTab, setActiveTab] = useState<"alert" | "good" | "all" | "no_data" | "staff">("alert")
    const [showSettings, setShowSettings] = useState(false)

    const defaultCriteria = allCriteria.filter((c) => c.companyId === null)

    const tabs = [
        { key: "alert" as const, label: "要注意", count: summary.alert.length, color: "text-amber-600" },
        { key: "good" as const, label: "好調", count: summary.good.length, color: "text-emerald-600" },
        { key: "all" as const, label: "全件", count: summary.alert.length + summary.good.length + summary.noData.length, color: "text-foreground" },
        { key: "no_data" as const, label: "設定なし・データなし", count: summary.noData.length, color: "text-slate-500" },
        { key: "staff" as const, label: "担当者", count: staffSummary.length, color: "text-blue-600" },
    ] as const

    const displayRows =
        activeTab === "all" ? [...summary.alert, ...summary.good, ...summary.noData]
        : activeTab === "alert" ? summary.alert
        : activeTab === "good" ? summary.good
        : activeTab === "no_data" ? summary.noData
        : []

    return (
        <div className="space-y-5">
            {/* サマリーカード + コントロール */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                    <div className="bg-card rounded-xl border border-border p-4" style={{ boxShadow: "var(--shadow-soft)" }}>
                        <div className="text-[11px] text-muted-foreground font-medium mb-1">支援期間目標</div>
                        <div className="text-2xl font-bold text-foreground">{caseTargets.length}</div>
                        <div className="text-[11px] text-muted-foreground mt-1">件設定中</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4" style={{ boxShadow: "var(--shadow-soft)" }}>
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium mb-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            要注意
                        </div>
                        <div className="text-2xl font-bold text-amber-700">{summary.alert.length}</div>
                        <div className="text-[11px] text-amber-600 mt-1">件</div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4" style={{ boxShadow: "var(--shadow-soft)" }}>
                        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            好調
                        </div>
                        <div className="text-2xl font-bold text-emerald-700">{summary.good.length}</div>
                        <div className="text-[11px] text-emerald-600 mt-1">件</div>
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4" style={{ boxShadow: "var(--shadow-soft)" }}>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium mb-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            入社合計
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {[...summary.good, ...summary.alert].reduce((s, a) => s + a.metrics.joined, 0)}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">名（支援期間累計）</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                        href={showAll ? "/analysis" : "/analysis?showAll=1"}
                        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-[12px] font-medium transition-colors ${
                            showAll ? "bg-primary text-primary-foreground border-primary" : "border-input text-muted-foreground hover:bg-muted"
                        }`}
                    >
                        {showAll ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        {showAll ? "全企業表示中" : "支援中のみ"}
                    </Link>
                    <button
                        type="button"
                        onClick={() => setShowSettings(true)}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-input text-[12px] font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                        <Settings className="w-3.5 h-3.5" />
                        設定
                    </button>
                </div>
            </div>

            {/* タブ + テーブル */}
            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-soft)" }}>
                <div className="flex items-center border-b border-border px-4 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-3 text-[12px] font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                                activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {tab.label}
                            <span className={`ml-1.5 text-[11px] ${tab.color} font-semibold`}>{tab.count}</span>
                        </button>
                    ))}
                </div>

                <div className="overflow-x-auto">
                    {activeTab === "staff" ? (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground">担当者</th>
                                    <th className="py-2.5 px-4 text-center text-[11px] font-semibold text-muted-foreground">応募</th>
                                    <th className="py-2.5 px-4 text-center text-[11px] font-semibold text-muted-foreground">内定</th>
                                    <th className="py-2.5 px-4 text-center text-[11px] font-semibold text-muted-foreground">入社</th>
                                    <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground">担当企業</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staffSummary.length === 0 ? (
                                    <tr><td colSpan={5} className="py-12 text-center text-[13px] text-muted-foreground">データがありません</td></tr>
                                ) : (
                                    staffSummary.map((s) => <StaffRow key={s.name} s={s} />)
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground">企業名 / 職種</th>
                                    <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground">判定 / フェーズ</th>
                                    <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground">判定理由</th>
                                    <th className="py-2.5 px-4 text-center text-[11px] font-semibold text-muted-foreground">有効応募</th>
                                    <th className="py-2.5 px-4 text-center text-[11px] font-semibold text-muted-foreground">面接設定</th>
                                    <th className="py-2.5 px-4 text-center text-[11px] font-semibold text-muted-foreground">内定</th>
                                    <th className="py-2.5 px-4 text-center text-[11px] font-semibold text-muted-foreground">入社</th>
                                    <th className="py-2.5 px-4 text-left text-[11px] font-semibold text-muted-foreground">進捗ペース</th>
                                </tr>
                            </thead>
                            <tbody>
                                {displayRows.length === 0 ? (
                                    <tr><td colSpan={8} className="py-12 text-center text-[13px] text-muted-foreground">該当する企業がありません</td></tr>
                                ) : (
                                    displayRows.map((a) => (
                                        <CompanyRow key={`${a.companyId}-${a.caseName ?? "none"}`} a={a} />
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {showSettings && (
                <AnalysisSettingsPanel
                    defaultCriteria={defaultCriteria}
                    caseTargets={caseTargets}
                    companies={allCompanies}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    )
}
