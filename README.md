# SketchySniffer

An AI-powered decision reflection tool for online marketplace listings. Users paste a listing URL and receive a risk assessment, red flag analysis, cognitive bias insights, and reflective quiz questions to support critical thinking before acting on impulse.

## Getting Started

### Prerequisites

- Node.js
- An [OpenAI API key](https://platform.openai.com/api-keys)

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```
PORT=3000
OPENAI_API_KEY=your-api-key-here
```

### Running

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

The API runs on `http://localhost:3000` by default.

## API

**Base URL:** `/api/`

| Method | Endpoint     | Description                                      |
| ------ | ------------ | ------------------------------------------------ |
| POST   | `/analyses`  | Analyze a marketplace listing URL for scam risks |

See [api-docs.md](docs/api-docs.md) for full request/response documentation.
