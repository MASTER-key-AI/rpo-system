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
        leftJoin: ReturnType<typeof vi.fn>
        where: ReturnType<typeof vi.fn>
    }
}

beforeEach(() => {
    mockGetRuntimeEnv.mockImplementation((name: string) => {
        if (name === "RPO_API_KEY" || name === "INBOUND_API_KEY") return TEST_API_KEY
        return undefined
    })
})

describe("GET /api/sync/company-sheets", () => {
    describe("Authentication", () => {
        it("returns 500 when RPO_API_KEY is not configured", async () => {
            mockGetRuntimeEnv.mockReturnValue(undefined)
            const req = createGetRequest("/api/sync/company-sheets")
            const res = await GET(req)
            const body = await res.json()

            expect(res.status).toBe(500)
            expect(body.success).toBe(false)
            expect(body.error).toContain("not configured")
        })

        it("returns 401 when no API key header provided", async () => {
            const req = createRequestWithoutApiKey("/api/sync/company-sheets", "GET")
            const res = await GET(req)

            expect(res.status).toBe(401)
        })

        it("returns 401 when API key is incorrect", async () => {
            const req = createRequestWithWrongApiKey("/api/sync/company-sheets", "GET")
            const res = await GET(req)

            expect(res.status).toBe(401)
        })

        it("succeeds with correct API key", async () => {
            mockDb._selectChain.all.mockResolvedValue([])
            const req = createGetRequest("/api/sync/company-sheets")
            const res = await GET(req)

            expect(res.status).toBe(200)
        })
    })

    describe("Response Format", () => {
        it("returns sheets list with success: true", async () => {
            const sheets = [
                { id: "s1", companyId: "c1", companyName: "CompanyA", spreadsheetId: "abc123", gid: 0, sheetName: "Sheet1", enabled: true },
                { id: "s2", companyId: "c2", companyName: "CompanyB", spreadsheetId: "def456", gid: 1, sheetName: null, enabled: true },
            ]
            mockDb._selectChain.all.mockResolvedValue(sheets)

            const req = createGetRequest("/api/sync/company-sheets")
            const res = await GET(req)
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.success).toBe(true)
            expect(body.data.sheets).toHaveLength(2)
            expect(body.data.total).toBe(2)
        })

        it("returns empty array when no sheets exist", async () => {
            mockDb._selectChain.all.mockResolvedValue([])

            const req = createGetRequest("/api/sync/company-sheets")
            const res = await GET(req)
            const body = await res.json()

            expect(body.data.sheets).toEqual([])
            expect(body.data.total).toBe(0)
        })

        it("sorts sheets by company name in Japanese locale", async () => {
            const sheets = [
                { id: "s2", companyId: "c2", companyName: "株式会社B", spreadsheetId: "def456", gid: 0, sheetName: null, enabled: true },
                { id: "s1", companyId: "c1", companyName: "株式会社A", spreadsheetId: "abc123", gid: 0, sheetName: null, enabled: true },
            ]
            mockDb._selectChain.all.mockResolvedValue(sheets)

            const req = createGetRequest("/api/sync/company-sheets")
            const res = await GET(req)
            const body = await res.json()

            expect(body.data.sheets[0].companyName).toBe("株式会社A")
            expect(body.data.sheets[1].companyName).toBe("株式会社B")
        })

        it("includes spreadsheetId and gid in response", async () => {
            const sheets = [
                { id: "s1", companyId: "c1", companyName: "TestCo", spreadsheetId: "abc123", gid: 42, sheetName: "応募者一覧", enabled: true },
            ]
            mockDb._selectChain.all.mockResolvedValue(sheets)

            const req = createGetRequest("/api/sync/company-sheets")
            const res = await GET(req)
            const body = await res.json()

            expect(body.data.sheets[0].spreadsheetId).toBe("abc123")
            expect(body.data.sheets[0].gid).toBe(42)
            expect(body.data.sheets[0].sheetName).toBe("応募者一覧")
        })
    })

    describe("Error Handling", () => {
        it("returns 500 when database error occurs", async () => {
            mockDb._selectChain.all.mockRejectedValue(new Error("DB connection failed"))

            const req = createGetRequest("/api/sync/company-sheets")
            const res = await GET(req)
            const body = await res.json()

            expect(res.status).toBe(500)
            expect(body.success).toBe(false)
        })
    })
})

describe("POST /api/sync/company-sheets", () => {
    it("returns 405 Method Not Allowed", async () => {
        const res = await POST()
        const body = await res.json()

        expect(res.status).toBe(405)
        expect(body.error).toContain("Method Not Allowed")
    })
})
