import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";

export async function GET() {
  try {
    await initDb();
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
