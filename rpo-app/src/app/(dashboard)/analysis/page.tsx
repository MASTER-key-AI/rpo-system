import { BarChart2 } from "lucide-react"
import { getAnalysisSummary, getStaffSummary, getAllCaseTargets, getAnalysisCriteria } from "@/lib/actions/analysis"
import { db, schema } from "@/db"
import AnalysisDashboard from "./AnalysisDashboard"

export const dynamic = "force-dynamic"

export default async function AnalysisPage({
    searchParams,
}: {
    searchParams: Promise<{ showAll?: string }>
}) {
    const params = await searchParams
    const showAll = params.showAll === "1"

    const [summary, staffSummary, caseTargets, allCriteria, allCompanies] = await Promise.all([
        getAnalysisSummary({ showAll }),
        getStaffSummary(),
        getAllCaseTargets(),
        getAnalysisCriteria(),
        db.select({ id: schema.companies.id, name: schema.companies.name, supportStatus: schema.companies.supportStatus }).from(schema.companies),
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <BarChart2 className="w-6 h-6 text-primary" />
                    企業分析
                </h1>
                <p className="text-muted-foreground mt-0.5 text-[13px]">
                    支援期間ベース — 企業×職種ごとの進捗判定
                </p>
            </div>
            <AnalysisDashboard
                summary={summary}
                staffSummary={staffSummary}
                caseTargets={caseTargets}
                allCriteria={allCriteria}
                allCompanies={allCompanies}
                showAll={showAll}
            />
        </div>
    )
}
