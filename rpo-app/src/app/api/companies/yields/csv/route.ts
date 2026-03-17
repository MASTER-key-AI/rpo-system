import { auth } from "@/auth"
import { getCompanyYields } from "@/lib/actions/yields"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

type DateType = "applied" | "event"

const CSV_COLUMNS: Array<{ key: keyof Awaited<ReturnType<typeof getCompanyYields>>[number]; label: string }> = [
    { key: "companyName", label: "企業名" },
    { key: "totalApplicants", label: "応募数" },
    { key: "uniqueApplicants", label: "ユニーク応募数" },
    { key: "validApplicants", label: "有効応募数" },
    { key: "notConnectedCount", label: "不通数" },
    { key: "connectedApplicantCount", label: "通電数" },
    { key: "docDeclined", label: "書類選考中辞退" },
    { key: "docRejectedMK", label: "書類不採用(MK判断)" },
    { key: "docRejectedClient", label: "書類不採用(クライアント)" },
    { key: "docRejected", label: "書類不採用" },
    { key: "schedulingInterview", label: "企業面接日程調整中" },
    { key: "interviewDeclinedBefore", label: "面接前辞退" },
    { key: "interviewScheduledCount", label: "面接設定数" },
    { key: "interviewNoShowCount", label: "面接飛び数" },
    { key: "interviewPlannedCount", label: "面接予定数" },
    { key: "interviewConductedCount", label: "面接実施数" },
    { key: "interviewDeclinedAfterCount", label: "面接後辞退数" },
    { key: "interviewRejectedCount", label: "面接不採用数" },
    { key: "priScheduled", label: "1次予定" },
    { key: "priConducted", label: "1次実施" },
    { key: "priNoShow", label: "1次飛び" },
    { key: "primaryDeclinedAfter", label: "1次後辞退" },
    { key: "primaryRejected", label: "1次不採用" },
    { key: "secScheduled", label: "2次予定" },
    { key: "secConducted", label: "2次実施" },
    { key: "secDeclinedBefore", label: "2次前辞退" },
    { key: "secNoShow", label: "2次飛び" },
    { key: "secDeclinedAfter", label: "2次後辞退" },
    { key: "secRejected", label: "2次不採用" },
    { key: "finalScheduled", label: "最終予定" },
    { key: "finalDeclinedBefore", label: "最終前辞退" },
    { key: "finalNoShow", label: "最終飛び" },
    { key: "finalConducted", label: "最終実施" },
    { key: "finalDeclinedAfter", label: "最終後辞退" },
    { key: "finalRejected", label: "最終不採用" },
    { key: "offered", label: "内定" },
    { key: "offerDeclined", label: "内定後辞退" },
    { key: "joined", label: "入社" },
    { key: "connectedApplicantRate", label: "有効応募からの通電率" },
    { key: "interviewScheduledRate", label: "有効応募からの面接設定率" },
    { key: "interviewConductedRate", label: "有効応募からの着席率" },
    { key: "offerRate", label: "有効応募からの内定率" },
    { key: "joinRate", label: "有効応募からの入社率" },
    { key: "preInterviewDeclineRate", label: "面接前辞退率" },
    { key: "offerDeclineRate", label: "内定後辞退率" },
    { key: "validApplicantRate", label: "有効応募率" },
]

export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = request.nextUrl
    const year = parseYear(searchParams.get("year"))
    const month = parseMonth(searchParams.get("month"))
    const companyId = searchParams.get("companyId")?.trim() || undefined
    const dateType = parseDateType(searchParams.get("dateType"))
    const rows = await getCompanyYields(year, month, dateType, { companyId })

    const header = CSV_COLUMNS.map((column) => escapeCsv(column.label)).join(",")
    const body = rows
        .map((row) => CSV_COLUMNS.map((column) => escapeCsv(String(row[column.key] ?? ""))).join(","))
        .join("\n")
    const csv = `\uFEFF${header}\n${body}\n`

    const filename = buildFilename(year, month)

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

function parseDateType(raw: string | null): DateType {
    return raw === "event" ? "event" : "applied"
}

function escapeCsv(value: string) {
    if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
        return `"${value.replaceAll("\"", "\"\"")}"`
    }
    return value
}

function buildFilename(year?: number, month?: number) {
    const yyyy = year ? String(year) : "all"
    const mm = month ? String(month).padStart(2, "0") : "all"
    return `company-yields_${yyyy}-${mm}.csv`
}
