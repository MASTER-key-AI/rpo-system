import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET, POST } from "./route"
import { db } from "@/db"
import { getRuntimeEnv } from "@/lib/runtime-env"
import {
    createPostRequest,
    createRequestWithoutApiKey,
    createRequestWithWrongApiKey,
} from "@/test/helpers/create-request"
import { TEST_API_KEY, VALID_INBOUND_PAYLOAD } from "@/test/helpers/fixtures"

const mockGetRuntimeEnv = vi.mocked(getRuntimeEnv)
const mockDb = db as unknown as {
    select: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    _selectChain: {
        all: ReturnType<typeof vi.fn>
        get: ReturnType<typeof vi.fn>
        from: ReturnType<typeof vi.fn>
        innerJoin: ReturnType<typeof vi.fn>
    }
    _insertChain: {
        values: ReturnType<typeof vi.fn>
        returning: ReturnType<typeof vi.fn>
    }
}

beforeEach(() => {
    mockGetRuntimeEnv.mockImplementation((name: string) => {
        if (name === "INBOUND_API_KEY") return TEST_API_KEY
        return undefined
    })
    // Default: no existing applicant, company insert succeeds
    mockDb._selectChain.get.mockResolvedValue(undefined)
    mockDb._insertChain.returning.mockResolvedValue([{ id: "new-company-id", name: "TestCompany" }])
})

describe("POST /api/inbound/indeed", () => {
    describe("Authentication", () => {
        it("returns 500 when INBOUND_API_KEY is not configured", async () => {
            mockGetRuntimeEnv.mockReturnValue(undefined)
            const req = createPostRequest("/api/inbound/indeed", VALID_INBOUND_PAYLOAD)
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(500)
            expect(body.error).toContain("INBOUND_API_KEY is not configured")
        })

        it("returns 401 when no API key header provided", async () => {
            const req = createRequestWithoutApiKey("/api/inbound/indeed", "POST", VALID_INBOUND_PAYLOAD)
            const res = await POST(req)

            expect(res.status).toBe(401)
        })

        it("returns 401 when API key is incorrect", async () => {
            const req = createRequestWithWrongApiKey("/api/inbound/indeed", "POST", VALID_INBOUND_PAYLOAD)
            const res = await POST(req)

            expect(res.status).toBe(401)
        })
    })

    describe("Request Body Validation", () => {
        it("returns 400 for non-JSON body", async () => {
            const req = new (await import("next/server")).NextRequest("http://localhost/api/inbound/indeed", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-rpo-api-key": TEST_API_KEY,
                },
                body: "not json",
            })
            const res = await POST(req)

            expect(res.status).toBe(400)
            const body = await res.json()
            expect(body.error).toContain("Invalid JSON")
        })

        it("returns 400 for JSON array body", async () => {
            const req = createPostRequest("/api/inbound/indeed", [1, 2, 3])
            const res = await POST(req)

            expect(res.status).toBe(400)
        })

        it("returns 400 when name is missing", async () => {
            const payload = { ...VALID_INBOUND_PAYLOAD, name: undefined }
            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error).toContain("name is required")
        })

        it("returns 400 when company is missing", async () => {
            const payload = { ...VALID_INBOUND_PAYLOAD, company: undefined }
            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error).toContain("company is required")
        })

        it("returns 400 when appliedAt is missing", async () => {
            const payload = { ...VALID_INBOUND_PAYLOAD, receivedAt: undefined }
            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(400)
            expect(body.error).toContain("appliedAt is required")
        })

        it("returns 400 when appliedAt is invalid date", async () => {
            const payload = { ...VALID_INBOUND_PAYLOAD, receivedAt: "not-a-date" }
            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)

            expect(res.status).toBe(400)
        })
    })

    describe("Field Aliases", () => {
        it("accepts companyName as company alias", async () => {
            const payload = {
                name: "山田",
                companyName: "TestCompany",
                receivedAt: "2025-06-01T10:00:00Z",
            }
            // Company lookup returns existing
            mockDb._selectChain.get.mockResolvedValue({ id: "c1", name: "TestCompany" })

            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)

            expect(res.status).toBe(201)
        })

        it("accepts applicantCompany as company alias", async () => {
            const payload = {
                name: "山田",
                applicantCompany: "TestCompany",
                receivedAt: "2025-06-01T10:00:00Z",
            }
            mockDb._selectChain.get.mockResolvedValue({ id: "c1", name: "TestCompany" })

            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)

            expect(res.status).toBe(201)
        })

        it("accepts position as job alias", async () => {
            const payload = {
                ...VALID_INBOUND_PAYLOAD,
                job: undefined,
                position: "営業職",
            }
            mockDb._selectChain.get
                .mockResolvedValueOnce(undefined) // dedup check
                .mockResolvedValueOnce({ id: "c1", name: "TestCompany" }) // company lookup

            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)

            expect(res.status).toBe(201)
        })

        it("accepts appliedAt as date alias", async () => {
            const payload = {
                name: "山田",
                company: "TestCompany",
                appliedAt: "2025-06-01T10:00:00Z",
            }
            mockDb._selectChain.get.mockResolvedValue({ id: "c1", name: "TestCompany" })

            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)

            expect(res.status).toBe(201)
        })
    })

    describe("Deduplication", () => {
        it("returns already_imported when messageId matches existing record", async () => {
            mockDb._selectChain.get.mockResolvedValueOnce({ id: "existing-id" })

            const req = createPostRequest("/api/inbound/indeed", VALID_INBOUND_PAYLOAD)
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(200)
            expect(body.status).toBe("already_imported")
            expect(body.applicantId).toBe("existing-id")
        })

        it("creates applicant when messageId has no match", async () => {
            // First get (dedup check) returns undefined, second get (company lookup) returns existing company
            mockDb._selectChain.get
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce({ id: "c1", name: "TestCompany" })

            const req = createPostRequest("/api/inbound/indeed", VALID_INBOUND_PAYLOAD)
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(201)
            expect(body.status).toBe("created")
        })

        it("skips dedup check when no messageId", async () => {
            const payload = { ...VALID_INBOUND_PAYLOAD, gmailMessageId: undefined }
            mockDb._selectChain.get.mockResolvedValue({ id: "c1", name: "TestCompany" })

            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)

            expect(res.status).toBe(201)
        })
    })

    describe("Successful Creation", () => {
        it("returns 201 with created status", async () => {
            mockDb._selectChain.get
                .mockResolvedValueOnce(undefined) // dedup check
                .mockResolvedValueOnce({ id: "c1", name: "TestCompany" }) // company lookup

            const req = createPostRequest("/api/inbound/indeed", VALID_INBOUND_PAYLOAD)
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(201)
            expect(body.success).toBe(true)
            expect(body.status).toBe("created")
            expect(body.applicantId).toBeTruthy()
            expect(body.companyId).toBe("c1")
            expect(body.companyName).toBe("TestCompany")
        })

        it("creates new company when not found", async () => {
            mockDb._selectChain.get
                .mockResolvedValueOnce(undefined) // dedup check
                .mockResolvedValueOnce(undefined) // Phase 1a: company.name exact match
                .mockResolvedValueOnce(undefined) // Phase 1b: alias exact match
            mockDb._selectChain.all.mockResolvedValueOnce([]) // Phase 2: all companies (empty)
            mockDb._insertChain.returning.mockResolvedValueOnce([{ id: "new-c", name: "NewCompany" }])

            const payload = { ...VALID_INBOUND_PAYLOAD, company: "NewCompany" }
            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)
            const body = await res.json()

            expect(res.status).toBe(201)
            expect(body.companyName).toBe("NewCompany")
        })
    })

    describe("Date Parsing", () => {
        beforeEach(() => {
            mockDb._selectChain.get.mockResolvedValue({ id: "c1", name: "TestCompany" })
        })

        it("parses ISO string date", async () => {
            const payload = {
                name: "山田",
                company: "TestCompany",
                receivedAt: "2025-06-01T10:00:00Z",
            }
            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)

            expect(res.status).toBe(201)
        })

        it("parses unix seconds", async () => {
            const payload = {
                name: "山田",
                company: "TestCompany",
                receivedAt: 1717236000,
            }
            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)

            expect(res.status).toBe(201)
        })

        it("parses unix milliseconds", async () => {
            const payload = {
                name: "山田",
                company: "TestCompany",
                receivedAt: 1717236000000,
            }
            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)

            expect(res.status).toBe(201)
        })

        it("returns 400 for invalid date string", async () => {
            const payload = {
                name: "山田",
                company: "TestCompany",
                receivedAt: "not-a-date",
            }
            const req = createPostRequest("/api/inbound/indeed", payload)
            const res = await POST(req)

            expect(res.status).toBe(400)
        })
    })

    describe("Error Handling", () => {
        it("returns 500 on internal error", async () => {
            mockDb._selectChain.get.mockRejectedValue(new Error("DB crash"))

            const req = createPostRequest("/api/inbound/indeed", VALID_INBOUND_PAYLOAD)
            const res = await POST(req)

            expect(res.status).toBe(500)
        })
    })
})

describe("GET /api/inbound/indeed", () => {
    it("returns 405 Method Not Allowed", async () => {
        const res = await GET()
        const body = await res.json()

        expect(res.status).toBe(405)
        expect(body.error).toContain("Method Not Allowed")
    })
})
