import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession, updateUserName } from "@/lib/crud";

const SESSION_COOKIE = "ip_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

function jsonError(detail: string, status = 400) {
  return NextResponse.json({ detail }, { status });
}

export async function PATCH(request: Request) {
  await initDb();
  const user = await getCurrentUser();
  if (!user) {
    return jsonError("You need to sign in to continue.", 401);
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 422);
  }

  const name = (body.name || "").trim();
  if (name.length < 2) {
    return jsonError("Please enter your full name.");
  }

  const updated = await updateUserName(user.id, name);
  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    created_at: updated.created_at,
  });
}
