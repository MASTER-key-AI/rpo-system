import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, POST } from "./route"
import { db } from "@/db"
import { getRuntimeEnv } from "@/lib/runtime-env"
import { createGetRequest, createRequestWithoutApiKey, createRequestWithWrongApiKey } from "@/test/helpers/create-request"
import { TEST_API_KEY } from "@/test/helpers/fixtures"

const mockGetRuntimeEnv = vi.mocked(getRuntimeEnv)
const mockDb = db as unknown as {
    select: ReturnType<typeof vi.fn>
    _selectChain: {
        all: ReturnType<typeof vi.fn>
        get: ReturnType<typeof vi.fn>
        from: ReturnType<typeof vi.fn>
    }
}

beforeEach(() => {
    mockGetRuntimeEnv.mockImplementation((name: string) => {
        if (name === "RPO_API_KEY" || name === "INBOUND_API_KEY") return TEST_API_KEY
        return undefined
    })
})

describe("GET /api/sync/companies", () => {
    describe("Authentication", () => {
        it("returns 500 when RPO_API_KEY is not configured", async () => {
            mockGetRuntimeEnv.mockReturnValue(undefined)
            const req = createGetRequest("/api/sync/companies")
            const res = await GET(req)
            const body = await res.json()

            expect(res.status).toBe(500)
            expect(body.success).toBe(false)
            expect(body.error).toContain("not configured")
        })

        it("returns 401 when no API key header provided", async () => {
            const req = createRequestWithoutApiKey("/api/sync/companies", "GET")
            const res = await GET(req)

            expect(res.status).toBe(401)
        })

        it("returns 401 when API key is incorrect", async () => {
            const req = createRequestWithWrongApiKey("/api/sync/companies", "GET")
            const res = await GET(req)

            expect(res.status).toBe(401)
        })

        it("succeeds with correct API key", async () => {
            mockDb._selectChain.all.mockResolvedValue([])
            const req = createGetRequest("/api/sync/companies")
            const res = await GET(req)

            expect(res.status).toBe(200)
        })
    })

    describe("Response Format", () => {
        it("returns companies list with success: true", async () => {
            const companies = [
                { id: "c1", name: "CompanyA" },
                { id: "c2", name: "CompanyB" },
            ]
            mockDb._selectChain.all.mockResolvedValue(companies)

            const req = createGetRequest("/api/sync/companies")
            const res = await GET(req)
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.data.companies).toHaveLength(2)
            expect(body.data.total).toBe(2)
        })

        it("returns companies with only id and name fields", async () => {
            mockDb._selectChain.all.mockResolvedValue([{ id: "c1", name: "TestCo" }])

            const req = createGetRequest("/api/sync/companies")
            const res = await GET(req)
            const body = await res.json()

            expect(body.data.companies[0]).toEqual({ id: "c1", name: "TestCo" })
        })

        it("returns empty array when no companies exist", async () => {
            mockDb._selectChain.all.mockResolvedValue([])

            const req = createGetRequest("/api/sync/companies")
            const res = await GET(req)
            const body = await res.json()

            expect(body.data.companies).toEqual([])
            expect(body.data.total).toBe(0)
        })

        it("sorts companies by name in Japanese locale", async () => {
            const companies = [
                { id: "c2", name: "株式会社B" },
                { id: "c1", name: "株式会社A" },
            ]
            mockDb._selectChain.all.mockResolvedValue(companies)

            const req = createGetRequest("/api/sync/companies")
            const res = await GET(req)
            const body = await res.json()

            expect(body.data.companies[0].name).toBe("株式会社A")
            expect(body.data.companies[1].name).toBe("株式会社B")
        })
    })

    describe("Error Handling", () => {
        it("returns 500 when database error occurs", async () => {
            mockDb._selectChain.all.mockRejectedValue(new Error("DB connection failed"))

            const req = createGetRequest("/api/sync/companies")
            const res = await GET(req)
            const body = await res.json()

            expect(res.status).toBe(500)
            expect(body.success).toBe(false)
        })
    })
})

describe("POST /api/sync/companies", () => {
    it("returns 405 Method Not Allowed", async () => {
        const res = await POST()
        const body = await res.json()

        expect(res.status).toBe(405)
        expect(body.error).toContain("Method Not Allowed")
    })
})
