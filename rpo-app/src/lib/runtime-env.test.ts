import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Don't use the global mock for this test — we test the real implementation
vi.unmock("@/lib/runtime-env")

describe("getRuntimeEnv", () => {
    let getRuntimeEnv: typeof import("@/lib/runtime-env").getRuntimeEnv

    beforeEach(async () => {
        vi.resetModules()
        const mod = await import("@/lib/runtime-env")
        getRuntimeEnv = mod.getRuntimeEnv
    })

    afterEach(() => {
        delete process.env.TEST_ENV_VAR
        // @ts-expect-error - cleaning up test global
        delete globalThis.__opennext__
    })

    it("returns value from process.env", () => {
        process.env.TEST_ENV_VAR = "from-process"
        expect(getRuntimeEnv("TEST_ENV_VAR")).toBe("from-process")
    })

    it("trims whitespace from process.env value", () => {
        process.env.TEST_ENV_VAR = "  trimmed  "
        expect(getRuntimeEnv("TEST_ENV_VAR")).toBe("trimmed")
    })

    it("returns undefined when not set anywhere", () => {
        expect(getRuntimeEnv("NONEXISTENT_VAR_XYZ")).toBeUndefined()
    })

    it("falls through to Cloudflare context when process.env not set", () => {
        // @ts-expect-error - simulating Cloudflare runtime
        globalThis.__opennext__ = { env: { TEST_ENV_VAR: "from-cloudflare" } }
        expect(getRuntimeEnv("TEST_ENV_VAR")).toBe("from-cloudflare")
    })

    it("process.env takes priority over Cloudflare context", () => {
        process.env.TEST_ENV_VAR = "from-process"
        // @ts-expect-error - simulating Cloudflare runtime
        globalThis.__opennext__ = { env: { TEST_ENV_VAR: "from-cloudflare" } }
        expect(getRuntimeEnv("TEST_ENV_VAR")).toBe("from-process")
    })
})
