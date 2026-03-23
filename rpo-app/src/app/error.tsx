"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<div className="min-h-screen grid place-items-center bg-slate-50 text-slate-900 p-6">
			<div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-sm p-6 space-y-4">
				<h1 className="text-2xl font-bold">ページ表示中に問題が発生しました</h1>
				<p className="text-sm text-slate-600">
					一時的な障害の可能性があります。しばらくしてから再読み込みしてください。
				</p>
				<p className="text-xs text-slate-500 break-all">{"Error: " + (error.message || "unknown")}</p>
				<button
					type="button"
					onClick={() => reset()}
					className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
				>
					再読み込み
				</button>
			</div>
		</div>
	)
}
