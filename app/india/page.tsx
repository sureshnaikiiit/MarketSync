import NavBar from '@/app/components/NavBar';

export default function IndiaMarketPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <NavBar />

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">India Market</h2>
          <p className="mt-1 text-sm text-zinc-500">NSE · BSE · Real-time via Upstox</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
          <p className="text-zinc-400 text-sm">
            Upstox integration coming soon.
          </p>
          <p className="mt-2 text-zinc-600 text-xs">
            Requires an Upstox account and OAuth2 setup.
          </p>
        </div>
      </div>
    </main>
  );
}
