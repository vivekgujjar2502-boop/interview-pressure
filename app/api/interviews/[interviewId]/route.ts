import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import { findSession, getInterviewById, deleteInterview } from "@/lib/crud";
import { rm } from "fs/promises";
import { join } from "path";
import { withErrorHandling, apiError } from "@/lib/api-helpers";

const SESSION_COOKIE = "ip_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

function toInterviewOut(interview: Awaited<ReturnType<typeof getInterviewById>>) {
  if (!interview) return null;
  return {
    id: interview.id,
    status: interview.status,
    score: interview.score,
    job_role: interview.job.role,
    company: interview.job.company,
    experience: interview.job.experience,
    questions: interview.questions.map((q) => ({
      id: q.id,
      question_number: q.question_number,
      question_text: q.question_text,
      answer_text: q.answer?.answer_text ?? null,
    })),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ interviewId: string }> }
) {
  return withErrorHandling(async () => {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return apiError("Unauthorized", 401);

    const { interviewId } = await params;
    const interview = await getInterviewById(parseInt(interviewId, 10), user.id);
    if (!interview) return apiError("Interview not found.", 404);

    return NextResponse.json(toInterviewOut(interview));
  });
}

export async function DELETE(
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

    try {
      const audioDir = join(process.cwd(), "tmp", `interview_${id}`);
      await rm(audioDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    await deleteInterview(id);
    return NextResponse.json({ message: "Interview deleted." });
  });
}
