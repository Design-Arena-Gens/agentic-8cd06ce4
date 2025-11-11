import { NextResponse } from "next/server";
import { generateResponse } from "@/lib/agent";

export async function POST(request: Request) {
  try {
    const { sessionId, message } = await request.json();
    if (!sessionId || !message) {
      return NextResponse.json({ error: "Missing sessionId or message" }, { status: 400 });
    }
    const data = await generateResponse({ sessionId, input: message });
    return NextResponse.json({ ...data, followUp: null });
  } catch (error) {
    console.error("Agent respond error", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
