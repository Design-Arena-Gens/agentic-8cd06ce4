# AI Calling Agent

Voice-first guided concierge that mimics a smart outbound phone call. The agent asks questions, collects key information, and keeps a live transcript powered by OpenAI.

## Getting Started

### Requirements

- Node.js 18+
- npm 9+
- `OPENAI_API_KEY` environment variable if you want live AI responses

### Setup

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` and click **Start AI Call**. If your browser supports the Web Speech API, the experience will capture microphone input automatically; otherwise, type responses in the fallback input.

## Environment Variables

Create a `.env.local` file with:

```
OPENAI_API_KEY=sk-...
```

Without a key the backend returns an error when the agent tries to respond.

## Architecture

- Next.js App Router UI with a client-side call console
- Web Speech API (speech recognition + synthesis) for natural audio interaction
- Stateless REST endpoints under `/api/agent` that manage conversational context and call OpenAI's `gpt-4o-mini`

## Production

Build and start the optimized production server:

```bash
npm run build
npm start
```

Deploy anywhere that supports Node 18+, e.g. Vercel. The conversation state is stored in-memory per function instance, so choose a deployment target that maintains connection affinity if you scale horizontally.
