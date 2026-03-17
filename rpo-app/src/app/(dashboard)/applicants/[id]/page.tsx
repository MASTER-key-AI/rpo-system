import { getApplicant } from "@/lib/actions/applicant"
import { getCompanySheetMap } from "@/lib/actions/sheets"
import { notFound } from "next/navigation"
import ApplicantDetailClient from "./ApplicantDetailClient"

export default async function ApplicantDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    if (!id?.trim()) {
        notFound()
    }

    const [applicant, sheetMap] = await Promise.all([
        getApplicant(id),
        getCompanySheetMap(),
    ])
    if (!applicant) {
        notFound()
    }

    const companyId = applicant.company?.id
    const sheetEntry = companyId ? sheetMap[companyId] : undefined

    return (
        <div className="space-y-6 animate-in fade-in duration-400">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{applicant.name} の詳細管理</h1>
                <p className="text-muted-foreground mt-0.5 text-[13px]">選考フェーズ、歩留まりフラグ、架電履歴の確認と編集</p>
            </div>

            <ApplicantDetailClient
                initialData={{ ...applicant, company: applicant.company || null }}
                sheetUrl={sheetEntry ? `https://docs.google.com/spreadsheets/d/${sheetEntry.spreadsheetId}/edit#gid=${sheetEntry.gid}` : undefined}
            />
        </div>
    )
}
