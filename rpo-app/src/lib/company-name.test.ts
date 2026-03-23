import { describe, it, expect } from "vitest"
import { normalizeCompanyName, normalizeCompanyNameForMatch, isCompanyNameUniqueConstraintError } from "./company-name"

describe("normalizeCompanyName", () => {
    it("trims whitespace", () => {
        expect(normalizeCompanyName("  TestCo  ")).toBe("TestCo")
    })

    it("preserves content", () => {
        expect(normalizeCompanyName("株式会社テスト")).toBe("株式会社テスト")
    })

    it("handles empty string", () => {
        expect(normalizeCompanyName("")).toBe("")
    })
})

describe("normalizeCompanyNameForMatch", () => {
    it("全角/半角が一致する", () => {
        expect(normalizeCompanyNameForMatch("ＯＧ建設株式会社"))
            .toBe(normalizeCompanyNameForMatch("OG建設株式会社"))
    })

    it("法人格の有無が一致する", () => {
        expect(normalizeCompanyNameForMatch("ミナミ住設"))
            .toBe(normalizeCompanyNameForMatch("株式会社ミナミ住設"))
    })

    it("法人格の位置が違っても一致する", () => {
        expect(normalizeCompanyNameForMatch("テスト株式会社"))
            .toBe(normalizeCompanyNameForMatch("株式会社テスト"))
    })

    it("カッコの全角/半角が一致する", () => {
        expect(normalizeCompanyNameForMatch("エム・ワイ・ジー(大阪ガスサービスショップ)"))
            .toBe(normalizeCompanyNameForMatch("エム・ワイ・ジー（大阪ガスサービスショップ）"))
    })

    it("医療法人を除去して一致する", () => {
        expect(normalizeCompanyNameForMatch("西新町二丁目クリニック"))
            .toBe(normalizeCompanyNameForMatch("医療法人彰美会 西新町二丁目クリニック"))
    })

    it("有限会社を除去する", () => {
        expect(normalizeCompanyNameForMatch("有限会社なかの"))
            .toBe(normalizeCompanyNameForMatch("なかの"))
    })

    it("㈱を除去する", () => {
        expect(normalizeCompanyNameForMatch("㈱テスト"))
            .toBe(normalizeCompanyNameForMatch("テスト"))
    })

    it("法人格のみの入力で空文字を返す", () => {
        expect(normalizeCompanyNameForMatch("㈱")).toBe("")
    })
})

describe("isCompanyNameUniqueConstraintError", () => {
    it("returns true for matching UNIQUE constraint error", () => {
        const error = new Error("UNIQUE constraint failed: company.name")
        expect(isCompanyNameUniqueConstraintError(error)).toBe(true)
    })

    it("returns true when message contains the constraint text", () => {
        const error = new Error("D1 error: UNIQUE constraint failed: company.name (code=SQLITE_CONSTRAINT)")
        expect(isCompanyNameUniqueConstraintError(error)).toBe(true)
    })

    it("returns false for unrelated error", () => {
        const error = new Error("Something else went wrong")
        expect(isCompanyNameUniqueConstraintError(error)).toBe(false)
    })

    it("returns false for null", () => {
        expect(isCompanyNameUniqueConstraintError(null)).toBe(false)
    })

    it("returns false for undefined", () => {
        expect(isCompanyNameUniqueConstraintError(undefined)).toBe(false)
    })

    it("handles string errors", () => {
        expect(isCompanyNameUniqueConstraintError("UNIQUE constraint failed: company.name")).toBe(true)
    })
})
