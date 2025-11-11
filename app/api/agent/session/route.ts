import { NextResponse } from "next/server";
import { bootstrapSession } from "@/lib/agent";

export async function POST() {
  try {
    const payload = await bootstrapSession();
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to bootstrap session", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
