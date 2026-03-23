export function normalizeCompanyName(value: string) {
    return value
        .normalize("NFKC")
        .replace(/[\s\u3000]+/g, " ")
        .trim()
}

export function normalizeCompanyNameForMatch(value: string): string {
    return value
        .normalize("NFKC")
        .toLowerCase()
        .replace(
            /医療法人\S*|社会福祉法人\S*|一般社団法人|一般財団法人|株式会社|有限会社|合同会社|合資会社|合名会社|（株）|\(株\)|㈱|（有）|\(有\)|㈲/g,
            "",
        )
        .replace(/[\s　]+/g, "")
        .replace(/[()（）［］[\]「」『』]/g, "")
        .replace(/[\/／]/g, "")
        .replace(/[・･]/g, "")
        .replace(/[ー―‐－-]/g, "")
}

export function isCompanyNameUniqueConstraintError(error: unknown) {
    if (!error) return false

    const message = error instanceof Error ? error.message : String(error)
    return message.includes("UNIQUE constraint failed: company.name")
}
