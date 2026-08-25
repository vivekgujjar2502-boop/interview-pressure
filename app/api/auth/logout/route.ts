import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { deleteSession } from "@/lib/crud";

const SESSION_COOKIE = "ip_session";

export async function POST() {
  await initDb();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await deleteSession(token);
  }

  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ message: "Signed out." });
}
