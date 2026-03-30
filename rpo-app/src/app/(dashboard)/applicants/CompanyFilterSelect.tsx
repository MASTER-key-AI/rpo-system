"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { ChevronDown, Search } from "lucide-react"

type CompanyOption = {
    id: string
    name: string
}

type Props = {
    companies: CompanyOption[]
    selectedCompanyIds?: string[]
}

export default function CompanyFilterSelect({ companies, selectedCompanyIds = [] }: Props) {
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

    const buttonLabel = useMemo(() => {
        if (normalizedSelectedIds.length === 0) return "全ての企業"
        if (normalizedSelectedIds.length === 1) {
            return companyNameMap.get(normalizedSelectedIds[0]) || "1社を選択中"
        }
        return `${normalizedSelectedIds.length}社を選択中`
    }, [companyNameMap, normalizedSelectedIds])

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
        const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname
        router.replace(nextPath)
    }

    const toggleCompany = (companyId: string) => {
        const nextSet = new Set(normalizedSelectedIds)
        if (nextSet.has(companyId)) {
            nextSet.delete(companyId)
        } else {
            nextSet.add(companyId)
        }
        applyCompanyIds(Array.from(nextSet))
    }

    const clearSelection = () => {
        applyCompanyIds([])
    }

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
                            placeholder="企業名で検索..."
                            className="w-full h-8 pl-8 pr-2 rounded-md border border-input bg-background text-[12px] focus:outline-none focus:ring-2 focus:ring-ring/40"
                        />
                    </div>

                    <div className="max-h-56 overflow-auto rounded-md border border-border/60 bg-background/40">
                        {filteredCompanies.length === 0 ? (
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
