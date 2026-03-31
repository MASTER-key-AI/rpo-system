"use client"

import { useRef, useState, useTransition } from "react"
import { Download, Loader2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"

type ImportResult = {
    success: boolean
    created?: number
    updated?: number
    skipped?: number
    errors?: string[]
    error?: string
}

type Props = {
    exportHref: string
}

export default function ApplicantsCsvActions({ exportHref }: Props) {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement | null>(null)
    const [selectedFileName, setSelectedFileName] = useState("")
    const [isPending, startTransition] = useTransition()

    const handlePickFile = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0]
        setSelectedFileName(file?.name || "")
    }

    const handleImport = () => {
        const file = fileInputRef.current?.files?.[0]
        if (!file) {
            alert("CSVファイルを選択してください。")
            return
        }

        startTransition(async () => {
            try {
                const formData = new FormData()
                formData.set("file", file)

                const response = await fetch("/api/applicants/import", {
                    method: "POST",
                    body: formData,
                })
                const result = await response.json() as ImportResult

                if (!response.ok || !result.success) {
                    const message = result.error || "CSVインポートに失敗しました。"
                    alert(message)
                    return
                }

                const summary = `インポート完了\n新規: ${result.created ?? 0}\n更新: ${result.updated ?? 0}\nスキップ: ${result.skipped ?? 0}`
                const withErrors = result.errors && result.errors.length > 0
                    ? `${summary}\n\nエラー:\n${result.errors.slice(0, 10).join("\n")}`
                    : summary

                alert(withErrors)
                setSelectedFileName("")
                if (fileInputRef.current) {
                    fileInputRef.current.value = ""
                }
                router.refresh()
            } catch (error) {
                console.error(error)
                alert("CSVインポート中にエラーが発生しました。")
            }
        })
    }

    return (
        <div className="flex items-center gap-2">
            <a
                href={exportHref}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-input bg-background text-[13px] font-medium hover:bg-muted transition-colors duration-150 cursor-pointer"
            >
                <Download className="w-4 h-4" />
                CSVエクスポート
            </a>

            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
            />

            <button
                type="button"
                onClick={handlePickFile}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-input bg-background text-[13px] font-medium hover:bg-muted transition-colors duration-150 cursor-pointer"
            >
                <Upload className="w-4 h-4" />
                ファイル選択
            </button>

            <button
                type="button"
                onClick={handleImport}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 cursor-pointer"
            >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                CSVインポート
            </button>

            {selectedFileName ? (
                <span className="text-[12px] text-muted-foreground max-w-[220px] truncate" title={selectedFileName}>
                    {selectedFileName}
                </span>
            ) : null}
        </div>
    )
}
