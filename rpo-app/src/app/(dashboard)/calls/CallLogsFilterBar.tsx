"use client"

import { ChangeEvent } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

type Option = {
    id: string
    name: string
}

type Props = {
    companies: Option[]
    users: Array<{ id: string; name: string | null; email: string | null }>
    selectedCompanyId?: string
    selectedCallerId?: string
}

type SearchParamsLike = {
    toString: () => string
    get: (name: string) => string | null
}

function buildQueryString(pathname: string, searchParams: SearchParamsLike, next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(next).forEach(([key, value]) => {
        if (value) {
            params.set(key, value)
        } else {
            params.delete(key)
        }
    })

    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
}

export default function CallLogsFilterBar({ companies, users, selectedCompanyId, selectedCallerId }: Props) {
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()

    const handleCompanyChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const next = buildQueryString(pathname, searchParams, {
            companyId: event.target.value,
            callerId: searchParams.get("callerId") || ""
        })

        router.replace(next)
    }

    const handleCallerChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const next = buildQueryString(pathname, searchParams, {
            companyId: searchParams.get("companyId") || "",
            callerId: event.target.value
        })

        router.replace(next)
    }

    return (
        <form method="GET" className="px-4 py-3 border-b border-border bg-muted/20 flex gap-3">
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

            <select
                name="callerId"
                defaultValue={selectedCallerId || ""}
                onChange={handleCallerChange}
                className="h-9 px-3 rounded-lg border border-input bg-background cursor-pointer text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all duration-200"
            >
                <option value="">全ての担当者</option>
                {users.map((user) => (
                    <option key={user.id} value={user.id}>
                        {user.name || user.email || "名無し"}
                    </option>
                ))}
            </select>

            <noscript>
                <button type="submit" className="px-3 bg-primary text-primary-foreground rounded-lg text-sm">絞り込み</button>
            </noscript>
        </form>
    )
}
