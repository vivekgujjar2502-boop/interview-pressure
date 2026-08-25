import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { consumePasswordResetToken, updateUserPassword, deleteUserSessions } from "@/lib/crud";
import { hashPassword, validatePassword } from "@/lib/security";

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

  const token = (body.token || "").trim();
  const newPassword = body.new_password || "";
  const confirmNew = body.confirm_new_password || "";

  const reason = validatePassword(newPassword);
  if (reason) return jsonError(reason);

  if (newPassword !== confirmNew) {
    return jsonError("New passwords do not match.");
  }

  const userId = await consumePasswordResetToken(token);
  if (userId === null) {
    return jsonError(
      "This reset link is invalid or has expired. Request a new one."
    );
  }

  await updateUserPassword(userId, hashPassword(newPassword));
  await deleteUserSessions(userId);

  return NextResponse.json({
    message: "Password has been reset. You can sign in now.",
  });
}
