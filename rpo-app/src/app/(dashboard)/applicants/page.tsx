import { getApplicants, getCompanies } from "@/lib/actions"
import type { ApplicantFilters } from "@/lib/actions"
import { getCompanySheetMap } from "@/lib/actions/sheets"
import { getAllCompanyCaseOptions } from "@/lib/actions/caseOptions"
import { Search } from "lucide-react"
import CompanyFilterSelect from "./CompanyFilterSelect"
import ApplicantFilterBar from "./ApplicantFilterBar"
import ApplicantsTableClient from "./ApplicantsTableClient"
import ApplicantsCsvActions from "./ApplicantsCsvActions"
import CompanyContextBar from "@/components/CompanyContextBar"
import NewApplicantModal from "./NewApplicantModal"
import Link from "next/link"

type SearchParams = {
    companyId?: string
    companyIds?: string
    q?: string
    page?: string
    assigneeName?: string
    responseStatus?: string
    isValidApplicant?: string
    gender?: string
    offered?: string
    appliedDateFrom?: string
    appliedDateTo?: string
}

export default async function ApplicantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
    const params = await searchParams;
    const legacyCompanyId = params.companyId?.trim() || ""
    const selectedCompanyIds = Array.from(
        new Set(
            [
                ...((params.companyIds || "")
                    .split(",")
                    .map((id) => id.trim())
                    .filter((id) => id.length > 0)),
                ...(legacyCompanyId ? [legacyCompanyId] : []),
            ],
        ),
    )
    const singleSelectedCompanyId = selectedCompanyIds.length === 1 ? selectedCompanyIds[0] : undefined
    const searchKeyword = params.q?.trim() || ""
    const currentPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1)
    const pageSize = 50

    const filters: ApplicantFilters = {
        companyId: singleSelectedCompanyId,
        companyIds: selectedCompanyIds.length > 1 ? selectedCompanyIds : undefined,
        searchKeyword: searchKeyword || undefined,
        assigneeName: params.assigneeName || undefined,
        responseStatus: params.responseStatus || undefined,
        isValidApplicant: params.isValidApplicant === "true" || params.isValidApplicant === "false" ? params.isValidApplicant : undefined,
        gender: params.gender || undefined,
        offered: params.offered === "true" || params.offered === "false" ? params.offered : undefined,
        appliedDateFrom: params.appliedDateFrom || undefined,
        appliedDateTo: params.appliedDateTo || undefined,
    }

    const [
        { applicants, total, page: safeCurrentPage, totalPages },
        companies,
        sheetMap,
        caseOptions,
    ] = await Promise.all([
        getApplicants(filters, currentPage, pageSize),
        getCompanies(),
        getCompanySheetMap(),
        getAllCompanyCaseOptions(),
    ])
    const totalFrom = total === 0 ? 0 : ((safeCurrentPage - 1) * pageSize) + 1
    const totalTo = Math.min(safeCurrentPage * pageSize, total)
    const companyIdsParamValue = selectedCompanyIds.join(",")
    const buildPageUrl = (nextPage: number) => {
        const query = new URLSearchParams()
        if (searchKeyword) query.set("q", searchKeyword)
        if (companyIdsParamValue) query.set("companyIds", companyIdsParamValue)
        if (params.assigneeName) query.set("assigneeName", params.assigneeName)
        if (params.responseStatus) query.set("responseStatus", params.responseStatus)
        if (params.isValidApplicant) query.set("isValidApplicant", params.isValidApplicant)
        if (params.gender) query.set("gender", params.gender)
        if (params.offered) query.set("offered", params.offered)
        if (params.appliedDateFrom) query.set("appliedDateFrom", params.appliedDateFrom)
        if (params.appliedDateTo) query.set("appliedDateTo", params.appliedDateTo)
        if (nextPage > 1) query.set("page", String(nextPage))
        return `/applicants${query.toString() ? `?${query.toString()}` : ""}`
    }
    const prevPage = safeCurrentPage > 1 ? safeCurrentPage - 1 : null
    const nextPage = safeCurrentPage < totalPages ? safeCurrentPage + 1 : null
    const exportQuery = new URLSearchParams()
    if (searchKeyword) exportQuery.set("q", searchKeyword)
    if (companyIdsParamValue) exportQuery.set("companyIds", companyIdsParamValue)
    if (params.assigneeName) exportQuery.set("assigneeName", params.assigneeName)
    if (params.responseStatus) exportQuery.set("responseStatus", params.responseStatus)
    if (params.isValidApplicant) exportQuery.set("isValidApplicant", params.isValidApplicant)
    if (params.gender) exportQuery.set("gender", params.gender)
    if (params.offered) exportQuery.set("offered", params.offered)
    if (params.appliedDateFrom) exportQuery.set("appliedDateFrom", params.appliedDateFrom)
    if (params.appliedDateTo) exportQuery.set("appliedDateTo", params.appliedDateTo)
    const exportHref = `/api/applicants/csv${exportQuery.toString() ? `?${exportQuery.toString()}` : ""}`

    const filterCompanyName = singleSelectedCompanyId
        ? companies.find((c) => c.id === singleSelectedCompanyId)?.name ?? null
        : null

    // 支店グループを自動検出（2社以上マッチするもののみ）
    const BRANCH_PATTERNS: { label: string; match: (name: string) => boolean }[] = [
        { label: "エニタイムフィットネス（全体）", match: (n) => n.startsWith("エニタイムフィットネス") },
        { label: "アイケアLaBo（全体）", match: (n) => /^アイケアlabo/i.test(n) },
        { label: "株式会社ハーツ（全体）", match: (n) => n.includes("ハーツ") },
        { label: "株式会社フレックス（全体）", match: (n) => n.startsWith("株式会社フレックス") },
    ]
    const companyGroups = BRANCH_PATTERNS
        .map((p) => ({ label: p.label, ids: companies.filter((c) => p.match(c.name)).map((c) => c.id) }))
        .filter((g) => g.ids.length >= 2)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">応募者管理</h1>
                    <p className="text-muted-foreground mt-0.5 text-[13px]">選考ステータスや面接日程を管理します</p>
                </div>
                <NewApplicantModal companies={companies} caseOptions={caseOptions} />
            </div>

            {singleSelectedCompanyId && filterCompanyName && (
                <CompanyContextBar
                    companyId={singleSelectedCompanyId}
                    companyName={filterCompanyName}
                    sheetEntry={sheetMap[singleSelectedCompanyId]}
                    activePage="applicants"
                />
            )}

            <div className="bg-card rounded-xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="px-4 py-3 border-b border-border bg-muted/30 space-y-2">
                    <div className="flex gap-3 items-center">
                        <form method="GET" className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <input
                                type="text"
                                name="q"
                                defaultValue={searchKeyword}
                                placeholder="全項目を検索..."
                                className="w-full h-9 pl-9 pr-4 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all duration-200"
                            />
                            {companyIdsParamValue ? <input type="hidden" name="companyIds" value={companyIdsParamValue} /> : null}
                            {params.assigneeName ? <input type="hidden" name="assigneeName" value={params.assigneeName} /> : null}
                            {params.responseStatus ? <input type="hidden" name="responseStatus" value={params.responseStatus} /> : null}
                            {params.isValidApplicant ? <input type="hidden" name="isValidApplicant" value={params.isValidApplicant} /> : null}
                            {params.gender ? <input type="hidden" name="gender" value={params.gender} /> : null}
                            {params.offered ? <input type="hidden" name="offered" value={params.offered} /> : null}
                            {params.appliedDateFrom ? <input type="hidden" name="appliedDateFrom" value={params.appliedDateFrom} /> : null}
                            {params.appliedDateTo ? <input type="hidden" name="appliedDateTo" value={params.appliedDateTo} /> : null}
                            <button type="submit" className="sr-only">検索</button>
                        </form>
                        <CompanyFilterSelect
                            companies={companies}
                            selectedCompanyIds={selectedCompanyIds}
                            groups={companyGroups}
                        />
                        <ApplicantsCsvActions exportHref={exportHref} />
                    </div>
                    <ApplicantFilterBar
                        assigneeName={params.assigneeName}
                        responseStatus={params.responseStatus}
                        isValidApplicant={params.isValidApplicant}
                        gender={params.gender}
                        offered={params.offered}
                        appliedDateFrom={params.appliedDateFrom}
                        appliedDateTo={params.appliedDateTo}
                    />
                    <p className="text-[11px] text-muted-foreground">
                        キーワード検索は氏名・企業名・案件名・連絡先・担当者・ステータス・各日付項目を対象にしています。
                    </p>
                </div>

                <div className="w-full overflow-auto max-h-[70vh]">
                    <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
                        <thead className="sticky top-0 z-20 text-[11px] text-muted-foreground uppercase tracking-wider bg-muted/50 backdrop-blur-sm border-b border-border">
                            <tr>
                                {/* A-D: Sticky columns */}
                                <th className="px-4 py-2.5 font-semibold sticky left-0 z-30 bg-muted/80 backdrop-blur-sm min-w-[110px]">応募日</th>
                                <th className="px-4 py-2.5 font-semibold sticky left-[110px] z-30 bg-muted/80 backdrop-blur-sm min-w-[140px]">会社名</th>
                                <th className="px-4 py-2.5 font-semibold sticky left-[250px] z-30 bg-muted/80 backdrop-blur-sm min-w-[140px]">案件名</th>
                                <th className="px-4 py-2.5 font-semibold sticky left-[390px] z-30 bg-muted/80 backdrop-blur-sm min-w-[180px] border-r border-border/40">氏名</th>
                                {/* E-W: Scrollable columns */}
                                <th className="px-4 py-2.5 font-semibold">mail</th>
                                <th className="px-4 py-2.5 font-semibold">応募職種名</th>
                                <th className="px-4 py-2.5 font-semibold">勤務地</th>
                                <th className="px-4 py-2.5 font-semibold">電話番号</th>
                                <th className="px-4 py-2.5 font-semibold">年齢</th>
                                <th className="px-4 py-2.5 font-semibold">生年月日</th>
                                <th className="px-4 py-2.5 font-semibold">性別</th>
                                <th className="px-4 py-2.5 font-semibold">担当者名</th>
                                <th className="px-4 py-2.5 font-semibold">有効応募</th>
                                <th className="px-4 py-2.5 font-semibold">対応状況</th>
                                <th className="px-4 py-2.5 font-semibold">備考</th>
                                <th className="px-4 py-2.5 font-semibold">次回アクション日</th>
                                <th className="px-4 py-2.5 font-semibold">通電日</th>
                                <th className="px-4 py-2.5 font-semibold">面接予定日</th>
                                <th className="px-4 py-2.5 font-semibold">実施可否</th>
                                <th className="px-4 py-2.5 font-semibold">二次/最終面接予定日</th>
                                <th className="px-4 py-2.5 font-semibold">二次/最終実施可否</th>
                                <th className="px-4 py-2.5 font-semibold">内定可否</th>
                                <th className="px-4 py-2.5 font-semibold">入社日</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            <ApplicantsTableClient applicants={applicants} sheetMap={sheetMap} caseOptions={caseOptions} />
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between px-4 py-3 text-sm border-t border-border bg-muted/20">
                    <p className="text-muted-foreground text-[13px]">
                        {total === 0 ? "0件" : `${totalFrom}〜${totalTo}件 / 全${total}件`}
                    </p>
                    <div className="flex items-center gap-1.5">
                        {prevPage ? (
                            <Link
                                href={buildPageUrl(prevPage)}
                                className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-3 py-1.5 text-[13px] font-medium hover:bg-muted transition-colors duration-150 cursor-pointer"
                            >
                                前へ
                            </Link>
                        ) : (
                            <span className="inline-flex items-center justify-center rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-[13px] text-muted-foreground">
                                前へ
                            </span>
                        )}
                        <span className="inline-flex min-w-14 items-center justify-center rounded-lg border border-border/50 bg-background px-3 py-1.5 text-[13px] font-medium tabular-nums">
                            {safeCurrentPage} / {totalPages}
                        </span>
                        {nextPage ? (
                            <Link
                                href={buildPageUrl(nextPage)}
                                className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-3 py-1.5 text-[13px] font-medium hover:bg-muted transition-colors duration-150 cursor-pointer"
                            >
                                次へ
                            </Link>
                        ) : (
                            <span className="inline-flex items-center justify-center rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-[13px] text-muted-foreground">
                                次へ
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
