"use client"

import { useRef, useState, useTransition } from "react"
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical, ArrowUp, ArrowDown, Search, X } from "lucide-react"
import { addCompanyCaseOption, deleteCompanyCaseOption, reorderCompanyCaseOption } from "@/lib/actions/caseOptions"

type Company = { id: string; name: string }
type CaseOption = { id: string; caseName: string; displayOrder: number }

type Props = {
    companies: Company[]
    caseOptions: Record<string, CaseOption[]>
}

export default function JobTypesClient({ companies, caseOptions }: Props) {
    const [expanded, setExpanded] = useState<Set<string>>(() => {
        // Default expand companies that already have options
        const ids = new Set<string>()
        for (const id of Object.keys(caseOptions)) ids.add(id)
        return ids
    })
    const [addingFor, setAddingFor] = useState<string | null>(null)
    const [newCaseName, setNewCaseName] = useState("")
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    // Company search combobox
    const [searchInput, setSearchInput] = useState("")
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
    const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const searchRef = useRef<HTMLInputElement>(null)

    // Local optimistic state
    const [localOptions, setLocalOptions] = useState<Record<string, CaseOption[]>>(() => {
        const copy: Record<string, CaseOption[]> = {}
        for (const [k, v] of Object.entries(caseOptions)) copy[k] = [...v]
        return copy
    })

    function toggleExpand(id: string) {
        setExpanded((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function handleStartAdd(companyId: string) {
        setAddingFor(companyId)
        setNewCaseName("")
        setError(null)
        if (!expanded.has(companyId)) {
            setExpanded((prev) => new Set([...prev, companyId]))
        }
    }

    function handleAdd(companyId: string) {
        const trimmed = newCaseName.trim()
        if (!trimmed) {
            setError("職種名を入力してください")
            return
        }
        setError(null)

        startTransition(async () => {
            try {
                await addCompanyCaseOption(companyId, trimmed)
                const existing = localOptions[companyId] ?? []
                const maxOrder = existing.length > 0 ? Math.max(...existing.map((o) => o.displayOrder)) : -1
                setLocalOptions((prev) => ({
                    ...prev,
                    [companyId]: [
                        ...(prev[companyId] ?? []),
                        { id: `tmp-${Date.now()}`, caseName: trimmed, displayOrder: maxOrder + 1 },
                    ],
                }))
                setAddingFor(null)
                setNewCaseName("")
            } catch (e) {
                setError(e instanceof Error ? e.message : "追加に失敗しました")
            }
        })
    }

    function handleDelete(companyId: string, optionId: string) {
        startTransition(async () => {
            try {
                await deleteCompanyCaseOption(optionId)
                setLocalOptions((prev) => ({
                    ...prev,
                    [companyId]: (prev[companyId] ?? []).filter((o) => o.id !== optionId),
                }))
            } catch (e) {
                setError(e instanceof Error ? e.message : "削除に失敗しました")
            }
        })
    }

    function handleReorder(companyId: string, optionId: string, direction: "up" | "down") {
        startTransition(async () => {
            try {
                await reorderCompanyCaseOption(optionId, direction)
                setLocalOptions((prev) => {
                    const list = [...(prev[companyId] ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
                    const idx = list.findIndex((o) => o.id === optionId)
                    const swapIdx = direction === "up" ? idx - 1 : idx + 1
                    if (swapIdx < 0 || swapIdx >= list.length) return prev
                    const tmp = list[idx].displayOrder
                    list[idx] = { ...list[idx], displayOrder: list[swapIdx].displayOrder }
                    list[swapIdx] = { ...list[swapIdx], displayOrder: tmp }
                    return { ...prev, [companyId]: list }
                })
            } catch (e) {
                setError(e instanceof Error ? e.message : "並び替えに失敗しました")
            }
        })
    }

    const sortedCompanies = [...companies].sort((a, b) => {
        const aHas = (localOptions[a.id]?.length ?? 0) > 0
        const bHas = (localOptions[b.id]?.length ?? 0) > 0
        if (aHas && !bHas) return -1
        if (!aHas && bHas) return 1
        return a.name.localeCompare(b.name, "ja")
    })

    const searchSuggestions = searchInput.trim()
        ? sortedCompanies.filter((c) => c.name.toLowerCase().includes(searchInput.trim().toLowerCase())).slice(0, 10)
        : []

    function handleSelectCompany(company: Company) {
        setSearchInput(company.name)
        setSelectedCompanyId(company.id)
        setShowDropdown(false)
        // expand and scroll
        setExpanded((prev) => new Set([...prev, company.id]))
        setTimeout(() => {
            cardRefs.current[company.id]?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 50)
    }

    function handleClearSearch() {
        setSearchInput("")
        setSelectedCompanyId(null)
        setShowDropdown(false)
        searchRef.current?.focus()
    }

    const visibleCompanies = selectedCompanyId
        ? sortedCompanies.filter((c) => c.id === selectedCompanyId)
        : sortedCompanies

    return (
        <div className="space-y-2">
            {/* 企業名検索 */}
            <div className="relative w-full max-w-sm mb-4">
                <div className="relative flex items-center">
                    <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={searchInput}
                        onChange={(e) => {
                            setSearchInput(e.target.value)
                            setSelectedCompanyId(null)
                            setShowDropdown(true)
                        }}
                        onFocus={() => { if (searchInput.trim()) setShowDropdown(true) }}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") handleClearSearch()
                            if (e.key === "Enter" && searchSuggestions.length === 1) handleSelectCompany(searchSuggestions[0])
                        }}
                        placeholder="企業名で検索..."
                        className="w-full h-9 pl-9 pr-8 rounded-lg border border-input bg-background text-[13px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                    />
                    {searchInput && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="absolute right-2.5 w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                {showDropdown && searchSuggestions.length > 0 && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                        {searchSuggestions.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onMouseDown={() => handleSelectCompany(c)}
                                className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted transition-colors flex items-center justify-between gap-2"
                            >
                                <span className="truncate">{c.name}</span>
                                <span className="text-[11px] text-muted-foreground shrink-0">
                                    {(localOptions[c.id]?.length ?? 0) > 0
                                        ? `${localOptions[c.id].length}件`
                                        : "未設定"}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
                {selectedCompanyId && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                        1件を表示中 ·{" "}
                        <button type="button" onClick={handleClearSearch} className="underline hover:text-foreground cursor-pointer">
                            全て表示
                        </button>
                    </p>
                )}
            </div>

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-[12px] text-destructive">
                    {error}
                </div>
            )}

            {visibleCompanies.map((company) => {
                const options = [...(localOptions[company.id] ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
                const isExpanded = expanded.has(company.id)
                const isAdding = addingFor === company.id

                return (
                    <div
                        key={company.id}
                        ref={(el) => { cardRefs.current[company.id] = el }}
                        className="bg-card border border-border rounded-xl overflow-hidden"
                        style={{ boxShadow: "var(--shadow-soft)" }}
                    >
                        {/* Header */}
                        <div className="flex items-center gap-3 px-4 py-3">
                            <button
                                type="button"
                                onClick={() => toggleExpand(company.id)}
                                className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer"
                            >
                                {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                )}
                                <span className="text-[13px] font-medium text-foreground truncate">{company.name}</span>
                                <span className="ml-1 text-[11px] text-muted-foreground shrink-0">
                                    {options.length > 0 ? `${options.length}件` : "未設定"}
                                </span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handleStartAdd(company.id)}
                                disabled={isPending}
                                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-primary/10 text-primary text-[12px] font-medium hover:bg-primary/20 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                追加
                            </button>
                        </div>

                        {/* Body */}
                        {isExpanded && (
                            <div className="border-t border-border px-4 pb-3 pt-2 space-y-1.5">
                                {options.length === 0 && !isAdding && (
                                    <p className="text-[12px] text-muted-foreground py-1">
                                        職種が設定されていません。「追加」から登録してください。
                                    </p>
                                )}

                                {options.map((opt, idx) => (
                                    <div
                                        key={opt.id}
                                        className="flex items-center gap-2 group py-1"
                                    >
                                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                                        <span className="flex-1 text-[13px] text-foreground">{opt.caseName}</span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={() => handleReorder(company.id, opt.id, "up")}
                                                disabled={isPending || idx === 0}
                                                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer"
                                                title="上へ"
                                            >
                                                <ArrowUp className="w-3 h-3" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleReorder(company.id, opt.id, "down")}
                                                disabled={isPending || idx === options.length - 1}
                                                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors cursor-pointer"
                                                title="下へ"
                                            >
                                                <ArrowDown className="w-3 h-3" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(company.id, opt.id)}
                                                disabled={isPending}
                                                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer disabled:opacity-50"
                                                title="削除"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                ))}

                                {/* Add form */}
                                {isAdding && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <input
                                            type="text"
                                            value={newCaseName}
                                            onChange={(e) => setNewCaseName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") { e.preventDefault(); handleAdd(company.id) }
                                                if (e.key === "Escape") { setAddingFor(null); setNewCaseName("") }
                                            }}
                                            placeholder="職種名を入力（例：営業）"
                                            autoFocus
                                            className="flex-1 h-8 px-3 rounded-lg border border-input bg-background text-[13px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAdd(company.id)}
                                            disabled={isPending}
                                            className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                                        >
                                            登録
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setAddingFor(null); setNewCaseName("") }}
                                            className="h-8 px-3 rounded-lg border border-input text-[12px] text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                                        >
                                            キャンセル
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
