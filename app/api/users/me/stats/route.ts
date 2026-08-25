import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession, buildUserStats } from "@/lib/crud";
import { withErrorHandling } from "@/lib/api-helpers";

const SESSION_COOKIE = "ip_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

export async function GET() {
  return withErrorHandling(async () => {
    await initDb();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
    }
    const stats = await buildUserStats(user.id);
    return NextResponse.json(stats);
  });
}
