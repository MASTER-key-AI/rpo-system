"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { ChevronDown, Layers, Search } from "lucide-react"

type CompanyOption = {
    id: string
    name: string
}

type CompanyGroup = {
    label: string
    ids: string[]
}

type Props = {
    companies: CompanyOption[]
    selectedCompanyIds?: string[]
    groups?: CompanyGroup[]
}

export default function CompanyFilterSelect({ companies, selectedCompanyIds = [], groups = [] }: Props) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [isOpen, setIsOpen] = useState(false)
    const [keyword, setKeyword] = useState("")

    const normalizedSelectedIds = useMemo(
        () =>
            Array.from(
                new Set(
                    selectedCompanyIds
                        .map((id) => id.trim())
                        .filter((id) => id.length > 0),
                ),
            ),
        [selectedCompanyIds],
    )

    const selectedSet = useMemo(() => new Set(normalizedSelectedIds), [normalizedSelectedIds])
    const companyNameMap = useMemo(
        () => new Map(companies.map((company) => [company.id, company.name])),
        [companies],
    )

    const filteredCompanies = useMemo(() => {
        const q = keyword.trim().toLowerCase()
        if (!q) return companies
        return companies.filter((company) => company.name.toLowerCase().includes(q))
    }, [companies, keyword])

    // フィルタキーワードにマッチするグループも絞り込む
    const filteredGroups = useMemo(() => {
        const q = keyword.trim().toLowerCase()
        if (!q) return groups
        return groups.filter((g) => g.label.toLowerCase().includes(q))
    }, [groups, keyword])

    // 選択中のグループを検出（全IDが選択済みの場合）
    const activeGroupLabel = useMemo(() => {
        if (normalizedSelectedIds.length === 0) return null
        for (const g of groups) {
            if (
                g.ids.length > 0 &&
                g.ids.length === normalizedSelectedIds.length &&
                g.ids.every((id) => selectedSet.has(id))
            ) {
                return g.label
            }
        }
        return null
    }, [groups, normalizedSelectedIds, selectedSet])

    const buttonLabel = useMemo(() => {
        if (normalizedSelectedIds.length === 0) return "全ての企業"
        if (activeGroupLabel) return activeGroupLabel
        if (normalizedSelectedIds.length === 1) {
            return companyNameMap.get(normalizedSelectedIds[0]) || "1社を選択中"
        }
        return `${normalizedSelectedIds.length}社を選択中`
    }, [activeGroupLabel, companyNameMap, normalizedSelectedIds])

    const applyCompanyIds = (ids: string[]) => {
        const params = new URLSearchParams(searchParams.toString())
        if (ids.length > 0) {
            params.set("companyIds", ids.join(","))
        } else {
            params.delete("companyIds")
        }
        params.delete("companyId")
        params.delete("page")
        const nextQuery = params.toString()
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname)
    }

    const selectGroup = (group: CompanyGroup) => {
        // 既に全IDが選択中なら解除、そうでなければ選択
        const allSelected = group.ids.length > 0 && group.ids.every((id) => selectedSet.has(id))
        applyCompanyIds(allSelected ? [] : group.ids)
    }

    const toggleCompany = (companyId: string) => {
        const nextSet = new Set(normalizedSelectedIds)
        if (nextSet.has(companyId)) nextSet.delete(companyId)
        else nextSet.add(companyId)
        applyCompanyIds(Array.from(nextSet))
    }

    const clearSelection = () => applyCompanyIds([])

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-input bg-background cursor-pointer text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200 min-w-[190px]"
            >
                <span className="truncate">{buttonLabel}</span>
                <span className="inline-flex items-center justify-center ml-auto">
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </span>
            </button>

            {isOpen ? (
                <div className="absolute right-0 mt-2 w-[320px] rounded-xl border border-border bg-card shadow-lg z-40 p-2">
                    <div className="relative mb-2">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            value={keyword}
                            onChange={(event) => setKeyword(event.currentTarget.value)}
                            placeholder="企業名・グループで検索..."
                            className="w-full h-8 pl-8 pr-2 rounded-md border border-input bg-background text-[12px] focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                    </div>

                    <div className="max-h-72 overflow-auto rounded-md border border-border/60 bg-background/40">
                        {/* グループ選択セクション */}
                        {filteredGroups.length > 0 && (
                            <>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 border-b border-border/60">
                                    <Layers className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">グループ選択</span>
                                </div>
                                {filteredGroups.map((group) => {
                                    const isActive = group.ids.length > 0 && group.ids.every((id) => selectedSet.has(id))
                                    return (
                                        <button
                                            key={group.label}
                                            type="button"
                                            onClick={() => selectGroup(group)}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors cursor-pointer ${
                                                isActive
                                                    ? "bg-primary/10 text-primary font-medium"
                                                    : "hover:bg-muted/60 text-foreground"
                                            }`}
                                        >
                                            <Layers className={`w-3 h-3 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                                            <span className="flex-1 truncate">{group.label}</span>
                                            <span className={`text-[10px] shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                                                {group.ids.length}社
                                            </span>
                                        </button>
                                    )
                                })}
                                {/* 個別企業との区切り */}
                                {(keyword ? filteredCompanies : companies).length > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 border-y border-border/60">
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">個別企業</span>
                                    </div>
                                )}
                            </>
                        )}

                        {/* 個別企業リスト */}
                        {filteredCompanies.length === 0 && filteredGroups.length === 0 ? (
                            <p className="px-3 py-2 text-[12px] text-muted-foreground">該当する企業がありません</p>
                        ) : (
                            filteredCompanies.map((company) => (
                                <label
                                    key={company.id}
                                    className="flex items-center gap-2 px-3 py-2 text-[12px] hover:bg-muted/60 cursor-pointer"
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedSet.has(company.id)}
                                        onChange={() => toggleCompany(company.id)}
                                        className="h-3.5 w-3.5"
                                    />
                                    <span className="truncate">{company.name}</span>
                                </label>
                            ))
                        )}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="h-8 px-3 rounded-md text-[12px] border border-input hover:bg-muted transition-colors"
                        >
                            クリア
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="h-8 px-3 rounded-md text-[12px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            閉じる
                        </button>
                    </div>
                </div>
            ) : null}

            <noscript>
                <button type="button" className="sr-only">
                    企業フィルタ
                </button>
            </noscript>
        </div>
    )
}
