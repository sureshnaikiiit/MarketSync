'use client';

import { useUpstox } from '@/lib/upstox-tick-data';

export default function UpstoxConnectButton() {
  const { status, connect } = useUpstox();

  if (status === 'connected') return null;

  return (
    <button
      onClick={connect}
      disabled={status === 'connecting'}
      className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {status === 'connecting' ? 'Connecting…' : 'Connect'}
    </button>
  );
}
