import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import {
  findSession,
  updateUserPassword,
  deleteUserSessions,
  createSession,
} from "@/lib/crud";
import { hashPassword, verifyPassword, validatePassword } from "@/lib/security";

const SESSION_COOKIE = "ip_session";

function jsonError(detail: string, status = 400) {
  return NextResponse.json({ detail }, { status });
}

export async function POST(request: Request) {
  await initDb();

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) {
    return jsonError("You need to sign in to continue.", 401);
  }

  const session = await findSession(token);
  if (!session) {
    return jsonError("Your session is no longer valid.", 401);
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 422);
  }

  const currentPassword = body.current_password || "";
  const newPassword = body.new_password || "";
  const confirmNew = body.confirm_new_password || "";

  if (!verifyPassword(currentPassword, session.user.password_hash)) {
    return jsonError("Your current password is incorrect.");
  }

  const reason = validatePassword(newPassword);
  if (reason) return jsonError(reason);

  if (newPassword !== confirmNew) {
    return jsonError("New passwords do not match.");
  }

  await updateUserPassword(session.user.id, hashPassword(newPassword));
  await deleteUserSessions(session.user.id);

  const { token: newToken } = await createSession(session.user.id);

  cookieStore.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return NextResponse.json({
    message: "Password updated.",
    token: newToken,
  });
}
