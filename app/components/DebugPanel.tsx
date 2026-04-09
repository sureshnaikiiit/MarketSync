'use client';

import { useEffect, useRef, useState } from 'react';

const TOKEN = process.env.NEXT_PUBLIC_ALLTICK_TOKEN ?? '';
const WS_URL = `wss://quote.alltick.co/quote-stock-b-ws-api?token=${TOKEN}`;

const SUBSCRIBE_MSG = {
  cmd_id: 22002,
  seq_id: 1,
  trace: 'debug-1',
  data: {
    symbol_list: [
      { code: '700.HK', depth_level: 5 },
      { code: 'AAPL.US', depth_level: 5 },
    ],
  },
};

export default function DebugPanel() {
  const [log, setLog] = useState<string[]>([]);
  const ws = useRef<WebSocket | null>(null);

  const push = (msg: string) =>
    setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 30));

  useEffect(() => {
    push(`Connecting to: ${WS_URL.replace(TOKEN, TOKEN.slice(0, 8) + '…')}`);

    const socket = new WebSocket(WS_URL);
    ws.current = socket;

    socket.onopen = () => {
      push('✅ WebSocket OPEN — sending subscription…');
      socket.send(JSON.stringify(SUBSCRIBE_MSG));
      push(`Sent: ${JSON.stringify(SUBSCRIBE_MSG)}`);
    };

    socket.onmessage = (e) => {
      push(`📨 MSG: ${e.data}`);
    };

    socket.onerror = () => push('❌ WebSocket ERROR');

    socket.onclose = (e) => push(`🔌 CLOSED — code=${e.code} reason="${e.reason}"`);

    return () => {
      socket.onclose = null;
      socket.close();
    };
  }, []);

  return (
    <div className="mt-10 rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-yellow-400">
        WebSocket Debug
      </p>
      <div className="flex flex-col gap-1 font-mono text-xs text-zinc-300">
        {log.length === 0 ? (
          <span className="text-zinc-600">Connecting…</span>
        ) : (
          log.map((line, i) => <span key={i}>{line}</span>)
        )}
      </div>
    </div>
  );
}
