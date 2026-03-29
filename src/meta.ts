import { CF_TRACE_URL, CF_LOCATIONS_URL } from './config.js';
import type { ServerMeta } from './tester/types.js';

interface LocationEntry {
  iata: string;
  city: string;
}

// Fallback map for common Cloudflare datacenters when the locations API is unavailable
const COLO_CITIES: Record<string, string> = {
  ATL: 'Atlanta', IAD: 'Ashburn', BOS: 'Boston', ORD: 'Chicago', DFW: 'Dallas',
  DEN: 'Denver', DTW: 'Detroit', HNL: 'Honolulu', IAH: 'Houston', JAX: 'Jacksonville',
  MCI: 'Kansas City', LAS: 'Las Vegas', LAX: 'Los Angeles', MIA: 'Miami',
  MSP: 'Minneapolis', BNA: 'Nashville', EWR: 'Newark', JFK: 'New York',
  PHL: 'Philadelphia', PHX: 'Phoenix', PDX: 'Portland', RIC: 'Richmond',
  SMF: 'Sacramento', SLC: 'Salt Lake City', SAN: 'San Diego', SFO: 'San Francisco',
  SJC: 'San Jose', SEA: 'Seattle', STL: 'St. Louis', TPA: 'Tampa',
  AMS: 'Amsterdam', ARN: 'Stockholm', BCN: 'Barcelona', BER: 'Berlin',
  BRU: 'Brussels', BUD: 'Budapest', CDG: 'Paris', CPH: 'Copenhagen',
  DUB: 'Dublin', DUS: 'Düsseldorf', FRA: 'Frankfurt', HAM: 'Hamburg',
  HEL: 'Helsinki', LHR: 'London', LIS: 'Lisbon', MAD: 'Madrid',
  MAN: 'Manchester', MRS: 'Marseille', MXP: 'Milan', MUC: 'Munich',
  OSL: 'Oslo', PRG: 'Prague', VIE: 'Vienna', WAW: 'Warsaw', ZRH: 'Zurich',
  NRT: 'Tokyo', HND: 'Tokyo', KIX: 'Osaka', ICN: 'Seoul', HKG: 'Hong Kong',
  SIN: 'Singapore', BOM: 'Mumbai', DEL: 'Delhi', MAA: 'Chennai', BLR: 'Bangalore',
  HYD: 'Hyderabad', SYD: 'Sydney', MEL: 'Melbourne', AKL: 'Auckland',
  GRU: 'São Paulo', GIG: 'Rio de Janeiro', SCL: 'Santiago', BOG: 'Bogotá',
  MEX: 'Mexico City', YYZ: 'Toronto', YVR: 'Vancouver', YUL: 'Montreal',
  JNB: 'Johannesburg', CPT: 'Cape Town', CAI: 'Cairo', DXB: 'Dubai',
  DOH: 'Doha', RUH: 'Riyadh', TPE: 'Taipei', KUL: 'Kuala Lumpur',
  BKK: 'Bangkok', CGK: 'Jakarta', MNL: 'Manila', PEK: 'Beijing', PVG: 'Shanghai',
  CAN: 'Guangzhou',
};

export async function fetchServerMeta(): Promise<ServerMeta> {
  const defaults: ServerMeta = { colo: '???', city: 'Unknown', ip: '', loc: '' };

  try {
    const traceRes = await fetch(CF_TRACE_URL, { headers: { 'User-Agent': 'how-fast/1.0.0' } });
    if (!traceRes.ok) return defaults;

    const traceText = await traceRes.text();
    const traceMap = new Map<string, string>();
    for (const line of traceText.split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        traceMap.set(line.slice(0, eq), line.slice(eq + 1));
      }
    }

    const colo = traceMap.get('colo') ?? defaults.colo;
    const ip = traceMap.get('ip') ?? defaults.ip;
    const loc = traceMap.get('loc') ?? defaults.loc;

    // Try locations API first, fall back to built-in map
    let city = COLO_CITIES[colo] ?? colo;
    try {
      const locationsRes = await fetch(CF_LOCATIONS_URL, {
        headers: { 'User-Agent': 'how-fast/1.0.0' },
        signal: AbortSignal.timeout(3000),
      });
      if (locationsRes.ok) {
        const data = await locationsRes.json();
        if (Array.isArray(data)) {
          const match = (data as LocationEntry[]).find(l => l.iata === colo);
          if (match) city = match.city;
        }
      }
    } catch {
      // Use fallback map
    }

    return { colo, city, ip, loc };
  } catch {
    return defaults;
  }
}
