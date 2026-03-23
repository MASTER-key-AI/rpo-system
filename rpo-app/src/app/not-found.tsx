import Link from "next/link"

export default function NotFound() {
	return (
		<div className="min-h-screen grid place-items-center bg-slate-50 p-6">
			<div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 text-center space-y-4">
				<h1 className="text-3xl font-bold text-slate-900">404</h1>
				<p className="text-slate-600">指定したページは見つかりませんでした。</p>
				<Link href="/applicants" className="inline-flex px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700">
					ダッシュボードへ戻る
				</Link>
			</div>
		</div>
	)
}
