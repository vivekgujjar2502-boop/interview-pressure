import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { initDb } from "@/lib/db";
import {
  findSession,
  getInterviewById,
  getResumeById,
  upsertAnswer,
  applyEvaluation,
  applyAiError,
  jobDescriptionText,
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

function answerToJSON(answer: Awaited<ReturnType<typeof upsertAnswer>>) {
  return {
    id: answer.id,
    question_id: answer.question_id,
    answer_text: answer.answer_text,
    score: answer.score,
    feedback: answer.feedback,
    audio_path: answer.audio_path,
    transcript: answer.transcript,
    strengths: JSON.parse(answer.strengths || "[]"),
    weaknesses: JSON.parse(answer.weaknesses || "[]"),
    improvement: answer.improvement,
    communication_notes: answer.communication_notes,
    ai_error: answer.ai_error,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ interviewId: string; questionId: string }> }
) {
  return withErrorHandling(async () => {
    await initDb();
    const user = await getCurrentUser();
    if (!user) return apiError("Unauthorized", 401);

    const { interviewId, questionId } = await params;
    const ivId = parseInt(interviewId, 10);
    const qId = parseInt(questionId, 10);

    const interview = await getInterviewById(ivId, user.id);
    if (!interview) return apiError("Interview not found.", 404);

    const question = interview.questions.find((q) => q.id === qId);
    if (!question) {
      return apiError("Question does not belong to this interview.", 404);
    }

    let body: { answer_text?: string };
    try {
      body = await request.json();
    } catch {
      return apiError("Invalid JSON body.", 422);
    }

    const answerText = (body.answer_text || "").trim();
    if (!answerText) {
      return apiError("Answer is empty.");
    }

    const existing = question.answer;

    await upsertAnswer(
      qId,
      answerText,
      existing?.transcript ?? null,
      existing?.audio_path ?? null
    );

    try {
      const resume = await getResumeById(interview.resume_id);
      const evaluation = await ai.evaluateAnswer(
        question.question_text,
        answerText,
        resume?.extracted_text || "",
        jobDescriptionText(interview.job)
      );
      const updated = await applyEvaluation(qId, evaluation);
      return NextResponse.json(answerToJSON(updated));
    } catch (err) {
      const message =
        err instanceof ai.OllamaSetupError || err instanceof ai.AiResponseError
          ? err.message
          : "AI evaluation failed.";
      const updated = await applyAiError(qId, message);
      return NextResponse.json(answerToJSON(updated));
    }
  });
}
