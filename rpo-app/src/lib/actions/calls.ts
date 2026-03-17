"use server";

import { db, schema } from "@/db";
import { and, desc, eq } from "drizzle-orm";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const ANALYTICS_SLOT_HOURS = 2;
const ANALYTICS_SAMPLE_THRESHOLD = 5;

export type CallLog = {
    id: string;
    calledAt: string | number | Date | null;
    applicantId: string;
    applicantName: string;
    companyId: string | null;
    companyName: string;
    callerId: string;
    callerName: string;
    callCount: number;
    isConnected: boolean | null;
    note: string | null;
};

export type CallHeatCell = {
    weekday: number;
    weekdayLabel: string;
    slotStart: number;
    slotEnd: number;
    total: number;
    connected: number;
    rate: number;
};

export type CallHeatmapAnalytics = {
    slotHours: number;
    slots: number[];
    totalCalls: number;
    connectedCalls: number;
    overallRate: number;
    sampleThreshold: number;
    rows: Array<{
        weekday: number;
        weekdayLabel: string;
        totals: number[];
        connected: number[];
        rates: number[];
    }>;
    top: CallHeatCell[];
    bottom: CallHeatCell[];
};

function coerceCalledAtToTimestamp(calledAt: string | number | Date | null): number | null {
    if (calledAt == null) return null;
    const date = calledAt instanceof Date ? calledAt : new Date(calledAt);
    const timestamp = date.getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
}

export async function buildCallConnectionHeatmap(logs: CallLog[], slotHours: number = ANALYTICS_SLOT_HOURS): Promise<CallHeatmapAnalytics> {
    const safeSlotHours = Math.max(1, Math.min(24, Math.floor(slotHours)));
    const viewStartHour = 8;
    const viewEndHour = 20;
    const viewHours = Math.max(1, viewEndHour - viewStartHour);
    const effectiveSlotHours = Math.min(safeSlotHours, viewHours);
    const slotCount = Math.ceil(viewHours / effectiveSlotHours);
    const slots = Array.from({ length: slotCount }, (_, index) => index * effectiveSlotHours + viewStartHour);
    const totals: number[][] = Array.from({ length: WEEKDAY_LABELS.length }, () => Array(slotCount).fill(0));
    const connected: number[][] = Array.from({ length: WEEKDAY_LABELS.length }, () => Array(slotCount).fill(0));

    let connectedCalls = 0;
    for (const log of logs) {
        const calledAtMs = coerceCalledAtToTimestamp(log.calledAt);
        if (calledAtMs === null) continue;

        const calledAtDate = new Date(calledAtMs);
        const weekday = calledAtDate.getDay();
        const hour = calledAtDate.getHours();
        if (hour < viewStartHour || hour >= viewEndHour) {
            continue;
        }

        const slotIndex = Math.min(Math.floor((hour - viewStartHour) / effectiveSlotHours), slotCount - 1);

        totals[weekday][slotIndex]++;
        if (log.isConnected) {
            connected[weekday][slotIndex]++;
            connectedCalls++;
        }
    }

    const rows = WEEKDAY_LABELS.map((weekdayLabel, weekday) => {
        const rowTotals = totals[weekday];
        const rowConnected = connected[weekday];
        const rates = rowTotals.map((count, index) => (count === 0 ? 0 : rowConnected[index] / count));

        return {
            weekday,
            weekdayLabel,
            totals: rowTotals,
            connected: rowConnected,
            rates,
        };
    });

    const allCells: CallHeatCell[] = rows.flatMap((row) =>
        row.totals.map((total, index) => {
            const slotStart = slots[index];
            const slotEnd = Math.min(slotStart + effectiveSlotHours, viewEndHour);
            const connectedCount = row.connected[index];
            return {
                weekday: row.weekday,
                weekdayLabel: row.weekdayLabel,
                slotStart,
                slotEnd,
                total,
                connected: connectedCount,
                rate: total === 0 ? 0 : connectedCount / total,
            };
        }),
    );

    const sampleEligibleCells = allCells.filter((cell) => cell.total >= ANALYTICS_SAMPLE_THRESHOLD);
    const top = sampleEligibleCells
        .slice()
        .sort((a, b) => b.rate - a.rate || b.total - a.total)
        .slice(0, 5);

    const bottom = sampleEligibleCells
        .slice()
        .sort((a, b) => a.rate - b.rate || b.total - a.total)
        .slice(0, 5);

    return {
        slotHours: effectiveSlotHours,
        slots,
        totalCalls: logs.length,
        connectedCalls,
        overallRate: logs.length === 0 ? 0 : connectedCalls / logs.length,
        sampleThreshold: ANALYTICS_SAMPLE_THRESHOLD,
        rows,
        top,
        bottom,
    };
}

export async function getCallLogs(filterCompanyId?: string, filterCallerId?: string) {
    const whereClauses = []
    if (filterCompanyId) {
        whereClauses.push(eq(schema.companies.id, filterCompanyId))
    }
    if (filterCallerId) {
        whereClauses.push(eq(schema.callLogs.callerId, filterCallerId))
    }

    const query = db
        .select({
            id: schema.callLogs.id,
            calledAt: schema.callLogs.calledAt,
            applicantId: schema.callLogs.applicantId,
            applicantName: schema.applicants.name,
            companyId: schema.companies.id,
            companyName: schema.companies.name,
            callerId: schema.callLogs.callerId,
            callerName: schema.users.name,
            callCount: schema.callLogs.callCount,
            isConnected: schema.callLogs.isConnected,
            note: schema.callLogs.note,
        })
        .from(schema.callLogs)
        .leftJoin(schema.applicants, eq(schema.callLogs.applicantId, schema.applicants.id))
        .leftJoin(schema.companies, eq(schema.applicants.companyId, schema.companies.id))
        .leftJoin(schema.users, eq(schema.callLogs.callerId, schema.users.id));
    const logs = await (whereClauses.length === 0
        ? query.orderBy(desc(schema.callLogs.calledAt))
        : query.where(whereClauses.length === 1 ? whereClauses[0] : and(...whereClauses)).orderBy(desc(schema.callLogs.calledAt))
    ).all()

    return logs.map((log) => ({
        ...log,
        applicantName: log.applicantName || "Unknown",
        companyName: log.companyName || "Unknown",
        companyId: log.companyId || null,
        callerName: log.callerName || log.callerId,
    })) as CallLog[];
}

export async function getUsers() {
    return await db
        .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
        .from(schema.users)
        .all();
}
