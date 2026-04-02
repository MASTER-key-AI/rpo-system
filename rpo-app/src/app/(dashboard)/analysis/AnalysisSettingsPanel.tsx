"use client"

import { useState, useTransition } from "react"
import { X, Plus, Trash2, Save, ChevronDown, ChevronRight, Building2, CheckCircle2, XCircle } from "lucide-react"
import type { WeeklyCriteria, CaseTarget } from "@/lib/actions/analysis"
import {
    saveDefaultCriteria,
    upsertCompanyCaseTarget,
    deleteCompanyCaseTarget,
    updateCompanySupportStatus,
} from "@/lib/actions/analysis"

const METRIC_OPTIONS = ["有効応募", "面接設定", "面接実施", "内定", "入社", "応募", "通電"]

const PHASE_LABEL: Record<1 | 2 | 3 | 4, string> = {
    1: "Phase1（0〜25%）",
    2: "Phase2（25〜50%）",
    3: "Phase3（50〜75%）",
    4: "Phase4（75〜100%）",
}

type LocalCriteria = {
    weekNum: 1 | 2 | 3 | 4
    condition1Metric: string
    condition1Value: number
    condition2Metric: string | null
    condition2Value: number
    logic: "OR" | "AND"
}

type CompanyWithStatus = {
    id: string
    name: string
    supportStatus: string
}

type Props = {
    defaultCriteria: WeeklyCriteria[]
    caseTargets: CaseTarget[]
    companies: CompanyWithStatus[]
    onClose: () => void
}

// 支援目標のステータスを返す
function getTargetStatus(startDate: string, endDate: string): "active" | "pending" | "ended" {
    const today = new Date()
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (today > end) return "ended"
    if (today >= start) return "active"
    return "pending"
}

// 後方互換
function isActiveTarget(startDate: string, endDate: string): boolean {
    return getTargetStatus(startDate, endDate) === "active"
}

// 企業に紐づくcase targetsを返す
function getCaseTargetsForCompany(companyId: string, caseTargets: CaseTarget[]): CaseTarget[] {
    return caseTargets
        .filter((t) => t.companyId === companyId)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)) // 新しい順
}

export default function AnalysisSettingsPanel({ defaultCriteria, caseTargets: initialCaseTargets, companies, onClose }: Props) {
    const [activeSection, setActiveSection] = useState<"criteria" | "caseTargets" | "companyManagement">("companyManagement")
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState<string | null>(null)

    function showMessage(msg: string) {
        setMessage(msg)
        setTimeout(() => setMessage(null), 3000)
    }

    // ====================================================================
    // 判定基準 state
    // ====================================================================
    const [localCriteria, setLocalCriteria] = useState<LocalCriteria[]>(() => {
        const phases: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4]
        return phases.map((w) => {
            const existing = defaultCriteria.find((c) => c.companyId === null && c.weekNum === w)
            return {
                weekNum: w,
                condition1Metric: existing?.condition1Metric ?? "有効応募",
                condition1Value: existing?.condition1Value ?? 1,
                condition2Metric: existing?.condition2Metric ?? null,
                condition2Value: existing?.condition2Value ?? 0,
                logic: existing?.logic ?? "OR",
            }
        })
    })

    function handleCriteriaChange(weekNum: number, field: keyof LocalCriteria, value: string | number | null) {
        setLocalCriteria((prev) => prev.map((c) => (c.weekNum === weekNum ? { ...c, [field]: value } : c)))
    }

    function handleSaveCriteria() {
        startTransition(async () => {
            await saveDefaultCriteria(localCriteria)
            showMessage("判定基準を保存しました")
        })
    }

    // ====================================================================
    // 支援期間目標 state
    // ====================================================================
    const [caseTargets, setCaseTargets] = useState<CaseTarget[]>(initialCaseTargets)
    const [newTarget, setNewTarget] = useState({
        companyId: companies[0]?.id ?? "",
        caseName: "",
        startDate: "",
        endDate: "",
        targetHires: 1,
    })

    type ConflictState = { existing: CaseTarget; newData: typeof newTarget }
    const [conflict, setConflict] = useState<ConflictState | null>(null)

    // デフォルトで全企業を展開
    const [expandedTargetCompanies, setExpandedTargetCompanies] = useState<Set<string>>(
        () => new Set(companies.map((c) => c.id))
    )

    function toggleTargetCompany(companyId: string) {
        setExpandedTargetCompanies((prev) => {
            const next = new Set(prev)
            if (next.has(companyId)) next.delete(companyId)
            else next.add(companyId)
            return next
        })
    }

    function datesOverlap(s1: string, e1: string, s2: string, e2: string) {
        return s1 <= e2 && e1 >= s2
    }

    function handleAddCaseTarget() {
        if (!newTarget.companyId || !newTarget.caseName || !newTarget.startDate || !newTarget.endDate) return

        // 同じ企業×職種で期間が重複するものを探す
        const overlapping = caseTargets.find(
            (t) =>
                t.companyId === newTarget.companyId &&
                t.caseName === newTarget.caseName &&
                datesOverlap(t.startDate, t.endDate, newTarget.startDate, newTarget.endDate)
        )

        if (overlapping) {
            setConflict({ existing: overlapping, newData: newTarget })
            return
        }

        doAddCaseTarget(newTarget)
    }

    function doAddCaseTarget(data: typeof newTarget) {
        startTransition(async () => {
            await upsertCompanyCaseTarget(data)
            showMessage("支援期間目標を追加しました")
            setNewTarget({ companyId: companies[0]?.id ?? "", caseName: "", startDate: "", endDate: "", targetHires: 1 })
            setConflict(null)
        })
    }

    function handleReplaceWithNew() {
        if (!conflict) return
        startTransition(async () => {
            await deleteCompanyCaseTarget(conflict.existing.id)
            setCaseTargets((prev) => prev.filter((t) => t.id !== conflict.existing.id))
            await upsertCompanyCaseTarget(conflict.newData)
            showMessage("既存の目標を削除して新規を登録しました")
            setNewTarget({ companyId: companies[0]?.id ?? "", caseName: "", startDate: "", endDate: "", targetHires: 1 })
            setConflict(null)
        })
    }

    function handleDeleteCaseTarget(id: string) {
        startTransition(async () => {
            await deleteCompanyCaseTarget(id)
            setCaseTargets((prev) => prev.filter((t) => t.id !== id))
            showMessage("削除しました")
        })
    }

    // ====================================================================
    // 企業管理 state
    // ====================================================================
    const [companyStatuses, setCompanyStatuses] = useState<Record<string, string>>(
        () => Object.fromEntries(companies.map((c) => [c.id, c.supportStatus]))
    )
    const [expandedCompanyId, setExpandedCompanyId] = useState<string | null>(null)

    function handleToggleSupportStatus(companyId: string) {
        const current = companyStatuses[companyId] ?? "支援中"
        const next = current === "支援中" ? "支援終了" : "支援中"
        startTransition(async () => {
            await updateCompanySupportStatus(companyId, next as "支援中" | "支援終了")
            setCompanyStatuses((prev) => ({ ...prev, [companyId]: next }))
            showMessage(`支援ステータスを「${next}」に変更しました`)
        })
    }

    function toggleExpand(companyId: string) {
        setExpandedCompanyId((prev) => (prev === companyId ? null : companyId))
    }

    // ====================================================================
    // 表示フィルタ（企業管理タブ）
    // ====================================================================
    const [showEndedCompanies, setShowEndedCompanies] = useState(false)

    const filteredCompanies = companies.filter((c) => {
        const status = companyStatuses[c.id] ?? "支援中"
        return showEndedCompanies ? true : status === "支援中"
    })

    // ====================================================================
    // レンダリング
    // ====================================================================
    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-background border-l border-border shadow-2xl flex flex-col h-full overflow-hidden">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
                    <h2 className="text-base font-semibold text-foreground">分析設定</h2>
                    <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted transition-colors cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Section tabs */}
                <div className="flex border-b border-border flex-shrink-0">
                    {([
                        { key: "companyManagement" as const, label: "企業管理" },
                        { key: "caseTargets" as const, label: "支援期間目標" },
                        { key: "criteria" as const, label: "判定基準" },
                    ]).map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveSection(tab.key)}
                            className={`flex-1 py-2.5 text-[12px] font-medium border-b-2 transition-colors cursor-pointer ${
                                activeSection === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Message */}
                {message && (
                    <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-[12px] text-emerald-700 flex-shrink-0">
                        {message}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                    {/* ================================================================
                        企業管理タブ
                    ================================================================ */}
                    {activeSection === "companyManagement" && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-[12px] text-muted-foreground">
                                    支援ステータスの変更と、職種ごとの支援目標履歴を確認できます。
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowEndedCompanies((p) => !p)}
                                    className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors cursor-pointer flex-shrink-0 ${
                                        showEndedCompanies
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-input text-muted-foreground hover:bg-muted"
                                    }`}
                                >
                                    {showEndedCompanies ? "支援終了も表示中" : "支援中のみ"}
                                </button>
                            </div>

                            {filteredCompanies.length === 0 && (
                                <p className="text-[12px] text-muted-foreground text-center py-8">企業がありません</p>
                            )}

                            <div className="space-y-2">
                                {filteredCompanies.map((company) => {
                                    const status = companyStatuses[company.id] ?? "支援中"
                                    const isActive = status === "支援中"
                                    const isExpanded = expandedCompanyId === company.id
                                    const targets = getCaseTargetsForCompany(company.id, caseTargets)

                                    return (
                                        <div key={company.id} className="border border-border rounded-lg overflow-hidden">
                                            {/* 企業ヘッダー行 */}
                                            <div className="flex items-center gap-3 px-4 py-3 bg-card">
                                                {/* 展開ボタン */}
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(company.id)}
                                                    className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex-shrink-0"
                                                >
                                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                </button>

                                                {/* 企業名 */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                                        <span className="text-[13px] font-medium text-foreground truncate">{company.name}</span>
                                                    </div>
                                                    {targets.length > 0 && (
                                                        <div className="text-[10px] text-muted-foreground mt-0.5 ml-5.5">
                                                            {targets.length}件の支援目標
                                                        </div>
                                                    )}
                                                </div>

                                                {/* ステータスバッジ */}
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border flex-shrink-0 ${
                                                    isActive
                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                                        : "bg-slate-50 border-slate-200 text-slate-500"
                                                }`}>
                                                    {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                    {status}
                                                </span>

                                                {/* ステータス切り替えボタン */}
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSupportStatus(company.id)}
                                                    disabled={isPending}
                                                    className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0 ${
                                                        isActive
                                                            ? "border-slate-200 text-slate-500 hover:bg-slate-50"
                                                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                                    }`}
                                                >
                                                    {isActive ? "支援終了にする" : "支援再開"}
                                                </button>
                                            </div>

                                            {/* 支援目標履歴（展開時） */}
                                            {isExpanded && (
                                                <div className="border-t border-border bg-muted/20 px-4 py-3 space-y-2">
                                                    {targets.length === 0 ? (
                                                        <p className="text-[12px] text-muted-foreground text-center py-2">
                                                            支援期間目標が設定されていません
                                                        </p>
                                                    ) : (
                                                        targets.map((t) => {
                                                            const active = isActiveTarget(t.startDate, t.endDate)
                                                            const today = new Date()
                                                            const end = new Date(t.endDate)
                                                            const ended = today > end
                                                            return (
                                                                <div key={t.id} className={`rounded-lg p-3 border text-[12px] ${
                                                                    active
                                                                        ? "bg-primary/5 border-primary/20"
                                                                        : ended
                                                                            ? "bg-muted/40 border-border opacity-70"
                                                                            : "bg-card border-border"
                                                                }`}>
                                                                    <div className="flex items-start justify-between gap-2">
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="font-medium text-foreground flex items-center gap-1.5">
                                                                                {active && (
                                                                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                                                                                )}
                                                                                {t.caseName}
                                                                                {active && (
                                                                                    <span className="text-[10px] text-primary font-normal">支援中</span>
                                                                                )}
                                                                                {ended && (
                                                                                    <span className="text-[10px] text-muted-foreground font-normal">終了</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-muted-foreground mt-0.5">
                                                                                {t.startDate} 〜 {t.endDate}
                                                                            </div>
                                                                            <div className="text-muted-foreground">
                                                                                目標採用: <span className="font-medium text-foreground">{t.targetHires}名</span>
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteCaseTarget(t.id)}
                                                                            disabled={isPending}
                                                                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* ================================================================
                        支援期間目標タブ
                    ================================================================ */}
                    {activeSection === "caseTargets" && (
                        <div className="space-y-4">

                            {/* 新規追加フォーム（最上部） */}
                            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                                <div className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                                    <Plus className="w-3.5 h-3.5 text-primary" />
                                    新規目標追加
                                </div>
                                <div className="space-y-2">
                                    <select
                                        value={newTarget.companyId}
                                        onChange={(e) => setNewTarget((p) => ({ ...p, companyId: e.target.value }))}
                                        className="w-full text-[12px] border border-input rounded-md px-2 py-1.5 bg-background"
                                    >
                                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="職種名（例: 正社員・介護士）"
                                        value={newTarget.caseName}
                                        onChange={(e) => setNewTarget((p) => ({ ...p, caseName: e.target.value }))}
                                        className="w-full text-[12px] border border-input rounded-md px-2 py-1.5 bg-background"
                                    />
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-muted-foreground block mb-1">支援開始日</label>
                                            <input
                                                type="date"
                                                value={newTarget.startDate}
                                                onChange={(e) => setNewTarget((p) => ({ ...p, startDate: e.target.value }))}
                                                className="w-full text-[12px] border border-input rounded-md px-2 py-1.5 bg-background"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-[10px] text-muted-foreground block mb-1">支援終了日</label>
                                            <input
                                                type="date"
                                                value={newTarget.endDate}
                                                onChange={(e) => setNewTarget((p) => ({ ...p, endDate: e.target.value }))}
                                                className="w-full text-[12px] border border-input rounded-md px-2 py-1.5 bg-background"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[12px] text-muted-foreground">採用目標数:</label>
                                        <input
                                            type="number" min={1}
                                            value={newTarget.targetHires}
                                            onChange={(e) => setNewTarget((p) => ({ ...p, targetHires: Number(e.target.value) }))}
                                            className="w-20 text-[12px] border border-input rounded-md px-2 py-1.5 bg-background"
                                        />
                                        <span className="text-[12px] text-muted-foreground">名</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddCaseTarget}
                                    disabled={isPending || !newTarget.caseName || !newTarget.startDate || !newTarget.endDate}
                                    className="w-full h-8 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    {isPending ? "追加中..." : "追加"}
                                </button>
                            </div>

                            {/* 重複エラー */}
                            {conflict && (
                                <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 space-y-3">
                                    <p className="text-[12px] font-semibold text-amber-800">期間が重複する目標があります</p>
                                    <div className="text-[11px] text-amber-700 space-y-1">
                                        <p>既存: {conflict.existing.startDate} 〜 {conflict.existing.endDate}（目標 {conflict.existing.targetHires}名）</p>
                                        <p>新規: {conflict.newData.startDate} 〜 {conflict.newData.endDate}（目標 {conflict.newData.targetHires}名）</p>
                                    </div>
                                    <p className="text-[11px] text-amber-700">どちらを「適用中」にしますか？</p>
                                    <div className="flex gap-2 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={handleReplaceWithNew}
                                            disabled={isPending}
                                            className="h-7 px-3 rounded-md bg-amber-600 text-white text-[11px] font-medium hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                                        >
                                            既存を削除して新規を登録
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConflict(null)}
                                            className="h-7 px-3 rounded-md border border-input text-[11px] text-muted-foreground hover:bg-muted cursor-pointer"
                                        >
                                            キャンセル（既存を維持）
                                        </button>
                                    </div>
                                </div>
                            )}

                            <p className="text-[11px] text-muted-foreground">
                                企業×職種ごとの支援期間目標一覧（判定基準は目標採用数に応じて自動スケール）
                            </p>

                            {/* 企業ごとのアコーディオン */}
                            {companies.length === 0 && (
                                <p className="text-[12px] text-muted-foreground text-center py-4">企業がありません</p>
                            )}
                            <div className="space-y-2">
                                {companies.map((company) => {
                                    const targets = getCaseTargetsForCompany(company.id, caseTargets)
                                    const isExpanded = expandedTargetCompanies.has(company.id)

                                    // 職種ごとにグループ化
                                    const caseNameMap = new Map<string, CaseTarget[]>()
                                    for (const t of targets) {
                                        if (!caseNameMap.has(t.caseName)) caseNameMap.set(t.caseName, [])
                                        caseNameMap.get(t.caseName)!.push(t)
                                    }
                                    // 各職種内をactive→pending→endedでソート
                                    for (const [, items] of caseNameMap) {
                                        const rank = { active: 0, pending: 1, ended: 2 }
                                        items.sort((a, b) => rank[getTargetStatus(a.startDate, a.endDate)] - rank[getTargetStatus(b.startDate, b.endDate)])
                                    }

                                    const activeCount = targets.filter((t) => getTargetStatus(t.startDate, t.endDate) === "active").length

                                    return (
                                        <div key={company.id} className="border border-border rounded-lg overflow-hidden">
                                            {/* 企業ヘッダー */}
                                            <button
                                                type="button"
                                                onClick={() => toggleTargetCompany(company.id)}
                                                className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/30 transition-colors cursor-pointer text-left"
                                            >
                                                {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                                                <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                                <span className="flex-1 text-[13px] font-medium text-foreground truncate">{company.name}</span>
                                                {activeCount > 0 && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-primary text-primary-foreground flex-shrink-0">
                                                        適用中 {activeCount}
                                                    </span>
                                                )}
                                                {targets.length === 0 && (
                                                    <span className="text-[10px] text-muted-foreground flex-shrink-0">未設定</span>
                                                )}
                                            </button>

                                            {/* 職種リスト（展開時） */}
                                            {isExpanded && (
                                                <div className="border-t border-border bg-muted/10 divide-y divide-border/50">
                                                    {targets.length === 0 ? (
                                                        <p className="text-[12px] text-muted-foreground text-center py-3">
                                                            支援期間目標が設定されていません
                                                        </p>
                                                    ) : (
                                                        Array.from(caseNameMap.entries()).map(([caseName, items]) => (
                                                            <div key={caseName} className="px-4 py-3 space-y-2">
                                                                <div className="text-[11px] font-semibold text-muted-foreground">{caseName}</div>
                                                                {items.map((t) => {
                                                                    const status = getTargetStatus(t.startDate, t.endDate)
                                                                    return (
                                                                        <div
                                                                            key={t.id}
                                                                            className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 border text-[11px] ${
                                                                                status === "active"
                                                                                    ? "bg-primary/5 border-primary/30"
                                                                                    : status === "ended"
                                                                                        ? "bg-muted/20 border-border opacity-60"
                                                                                        : "bg-card border-border"
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${
                                                                                    status === "active"
                                                                                        ? "bg-primary text-primary-foreground"
                                                                                        : status === "ended"
                                                                                            ? "bg-muted text-muted-foreground"
                                                                                            : "bg-sky-100 text-sky-700 border border-sky-200"
                                                                                }`}>
                                                                                    {status === "active" ? "適用中" : status === "ended" ? "終了済み" : "未開始"}
                                                                                </span>
                                                                                <span className="text-muted-foreground truncate">
                                                                                    {t.startDate} 〜 {t.endDate}
                                                                                </span>
                                                                                <span className="text-foreground font-medium flex-shrink-0">目標 {t.targetHires}名</span>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDeleteCaseTarget(t.id)}
                                                                                disabled={isPending}
                                                                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                                                                            >
                                                                                <Trash2 className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                        </div>
                    )}

                    {/* ================================================================
                        判定基準タブ
                    ================================================================ */}
                    {activeSection === "criteria" && (
                        <div className="space-y-5">
                            <div className="text-[12px] text-muted-foreground space-y-1">
                                <p>支援期間の経過割合に応じて4フェーズで判定します。</p>
                                <p className="text-amber-600 bg-amber-50 rounded-md px-2 py-1.5 border border-amber-100">
                                    基準値は目標採用数に比例して自動スケールされます。<br />
                                    （例: 目標3名 → 基準値が3倍）
                                </p>
                            </div>
                            {localCriteria.map((c) => (
                                <div key={c.weekNum} className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border">
                                    <div className="text-[12px] font-semibold text-foreground">{PHASE_LABEL[c.weekNum]}</div>

                                    {/* 条件1 */}
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <select
                                            value={c.condition1Metric}
                                            onChange={(e) => handleCriteriaChange(c.weekNum, "condition1Metric", e.target.value)}
                                            className="text-[12px] border border-input rounded-md px-2 py-1 bg-background"
                                        >
                                            {METRIC_OPTIONS.map((m) => <option key={m}>{m}</option>)}
                                        </select>
                                        <input
                                            type="number" min={0}
                                            value={c.condition1Value}
                                            onChange={(e) => handleCriteriaChange(c.weekNum, "condition1Value", Number(e.target.value))}
                                            className="w-16 text-[12px] border border-input rounded-md px-2 py-1 bg-background"
                                        />
                                        <span className="text-[11px] text-muted-foreground">件以上（×目標数）</span>
                                    </div>

                                    {/* OR/AND ピルトグル（条件2がある場合のみ） */}
                                    {c.condition2Metric && (
                                        <div className="flex justify-center">
                                            <div className="flex rounded-full border border-border overflow-hidden text-[11px]">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCriteriaChange(c.weekNum, "logic", "OR")}
                                                    className={`px-3 py-1 transition-colors cursor-pointer ${
                                                        c.logic === "OR"
                                                            ? "bg-primary text-primary-foreground font-semibold"
                                                            : "text-muted-foreground hover:bg-muted"
                                                    }`}
                                                >
                                                    または
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCriteriaChange(c.weekNum, "logic", "AND")}
                                                    className={`px-3 py-1 transition-colors cursor-pointer ${
                                                        c.logic === "AND"
                                                            ? "bg-primary text-primary-foreground font-semibold"
                                                            : "text-muted-foreground hover:bg-muted"
                                                    }`}
                                                >
                                                    かつ
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* 条件2（設定済みの場合） */}
                                    {c.condition2Metric && (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <select
                                                value={c.condition2Metric}
                                                onChange={(e) => handleCriteriaChange(c.weekNum, "condition2Metric", e.target.value || null)}
                                                className="text-[12px] border border-input rounded-md px-2 py-1 bg-background"
                                            >
                                                {METRIC_OPTIONS.map((m) => <option key={m}>{m}</option>)}
                                            </select>
                                            <input
                                                type="number" min={0}
                                                value={c.condition2Value}
                                                onChange={(e) => handleCriteriaChange(c.weekNum, "condition2Value", Number(e.target.value))}
                                                className="w-16 text-[12px] border border-input rounded-md px-2 py-1 bg-background"
                                            />
                                            <span className="text-[11px] text-muted-foreground">件以上（×目標数）</span>
                                            <button
                                                type="button"
                                                onClick={() => handleCriteriaChange(c.weekNum, "condition2Metric", null)}
                                                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                                                title="条件2を削除"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}

                                    {/* 条件2なし → 追加ボタン */}
                                    {!c.condition2Metric && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                handleCriteriaChange(c.weekNum, "condition2Metric", METRIC_OPTIONS[0])
                                                handleCriteriaChange(c.weekNum, "condition2Value", 1)
                                            }}
                                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                        >
                                            <Plus className="w-3 h-3" />
                                            条件を追加
                                        </button>
                                    )}
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={handleSaveCriteria}
                                disabled={isPending}
                                className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
                            >
                                <Save className="w-3.5 h-3.5" />
                                {isPending ? "保存中..." : "判定基準を保存"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
