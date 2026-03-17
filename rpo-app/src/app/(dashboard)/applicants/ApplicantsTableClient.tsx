"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { useEffect, useState, useTransition } from "react"
import { updateApplicant } from "@/lib/actions/applicant"

type Applicant = {
    id: string
    name: string
    furigana: string | null
    companyId: string
    companyName: string
    caseName: string | null
    email: string | null
    appliedAt: string | number | Date
    phone: string | null
    appliedJob: string | null
    appliedLocation: string | null
    age: number | null
    birthDate: string | number | Date | null
    gender: string | null
    assigneeUserId: string | null
    assigneeName: string | null
    responseStatus: string | null
    isValidApplicant: boolean | null
    notes: string | null
    connectedAt: string | number | Date | null
    nextActionDate: string | number | Date | null
    primaryScheduledDate: string | number | Date | null
    primaryConductedDate: string | number | Date | null
    primaryConducted: boolean | null
    secScheduledDate: string | number | Date | null
    secConductedDate: string | number | Date | null
    secConducted: boolean | null
    offered: boolean | null
    joinedDate: string | number | Date | null
}

type SheetEntry = {
    spreadsheetId: string
    gid: number
    sheetName: string | null
}

type Props = {
    applicants: Applicant[]
    sheetMap?: Record<string, SheetEntry>
}

const ASSIGNEE_OPTIONS = ["佐藤", "迫", "照井"]

const STATUS_OPTIONS = [
    "",
    "重複応募（応募歴あり）",
    "保留（備考必須）",
    "書類選考中辞退",
    "書類不採用（MK対応）",
    "書類不採用（クライアント判断）",
    "【有効応募】履歴書/職歴書回収中",
    "【詳細不詳】履歴書/職歴書回収中",
    "自動送信メール返信待ち（WELLNESS）",
    "初回電話不通/SMS送付済み",
    "追電中",
    "連絡不通（不採用）",
    "公式LINE誘導中",
    "電話アポ日程調整中",
    "電話アポ日程確定済み",
    "企業面接日程調整中",
    "面接日程確定済み",
    "面接日程再調整中",
    "面接前辞退",
    "面接飛び",
    "面接後辞退",
    "面接不採用",
    "二次/最終面接調整中",
    "二次/最終面接日程確定済み",
    "二次/最終面接前辞退",
    "二次/最終面接飛び",
    "二次/最終面接後辞退",
    "二次/最終面接不採用",
    "内定",
    "内定後辞退",
    "入社前辞退",
    "入社",
    "MK提案済み",
]

function toInputDateValue(value: string | number | Date | null | undefined) {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

function toBirthDateInputValue(value: string | number | Date | null | undefined) {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}/${month}/${day}`
}

function normalizeNumericDateInput(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8)
    if (digits.length <= 4) return digits
    if (digits.length <= 6) return `${digits.slice(0, 4)}/${digits.slice(4)}`
    return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`
}

function parseBirthDateInput(value: string) {
    const digits = value.replace(/\D/g, "")
    if (digits.length !== 8) return null
    const year = Number(digits.slice(0, 4))
    const month = Number(digits.slice(4, 6))
    const day = Number(digits.slice(6))
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

    const candidate = new Date(year, month - 1, day)
    if (
        candidate.getFullYear() !== year ||
        candidate.getMonth() !== month - 1 ||
        candidate.getDate() !== day
    ) {
        return null
    }

    return candidate
}

function calcAgeFromDraft(storedDate: string | number | Date | null | undefined, draftValue: string) {
    const normalized = normalizeNumericDateInput(draftValue)
    const parsed = normalized ? parseBirthDateInput(normalized) : null
    const targetDate = parsed ?? storedDate
    if (!parsed && normalized) return "-"
    return calcAge(targetDate)
}

function toDateOrNull(value: string) {
    if (!value.trim()) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return date
}

function calcAge(dateValue: string | number | Date | null | undefined) {
    if (!dateValue) return "-"
    const birth = new Date(dateValue)
    if (Number.isNaN(birth.getTime())) return "-"
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    const dayDiff = today.getDate() - birth.getDate()
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age -= 1
    }
    return age >= 0 ? String(age) : "-"
}

const stickyBase = "sticky bg-card/95 backdrop-blur-sm z-10"

export default function ApplicantsTableClient({ applicants, sheetMap = {} }: Props) {
    const [rows, setRows] = useState(applicants)
    const [birthDateInputs, setBirthDateInputs] = useState<Record<string, string>>({})
    const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
    const [isPending, startTransition] = useTransition()

    useEffect(() => {
        setRows(applicants)
        setBirthDateInputs(
            applicants.reduce((acc, row) => {
                acc[row.id] = toBirthDateInputValue(row.birthDate)
                return acc
            }, {} as Record<string, string>),
        )
    }, [applicants])

    const updateRow = (applicantId: string, patch: Partial<Applicant>, serverPatch: Record<string, unknown>) => {
        setRows((current) =>
            current.map((row) => (row.id === applicantId ? { ...row, ...patch } : row)),
        )
        setPendingIds((current) => new Set(current).add(applicantId))

        startTransition(async () => {
            try {
                await updateApplicant(applicantId, serverPatch)
            } catch (error) {
                console.error(error)
                alert("応募者情報の更新に失敗しました。")
            } finally {
                setPendingIds((current) => {
                    const next = new Set(current)
                    next.delete(applicantId)
                    return next
                })
            }
        })
    }

    if (rows.length === 0) {
        return (
            <tr>
                <td colSpan={23} className="px-6 py-16 text-center text-muted-foreground">
                    応募者が登録されていません
                </td>
            </tr>
        )
    }

    return (
        <>
            {rows.map((row) => {
                const isResponseEmpty = !row.responseStatus?.trim()
                const appliedAt = new Date(row.appliedAt)
                const elapsedMs = Date.now() - appliedAt.getTime()
                const isWithinTwoDays = Number.isFinite(elapsedMs) && elapsedMs >= 0 && elapsedMs <= (2 * 24 * 60 * 60 * 1000)
                const showMissingAlert = isResponseEmpty && isWithinTwoDays
                const isRowPending = pendingIds.has(row.id) || isPending

                return (
                    <tr
                        key={row.id}
                        className={`transition-colors duration-100 ${showMissingAlert ? "bg-rose-50/50 hover:bg-rose-50/70" : "even:bg-muted/15 hover:bg-muted/30"}`}
                    >
                        {/* A: 応募日 (sticky) */}
                        <td className={`px-3 py-2 whitespace-nowrap text-sm left-0 min-w-[110px] ${stickyBase}`}>
                            {toInputDateValue(row.appliedAt) || "-"}
                        </td>
                        {/* B: 会社名 (sticky) */}
                        <td className={`px-3 py-2 whitespace-nowrap text-sm left-[110px] min-w-[140px] ${stickyBase}`}>
                            <span className="inline-flex items-center gap-1">
                                {row.companyName}
                                {sheetMap[row.companyId] && (
                                    <a
                                        href={`https://docs.google.com/spreadsheets/d/${sheetMap[row.companyId].spreadsheetId}/edit#gid=${sheetMap[row.companyId].gid}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`${row.companyName} のスプレッドシートを開く`}
                                        className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors duration-150"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </span>
                        </td>
                        {/* C: 案件名 (sticky) */}
                        <td className={`px-3 py-2 left-[250px] min-w-[140px] ${stickyBase}`}>
                            <input
                                defaultValue={row.caseName ?? ""}
                                onBlur={(event) =>
                                    updateRow(
                                        row.id,
                                        { caseName: event.currentTarget.value || null },
                                        { caseName: event.currentTarget.value || null },
                                    )
                                }
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                        {/* D: 氏名 (sticky) */}
                        <td className={`px-3 py-2 left-[390px] min-w-[180px] border-r border-border/50 ${stickyBase}`}>
                            <div className="flex flex-col gap-1">
                                {isResponseEmpty && (
                                    <span className="inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                                        新着
                                    </span>
                                )}
                                {showMissingAlert && (
                                    <span className="inline-flex w-fit items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200/50">
                                        未記入
                                    </span>
                                )}
                                <Link href={`/applicants/${row.id}`} className="font-medium text-primary hover:underline">
                                    {row.name}
                                </Link>
                            </div>
                        </td>
                        {/* E: mail */}
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                            {row.email || "-"}
                        </td>
                        {/* F: 応募職種名 */}
                        <td className="px-3 py-2 min-w-[220px]">
                            <input
                                defaultValue={row.appliedJob ?? ""}
                                onBlur={(event) =>
                                    updateRow(
                                        row.id,
                                        { appliedJob: event.currentTarget.value || null },
                                        { appliedJob: event.currentTarget.value || null },
                                    )
                                }
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                        {/* G: 勤務地 */}
                        <td className="px-3 py-2 min-w-[180px]">
                            <input
                                defaultValue={row.appliedLocation ?? ""}
                                onBlur={(event) =>
                                    updateRow(
                                        row.id,
                                        { appliedLocation: event.currentTarget.value || null },
                                        { appliedLocation: event.currentTarget.value || null },
                                    )
                                }
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                        {/* H: 電話番号 */}
                        <td className="px-3 py-2 min-w-[160px]">
                            <input
                                defaultValue={row.phone ?? ""}
                                onBlur={(event) =>
                                    updateRow(
                                        row.id,
                                        { phone: event.currentTarget.value || null },
                                        { phone: event.currentTarget.value || null },
                                    )
                                }
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                        {/* I: 年齢 */}
                        <td className="px-3 py-2 text-center">
                            {calcAgeFromDraft(row.birthDate, birthDateInputs[row.id] ?? "")}
                        </td>
                        {/* J: 生年月日 */}
                        <td className="px-3 py-2 min-w-[150px]">
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="0000/00/00"
                                value={birthDateInputs[row.id] ?? toBirthDateInputValue(row.birthDate)}
                                onChange={(event) => {
                                    const next = normalizeNumericDateInput(event.currentTarget.value)
                                    setBirthDateInputs((current) => ({
                                        ...current,
                                        [row.id]: next,
                                    }))
                                }}
                                onBlur={() => {
                                    const currentInput = normalizeNumericDateInput(birthDateInputs[row.id] ?? "")
                                    if (!currentInput) {
                                        updateRow(row.id, { birthDate: null }, { birthDate: null })
                                        return
                                    }

                                    const next = parseBirthDateInput(currentInput)
                                    if (!next) return

                                    updateRow(
                                        row.id,
                                        { birthDate: next },
                                        { birthDate: next },
                                    )
                                }}
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                        {/* K: 性別 */}
                        <td className="px-3 py-2 min-w-[120px]">
                            <select
                                value={row.gender ?? ""}
                                onChange={(event) =>
                                    updateRow(
                                        row.id,
                                        { gender: event.currentTarget.value || null },
                                        { gender: event.currentTarget.value || null },
                                    )
                                }
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150 cursor-pointer"
                            >
                                <option value="">選択してください</option>
                                <option value="男性">男性</option>
                                <option value="女性">女性</option>
                                <option value="その他">その他</option>
                            </select>
                        </td>
                        {/* L: 担当者名 */}
                        <td className="px-3 py-2 min-w-[150px]">
                            <input
                                list="assignee-options"
                                defaultValue={row.assigneeName ?? ""}
                                onBlur={(event) => {
                                    const next = event.currentTarget.value.trim() || null
                                    updateRow(
                                        row.id,
                                        { assigneeName: next },
                                        { assigneeName: next },
                                    )
                                }}
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150 cursor-pointer"
                            />
                            <datalist id="assignee-options">
                                {ASSIGNEE_OPTIONS.map((name) => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                        </td>
                        {/* M: 有効応募 */}
                        <td className="px-3 py-2 min-w-[80px] text-center">
                            <input
                                type="checkbox"
                                checked={row.isValidApplicant === true}
                                onChange={(event) => {
                                    const nextValue = event.currentTarget.checked
                                    updateRow(row.id, { isValidApplicant: nextValue }, { isValidApplicant: nextValue })
                                }}
                                disabled={isRowPending}
                                className="h-4 w-4 accent-primary"
                            />
                        </td>
                        {/* N: 対応状況 */}
                        <td className="px-3 py-2 min-w-[280px]">
                            <select
                                value={row.responseStatus ?? ""}
                                onChange={(event) =>
                                    updateRow(
                                        row.id,
                                        { responseStatus: event.currentTarget.value || null },
                                        { responseStatus: event.currentTarget.value || null },
                                    )
                                }
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150 cursor-pointer"
                            >
                                {STATUS_OPTIONS.map((option) => (
                                    <option key={option || "empty"} value={option}>
                                        {option || "対応状況を選択してください"}
                                    </option>
                                ))}
                            </select>
                        </td>
                        {/* O: 備考 */}
                        <td className="px-3 py-2 min-w-[200px]">
                            <input
                                defaultValue={row.notes ?? ""}
                                onBlur={(event) =>
                                    updateRow(
                                        row.id,
                                        { notes: event.currentTarget.value || null },
                                        { notes: event.currentTarget.value || null },
                                    )
                                }
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                        {/* P: 次回アクション日 */}
                        <td className="px-3 py-2 min-w-[150px]">
                            <input
                                type="date"
                                value={toInputDateValue(row.nextActionDate)}
                                onChange={(event) => {
                                    const next = toDateOrNull(event.currentTarget.value)
                                    updateRow(row.id, { nextActionDate: next }, { nextActionDate: next })
                                }}
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                        {/* Q: 通電日 */}
                        <td className="px-3 py-2 min-w-[150px]">
                            <input
                                type="date"
                                value={toInputDateValue(row.connectedAt)}
                                onChange={(event) => {
                                    const next = toDateOrNull(event.currentTarget.value)
                                    updateRow(row.id, { connectedAt: next }, { connectedAt: next })
                                }}
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                        {/* R: 面接予定日 */}
                        <td className="px-3 py-2 min-w-[150px]">
                            <input
                                type="date"
                                value={toInputDateValue(row.primaryScheduledDate)}
                                onChange={(event) => {
                                    const next = toDateOrNull(event.currentTarget.value)
                                    updateRow(row.id, { primaryScheduledDate: next }, { primaryScheduledDate: next })
                                }}
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                        {/* S: 実施可否 */}
                        <td className="px-3 py-2 min-w-[80px] text-center">
                            <input
                                type="checkbox"
                                checked={row.primaryConducted === true}
                                onChange={(event) => {
                                    const nextValue = event.currentTarget.checked
                                    updateRow(row.id, { primaryConducted: nextValue }, { primaryConducted: nextValue })
                                }}
                                disabled={isRowPending}
                                className="h-4 w-4 accent-primary"
                            />
                        </td>
                        {/* T: 二次/最終面接予定日 */}
                        <td className="px-3 py-2 min-w-[150px]">
                            <input
                                type="date"
                                value={toInputDateValue(row.secScheduledDate)}
                                onChange={(event) => {
                                    const next = toDateOrNull(event.currentTarget.value)
                                    updateRow(row.id, { secScheduledDate: next }, { secScheduledDate: next })
                                }}
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                        {/* U: 二次/最終実施可否 */}
                        <td className="px-3 py-2 min-w-[80px] text-center">
                            <input
                                type="checkbox"
                                checked={row.secConducted === true}
                                onChange={(event) => {
                                    const nextValue = event.currentTarget.checked
                                    updateRow(row.id, { secConducted: nextValue }, { secConducted: nextValue })
                                }}
                                disabled={isRowPending}
                                className="h-4 w-4 accent-primary"
                            />
                        </td>
                        {/* V: 内定可否 */}
                        <td className="px-3 py-2 min-w-[120px]">
                            <select
                                value={row.offered === true ? "1" : row.offered === null ? "0" : ""}
                                onChange={(event) => {
                                    const v = event.currentTarget.value
                                    const nextValue = v === "1" ? true : v === "0" ? null : false
                                    updateRow(row.id, { offered: nextValue }, { offered: nextValue })
                                }}
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150 cursor-pointer"
                            >
                                <option value="">選択してください</option>
                                <option value="1">内定</option>
                                <option value="0">見送り</option>
                            </select>
                        </td>
                        {/* W: 入社日 */}
                        <td className="px-3 py-2 min-w-[150px]">
                            <input
                                type="date"
                                value={toInputDateValue(row.joinedDate)}
                                onChange={(event) => {
                                    const next = toDateOrNull(event.currentTarget.value)
                                    updateRow(row.id, { joinedDate: next }, { joinedDate: next, joined: next ? true : null })
                                }}
                                disabled={isRowPending}
                                className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring/40 transition-colors duration-150"
                            />
                        </td>
                    </tr>
                )
            })}
        </>
    )
}
