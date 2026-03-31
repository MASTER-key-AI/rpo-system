"use client";

import { useState, useTransition, useRef } from "react";
import { UserPlus, X, Loader2, ChevronDown, Building2, Calendar, User } from "lucide-react";
import { createApplicant } from "@/lib/actions/applicant";
import type { CreateApplicantInput } from "@/lib/actions/applicant";

type Company = { id: string; name: string };

type Props = {
    companies: Company[];
};

const GENDER_OPTIONS = ["", "男性", "女性", "その他・非公開"];

export default function NewApplicantModal({ companies }: Props) {
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [companySuggestions, setCompanySuggestions] = useState<Company[]>([]);
    const [companyInput, setCompanyInput] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const formRef = useRef<HTMLFormElement>(null);
    const suggestRef = useRef<HTMLDivElement>(null);

    const today = new Date().toISOString().slice(0, 10);

    function handleCompanyInputChange(value: string) {
        setCompanyInput(value);
        if (value.trim().length === 0) {
            setCompanySuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const q = value.trim().toLowerCase();
        const filtered = companies
            .filter((c) => c.name.toLowerCase().includes(q))
            .slice(0, 8);
        setCompanySuggestions(filtered);
        setShowSuggestions(filtered.length > 0);
    }

    function handleSelectCompany(name: string) {
        setCompanyInput(name);
        setShowSuggestions(false);
        setCompanySuggestions([]);
    }

    function handleOpen() {
        setOpen(true);
        setError(null);
        setSuccess(false);
        setCompanyInput("");
        setShowSuggestions(false);
    }

    function handleClose() {
        if (isPending) return;
        setOpen(false);
        setError(null);
        setSuccess(false);
        setCompanyInput("");
        setShowSuggestions(false);
        formRef.current?.reset();
    }

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const fd = new FormData(e.currentTarget);
        const input: CreateApplicantInput = {
            name: fd.get("name") as string,
            furigana: (fd.get("furigana") as string) || undefined,
            companyName: companyInput,
            appliedAt: fd.get("appliedAt") as string,
            caseName: (fd.get("caseName") as string) || undefined,
            appliedJob: (fd.get("appliedJob") as string) || undefined,
            appliedLocation: (fd.get("appliedLocation") as string) || undefined,
            email: (fd.get("email") as string) || undefined,
            phone: (fd.get("phone") as string) || undefined,
            gender: (fd.get("gender") as string) || undefined,
        };

        startTransition(async () => {
            try {
                await createApplicant(input);
                setSuccess(true);
                setTimeout(() => handleClose(), 1200);
            } catch (err) {
                setError(err instanceof Error ? err.message : "登録に失敗しました。");
            }
        });
    }

    return (
        <>
            {/* トリガーボタン */}
            <button
                id="btn-new-applicant"
                type="button"
                onClick={handleOpen}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors duration-150 shadow-sm"
            >
                <UserPlus className="w-3.5 h-3.5" />
                新規登録
            </button>

            {/* オーバーレイ */}
            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
                >
                    <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <UserPlus className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-[15px] font-semibold text-foreground">新規応募者登録</h2>
                                    <p className="text-[11px] text-muted-foreground">＊は必須項目です</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleClose}
                                disabled={isPending}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* フォーム */}
                        <form ref={formRef} onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

                            {/* 基本情報セクション */}
                            <div className="space-y-3">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5" />
                                    基本情報
                                </p>

                                {/* 氏名 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-medium text-foreground">
                                            氏名 <span className="text-destructive">＊</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="name"
                                            required
                                            placeholder="山田 太郎"
                                            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-medium text-foreground">フリガナ</label>
                                        <input
                                            type="text"
                                            name="furigana"
                                            placeholder="ヤマダ タロウ"
                                            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* 性別 */}
                                <div className="space-y-1">
                                    <label className="text-[12px] font-medium text-foreground">性別</label>
                                    <div className="relative">
                                        <select
                                            name="gender"
                                            className="w-full h-9 pl-3 pr-8 rounded-lg border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                        >
                                            {GENDER_OPTIONS.map((g) => (
                                                <option key={g} value={g}>{g || "選択なし"}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                    </div>
                                </div>
                            </div>

                            <hr className="border-border/60" />

                            {/* 会社・応募情報 */}
                            <div className="space-y-3">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5" />
                                    会社・応募情報
                                </p>

                                {/* 会社名（サジェスト付き） */}
                                <div className="space-y-1">
                                    <label className="text-[12px] font-medium text-foreground">
                                        会社名 <span className="text-destructive">＊</span>
                                    </label>
                                    <div className="relative" ref={suggestRef}>
                                        <input
                                            type="text"
                                            value={companyInput}
                                            onChange={(e) => handleCompanyInputChange(e.target.value)}
                                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                            onFocus={() => {
                                                if (companyInput.trim() && companySuggestions.length > 0) setShowSuggestions(true);
                                            }}
                                            placeholder="株式会社〇〇（既存企業は自動マッチ）"
                                            required
                                            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                        />
                                        {showSuggestions && companySuggestions.length > 0 && (
                                            <div className="absolute z-10 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                                                {companySuggestions.map((c) => (
                                                    <button
                                                        key={c.id}
                                                        type="button"
                                                        onMouseDown={() => handleSelectCompany(c.name)}
                                                        className="w-full text-left px-3 py-2 text-[13px] hover:bg-muted transition-colors"
                                                    >
                                                        {c.name}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">
                                        既存企業名を入力すると自動でマッチします。新企業名は自動作成されます。
                                    </p>
                                </div>

                                {/* 応募日 */}
                                <div className="space-y-1">
                                    <label className="text-[12px] font-medium text-foreground flex items-center gap-1">
                                        <Calendar className="w-3 h-3" />
                                        応募日 <span className="text-destructive">＊</span>
                                    </label>
                                    <input
                                        type="date"
                                        name="appliedAt"
                                        required
                                        defaultValue={today}
                                        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                    />
                                </div>

                                {/* 案件名・応募職種 */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-medium text-foreground">案件名</label>
                                        <input
                                            type="text"
                                            name="caseName"
                                            placeholder="営業職（東京）"
                                            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-medium text-foreground">応募職種名</label>
                                        <input
                                            type="text"
                                            name="appliedJob"
                                            placeholder="一般事務スタッフ"
                                            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* 勤務地 */}
                                <div className="space-y-1">
                                    <label className="text-[12px] font-medium text-foreground">勤務地</label>
                                    <input
                                        type="text"
                                        name="appliedLocation"
                                        placeholder="東京都 渋谷区"
                                        className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                    />
                                </div>
                            </div>

                            <hr className="border-border/60" />

                            {/* 連絡先 */}
                            <div className="space-y-3">
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">連絡先</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-medium text-foreground">メールアドレス</label>
                                        <input
                                            type="email"
                                            name="email"
                                            placeholder="example@email.com"
                                            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[12px] font-medium text-foreground">電話番号</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            placeholder="090-0000-0000"
                                            className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/50 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* エラー表示 */}
                            {error && (
                                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[13px]">
                                    <X className="w-4 h-4 mt-0.5 shrink-0" />
                                    {error}
                                </div>
                            )}

                            {/* 成功表示 */}
                            {success && (
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-[13px]">
                                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    登録が完了しました。
                                </div>
                            )}

                            {/* ボタン */}
                            <div className="flex gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={isPending}
                                    className="flex-1 h-9 rounded-lg border border-input bg-background text-[13px] font-medium hover:bg-muted transition-colors disabled:opacity-50"
                                >
                                    キャンセル
                                </button>
                                <button
                                    id="btn-submit-new-applicant"
                                    type="submit"
                                    disabled={isPending || !companyInput.trim()}
                                    className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {isPending ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            登録中...
                                        </>
                                    ) : "登録する"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
