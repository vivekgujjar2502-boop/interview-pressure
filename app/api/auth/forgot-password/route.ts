import { NextResponse } from "next/server";
import { initDb } from "@/lib/db";
import { getUserByEmail, createPasswordResetToken } from "@/lib/crud";
import { withErrorHandling } from "@/lib/api-helpers";

const RESET_DEV_MODE = (process.env.RESET_DEV_MODE || "true").toLowerCase() === "true";

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await initDb();

    let body: Record<string, string>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ detail: "Invalid JSON body." }, { status: 422 });
    }

    const email = (body.email || "").trim().toLowerCase();
    const user = await getUserByEmail(email);

    if (user && RESET_DEV_MODE) {
      const devToken = await createPasswordResetToken(user.id);
      return NextResponse.json({
        message:
          "Email delivery is not configured. Development mode: use the reset token below within 30 minutes.",
        dev_reset_token: devToken,
      });
    }

    return NextResponse.json({
      message:
        "If this account exists, a password reset has been created. Email delivery is not configured on this server.",
      dev_reset_token: null,
    });
  });
}
