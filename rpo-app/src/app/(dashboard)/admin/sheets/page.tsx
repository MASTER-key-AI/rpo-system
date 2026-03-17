import { getCompanies } from "@/lib/actions"
import { getCompanySheets, getUnlinkedCompanies, getCompanyAliases } from "@/lib/actions/sheets"
import SheetsManagementClient from "./SheetsManagementClient"

export const dynamic = "force-dynamic"

export default async function AdminSheetsPage() {
    const [sheets, companies, unlinkedCompanies, aliases] = await Promise.all([
        getCompanySheets(),
        getCompanies(),
        getUnlinkedCompanies(),
        getCompanyAliases(),
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    シート管理
                </h1>
                <p className="text-muted-foreground mt-0.5 text-[13px]">
                    企業ごとのスプレッドシート連携設定を管理します
                </p>
            </div>

            <SheetsManagementClient
                sheets={sheets}
                companies={companies.map((c) => ({ id: c.id, name: c.name }))}
                unlinkedCompanies={unlinkedCompanies}
                aliases={aliases}
            />
        </div>
    )
}
