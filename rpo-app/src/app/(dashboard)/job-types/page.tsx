import { getCompanies } from "@/lib/actions"
import { getAllCompanyCaseOptions } from "@/lib/actions/caseOptions"
import { Briefcase } from "lucide-react"
import JobTypesClient from "./JobTypesClient"

export default async function JobTypesPage() {
    const [companies, caseOptions] = await Promise.all([
        getCompanies(),
        getAllCompanyCaseOptions(),
    ])

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Briefcase className="w-6 h-6 text-primary" />
                    職種管理
                </h1>
                <p className="text-muted-foreground mt-0.5 text-[13px]">
                    企業ごとの案件名（職種）選択肢を管理します。応募者登録時のドロップダウンに反映されます。
                </p>
            </div>

            <JobTypesClient companies={companies} caseOptions={caseOptions} />
        </div>
    )
}
