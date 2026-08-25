import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { consumePasswordResetToken, updateUserPassword, deleteUserSessions } from "@/lib/crud";
import { hashPassword, validatePassword } from "@/lib/security";
import { withErrorHandling, apiError } from "@/lib/api-helpers";

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await initDb();

    let body: Record<string, string>;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body.", 422);
    }

    const token = (body.token || "").trim();
    const newPassword = body.new_password || "";
    const confirmNew = body.confirm_new_password || "";

    const reason = validatePassword(newPassword);
    if (reason) return apiError(reason);

    if (newPassword !== confirmNew) {
      return apiError("New passwords do not match.");
    }

    const userId = await consumePasswordResetToken(token);
    if (userId === null) {
      return apiError(
        "This reset link is invalid or has expired. Request a new one."
      );
    }

    await updateUserPassword(userId, hashPassword(newPassword));
    await deleteUserSessions(userId);

    return NextResponse.json({
      message: "Password has been reset. You can sign in now.",
    });
  });
}
