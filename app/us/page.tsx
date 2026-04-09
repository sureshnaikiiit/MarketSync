import NavBar from '@/app/components/NavBar';
import ConnectionBadge from '@/app/components/ConnectionBadge';
import WatchList from '@/app/components/WatchList';

export default function USMarketPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <NavBar actions={<ConnectionBadge />} />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">US Market</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Live order book · Best bid / ask · Mid price
          </p>
        </div>

        <WatchList />
      </div>
    </main>
  );
}
