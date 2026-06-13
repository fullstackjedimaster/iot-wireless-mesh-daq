// /src/lib/env.ts

function required(name: string, value?: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const settings = {
  RAG_CORE_BASE:
    process.env.NEXT_PUBLIC_RAG_CORE_BASE ||
     "https://ai-core.fullstackjedi.dev",

  RAG_API_BASE:
    process.env.NEXT_PUBLIC_RAG_API_BASE ||
     "https://rag.fullstackjedi.dev",


  RAG_CLIENT_NAME:
     process.env.NEXT_PUBLIC_RAG_CLIENT_NAME ||
      "iot-wireless-mesh-daq",

  DOCK_ORIGIN:
     process.env.NEXT_PUBLIC_DOCK_ORIGIN ||
      "https://rag.fullstackjedi.dev",


  DOCK_FRAME_ID:
     process.env.NEXT_PUBLIC_DOCK_FRAME_ID ||
      "daq-dock",

  PORTFOLIO_LOCK_ENABLED:
      process.env.NEXT_PUBLIC_PORTFOLIO_LOCK_ENABLED ||
      "true",

  EMBED_SECRET:
      process.env.EMBED_SECRET ||
      "true",


} as const;

export default settings;