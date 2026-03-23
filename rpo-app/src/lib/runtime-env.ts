type RuntimeEnvRecord = Record<string, string | undefined>

export function getRuntimeEnv(name: string): string | undefined {
    const processEnv = readFromProcess(name)
    if (processEnv !== undefined) return processEnv

    const cloudflareEnv = readFromCloudflareContext(name)
    if (cloudflareEnv !== undefined) return cloudflareEnv

    const globalEnv = readFromGlobalContext(name)
    if (globalEnv !== undefined) return globalEnv

    return undefined
}

function readFromProcess(name: string): string | undefined {
    if (typeof process === "undefined") return undefined
    const value = process.env?.[name]
    if (!value) return undefined
    return value.trim()
}

function readFromCloudflareContext(name: string): string | undefined {
    // @ts-expect-error - Runtime context is environment-specific and not strongly typed across adapters.
    const context = globalThis.__opennext__?.env

    if (!context || typeof context !== "object") return undefined

    const record = context as unknown as RuntimeEnvRecord
    const value = record[name]

    if (!value) return undefined
    return value.trim()
}

function readFromGlobalContext(name: string): string | undefined {
    const context = (globalThis as { [key: string]: unknown })[name]
    if (typeof context === "string" && context.trim()) {
        return context.trim()
    }

    const maybeObj = (globalThis as { env?: Record<string, unknown> }).env
    if (!maybeObj || typeof maybeObj !== "object") return undefined

    const value = (maybeObj as Record<string, string | undefined>)[name]
    if (!value) return undefined
    return value.trim()
}
