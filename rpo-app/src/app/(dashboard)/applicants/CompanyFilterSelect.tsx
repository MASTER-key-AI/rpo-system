"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChangeEvent } from "react"

type CompanyOption = {
    id: string
    name: string
}

type Props = {
    companies: CompanyOption[]
    selectedCompanyId?: string
}

export default function CompanyFilterSelect({ companies, selectedCompanyId }: Props) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleCompanyChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const params = new URLSearchParams(searchParams.toString())
        const value = event.target.value

        if (value) {
            params.set("companyId", value)
        } else {
            params.delete("companyId")
        }

        params.delete("page")

        const nextQuery = params.toString()
        const nextPath = nextQuery ? `${pathname}?${nextQuery}` : pathname
        router.replace(nextPath)
    }

    return (
        <form method="GET" className="flex items-center">
            <select
                name="companyId"
                defaultValue={selectedCompanyId || ""}
                onChange={handleCompanyChange}
                className="h-9 px-3 rounded-lg border border-input bg-background cursor-pointer text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200"
            >
                <option value="">全ての企業</option>
                {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                        {company.name}
                    </option>
                ))}
            </select>
            <noscript>
                <button type="submit" className="sr-only">
                    絞り込み
                </button>
            </noscript>
        </form>
    )
}
