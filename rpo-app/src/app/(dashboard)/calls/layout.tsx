import CallLogsSectionTabs from "./CallLogsSectionTabs"

export default function CallLogsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="space-y-5">
            <CallLogsSectionTabs />
            {children}
        </div>
    )
}
