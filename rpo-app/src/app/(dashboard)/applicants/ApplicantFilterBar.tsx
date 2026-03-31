"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import ColumnFilterSelect from "./ColumnFilterSelect"
import { ASSIGNEE_OPTIONS, STATUS_OPTIONS, GENDER_OPTIONS } from "@/lib/constants"

type Props = {
    assigneeName?: string
    responseStatus?: string
    isValidApplicant?: string
    gender?: string
    offered?: string
    appliedDateFrom?: string
    appliedDateTo?: string
}

const VALID_APPLICANT_OPTIONS = ["true", "false"] as const
const VALID_APPLICANT_LABELS: Record<string, string> = {
    true: "有効",
    false: "無効",
}

const OFFERED_OPTIONS = ["true", "false"] as const
const OFFERED_LABELS: Record<string, string> = {
    true: "内定あり",
    false: "内定なし",
}

const statusOptionsForFilter = STATUS_OPTIONS.filter((s) => s !== "")

export default function ApplicantFilterBar({
    assigneeName,
    responseStatus,
    isValidApplicant,
    gender,
    offered,
    appliedDateFrom,
    appliedDateTo,
}: Props) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()

    const activeCount = [
        assigneeName,
        responseStatus,
        isValidApplicant,
        gender,
        offered,
        appliedDateFrom,
        appliedDateTo,
    ].filter(Boolean).length

    const updateParam = (paramName: string, value?: string) => {
        const params = new URLSearchParams(searchParams.toString())
        const nextValue = (value || "").trim()
        if (nextValue) {
            params.set(paramName, nextValue)
        } else {
            params.delete(paramName)
        }
        params.delete("page")
        const nextQuery = params.toString()
        const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname
        router.replace(nextPath)
    }

    const handleClear = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("assigneeName")
        params.delete("responseStatus")
        params.delete("isValidApplicant")
        params.delete("gender")
        params.delete("offered")
        params.delete("appliedDateFrom")
        params.delete("appliedDateTo")
        params.delete("page")

        const nextQuery = params.toString()
        const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname
        router.replace(nextPath)
    }

    const handleValidApplicantChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        updateParam("isValidApplicant", event.target.value)
    }

    const handleOfferedChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        updateParam("offered", event.target.value)
    }

    const handleAppliedDateFromChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        updateParam("appliedDateFrom", event.target.value)
    }

    const handleAppliedDateToChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        updateParam("appliedDateTo", event.target.value)
    }

    const isValidActive = !!isValidApplicant
    const offeredActive = !!offered
    const appliedDateFromActive = !!appliedDateFrom
    const appliedDateToActive = !!appliedDateTo

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <ColumnFilterSelect
                paramName="assigneeName"
                label="担当者"
                options={ASSIGNEE_OPTIONS}
                selectedValue={assigneeName}
            />
            <ColumnFilterSelect
                paramName="responseStatus"
                label="対応状況"
                options={statusOptionsForFilter}
                selectedValue={responseStatus}
            />
            <select
                value={isValidApplicant || ""}
                onChange={handleValidApplicantChange}
                className={`h-8 px-2.5 rounded-lg border text-[13px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200 ${
                    isValidActive
                        ? "border-primary bg-primary/5 text-foreground font-medium"
                        : "border-input bg-background text-muted-foreground"
                }`}
            >
                <option value="">有効応募</option>
                {VALID_APPLICANT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                        {VALID_APPLICANT_LABELS[option]}
                    </option>
                ))}
            </select>
            <select
                value={offered || ""}
                onChange={handleOfferedChange}
                className={`h-8 px-2.5 rounded-lg border text-[13px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200 ${
                    offeredActive
                        ? "border-primary bg-primary/5 text-foreground font-medium"
                        : "border-input bg-background text-muted-foreground"
                }`}
            >
                <option value="">内定可否</option>
                {OFFERED_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                        {OFFERED_LABELS[option]}
                    </option>
                ))}
            </select>
            <ColumnFilterSelect
                paramName="gender"
                label="性別"
                options={GENDER_OPTIONS}
                selectedValue={gender}
            />
            <input
                type="date"
                value={appliedDateFrom || ""}
                onChange={handleAppliedDateFromChange}
                className={`h-8 px-2.5 rounded-lg border text-[13px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200 ${
                    appliedDateFromActive
                        ? "border-primary bg-primary/5 text-foreground font-medium"
                        : "border-input bg-background text-muted-foreground"
                }`}
                aria-label="応募日From"
                title="応募日From"
            />
            <input
                type="date"
                value={appliedDateTo || ""}
                onChange={handleAppliedDateToChange}
                className={`h-8 px-2.5 rounded-lg border text-[13px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200 ${
                    appliedDateToActive
                        ? "border-primary bg-primary/5 text-foreground font-medium"
                        : "border-input bg-background text-muted-foreground"
                }`}
                aria-label="応募日To"
                title="応募日To"
            />
            {activeCount > 0 && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-input bg-background text-[13px] text-muted-foreground hover:bg-muted transition-colors duration-150 cursor-pointer"
                >
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                        {activeCount}
                    </span>
                    クリア
                </button>
            )}
        </div>
    )
}
