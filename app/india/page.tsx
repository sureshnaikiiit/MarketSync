import NavBar from '@/app/components/NavBar';
import UpstoxConnectionBadge from '@/app/components/UpstoxConnectionBadge';
import UpstoxConnectButton from '@/app/components/UpstoxConnectButton';
import IndiaWatchList from '@/app/components/IndiaWatchList';

export default function IndiaMarketPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <NavBar
        actions={
          <div className="flex items-center gap-3">
            <UpstoxConnectionBadge />
            <UpstoxConnectButton />
          </div>
        }
      />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">India Market</h2>
          <p className="mt-1 text-sm text-zinc-500">NSE · Live LTP · Change · Volume via Upstox</p>
        </div>

        <IndiaWatchList />
      </div>
    </main>
  );
}
