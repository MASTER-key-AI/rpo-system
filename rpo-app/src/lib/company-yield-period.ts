export const COMPANY_YIELD_PERIOD_OPTIONS = [
    { value: "all", label: "年/月で指定" },
    { value: "thisMonth", label: "当月" },
    { value: "last3Months", label: "直近3ヶ月" },
    { value: "last6Months", label: "直近6ヶ月" },
    { value: "thisYear", label: "今年" },
] as const

export type CompanyYieldPeriod = (typeof COMPANY_YIELD_PERIOD_OPTIONS)[number]["value"]

export function parseCompanyYieldPeriod(raw?: string | null): CompanyYieldPeriod {
    return COMPANY_YIELD_PERIOD_OPTIONS.some((option) => option.value === raw)
        ? (raw as CompanyYieldPeriod)
        : "all"
}

type CompanyYieldPeriodRange = {
    startAt?: number
    endAt?: number
}

function toUnixSeconds(year: number, month: number) {
    return Math.floor(Date.UTC(year, month, 1, 0, 0, 0) / 1000)
}

export function getCompanyYieldPeriodRange(period: CompanyYieldPeriod, now = new Date()): CompanyYieldPeriodRange {
    const currentYear = now.getUTCFullYear()
    const currentMonth = now.getUTCMonth()

    if (period === "thisMonth") {
        return {
            startAt: toUnixSeconds(currentYear, currentMonth),
            endAt: toUnixSeconds(currentYear, currentMonth + 1),
        }
    }

    if (period === "last3Months") {
        return {
            startAt: toUnixSeconds(currentYear, currentMonth - 2),
            endAt: toUnixSeconds(currentYear, currentMonth + 1),
        }
    }

    if (period === "last6Months") {
        return {
            startAt: toUnixSeconds(currentYear, currentMonth - 5),
            endAt: toUnixSeconds(currentYear, currentMonth + 1),
        }
    }

    if (period === "thisYear") {
        return {
            startAt: toUnixSeconds(currentYear, 0),
            endAt: toUnixSeconds(currentYear + 1, 0),
        }
    }

    return {}
}

type ParsedDate = {
    year: number
    month: number
    day: number
}

type CompanyYieldCustomDateRange = {
    hasCustomRange: boolean
    startAt?: number
    endAt?: number
    startDate?: string
    endDate?: string
}

function parseIsoDate(raw?: string | null): ParsedDate | undefined {
    if (!raw) return undefined
    const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim())
    if (!matched) return undefined

    const year = Number.parseInt(matched[1], 10)
    const month = Number.parseInt(matched[2], 10)
    const day = Number.parseInt(matched[3], 10)
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined

    const test = new Date(Date.UTC(year, month - 1, day))
    if (
        test.getUTCFullYear() !== year ||
        test.getUTCMonth() !== month - 1 ||
        test.getUTCDate() !== day
    ) {
        return undefined
    }

    return { year, month, day }
}

function parsedDateToStartAt(value: ParsedDate) {
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day, 0, 0, 0) / 1000)
}

function parsedDateToEndAtExclusive(value: ParsedDate) {
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day + 1, 0, 0, 0) / 1000)
}

function formatParsedDate(value: ParsedDate) {
    return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`
}

export function getCompanyYieldCustomDateRange(startDateRaw?: string | null, endDateRaw?: string | null): CompanyYieldCustomDateRange {
    const parsedStart = parseIsoDate(startDateRaw)
    const parsedEnd = parseIsoDate(endDateRaw)

    if (!parsedStart && !parsedEnd) {
        return { hasCustomRange: false }
    }

    if (parsedStart && parsedEnd) {
        const startAt = parsedDateToStartAt(parsedStart)
        const endAt = parsedDateToEndAtExclusive(parsedEnd)
        if (startAt <= endAt) {
            return {
                hasCustomRange: true,
                startAt,
                endAt,
                startDate: formatParsedDate(parsedStart),
                endDate: formatParsedDate(parsedEnd),
            }
        }

        return {
            hasCustomRange: true,
            startAt: parsedDateToStartAt(parsedEnd),
            endAt: parsedDateToEndAtExclusive(parsedStart),
            startDate: formatParsedDate(parsedEnd),
            endDate: formatParsedDate(parsedStart),
        }
    }

    if (parsedStart) {
        return {
            hasCustomRange: true,
            startAt: parsedDateToStartAt(parsedStart),
            startDate: formatParsedDate(parsedStart),
        }
    }

    return {
        hasCustomRange: true,
        endAt: parsedDateToEndAtExclusive(parsedEnd as ParsedDate),
        endDate: formatParsedDate(parsedEnd as ParsedDate),
    }
}
