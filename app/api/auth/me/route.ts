import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession } from "@/lib/crud";
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
      return NextResponse.json(
        { detail: "You need to sign in to continue." },
        { status: 401 }
      );
    }
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      created_at: user.created_at,
    });
  });
}
