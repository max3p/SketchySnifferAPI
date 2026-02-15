# SketchySniffer

An AI-powered decision reflection tool for online marketplace listings. Users paste a listing URL and receive a risk assessment, red flag analysis, cognitive bias insights, and reflective quiz questions to support critical thinking before acting on impulse.

## Getting Started

### Prerequisites

- Node.js

### Installation

```bash
npm install
```

### Running

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The API runs on `http://localhost:3000` by default. Configure the port via `.env`:

```
PORT=3000
```

## API

**Base URL:** `/api/`

| Method | Endpoint     | Description                                      |
| ------ | ------------ | ------------------------------------------------ |
| POST   | `/analyses`  | Analyze a marketplace listing URL for scam risks |

See [api-docs.md](api-docs.md) for full request/response documentation.
