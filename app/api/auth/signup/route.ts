import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { getUserByEmail, createUser, createSession } from "@/lib/crud";
import { hashPassword, validatePassword } from "@/lib/security";

const EMAIL_MESSAGE = "Please enter a valid email address.";
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

  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const confirmPassword = body.confirm_password || "";

  if (name.length < 2) {
    return jsonError("Please enter your full name.");
  }

  if (!email.includes("@") || !email.split("@").pop()?.includes(".")) {
    return jsonError(EMAIL_MESSAGE);
  }

  const reason = validatePassword(password);
  if (reason) return jsonError(reason);

  if (password !== confirmPassword) {
    return jsonError("Passwords do not match.");
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return jsonError(
      "An account with this email already exists. Try signing in instead.",
      409
    );
  }

  const user = await createUser(name, email, hashPassword(password));
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
