import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";

export async function GET() {
  try {
    await initDb();
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database unavailable";
    return NextResponse.json({ status: "error", detail: message }, { status: 500 });
  }
}
