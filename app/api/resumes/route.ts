import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession, listResumes } from "@/lib/crud";

const SESSION_COOKIE = "ip_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

export async function GET() {
  await initDb();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const resumes = await listResumes(user.id);
  return NextResponse.json(
    resumes.map((r) => ({
      id: r.id,
      filename: r.filename,
      pages: r.pages,
      text_preview: (r.extracted_text || "").slice(0, 300),
      uploaded_at: r.uploaded_at,
    }))
  );
}
