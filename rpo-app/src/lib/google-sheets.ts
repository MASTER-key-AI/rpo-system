import { getAccessToken } from "@/lib/google-auth"

const TEMPLATE_SPREADSHEET_ID = "1-ixh_LBlJJnD8iwntYZb2hMciA1HwIpvmSM5U037sWk"
const SHARED_DRIVE_ID = "0ALFUlmB8FFeCUk9PVA"

type CopyResult = {
    spreadsheetId: string
    gid: number
    sheetName: string | null
    spreadsheetUrl: string
}

export async function copyTemplateSpreadsheet(companyName: string): Promise<CopyResult> {
    const token = await getAccessToken()
    const title = `【RPO】${companyName}_候補者管理`

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

    const copyData = await copyResponse.json() as { id: string }
    const spreadsheetId = copyData.id

    // 2. Get first sheet's GID via Sheets API
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

    const sheetsData = await sheetsResponse.json() as {
        sheets: Array<{ properties: { sheetId: number; title: string } }>
    }

    const targetSheet = sheetsData.sheets.find(s => s.properties.sheetId === 2)?.properties
        ?? sheetsData.sheets[0]?.properties
    const gid = targetSheet?.sheetId ?? 2
    const sheetName = targetSheet?.title ?? null

    return {
        spreadsheetId,
        gid,
        sheetName,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}`,
    }
}
