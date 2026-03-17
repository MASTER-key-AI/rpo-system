import { FileSpreadsheet } from "lucide-react"
import { getCompanies } from "@/lib/actions"
import { getCompanySheets, getUnlinkedCompanies, getCompanyAliases } from "@/lib/actions/sheets"
import SheetsManagementClient from "./SheetsManagementClient"

export default async function SheetsPage() {
    const [sheets, companies, unlinkedCompanies, aliases] = await Promise.all([
        getCompanySheets(),
        getCompanies(),
        getUnlinkedCompanies(),
        getCompanyAliases(),
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <FileSpreadsheet className="w-6 h-6 text-primary" />
                    シート管理
                </h1>
                <p className="text-muted-foreground mt-0.5 text-[13px]">
                    企業ごとのスプレッドシート連携を管理します
                </p>
            </div>

            <SheetsManagementClient
                sheets={sheets}
                companies={companies}
                unlinkedCompanies={unlinkedCompanies}
                aliases={aliases}
            />
        </div>
    )
}
