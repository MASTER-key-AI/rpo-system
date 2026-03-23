"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Phone, History, BarChart3 } from "lucide-react"

const tabs = [
    { href: "/calls/register", label: "架電登録", Icon: Phone },
    { href: "/calls/history", label: "架電履歴", Icon: History },
    { href: "/calls/analysis", label: "履歴分析", Icon: BarChart3 },
]

function isActive(pathname: string, href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
}

export default function CallLogsSectionTabs() {
    const pathname = usePathname()

    return (
        <nav className="grid grid-cols-3 gap-2">
            {tabs.map((item) => {
                const active = isActive(pathname, item.href)

                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-all ${
                            active
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card hover:bg-muted/50 text-muted-foreground border-border"
                        }`}
                    >
                        <item.Icon className="w-4 h-4" />
                        {item.label}
                    </Link>
                )
            })}
        </nav>
    )
}
