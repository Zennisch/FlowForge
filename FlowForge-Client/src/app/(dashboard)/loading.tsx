export default function DashboardLoading() {
  return (
    <main className="flex h-full items-center justify-center p-4">
      <div className="flex items-center gap-3 text-sm text-(--color-text-secondary)">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-(--color-border) border-t-(--color-primary)" />
        <span>Loading...</span>
      </div>
    </main>
  );
}
