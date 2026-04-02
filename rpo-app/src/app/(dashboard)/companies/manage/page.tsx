import { ArrowLeft, Building2 } from "lucide-react"
import Link from "next/link"
import { getCompanyManagementList, getCaseManagementList } from "@/lib/actions"
import { getCompanyGroups } from "@/lib/actions/groups"
import CompanyManagementClient from "../CompanyManagementClient"
import { deleteCompanyAction, deleteCaseAction, createGroupAction, deleteGroupAction, setCompanyGroupAction } from "../actions"

export const dynamic = "force-dynamic"

export default async function CompanyManagePage() {
    const [managementCompanies, managementCases, groups] = await Promise.all([
        getCompanyManagementList(),
        getCaseManagementList(),
        getCompanyGroups(),
    ])

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-primary" />
                        企業グループ管理
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-[13px]">
                        企業グループの作成・削除と、企業のグループ割り当てを管理します
                    </p>
                </div>
                <Link
                    href="/companies"
                    className="inline-flex items-center gap-1.5 rounded-md border border-input h-9 px-4 text-sm font-medium hover:bg-muted transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    歩留まり管理に戻る
                </Link>
            </div>

            <CompanyManagementClient
                companies={managementCompanies}
                cases={managementCases}
                groups={groups}
                deleteCompanyAction={deleteCompanyAction}
                deleteCaseAction={deleteCaseAction}
                createGroupAction={createGroupAction}
                deleteGroupAction={deleteGroupAction}
                setCompanyGroupAction={setCompanyGroupAction}
            />
        </div>
    )
}
