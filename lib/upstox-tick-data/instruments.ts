// NSE instrument keys — format: "NSE_EQ|<ISIN>"
// Full list: https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz

export interface Instrument {
  key: string;   // Upstox instrument key
  label: string; // Human-readable ticker
  name: string;  // Company name
}

export const NSE_INSTRUMENTS: Instrument[] = [
  { key: 'NSE_EQ|INE002A01018', label: 'RELIANCE',  name: 'Reliance Industries'    },
  { key: 'NSE_EQ|INE467B01029', label: 'TCS',        name: 'Tata Consultancy Svcs'  },
  { key: 'NSE_EQ|INE009A01021', label: 'INFY',       name: 'Infosys'                },
  { key: 'NSE_EQ|INE040A01034', label: 'HDFCBANK',   name: 'HDFC Bank'              },
  { key: 'NSE_EQ|INE090A01021', label: 'ICICIBANK',  name: 'ICICI Bank'             },
  { key: 'NSE_EQ|INE075A01022', label: 'WIPRO',      name: 'Wipro'                  },
  { key: 'NSE_EQ|INE154A01025', label: 'ITC',        name: 'ITC'                    },
  { key: 'NSE_EQ|INE062A01020', label: 'SBIN',       name: 'State Bank of India'    },
];

export const NSE_INDEX_INSTRUMENTS: Instrument[] = [
  { key: 'NSE_INDEX|Nifty 50',   label: 'NIFTY 50',   name: 'Nifty 50 Index'   },
  { key: 'NSE_INDEX|Nifty Bank', label: 'BANKNIFTY',  name: 'Nifty Bank Index' },
];

/** All instrument keys for default subscription */
export const DEFAULT_INSTRUMENT_KEYS = NSE_INSTRUMENTS.map(i => i.key);

/** Map from instrument key → display label */
export const INSTRUMENT_LABEL: Record<string, string> = Object.fromEntries(
  [...NSE_INSTRUMENTS, ...NSE_INDEX_INSTRUMENTS].map(i => [i.key, i.label])
);
