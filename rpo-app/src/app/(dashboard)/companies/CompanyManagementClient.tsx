"use client"

import { Trash2, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

type CompanyItem = {
    id: string
    name: string
    applicantCount: number
    groupId: string | null
}

type GroupItem = {
    id: string
    name: string
    memberCount: number
}

type Props = {
    companies: CompanyItem[]
    groups: GroupItem[]
    deleteCompanyAction: (formData: FormData) => Promise<void>
    createGroupAction: (formData: FormData) => Promise<void>
    deleteGroupAction: (formData: FormData) => Promise<void>
    setCompanyGroupAction: (formData: FormData) => Promise<void>
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message) {
        return error.message
    }
    return "操作に失敗しました。"
}

export default function CompanyManagementClient({
    companies,
    groups,
    deleteCompanyAction,
    createGroupAction,
    deleteGroupAction,
    setCompanyGroupAction,
}: Props) {
    const router = useRouter()
    const [pendingCompanyId, setPendingCompanyId] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [newGroupName, setNewGroupName] = useState("")
    const [isCreatingGroup, startCreatingGroup] = useTransition()

    const handleDelete = async (company: CompanyItem) => {
        if (!confirm(`紹介先企業「${company.name}」を削除してよいですか？この操作は元に戻せません。`)) {
            return
        }

        setErrorMessage(null)
        setPendingCompanyId(company.id)

        try {
            const formData = new FormData()
            formData.set("companyId", company.id)
            await deleteCompanyAction(formData)
            router.refresh()
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        } finally {
            setPendingCompanyId(null)
        }
    }

    const handleDeleteGroup = async (group: GroupItem) => {
        if (!confirm(`グループ「${group.name}」を削除してよいですか？所属企業はグループなしに戻ります。`)) {
            return
        }

        setErrorMessage(null)
        try {
            const formData = new FormData()
            formData.set("groupId", group.id)
            await deleteGroupAction(formData)
            router.refresh()
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        }
    }

    const handleCreateGroup = () => {
        if (!newGroupName.trim()) return
        setErrorMessage(null)
        startCreatingGroup(async () => {
            try {
                const formData = new FormData()
                formData.set("name", newGroupName.trim())
                await createGroupAction(formData)
                setNewGroupName("")
                router.refresh()
            } catch (error) {
                setErrorMessage(getErrorMessage(error))
            }
        })
    }

    const handleGroupChange = async (companyId: string, groupId: string) => {
        setErrorMessage(null)
        try {
            const formData = new FormData()
            formData.set("companyId", companyId)
            formData.set("groupId", groupId)
            await setCompanyGroupAction(formData)
            router.refresh()
        } catch (error) {
            setErrorMessage(getErrorMessage(error))
        }
    }

    return (
        <section className="bg-card rounded-xl border border-border shadow-soft p-4 space-y-4">
            <div>
                <h2 className="text-lg font-semibold text-foreground">紹介先企業管理</h2>
                <p className="text-xs text-muted-foreground mt-1">応募者が紐づいていない企業のみ削除できます。</p>
            </div>

            {errorMessage ? (
                <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {errorMessage}
                </p>
            ) : null}

            {/* グループ管理 */}
            <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">グループ管理</h3>
                <div className="overflow-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                            <tr>
                                <th className="px-3 py-2 font-semibold">グループ名</th>
                                <th className="px-3 py-2 font-semibold text-center">所属企業数</th>
                                <th className="px-3 py-2 font-semibold text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/70">
                            {groups.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-3 py-4 text-center text-muted-foreground">
                                        グループはまだありません。
                                    </td>
                                </tr>
                            ) : (
                                groups.map((group) => (
                                    <tr key={group.id} className="hover:bg-muted/30">
                                        <td className="px-3 py-2 text-foreground">{group.name}</td>
                                        <td className="px-3 py-2 text-center text-muted-foreground">{group.memberCount}</td>
                                        <td className="px-3 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => void handleDeleteGroup(group)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                削除
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup() }}
                        placeholder="新規グループ名"
                        className="flex-1 h-8 px-3 rounded-md border border-input text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                        type="button"
                        onClick={handleCreateGroup}
                        disabled={isCreatingGroup || !newGroupName.trim()}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {isCreatingGroup ? "作成中..." : "作成"}
                    </button>
                </div>
            </div>

            {/* 企業一覧 */}
            <div className="overflow-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                        <tr>
                            <th className="px-3 py-2 font-semibold">企業名</th>
                            <th className="px-3 py-2 font-semibold text-center">応募者数</th>
                            <th className="px-3 py-2 font-semibold text-center">グループ</th>
                            <th className="px-3 py-2 font-semibold text-center">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                        {companies.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                                    登録済みの紹介先企業はありません。
                                </td>
                            </tr>
                        ) : (
                            companies.map((company) => {
                                const isDeleting = pendingCompanyId === company.id
                                const isDisabled = pendingCompanyId !== null || company.applicantCount > 0
                                return (
                                    <tr key={company.id} className="hover:bg-muted/30">
                                        <td className="px-3 py-2 text-foreground">{company.name}</td>
                                        <td className="px-3 py-2 text-center text-muted-foreground">{company.applicantCount}</td>
                                        <td className="px-3 py-2 text-center">
                                            <select
                                                value={company.groupId || ""}
                                                onChange={(e) => void handleGroupChange(company.id, e.target.value)}
                                                className="text-xs bg-transparent border border-input rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                            >
                                                <option value="">なし</option>
                                                {groups.map((g) => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => void handleDelete(company)}
                                                disabled={isDisabled}
                                                title={company.applicantCount > 0 ? "応募者が紐づいているため削除できません。" : undefined}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-destructive/40 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                {isDeleting ? "削除中..." : "削除"}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
