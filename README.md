# wirespeed

Fast, zero-dependency internet speed test for the terminal. Measures download, upload, and latency using Cloudflare's global edge network.

```
$ npx wirespeed

  wirespeed v1.2.1

  Server    Cloudflare — Mumbai (BOM)
  IP        203.0.113.42

  Latency   12.34 ms (jitter: 1.23 ms)
  Download  245.67 Mbps
  Upload    98.12 Mbps
```

## Install

```bash
npm install -g @mayurpise/wirespeed
```

Or run directly:

```bash
npx @mayurpise/wirespeed
```

## Usage

```bash
wirespeed                 # Run full speed test
wirespeed --json          # Output results as JSON
wirespeed --no-upload     # Skip upload test
wirespeed --no-download   # Skip download test
```

### Options

| Flag             | Description          |
| ---------------- | -------------------- |
| `--json`         | Output results as JSON |
| `--no-download`  | Skip download test   |
| `--no-upload`    | Skip upload test     |
| `-h`, `--help`   | Show help            |
| `-v`, `--version`| Show version         |

### JSON output

```bash
wirespeed --json | jq .
```

```json
{
  "server": { "colo": "BOM", "city": "Mumbai", "ip": "203.0.113.42", "loc": "IN" },
  "latency": { "median_ms": 12.34, "jitter_ms": 1.23 },
  "download": { "speed_bps": 245670000, "speed_mbps": 245.67 },
  "upload": { "speed_bps": 98120000, "speed_mbps": 98.12 }
}
```

## How it works

wirespeed uses Cloudflare's speed test infrastructure (`speed.cloudflare.com`):

1. **Server detection** — Identifies the nearest Cloudflare edge via `/cdn-cgi/trace`
2. **Latency** — 20 zero-byte round trips, reports median and jitter
3. **Download** — Multi-phase parallel requests with increasing payload sizes (100KB to 100MB)
4. **Upload** — Multi-phase parallel uploads (100KB to 10MB)

Bandwidth is the maximum per-phase aggregate throughput (total bytes over wall-clock time across parallel streams) for accuracy under parallel load. Real-time UI speed is smoothed with an exponential moving average. (Individual per-request percentiles are collected but not used for the final reported speed.)

## Requirements

- Node.js >= 18.0.0

## License

MIT
