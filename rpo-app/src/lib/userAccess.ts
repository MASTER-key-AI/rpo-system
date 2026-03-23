import { getRuntimeEnv } from "@/lib/runtime-env"

type AccessRule = {
    allowedLogins: string[]
    adminUsers: string[]
}

function splitEmails(rawValue: string | undefined): string[] {
    if (!rawValue) {
        return []
    }

    return rawValue
        .replace(/\r/g, "")
        .replace(/\n/g, ",")
        .split(",")
        .map((value) => value.trim().toLowerCase().replace(/^["']|["']$/g, ""))
        .filter(Boolean)
        .filter((value, index, values) => values.indexOf(value) === index)
}

function readRule(): AccessRule {
    return {
        allowedLogins: splitEmails(getRuntimeEnv("LOGIN_ALLOWED_EMAILS")),
        adminUsers: splitEmails(getRuntimeEnv("ADMIN_EMAILS")),
    }
}

function normalizeEmail(value: string | null | undefined) {
    if (!value) return null
    return value.trim().toLowerCase()
}

export function isLoginAllowed(email: string | null | undefined) {
    const normalized = normalizeEmail(email)
    if (!normalized) {
        return false
    }

    const { allowedLogins, adminUsers } = readRule()
    if (adminUsers.length > 0) {
        return adminUsers.includes(normalized)
    }

    if (allowedLogins.length === 0) {
        return true
    }

    return allowedLogins.includes(normalized)
}

export function isAdminUser(email: string | null | undefined) {
    const normalized = normalizeEmail(email)
    if (!normalized) {
        return false
    }

    const { adminUsers, allowedLogins } = readRule()
    if (adminUsers.length > 0) {
        return adminUsers.includes(normalized)
    }

    if (allowedLogins.length > 0) {
        return allowedLogins.includes(normalized)
    }

    return true
}

export function getAllowedLoginList() {
    return readRule().allowedLogins
}

export function getAdminUsers() {
    return readRule().adminUsers
}
