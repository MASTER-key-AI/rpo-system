"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateApplicant, addCallLog, deleteCallLog, deleteApplicant } from "@/lib/actions/applicant"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExternalLink, Trash2 } from "lucide-react"

type ApplicantBooleanField =
    | "isUniqueApplicant"
    | "isValidApplicant"
    | "docDeclined"
    | "docRejectedMK"
    | "docRejectedClient"
    | "schedulingInterview"
    | "interviewDeclinedBefore"
    | "primaryNoShow"
    | "primaryScheduled"
    | "primaryConducted"
    | "primaryDeclinedAfter"
    | "primaryRejected"
    | "secScheduled"
    | "secDeclinedBefore"
    | "secNoShow"
    | "secConducted"
    | "secDeclinedAfter"
    | "secRejected"
    | "finalScheduled"
    | "finalDeclinedBefore"
    | "finalNoShow"
    | "finalConducted"
    | "finalDeclinedAfter"
    | "finalRejected"
    | "offered"
    | "offerDeclined"
    | "joined"

type ApplicantDateField =
    | "nextActionDate"
    | "primaryScheduledDate"
    | "primaryConductedDate"
    | "secScheduledDate"
    | "secConductedDate"
    | "finalScheduledDate"
    | "finalConductedDate"
    | "joinedDate"

type ApplicantTextField = "nextActionContent"

type ApplicantCallLog = {
    id: string
    calledAt: string | number | Date | null
    callerName: string
    callCount: number
    isConnected: boolean | null
    note: string | null
}

type ApplicantData = {
    id: string
    name: string
    furigana: string | null
    appliedAt: string | number | Date
    appliedJob: string | null
    appliedLocation: string | null
    email: string | null
    phone: string | null
    age: number | null
    birthDate: string | number | Date | null
    address: string | null
    gender: string | null
    company: {
        id: string
        name: string
    } | null
    callLogs: ApplicantCallLog[]
} & Partial<Record<ApplicantBooleanField, boolean | null>> &
    Partial<Record<ApplicantDateField, string | number | Date | null>> &
    Partial<Record<ApplicantTextField, string | null>>

type ApplicantDetailClientProps = {
    initialData: ApplicantData
}

const boolValue = (value: boolean | null | undefined) => value === true

type UpdatableValue = boolean | Date | string | null
type ApplicantUpdatableField = ApplicantBooleanField | ApplicantDateField | ApplicantTextField
type ApplicantUpdatablePatch = Partial<Record<ApplicantUpdatableField, UpdatableValue>>

const AUTO_SAVE_DELAY_MS = 260
const PHONE_ALLOWED_PATTERN = /^[0-9-]+$/

function formatText(value: string | null | undefined) {
    const trimmed = value?.trim()
    return trimmed ? trimmed : "未設定"
}

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

function toOptionalTextValue(value: FormDataEntryValue | null) {
    if (typeof value !== "string") return null
    const trimmed = value.trim()
    return trimmed ? trimmed : null
}

function parseBooleanValue(rawValue: FormDataEntryValue | null) {
    return rawValue === "on" || rawValue === "1" || rawValue === "true"
}

function normalizeDateInput(value: string) {
    return value.trim().replaceAll("/", "-").replaceAll(".", "-")
}

function parseDateInput(value: FormDataEntryValue | null) {
    if (typeof value !== "string") return null
    const normalized = normalizeDateInput(value).trim()
    if (!normalized) return null

    const parts = normalized.split("-")
    if (parts.length === 3) {
        const year = Number(parts[0])
        const month = Number(parts[1])
        const day = Number(parts[2])
        if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
            return new Date(year, month - 1, day)
        }
    }

    const date = new Date(normalized)
    return Number.isNaN(date.getTime()) ? null : date
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
    const day = Number(digits.slice(6, 8))
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

function validatePhoneInput(value: string | null) {
    if (!value) {
        return { normalized: null, error: null }
    }

    const raw = value.trim()
    if (!raw) {
        return { normalized: null, error: null }
    }

    if (!PHONE_ALLOWED_PATTERN.test(raw)) {
        return { normalized: null, error: "電話番号は半角数字とハイフンのみ入力してください。" }
    }

    const digits = raw.replace(/-/g, "")
    if (!/^[0-9]{10,11}$/.test(digits)) {
        return { normalized: null, error: "電話番号は10桁または11桁の半角数字で入力してください。" }
    }

    return { normalized: digits, error: null }
}

function toTextInputValue(value: string | null | undefined) {
    return value ?? ""
}

function calcAgeString(dateValue: string | number | Date | null | undefined) {
    if (!dateValue) return "未設定"
    const birth = new Date(dateValue)
    if (Number.isNaN(birth.getTime())) return "未設定"
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    const dayDiff = today.getDate() - birth.getDate()
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age -= 1
    }
    if (!Number.isFinite(age) || age < 0) return "未設定"
    return `${age}歳`
}

export default function ApplicantDetailClient({ initialData, sheetUrl }: ApplicantDetailClientProps & { sheetUrl?: string }) {
    const [draftData, setDraftData] = useState(initialData)
    const [birthDateInput, setBirthDateInput] = useState(() => toBirthDateInputValue(initialData.birthDate))
    const [pendingFields, setPendingFields] = useState<Set<string>>(new Set())
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const updateQueueRef = useRef<ApplicantUpdatablePatch>({})
    const rollbackQueueRef = useRef<Record<string, unknown>>({})
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isFlushingRef = useRef(false)

    const setFieldPending = (field: string, value: boolean) => {
        setPendingFields((current) => {
            if (value) {
                if (current.has(field)) return current
                const next = new Set(current)
                next.add(field)
                return next
            }

            if (!current.has(field)) return current
            const next = new Set(current)
            next.delete(field)
            return next
        })
    }

    const isFieldPending = (field: string) => pendingFields.has(field)

    const clearFlushTimer = () => {
        if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current)
            flushTimerRef.current = null
        }
    }

    const requestFlush = () => {
        clearFlushTimer()
        flushTimerRef.current = setTimeout(() => {
            flushTimerRef.current = null
            void flushQueuedUpdates()
        }, AUTO_SAVE_DELAY_MS)
    }

    const flushQueuedUpdates = async () => {
        if (isFlushingRef.current) return

        const patch = updateQueueRef.current
        const fields = Object.keys(patch) as ApplicantUpdatableField[]
        if (fields.length === 0) return

        isFlushingRef.current = true
        updateQueueRef.current = {}

        try {
            await updateApplicant(initialData.id, patch as Partial<Record<string, UpdatableValue>>)
        } catch (error) {
            setDraftData((current) => {
                const next = { ...current } as ApplicantData
                for (const field of fields) {
                    if (Object.prototype.hasOwnProperty.call(rollbackQueueRef.current, field)) {
                        ;(next as Record<string, unknown>)[field] = rollbackQueueRef.current[field]
                    }
                }
                return next
            })
            console.error(error)
            alert("応募者情報の更新に失敗しました。")
        } finally {
            for (const field of fields) {
                setFieldPending(field, false)
                delete rollbackQueueRef.current[field]
            }
            isFlushingRef.current = false

            if (Object.keys(updateQueueRef.current).length > 0) {
                requestFlush()
            }
        }
    }

    const queueFieldUpdate = (field: ApplicantUpdatableField, nextValue: UpdatableValue) => {
        let previousValue: unknown = null

        setDraftData((current) => {
            previousValue = current[field]
            return {
                ...current,
                [field]: nextValue,
            }
        })
        setFieldPending(field, true)

        if (!Object.prototype.hasOwnProperty.call(rollbackQueueRef.current, field)) {
            rollbackQueueRef.current[field] = previousValue
        }

        updateQueueRef.current = {
            ...updateQueueRef.current,
            [field]: nextValue,
        }
        requestFlush()
    }

    useEffect(() => {
        return () => {
            clearFlushTimer()
        }
    }, [])

    useEffect(() => {
        setBirthDateInput(toBirthDateInputValue(initialData.birthDate))
    }, [initialData.birthDate])

    const handleSaveBasicInfo = (formData: FormData) => {
        const name = toOptionalTextValue(formData.get("name")) || ""
        const appliedAt = parseDateInput(formData.get("appliedAt"))
        const parsedBirthDate = birthDateInput ? parseBirthDateInput(birthDateInput) : null
        if (birthDateInput && !parsedBirthDate) {
            alert("生年月日は YYYY/MM/DD 形式で正しく入力してください。")
            return
        }

        const phoneValidation = validatePhoneInput(toOptionalTextValue(formData.get("phone")))
        if (phoneValidation.error) {
            alert(phoneValidation.error)
            return
        }

        const rawAge = toOptionalTextValue(formData.get("age"))
        const parsedAge = rawAge ? Number(rawAge) : null
        if (rawAge && (!Number.isFinite(parsedAge) || (parsedAge !== null && parsedAge < 0))) {
            alert("年齢は0以上の整数で入力してください。")
            return
        }

        const payload = {
            name,
            furigana: toOptionalTextValue(formData.get("furigana")),
            email: toOptionalTextValue(formData.get("email")),
            phone: phoneValidation.normalized,
            appliedJob: toOptionalTextValue(formData.get("appliedJob")),
            appliedLocation: toOptionalTextValue(formData.get("appliedLocation")),
            birthDate: parsedBirthDate,
            age: parsedAge,
            address: toOptionalTextValue(formData.get("address")),
            gender: toOptionalTextValue(formData.get("gender")),
        }

        if (!payload.name || !appliedAt) {
            alert("応募者名と応募日は必須です。")
            return
        }

        startTransition(async () => {
            try {
                await updateApplicant(initialData.id, { ...payload, appliedAt })
                router.refresh()
            } catch (error) {
                console.error(error)
                alert("基本情報の更新に失敗しました。")
            }
        })
    }

    const handleToggle = (field: ApplicantBooleanField, checked: boolean) => {
        queueFieldUpdate(field, checked)
    }

    const handleDateChange = (field: ApplicantDateField, dateString: string) => {
        const nextValue = dateString ? new Date(dateString) : null
        queueFieldUpdate(field, nextValue)
    }

    const handleTextChange = (field: ApplicantTextField, nextText: string) => {
        queueFieldUpdate(field, toOptionalTextValue(nextText))
    }

    const handleDeleteCallLog = (callLogId: string) => {
        if (!confirm("この架電ログを削除してよいですか？この操作は元に戻せません。")) return

        startTransition(async () => {
            try {
                await deleteCallLog(callLogId)
                router.refresh()
            } catch (error) {
                console.error(error)
                alert("架電ログの削除に失敗しました。")
            }
        })
    }

    const handleDeleteApplicant = () => {
        if (!confirm(`この応募者「${draftData.name}」を削除してよいですか？この操作は元に戻せません。`)) return

        startTransition(async () => {
            try {
                await deleteApplicant(initialData.id)
                router.push("/applicants")
            } catch (error) {
                console.error(error)
                alert("応募者の削除に失敗しました。")
            }
        })
    }

    const renderCheckbox = (field: ApplicantBooleanField, label: string) => (
        <div className="flex items-center space-x-2.5 bg-muted/20 p-3 rounded-lg border border-border/40 hover:border-primary/25 hover:bg-muted/30 transition-all duration-150">
            <Checkbox
                id={field}
                checked={boolValue(draftData[field])}
                onCheckedChange={(c) => handleToggle(field, c === true)}
                disabled={isFieldPending(field)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary cursor-pointer"
            />
            <Label htmlFor={field} className="text-[13px] font-medium leading-none cursor-pointer text-foreground whitespace-nowrap">
                {label}
            </Label>
        </div>
    )

    const renderDateInput = (field: ApplicantDateField, label: string) => (
        <div className="flex flex-col space-y-1.5 bg-muted/20 p-2.5 rounded-lg border border-border/40 flex-1 hover:border-primary/20 transition-colors duration-150">
            <Label htmlFor={field} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
            <Input
                type="date"
                id={field}
                value={toInputDateValue(draftData[field])}
                onChange={(e) => handleDateChange(field, e.target.value)}
                disabled={isFieldPending(field)}
                className="h-8 text-sm"
            />
        </div>
    )

    const renderTextInput = (field: ApplicantTextField, label: string, placeholder = "") => (
        <div className="flex flex-col space-y-1.5 bg-muted/20 p-2.5 rounded-lg border border-border/40 flex-1 hover:border-primary/20 transition-colors duration-150">
            <Label htmlFor={field} className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
            <Input
                id={field}
                value={toTextInputValue(typeof draftData[field] === "string" ? draftData[field] : null)}
                onChange={(event) => handleTextChange(field, event.currentTarget.value)}
                placeholder={placeholder}
                disabled={isFieldPending(field)}
                className="h-8 text-sm"
            />
        </div>
    )

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3 flex justify-end">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleDeleteApplicant}
                    disabled={isPending}
                    className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    応募者を削除
                </Button>
            </div>

            <div className="lg:col-span-2 space-y-6">
                <Card className="border border-primary/25 bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="bg-primary/[0.06] border-b border-primary/15 pb-4">
                        <CardTitle className="text-base font-semibold text-primary">次回アクション</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {renderDateInput("nextActionDate", "次回アクション日")}
                            {renderTextInput("nextActionContent", "アクション内容", "例: 書類提出確認")}
                        </div>
                    </CardContent>
                </Card>

                <Card className="border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="bg-muted/30 border-b border-border pb-4">
                        <CardTitle className="text-base font-semibold">応募情報（連携データ）</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form action={handleSaveBasicInfo} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <Label htmlFor="appliedAt">応募日</Label>
                                <Input
                                    type="date"
                                    id="appliedAt"
                                    name="appliedAt"
                                    defaultValue={toInputDateValue(initialData.appliedAt)}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="name">応募者名</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    defaultValue={initialData.name}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="furigana">ふりがな</Label>
                                <Input
                                    id="furigana"
                                    name="furigana"
                                    defaultValue={initialData.furigana ?? ""}
                                    placeholder="例: やまだ たろう"
                                />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">応募企業名</p>
                                <p className="font-medium text-foreground inline-flex items-center gap-1">
                                    {formatText(initialData.company?.name)}
                                    {sheetUrl && (
                                        <a
                                            href={sheetUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="スプレッドシートを開く"
                                            className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors duration-150"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                </p>
                            </div>
                            <div>
                                <Label htmlFor="email">メールアドレス</Label>
                                <Input
                                    type="email"
                                    id="email"
                                    name="email"
                                    defaultValue={initialData.email ?? ""}
                                    placeholder="例: example@example.com"
                                />
                            </div>
                            <div>
                                <Label htmlFor="phone">TEL</Label>
                                <Input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    defaultValue={initialData.phone ?? ""}
                                    placeholder="090-0000-0000"
                                    inputMode="numeric"
                                />
                            </div>
                            <div>
                                <Label htmlFor="age">年齢</Label>
                                <Input
                                    type="number"
                                    id="age"
                                    name="age"
                                    min={0}
                                    max={150}
                                    defaultValue={initialData.age ?? ""}
                                    placeholder={calcAgeString(parseBirthDateInput(birthDateInput)).replace("歳", "")}
                                />
                                <div className="mt-1 text-xs text-muted-foreground">
                                    生年月日から: {calcAgeString(parseBirthDateInput(birthDateInput))}
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="birthDate">生年月日</Label>
                                <Input
                                    type="text"
                                    id="birthDate"
                                    name="birthDate"
                                    value={birthDateInput}
                                    placeholder="例: 1990/01/01"
                                    inputMode="numeric"
                                    maxLength={10}
                                    onChange={(e) => setBirthDateInput(normalizeNumericDateInput(e.currentTarget.value))}
                                />
                            </div>
                            <div>
                                <Label htmlFor="appliedJob">応募職種</Label>
                                <Input
                                    id="appliedJob"
                                    name="appliedJob"
                                    defaultValue={initialData.appliedJob ?? ""}
                                />
                            </div>
                            <div>
                                <Label htmlFor="appliedLocation">応募勤務地</Label>
                                <Input
                                    id="appliedLocation"
                                    name="appliedLocation"
                                    defaultValue={initialData.appliedLocation ?? ""}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label htmlFor="address">住所</Label>
                                <Input
                                    id="address"
                                    name="address"
                                    defaultValue={initialData.address ?? ""}
                                />
                            </div>
                            <div>
                                <Label htmlFor="gender">性別</Label>
                                <select
                                    id="gender"
                                    name="gender"
                                    defaultValue={initialData.gender ?? ""}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                >
                                    <option value="">選択してください</option>
                                    <option value="男性">男性</option>
                                    <option value="女性">女性</option>
                                    <option value="その他">その他</option>
                                </select>
                            </div>
                            <div className="md:col-span-2 pt-2">
                                <Button type="submit" size="sm" disabled={isPending}>
                                    基本情報を保存
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* 基本フラグ */}
                <Card className="border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="bg-muted/30 border-b border-border pb-4">
                        <CardTitle className="text-base font-semibold">エントリー・書類選考フェーズ</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {renderCheckbox("isUniqueApplicant", "ユニーク応募")}
                        {renderCheckbox("isValidApplicant", "有効応募")}
                        {renderCheckbox("docDeclined", "書類選考中辞退")}
                        {renderCheckbox("docRejectedMK", "書類不採用(MK判断)")}
                        {renderCheckbox("docRejectedClient", "書類不採用(クライアント)")}
                        {renderCheckbox("schedulingInterview", "企業面接日程調整中")}
                    </CardContent>
                </Card>

                {/* 1次面接 */}
                <Card className="border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="bg-muted/30 border-b border-border pb-4">
                        <CardTitle className="text-base font-semibold">1次面接</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {renderCheckbox("primaryScheduled", "1次面接予定")}
                        {renderDateInput("primaryScheduledDate", "1次面接設定日")}
                        {renderCheckbox("interviewDeclinedBefore", "面接前辞退")}
                        {renderCheckbox("primaryConducted", "1次面接実施")}
                        {renderDateInput("primaryConductedDate", "1次面接実施日")}
                        {renderCheckbox("primaryNoShow", "1次面接飛び")}
                        {renderCheckbox("primaryDeclinedAfter", "1次面接後辞退")}
                        {renderCheckbox("primaryRejected", "1次面接不採用")}
                    </CardContent>
                </Card>

                {/* 2次面接 */}
                <Card className="border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="bg-muted/30 border-b border-border pb-4">
                        <CardTitle className="text-base font-semibold">2次面接</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {renderCheckbox("secScheduled", "2次面接予定")}
                        {renderDateInput("secScheduledDate", "2次面接設定日")}
                        {renderCheckbox("secDeclinedBefore", "2次面接前辞退")}
                        {renderCheckbox("secConducted", "2次面接実施")}
                        {renderDateInput("secConductedDate", "2次面接実施日")}
                        {renderCheckbox("secNoShow", "2次面接飛び")}
                        {renderCheckbox("secDeclinedAfter", "2次面接後辞退")}
                        {renderCheckbox("secRejected", "2次面接不採用")}
                    </CardContent>
                </Card>

                {/* 最終面接（任意） */}
                <Card className="border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="bg-muted/30 border-b border-border pb-4">
                        <CardTitle className="text-base font-semibold">最終面接 (任意)</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {renderCheckbox("finalScheduled", "最終面接予定")}
                        {renderDateInput("finalScheduledDate", "最終面接設定日")}
                        {renderCheckbox("finalDeclinedBefore", "最終面接前辞退")}
                        {renderCheckbox("finalConducted", "最終面接実施")}
                        {renderDateInput("finalConductedDate", "最終面接実施日")}
                        {renderCheckbox("finalNoShow", "最終面接飛び")}
                        {renderCheckbox("finalDeclinedAfter", "最終面接後辞退")}
                        {renderCheckbox("finalRejected", "最終面接不採用")}
                    </CardContent>
                </Card>

                {/* 内定・入社 */}
                <Card className="border border-primary/20 overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                    <CardHeader className="bg-primary/[0.06] border-b border-primary/15 pb-4">
                        <CardTitle className="text-base font-semibold text-primary">結果（内定・入社）</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {renderCheckbox("offered", "内定")}
                        {renderCheckbox("offerDeclined", "内定後辞退")}
                        {renderCheckbox("joined", "入社")}
                        {renderDateInput("joinedDate", "入社日")}
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                {/* 架電履歴 */}
                <Card className="border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                    <div className="h-0.5 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent"></div>
                    <CardHeader>
                        <CardTitle className="text-base font-semibold">架電ログ</CardTitle>
                        <CardDescription>候補者への連絡記録</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 mb-6">
                            {initialData.callLogs.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">履歴がありません</p>
                            ) : (
                                initialData.callLogs.map((log) => (
                                    <div key={log.id} className="text-sm border-l-2 border-primary/25 pl-3 py-2 bg-muted/15 rounded-r-lg px-4 relative group transition-colors duration-150 hover:bg-muted/30">
                                        <div className="flex justify-between items-center gap-2 text-muted-foreground text-xs mb-1">
                                            <span className="tabular-nums">{new Date(log.calledAt || 0).toLocaleString("ja-JP")}</span>
                                            <span>担当: {log.callerName}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteCallLog(log.id)}
                                                disabled={isPending}
                                                className="text-destructive/80 hover:text-destructive hover:underline whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                削除
                                            </button>
                                        </div>
                                        <p className="text-foreground">{log.callCount}回目の架電: {log.note}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        <form action={async (formData) => {
                            await addCallLog({
                                applicantId: initialData.id,
                                isConnected: parseBooleanValue(formData.get("isConnected")),
                                note: (formData.get("note") as string) || null,
                                calledAt: new Date(),
                            })
                        }} className="mt-4 pt-4 border-t border-border">
                            <div className="flex gap-2 items-center">
                                <div className="flex items-center space-x-2 shrink-0 bg-muted/20 border border-border/40 px-3 py-1.5 rounded-lg hover:border-primary/25 transition-colors duration-150">
                                    <Checkbox id="isConnected" name="isConnected" value="true" />
                                    <Label htmlFor="isConnected" className="text-sm cursor-pointer whitespace-nowrap">通電</Label>
                                </div>
                                <Input name="note" placeholder="架電メモを入力..." className="h-9 text-sm flex-1" required />
                                <Button type="submit" size="sm" className="h-9 shrink-0">記録</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
