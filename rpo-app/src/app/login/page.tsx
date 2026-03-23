import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { GoogleSignInButton } from "./google-signin-button"

type LoginPageProps = {
    searchParams: Promise<{ callbackUrl?: string }>
}

function resolveCallbackUrl(rawValue: string | undefined) {
    if (!rawValue) {
        return "/applicants"
    }

    if (!rawValue.startsWith("/")) {
        return "/applicants"
    }

    return rawValue
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
    const session = await auth()
    const params = await searchParams
    const callbackUrl = resolveCallbackUrl(params.callbackUrl)

    if (session?.user) {
        redirect(callbackUrl)
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#0a0e1a] bg-[radial-gradient(ellipse_at_center,_#1a1f3a_0%,_#0a0e1a_70%)]">
            <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl px-8 py-10 space-y-8 transition-all duration-300 hover:border-white/[0.12] hover:bg-white/[0.06]" style={{ boxShadow: "0 8px 40px -8px rgba(0,0,0,0.5), 0 0 80px -20px rgba(59,130,246,0.15)" }}>
                <div className="space-y-2 text-center">
                    <div className="w-12 h-12 rounded-xl bg-primary/90 flex items-center justify-center mx-auto mb-4" style={{ boxShadow: "0 2px 12px rgba(59,130,246,0.3)" }}>
                        <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight text-white">RPO System</h1>
                    <p className="text-[13px] text-white/50">Googleアカウントでログインしてください</p>
                </div>
                <GoogleSignInButton callbackUrl={callbackUrl} />
            </div>
        </div>
    )
}
