import { auth } from "@/auth"
import { getCompanyMonthlyTotals } from "@/lib/actions/yields"
import { getCompanyYieldCustomDateRange } from "@/lib/company-yield-period"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

type CompanyMonthlyTotalRow = Awaited<ReturnType<typeof getCompanyMonthlyTotals>>[number]

type CsvColumn = {
    key: keyof CompanyMonthlyTotalRow
    label: string
}

const CSV_COLUMNS: CsvColumn[] = [
    { key: "month", label: "月" },
    { key: "totalApplicants", label: "応募数" },
    { key: "uniqueApplicants", label: "ユニーク応募数" },
    { key: "validApplicants", label: "有効応募数" },
    { key: "validApplicantRate", label: "有効応募率" },
    { key: "connectedApplicantCount", label: "通電数" },
    { key: "notConnectedCount", label: "不通数" },
    { key: "phoneAppointmentCount", label: "電話予定数" },
    { key: "interviewScheduledCount", label: "面接設定数" },
    { key: "interviewConductedCount", label: "面接実施数" },
    { key: "offered", label: "内定数" },
    { key: "offerPendingCount", label: "内定承諾待ち" },
    { key: "joined", label: "入社数" },
    { key: "preInterviewDeclinedCount", label: "面接前辞退数" },
    { key: "offerDeclined", label: "内定後辞退数" },
    { key: "connectedApplicantRate", label: "有効応募からの通電率" },
    { key: "interviewScheduledRate", label: "有効応募からの面接設定率" },
    { key: "interviewConductedRate", label: "有効応募からの着席率" },
    { key: "offerRate", label: "有効応募からの内定率" },
    { key: "joinRate", label: "有効応募からの入社率" },
    { key: "preInterviewDeclineRate", label: "面接前辞退率" },
    { key: "offerDeclineRate", label: "内定後/入社前辞退率" },
]

export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const year = parseYear(searchParams.get("year"))
    const month = parseMonth(searchParams.get("month"))
    const week = parseWeek(searchParams.get("week"))
    const customDateRange = getCompanyYieldCustomDateRange(searchParams.get("startDate"), searchParams.get("endDate"))
    const rows = await getCompanyMonthlyTotals(year, {
        month,
        week,
        periodStartAt: customDateRange.startAt,
        periodEndAt: customDateRange.endAt,
    })
    const targetRows = rows

    const header = CSV_COLUMNS.map((column) => escapeCsv(column.label)).join(",")
    const body = targetRows.map((row) => CSV_COLUMNS.map((column) => escapeCsv(String(row[column.key] ?? ""))).join(",")).join("\n")
    const csv = `\uFEFF${header}\n${body}\n`
    const filename = buildFilename({
        year,
        month,
        week,
        startDate: customDateRange.startDate,
        endDate: customDateRange.endDate,
    })

    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
        },
    })
}

function parseYear(raw: string | null): number | undefined {
    if (!raw) return undefined
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) return undefined
    return parsed
}

function parseMonth(raw: string | null): number | undefined {
    if (!raw) return undefined
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) return undefined
    return parsed
}

function parseWeek(raw: string | null): number | undefined {
    if (!raw) return undefined
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return undefined
    return parsed
}

function sanitizeDateToken(raw?: string) {
    if (!raw) return "open"
    return raw.replaceAll("-", "")
}

function buildFilename({
    year,
    month,
    week,
    startDate,
    endDate,
}: {
    year?: number
    month?: number
    week?: number
    startDate?: string
    endDate?: string
}) {
    if (startDate || endDate) {
        return `company-monthly-yields_${sanitizeDateToken(startDate)}-${sanitizeDateToken(endDate)}.csv`
    }

    const yyyy = year ? String(year) : "all"
    const mm = month ? String(month).padStart(2, "0") : "all"
    const ww = week ? `-w${week}` : ""
    return `company-monthly-yields_${yyyy}-${mm}${ww}.csv`
}

function escapeCsv(value: string) {
    if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
        return `"${value.replaceAll("\"", "\"\"")}"`
    }
    return value
}
