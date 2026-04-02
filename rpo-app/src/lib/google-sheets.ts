import { getAccessToken } from "@/lib/google-auth"

const TEMPLATE_SPREADSHEET_ID = "1-ixh_LBlJJnD8iwntYZb2hMciA1HwIpvmSM5U037sWk"
const SHARED_DRIVE_ID = "0ALFUlmB8FFeCUk9PVA"
const TARGET_SHEET_GID = 465742923
const TARGET_SHEET_TITLE = "応募者一覧"

type CopyResult = {
    spreadsheetId: string
    gid: number
    sheetName: string | null
    spreadsheetUrl: string
}

type SheetProperties = {
    sheetId: number
    title: string
}

async function renameSheetTitle(
    token: string,
    spreadsheetId: string,
    sheetId: number,
    title: string
): Promise<void> {
    const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                requests: [
                    {
                        updateSheetProperties: {
                            properties: {
                                sheetId,
                                title,
                            },
                            fields: "title",
                        },
                    },
                ],
            }),
        }
    )

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`Failed to rename sheet tab: ${response.status} ${text}`)
    }
}

export async function copyTemplateSpreadsheet(companyName: string): Promise<CopyResult> {
    const token = await getAccessToken()
    const title = `【RPO】${companyName}_応募者管理`

    // 1. Copy template via Drive API (to Shared Drive)
    const copyResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${TEMPLATE_SPREADSHEET_ID}/copy?supportsAllDrives=true`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ name: title, parents: [SHARED_DRIVE_ID] }),
        }
    )

    if (!copyResponse.ok) {
        const text = await copyResponse.text()
        throw new Error(`Failed to copy template spreadsheet: ${copyResponse.status} ${text}`)
    }

    const copyData = (await copyResponse.json()) as { id: string }
    const spreadsheetId = copyData.id

    // 2. Get target sheet's GID via Sheets API
    const sheetsResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
        {
            headers: { Authorization: `Bearer ${token}` },
        }
    )

    if (!sheetsResponse.ok) {
        const text = await sheetsResponse.text()
        throw new Error(`Failed to get sheet properties: ${sheetsResponse.status} ${text}`)
    }

    const sheetsData = (await sheetsResponse.json()) as {
        sheets: Array<{ properties: SheetProperties }>
    }

    const targetSheet =
        sheetsData.sheets.find((s) => s.properties.sheetId === TARGET_SHEET_GID)?.properties ??
        sheetsData.sheets[0]?.properties

    if (!targetSheet) {
        throw new Error("Failed to detect target sheet tab in copied spreadsheet")
    }

    const gid = targetSheet.sheetId

    // 3. Ensure the tab title is standardized.
    if (targetSheet.title !== TARGET_SHEET_TITLE) {
        await renameSheetTitle(token, spreadsheetId, gid, TARGET_SHEET_TITLE)
    }

    return {
        spreadsheetId,
        gid,
        sheetName: TARGET_SHEET_TITLE,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}`,
    }
}
