"use client"

import { type ReactNode, useEffect, useMemo, useState, type ComponentType } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Building2, ChevronLeft, ChevronRight, FileSpreadsheet, LayoutDashboard, Phone, Settings, Users } from "lucide-react"

type SidebarUser = {
    name?: string | null
    email?: string | null
    image?: string | null
    isAdmin?: boolean
}

type LinkItem = {
    href: string
    label: string
    Icon: ComponentType<{ className?: string }>
}

const navItems: LinkItem[] = [
    { href: "/applicants", label: "応募者一覧", Icon: Users },
    { href: "/companies", label: "歩留まり（企業別）", Icon: Building2 },
    { href: "/calls", label: "架電ログ", Icon: Phone },
    { href: "/admin/sheets", label: "シート管理", Icon: FileSpreadsheet },
]
const adminNavItems: LinkItem[] = [
    { href: "/admin", label: "管理者画面", Icon: Settings },
]

const STORAGE_KEY = "dashboard-sidebar-collapsed"

export default function DashboardSidebarClient({
    user,
    children,
}: {
    user: SidebarUser
    children?: ReactNode
}) {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [isReady, setIsReady] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 768px)")
        const setMobileState = () => setIsMobile(!mediaQuery.matches)
        const saved = window.localStorage.getItem(STORAGE_KEY)

        setMobileState()
        setIsCollapsed(saved === "true")
        setIsReady(true)

        mediaQuery.addEventListener("change", setMobileState)
        return () => mediaQuery.removeEventListener("change", setMobileState)
    }, [])

    useEffect(() => {
        if (!isReady || isMobile) return

        window.localStorage.setItem(STORAGE_KEY, String(isCollapsed))
    }, [isCollapsed, isReady, isMobile])

    const displayCollapsed = useMemo(() => !isMobile && isCollapsed, [isMobile, isCollapsed])
    const widthClass = displayCollapsed ? "w-[68px]" : "w-[260px]"

    const isActive = (href: string) => {
        if (href === "/applicants") return pathname === "/applicants" || pathname.startsWith("/applicants/")
        if (href === "/companies") return pathname.startsWith("/companies")
        if (href === "/calls") return pathname.startsWith("/calls")
        return pathname === href || pathname.startsWith(href + "/")
    }

    return (
        <aside className={`${widthClass} flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] relative z-20 overflow-hidden`} style={{ boxShadow: "var(--shadow-sidebar)" }}>
            {/* Logo / Brand */}
            <div className={`h-[60px] flex items-center ${displayCollapsed ? "px-3 justify-center" : "px-5"} border-b border-sidebar-border`}>
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }}>
                    <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
                </div>
                <span className={`font-semibold tracking-tight text-[15px] text-sidebar-foreground ml-3 ${displayCollapsed ? "hidden" : "block"}`}>RPO System</span>
                <button
                    type="button"
                    onClick={() => setIsCollapsed((value) => !value)}
                    aria-label={displayCollapsed ? "サイドバーを展開" : "サイドバーを折り畳む"}
                    title={displayCollapsed ? "サイドバーを展開" : "サイドバーを折り畳む"}
                    className="ml-auto w-7 h-7 rounded-md flex items-center justify-center hover:bg-sidebar-accent text-muted-foreground hidden md:flex transition-colors duration-150 cursor-pointer"
                >
                    {displayCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Navigation */}
            <nav className={`flex-1 ${displayCollapsed ? "px-2" : "px-3"} pt-4 space-y-1`}>
                {[...navItems, ...(user.isAdmin ? adminNavItems : [])].map((item) => {
                    const active = isActive(item.href)
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`group relative flex items-center gap-3 w-full ${displayCollapsed ? "px-0 justify-center" : "px-3"} py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 cursor-pointer ${
                                active
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent"
                            }`}
                            title={item.label}
                        >
                            {active && (
                                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                            )}
                            <item.Icon className={`w-[18px] h-[18px] shrink-0 transition-colors duration-150 ${active ? "text-primary" : "opacity-60 group-hover:opacity-90"}`} />
                            <span className={`${displayCollapsed ? "sr-only" : "truncate"}`}>{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* User profile */}
            <div className={`${displayCollapsed ? "px-2" : "px-3"} pb-4 pt-3 border-t border-sidebar-border mt-auto`}>
                <div className={`flex items-center gap-3 ${displayCollapsed ? "justify-center" : "px-3"} py-2 rounded-lg`}>
                    {user.image ? (
                        <Image
                            src={user.image}
                            alt="Avatar"
                            width={32}
                            height={32}
                            unoptimized
                            className="w-8 h-8 rounded-full ring-1 ring-border shrink-0"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold ring-1 ring-primary/20 shrink-0">
                            {user.name?.[0] || "U"}
                        </div>
                    )}
                    <div className={`flex flex-col overflow-hidden min-w-0 ${displayCollapsed ? "hidden" : "block"}`}>
                        <span className="text-[13px] font-medium text-sidebar-foreground truncate">{user.name}</span>
                        <span className="text-[11px] text-muted-foreground truncate">{user.email}</span>
                    </div>
                </div>
                <div className={displayCollapsed ? "px-1" : "px-2"}>{children}</div>
            </div>
        </aside>
    )
}
