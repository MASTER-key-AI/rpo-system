"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChangeEvent } from "react"

type Props = {
    paramName: string
    label: string
    options: readonly string[]
    selectedValue?: string
}

export default function ColumnFilterSelect({ paramName, label, options, selectedValue }: Props) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()

    const isActive = !!selectedValue

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams(searchParams.toString())
        const value = event.target.value

        if (value) {
            params.set(paramName, value)
        } else {
            params.delete(paramName)
        }

        params.delete("page")

        const nextQuery = params.toString()
        const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname
        router.replace(nextPath)
    }

    return (
        <select
            value={selectedValue || ""}
            onChange={handleChange}
            className={`h-8 px-2.5 rounded-lg border text-[13px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200 ${
                isActive
                    ? "border-primary bg-primary/5 text-foreground font-medium"
                    : "border-input bg-background text-muted-foreground"
            }`}
        >
            <option value="">{label}</option>
            {options.map((option) => (
                <option key={option} value={option}>
                    {option}
                </option>
            ))}
        </select>
    )
}
