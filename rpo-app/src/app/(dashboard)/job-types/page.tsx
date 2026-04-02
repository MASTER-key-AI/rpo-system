import { getCompanies } from "@/lib/actions"
import { getAllCompanyCaseOptions } from "@/lib/actions/caseOptions"
import { Briefcase, Info } from "lucide-react"
import JobTypesClient from "./JobTypesClient"
import Link from "next/link"

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

            <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[13px] text-sky-800">
                <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-500" />
                <span>
                    職種を設定したい企業がこの一覧に表示されていない場合は、先に
                    <Link href="/companies/manage" className="font-medium underline hover:text-sky-900 mx-1">企業グループ管理</Link>
                    から企業を登録してください。登録後、この画面に表示されます。
                </span>
            </div>

            <JobTypesClient companies={companies} caseOptions={caseOptions} />
        </div>
    )
}
