import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import {
  findSession,
  getResumeScoped,
  getJobScoped,
  extractSkills,
  buildQuestions,
  createInterview,
  listInterviews,
} from "@/lib/crud";
import * as ai from "@/lib/ai";
import { withErrorHandling, apiError } from "@/lib/api-helpers";

const SESSION_COOKIE = "ip_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await findSession(token);
  return session?.user ?? null;
}

function toInterviewOut(interview: Awaited<ReturnType<typeof createInterview>>) {
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

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return apiError("Unauthorized", 401);

    let body: { resume_id?: number; job_id?: number };
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body.", 422);
    }

    const resume = await getResumeScoped(body.resume_id || 0, user.id);
    if (!resume) return apiError("Resume not found.", 404);

    const job = await getJobScoped(body.job_id || 0, user.id);
    if (!job) return apiError("Job not found.", 404);

    const skills = extractSkills(resume.extracted_text || "");
    const fallback = buildQuestions(job.role, job.company, job.experience, skills);

    let questions: string[];
    try {
      questions = await ai.generateQuestions(
        resume.extracted_text || "",
        job.role,
        job.company,
        job.experience,
        job.description || ""
      );
    } catch {
      questions = fallback;
    }

    const interview = await createInterview(user.id, resume.id, job.id, questions);
    return NextResponse.json(toInterviewOut(interview));
  });
}

export async function GET() {
  return withErrorHandling(async () => {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return apiError("Unauthorized", 401);

    const interviews = await listInterviews(user.id);
    return NextResponse.json(
      interviews.map((iv) => ({
        id: iv.id,
        role: iv.job.role,
        company: iv.job.company,
        experience: iv.job.experience,
        status: iv.status,
        score: iv.score,
        created_at: iv.created_at,
        completed_at: iv.completed_at,
        total_questions: iv.total_questions,
        answered_questions: iv.answered_questions,
      }))
    );
  });
}
