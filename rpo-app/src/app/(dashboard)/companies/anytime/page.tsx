import { redirect } from "next/navigation"
import { db, schema } from "@/db"
import { eq } from "drizzle-orm"

export default async function AnytimeRedirectPage() {
    // 既存の「エニタイム」グループを検索してリダイレクト
    const anytimeGroup = await db
        .select({ id: schema.companyGroups.id })
        .from(schema.companyGroups)
        .where(eq(schema.companyGroups.name, "エニタイム"))
        .get()

    if (anytimeGroup) {
        redirect(`/companies/groups/${anytimeGroup.id}`)
    }

    // グループが見つからない場合は企業一覧に戻す
    redirect("/companies")
}
