import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession, getJobScoped } from "@/lib/crud";

const SESSION_COOKIE = "ip_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

function jsonError(detail: string, status = 400) {
  return NextResponse.json({ detail }, { status });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  await initDb();
  const user = await getCurrentUser();
  if (!user) return jsonError("Unauthorized", 401);

  const { jobId } = await params;
  const job = await getJobScoped(parseInt(jobId, 10), user.id);
  if (!job) return jsonError("Job not found.", 404);

  return NextResponse.json({
    id: job.id,
    role: job.role,
    company: job.company,
    experience: job.experience,
    description: job.description,
    created_at: job.created_at,
  });
}
