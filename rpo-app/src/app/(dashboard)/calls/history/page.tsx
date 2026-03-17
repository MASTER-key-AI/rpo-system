import { Phone } from "lucide-react"
import { getCallLogs, getUsers } from "@/lib/actions/calls"
import { getCompanies } from "@/lib/actions"
import { getCompanySheetMap } from "@/lib/actions/sheets"
import CallLogsClient from "../CallLogsClient"
import { createCallLogAction, deleteCallLogAction } from "../actions"

export default async function CallLogsHistoryPage({ searchParams }: { searchParams: Promise<{ companyId?: string, callerId?: string }> }) {
    const params = await searchParams
    const filterCompanyId = params.companyId
    const filterCallerId = params.callerId
    const [logs, companies, users, sheetMap] = await Promise.all([
        getCallLogs(filterCompanyId, filterCallerId),
        getCompanies(),
        getUsers(),
        getCompanySheetMap(),
    ])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Phone className="w-6 h-6 text-primary" />
                        架電履歴
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-[13px]">架電履歴の一覧を確認できます</p>
                </div>
            </div>

            <CallLogsClient
                logs={logs}
                companies={companies}
                users={users}
                selectedCompanyId={filterCompanyId}
                selectedCallerId={filterCallerId}
                viewMode="history"
                sheetMap={sheetMap}
                createCallLogAction={createCallLogAction}
                deleteCallLogAction={deleteCallLogAction}
            />
        </div>
    )
}
