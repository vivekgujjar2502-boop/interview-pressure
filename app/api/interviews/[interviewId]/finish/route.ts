import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession, getInterviewById, finishInterview as crudFinish } from "@/lib/crud";
import { withErrorHandling, apiError } from "@/lib/api-helpers";

const SESSION_COOKIE = "ip_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ interviewId: string }> }
) {
  return withErrorHandling(async () => {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return apiError("Unauthorized", 401);

    const { interviewId } = await params;
    const id = parseInt(interviewId, 10);
    const interview = await getInterviewById(id, user.id);
    if (!interview) return apiError("Interview not found.", 404);
    if (interview.status === "completed") {
      return apiError("Interview already finished.");
    }

    const result = await crudFinish(id);
    return NextResponse.json(result);
  });
}
