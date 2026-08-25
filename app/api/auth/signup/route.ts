import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { getUserByEmail, createUser, createSession } from "@/lib/crud";
import { hashPassword, validatePassword } from "@/lib/security";
import { withErrorHandling, apiError } from "@/lib/api-helpers";

const EMAIL_MESSAGE = "Please enter a valid email address.";
const SESSION_COOKIE = "ip_session";

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await initDb();

    let body: Record<string, string>;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body.", 422);
    }

    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const confirmPassword = body.confirm_password || "";

    if (name.length < 2) {
      return apiError("Please enter your full name.");
    }

    if (!email.includes("@") || !email.split("@").pop()?.includes(".")) {
      return apiError(EMAIL_MESSAGE);
    }

    const reason = validatePassword(password);
    if (reason) return apiError(reason);

    if (password !== confirmPassword) {
      return apiError("Passwords do not match.");
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return apiError(
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
  });
}
