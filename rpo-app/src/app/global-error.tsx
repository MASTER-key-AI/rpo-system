"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<html>
			<body>
				<div className="min-h-screen grid place-items-center bg-slate-900 text-white p-6">
					<div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
						<h1 className="text-2xl font-bold">システムエラー</h1>
						<p className="text-sm text-slate-300">
							予期しないエラーが発生しました。しばらくお待ちください。
						</p>
						<p className="text-xs text-slate-400 break-all">{error.message || "unknown"}</p>
						<button
							type="button"
							onClick={() => reset()}
							className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700"
						>
							再読み込み
						</button>
					</div>
				</div>
			</body>
		</html>
	)
}
