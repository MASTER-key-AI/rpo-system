import { NextResponse } from "next/server"
import { auth } from "@/auth"

export default auth((req) => {
    if (req.auth?.user) {
        return
    }

    const callbackPath = `${req.nextUrl.pathname}${req.nextUrl.search}`
    const loginUrl = new URL("/login", req.nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", callbackPath)
    return NextResponse.redirect(loginUrl)
})

export const config = {
    matcher: ["/applicants/:path*", "/companies/:path*", "/calls/:path*", "/analysis", "/analysis/:path*"],
}
