import { BarChart3 } from "lucide-react"
import { buildCallConnectionHeatmap, getCallLogs, getUsers } from "@/lib/actions/calls"
import { getCompanies } from "@/lib/actions"
import CallLogsClient from "../CallLogsClient"
import { createCallLogAction, deleteCallLogAction } from "../actions"

export default async function CallLogsAnalysisPage({ searchParams }: { searchParams: Promise<{ companyId?: string, callerId?: string }> }) {
    const params = await searchParams
    const filterCompanyId = params.companyId
    const filterCallerId = params.callerId
    const [logs, companies, users] = await Promise.all([
        getCallLogs(filterCompanyId, filterCallerId),
        getCompanies(),
        getUsers(),
    ])
    const analytics = await buildCallConnectionHeatmap(logs)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <BarChart3 className="w-6 h-6 text-primary" />
                        履歴分析
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-[13px]">曜日・時間帯ごとの通電傾向を可視化します</p>
                </div>
            </div>

            <CallLogsClient
                logs={[]}
                companies={companies}
                users={users}
                selectedCompanyId={filterCompanyId}
                selectedCallerId={filterCallerId}
                analytics={analytics}
                viewMode="analysis"
                createCallLogAction={createCallLogAction}
                deleteCallLogAction={deleteCallLogAction}
            />
        </div>
    )
}
