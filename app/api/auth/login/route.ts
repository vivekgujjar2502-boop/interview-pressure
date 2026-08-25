import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { getUserByEmail, createSession } from "@/lib/crud";
import { verifyPassword } from "@/lib/security";

const SESSION_COOKIE = "ip_session";

function jsonError(detail: string, status = 400) {
  return NextResponse.json({ detail }, { status });
}

export async function POST(request: Request) {
  await initDb();

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 422);
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return jsonError("Invalid email or password.", 401);
  }

  const { token } = await createSession(user.id);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return NextResponse.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, created_at: user.created_at },
  });
}
