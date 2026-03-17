import { redirect } from "next/navigation"
import DashboardSidebarClient from "./DashboardSidebarClient"
import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth()

    if (!session?.user) {
        redirect("/login")
    }

    const currentUser = {
        name: session.user.name || session.user.email || "ユーザー",
        email: session.user.email || "",
        image: session.user.image || null,
        isAdmin: false,
    }

    return (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans">
            {/* Sidebar Navigation */}
            <DashboardSidebarClient user={currentUser} />

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 relative h-full">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/[0.03] via-transparent to-transparent pointer-events-none" />
                <div className="flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8 relative z-10">
                    <div className="max-w-[1400px] mx-auto w-full h-full animate-in fade-in duration-500 ease-out">
                        {children}
                    </div>
                </div>
            </main>
        </div>
    )
}
