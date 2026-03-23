"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import ColumnFilterSelect from "./ColumnFilterSelect"
import { ASSIGNEE_OPTIONS, STATUS_OPTIONS, GENDER_OPTIONS } from "@/lib/constants"

type Props = {
    assigneeName?: string
    responseStatus?: string
    isValidApplicant?: string
    gender?: string
}

const VALID_APPLICANT_OPTIONS = ["true", "false"] as const
const VALID_APPLICANT_LABELS: Record<string, string> = {
    true: "有効",
    false: "無効",
}

const statusOptionsForFilter = STATUS_OPTIONS.filter((s) => s !== "")

export default function ApplicantFilterBar({ assigneeName, responseStatus, isValidApplicant, gender }: Props) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()

    const activeCount = [assigneeName, responseStatus, isValidApplicant, gender].filter(Boolean).length

    const handleClear = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("assigneeName")
        params.delete("responseStatus")
        params.delete("isValidApplicant")
        params.delete("gender")
        params.delete("page")

        const nextQuery = params.toString()
        const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname
        router.replace(nextPath)
    }

    const handleValidApplicantChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams(searchParams.toString())
        const value = event.target.value

        if (value) {
            params.set("isValidApplicant", value)
        } else {
            params.delete("isValidApplicant")
        }

        params.delete("page")

        const nextQuery = params.toString()
        const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname
        router.replace(nextPath)
    }

    const isValidActive = !!isValidApplicant

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
            <ColumnFilterSelect
                paramName="gender"
                label="性別"
                options={GENDER_OPTIONS}
                selectedValue={gender}
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
