import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Building2, Filter } from "lucide-react"
import { getGroupById, getGroupMembers } from "@/lib/actions/groups"
import { getApplicantAppliedYears, getCompanyYields } from "@/lib/actions/yields"
import { getCompanySheetMap } from "@/lib/actions/sheets"
import type { CompanyYieldRow } from "@/lib/actions/yields"
import CompaniesYieldTableClient from "../../CompaniesYieldTableClient"

export default async function GroupDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ groupId: string }>
    searchParams: Promise<{ year?: string; month?: string; dateType?: string }>
}) {
    const { groupId } = await params
    const sp = await searchParams
    const dateType = (sp.dateType || "applied") as "applied" | "event"
    const parsedYear = Number.parseInt(sp.year || "", 10)
    const parsedMonth = Number.parseInt(sp.month || "", 10)
    const year = Number.isInteger(parsedYear) ? parsedYear : undefined
    const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : undefined
    const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)

    const [group, members, availableYears] = await Promise.all([
        getGroupById(groupId),
        getGroupMembers(groupId),
        getApplicantAppliedYears(),
    ])

    if (!group) {
        notFound()
    }

    const memberIds = members.map((m) => m.id)
    const [memberYields, sheetMap] = await Promise.all([
        memberIds.length > 0
            ? getCompanyYields(year, month, dateType, { companyIds: memberIds })
            : Promise.resolve([] as CompanyYieldRow[]),
        getCompanySheetMap(),
    ])

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2 drop-shadow-sm">
                            <Building2 className="w-8 h-8 text-primary" />
                            {group.name} グループ
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm tracking-wide">
                            所属企業ごとの歩留まりを確認して応募者一覧へ遷移できます
                        </p>
                    </div>
                    <Link
                        href="/companies"
                        className="inline-flex items-center gap-1.5 rounded-md border border-input h-10 px-4 text-sm font-medium hover:bg-muted transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        企業別に戻る
                    </Link>
                </div>
            </div>

            <div className="bg-card rounded-xl shadow-card border border-border p-4">
                <p className="text-sm text-muted-foreground">所属企業: {members.length} 社</p>
                <p className="text-sm text-muted-foreground mt-1">該当歩留まり: {memberYields.length}社</p>
            </div>

            <form method="GET" className="flex items-center gap-3 bg-card p-2 rounded-lg border border-border shadow-soft">
                <Filter className="w-4 h-4 text-muted-foreground ml-2" />
                <select
                    name="dateType"
                    defaultValue={dateType}
                    className="text-sm bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer"
                >
                    <option value="applied">応募日起点</option>
                    <option value="event">発生日起点</option>
                </select>
                <div className="w-px h-4 bg-border mx-1"></div>
                <select
                    name="year"
                    defaultValue={year ? String(year) : ""}
                    className="text-sm bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer"
                >
                    <option value="">全ての年</option>
                    {availableYears.map((optionYear) => (
                        <option key={optionYear} value={optionYear}>
                            {optionYear}年
                        </option>
                    ))}
                </select>
                <select
                    name="month"
                    defaultValue={month ? String(month) : ""}
                    className="text-sm bg-transparent border-none focus:ring-0 text-foreground font-medium cursor-pointer"
                >
                    <option value="">全ての月</option>
                    {monthOptions.map((optionMonth) => (
                        <option key={optionMonth} value={optionMonth}>
                            {optionMonth}月
                        </option>
                    ))}
                </select>
                <button
                    type="submit"
                    className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shadow-sm"
                >
                    絞り込み
                </button>
            </form>

            <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
                {memberYields.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground border-t border-border/40">
                        該当する歩留まりデータがありません
                    </div>
                ) : (
                    <CompaniesYieldTableClient yields={memberYields} companyId="group-members" sheetMap={sheetMap} />
                )}
            </div>
        </div>
    )
}
