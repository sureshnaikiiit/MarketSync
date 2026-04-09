import NavBar from '@/app/components/NavBar';
import ConnectionBadge from '@/app/components/ConnectionBadge';
import WatchList from '@/app/components/WatchList';

export default function USMarketPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <NavBar actions={<ConnectionBadge />} />

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">US Market</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Real-time order book · NYSE &amp; NASDAQ · via AllTick
            </p>
          </div>
          <span className="text-xs text-zinc-600 font-mono">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        <WatchList />
      </div>
    </main>
  );
}
