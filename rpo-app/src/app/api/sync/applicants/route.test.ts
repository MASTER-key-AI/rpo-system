import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, POST } from "./route"
import { db } from "@/db"
import { getRuntimeEnv } from "@/lib/runtime-env"
import {
    createPostRequest,
    createRequestWithoutApiKey,
    createRequestWithWrongApiKey,
} from "@/test/helpers/create-request"
import { TEST_API_KEY, TEST_APPLICANT_ROW, VALID_SYNC_PAYLOAD } from "@/test/helpers/fixtures"

const mockGetRuntimeEnv = vi.mocked(getRuntimeEnv)
const mockDb = db as unknown as {
    select: ReturnType<typeof vi.fn>
    _selectChain: {
        all: ReturnType<typeof vi.fn>
        get: ReturnType<typeof vi.fn>
        from: ReturnType<typeof vi.fn>
        where: ReturnType<typeof vi.fn>
        orderBy: ReturnType<typeof vi.fn>
        limit: ReturnType<typeof vi.fn>
    }
}

beforeEach(() => {
    mockGetRuntimeEnv.mockImplementation((name: string) => {
        if (name === "RPO_API_KEY" || name === "INBOUND_API_KEY") return TEST_API_KEY
        return undefined
    })
    // Default: companies list returns one company, applicants query returns empty
    mockDb._selectChain.all
        .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }]) // companies query
        .mockResolvedValue([]) // applicants query
})

describe("POST /api/sync/applicants", () => {
    describe("Authentication", () => {
        it("returns 500 when RPO_API_KEY is not configured", async () => {
            mockGetRuntimeEnv.mockReturnValue(undefined)
            const req = createPostRequest("/api/sync/applicants", VALID_SYNC_PAYLOAD)
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(500)
            expect(body.error).toContain("not configured")
        })

        it("returns 401 when no API key header provided", async () => {
            const req = createRequestWithoutApiKey("/api/sync/applicants", "POST", VALID_SYNC_PAYLOAD)
            const res = await POST(req)

            expect(res.status).toBe(401)
        })

        it("returns 401 when API key is incorrect", async () => {
            const req = createRequestWithWrongApiKey("/api/sync/applicants", "POST", VALID_SYNC_PAYLOAD)
            const res = await POST(req)

            expect(res.status).toBe(401)
        })

        it("succeeds with correct API key", async () => {
            const req = createPostRequest("/api/sync/applicants", VALID_SYNC_PAYLOAD)
            const res = await POST(req)

            expect(res.status).not.toBe(401)
        })
    })

    describe("Request Body Validation", () => {
        it("returns 400 for non-JSON body", async () => {
            const req = new (await import("next/server")).NextRequest("http://localhost/api/sync/applicants", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-rpo-api-key": TEST_API_KEY,
                },
                body: "not json",
            })
            const res = await POST(req)

            expect(res.status).toBe(400)
        })

        it("returns 400 for JSON array body", async () => {
            const req = createPostRequest("/api/sync/applicants", [1, 2, 3])
            const res = await POST(req)

            expect(res.status).toBe(400)
        })

        it("returns 400 when companyName is missing", async () => {
            const req = createPostRequest("/api/sync/applicants", { limit: 200 })
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error).toContain("company is required")
        })

        it("accepts name as companyName alias", async () => {
            const req = createPostRequest("/api/sync/applicants", { name: "TestCompany" })
            const res = await POST(req)

            expect(res.status).not.toBe(400)
        })

        it("accepts company as companyName alias", async () => {
            const req = createPostRequest("/api/sync/applicants", { company: "TestCompany" })
            const res = await POST(req)

            expect(res.status).not.toBe(400)
        })

        it("accepts company_name as companyName alias", async () => {
            const req = createPostRequest("/api/sync/applicants", { company_name: "TestCompany" })
            const res = await POST(req)

            expect(res.status).not.toBe(400)
        })

        it("accepts companyId without companyName", async () => {
            mockDb._selectChain.get.mockResolvedValueOnce({ id: "c1", name: "TestCompany" })
            mockDb._selectChain.all.mockResolvedValueOnce([])

            const req = createPostRequest("/api/sync/applicants", { companyId: "c1" })
            const res = await POST(req)

            expect(res.status).toBe(200)
        })
    })

    describe("Company Resolution", () => {
        it("returns 404 when no company matches", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all.mockResolvedValue([{ id: "c1", name: "OtherCompany" }])

            const req = createPostRequest("/api/sync/applicants", { companyName: "NonExistent" })
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(404)
            expect(body.error).toContain("Company not found")
        })

        it("returns 200 with exact name match", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }]) // companies
                .mockResolvedValue([]) // applicants

            const req = createPostRequest("/api/sync/applicants", { companyName: "TestCompany" })
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.data.resolutionStrategy).toBe("exact_name")
        })

        it("includes matchedCompanies in response", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }])
                .mockResolvedValue([])

            const req = createPostRequest("/api/sync/applicants", { companyName: "TestCompany" })
            const res = await POST(req)
            const body = await res.json()

            expect(body.data.matchedCompanies).toContain("TestCompany")
            expect(body.data.resolvedCompanies).toContain("TestCompany")
        })

        it("returns 404 when companyId does not exist", async () => {
            mockDb._selectChain.get.mockResolvedValueOnce(undefined)

            const req = createPostRequest("/api/sync/applicants", { companyId: "missing-company-id" })
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(404)
            expect(body.error).toContain("Company not found by id")
        })

        it("prioritizes companyId when both companyId and companyName are provided", async () => {
            mockDb._selectChain.get.mockResolvedValueOnce({ id: "c1", name: "Registered Company" })
            mockDb._selectChain.all.mockResolvedValueOnce([TEST_APPLICANT_ROW])

            const req = createPostRequest("/api/sync/applicants", {
                companyId: "c1",
                companyName: "Mismatched Name",
                limit: 10,
            })
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.data.resolutionStrategy).toBe("exact_id")
            expect(body.data.companyId).toBe("c1")
            expect(body.data.records.length).toBe(1)
        })
    })

    describe("Pagination", () => {
        it("returns empty records when no applicants found", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }])
                .mockResolvedValue([])

            const req = createPostRequest("/api/sync/applicants", VALID_SYNC_PAYLOAD)
            const res = await POST(req)
            const body = await res.json()

            expect(body.data.records).toEqual([])
            expect(body.data.nextCursor).toBe("")
        })

        it("returns nextCursor when results equal page size", async () => {
            const rows = Array.from({ length: 2 }, (_, i) => ({
                ...TEST_APPLICANT_ROW,
                id: `applicant-${i}`,
                updatedAt: new Date("2025-06-01T10:00:00Z"),
            }))

            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }])
                .mockResolvedValueOnce(rows)

            const req = createPostRequest("/api/sync/applicants", { ...VALID_SYNC_PAYLOAD, limit: 2 })
            const res = await POST(req)
            const body = await res.json()

            expect(body.data.nextCursor).not.toBe("")
        })

        it("returns empty nextCursor when results are fewer than page size", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }])
                .mockResolvedValueOnce([{ ...TEST_APPLICANT_ROW, id: "a1" }])

            const req = createPostRequest("/api/sync/applicants", { ...VALID_SYNC_PAYLOAD, limit: 10 })
            const res = await POST(req)
            const body = await res.json()

            expect(body.data.nextCursor).toBe("")
        })
    })

    describe("Response Format", () => {
        it("maps applicant records correctly", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }])
                .mockResolvedValueOnce([TEST_APPLICANT_ROW])

            const req = createPostRequest("/api/sync/applicants", { ...VALID_SYNC_PAYLOAD, limit: 10 })
            const res = await POST(req)
            const body = await res.json()

            const record = body.data.records[0]
            expect(record.applicantId).toBe("applicant-uuid-1")
            expect(record.applicant_id).toBe("applicant-uuid-1")
            expect(record.id).toBe("applicant-uuid-1")
            expect(record.name).toBe("山田太郎")
            expect(record.email).toBe("yamada@example.com")
            expect(record.furigana).toBe("やまだたろう")
            expect(record.phone).toBe("090-1234-5678")
            expect(record.address).toBe("大阪府大阪市中央区1-2-3")
            expect(record.gender).toBe("男性")
        })

        it("maps boolean flags to 0/1", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }])
                .mockResolvedValueOnce([TEST_APPLICANT_ROW])

            const req = createPostRequest("/api/sync/applicants", { ...VALID_SYNC_PAYLOAD, limit: 10 })
            const res = await POST(req)
            const body = await res.json()

            const record = body.data.records[0]
            expect(record.validApply).toBe(1)     // isValidApplicant: true
            expect(record.absent).toBe(0)          // all no-shows false
            expect(record.connected).toBe(1)       // connectedAt is set
            expect(record.interviewSet).toBe(1)    // primaryScheduled: true
            expect(record.seated).toBe(1)          // primaryConducted: true
            expect(record.rejected).toBe(0)        // all rejection flags false
            expect(record.offer).toBe(0)           // offered: false
            expect(record.offerDeclined).toBe(0)
            expect(record.joined).toBe(0)
            expect(record.left).toBe(0)            // always 0
        })

        it("formats birthDate as YYYY-MM-DD", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }])
                .mockResolvedValueOnce([TEST_APPLICANT_ROW])

            const req = createPostRequest("/api/sync/applicants", { ...VALID_SYNC_PAYLOAD, limit: 10 })
            const res = await POST(req)
            const body = await res.json()

            expect(body.data.records[0].birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })

        it("formats updatedAt as ISO string", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }])
                .mockResolvedValueOnce([TEST_APPLICANT_ROW])

            const req = createPostRequest("/api/sync/applicants", { ...VALID_SYNC_PAYLOAD, limit: 10 })
            const res = await POST(req)
            const body = await res.json()

            expect(body.data.records[0].updatedAt).toContain("T")
            expect(body.data.records[0].updatedAt).toContain("Z")
        })
    })

    describe("Date Filtering", () => {
        it("accepts ISO string updatedAfter", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }])
                .mockResolvedValue([])

            const payload = { ...VALID_SYNC_PAYLOAD, updatedAfter: "2025-01-01T00:00:00Z" }
            const req = createPostRequest("/api/sync/applicants", payload)
            const res = await POST(req)

            expect(res.status).toBe(200)
        })

        it("accepts updated_after alias", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all
                .mockResolvedValueOnce([{ id: "c1", name: "TestCompany" }])
                .mockResolvedValue([])

            const payload = { companyName: "TestCompany", updated_after: "2025-01-01T00:00:00Z" }
            const req = createPostRequest("/api/sync/applicants", payload)
            const res = await POST(req)

            expect(res.status).toBe(200)
        })
    })

    describe("Error Handling", () => {
        it("returns 500 on internal error", async () => {
            mockDb._selectChain.all.mockReset()
            mockDb._selectChain.all.mockRejectedValue(new Error("DB crash"))

            const req = createPostRequest("/api/sync/applicants", VALID_SYNC_PAYLOAD)
            const res = await POST(req)

            expect(res.status).toBe(500)
        })
    })
})

describe("GET /api/sync/applicants", () => {
    it("returns 405 Method Not Allowed", async () => {
        const res = await GET()

        expect(res.status).toBe(405)
    })
})
