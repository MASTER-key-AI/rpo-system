"use client"

import { useState, useTransition } from "react"
import { createCompanySheet, createCompanySheetWithAutoSpreadsheet, updateCompanySheet, deleteCompanySheet, addCompanyAlias, deleteCompanyAlias, type CompanySheetRow, type UnlinkedCompany, type CompanyAliasRow } from "@/lib/actions/sheets"
import { Plus, Trash2, ExternalLink, Loader2, AlertTriangle, X } from "lucide-react"

type Company = { id: string; name: string }

type Props = {
    sheets: CompanySheetRow[]
    companies: Company[]
    unlinkedCompanies: UnlinkedCompany[]
    aliases: CompanyAliasRow[]
}

export default function SheetsManagementClient({ sheets: initialSheets, companies, unlinkedCompanies, aliases: initialAliases }: Props) {
    const [sheets, setSheets] = useState(initialSheets)
    const [aliases, setAliases] = useState(initialAliases)
    const [isPending, startTransition] = useTransition()
    const [showAddForm, setShowAddForm] = useState(false)
    const [isManualMode, setIsManualMode] = useState(false)
    const [autoCreateError, setAutoCreateError] = useState<string | null>(null)
    const [aliasInput, setAliasInput] = useState<Record<string, string>>({})
    const [expandedAlias, setExpandedAlias] = useState<string | null>(null)
    // Add form state
    const [newCompanyName, setNewCompanyName] = useState("")
    const [newSpreadsheetId, setNewSpreadsheetId] = useState("")
    const [newGid, setNewGid] = useState("2")
    const [newSheetName, setNewSheetName] = useState("")

    const resetForm = () => {
        setNewCompanyName("")
        setNewSpreadsheetId("")
        setNewGid("2")
        setNewSheetName("")
        setAutoCreateError(null)
    }

    const handleAutoCreate = () => {
        if (!newCompanyName.trim()) {
            alert("企業名を入力してください。")
            return
        }

        startTransition(async () => {
            try {
                setAutoCreateError(null)
                const result = await createCompanySheetWithAutoSpreadsheet({
                    companyName: newCompanyName.trim(),
                })
                if (!result.success) {
                    setAutoCreateError(result.error || "自動作成に失敗しました。")
                    setIsManualMode(true)
                    return
                }
                setSheets((current) => [
                    ...current,
                    {
                        id: result.id,
                        companyId: result.companyId,
                        companyName: result.companyName,
                        spreadsheetId: result.spreadsheetId,
                        gid: result.gid,
                        sheetName: result.sheetName,
                        enabled: true,
                    },
                ].sort((a, b) => a.companyName.localeCompare(b.companyName, "ja")))
                setShowAddForm(false)
                resetForm()
            } catch (error) {
                console.error(error)
                const message = error instanceof Error ? error.message : "自動作成に失敗しました。"
                setAutoCreateError(message)
                setIsManualMode(true)
            }
        })
    }

    const handleManualAdd = () => {
        if (!newCompanyName.trim() || !newSpreadsheetId) {
            alert("企業名とスプレッドシートIDは必須です。")
            return
        }

        startTransition(async () => {
            try {
                const result = await createCompanySheet({
                    companyName: newCompanyName.trim(),
                    spreadsheetId: newSpreadsheetId.trim(),
                    gid: Number(newGid) || 0,
                    sheetName: newSheetName.trim() || undefined,
                })
                setSheets((current) => [
                    ...current,
                    {
                        id: result.id,
                        companyId: result.companyId,
                        companyName: result.companyName,
                        spreadsheetId: newSpreadsheetId.trim(),
                        gid: Number(newGid) || 0,
                        sheetName: newSheetName.trim() || null,
                        enabled: true,
                    },
                ].sort((a, b) => a.companyName.localeCompare(b.companyName, "ja")))
                setShowAddForm(false)
                setIsManualMode(false)
                resetForm()
            } catch (error) {
                console.error(error)
                alert("作成に失敗しました。")
            }
        })
    }

    const handleToggleEnabled = (sheet: CompanySheetRow) => {
        const nextEnabled = !sheet.enabled
        setSheets((current) =>
            current.map((s) => (s.id === sheet.id ? { ...s, enabled: nextEnabled } : s))
        )
        startTransition(async () => {
            try {
                await updateCompanySheet(sheet.id, { enabled: nextEnabled })
            } catch (error) {
                console.error(error)
                setSheets((current) =>
                    current.map((s) => (s.id === sheet.id ? { ...s, enabled: sheet.enabled } : s))
                )
            }
        })
    }

    const handleDelete = (sheet: CompanySheetRow) => {
        if (!confirm(`${sheet.companyName} のシート設定を削除しますか？`)) return

        setSheets((current) => current.filter((s) => s.id !== sheet.id))
        startTransition(async () => {
            try {
                await deleteCompanySheet(sheet.id)
            } catch (error) {
                console.error(error)
                setSheets((current) => [...current, sheet].sort((a, b) => a.companyName.localeCompare(b.companyName, "ja")))
            }
        })
    }

    const handleUpdateField = (sheetId: string, field: "spreadsheetId" | "gid" | "sheetName", value: string) => {
        const patch: Record<string, unknown> = {}
        if (field === "gid") {
            patch.gid = Number(value) || 0
        } else {
            patch[field] = value.trim() || null
        }

        setSheets((current) =>
            current.map((s) => (s.id === sheetId ? { ...s, ...patch } : s))
        )
        startTransition(async () => {
            try {
                await updateCompanySheet(sheetId, patch as Parameters<typeof updateCompanySheet>[1])
            } catch (error) {
                console.error(error)
            }
        })
    }

    const handleAddAlias = (companyId: string) => {
        const input = (aliasInput[companyId] || "").trim()
        if (!input) return

        startTransition(async () => {
            const result = await addCompanyAlias(companyId, input)
            if (!result.success) {
                alert(result.error || "エイリアス追加に失敗しました。")
                return
            }
            setAliases((current) => [...current, { id: result.id!, companyId, alias: input }])
            setAliasInput((current) => ({ ...current, [companyId]: "" }))
        })
    }

    const handleDeleteAlias = (aliasId: string) => {
        setAliases((current) => current.filter((a) => a.id !== aliasId))
        startTransition(async () => {
            try {
                await deleteCompanyAlias(aliasId)
            } catch (error) {
                console.error(error)
            }
        })
    }

    const handleQuickAdd = (companyName: string) => {
        setNewCompanyName(companyName)
        setShowAddForm(true)
        setIsManualMode(false)
        setAutoCreateError(null)
    }

    // Companies that don't have a sheet yet
    const unassignedCompanies = companies.filter(
        (c) => !sheets.some((s) => s.companyId === c.id)
    )

    return (
        <div className="space-y-4">
            {unlinkedCompanies.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50/60 px-4 py-3 text-sm text-amber-900 space-y-2">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <p className="font-semibold">シート未設定の企業が {unlinkedCompanies.length} 件あります</p>
                    </div>
                    <p className="text-xs text-amber-800">応募者データが届いていますが、スプレッドシートに連携されていません。</p>
                    <div className="flex flex-wrap gap-1.5">
                        {unlinkedCompanies.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => handleQuickAdd(c.name)}
                                className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white/70 px-2 py-1 text-xs hover:bg-white transition-colors"
                            >
                                {c.name}
                                <span className="text-amber-600">({c.applicantCount}件)</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-900 space-y-1.5">
                <p className="font-semibold">スプレッドシートID・GIDの見つけ方</p>
                <p>スプレッドシートのURLは次の形式です：</p>
                <p className="font-mono text-xs bg-white/70 rounded px-2 py-1 break-all">
                    https://docs.google.com/spreadsheets/d/<span className="text-primary font-bold">スプレッドシートID</span>/edit#gid=<span className="text-amber-600 font-bold">GID</span>
                </p>
                <ul className="list-disc list-inside text-xs text-blue-800 space-y-0.5">
                    <li><span className="font-semibold">スプレッドシートID</span>：URLの <code className="bg-white/70 px-1 rounded">/d/</code> と <code className="bg-white/70 px-1 rounded">/edit</code> の間の長い英数字</li>
                    <li><span className="font-semibold">GID</span>：URLの末尾 <code className="bg-white/70 px-1 rounded">#gid=</code> の後の数字。シート内のタブを識別します（最初のタブは通常 <code className="bg-white/70 px-1 rounded">0</code>）</li>
                </ul>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                    {sheets.length}件のシート設定
                </p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setShowAddForm(!showAddForm)
                            if (!showAddForm) {
                                setIsManualMode(false)
                                resetForm()
                            }
                        }}
                        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        新規追加
                    </button>
                </div>
            </div>

            {showAddForm && (
                <div className="bg-card rounded-xl shadow-card border border-border p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">
                            {isManualMode ? "新規シート設定（手動入力）" : "新規シート設定（自動作成）"}
                        </h3>
                        <button
                            type="button"
                            onClick={() => {
                                setIsManualMode(!isManualMode)
                                setAutoCreateError(null)
                            }}
                            className="text-xs text-primary hover:underline"
                        >
                            {isManualMode ? "自動作成モードに戻る" : "手動でIDを入力する"}
                        </button>
                    </div>

                    {autoCreateError && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            自動作成に失敗しました: {autoCreateError}
                            <br />
                            <span className="text-xs">手動入力モードに切り替わりました。スプレッドシートIDとGIDを直接入力してください。</span>
                        </div>
                    )}

                    {isManualMode ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">企業名</label>
                                    <input
                                        value={newCompanyName}
                                        onChange={(e) => setNewCompanyName(e.target.value)}
                                        list="company-suggestions"
                                        placeholder="企業名を入力（新規企業も可）"
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    />
                                    <datalist id="company-suggestions">
                                        {unassignedCompanies.map((c) => (
                                            <option key={c.id} value={c.name} />
                                        ))}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">スプレッドシートID</label>
                                    <input
                                        value={newSpreadsheetId}
                                        onChange={(e) => setNewSpreadsheetId(e.target.value)}
                                        placeholder="1ABC..."
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">GID</label>
                                    <input
                                        value={newGid}
                                        onChange={(e) => setNewGid(e.target.value)}
                                        type="number"
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">タブ名</label>
                                    <input
                                        value={newSheetName}
                                        onChange={(e) => setNewSheetName(e.target.value)}
                                        placeholder="応募者一覧"
                                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setShowAddForm(false); setIsManualMode(false); resetForm() }}
                                    className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="button"
                                    onClick={handleManualAdd}
                                    disabled={isPending || !newCompanyName.trim() || !newSpreadsheetId}
                                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    追加
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="max-w-md">
                                <label className="block text-xs font-medium text-muted-foreground mb-1">企業名</label>
                                <input
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    list="company-suggestions-auto"
                                    placeholder="企業名を入力（新規企業も可）"
                                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                />
                                <datalist id="company-suggestions-auto">
                                    {unassignedCompanies.map((c) => (
                                        <option key={c.id} value={c.name} />
                                    ))}
                                </datalist>
                                <p className="mt-1.5 text-xs text-muted-foreground">
                                    テンプレートから「【RPO】企業名_候補者管理」スプレッドシートを自動作成します
                                </p>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setShowAddForm(false); resetForm() }}
                                    className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-muted transition-colors"
                                >
                                    キャンセル
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAutoCreate}
                                    disabled={isPending || !newCompanyName.trim()}
                                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    自動作成して追加
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
                <div className="w-full overflow-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                            <tr>
                                <th className="px-4 py-3 font-semibold">有効</th>
                                <th className="px-4 py-3 font-semibold">企業名</th>
                                <th className="px-4 py-3 font-semibold">スプレッドシートID</th>
                                <th className="px-4 py-3 font-semibold">GID</th>
                                <th className="px-4 py-3 font-semibold">タブ名</th>
                                <th className="px-4 py-3 font-semibold">リンク</th>
                                <th className="px-4 py-3 font-semibold">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {sheets.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                        シート設定がありません
                                    </td>
                                </tr>
                            ) : (
                                sheets.map((sheet) => (
                                    <tr key={sheet.id} className={`hover:bg-muted/30 transition-colors ${!sheet.enabled ? "opacity-50" : ""}`}>
                                        <td className="px-4 py-2">
                                            <input
                                                type="checkbox"
                                                checked={sheet.enabled}
                                                onChange={() => handleToggleEnabled(sheet)}
                                                disabled={isPending}
                                                className="h-4 w-4 accent-primary"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <div className="font-medium">{sheet.companyName}</div>
                                            <div className="flex flex-wrap items-center gap-1 mt-1">
                                                {aliases.filter((a) => a.companyId === sheet.companyId).map((a) => (
                                                    <span key={a.id} className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                                        {a.alias}
                                                        <button type="button" onClick={() => handleDeleteAlias(a.id)} disabled={isPending} className="hover:text-destructive">
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                {expandedAlias === sheet.companyId ? (
                                                    <span className="inline-flex items-center gap-1">
                                                        <input
                                                            value={aliasInput[sheet.companyId] || ""}
                                                            onChange={(e) => setAliasInput((c) => ({ ...c, [sheet.companyId]: e.target.value }))}
                                                            onKeyDown={(e) => { if (e.key === "Enter") handleAddAlias(sheet.companyId) }}
                                                            placeholder="別名"
                                                            className="h-6 w-28 rounded border border-input px-1.5 text-[11px]"
                                                            autoFocus
                                                        />
                                                        <button type="button" onClick={() => handleAddAlias(sheet.companyId)} disabled={isPending} className="text-[11px] text-primary hover:underline">追加</button>
                                                        <button type="button" onClick={() => setExpandedAlias(null)} className="text-[11px] text-muted-foreground hover:underline">閉</button>
                                                    </span>
                                                ) : (
                                                    <button type="button" onClick={() => setExpandedAlias(sheet.companyId)} className="text-[11px] text-primary hover:underline">+別名</button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                defaultValue={sheet.spreadsheetId}
                                                onBlur={(e) => handleUpdateField(sheet.id, "spreadsheetId", e.target.value)}
                                                disabled={isPending}
                                                className="h-8 w-full min-w-[280px] rounded border border-input px-2 text-sm font-mono"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                defaultValue={String(sheet.gid)}
                                                onBlur={(e) => handleUpdateField(sheet.id, "gid", e.target.value)}
                                                type="number"
                                                disabled={isPending}
                                                className="h-8 w-20 rounded border border-input px-2 text-sm"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                defaultValue={sheet.sheetName ?? ""}
                                                onBlur={(e) => handleUpdateField(sheet.id, "sheetName", e.target.value)}
                                                disabled={isPending}
                                                className="h-8 w-full min-w-[120px] rounded border border-input px-2 text-sm"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <a
                                                href={`https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit#gid=${sheet.gid}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-primary hover:underline"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                開く
                                            </a>
                                        </td>
                                        <td className="px-4 py-2">
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(sheet)}
                                                disabled={isPending}
                                                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-destructive hover:bg-destructive/10 transition-colors"
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
            </div>
        </div>
    )
}
