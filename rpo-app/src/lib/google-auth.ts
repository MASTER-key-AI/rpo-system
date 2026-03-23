import { getRuntimeEnv } from "@/lib/runtime-env"

function getServiceAccountCredentials() {
    const email = getRuntimeEnv("GOOGLE_SA_EMAIL")
    const privateKey = getRuntimeEnv("GOOGLE_SA_PRIVATE_KEY")

    if (!email || !privateKey) {
        throw new Error("Google service account credentials not configured (GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY)")
    }

    return { email, privateKey: privateKey.replace(/\\n/g, "\n") }
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
    const base64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\s/g, "")

    const binary = atob(base64)
    const buffer = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i)
    }
    return buffer.buffer
}

function base64url(data: ArrayBuffer | Uint8Array | string): string {
    let base64: string
    if (typeof data === "string") {
        base64 = btoa(data)
    } else {
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
        let binary = ""
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i])
        }
        base64 = btoa(binary)
    }
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function createSignedJwt(email: string, privateKeyPem: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000)

    const header = { alg: "RS256", typ: "JWT" }
    const payload = {
        iss: email,
        scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
    }

    const encodedHeader = base64url(JSON.stringify(header))
    const encodedPayload = base64url(JSON.stringify(payload))
    const signingInput = `${encodedHeader}.${encodedPayload}`

    const keyData = pemToArrayBuffer(privateKeyPem)
    const cryptoKey = await crypto.subtle.importKey(
        "pkcs8",
        keyData,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["sign"]
    )

    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        cryptoKey,
        new TextEncoder().encode(signingInput)
    )

    return `${signingInput}.${base64url(signature)}`
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getAccessToken(): Promise<string> {
    if (cachedToken && Date.now() < cachedToken.expiresAt) {
        return cachedToken.token
    }

    const { email, privateKey } = getServiceAccountCredentials()
    const jwt = await createSignedJwt(email, privateKey)

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
        }),
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`Failed to get access token: ${response.status} ${text}`)
    }

    const data = await response.json() as { access_token: string; expires_in: number }

    cachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    }

    return data.access_token
}
