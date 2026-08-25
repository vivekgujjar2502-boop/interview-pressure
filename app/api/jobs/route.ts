import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession, createJob } from "@/lib/crud";
import { withErrorHandling, apiError } from "@/lib/api-helpers";

const SESSION_COOKIE = "ip_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return apiError("Unauthorized", 401);

    let body: Record<string, string>;
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body.", 422);
    }

    const role = (body.role || "").trim();
    if (!role) return apiError("Job role is required.");

    const job = await createJob(
      user.id,
      role,
      (body.company || "").trim(),
      body.experience || "Fresher",
      (body.description || "").trim()
    );

    return NextResponse.json({
      id: job.id,
      role: job.role,
      company: job.company,
      experience: job.experience,
      description: job.description,
      created_at: job.created_at,
    });
  });
}
